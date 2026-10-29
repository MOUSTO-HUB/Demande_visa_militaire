import { cookies } from 'next/headers';
import { COOKIE_THEME, estTheme, type Theme } from './theme';

/** Thème mémorisé sur cet appareil ; clair par défaut. */
export async function themeCourant(): Promise<Theme> {
  const valeur = (await cookies()).get(COOKIE_THEME)?.value;
  return estTheme(valeur) ? valeur : 'clair';
}
