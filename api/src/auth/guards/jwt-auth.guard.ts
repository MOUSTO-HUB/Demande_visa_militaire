import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type {
  ChargeJeton,
  ChargeJetonMilitaire,
  RequeteAuthentifiee,
} from '../auth.types.js';
import { CLE_AVANT_DOUBLE_AUTH } from '../decorators/avant-double-auth.decorator.js';
import { CLE_ESPACE_MILITAIRE } from '../decorators/espace-militaire.decorator.js';
import { CLE_PUBLIC } from '../decorators/public.decorator.js';

export const MESSAGE_DOUBLE_AUTH_A_ACTIVER =
  'Activez la double authentification (Mon compte) pour accéder aux dossiers.';

/** Garde global : exige un jeton d'accès valide, sauf sur les routes @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const estPublic = this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (estPublic) return true;

    const requete = ctx.switchToHttp().getRequest<RequeteAuthentifiee>();
    const [type, jeton] = requete.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !jeton) {
      throw new UnauthorizedException("Jeton d'accès manquant.");
    }

    let charge: ChargeJeton | ChargeJetonMilitaire;
    try {
      charge = await this.jwt.verifyAsync<ChargeJeton | ChargeJetonMilitaire>(
        jeton,
      );
    } catch {
      throw new UnauthorizedException("Jeton d'accès invalide ou expiré.");
    }

    // Espace du militaire et routes des agents : jamais le jeton de l'un chez l'autre.
    const espace =
      this.reflector.getAllAndOverride<boolean>(CLE_ESPACE_MILITAIRE, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? false;
    const militaire = 'typ' in charge && charge.typ === 'militaire';
    if (espace !== militaire)
      throw new ForbiddenException(
        espace
          ? 'Cette page est réservée au militaire, par son lien personnel.'
          : 'Votre accès est limité à votre propre fiche.',
      );
    if (militaire) {
      requete.militaire = { dossierId: charge.sub };
      return true;
    }

    // Double authentification obligatoire pas encore activée : seules les
    // routes de profil, de mot de passe et d'activation restent ouvertes.
    if (
      (charge as ChargeJeton).aActiver &&
      !this.reflector.getAllAndOverride<boolean>(CLE_AVANT_DOUBLE_AUTH, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      throw new ForbiddenException(MESSAGE_DOUBLE_AUTH_A_ACTIVER);

    requete.utilisateur = {
      id: charge.sub,
      role: (charge as ChargeJeton).role,
    };
    return true;
  }
}
