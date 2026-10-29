import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ChargeJeton, RequeteAuthentifiee } from '../auth.types.js';
import { CLE_PUBLIC } from '../decorators/public.decorator.js';

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

    requete.utilisateur = { id: charge.sub, role: charge.role };
    return true;
  }
}
