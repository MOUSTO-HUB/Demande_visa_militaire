import { StatutDossier } from '../generated/prisma/enums.js';
import { STATUTS_FINAUX } from '../dossiers/statuts.regles.js';
import { dateFr } from '../messages/modeles.js';
import { ecartJours } from '../messages/rappels.regles.js';
import type { Anomalie } from '../referentiel/donnees.js';

/**
 * Alertes du suivi (cahier des charges, F7.3) : passeport, pièces, fiche non
 * envoyée à l'approche ou après la date limite, rendez-vous, et ce qui
 * empêche le militaire d'agir (lien pas envoyé, message en échec).
 */

export type TypeAlerte =
  | 'PASSEPORT'
  | 'PIECES'
  | 'FICHE_EN_RETARD'
  | 'FICHE_BIENTOT'
  | 'SANS_ACCES'
  | 'RDV'
  | 'MESSAGE_ECHEC';

export interface Alerte {
  type: TypeAlerte;
  niveau: 'URGENT' | 'ATTENTION';
  message: string;
}

export interface EtatAlerte {
  statut: StatutDossier;
  anomalies: Anomalie[];
  /** « AAAA-MM-JJ ». */
  dateLimiteFiche: string | null;
  /** ISO. */
  dateRendezVous: string | null;
  acces: boolean;
  /** Erreur du dernier message, s'il n'a pas pu partir. */
  echecMessage: string | null;
}

/** Jours avant la date limite à partir desquels la fiche non envoyée est signalée. */
export const JOURS_ALERTE_FICHE = 3;

const AVANT_SOUMISSION: StatutDossier[] = [
  StatutDossier.A_COMPLETER,
  StatutDossier.A_VALIDER,
  StatutDossier.VALIDE,
  StatutDossier.EN_SAISIE,
];

export function alertesDossier(e: EtatAlerte, aujourdhui: string): Alerte[] {
  if (STATUTS_FINAUX.includes(e.statut)) return [];
  const alertes: Alerte[] = [];

  // Passeport expiré ou expirant trop tôt ; une date pas encore saisie n'est
  // qu'une réponse manquante (anomalie du dossier), pas une alerte.
  if (e.statut !== StatutDossier.DEPOSE)
    for (const a of e.anomalies.filter(
      (a) =>
        a.champ === 'passeportDateExpiration' &&
        !a.message.endsWith('à renseigner.'),
    ))
      alertes.push({ type: 'PASSEPORT', niveau: 'URGENT', message: a.message });

  if (AVANT_SOUMISSION.includes(e.statut)) {
    const pieces = e.anomalies
      .filter((a) => !a.champ && a.message.startsWith('Pièce manquante'))
      .map((a) =>
        a.message.replace(/^Pièce manquante : /, '').replace(/\.$/, ''),
      );
    if (pieces.length)
      alertes.push({
        type: 'PIECES',
        niveau: 'ATTENTION',
        message: `${pieces.length} pièce(s) manquante(s) : ${pieces.join(', ')}.`,
      });
  }

  if (e.statut === StatutDossier.A_COMPLETER) {
    if (!e.acces)
      alertes.push({
        type: 'SANS_ACCES',
        niveau: 'ATTENTION',
        message: "Lien d'accès pas encore envoyé au militaire.",
      });
    if (e.dateLimiteFiche) {
      const restants = ecartJours(aujourdhui, e.dateLimiteFiche);
      if (restants < 0)
        alertes.push({
          type: 'FICHE_EN_RETARD',
          niveau: 'URGENT',
          message: `Fiche non envoyée : date limite du ${dateFr(e.dateLimiteFiche)} dépassée de ${-restants} jour(s).`,
        });
      else if (restants <= JOURS_ALERTE_FICHE)
        alertes.push({
          type: 'FICHE_BIENTOT',
          niveau: 'ATTENTION',
          message:
            restants === 0
              ? "Fiche à envoyer aujourd'hui (date limite)."
              : `Fiche à envoyer d'ici le ${dateFr(e.dateLimiteFiche)} (encore ${restants} jour(s)).`,
        });
    }
  }

  if (e.statut === StatutDossier.RDV_PRIS && e.dateRendezVous) {
    const ecart = ecartJours(aujourdhui, e.dateRendezVous.slice(0, 10));
    const heure = e.dateRendezVous.slice(11, 16);
    if (ecart === 0)
      alertes.push({
        type: 'RDV',
        niveau: 'URGENT',
        message: `Rendez-vous de dépôt aujourd'hui à ${heure}.`,
      });
    else if (ecart === 1)
      alertes.push({
        type: 'RDV',
        niveau: 'ATTENTION',
        message: `Rendez-vous de dépôt demain à ${heure}.`,
      });
    else if (ecart < 0)
      alertes.push({
        type: 'RDV',
        niveau: 'ATTENTION',
        message: `Rendez-vous du ${dateFr(e.dateRendezVous)} passé : le dossier a-t-il été déposé ?`,
      });
  }

  if (e.echecMessage)
    alertes.push({
      type: 'MESSAGE_ECHEC',
      niveau: 'ATTENTION',
      message: `Dernier message au militaire non envoyé : ${e.echecMessage}`,
    });

  return alertes;
}
