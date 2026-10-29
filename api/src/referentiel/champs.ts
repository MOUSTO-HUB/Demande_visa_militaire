import { PaysAccueil } from '../generated/prisma/enums.js';

/**
 * Dictionnaire des champs : l'union des questions des formulaires officiels
 * (COVA pour la Chine, kdmid pour la Russie). Version 0, à compléter avec le
 * relevé de la phase 0 (docs/CAHIER_DES_CHARGES.md, section 10).
 *
 * - portee MILITAIRE : réponse réutilisée d'une campagne à l'autre (Militaire.profil,
 *   ou colonne de Militaire quand `colonne` est vrai) ;
 * - portee DOSSIER : réponse propre à la demande (Dossier.donnees), avec une valeur
 *   par défaut possible au niveau de la campagne (sauf `communInterdit`).
 */

export type TypeChamp =
  'texte' | 'texte_long' | 'date' | 'liste' | 'oui_non' | 'telephone' | 'email';

export type Portee = 'MILITAIRE' | 'DOSSIER';

export type CodeSection =
  | 'IDENTITE'
  | 'PASSEPORT'
  | 'ETAT_CIVIL'
  | 'FAMILLE'
  | 'CONTACT'
  | 'ETUDES'
  | 'PROFESSION'
  | 'VOYAGES'
  | 'SEJOUR'
  | 'FINANCEMENT'
  | 'ADMISSION'
  | 'ASSURANCE'
  | 'DECLARATIONS';

export interface Option {
  valeur: string;
  libelle: string;
}

export interface DefinitionChamp {
  id: string;
  libelle: string;
  section: CodeSection;
  portee: Portee;
  type: TypeChamp;
  /** Pays dont le formulaire exige ce champ. */
  obligatoire: PaysAccueil[];
  options?: Option[];
  /** Recopié tel que dans le passeport : lettres latines majuscules, sans accent. */
  latin?: boolean;
  /** Stocké dans une colonne de Militaire plutôt que dans le profil. */
  colonne?: boolean;
  /** Réponse personnelle, jamais remplie par défaut pour toute la campagne. */
  communInterdit?: boolean;
  aide?: string;
}

export const SECTIONS: { code: CodeSection; libelle: string }[] = [
  { code: 'IDENTITE', libelle: 'Identité' },
  { code: 'PASSEPORT', libelle: 'Passeport' },
  { code: 'ETAT_CIVIL', libelle: 'Situation familiale' },
  { code: 'FAMILLE', libelle: 'Parents et enfants' },
  { code: 'CONTACT', libelle: 'Adresse et contacts' },
  { code: 'ETUDES', libelle: 'Études' },
  { code: 'PROFESSION', libelle: 'Profession' },
  { code: 'VOYAGES', libelle: 'Voyages et visas antérieurs' },
  { code: 'SEJOUR', libelle: 'Séjour prévu' },
  { code: 'FINANCEMENT', libelle: 'Financement' },
  { code: 'ADMISSION', libelle: 'Admission et invitation' },
  { code: 'ASSURANCE', libelle: 'Assurance' },
  { code: 'DECLARATIONS', libelle: 'Déclarations' },
];

const { CHINE, RUSSIE } = PaysAccueil;
const DEUX = [CHINE, RUSSIE];

const OUI_NON_AIDE =
  'Réponse sincère, validée par la DGRECM : le système la recopie telle quelle.';

