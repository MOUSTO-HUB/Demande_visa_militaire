'use server';

import { refresh } from 'next/cache';
import { envoyerApi, tenter, type EtatFormulaire } from '@/lib/api';
import type { PaysAccueil } from '@/lib/types';

type Etat = EtatFormulaire | null;

const entier = (d: FormData, cle: string) => Number(d.get(cle));

export async function modifierExigences(
  pays: PaysAccueil,
  _e: Etat,
  d: FormData,
): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/parametres/exigences/${pays}`, 'PUT', {
      photo: {
        largeur: entier(d, 'photoLargeur'),
        hauteur: entier(d, 'photoHauteur'),
        poidsMinKo: entier(d, 'photoPoidsMinKo'),
        poidsMaxKo: entier(d, 'photoPoidsMaxKo'),
      },
      scan: {
        coteMax: entier(d, 'scanCoteMax'),
        poidsMaxKo: entier(d, 'scanPoidsMaxKo'),
        pdfAccepte: d.get('scanPdfAccepte') === 'on',
      },
    }),
  );
  if (erreur) return erreur;
  refresh();
  return {
    succes:
      'Exigences enregistrées : les prochaines pièces seront préparées à ce format ; les pièces déjà déposées qui ne conviennent plus sont signalées « non conformes ».',
  };
}

export async function retablirExigences(pays: PaysAccueil): Promise<Etat> {
  const erreur = await tenter(() =>
    envoyerApi(`/parametres/exigences/${pays}`, 'DELETE'),
  );
  if (erreur) return erreur;
  refresh();
  return { succes: "Valeurs d'origine rétablies." };
}
