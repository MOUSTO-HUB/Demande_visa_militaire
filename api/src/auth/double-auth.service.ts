import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service.js';
import { ActionAudit } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  chiffrerTexte,
  cleSecrets,
  dechiffrerTexte,
} from '../securite/chiffrement.js';
import type { DefiDoubleAuth, UtilisateurConnecte } from './auth.types.js';
import { doubleAuthObligatoire } from './connexion.regles.js';
import {
  empreinteCodeSecours,
  estFormeCodeSecours,
  lienTotp,
  nouveauSecretTotp,
  nouveauxCodesSecours,
  verifierTotp,
} from './totp.js';

/** Champs remis à zéro quand la double authentification est retirée. */
export const SANS_DOUBLE_AUTH = {
  totpSecret: null,
  totpDernierPas: null,
  codesSecours: [],
};

interface CompteDoubleAuth {
  id: string;
  totpSecret: string | null;
  totpDernierPas: number | null;
}

/**
 * Double authentification par application (Google Authenticator, FreeOTP…) :
 * fonctionne sans Internet ni SMS sur le téléphone. Codes de secours si le
 * téléphone est perdu ; sinon, un ADMIN réinitialise le compte.
 */
@Injectable()
export class DoubleAuthService {
  private readonly secretDefi: string;
  private readonly secretPreparation: string;
  private readonly cle: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    const secret = config.getOrThrow<string>('JWT_SECRET');
    // Clés distinctes : un jeton d'étape ne peut jamais servir de jeton d'accès.
    this.secretDefi = `${secret}:double-auth`;
    this.secretPreparation = `${secret}:double-auth-preparation`;
    this.cle = cleSecrets(secret);
  }

  // ─── Connexion ──────────────────────────────────────────────────────────────

  async defi(utilisateurId: string): Promise<DefiDoubleAuth> {
    const jeton = await this.jwt.signAsync(
      { sub: utilisateurId },
      { secret: this.secretDefi, expiresIn: '10m' },
    );
    return { doubleAuth: { jeton } };
  }

  /** Identifiant du compte porté par le jeton d'étape. */
  async lireDefi(jeton: string): Promise<string> {
    try {
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(jeton, {
        secret: this.secretDefi,
      });
      return sub;
    } catch {
      throw new UnauthorizedException(
        'Étape expirée : saisissez à nouveau votre email et votre mot de passe.',
      );
    }
  }

  /** Code de l'application ou code de secours (consommé). */
  async codeValide(compte: CompteDoubleAuth, saisie: string): Promise<boolean> {
    const code = saisie.trim();
    if (!compte.totpSecret) return false;
    if (/^\d{6}$/.test(code)) {
      const pas = verifierTotp(
        dechiffrerTexte(compte.totpSecret, this.cle),
        code,
        compte.totpDernierPas,
      );
      if (pas === null) return false;
      // Un code ne sert qu'une fois, même envoyé deux fois en même temps.
      const { count } = await this.prisma.utilisateur.updateMany({
        where: {
          id: compte.id,
          OR: [{ totpDernierPas: null }, { totpDernierPas: { lt: pas } }],
        },
        data: { totpDernierPas: pas },
      });
      return count === 1;
    }
    if (estFormeCodeSecours(code)) {
      const e = empreinteCodeSecours(code);
      const { codesSecours } = await this.prisma.utilisateur.findUniqueOrThrow({
        where: { id: compte.id },
        select: { codesSecours: true },
      });
      if (!codesSecours.includes(e)) return false;
      const { count } = await this.prisma.utilisateur.updateMany({
        where: { id: compte.id, codesSecours: { has: e } },
        data: { codesSecours: codesSecours.filter((c) => c !== e) },
      });
      return count === 1;
    }
    return false;
  }

  // ─── Réglages (« Mon compte ») ─────────────────────────────────────────────

  async etat(u: UtilisateurConnecte) {
    const compte = await this.compte(u.id);
    return {
      active: !!compte.totpSecret,
      obligatoire: doubleAuthObligatoire(compte.role),
      codesSecoursRestants: compte.codesSecours.length,
    };
  }

  /** Clé et QR code à scanner ; rien n'est enregistré avant la confirmation par un code. */
  async preparer(u: UtilisateurConnecte, motDePasse: string) {
    const compte = await this.verifierMotDePasse(u.id, motDePasse);
    const secret = nouveauSecretTotp();
    const lien = lienTotp(secret, compte.email);
    const jeton = await this.jwt.signAsync(
      { sub: u.id, secret: chiffrerTexte(secret, this.cle) },
      { secret: this.secretPreparation, expiresIn: '15m' },
    );
    return {
      secret,
      qrCode: await QRCode.toDataURL(lien, { margin: 1, width: 220 }),
      jeton,
    };
  }

  /** Active l'application après un premier code juste ; renvoie les codes de secours (une fois). */
  async activer(u: UtilisateurConnecte, jeton: string, code: string) {
    let secretChiffre: string;
    try {
      const charge = await this.jwt.verifyAsync<{
        sub: string;
        secret: string;
      }>(jeton, { secret: this.secretPreparation });
      if (charge.sub !== u.id) throw new Error('autre compte');
      secretChiffre = charge.secret;
    } catch {
      throw new BadRequestException(
        "Préparation expirée : recommencez l'ajout de l'application.",
      );
    }
    const pas = verifierTotp(dechiffrerTexte(secretChiffre, this.cle), code);
    if (pas === null)
      throw new BadRequestException(
        "Code incorrect. Vérifiez que l'heure du téléphone est juste et saisissez le code affiché maintenant.",
      );
    const codes = nouveauxCodesSecours();
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: {
        totpSecret: secretChiffre,
        totpDernierPas: pas,
        codesSecours: codes.map(empreinteCodeSecours),
      },
    });
    await this.journaliser(u, { doubleAuth: 'activee' });
    return { codesSecours: codes };
  }

  async nouveauxCodesSecours(u: UtilisateurConnecte, motDePasse: string) {
    const compte = await this.verifierMotDePasse(u.id, motDePasse);
    if (!compte.totpSecret)
      throw new BadRequestException(
        "Activez d'abord la double authentification.",
      );
    const codes = nouveauxCodesSecours();
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: { codesSecours: codes.map(empreinteCodeSecours) },
    });
    await this.journaliser(u, { codesSecoursRegeneres: true });
    return { codesSecours: codes };
  }

  async desactiver(u: UtilisateurConnecte, motDePasse: string) {
    const compte = await this.verifierMotDePasse(u.id, motDePasse);
    if (doubleAuthObligatoire(compte.role))
      throw new BadRequestException(
        'La double authentification est obligatoire pour votre rôle.',
      );
    await this.prisma.utilisateur.update({
      where: { id: u.id },
      data: SANS_DOUBLE_AUTH,
    });
    await this.journaliser(u, { doubleAuth: 'desactivee' });
    return this.etat(u);
  }

  private compte(id: string) {
    return this.prisma.utilisateur.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        role: true,
        email: true,
        motDePasseHash: true,
        totpSecret: true,
        codesSecours: true,
      },
    });
  }

  /** Toute modification demande le mot de passe (session restée ouverte sur un poste partagé). */
  private async verifierMotDePasse(id: string, motDePasse: string) {
    const compte = await this.compte(id);
    if (!(await verify(compte.motDePasseHash, motDePasse)))
      throw new BadRequestException('Mot de passe incorrect.');
    return compte;
  }

  private journaliser(
    u: UtilisateurConnecte,
    details: Record<string, string | boolean>,
  ) {
    return this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'Utilisateur',
      u.id,
      details,
    );
  }
}
