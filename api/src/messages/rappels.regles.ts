import { StatutDossier, TypeMessage } from '../generated/prisma/enums.js';

/**
 * Rappels automatiques (cahier des charges, F7.3 et F7.6). Fonctions pures :
 * le planificateur les appelle chaque heure ; la clé rend chaque rappel unique.
 */

/** Jours avant la date limite où le militaire reçoit un rappel. */
export const JOURS_RAPPEL_FICHE = [7, 3, 1];

export interface EtatRappel {
  id: string;
  statut: StatutDossier;
  /** Lien personnel déjà créé (sans lui, le militaire ne peut rien faire). */
  acces: boolean;
  /** « AAAA-MM-JJ ». */
  dateLimiteFiche: string | null;
  /** ISO. */
  dateRendezVous: string | null;
}

export interface RappelDu {
  type: TypeMessage;
  cle: string;
  parametres: Record<string, string>;
}

/** Jours entre deux dates « AAAA-MM-JJ » (positif si `fin` est après `debut`). */
export const ecartJours = (debut: string, fin: string) =>
  Math.round(
    (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) /
      86_400_000,
  );

export function rappelsDus(d: EtatRappel, aujourdhui: string): RappelDu[] {
  const rappels: RappelDu[] = [];
  if (d.statut === StatutDossier.A_COMPLETER && d.acces && d.dateLimiteFiche) {
    const restants = ecartJours(aujourdhui, d.dateLimiteFiche);
    if (JOURS_RAPPEL_FICHE.includes(restants))
      rappels.push({
        type: TypeMessage.RAPPEL_FICHE,
        cle: `RAPPEL_FICHE:${d.id}:${d.dateLimiteFiche}:J-${restants}`,
        parametres: { dateLimite: d.dateLimiteFiche },
      });
    // Le lendemain de la date limite : dernier rappel.
    else if (restants === -1)
      rappels.push({
        type: TypeMessage.RAPPEL_FICHE,
        cle: `RAPPEL_FICHE:${d.id}:${d.dateLimiteFiche}:retard`,
        parametres: { dateLimite: d.dateLimiteFiche },
      });
  }
  if (
    d.statut === StatutDossier.RDV_PRIS &&
    d.dateRendezVous &&
    ecartJours(aujourdhui, d.dateRendezVous.slice(0, 10)) === 1
  )
    rappels.push({
      type: TypeMessage.RAPPEL_RDV,
      cle: `RAPPEL_RDV:${d.id}:${d.dateRendezVous}`,
      parametres: { dateRendezVous: d.dateRendezVous },
    });
  return rappels;
}
