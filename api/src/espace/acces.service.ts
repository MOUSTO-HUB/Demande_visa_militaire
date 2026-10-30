import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import type {
  ChargeJetonMilitaire,
  UtilisateurConnecte,
} from '../auth/auth.types.js';
import {
  ActionAudit,
  CanalMessage,
  StatutCampagne,
  StatutDossier,
  TypeMessage,
} from '../generated/prisma/enums.js';
import { masquer } from '../messages/modeles.js';
import { MessagesService } from '../messages/messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { chiffrerTexte, cleSecrets } from '../securite/chiffrement.js';
import { STATUTS_FINAUX } from '../dossiers/statuts.regles.js';

/** Durée du lien personnel. */
export const JOURS_VALIDITE_LIEN = 60;
const CODE_MINUTES = 10;
const CODE_ESSAIS = 5;
const CODES_PAR_HEURE = 5;
const DELAI_ENTRE_CODES_MS = 60_000;
export const DUREE_SESSION_MILITAIRE = '2h';

const empreinte = (texte: string) =>
  createHash('sha256').update(texte).digest('hex');

const MESSAGE_LIEN_INVALIDE =
  "Ce lien n'est pas valable. Utilisez le dernier lien reçu de la DGRECM, ou demandez-en un nouveau.";

/**
 * Accès du militaire à son espace (cahier des charges, F3.1) : un lien
 * personnel, puis un code à usage unique envoyé par email ou SMS aux
 * coordonnées de sa fiche. Le lien seul ne suffit pas.
 */
