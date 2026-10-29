'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { MilitaireDetail, RapportImport } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

const fiche = (d: FormData) => ({
  matricule: texte(d, 'matricule'),
  grade: texte(d, 'grade'),
  nom: texte(d, 'nom'),
  prenoms: texte(d, 'prenoms'),
  sexe: texte(d, 'sexe'),
  dateNaissance: texte(d, 'dateNaissance'),
  unite: texte(d, 'unite'),
  telephone: texte(d, 'telephone'),
  email: texte(d, 'email'),
});

export async function creerMilitaire(_e: Etat, d: FormData): Promise<Etat> {
  let id = '';
  const erreur = await tenter(async () => {
    id = (await envoyerApi<MilitaireDetail>('/militaires', 'POST', fiche(d)))
      .id;
  });
  if (erreur) return erreur;
  redirect(`/militaires/${id}`);
}

export async function modifierMilitaire(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/militaires/${id}`, 'PATCH', fiche(d)),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Fiche enregistrée.' };
}

export interface EtatImport extends EtatFormulaire {
  rapport?: RapportImport;
}

/** Analyse (simulation) puis, sur confirmation, enregistrement de la liste. */
export async function importerMilitaires(
  _e: EtatImport | null,
  d: FormData,
): Promise<EtatImport | null> {
  const fichier = d.get('fichier');
  if (!(fichier instanceof File) || !fichier.size)
    return { erreur: 'Choisissez un fichier Excel (.xlsx) ou CSV.' };
  const envoi = new FormData();
  envoi.set('fichier', fichier);
  envoi.set('simulation', d.get('confirmer') === 'oui' ? 'non' : 'oui');
  const campagneId = texte(d, 'campagneId');
  if (campagneId) envoi.set('campagneId', campagneId);
  let rapport: RapportImport | undefined;
  const erreur = await tenter(async () => {
    rapport = await envoyerApi<RapportImport>(
      '/militaires/import',
      'POST',
      envoi,
    );
  });
  if (erreur) return erreur;
  if (!rapport) return null;
  if (rapport.erreurs.length)
    return {
      erreur: `${rapport.erreurs.length} ligne(s) à corriger dans le fichier : rien n'a été enregistré.`,
      rapport,
    };
  return {
    succes: rapport.simulation
      ? `Fichier correct : ${rapport.nouveaux} nouveau(x) militaire(s), ${rapport.misAJour} fiche(s) mise(s) à jour. Cochez « Enregistrer » puis renvoyez le fichier pour confirmer.`
      : `Import terminé : ${rapport.nouveaux} militaire(s) créé(s), ${rapport.misAJour} mis à jour${campagneId ? `, ${rapport.dossiersCrees} dossier(s) créé(s) dans la campagne` : ''}.`,
    rapport,
  };
}
