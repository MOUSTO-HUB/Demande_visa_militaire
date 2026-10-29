// Formes des réponses de l'API utilisées par le site.

export type Role = 'ADMIN' | 'GESTIONNAIRE' | 'OPERATEUR' | 'LECTEUR';
export type PaysAccueil = 'CHINE' | 'RUSSIE';
export type StatutDossier =
  | 'A_COMPLETER'
  | 'A_VALIDER'
  | 'VALIDE'
  | 'EN_SAISIE'
  | 'SOUMIS'
  | 'RDV_PRIS'
  | 'DEPOSE'
  | 'VISA_OBTENU'
  | 'REFUSE'
  | 'ABANDONNE';

export interface Page<T> {
  elements: T[];
  total: number;
  page: number;
  parPage: number;
  pages: number;
}

export interface Profil {
  id: string;
  prenoms: string;
  nom: string;
  email: string;
  role: Role;
  motDePasseProvisoire: boolean;
  doubleAuthActive: boolean;
  /** Rôle qui l'exige, pas encore activée : seul « Mon compte » est ouvert. */
  doubleAuthAActiver: boolean;
}

// --- Référentiel ---

export type TypeChamp =
  'texte' | 'texte_long' | 'date' | 'liste' | 'oui_non' | 'telephone' | 'email';

export interface DefinitionChamp {
  id: string;
  libelle: string;
  section: string;
  portee: 'MILITAIRE' | 'DOSSIER';
  type: TypeChamp;
  obligatoire: PaysAccueil[];
  options?: { valeur: string; libelle: string }[];
  latin?: boolean;
  colonne?: boolean;
  communInterdit?: boolean;
  aide?: string;
}

export interface Referentiel {
  sections: { code: string; libelle: string }[];
  champs: DefinitionChamp[];
  pieces: { code: string; libelle: string; exigeePar: PaysAccueil[] }[];
  exigences: Record<
    PaysAccueil,
    {
      photo: {
        largeur: number;
        hauteur: number;
        poidsMinKo: number;
        poidsMaxKo: number;
      };
      scan: { coteMax: number; poidsMaxKo: number; pdfAccepte: boolean };
    }
  >;
  statuts: Record<StatutDossier, string>;
  moisValiditePasseport: number;
}

// --- Campagnes ---

export interface Campagne {
  id: string;
  libelle: string;
  pays: PaysAccueil;
  annee: number;
  typeVisa: string;
  referenceAccord: string | null;
  piecesExigees: string[];
  statut: 'OUVERTE' | 'CLOSE';
  closeLe: string | null;
  dossiers: number;
  parStatut: Partial<Record<StatutDossier, number>>;
}

export interface CampagneDetail extends Campagne {
  valeursCommunes: Record<string, string>;
  pieces: string[];
}

// --- Militaires ---

export interface Militaire {
  id: string;
  matricule: string;
  grade: string | null;
  nom: string;
  prenoms: string;
  sexe: 'MASCULIN' | 'FEMININ' | null;
  dateNaissance: string | null;
  unite: string | null;
  telephone: string | null;
  email: string | null;
  _count?: { dossiers: number };
}

export interface MilitaireDetail extends Militaire {
  dossiers: {
    id: string;
    statut: StatutDossier;
    numeroDemande: string | null;
    campagne: { id: string; libelle: string; pays: PaysAccueil; annee: number };
  }[];
}

export interface RapportImport {
  simulation: boolean;
  totalLignes: number;
  valides: number;
  nouveaux: number;
  misAJour: number;
  dossiersCrees: number;
  erreurs: { ligne: number; messages: string[] }[];
  colonnesIgnorees: string[];
}

// --- Dossiers ---

export interface DossierListe {
  id: string;
  statut: StatutDossier;
  numeroDemande: string | null;
  dateRendezVous: string | null;
  modifieLe: string;
  militaire: {
    id: string;
    matricule: string;
    grade: string | null;
    nom: string;
    prenoms: string;
  };
  campagne: { id: string; libelle: string; pays: PaysAccueil };
  operateur: { id: string; prenoms: string; nom: string } | null;
  _count: { pieces: number };
}

export interface Anomalie {
  champ: string | null;
  message: string;
  niveau: 'BLOQUANT' | 'AVERTISSEMENT';
}

