'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ErreurApi, type EtatFormulaire } from '@/lib/api';
import { appelPublic, COOKIE_ESPACE, optionsCookieEspace } from '@/lib/espace';

type Etat = EtatFormulaire | null;

const message = (e: unknown) => {
  if (e instanceof ErreurApi) return { erreur: e.message };
  throw e;
};

/** Envoie le code par le moyen choisi, puis affiche la saisie du code. */
export async function demanderCode(
  jeton: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  let vers = '';
  try {
    const r = await appelPublic<{ destinataire: string }>('/espace/code', {
      jeton,
      canal: String(d.get('canal')),
    });
    vers = r.destinataire;
  } catch (e) {
    return message(e);
  }
  redirect(`/m/${jeton}?code=1&vers=${encodeURIComponent(vers)}`);
}

/** Code juste : session de l'espace (cookie httpOnly, 2 heures). */
export async function connecter(
  jeton: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  try {
    const { jeton: session } = await appelPublic<{ jeton: string }>(
      '/espace/connexion',
      { jeton, code: String(d.get('code') ?? '').replace(/\D/g, '') },
    );
    (await cookies()).set(COOKIE_ESPACE, session, optionsCookieEspace());
  } catch (e) {
    return message(e);
  }
  redirect('/espace');
}
