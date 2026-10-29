// Appels à l'API de la plateforme depuis la fenêtre de l'extension.
// Les jetons restent en mémoire de session du navigateur (effacés à sa fermeture).

export const API_PAR_DEFAUT = 'http://localhost:3200/api';

interface Session {
  jetonAcces: string;
  jetonRafraichissement: string;
  utilisateur: { id: string; role: string; doubleAuthAActiver: boolean };
}

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(message);
  }
}

export async function adresseApi(): Promise<string> {
  const { api } = await chrome.storage.local.get('api');
  return typeof api === 'string' && api ? api : API_PAR_DEFAUT;
}

/** Enregistre l'adresse de l'API et demande au navigateur l'autorisation d'y accéder. */
export async function definirAdresseApi(adresse: string): Promise<void> {
  const url = new URL(adresse);
  const accordee = await chrome.permissions.request({
    origins: [`${url.origin}/*`],
  });
  if (!accordee)
    throw new Error(
      "Autorisation refusée : l'extension ne peut pas joindre cette adresse.",
    );
  await chrome.storage.local.set({ api: adresse.replace(/\/$/, '') });
}

const lireSession = async () =>
  ((await chrome.storage.session.get('session')).session as
    Session | undefined) ?? null;

const ecrireSession = (session: Session | null) =>
  session
    ? chrome.storage.session.set({ session })
    : chrome.storage.session.remove('session');

async function message(reponse: Response): Promise<string> {
  const corps = (await reponse.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  const m = corps?.message;
  return Array.isArray(m)
    ? m.join(' ')
    : typeof m === 'string'
      ? m
      : `Erreur ${reponse.status}.`;
}

async function brut(
  chemin: string,
  init: RequestInit,
  jeton?: string,
): Promise<Response> {
  const entetes = new Headers(init.headers);
  if (jeton) entetes.set('Authorization', `Bearer ${jeton}`);
  if (init.body && typeof init.body === 'string')
    entetes.set('Content-Type', 'application/json');
  try {
    return await fetch(`${await adresseApi()}${chemin}`, {
      ...init,
      headers: entetes,
      cache: 'no-store',
    });
  } catch {
    throw new ErreurApi(
      0,
      'La plateforme ne répond pas. Vérifiez la connexion au réseau interne et l’adresse dans « Paramètres ».',
    );
  }
}

/** Appel authentifié ; renouvelle le jeton d'accès une fois s'il a expiré. */
export async function appel<T>(
  chemin: string,
  init: RequestInit = {},
  type: 'json' | 'blob' = 'json',
): Promise<T> {
  let session = await lireSession();
  if (!session) throw new ErreurApi(401, 'Connectez-vous.');
  let reponse = await brut(chemin, init, session.jetonAcces);
  if (reponse.status === 401) {
    const renouvelee = await brut('/auth/rafraichir', {
      method: 'POST',
      body: JSON.stringify({
        jetonRafraichissement: session.jetonRafraichissement,
      }),
    });
    if (!renouvelee.ok) {
      await ecrireSession(null);
      throw new ErreurApi(401, 'Session expirée : reconnectez-vous.');
    }
    session = (await renouvelee.json()) as Session;
    await ecrireSession(session);
    reponse = await brut(chemin, init, session.jetonAcces);
  }
  if (!reponse.ok) throw new ErreurApi(reponse.status, await message(reponse));
  if (reponse.status === 204) return undefined as T;
  return (type === 'blob' ? reponse.blob() : reponse.json()) as Promise<T>;
}

export const envoyer = <T>(chemin: string, methode: string, corps?: unknown) =>
  appel<T>(chemin, {
    method: methode,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });

/** Étape 1 : email et mot de passe. Renvoie le jeton d'étape si un code est demandé. */
export async function seConnecter(
  email: string,
  motDePasse: string,
): Promise<{ code: string } | null> {
  const reponse = await brut('/auth/connexion', {
    method: 'POST',
    body: JSON.stringify({ email, motDePasse }),
  });
  if (!reponse.ok) throw new ErreurApi(reponse.status, await message(reponse));
  const corps = (await reponse.json()) as
    Session | { doubleAuth: { jeton: string } };
  if ('doubleAuth' in corps) return { code: corps.doubleAuth.jeton };
  await ouvrir(corps);
  return null;
}

/** Étape 2 : code de l'application d'authentification (ou code de secours). */
export async function verifierCode(jeton: string, code: string): Promise<void> {
  const reponse = await brut('/auth/double-auth/verification', {
    method: 'POST',
    body: JSON.stringify({ jeton, code }),
  });
  if (!reponse.ok) throw new ErreurApi(reponse.status, await message(reponse));
  await ouvrir((await reponse.json()) as Session);
}

async function ouvrir(session: Session) {
  if (session.utilisateur.doubleAuthAActiver)
    throw new ErreurApi(
      403,
      'Activez d’abord la double authentification dans « Mon compte » sur la plateforme.',
    );
  if (session.utilisateur.role === 'LECTEUR')
    throw new ErreurApi(403, 'Le rôle « Lecture » ne remplit pas de dossiers.');
  await ecrireSession(session);
}

export async function seDeconnecter(): Promise<void> {
  const session = await lireSession();
  if (session)
    await brut('/auth/deconnexion', {
      method: 'POST',
      body: JSON.stringify({
        jetonRafraichissement: session.jetonRafraichissement,
      }),
    }).catch(() => undefined);
  await ecrireSession(null);
}

export const estConnecte = async () => !!(await lireSession());
