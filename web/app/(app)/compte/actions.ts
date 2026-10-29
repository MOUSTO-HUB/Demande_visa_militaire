'use server';

import { refresh } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
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

export async function changerMotDePasse(_e: Etat, d: FormData): Promise<Etat> {
  if (d.get('nouveau') !== d.get('confirmation'))
    return { erreur: 'Les deux mots de passe ne sont pas identiques.' };
  const erreur = await tenter(() =>
    envoyerApi('/auth/mot-de-passe', 'POST', {
      actuel: d.get('actuel'),
      nouveau: d.get('nouveau'),
    }),
  );
  if (erreur) return erreur;
  redirect('/');
}

// ─── Double authentification ─────────────────────────────────────────────────

/** Étape de l'ajout de l'application, gardée par le formulaire du navigateur. */
export interface EtatActivation extends EtatFormulaire {
  preparation?: { secret: string; qrCode: string; jeton: string };
  codes?: string[];
}

/**
 * Nouveaux jetons tout de suite après l'activation : l'ancien jeton d'accès
 * limitait encore le compte aux pages « Mon compte ».
 */
async function renouvelerSession(): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_RAFRAICHISSEMENT)?.value;
  if (!jeton) return;
  const reponse = await fetch(`${API_URL}/auth/rafraichir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jetonRafraichissement: jeton }),
    cache: 'no-store',
  }).catch(() => null);
  if (!reponse?.ok) return;
  const session = (await reponse.json()) as Session;
  magasin.set(COOKIE_ACCES, session.jetonAcces, optionsCookie(DUREE_ACCES_S));
  magasin.set(
    COOKIE_RAFRAICHISSEMENT,
    session.jetonRafraichissement,
    optionsCookie(DUREE_RAFRAICHISSEMENT_S),
  );
}

/** 1. Mot de passe → QR code ; 2. premier code → codes de secours. */
export async function etapeActivation(
  etat: EtatActivation | null,
  d: FormData,
): Promise<EtatActivation | null> {
  if (!etat?.preparation) {
    let preparation: EtatActivation['preparation'];
    const erreur = await tenter(async () => {
      preparation = await envoyerApi('/auth/double-auth/preparation', 'POST', {
        motDePasse: d.get('motDePasse'),
      });
    });
    return erreur ?? { preparation };
  }
  let codes: string[] = [];
  const erreur = await tenter(async () => {
    codes = (
      await envoyerApi<{ codesSecours: string[] }>(
        '/auth/double-auth/activation',
        'POST',
        {
          jeton: etat.preparation!.jeton,
          code: String(d.get('code') ?? '').replace(/\s/g, ''),
        },
      )
    ).codesSecours;
  });
  if (erreur) return { ...erreur, preparation: etat.preparation };
  await renouvelerSession();
  return {
    succes: 'Double authentification activée.',
    codes,
  };
}

export async function regenererCodesSecours(
  _e: EtatActivation | null,
  d: FormData,
): Promise<EtatActivation | null> {
  let codes: string[] = [];
  const erreur = await tenter(async () => {
    codes = (
      await envoyerApi<{ codesSecours: string[] }>(
        '/auth/double-auth/codes-secours',
        'POST',
        { motDePasse: d.get('motDePasse') },
      )
    ).codesSecours;
  });
  return erreur ?? { succes: 'Nouveaux codes créés.', codes };
}

export async function desactiverDoubleAuth(
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi('/auth/double-auth/desactivation', 'POST', {
      motDePasse: d.get('motDePasse'),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Double authentification désactivée.' };
}
