import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErreurApi, transmettreIp } from './api';
import { API_URL, optionsCookie } from './session';

/**
 * Espace du militaire : session à part de celle des agents (cookie httpOnly
 * distinct, jeton limité à son dossier, 2 heures).
 */
export const COOKIE_ESPACE = 'visa_espace';
export const DUREE_ESPACE_S = 2 * 60 * 60;

export const optionsCookieEspace = () => optionsCookie(DUREE_ESPACE_S);

async function erreur(reponse: Response): Promise<ErreurApi> {
  const corps = (await reponse.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  const message = Array.isArray(corps?.message)
    ? corps.message.join(' ')
    : (corps?.message ?? `Erreur ${reponse.status}.`);
  return new ErreurApi(reponse.status, message);
}

/** Routes publiques de l'espace (lien et code), sans jeton. */
export async function appelPublic<T>(
  chemin: string,
  corps: unknown,
): Promise<T> {
  const entetes = new Headers({ 'Content-Type': 'application/json' });
  await transmettreIp(entetes);
  const reponse = await fetch(`${API_URL}${chemin}`, {
    method: 'POST',
    headers: entetes,
    body: JSON.stringify(corps),
    cache: 'no-store',
  });
  if (!reponse.ok) throw await erreur(reponse);
  return (await reponse.json()) as T;
}

/** Appel avec le jeton du militaire ; session expirée : page d'explication. */
export async function appelEspace(
  chemin: string,
  init: RequestInit = {},
): Promise<Response> {
  const jeton = (await cookies()).get(COOKIE_ESPACE)?.value;
  if (!jeton) redirect('/espace/fin');
  const entetes = new Headers(init.headers);
  entetes.set('Authorization', `Bearer ${jeton}`);
  await transmettreIp(entetes);
  if (init.body && !(init.body instanceof FormData))
    entetes.set('Content-Type', 'application/json');
  const reponse = await fetch(`${API_URL}${chemin}`, {
    ...init,
    headers: entetes,
    cache: 'no-store',
  });
  if (reponse.status === 401 || reponse.status === 403) {
    // Jeton expiré, ou dossier plus accessible (campagne close…).
    if (reponse.status === 401) redirect('/espace/fin');
    throw await erreur(reponse);
  }
  if (!reponse.ok) throw await erreur(reponse);
  return reponse;
}

export async function lireEspace<T>(chemin: string): Promise<T> {
  return (await (await appelEspace(chemin)).json()) as T;
}
