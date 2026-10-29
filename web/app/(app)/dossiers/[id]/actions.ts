'use server';

import { refresh } from 'next/cache';
import { lireModifications } from '@/components/champ-dossier';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { StatutDossier } from '@/lib/types';

type Etat = EtatFormulaire | null;

const texte = (d: FormData, cle: string) => {
  const v = d.get(cle);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function enregistrerDonnees(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const valeurs = lireModifications(d);
  if (!Object.keys(valeurs).length) return { succes: 'Aucune modification.' };
  const erreur = await tenter(() =>
    envoyerApi(`/dossiers/${id}/donnees`, 'PUT', { valeurs }),
  );
  if (erreur) return erreur;
  refresh();
  return {
    succes: `${Object.keys(valeurs).length} réponse(s) enregistrée(s).`,
  };
}

export async function lirePasseport(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/dossiers/${id}/mrz`, 'POST', { texte: d.get('texte') }),
  );
  if (erreur) return erreur;
  refresh();
  return {
    succes:
      'Passeport lu : nom, prénoms, numéro, dates et nationalité ont été remplis. Vérifiez-les ci-dessous.',
  };
}

export async function changerStatut(
  id: string,
  statut: StatutDossier,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  // Saisie « 2026-11-05T10:00 » : heure de Conakry (UTC).
  let dateRendezVous = texte(d, 'dateRendezVous');
  if (dateRendezVous && /T\d{2}:\d{2}$/.test(dateRendezVous))
    dateRendezVous = `${dateRendezVous}:00Z`;
  const erreur = await tenter(() =>
    envoyerApi(`/dossiers/${id}/statut`, 'POST', {
      statut,
      commentaire: texte(d, 'commentaire'),
      numeroDemande: texte(d, 'numeroDemande'),
      dateRendezVous,
    }),
  );
  if (erreur) return erreur;
  refresh();
  return null;
}

export async function attribuer(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/dossiers/${id}/attribution`, 'PATCH', {
      operateurId: texte(d, 'operateurId') ?? null,
    }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Attribution enregistrée.' };
}

export async function deposerPiece(
  id: string,
  type: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const fichier = d.get('fichier');
  if (!(fichier instanceof File) || !fichier.size)
    return { erreur: 'Choisissez un fichier.' };
  const envoi = new FormData();
  envoi.set('type', type);
  envoi.set('fichier', fichier);
  let avertissements: string[] = [];
  const erreur = await tenter(async () => {
    avertissements = (
      await envoyerApi<{ avertissements: string[] }>(
        `/dossiers/${id}/pieces`,
        'POST',
        envoi,
      )
    ).avertissements;
  });
  if (erreur) return erreur;
  refresh();
  return avertissements.length
    ? { erreur: `Pièce enregistrée, mais : ${avertissements.join(' ')}` }
    : { succes: 'Pièce enregistrée au format du site officiel.' };
}

export async function supprimerPiece(pieceId: string): Promise<Etat> {
  const erreur = await tenter(() => envoyerApi(`/pieces/${pieceId}`, 'DELETE'));
  if (erreur) return erreur;
  refresh();
  return null;
}
