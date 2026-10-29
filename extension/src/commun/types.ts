// Formes échangées entre la fenêtre de l'extension, la page du site et l'API.

export type TypeChampSite =
  'texte' | 'liste' | 'date' | 'choix' | 'case' | 'cascade' | 'nombre';

export interface OptionSite {
  /** Valeur du site, toujours en texte (une valeur numérique est convertie). */
  valeur: string;
  libelle: string;
}

/** Champ trouvé sur la page affichée. */
export interface ChampReleve {
  cle: string;
  libelle: string;
  type: TypeChampSite;
  obligatoire: boolean;
  options?: OptionSite[];
  formatDate?: string;
  /** Déjà rempli sur la page (ex. brouillon repris). */
  rempli: boolean;
}

export interface ReleveDePage {
  page: string;
  /** Formulaire construit avec Vue / Element UI (remplissage fiable des listes et dates). */
  vue: boolean;
  champs: ChampReleve[];
}

/** Champ relevé enregistré dans l'API, avec sa correspondance. */
export interface ChampSite {
  id: string;
  page: string;
  cle: string;
  libelle: string;
  type: TypeChampSite;
  obligatoire: boolean;
  options: OptionSite[];
  formatDate: string | null;
  mode: 'A_DEFINIR' | 'CHAMP' | 'FIXE' | 'IGNORER';
  champId: string | null;
  valeurFixe: string | null;
  conversions: Record<string, string>;
  remplir: boolean;
  propose: boolean;
}

/** Ordre de remplissage d'un champ, envoyé à la page. */
export interface Ordre {
  cle: string;
  type: TypeChampSite;
  /** Texte, booléen (case), date en « AAAA-MM-JJ » si aucun format n'est connu, chemin (cascade). */
  valeur: string | boolean | number | string[];
  /** Date à créer comme objet Date (sélecteur sans format de valeur). */
  dateObjet?: boolean;
}

export interface ResultatRemplissage {
  remplis: string[];
  /** Champs trouvés sur la page mais impossibles à remplir (ex. choix absent). */
  echecs: { cle: string; raison: string }[];
  /**
   * Choix qui recharge la page (liste « postback » d'ASP.NET) : il est posé en
   * dernier, après la réponse ; les autres champs de ce genre attendent le
   * clic suivant sur « Remplir », une fois la page rechargée.
   */
  rechargement?: { cle: string; enAttente: string[] };
}

export type MessagePage =
  | { action: 'relever' }
  | {
      action: 'remplir';
      ordres: Ordre[];
      aSignaler: Record<string, 'manquant' | 'rempli'>;
    };
