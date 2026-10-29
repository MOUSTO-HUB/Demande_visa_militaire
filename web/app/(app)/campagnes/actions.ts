'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { lireModifications } from '@/components/champ-dossier';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { CampagneDetail } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

const champsCampagne = (d: FormData) => ({
  libelle: texte(d, 'libelle'),
  pays: texte(d, 'pays'),
  annee: Number(texte(d, 'annee')),
  typeVisa: texte(d, 'typeVisa'),
  referenceAccord: texte(d, 'referenceAccord'),
  piecesExigees: d.getAll('piecesExigees').map(String),
});

export async function creerCampagne(_e: Etat, d: FormData): Promise<Etat> {
  let id = '';
  const erreur = await tenter(async () => {
    id = (
      await envoyerApi<CampagneDetail>('/campagnes', 'POST', champsCampagne(d))
    ).id;
  });
  if (erreur) return erreur;
  redirect(`/campagnes/${id}/valeurs`);
}

export async function modifierCampagne(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/campagnes/${id}`, 'PATCH', champsCampagne(d)),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Campagne enregistrée.' };
}

export async function enregistrerValeursCommunes(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const valeurs = lireModifications(d);
  if (!Object.keys(valeurs).length) return { succes: 'Aucune modification.' };
  const erreur = await tenter(() =>
    envoyerApi(`/campagnes/${id}/valeurs-communes`, 'PUT', { valeurs }),
  );
  if (erreur) return erreur;
  refresh();
  return {
    succes: `${Object.keys(valeurs).length} valeur(s) enregistrée(s) pour tous les dossiers de la campagne.`,
  };
}

export async function cloturerCampagne(id: string): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/campagnes/${id}/cloture`, 'POST'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Campagne close.' };
}

export async function purgerPieces(id: string): Promise<Etat> {
  let purgees = 0;
  const erreur = await tenter(async () => {
    purgees = (
      await envoyerApi<{ piecesPurgees: number }>(
        `/campagnes/${id}/purge-pieces`,
        'POST',
      )
    ).piecesPurgees;
  });
  if (erreur) return erreur;
  return { succes: `${purgees} fichier(s) effacé(s).` };
}

export async function ajouterMilitaires(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const militaireIds = d.getAll('militaireIds').map(String);
  if (!militaireIds.length) return { erreur: 'Cochez au moins un militaire.' };
  let resultat = { ajoutes: 0, dejaPresents: 0 };
  const erreur = await tenter(async () => {
    resultat = await envoyerApi(`/campagnes/${id}/dossiers`, 'POST', {
      militaireIds,
    });
  });
  if (erreur) return erreur;
  refresh();
  return { succes: `${resultat.ajoutes} dossier(s) créé(s).` };
}
