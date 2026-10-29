import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ChargeJeton, RequeteAuthentifiee } from '../auth.types.js';
import { CLE_AVANT_DOUBLE_AUTH } from '../decorators/avant-double-auth.decorator.js';
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

    let charge: ChargeJeton;
    try {
      charge = await this.jwt.verifyAsync<ChargeJeton>(jeton);
    } catch {
      throw new UnauthorizedException("Jeton d'accès invalide ou expiré.");
    }

    // Double authentification obligatoire pas encore activée : seules les
    // routes de profil, de mot de passe et d'activation restent ouvertes.
    if (
      charge.aActiver &&
      !this.reflector.getAllAndOverride<boolean>(CLE_AVANT_DOUBLE_AUTH, [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      throw new ForbiddenException(MESSAGE_DOUBLE_AUTH_A_ACTIVER);

    requete.utilisateur = { id: charge.sub, role: charge.role };
    return true;
  }
}
