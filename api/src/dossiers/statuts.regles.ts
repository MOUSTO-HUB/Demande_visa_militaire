import { Role, StatutDossier } from '../generated/prisma/enums.js';

const {
  A_COMPLETER,
  A_VALIDER,
  VALIDE,
  EN_SAISIE,
  SOUMIS,
  RDV_PRIS,
  DEPOSE,
  VISA_OBTENU,
  REFUSE,
  ABANDONNE,
} = StatutDossier;
const { ADMIN, GESTIONNAIRE, OPERATEUR } = Role;

export const LIBELLES_STATUT: Record<StatutDossier, string> = {
  A_COMPLETER: 'À compléter',
  A_VALIDER: 'À valider',
  VALIDE: 'Validé',
  EN_SAISIE: 'En saisie sur le site',
  SOUMIS: 'Soumis',
  RDV_PRIS: 'Rendez-vous pris',
  DEPOSE: "Déposé à l'ambassade",
  VISA_OBTENU: 'Visa obtenu',
  REFUSE: 'Refusé',
  ABANDONNE: 'Abandonné',
};

export const STATUTS_FINAUX: StatutDossier[] = [VISA_OBTENU, REFUSE, ABANDONNE];

interface Transition {
  depuis: StatutDossier[];
  vers: StatutDossier;
  roles: Role[];
  /** Le dossier ne doit avoir aucune anomalie bloquante. */
  sansAnomalie?: boolean;
  commentaireObligatoire?: boolean;
  numeroDemandeObligatoire?: boolean;
  rendezVousObligatoire?: boolean;
}

const GESTION: Role[] = [ADMIN, GESTIONNAIRE];
const TOUS: Role[] = [ADMIN, GESTIONNAIRE, OPERATEUR];

/** Cycle de vie (docs/CAHIER_DES_CHARGES.md, F2.7). */
export const TRANSITIONS: Transition[] = [
  { depuis: [A_COMPLETER], vers: A_VALIDER, roles: TOUS },
  { depuis: [A_VALIDER], vers: VALIDE, roles: GESTION, sansAnomalie: true },
  // Renvoi pour correction, ou réouverture d'un dossier validé.
  {
    depuis: [A_VALIDER, VALIDE],
    vers: A_COMPLETER,
    roles: GESTION,
    commentaireObligatoire: true,
  },
  { depuis: [VALIDE], vers: EN_SAISIE, roles: TOUS },
  // Saisie interrompue sur le site officiel : le dossier revient dans la file.
  { depuis: [EN_SAISIE], vers: VALIDE, roles: TOUS },
  {
    depuis: [EN_SAISIE],
    vers: SOUMIS,
    roles: TOUS,
    numeroDemandeObligatoire: true,
  },
  {
    depuis: [SOUMIS],
    vers: RDV_PRIS,
    roles: TOUS,
    rendezVousObligatoire: true,
  },
  { depuis: [SOUMIS, RDV_PRIS], vers: DEPOSE, roles: TOUS },
  { depuis: [DEPOSE], vers: VISA_OBTENU, roles: GESTION },
  {
    depuis: [DEPOSE],
    vers: REFUSE,
    roles: GESTION,
    commentaireObligatoire: true,
  },
  {
    depuis: [
      A_COMPLETER,
      A_VALIDER,
      VALIDE,
      EN_SAISIE,
      SOUMIS,
      RDV_PRIS,
      DEPOSE,
    ],
    vers: ABANDONNE,
    roles: GESTION,
    commentaireObligatoire: true,
  },
];

export interface DemandeTransition {
  role: Role;
  depuis: StatutDossier;
  vers: StatutDossier;
  anomaliesBloquantes: number;
  commentaire?: string;
  numeroDemande?: string | null;
  dateRendezVous?: Date | string | null;
}

/** Message d'erreur si le changement de statut est refusé, sinon null. */
export function refusTransition(d: DemandeTransition): string | null {
  const transition = TRANSITIONS.find(
    (t) => t.vers === d.vers && t.depuis.includes(d.depuis),
  );
  if (!transition)
    return `Passage impossible de « ${LIBELLES_STATUT[d.depuis]} » à « ${LIBELLES_STATUT[d.vers]} ».`;
  if (!transition.roles.includes(d.role))
    return `Votre rôle ne permet pas de passer un dossier à « ${LIBELLES_STATUT[d.vers]} ».`;
  if (transition.sansAnomalie && d.anomaliesBloquantes > 0)
    return `Le dossier a encore ${d.anomaliesBloquantes} anomalie${d.anomaliesBloquantes > 1 ? 's' : ''} bloquante${d.anomaliesBloquantes > 1 ? 's' : ''} : corrigez-les avant de le valider.`;
  if (transition.commentaireObligatoire && !d.commentaire?.trim())
    return 'Indiquez le motif dans le commentaire.';
  if (transition.numeroDemandeObligatoire && !d.numeroDemande?.trim())
    return 'Saisissez le numéro de demande attribué par le site officiel.';
  if (transition.rendezVousObligatoire && !d.dateRendezVous)
    return 'Saisissez la date du rendez-vous.';
  return null;
}

/** Statuts accessibles depuis un statut, pour un rôle (boutons proposés par le site). */
export const suivantsPossibles = (
  role: Role,
  depuis: StatutDossier,
): StatutDossier[] =>
  TRANSITIONS.filter(
    (t) => t.depuis.includes(depuis) && t.roles.includes(role),
  ).map((t) => t.vers);

/**
 * Qui peut modifier les réponses d'un dossier dans ce statut : tant qu'il n'est
 * pas validé (gestion et opérateurs) ; ensuite il faut le rouvrir.
 */
export function peutModifierDonnees(
  role: Role,
  statut: StatutDossier,
): boolean {
  if (statut === A_COMPLETER) return TOUS.includes(role);
  if (statut === A_VALIDER) return GESTION.includes(role);
  return false;
}