export interface Piece {
  id: string;
  type: string;
  nomFichier: string;
  typeMime: string;
  taille: number;
  largeur: number | null;
  hauteur: number | null;
  purgeeLe: string | null;
  creeLe: string;
}

export interface DossierDetail {
  id: string;
  statut: StatutDossier;
  numeroDemande: string | null;
  dateRendezVous: string | null;
  commentaire: string | null;
  militaire: {
    id: string;
    matricule: string;
    grade: string | null;
    nom: string;
    prenoms: string;
    unite: string | null;
  };
  campagne: {
    id: string;
    libelle: string;
    pays: PaysAccueil;
    typeVisa: string;
    statut: 'OUVERTE' | 'CLOSE';
    pieces: string[];
  };
  operateur: { id: string; prenoms: string; nom: string } | null;
  pieces: Piece[];
  valeurs: Record<string, string>;
  origines: Record<string, 'MILITAIRE' | 'CAMPAGNE' | 'DOSSIER'>;
  anomalies: Anomalie[];
  historique: {
    id: string;
    depuis: StatutDossier | null;
    vers: StatutDossier;
    commentaire: string | null;
    creeLe: string;
    utilisateur: { prenoms: string; nom: string; role: Role } | null;
  }[];
  suivants: StatutDossier[];
  modifiable: boolean;
}

export interface Utilisateur {
  id: string;
  prenoms: string;
  nom: string;
  email: string;
  role: Role;
  actif: boolean;
  motDePasseProvisoire: boolean;
  derniereConnexion: string | null;
  bloqueJusquA: string | null;
}

export interface EntreeJournal {
  id: string;
  action: string;
  entite: string;
  entiteId: string | null;
  details: unknown;
  ip: string | null;
  creeLe: string;
  utilisateur: { prenoms: string; nom: string; role: Role } | null;
}

// --- Libellés et règles d'affichage ---

export const LIBELLES_ROLE: Record<Role, string> = {
  ADMIN: 'Administration (DGSIC)',
  GESTIONNAIRE: 'Gestion (DGRECM)',
  OPERATEUR: 'Opérateur de saisie',
  LECTEUR: 'Lecture (hiérarchie)',
};

export const LIBELLES_PAYS: Record<PaysAccueil, string> = {
  CHINE: 'Chine',
  RUSSIE: 'Russie',
};

export const DRAPEAUX: Record<PaysAccueil, string> = {
  CHINE: '🇨🇳',
  RUSSIE: '🇷🇺',
};

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

export const ORDRE_STATUTS = Object.keys(LIBELLES_STATUT) as StatutDossier[];

/** Libellé du bouton qui fait passer un dossier à ce statut. */
export const ACTIONS_STATUT: Record<StatutDossier, string> = {
  A_COMPLETER: 'Renvoyer pour correction',
  A_VALIDER: 'Envoyer pour validation',
  VALIDE: 'Valider le dossier',
  EN_SAISIE: 'Commencer la saisie sur le site officiel',
  SOUMIS: 'Marquer comme soumis',
  RDV_PRIS: 'Enregistrer le rendez-vous',
  DEPOSE: "Marquer comme déposé à l'ambassade",
  VISA_OBTENU: 'Visa obtenu',
  REFUSE: 'Visa refusé',
  ABANDONNE: 'Abandonner le dossier',
};

export const couleurStatut = (
  statut: StatutDossier,
): 'gris' | 'vert' | 'orange' | 'rouge' | 'bleu' =>
  statut === 'VISA_OBTENU'
    ? 'vert'
    : statut === 'REFUSE' || statut === 'ABANDONNE'
      ? 'rouge'
      : statut === 'A_VALIDER'
        ? 'orange'
        : statut === 'A_COMPLETER'
          ? 'gris'
          : 'bleu';

export const peutGerer = (role: Role) =>
  role === 'ADMIN' || role === 'GESTIONNAIRE';

export const estAgent = (role: Role) => role !== 'LECTEUR';

/** « 2014-03-15 » ou ISO → « 15/03/2014 ». */
export const dateFr = (jour: string) =>
  jour.slice(0, 10).split('-').reverse().join('/');

/** Date et heure à Conakry, ex. « 05/10/2026 14:30 ». */
export const dateHeureFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Africa/Conakry',
    dateStyle: 'short',
    timeStyle: 'short',
  });

export const tailleFr = (octets: number) =>
  octets < 1024 * 1024
    ? `${Math.round(octets / 1024)} Ko`
    : `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