export const CHAMPS: DefinitionChamp[] = [
  // ─── Identité ──────────────────────────────────────────────────────────────
  {
    id: 'nom',
    libelle: 'Nom',
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
    colonne: true,
    aide: 'Exactement comme dans le passeport.',
  },
  {
    id: 'prenoms',
    libelle: 'Prénoms',
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
    colonne: true,
  },
  {
    id: 'autresNoms',
    libelle: 'Autres noms portés (nom de naissance, surnom officiel)',
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [],
    latin: true,
  },
  {
    id: 'sexe',
    libelle: 'Sexe',
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'liste',
    obligatoire: DEUX,
    colonne: true,
    options: [
      { valeur: 'MASCULIN', libelle: 'Masculin' },
      { valeur: 'FEMININ', libelle: 'Féminin' },
    ],
  },
  {
    id: 'dateNaissance',
    libelle: 'Date de naissance',
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'date',
    obligatoire: DEUX,
    colonne: true,
  },
  {
    id: 'lieuNaissanceVille',
    libelle: 'Lieu de naissance (ville)',
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'lieuNaissancePays',
    libelle: 'Pays de naissance',
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'nationalite',
    libelle: 'Nationalité actuelle',
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'autreNationalite',
    libelle: 'Autre nationalité (actuelle ou passée)',
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [],
    latin: true,
  },
  {
    id: 'numeroIdentite',
    libelle: "Numéro de la carte nationale d'identité",
    section: 'IDENTITE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [CHINE],
  },

  // ─── Passeport ─────────────────────────────────────────────────────────────
  {
    id: 'passeportType',
    libelle: 'Type de passeport',
    section: 'PASSEPORT',
    portee: 'MILITAIRE',
    type: 'liste',
    obligatoire: DEUX,
    options: [
      { valeur: 'ORDINAIRE', libelle: 'Ordinaire' },
      { valeur: 'SERVICE', libelle: 'De service' },
      { valeur: 'DIPLOMATIQUE', libelle: 'Diplomatique' },
    ],
  },
  {
    id: 'passeportNumero',
    libelle: 'Numéro du passeport',
    section: 'PASSEPORT',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'passeportPaysEmetteur',
    libelle: 'Pays émetteur',
    section: 'PASSEPORT',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'passeportLieuDelivrance',
    libelle: 'Lieu de délivrance',
    section: 'PASSEPORT',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'passeportDateDelivrance',
    libelle: 'Date de délivrance',
    section: 'PASSEPORT',
    portee: 'MILITAIRE',
    type: 'date',
    obligatoire: DEUX,
  },
  {
    id: 'passeportDateExpiration',
    libelle: "Date d'expiration",
    section: 'PASSEPORT',
    portee: 'MILITAIRE',
    type: 'date',
    obligatoire: DEUX,
  },

  // ─── Situation familiale ───────────────────────────────────────────────────
  {
    id: 'situationFamiliale',
    libelle: 'Situation familiale',
    section: 'ETAT_CIVIL',
    portee: 'MILITAIRE',
    type: 'liste',
    obligatoire: DEUX,
    options: [
      { valeur: 'CELIBATAIRE', libelle: 'Célibataire' },
      { valeur: 'MARIE', libelle: 'Marié(e)' },
      { valeur: 'DIVORCE', libelle: 'Divorcé(e)' },
      { valeur: 'VEUF', libelle: 'Veuf ou veuve' },
    ],
  },
  {
    id: 'conjointNom',
    libelle: 'Nom du conjoint',
    section: 'ETAT_CIVIL',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [],
    latin: true,
  },
  {
    id: 'conjointPrenoms',
    libelle: 'Prénoms du conjoint',
    section: 'ETAT_CIVIL',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [],
    latin: true,
  },
  {
    id: 'conjointDateNaissance',
    libelle: 'Date de naissance du conjoint',
    section: 'ETAT_CIVIL',
    portee: 'MILITAIRE',
    type: 'date',
    obligatoire: [],
  },
  {
    id: 'conjointNationalite',
    libelle: 'Nationalité du conjoint',
    section: 'ETAT_CIVIL',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [],
    latin: true,
  },

  // ─── Parents et enfants ────────────────────────────────────────────────────
  {
    id: 'pereNomComplet',
    libelle: 'Nom et prénoms du père',
    section: 'FAMILLE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'pereDateNaissance',
    libelle: 'Date de naissance du père',
    section: 'FAMILLE',
    portee: 'MILITAIRE',
    type: 'date',
    obligatoire: [CHINE],
  },
  {
    id: 'mereNomComplet',
    libelle: 'Nom et prénoms de la mère',
    section: 'FAMILLE',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'mereDateNaissance',
    libelle: 'Date de naissance de la mère',
    section: 'FAMILLE',
    portee: 'MILITAIRE',
    type: 'date',
    obligatoire: [CHINE],
  },
  {
    id: 'enfants',
    libelle: 'Enfants',
    section: 'FAMILLE',
    portee: 'MILITAIRE',
    type: 'texte_long',
    obligatoire: [],
    aide: 'Un enfant par ligne : NOM PRÉNOMS, date de naissance (JJ/MM/AAAA).',
  },

  // ─── Adresse et contacts ───────────────────────────────────────────────────
  {
    id: 'adresse',
    libelle: 'Adresse du domicile',
    section: 'CONTACT',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'ville',
    libelle: 'Ville',
    section: 'CONTACT',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'telephone',
    libelle: 'Téléphone',
    section: 'CONTACT',
    portee: 'MILITAIRE',
    type: 'telephone',
    obligatoire: DEUX,
    colonne: true,
  },
  {
    id: 'email',
    libelle: 'Email',
    section: 'CONTACT',
    portee: 'MILITAIRE',
    type: 'email',
    obligatoire: DEUX,
    colonne: true,
  },
  {
    id: 'urgenceNomComplet',
    libelle: "Personne à contacter en cas d'urgence",
    section: 'CONTACT',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [CHINE],
    latin: true,
  },
  {
    id: 'urgenceLien',
    libelle: 'Lien avec cette personne',
    section: 'CONTACT',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [CHINE],
    latin: true,
  },
  {
    id: 'urgenceTelephone',
    libelle: 'Téléphone de cette personne',
    section: 'CONTACT',
    portee: 'MILITAIRE',
    type: 'telephone',
    obligatoire: [CHINE],
  },

  // ─── Études ────────────────────────────────────────────────────────────────
  {
    id: 'dernierDiplome',
    libelle: 'Dernier diplôme obtenu',
    section: 'ETUDES',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'diplomeEtablissement',
    libelle: 'Établissement du diplôme',
    section: 'ETUDES',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'diplomeAnnee',
    libelle: "Année d'obtention",
    section: 'ETUDES',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
  },

  // ─── Profession ────────────────────────────────────────────────────────────
  {
    id: 'grade',
    libelle: 'Grade',
    section: 'PROFESSION',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [],
    colonne: true,
  },
  {
    id: 'profession',
    libelle: 'Profession déclarée',
    section: 'PROFESSION',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
    aide: OUI_NON_AIDE,
  },
  {
    id: 'employeur',
    libelle: 'Employeur',
    section: 'PROFESSION',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'employeurAdresse',
    libelle: "Adresse de l'employeur",
    section: 'PROFESSION',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'employeurTelephone',
    libelle: "Téléphone de l'employeur",
    section: 'PROFESSION',
    portee: 'MILITAIRE',
    type: 'telephone',
    obligatoire: [],
  },
  {
    id: 'fonction',
    libelle: 'Fonction occupée',
    section: 'PROFESSION',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [RUSSIE],
    latin: true,
  },
  {
    id: 'dateEntreeService',
    libelle: "Date d'entrée en service",
    section: 'PROFESSION',
    portee: 'MILITAIRE',
    type: 'date',
    obligatoire: [RUSSIE],
  },
  {
    id: 'historiqueEmplois',
    libelle: 'Emplois précédents',
    section: 'PROFESSION',
    portee: 'MILITAIRE',
    type: 'texte_long',
    obligatoire: [],
    aide: 'Un emploi par ligne : employeur, fonction, début – fin (le formulaire russe couvre les 10 dernières années).',
  },

  // ─── Voyages et visas antérieurs ───────────────────────────────────────────
  {
    id: 'voyagesAnterieurs',
    libelle: 'Pays visités ces dernières années',
    section: 'VOYAGES',
    portee: 'MILITAIRE',
    type: 'texte_long',
    obligatoire: [],
    aide: 'Un voyage par ligne : pays, mois et année.',
  },
  {
    id: 'visaAnterieurPaysAccueil',
    libelle: "Visa déjà obtenu pour le pays d'accueil",
    section: 'VOYAGES',
    portee: 'MILITAIRE',
    type: 'texte',
    obligatoire: [],
    aide: 'Numéro et dates du visa, sinon laisser vide.',
  },
  {
    id: 'refusVisa',
    libelle: 'Un visa vous a-t-il déjà été refusé ?',
    section: 'VOYAGES',
    portee: 'MILITAIRE',
    type: 'oui_non',
    obligatoire: DEUX,
    aide: OUI_NON_AIDE,
  },
  {
    id: 'refusVisaDetail',
    libelle: 'Si oui : pays, date et motif',
    section: 'VOYAGES',
    portee: 'MILITAIRE',
    type: 'texte_long',
    obligatoire: [],
  },

  // ─── Séjour prévu ──────────────────────────────────────────────────────────
  {
    id: 'objetSejour',
    libelle: 'Objet du séjour',
    section: 'SEJOUR',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'dateArrivee',
    libelle: "Date d'arrivée prévue",
    section: 'SEJOUR',
    portee: 'DOSSIER',
    type: 'date',
    obligatoire: DEUX,
  },
  {
    id: 'dateFinSejour',
    libelle: 'Date de fin du séjour',
    section: 'SEJOUR',
    portee: 'DOSSIER',
    type: 'date',
    obligatoire: DEUX,
  },
  {
    id: 'villeEntree',
    libelle: "Ville d'entrée dans le pays",
    section: 'SEJOUR',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'etablissementAccueil',
    libelle: "Établissement d'accueil",
    section: 'SEJOUR',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'etablissementAdresse',
    libelle: "Adresse de l'établissement",
    section: 'SEJOUR',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'etablissementTelephone',
    libelle: "Téléphone de l'établissement",
    section: 'SEJOUR',
    portee: 'DOSSIER',
    type: 'telephone',
    obligatoire: [CHINE],
  },
  {
    id: 'adresseSejour',
    libelle: 'Adresse pendant le séjour',
    section: 'SEJOUR',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'specialite',
    libelle: "Spécialité ou programme d'études",
    section: 'SEJOUR',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: [],
    latin: true,
  },

  // ─── Financement ───────────────────────────────────────────────────────────
  {
    id: 'financement',
    libelle: 'Qui finance le séjour ?',
    section: 'FINANCEMENT',
    portee: 'DOSSIER',
    type: 'liste',
    obligatoire: DEUX,
    options: [
      { valeur: 'ETAT_GUINEEN', libelle: 'État guinéen' },
      { valeur: 'PAYS_ACCUEIL', libelle: "Gouvernement du pays d'accueil" },
      { valeur: 'ETABLISSEMENT', libelle: "Établissement d'accueil" },
      { valeur: 'PERSONNEL', libelle: 'Le militaire lui-même' },
    ],
  },
  {
    id: 'organismePayeur',
    libelle: 'Organisme payeur',
    section: 'FINANCEMENT',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: DEUX,
    latin: true,
  },
  {
    id: 'contactAccueilNomComplet',
    libelle: "Contact dans le pays d'accueil",
    section: 'FINANCEMENT',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: [CHINE],
    latin: true,
  },
  {
    id: 'contactAccueilTelephone',
    libelle: 'Téléphone du contact',
    section: 'FINANCEMENT',
    portee: 'DOSSIER',
    type: 'telephone',
    obligatoire: [CHINE],
  },

  // ─── Admission et invitation ───────────────────────────────────────────────
  {
    id: 'numeroAdmission',
    libelle: "Numéro de la lettre d'admission",
    section: 'ADMISSION',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: [],
    communInterdit: true,
  },
  {
    id: 'numeroJW',
    libelle: 'Numéro du formulaire JW201 ou JW202',
    section: 'ADMISSION',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: [CHINE],
    communInterdit: true,
  },
  {
    id: 'numeroInvitation',
    libelle: "Numéro de l'invitation (ministère russe de l'Intérieur)",
    section: 'ADMISSION',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: [RUSSIE],
    communInterdit: true,
  },
  {
    id: 'dateInvitation',
    libelle: "Date de l'invitation",
    section: 'ADMISSION',
    portee: 'DOSSIER',
    type: 'date',
    obligatoire: [RUSSIE],
    communInterdit: true,
  },

  // ─── Assurance ─────────────────────────────────────────────────────────────
  {
    id: 'assuranceCompagnie',
    libelle: "Compagnie d'assurance santé",
    section: 'ASSURANCE',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: [RUSSIE],
    latin: true,
  },
  {
    id: 'assuranceNumero',
    libelle: 'Numéro de police',
    section: 'ASSURANCE',
    portee: 'DOSSIER',
    type: 'texte',
    obligatoire: [RUSSIE],
    communInterdit: true,
  },

  // ─── Déclarations ──────────────────────────────────────────────────────────
  {
    id: 'serviceMilitaire',
    libelle: 'Servez-vous ou avez-vous servi dans les forces armées ?',
    section: 'DECLARATIONS',
    portee: 'DOSSIER',
    type: 'oui_non',
    obligatoire: DEUX,
    communInterdit: true,
    aide: OUI_NON_AIDE,
  },
  {
    id: 'antecedentsJudiciaires',
    libelle: 'Avez-vous déjà fait l’objet d’une condamnation pénale ?',
    section: 'DECLARATIONS',
    portee: 'DOSSIER',
    type: 'oui_non',
    obligatoire: DEUX,
    communInterdit: true,
    aide: OUI_NON_AIDE,
  },
  {
    id: 'maladieGrave',
    libelle: 'Souffrez-vous d’une maladie grave ou contagieuse ?',
    section: 'DECLARATIONS',
    portee: 'DOSSIER',
    type: 'oui_non',
    obligatoire: DEUX,
    communInterdit: true,
    aide: OUI_NON_AIDE,
  },
  {
    id: 'declarationsDetail',
    libelle: 'Précisions sur les réponses « Oui »',
    section: 'DECLARATIONS',
    portee: 'DOSSIER',
    type: 'texte_long',
    obligatoire: [],
    communInterdit: true,
  },
];

export const CHAMPS_PAR_ID = new Map(CHAMPS.map((c) => [c.id, c]));

/** Champs que la campagne peut remplir pour tous ses dossiers. */
export const CHAMPS_COMMUNS = CHAMPS.filter(
  (c) => c.portee === 'DOSSIER' && !c.communInterdit,
);
