'use server';

import { refresh } from 'next/cache';
import { lireModifications } from '@/components/champ-dossier';
import { envoyerApi, ErreurApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { ResultatMrz, StatutDossier } from '@/lib/types';

type Etat = EtatFormulaire | null;

const CANAUX = { EMAIL: 'email', SMS: 'SMS' } as const;

/**
 * Crée (ou renouvelle) le lien personnel du militaire et le lui envoie. Le
 * lien est montré à l'agent, qui peut aussi le transmettre lui-même : sans le
 * code reçu par le militaire, il ne suffit pas.
 */
export async function creerLienAcces(id: string): Promise<Etat> {
  let r: {
    lien: string;
    envoi: { canal: keyof typeof CANAUX; destinataire: string } | null;
  } = { lien: '', envoi: null };
  const erreur = await tenter(async () => {
    r = await envoyerApi(`/dossiers/${id}/acces`, 'POST');
  });
  if (erreur) return erreur;
  refresh();
  return {
    succes: `${r.envoi ? `Lien envoyé par ${CANAUX[r.envoi.canal]} à ${r.envoi.destinataire}.` : 'Lien créé.'} L'ancien lien ne fonctionne plus. Pour le transmettre vous-même (le code reste envoyé au militaire) : ${r.lien}`,
  };
}

export async function envoyerMessageMilitaire(
  id: string,
  type: 'RAPPEL_FICHE' | 'CONVOCATION_DEPOT',
): Promise<Etat> {
  let r: {
    canal?: keyof typeof CANAUX;
    destinataire: string | null;
    erreur: string | null;
  } = {
    destinataire: null,
    erreur: null,
  };
  const erreur = await tenter(async () => {
    r = await envoyerApi(`/dossiers/${id}/messages`, 'POST', { type });
  });
  if (erreur) return erreur;
  refresh();
  if (r.erreur) return { erreur: r.erreur };
  return {
    succes: `Message mis en file : ${r.canal ? CANAUX[r.canal] : ''} à ${r.destinataire}, envoyé dans la minute.`,
  };
}

/**
 * Analyse, sans rien enregistrer, du texte reconnu sur la photo du passeport
 * (seul ce texte quitte le navigateur, jamais l'image).
 */
export async function analyserMrz(
  texte: string,
): Promise<{ resultat?: ResultatMrz; erreur?: string }> {
  try {
    return {
      resultat: await envoyerApi<ResultatMrz>('/mrz/analyse', 'POST', {
        texte: String(texte).slice(0, 400),
      }),
    };
  } catch (e) {
    if (e instanceof ErreurApi) return { erreur: e.message };
    throw e;
  }
}

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
