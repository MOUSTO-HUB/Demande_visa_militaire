'use server';

import { redirect } from 'next/navigation';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';

export async function changerMotDePasse(
  _e: EtatFormulaire | null,
  d: FormData,
): Promise<EtatFormulaire | null> {
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
