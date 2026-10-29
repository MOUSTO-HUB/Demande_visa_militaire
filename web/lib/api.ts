import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL, COOKIE_ACCES } from './session';

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(message);
  }
}

/** Message lisible à partir d'une réponse d'erreur NestJS (texte ou liste de messages). */
function messageErreur(corps: unknown, statut: number): string {
  const message = (corps as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  return `Erreur ${statut} de l'API.`;
}

/**
 * Transmet à l'API l'adresse du visiteur reçue du proxy (Caddy) : sans cela,
 * toutes les requêtes du site sembleraient venir du serveur web (limitation
 * des tentatives, journal d'audit). L'API ne croit cet en-tête que d'un relais privé.
 */
export async function transmettreIp(entetes: Headers): Promise<void> {
  const ip = (await headers()).get('x-forwarded-for');
  if (ip) entetes.set('X-Forwarded-For', ip);
}

/** Appel authentifié à l'API, depuis un composant serveur ou une Server Action. */
export async function appelApi(
  chemin: string,
  init: RequestInit = {},
): Promise<Response> {
  const jeton = (await cookies()).get(COOKIE_ACCES)?.value;
  if (!jeton) redirect('/connexion');

  const entetes = new Headers(init.headers);
  entetes.set('Authorization', `Bearer ${jeton}`);
  await transmettreIp(entetes);
  if (init.body && !(init.body instanceof FormData)) {
    entetes.set('Content-Type', 'application/json');
  }

  const reponse = await fetch(`${API_URL}${chemin}`, {
    ...init,
    headers: entetes,
    cache: 'no-store',
  });
  if (reponse.status === 401) redirect('/connexion');
  if (!reponse.ok) {
    const corps: unknown = await reponse.json().catch(() => null);
    throw new ErreurApi(reponse.status, messageErreur(corps, reponse.status));
  }
  return reponse;
}

/** Lecture pour une page : un accès refusé par l'API mène à une page explicative. */
export async function lireApi<T>(chemin: string): Promise<T> {
  try {
    return (await (await appelApi(chemin)).json()) as T;
  } catch (e) {
    if (e instanceof ErreurApi && e.statut === 403) redirect('/acces-refuse');
    throw e;
  }
}

/** Variante pour les pages : une ressource absente donne null (puis notFound()). */
export async function lireApiOuNull<T>(chemin: string): Promise<T | null> {
  try {
    return await lireApi<T>(chemin);
  } catch (e) {
    if (e instanceof ErreurApi && (e.statut === 404 || e.statut === 400)) {
      return null;
    }
    throw e;
  }
}

export async function envoyerApi<T>(
  chemin: string,
  methode: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  corps?: unknown,
): Promise<T> {
  const reponse = await appelApi(chemin, {
    method: methode,
    body:
      corps instanceof FormData
        ? corps
        : corps === undefined
          ? undefined
          : JSON.stringify(corps),
  });
  // 204 : pas de corps (suppression…).
  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}

/** Résultat d'une Server Action, affiché par le formulaire. */
export interface EtatFormulaire {
  erreur?: string;
  succes?: string;
}

/** Exécute un appel et transforme une erreur de l'API en message pour le formulaire. */
export async function tenter(
  action: () => Promise<unknown>,
): Promise<EtatFormulaire | null> {
  try {
    await action();
    return null;
  } catch (e) {
    if (e instanceof ErreurApi) return { erreur: e.message };
    throw e;
  }
}