@Injectable()
export class AccesService {
  private readonly cle: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.cle = cleSecrets(config.getOrThrow<string>('JWT_SECRET'));
  }

  // ─── Côté DGRECM ───────────────────────────────────────────────────────────

  /**
   * Crée (ou renouvelle : l'ancien lien cesse de fonctionner) le lien du
   * militaire et le lui envoie. Le lien est aussi rendu à l'agent, qui peut
   * le transmettre autrement (il ne suffit pas sans le code).
   */
  async creerLien(u: UtilisateurConnecte, dossierId: string) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      select: {
        statut: true,
        campagne: { select: { statut: true } },
        militaire: { select: { email: true, telephone: true } },
      },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable.');
    if (dossier.campagne.statut === StatutCampagne.CLOSE)
      throw new BadRequestException('Cette campagne est close.');
    if (STATUTS_FINAUX.includes(dossier.statut))
      throw new BadRequestException('Ce dossier est terminé.');
    const destinations = this.messages.destinations(dossier.militaire);
    if (!destinations.length)
      throw new BadRequestException(
        "La fiche du militaire n'a ni email ni téléphone : le code de connexion ne pourrait pas lui parvenir. Complétez-la d'abord.",
      );

    const jeton = randomBytes(24).toString('base64url');
    const donnees = {
      jetonHash: empreinte(jeton),
      jetonChiffre: chiffrerTexte(jeton, this.cle),
      expireLe: new Date(Date.now() + JOURS_VALIDITE_LIEN * 86_400_000),
      codeHash: null,
      codeExpireLe: null,
      codeEssais: 0,
      creePar: u.id,
    };
    await this.prisma.accesMilitaire.upsert({
      where: { dossierId },
      create: { dossierId, ...donnees },
      update: donnees,
    });
    const message = await this.messages.enfiler(
      dossierId,
      TypeMessage.LIEN_ACCES,
      {},
      { creePar: u.id },
    );
    await this.audit.journaliser(
      u,
      ActionAudit.CREATION,
      'AccesMilitaire',
      dossierId,
    );
    return {
      lien: this.messages.lien(donnees.jetonChiffre),
      expireLe: donnees.expireLe,
      envoi: message
        ? {
            canal: message.canal,
            destinataire: masquer(message.canal, message.destinataire),
          }
        : null,
    };
  }

  /** Liens pour tous les dossiers « à compléter » de la campagne qui n'en ont pas encore. */
  async creerLiensCampagne(u: UtilisateurConnecte, campagneId: string) {
    const dossiers = await this.prisma.dossier.findMany({
      where: {
        campagneId,
        statut: StatutDossier.A_COMPLETER,
        acces: null,
      },
      select: { id: true },
    });
    let crees = 0;
    const sansCoordonnees: string[] = [];
    for (const d of dossiers) {
      try {
        await this.creerLien(u, d.id);
        crees++;
      } catch (e) {
        if (e instanceof BadRequestException) sansCoordonnees.push(d.id);
        else throw e;
      }
    }
    return { crees, sansCoordonnees: sansCoordonnees.length };
  }

  /** Relance ou convocation envoyée à la main depuis la fiche du dossier. */
  async envoyerMessage(
    u: UtilisateurConnecte,
    dossierId: string,
    type: 'RAPPEL_FICHE' | 'CONVOCATION_DEPOT',
  ) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      select: {
        statut: true,
        dateRendezVous: true,
        acces: { select: { expireLe: true } },
      },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable.');
    if (type === TypeMessage.RAPPEL_FICHE) {
      if (dossier.statut !== StatutDossier.A_COMPLETER)
        throw new BadRequestException(
          'La fiche n’est plus à compléter : pas de rappel à envoyer.',
        );
      if (!dossier.acces || dossier.acces.expireLe < new Date())
        throw new BadRequestException(
          "Le militaire n'a pas de lien valable : envoyez d'abord le lien d'accès.",
        );
    } else if (!dossier.dateRendezVous)
      throw new BadRequestException(
        'Aucun rendez-vous enregistré pour ce dossier.',
      );
    const message = await this.messages.enfiler(
      dossierId,
      type,
      dossier.dateRendezVous
        ? { dateRendezVous: dossier.dateRendezVous.toISOString() }
        : {},
      { creePar: u.id },
    );
    await this.audit.journaliser(u, ActionAudit.MESSAGE, 'Dossier', dossierId, {
      type,
    });
    return {
      statut: message?.statut,
      canal: message?.canal,
      destinataire: message
        ? masquer(message.canal, message.destinataire)
        : null,
      erreur: message?.erreur ?? null,
    };
  }

  /** État de l'accès, pour la fiche du dossier (jamais le lien lui-même). */
  async etat(dossierId: string) {
    const acces = await this.prisma.accesMilitaire.findUnique({
      where: { dossierId },
      select: {
        creeLe: true,
        modifieLe: true,
        expireLe: true,
        derniereConnexion: true,
      },
    });
    return {
      acces,
      messages: await this.messages.historique(dossierId),
    };
  }

  // ─── Côté militaire ────────────────────────────────────────────────────────

  /** Ouverture du lien : à qui envoyer le code (coordonnées masquées). */
  async ouvrir(jeton: string) {
    const acces = await this.accesValide(jeton);
    const m = acces.dossier.militaire;
    return {
      prenoms: m.prenoms,
      campagne: acces.dossier.campagne.libelle,
      canaux: this.messages.destinations(m).map((d) => ({
        canal: d.canal,
        destinataire: masquer(d.canal, d.destinataire),
      })),
    };
  }

  async demanderCode(jeton: string, canal: CanalMessage) {
    const acces = await this.accesValide(jeton);
    const destination = this.messages
      .destinations(acces.dossier.militaire)
      .find((d) => d.canal === canal);
    if (!destination)
      throw new BadRequestException(
        'Ce moyen de contact n’est pas disponible.',
      );
    if (
      acces.codeEnvoyeLe &&
      Date.now() - acces.codeEnvoyeLe.getTime() < DELAI_ENTRE_CODES_MS
    )
      throw new HttpException(
        'Un code vient d’être envoyé. Attendez une minute avant d’en demander un autre.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const recents = await this.prisma.message.count({
      where: {
        dossierId: acces.dossierId,
        type: TypeMessage.CODE_ACCES,
        creeLe: { gte: new Date(Date.now() - 3_600_000) },
      },
    });
    if (recents >= CODES_PAR_HEURE)
      throw new HttpException(
        'Trop de codes demandés. Réessayez dans une heure.',
        HttpStatus.TOO_MANY_REQUESTS,
      );

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.accesMilitaire.update({
      where: { id: acces.id },
      data: {
        codeHash: empreinte(`${acces.id}:${code}`),
        codeExpireLe: new Date(Date.now() + CODE_MINUTES * 60_000),
        codeEssais: 0,
        codeEnvoyeLe: new Date(),
      },
    });
    try {
      await this.messages.envoyerCode(acces.dossierId, destination, code);
    } catch {
      throw new HttpException(
        "Le code n'a pas pu être envoyé. Réessayez dans quelques minutes, ou choisissez l'autre moyen de contact.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      canal,
      destinataire: masquer(canal, destination.destinataire),
      minutes: CODE_MINUTES,
    };
  }

  /** Code juste : jeton de l'espace (2 heures), limité au dossier du lien. */
  async connecter(jeton: string, code: string) {
    const acces = await this.accesValide(jeton);
    if (
      !acces.codeHash ||
      !acces.codeExpireLe ||
      acces.codeExpireLe < new Date() ||
      acces.codeEssais >= CODE_ESSAIS
    )
      throw new UnauthorizedException('Code expiré : demandez-en un nouveau.');
    const attendu = Buffer.from(acces.codeHash, 'hex');
    const recu = Buffer.from(empreinte(`${acces.id}:${code}`), 'hex');
    if (!timingSafeEqual(attendu, recu)) {
      const essais = acces.codeEssais + 1;
      await this.prisma.accesMilitaire.update({
        where: { id: acces.id },
        data: { codeEssais: essais },
      });
      throw new UnauthorizedException(
        essais >= CODE_ESSAIS
          ? 'Code incorrect. Trop d’essais : demandez un nouveau code.'
          : `Code incorrect. Encore ${CODE_ESSAIS - essais} essai(s).`,
      );
    }
    await this.prisma.accesMilitaire.update({
      where: { id: acces.id },
      data: {
        codeHash: null,
        codeExpireLe: null,
        codeEssais: 0,
        derniereConnexion: new Date(),
      },
    });
    await this.audit.journaliser(
      null,
      ActionAudit.CONNEXION,
      'Dossier',
      acces.dossierId,
      {
        par: 'MILITAIRE',
      },
    );
    const charge: ChargeJetonMilitaire = {
      sub: acces.dossierId,
      typ: 'militaire',
    };
    return {
      jeton: await this.jwt.signAsync(charge, {
        expiresIn: DUREE_SESSION_MILITAIRE,
      }),
    };
  }

  private async accesValide(jeton: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(jeton))
      throw new NotFoundException(MESSAGE_LIEN_INVALIDE);
    const acces = await this.prisma.accesMilitaire.findUnique({
      where: { jetonHash: empreinte(jeton) },
      include: {
        dossier: {
          select: {
            statut: true,
            campagne: { select: { libelle: true, statut: true } },
            militaire: {
              select: { prenoms: true, email: true, telephone: true },
            },
          },
        },
      },
    });
    if (!acces) throw new NotFoundException(MESSAGE_LIEN_INVALIDE);
    if (acces.expireLe < new Date())
      throw new GoneException(
        'Ce lien a expiré. Demandez un nouveau lien à la DGRECM.',
      );
    if (
      acces.dossier.campagne.statut === StatutCampagne.CLOSE ||
      STATUTS_FINAUX.includes(acces.dossier.statut)
    )
      throw new ForbiddenException(
        'Ce dossier est terminé : la fiche n’est plus accessible.',
      );
    return acces;
  }
}
