'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';

type Etat = EtatFormulaire | null;

export async function creerCompte(_e: Etat, d: FormData): Promise<Etat> {
  let provisoire = '';
  const erreur = await tenter(async () => {
    provisoire = (
      await envoyerApi<{ motDePasseProvisoire: string }>(
        '/utilisateurs',
        'POST',
        {
          prenoms: d.get('prenoms'),
          nom: d.get('nom'),
          email: d.get('email'),
          role: d.get('role'),
        },
      )
    ).motDePasseProvisoire;
  });
  if (erreur) return erreur;
  refresh();
  return {
    succes: `Compte créé. Mot de passe provisoire, affiché une seule fois : ${provisoire} — à remettre en main propre ; il devra être changé à la première connexion.`,
  };
}

export async function changerActif(id: string, actif: boolean): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/utilisateurs/${id}`, 'PATCH', { actif }),
  );
  if (erreur) return erreur;
  refresh();
  return null;
}

export async function changerRole(
  id: string,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/utilisateurs/${id}`, 'PATCH', { role: d.get('role') }),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: 'Rôle changé.' };
}

export async function reinitialiser(id: string): Promise<Etat> {
  let provisoire = '';
  const erreur = await tenter(async () => {
    provisoire = (
      await envoyerApi<{ motDePasseProvisoire: string }>(
        `/utilisateurs/${id}/reinitialisation`,
        'POST',
      )
    ).motDePasseProvisoire;
  });
  if (erreur) return erreur;
  refresh();
  return {
    succes: `Nouveau mot de passe provisoire (affiché une seule fois) : ${provisoire}`,
  };
}
