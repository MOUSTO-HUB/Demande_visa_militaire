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
  /** Double authentification obligatoire mais pas encore activée : accès limité. */
  aActiver?: boolean;
}

/** Militaire connecté à son espace : un seul dossier, celui de son lien. */
export interface MilitaireConnecte {
  dossierId: string;
}

/** Jeton de l'espace du militaire (2 heures). */
export interface ChargeJetonMilitaire {
  sub: string; // dossier
  typ: 'militaire';
}

export interface RequeteAuthentifiee extends Request {
  utilisateur?: UtilisateurConnecte;
  militaire?: MilitaireConnecte;
}

export interface Session {
  jetonAcces: string;
  jetonRafraichissement: string;
  utilisateur: UtilisateurConnecte & {
    motDePasseProvisoire: boolean;
    doubleAuthAActiver: boolean;
  };
}

/** Étape 2 de la connexion : le mot de passe est juste, il reste le code. */
export interface DefiDoubleAuth {
  /** Jeton signé (10 minutes) à renvoyer avec le code. */
  doubleAuth: { jeton: string };
}
