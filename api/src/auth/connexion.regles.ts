import { Role } from '../generated/prisma/enums.js';

/** Rôles qui doivent activer la double authentification (cahier des charges, 7.2). */
export const ROLES_DOUBLE_AUTH: Role[] = [Role.ADMIN, Role.GESTIONNAIRE];

export const doubleAuthObligatoire = (role: Role) =>
  ROLES_DOUBLE_AUTH.includes(role);

/** Vrai si le compte doit encore activer sa double authentification. */
export const doubleAuthAActiver = (compte: {
  role: Role;
  totpSecret: string | null;
}) => doubleAuthObligatoire(compte.role) && !compte.totpSecret;

/** Essais incorrects tolérés avant un blocage. */
export const ESSAIS_AVANT_BLOCAGE = 5;
/** Durée du premier blocage ; elle double à chaque nouvelle série d'échecs (24 h au plus). */
export const PREMIER_BLOCAGE_MS = 15 * 60 * 1000;
export const BLOCAGE_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * Après un mot de passe incorrect : nouveau compteur et, toutes les
 * ESSAIS_AVANT_BLOCAGE erreurs, date de fin du blocage.
 */
export function apresEchec(
  echecs: number,
  maintenant: Date = new Date(),
): { echecsConnexion: number; bloqueJusquA: Date | null } {
  const total = echecs + 1;
  if (total % ESSAIS_AVANT_BLOCAGE !== 0)
    return { echecsConnexion: total, bloqueJusquA: null };
  const serie = total / ESSAIS_AVANT_BLOCAGE;
  const duree = Math.min(PREMIER_BLOCAGE_MS * 2 ** (serie - 1), BLOCAGE_MAX_MS);
  return {
    echecsConnexion: total,
    bloqueJusquA: new Date(maintenant.getTime() + duree),
  };
}

/** Message si le compte est encore bloqué, sinon null. */
export function messageBlocage(
  bloqueJusquA: Date | null,
  maintenant: Date = new Date(),
): string | null {
  if (!bloqueJusquA || bloqueJusquA <= maintenant) return null;
  const minutes = Math.ceil(
    (bloqueJusquA.getTime() - maintenant.getTime()) / 60000,
  );
  return `Trop d'essais incorrects : compte bloqué encore ${minutes} minute${minutes > 1 ? 's' : ''}.`;
}
