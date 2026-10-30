/**
 * Conservation des pièces (cahier des charges, 7.4) : les fichiers (scans de
 * passeport, photos…) sont effacés à la clôture de la campagne + N mois ;
 * la fiche d'identité et l'historique des dossiers restent.
 */
export const MOIS_CONSERVATION_DEFAUT = 6;

/** Date d'effacement : clôture + `mois` (même jour du mois, ou dernier jour s'il manque). */
export function datePurge(closeLe: Date, mois: number): Date {
  const d = new Date(closeLe);
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + mois);
  const dernier = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return d;
}

/** Durée lue dans la configuration (CONSERVATION_MOIS), bornée à 0-60 mois. */
export function moisConservation(valeur: string | undefined): number {
  const n = Number(valeur);
  return valeur !== undefined &&
    valeur !== '' &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= 60
    ? n
    : MOIS_CONSERVATION_DEFAUT;
}
