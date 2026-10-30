import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ActionAudit,
  CanalMessage,
  StatutMessage,
  TypeMessage,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cleSecrets, dechiffrerTexte } from '../securite/chiffrement.js';
import { EnvoiService } from './envoi.service.js';
import { apercu, composer, type DonneesMessage } from './modeles.js';

/** Essais d'envoi avant d'abandonner un message (serveur injoignable…). */
const TENTATIVES_MAX = 3;

export interface Destination {
  canal: CanalMessage;
  destinataire: string;
}

/**
 * File des messages aux militaires (table `messages`) : enregistrés tout de
 * suite, envoyés par le planificateur (PlanificateurService) ; l'historique
 * reste consultable sur la fiche du dossier.
 */
@Injectable()
export class MessagesService {
  private readonly journal = new Logger('Messages');
  private readonly cle: Buffer;
  private readonly urlEspace: string;
  private enCours = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly envoi: EnvoiService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.cle = cleSecrets(config.getOrThrow<string>('JWT_SECRET'));
    this.urlEspace = (
      config.get<string>('ESPACE_URL') ??
      config.get<string>('WEB_ORIGIN') ??
      'http://localhost:3002'
    ).replace(/\/$/, '');
  }

  /** Canaux possibles pour ce militaire : l'email (gratuit) d'abord, puis le SMS. */
  destinations(m: {
    email: string | null;
    telephone: string | null;
  }): Destination[] {
    const destinations: Destination[] = [];
    if (m.email)
      destinations.push({ canal: CanalMessage.EMAIL, destinataire: m.email });
    if (m.telephone && this.envoi.smsDisponibles)
      destinations.push({
        canal: CanalMessage.SMS,
        destinataire: m.telephone,
      });
    return destinations;
  }

  /** Lien personnel vers l'espace du militaire (jeton déchiffré). */
  lien(jetonChiffre: string): string {
    return `${this.urlEspace}/m/${dechiffrerTexte(jetonChiffre, this.cle)}`;
  }

  /**
   * Met un message dans la file. Avec une clé (rappel automatique), un message
   * déjà prévu n'est pas recréé : renvoie null. Sans email ni téléphone, le
   * message est enregistré en échec pour que la gestion le voie.
   */
  async enfiler(
    dossierId: string,
    type: TypeMessage,
    parametres: Record<string, string> = {},
    options: { cle?: string; creePar?: string } = {},
  ) {
    const dossier = await this.prisma.dossier.findUniqueOrThrow({
      where: { id: dossierId },
      select: { militaire: { select: { email: true, telephone: true } } },
    });
    const [destination] = this.destinations(dossier.militaire);
    try {
      return await this.prisma.message.create({
        data: {
          dossierId,
          type,
          canal: destination?.canal ?? CanalMessage.EMAIL,
          destinataire: destination?.destinataire ?? '—',
          parametres,
          cle: options.cle,
          creePar: options.creePar,
          ...(destination
            ? {}
            : {
                statut: StatutMessage.ECHEC,
                erreur:
                  'Ni email ni téléphone dans la fiche du militaire (ou SMS non configurés).',
              }),
        },
      });
    } catch (e) {
      if (
        options.cle &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        return null;
      throw e;
    }
  }

  /**
   * Code de connexion : envoyé tout de suite (valable 10 minutes), jamais
   * conservé ; l'historique ne garde que l'aperçu masqué.
   */
  async envoyerCode(
    dossierId: string,
    destination: Destination,
    code: string,
  ): Promise<void> {
    const donnees = await this.donnees(dossierId);
    const message = await this.prisma.message.create({
      data: {
        dossierId,
        type: TypeMessage.CODE_ACCES,
        canal: destination.canal,
        destinataire: destination.destinataire,
        tentatives: 1,
      },
    });
    await this.expedier(message.id, destination, TypeMessage.CODE_ACCES, {
      ...donnees,
      code,
    });
  }

  /** Envoie les messages en attente (appelé régulièrement par le planificateur). */
  async traiterFile(limite = 20): Promise<number> {
    if (this.enCours) return 0;
    this.enCours = true;
    try {
      const enAttente = await this.prisma.message.findMany({
        where: {
          statut: StatutMessage.A_ENVOYER,
          tentatives: { lt: TENTATIVES_MAX },
        },
        orderBy: { creeLe: 'asc' },
        take: limite,
      });
      for (const m of enAttente) {
        await this.prisma.message.update({
          where: { id: m.id },
          data: { tentatives: { increment: 1 } },
        });
        let donnees: DonneesMessage;
        try {
          donnees = {
            ...(await this.donnees(m.dossierId)),
            ...(m.parametres as Record<string, string>),
          };
        } catch (e) {
          await this.echec(m.id, e, true);
          continue;
        }
        if (m.type === TypeMessage.LIEN_ACCES && !donnees.lien) {
          await this.echec(m.id, new Error("Aucun lien d'accès valide."), true);
          continue;
        }
        await this.expedier(
          m.id,
          { canal: m.canal, destinataire: m.destinataire },
          m.type,
          donnees,
          m.tentatives + 1 >= TENTATIVES_MAX,
        );
      }
      return enAttente.length;
    } finally {
      this.enCours = false;
    }
  }

  historique(dossierId: string) {
    return this.prisma.message.findMany({
      where: { dossierId },
      orderBy: { creeLe: 'desc' },
      take: 50,
      omit: { parametres: true, cle: true },
    });
  }

  /** Données communes des modèles, avec le lien personnel s'il est encore valable. */
  private async donnees(dossierId: string): Promise<DonneesMessage> {
    const d = await this.prisma.dossier.findUniqueOrThrow({
      where: { id: dossierId },
      select: {
        militaire: { select: { prenoms: true, nom: true, grade: true } },
        campagne: { select: { libelle: true, dateLimiteFiche: true } },
        acces: { select: { jetonChiffre: true, expireLe: true } },
        dateRendezVous: true,
      },
    });
    return {
      ...d.militaire,
      campagne: d.campagne.libelle,
      dateLimite: d.campagne.dateLimiteFiche?.toISOString().slice(0, 10),
      dateRendezVous: d.dateRendezVous?.toISOString(),
      lien:
        d.acces && d.acces.expireLe > new Date()
          ? this.lien(d.acces.jetonChiffre)
          : undefined,
    };
  }

  private async expedier(
    id: string,
    destination: Destination,
    type: TypeMessage,
    donnees: DonneesMessage,
    dernierEssai = true,
  ): Promise<void> {
    const { sujet, texte } = composer(type, destination.canal, donnees);
    try {
      const resultat = await this.envoi.envoyer(
        destination.canal,
        destination.destinataire,
        sujet,
        texte,
      );
      await this.prisma.message.update({
        where: { id },
        data: {
          statut: resultat,
          envoyeLe: new Date(),
          erreur: null,
          apercu: apercu(texte, donnees),
        },
      });
      await this.audit.journaliser(null, ActionAudit.MESSAGE, 'Message', id, {
        type,
        canal: destination.canal,
        statut: resultat,
      });
    } catch (e) {
      await this.echec(id, e, dernierEssai);
      if (type === TypeMessage.CODE_ACCES) throw e;
    }
  }

  private async echec(id: string, e: unknown, definitif: boolean) {
    const erreur = e instanceof Error ? e.message : String(e);
    this.journal.warn(`Message ${id} non envoyé : ${erreur}`);
    await this.prisma.message.update({
      where: { id },
      data: {
        erreur: erreur.slice(0, 500),
        ...(definitif ? { statut: StatutMessage.ECHEC } : {}),
      },
    });
  }
}
