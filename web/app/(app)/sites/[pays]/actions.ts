'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';

type Etat = EtatFormulaire | null;

/** « MASCULIN = 1 » par ligne → { MASCULIN: "1" }. */
function lireConversions(texte: string): Record<string, string> | string {
  const conversions: Record<string, string> = {};
  for (const [i, ligne] of texte.split(/\r?\n/).entries()) {
    if (!ligne.trim()) continue;
    const [gauche, ...droite] = ligne.split('=');
    if (!droite.length || !gauche.trim())
      return `Ligne ${i + 1} : écrivez « VALEUR_DU_DOSSIER = valeur du site ».`;
    conversions[gauche.trim()] = droite.join('=').trim();
  }
  return conversions;
}

export async function enregistrerCorrespondance(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const mode = String(d.get('mode'));
  const conversions = lireConversions(String(d.get('conversions') ?? ''));
  if (typeof conversions === 'string') return { erreur: conversions };
  const erreur = await tenter(() =>
    envoyerApi(`/sites/champs/${id}`, 'PATCH', {
      mode,
      champId: mode === 'CHAMP' ? String(d.get('champId') ?? '') || null : null,
      valeurFixe:
        mode === 'FIXE' ? String(d.get('valeurFixe') ?? '') || null : null,
      conversions,
      remplir: d.get('remplir') === 'on',
      // Champ absent du formulaire (case, choix…) : format inchangé.
      ...(d.has('formatDate')
        ? { formatDate: String(d.get('formatDate')).trim() || null }
        : {}),
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Enregistré.' };
}

export async function supprimerChamp(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/sites/champs/${id}`, 'DELETE'),
  );
  if (erreur) return erreur;
  refresh();
  return null;
}
