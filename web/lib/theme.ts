/** Thème choisi par l'utilisateur (bouton ☀️/🌙), indépendant du réglage de l'appareil. */
export type Theme = 'clair' | 'sombre';

/** Cookie lisible par le navigateur : préférence d'affichage, rien de sensible. */
export const COOKIE_THEME = 'theme';

/** Couleur de la barre du navigateur (Android) selon le thème. */
export const COULEUR_BARRE: Record<Theme, string> = {
  clair: '#1e3a8a',
  sombre: '#020617',
};

export const estTheme = (v: string | undefined): v is Theme =>
  v === 'clair' || v === 'sombre';
