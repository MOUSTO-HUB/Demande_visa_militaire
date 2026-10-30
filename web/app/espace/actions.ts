'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { refresh } from 'next/cache';
import { ErreurApi, type EtatFormulaire } from '@/lib/api';
import { appelEspace, COOKIE_ESPACE } from '@/lib/espace';
import type { FicheEspace } from '@/lib/types';

type Etat = EtatFormulaire | null;

const message = (e: unknown) => {
  if (e instanceof ErreurApi) return { erreur: e.message };
  throw e;
};

/** Enregistrement au fil de la saisie : une réponse, l'erreur éventuelle revient au champ. */
export async function enregistrerReponse(
  id: string,
  valeur: string,
): Promise<{ erreur?: string; valeur?: string | null }> {
  try {
    const fiche = (await (
      await appelEspace('/espace/donnees', {
        method: 'PUT',
        body: JSON.stringify({ valeurs: { [id]: valeur.trim() || null } }),
      })
    ).json()) as FicheEspace;
    // Valeur telle qu'enregistrée (majuscules latines, format E.164…).
    return {
      valeur:
        fiche.sections.flatMap((s) => s.champs).find((c) => c.id === id)
          ?.valeur ?? null,
      erreur: fiche.erreurs[id],
    };
  } catch (e) {
    return message(e);
  }
}

/** « Enregistrer et continuer » : toutes les réponses de l'étape, puis l'étape suivante. */
export async function enregistrerEtape(
  suite: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const valeurs = Object.fromEntries(
    [...d.entries()]
      .filter(([cle]) => !cle.startsWith('$'))
      .map(([cle, v]) => [cle, String(v).trim() || null]),
  );
  try {
    await appelEspace('/espace/donnees', {
      method: 'PUT',
      body: JSON.stringify({ valeurs }),
    });
  } catch (e) {
    return message(e);
  }
  redirect(suite);
}

export async function deposerPiece(_e: Etat, d: FormData): Promise<Etat> {
  const fichier = d.get('fichier');
  if (!(fichier instanceof File) || !fichier.size)
    return { erreur: 'Choisissez un fichier (photo ou PDF).' };
  const envoi = new FormData();
  envoi.set('type', String(d.get('type')));
  envoi.set('fichier', fichier);
  let avertissements: string[] = [];
  try {
    avertissements = (
      (await (
        await appelEspace('/espace/pieces', { method: 'POST', body: envoi })
      ).json()) as { avertissements: string[] }
    ).avertissements;
  } catch (e) {
    return message(e);
  }
  refresh();
  return {
    succes: `Pièce enregistrée.${avertissements.length ? ` ${avertissements.join(' ')}` : ''}`,
  };
}

export async function supprimerPiece(id: string): Promise<Etat> {
  try {
    await appelEspace(`/espace/pieces/${id}`, { method: 'DELETE' });
  } catch (e) {
    return message(e);
  }
  refresh();
  return null;
}

export async function envoyerFiche(): Promise<Etat> {
  try {
    await appelEspace('/espace/envoi', { method: 'POST' });
  } catch (e) {
    return message(e);
  }
  refresh();
  return {
    succes:
      'Fiche envoyée à la DGRECM. Vous serez prévenu si une correction est nécessaire.',
  };
}

export async function accepterConsentement(version: string): Promise<Etat> {
  try {
    await appelEspace('/espace/consentement', {
      method: 'POST',
      body: JSON.stringify({ version }),
    });
  } catch (e) {
    return message(e);
  }
  refresh();
  return null;
}

export async function seDeconnecter(): Promise<void> {
  (await cookies()).delete(COOKIE_ESPACE);
  redirect('/espace/fin?sortie=1');
}
