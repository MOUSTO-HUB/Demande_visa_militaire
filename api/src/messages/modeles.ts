import type { CanalMessage, TypeMessage } from '../generated/prisma/enums.js';

/**
 * Textes des messages aux militaires (cahier des charges, F7.6). Composés au
 * moment de l'envoi : le lien personnel et le code ne sont jamais conservés,
 * seul l'aperçu (sans eux) l'est.
 */

export interface DonneesMessage {
  prenoms: string;
  nom: string;
  grade?: string | null;
  campagne: string;
  /** Lien personnel vers l'espace du militaire. */
  lien?: string;
  /** Code à usage unique (CODE_ACCES). */
  code?: string;
  /** « AAAA-MM-JJ ». */
  dateLimite?: string | null;
  /** Date et heure du rendez-vous (ISO). */
  dateRendezVous?: string | null;
  /** Motif du renvoi de la fiche. */
  motif?: string | null;
}

export interface TexteMessage {
  sujet: string;
  texte: string;
}

export const LIBELLES_TYPE_MESSAGE: Record<TypeMessage, string> = {
  LIEN_ACCES: "Lien d'accès à la fiche",
  CODE_ACCES: 'Code de connexion',
  RAPPEL_FICHE: 'Rappel : fiche à compléter',
  RENVOI_FICHE: 'Fiche renvoyée pour correction',
  CONVOCATION_DEPOT: 'Convocation au dépôt',
  RAPPEL_RDV: 'Rappel du rendez-vous',
};

/** « 2026-11-15 » → « 15/11/2026 ». */
export const dateFr = (iso: string) =>
  iso.slice(0, 10).split('-').reverse().join('/');

/** Rendez-vous : « 15/11/2026 à 09:30 » (heure de Conakry, UTC). */
export const dateHeureFr = (iso: string) =>
  `${dateFr(iso)} à ${iso.slice(11, 16)}`;

/**
 * SMS : sans accents ni signes typographiques (alphabet GSM, 160 caractères
 * par message au lieu de 70).
 */
export const versSms = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[«»“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();

const SIGNATURE = 'DGRECM – Direction générale des relations extérieures';

export function composer(
  type: TypeMessage,
  canal: CanalMessage,
  d: DonneesMessage,
): TexteMessage {
  const qui = `${d.grade ? `${d.grade} ` : ''}${d.prenoms} ${d.nom}`.trim();
  const limite = d.dateLimite
    ? ` avant le ${dateFr(d.dateLimite)}`
    : ' dès que possible';
  const lien = d.lien ? `\n\nVotre lien personnel : ${d.lien}` : '';
  const court = canal === 'SMS';

  let sujet: string;
  let corps: string;
  switch (type) {
    case 'LIEN_ACCES':
      sujet = `Votre demande de visa – ${d.campagne}`;
      corps = court
        ? `DGRECM : complétez votre fiche de visa (${d.campagne})${limite}.${lien}`
        : `${qui},\n\nPour votre demande de visa d'études (${d.campagne}), complétez votre fiche et déposez vos pièces${limite}.${lien}\n\nÀ l'ouverture, un code de connexion vous sera envoyé. Ne transmettez ni ce lien ni ce code.`;
      break;
    case 'CODE_ACCES':
      sujet = 'Votre code de connexion';
      corps = court
        ? `DGRECM : votre code de connexion est ${d.code}. Valable 10 minutes. Ne le communiquez a personne.`
        : `${qui},\n\nVotre code de connexion est : ${d.code}\n\nIl est valable 10 minutes. Ne le communiquez à personne : la DGRECM ne vous le demandera jamais.`;
      break;
    case 'RAPPEL_FICHE':
      sujet = `Rappel : fiche de visa à compléter${limite}`;
      corps = court
        ? `DGRECM : rappel, votre fiche de visa (${d.campagne}) est a completer et envoyer${limite}.${lien}`
        : `${qui},\n\nVotre fiche de demande de visa (${d.campagne}) n'a pas encore été envoyée à la DGRECM. Complétez-la et envoyez-la${limite}.${lien}`;
      break;
    case 'RENVOI_FICHE':
      sujet = 'Votre fiche de visa est à corriger';
      corps = court
        ? `DGRECM : votre fiche de visa est a corriger. Motif : ${d.motif ?? 'voir votre espace'}.${lien}`
        : `${qui},\n\nLa DGRECM vous renvoie votre fiche de demande de visa (${d.campagne}) pour correction.\n\nMotif : ${d.motif ?? 'voir votre espace'}${lien}`;
      break;
    case 'CONVOCATION_DEPOT':
      sujet = `Convocation : dépôt de votre demande de visa`;
      corps = court
        ? `DGRECM : depot de votre demande de visa le ${d.dateRendezVous ? dateHeureFr(d.dateRendezVous) : '(date a confirmer)'}. Apportez votre passeport et les originaux de vos pieces.`
        : `${qui},\n\nVotre rendez-vous pour le dépôt de votre demande de visa (${d.campagne}) est fixé au ${d.dateRendezVous ? dateHeureFr(d.dateRendezVous) : '(date à confirmer)'}.\n\nApportez votre passeport et les originaux de vos pièces. La DGRECM vous remettra la fiche récapitulative.`;
      break;
    case 'RAPPEL_RDV':
      sujet = 'Rappel : rendez-vous de dépôt demain';
      corps = court
        ? `DGRECM : rappel, depot de votre demande de visa demain ${d.dateRendezVous ? dateHeureFr(d.dateRendezVous) : ''}. Apportez votre passeport.`
        : `${qui},\n\nRappel : votre rendez-vous de dépôt est demain, le ${d.dateRendezVous ? dateHeureFr(d.dateRendezVous) : '(date à confirmer)'}. Apportez votre passeport et les originaux de vos pièces.`;
      break;
  }
  return court
    ? { sujet, texte: versSms(corps) }
    : { sujet, texte: `${corps}\n\n${SIGNATURE}` };
}

/** Texte conservé dans l'historique : sans lien personnel ni code. */
export function apercu(texte: string, d: DonneesMessage): string {
  let t = texte;
  if (d.lien) t = t.split(d.lien).join('[lien personnel]');
  if (d.code) t = t.split(d.code).join('••••••');
  return t;
}

/** « moussa.camara@exemple.gn » → « m•••••@exemple.gn » ; « +224621123456 » → « +224 •••• 56 ». */
export function masquer(canal: CanalMessage, destinataire: string): string {
  if (canal === 'EMAIL') {
    const [nom, domaine] = destinataire.split('@');
    return `${nom.slice(0, 1)}•••••@${domaine ?? ''}`;
  }
  return `${destinataire.slice(0, 4)} •••• ${destinataire.slice(-2)}`;
}
