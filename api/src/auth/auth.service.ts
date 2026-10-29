import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { ActionAudit, type Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { erreurMotDePasse } from '../utilisateurs/utilisateurs.regles.js';
import type {
  ChargeJeton,
  DefiDoubleAuth,
  Session,
  UtilisateurConnecte,
} from './auth.types.js';
import {
  apresEchec,
  doubleAuthAActiver,
  messageBlocage,
} from './connexion.regles.js';
import { DoubleAuthService } from './double-auth.service.js';

/** Session longue : 12 heures (poste de travail partagé dans un service). */
export const DUREE_RAFRAICHISSEMENT_MS = 12 * 60 * 60 * 1000;

interface CompteSession {
  id: string;
  role: Role;
  motDePasseProvisoire: boolean;
  totpSecret: string | null;
}

const empreinte = (jeton: string) =>
  createHash('sha256').update(jeton).digest('hex');

@Injectable()
export class AuthService {
  // Hash calculé une fois pour vérifier un mot de passe même quand l'email est inconnu :
  // le temps de réponse ne révèle pas si un compte existe.
  private hashFactice?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly doubleAuth: DoubleAuthService,
  ) {}

  async connexion(
    email: string,
    motDePasse: string,
  ): Promise<Session | DefiDoubleAuth> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });
    if (utilisateur?.actif) {
      const blocage = messageBlocage(utilisateur.bloqueJusquA);
      if (blocage) throw new ForbiddenException(blocage);
    }

    this.hashFactice ??= hash('mot-de-passe-factice');
    const valide = await verify(
      utilisateur?.motDePasseHash ?? (await this.hashFactice),
      motDePasse,
    );
    if (!utilisateur || !valide) {
      if (utilisateur?.actif)
        await this.prisma.utilisateur.update({
          where: { id: utilisateur.id },
          data: apresEchec(utilisateur.echecsConnexion),
        });
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }
    if (!utilisateur.actif)
      throw new ForbiddenException(
        'Ce compte est désactivé. Adressez-vous à la DGSIC.',
      );
    // Double authentification activée : il reste le code de l'application.
    if (utilisateur.totpSecret) return this.doubleAuth.defi(utilisateur.id);
    return this.ouvrirSession(utilisateur);
  }

  /** Étape 2 : code de l'application ou code de secours. */
  async verifierDoubleAuth(jeton: string, code: string): Promise<Session> {
    const id = await this.doubleAuth.lireDefi(jeton);
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id },
    });
    if (!utilisateur?.actif)
      throw new UnauthorizedException('Session invalide.');
    const blocage = messageBlocage(utilisateur.bloqueJusquA);
    if (blocage) throw new ForbiddenException(blocage);
    if (!(await this.doubleAuth.codeValide(utilisateur, code))) {
      await this.prisma.utilisateur.update({
        where: { id },
        data: apresEchec(utilisateur.echecsConnexion),
      });
      throw new UnauthorizedException('Code incorrect.');
    }
    return this.ouvrirSession(utilisateur);
  }

  private async ouvrirSession(utilisateur: CompteSession): Promise<Session> {
    await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      // Connexion réussie : les essais incorrects et les blocages repartent de zéro.
      data: {
        derniereConnexion: new Date(),
        echecsConnexion: 0,
        bloqueJusquA: null,
      },
    });
    const session = await this.emettreJetons(utilisateur);
    await this.audit.journaliser(
      session.utilisateur,
      ActionAudit.CONNEXION,
      'Utilisateur',
      utilisateur.id,
    );
    return session;
  }

  async rafraichir(jeton: string): Promise<Session> {
    const enregistrement = await this.prisma.jetonRafraichissement.findUnique({
      where: { jetonHash: empreinte(jeton) },
      include: { utilisateur: true },
    });
    if (!enregistrement) throw new UnauthorizedException('Session invalide.');

    if (enregistrement.revoqueLe) {
      // Un jeton déjà utilisé revient : il a pu être volé. On ferme toutes les sessions.
      await this.revoquerTout(enregistrement.utilisateurId);
      throw new UnauthorizedException('Session révoquée. Reconnectez-vous.');
    }
    if (
      enregistrement.expireLe < new Date() ||
      !enregistrement.utilisateur.actif
    )
      throw new UnauthorizedException('Session expirée. Reconnectez-vous.');

    // Rotation : le jeton présenté est révoqué une seule fois, même en cas d'appels simultanés.
    const { count } = await this.prisma.jetonRafraichissement.updateMany({
      where: { id: enregistrement.id, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
    if (count === 0)
      throw new UnauthorizedException('Session révoquée. Reconnectez-vous.');
    return this.emettreJetons(enregistrement.utilisateur);
  }

  async deconnexion(jeton: string): Promise<void> {
    await this.prisma.jetonRafraichissement.updateMany({
      where: { jetonHash: empreinte(jeton), revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
  }

  async profil(id: string) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id },
      select: {
        id: true,
        prenoms: true,
        nom: true,
        email: true,
        role: true,
        motDePasseProvisoire: true,
        derniereConnexion: true,
        totpSecret: true,
      },
    });
    if (!utilisateur) throw new UnauthorizedException();
    const { totpSecret, ...profil } = utilisateur;
    return {
      ...profil,
      doubleAuthActive: !!totpSecret,
      doubleAuthAActiver: doubleAuthAActiver(utilisateur),
    };
  }

  /** Changement de mot de passe (obligatoire après un mot de passe provisoire). */
  async changerMotDePasse(
    u: UtilisateurConnecte,
    actuel: string,
    nouveau: string,
  ): Promise<void> {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: u.id },
    });
    if (!utilisateur || !(await verify(utilisateur.motDePasseHash, actuel)))
      throw new BadRequestException('Mot de passe actuel incorrect.');
    const erreur = erreurMotDePasse(nouveau);
    if (erreur) throw new BadRequestException(erreur);
    if (await verify(utilisateur.motDePasseHash, nouveau))
      throw new BadRequestException(
        "Choisissez un mot de passe différent de l'actuel.",
      );
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: {
        motDePasseHash: await hash(nouveau),
        motDePasseProvisoire: false,
      },
    });
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Utilisateur',
      u.id,
      { motDePasse: true },
    );
  }

  private async emettreJetons(utilisateur: CompteSession): Promise<Session> {
    // Recalculé à chaque renouvellement : l'accès s'ouvre dès l'activation.
    const aActiver = doubleAuthAActiver(utilisateur);
    const charge: ChargeJeton = {
      sub: utilisateur.id,
      role: utilisateur.role,
      ...(aActiver ? { aActiver } : {}),
    };
    const jetonAcces = await this.jwt.signAsync(charge);
    const jetonRafraichissement = randomBytes(32).toString('base64url');
    await this.prisma.jetonRafraichissement.create({
      data: {
        utilisateurId: utilisateur.id,
        jetonHash: empreinte(jetonRafraichissement),
        expireLe: new Date(Date.now() + DUREE_RAFRAICHISSEMENT_MS),
      },
    });
    return {
      jetonAcces,
      jetonRafraichissement,
      utilisateur: {
        id: utilisateur.id,
        role: utilisateur.role,
        motDePasseProvisoire: utilisateur.motDePasseProvisoire,
        doubleAuthAActiver: aActiver,
      },
    };
  }

  async revoquerTout(utilisateurId: string): Promise<void> {
    await this.prisma.jetonRafraichissement.updateMany({
      where: { utilisateurId, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
  }
}
