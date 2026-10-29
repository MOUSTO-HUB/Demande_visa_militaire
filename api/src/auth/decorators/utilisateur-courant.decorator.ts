import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  RequeteAuthentifiee,
  UtilisateurConnecte,
} from '../auth.types.js';

/** Injecte l'utilisateur connecté dans un paramètre de méthode de contrôleur. */
export const UtilisateurCourant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UtilisateurConnecte | undefined =>
    ctx.switchToHttp().getRequest<RequeteAuthentifiee>().utilisateur,
);
