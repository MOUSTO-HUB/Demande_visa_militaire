// Noms et options des cookies de session (httpOnly : jamais lisibles par le navigateur).
export const COOKIE_ACCES = 'visa_acces';
export const COOKIE_RAFRAICHISSEMENT = 'visa_rafraichissement';

// Cookies réservés au HTTPS en production. COOKIES_SECURISES=non : essai d'un build
// de production en HTTP sur le réseau local (jamais sur un serveur public).
const SECURISES =
  process.env.NODE_ENV === 'production' &&
  process.env.COOKIES_SECURISES !== 'non';

export const optionsCookie = (maxAgeSecondes: number) => ({
  httpOnly: true,
  secure: SECURISES,
  sameSite: 'strict' as const,
  path: '/',
  maxAge: maxAgeSecondes,
});

export const DUREE_ACCES_S = 15 * 60;
/** Même durée que la session de l'API (12 heures). */
export const DUREE_RAFRAICHISSEMENT_S = 12 * 60 * 60;

export const API_URL = process.env.API_URL ?? 'http://localhost:3200/api';

export interface Session {
  jetonAcces: string;
  jetonRafraichissement: string;
  utilisateur: {
    id: string;
    role: string;
    motDePasseProvisoire: boolean;
    doubleAuthAActiver: boolean;
  };
}

/**
 * Date d'expiration (ms) lue dans le jeton d'accès, sans vérifier la signature :
 * sert seulement à décider quand le renouveler. L'API, elle, vérifie tout.
 */
export function expirationJeton(jeton: string): number | null {
  try {
    const charge = JSON.parse(
      Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8'),
    ) as { exp?: number };
    return charge.exp ? charge.exp * 1000 : null;
  } catch {
    return null;
  }
}
