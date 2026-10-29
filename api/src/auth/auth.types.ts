import type { Request } from 'express';
import type { Role } from '../generated/prisma/enums.js';

/** Utilisateur authentifié, attaché à la requête par JwtAuthGuard. */
export interface UtilisateurConnecte {
  id: string;
  role: Role;
}

/** Contenu du jeton d'accès JWT. */
export interface ChargeJeton {
  sub: string;
  role: Role;
}

export interface RequeteAuthentifiee extends Request {
  utilisateur?: UtilisateurConnecte;
}

export interface Session {
  jetonAcces: string;
  jetonRafraichissement: string;
  utilisateur: UtilisateurConnecte & { motDePasseProvisoire: boolean };
}
