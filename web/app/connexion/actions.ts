'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { transmettreIp, type EtatFormulaire } from '@/lib/api';
import {
  API_URL,
  COOKIE_ACCES,
  COOKIE_RAFRAICHISSEMENT,
  DUREE_ACCES_S,
  DUREE_RAFRAICHISSEMENT_S,
  optionsCookie,
  type Session,
} from '@/lib/session';

type Etat = EtatFormulaire | null;

const COOKIE_DOUBLE_AUTH = 'visa_double_auth';

interface DefiDoubleAuth {
  doubleAuth: { jeton: string };
}

/** N'accepte qu'un chemin interne : empêche une redirection vers un autre site. */
const cheminSur = (suite: FormDataEntryValue | null) =>
  typeof suite === 'string' && suite.startsWith('/') && !suite.startsWith('//')
    ? suite
    : '/';

async function message(reponse: Response): Promise<string> {
  const corps = (await reponse.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  const m = corps?.message;
  return Array.isArray(m) ? m.join(' ') : typeof m === 'string' ? m : '';
}

export async function seConnecter(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  const entetes = new Headers({ 'Content-Type': 'application/json' });
  await transmettreIp(entetes);
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/auth/connexion`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({
        email: donnees.get('email'),
        motDePasse: donnees.get('motDePasse'),
      }),
      cache: 'no-store',
    });
  } catch {
    return {
      erreur: "Le serveur ne répond pas. Vérifiez que l'API est démarrée.",
    };
  }
  if (!reponse.ok)
    return {
      erreur:
        reponse.status === 401
          ? 'Email ou mot de passe incorrect. Après 5 essais incorrects, le compte est bloqué 15 minutes.'
          : (await message(reponse)) || 'Connexion impossible.',
    };
  const corps = (await reponse.json()) as Session | DefiDoubleAuth;
  const suite = cheminSur(donnees.get('suite'));
  if ('doubleAuth' in corps) {
    // Étape 2 : le jeton d'étape reste côté serveur (cookie httpOnly, 10 minutes).
    (await cookies()).set(
      COOKIE_DOUBLE_AUTH,
      corps.doubleAuth.jeton,
      optionsCookie(10 * 60),
    );
    redirect(`/connexion?etape=code&suite=${encodeURIComponent(suite)}`);
  }
  return ouvrirSession(corps, suite);
}

/** Étape 2 : code de l'application ou code de secours. */
export async function verifierCode(
  _etat: Etat,
  donnees: FormData,
): Promise<Etat> {
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_DOUBLE_AUTH)?.value;
  if (!jeton)
    return {
      erreur:
        'Étape expirée : saisissez à nouveau votre email et votre mot de passe.',
    };
  const entetes = new Headers({ 'Content-Type': 'application/json' });
  await transmettreIp(entetes);
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/auth/double-auth/verification`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({
        jeton,
        code: String(donnees.get('code') ?? '').trim(),
      }),
      cache: 'no-store',
    });
  } catch {
    return {
      erreur: "Le serveur ne répond pas. Vérifiez que l'API est démarrée.",
    };
  }
  if (!reponse.ok)
    return { erreur: (await message(reponse)) || 'Code incorrect.' };
  magasin.delete(COOKIE_DOUBLE_AUTH);
  return ouvrirSession(
    (await reponse.json()) as Session,
    cheminSur(donnees.get('suite')),
  );
}

async function ouvrirSession(session: Session, suite: string): Promise<never> {
  const magasin = await cookies();
  magasin.set(COOKIE_ACCES, session.jetonAcces, optionsCookie(DUREE_ACCES_S));
  magasin.set(
    COOKIE_RAFRAICHISSEMENT,
    session.jetonRafraichissement,
    optionsCookie(DUREE_RAFRAICHISSEMENT_S),
  );
  const { motDePasseProvisoire, doubleAuthAActiver } = session.utilisateur;
  redirect(
    motDePasseProvisoire
      ? '/compte?premiere=1'
      : doubleAuthAActiver
        ? '/compte'
        : suite,
  );
}

export async function seDeconnecter(): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_RAFRAICHISSEMENT)?.value;
  if (jeton) {
    await fetch(`${API_URL}/auth/deconnexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jetonRafraichissement: jeton }),
      cache: 'no-store',
    }).catch(() => undefined);
  }
  magasin.delete(COOKIE_ACCES);
  magasin.delete(COOKIE_RAFRAICHISSEMENT);
  redirect('/connexion');
}
