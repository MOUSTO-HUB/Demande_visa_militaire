import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { MilitaireConnecte, RequeteAuthentifiee } from '../auth.types.js';

export const CLE_ESPACE_MILITAIRE = 'espace-militaire';

/**
 * Route de l'espace du militaire : elle exige le jeton d'un militaire connecté
 * par son lien et son code (jamais celui d'un agent), et ne donne accès qu'à
 * son propre dossier. Les autres routes refusent le jeton d'un militaire.
 */
export const EspaceMilitaire = () => SetMetadata(CLE_ESPACE_MILITAIRE, true);

/** Militaire connecté (dossier de son lien), dans une route @EspaceMilitaire(). */
export const MilitaireCourant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): MilitaireConnecte | undefined =>
    ctx.switchToHttp().getRequest<RequeteAuthentifiee>().militaire,
);
