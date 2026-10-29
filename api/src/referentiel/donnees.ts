import type { PaysAccueil } from '../generated/prisma/enums.js';
import { REGEX_LATIN, versLatin } from '../common/texte.js';
import {
  estDateValide,
  REGEX_EMAIL,
  REGEX_TELEPHONE,
  versE164,
} from '../common/validation.js';
import {
  CHAMPS,
  CHAMPS_PAR_ID,
  type DefinitionChamp,
  type Portee,
} from './champs.js';

/** Réponses aux champs : { idDuChamp: valeur } ; dates « AAAA-MM-JJ », oui/non « OUI » | « NON ». */
export type Valeurs = Record<string, string>;

export type Origine = 'MILITAIRE' | 'CAMPAGNE' | 'DOSSIER';

const LONGUEUR_MAX = { texte: 200, texte_long: 4000 } as const;

/** Lit un objet JSON de la base comme des réponses (les valeurs non textuelles sont ignorées). */
export function lireValeurs(json: unknown): Valeurs {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  return Object.fromEntries(
    Object.entries(json).filter(
      (e): e is [string, string] => typeof e[1] === 'string',
    ),
  );
}

/**
 * Réponses effectives d'un dossier : la réponse propre au dossier, sinon la
 * valeur commune de la campagne (champs DOSSIER) ; la fiche du militaire (champs MILITAIRE).
 */
export function fusionner(
  fiche: Valeurs,
  communes: Valeurs,
  dossier: Valeurs,
): { valeurs: Valeurs; origines: Record<string, Origine> } {
  const valeurs: Valeurs = {};
  const origines: Record<string, Origine> = {};
  for (const champ of CHAMPS) {
    const sources: [Origine, string | undefined][] =
      champ.portee === 'MILITAIRE'
        ? [['MILITAIRE', fiche[champ.id]]]
        : [
            ['DOSSIER', dossier[champ.id]],
            ['CAMPAGNE', champ.communInterdit ? undefined : communes[champ.id]],
          ];
    const trouvee = sources.find(([, v]) => v !== undefined && v !== '');
    if (trouvee) {
      valeurs[champ.id] = trouvee[1]!;
      origines[champ.id] = trouvee[0];
    }
  }
  return { valeurs, origines };
}

/** « 15/03/1990 » ou « 1990-03-15 » → « 1990-03-15 » ; sinon la valeur telle quelle. */
export function versDateIso(valeur: string): string {
  const jma = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(valeur);
  if (!jma) return valeur;
  const [, j, m, a] = jma;
  return `${a}-${m.padStart(2, '0')}-${j.padStart(2, '0')}`;
}

/**
 * Met une saisie dans la forme attendue par les formulaires officiels.
 * `null` : champ vidé. Renvoie un message si la valeur est inacceptable.
 */
export function normaliser(
  champ: DefinitionChamp,
  brut: unknown,
): { valeur: string | null } | { erreur: string } {
  if (brut === null || brut === undefined) return { valeur: null };
  if (typeof brut !== 'string')
    return { erreur: `${champ.libelle} : valeur invalide.` };
  let valeur = brut.trim();
  if (valeur === '') return { valeur: null };

  switch (champ.type) {
    case 'texte':
    case 'texte_long': {
      if (champ.latin) valeur = versLatin(valeur);
      if (valeur.length > LONGUEUR_MAX[champ.type])
        return {
          erreur: `${champ.libelle} : ${LONGUEUR_MAX[champ.type]} caractères au plus.`,
        };
      return { valeur };
    }
    case 'date':
      valeur = versDateIso(valeur);
      return estDateValide(valeur)
        ? { valeur }
        : { erreur: `${champ.libelle} : date invalide (JJ/MM/AAAA).` };
    case 'telephone':
      valeur = versE164(valeur);
      return REGEX_TELEPHONE.test(valeur)
        ? { valeur }
        : {
            erreur: `${champ.libelle} : numéro invalide (ex. +224621123456).`,
          };
    case 'email':
      valeur = valeur.toLowerCase();
      return REGEX_EMAIL.test(valeur)
        ? { valeur }
        : { erreur: `${champ.libelle} : adresse email invalide.` };
    case 'oui_non':
      valeur = valeur.toUpperCase();
      return valeur === 'OUI' || valeur === 'NON'
        ? { valeur }
        : { erreur: `${champ.libelle} : répondre OUI ou NON.` };
    case 'liste':
      return champ.options?.some((o) => o.valeur === valeur)
        ? { valeur }
        : { erreur: `${champ.libelle} : choix inconnu.` };
  }
}

export interface Repartition {
  /** Champs MILITAIRE stockés en colonne (nom, prénoms, sexe…). */
  colonnes: Record<string, string | null>;
  /** Champs MILITAIRE du profil (null : à effacer). */
  profil: Record<string, string | null>;
  /** Champs DOSSIER. */
  dossier: Record<string, string | null>;
  erreurs: { champ: string; message: string }[];
}

/**
 * Répartit une saisie (formulaire du dossier, lecture MRZ) entre la fiche du
 * militaire et le dossier, après normalisation. `portees` limite les champs
 * acceptés (ex. valeurs communes d'une campagne : DOSSIER seulement).
 */
export function repartir(
  saisie: Record<string, unknown>,
  portees: Portee[] = ['MILITAIRE', 'DOSSIER'],
): Repartition {
  const resultat: Repartition = {
    colonnes: {},
    profil: {},
    dossier: {},
    erreurs: [],
  };
  for (const [id, brut] of Object.entries(saisie)) {
    const champ = CHAMPS_PAR_ID.get(id);
    if (!champ || !portees.includes(champ.portee)) {
      resultat.erreurs.push({ champ: id, message: `Champ inconnu : ${id}.` });
      continue;
    }
    const n = normaliser(champ, brut);
    if ('erreur' in n) {
      resultat.erreurs.push({ champ: id, message: n.erreur });
      continue;
    }
    const cible =
      champ.portee === 'DOSSIER'
        ? resultat.dossier
        : champ.colonne
          ? resultat.colonnes
          : resultat.profil;
    cible[id] = n.valeur;
  }
  return resultat;
}

/** Applique des modifications (null : supprimer) à des réponses existantes. */
export function appliquer(
  existantes: Valeurs,
  modifications: Record<string, string | null>,
): Valeurs {
  const resultat = { ...existantes };
  for (const [id, valeur] of Object.entries(modifications)) {
    if (valeur === null) delete resultat[id];
    else resultat[id] = valeur;
  }
  return resultat;
}

// ─── Contrôles ───────────────────────────────────────────────────────────────

export interface Anomalie {
  champ: string | null;
  message: string;
  /** BLOQUANT : empêche la validation du dossier. */
  niveau: 'BLOQUANT' | 'AVERTISSEMENT';
}

/** Validité minimale du passeport après la fin du séjour (mois). */
export const MOIS_VALIDITE_PASSEPORT = 6;

const ajouterMois = (jour: string, mois: number): string => {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + mois);
  return d.toISOString().slice(0, 10);
};

const ageAu = (naissance: string, jour: string): number => {
  const [an, mn, jn] = naissance.split('-').map(Number);
  const [a, m, j] = jour.split('-').map(Number);
  return a - an - (m < mn || (m === mn && j < jn) ? 1 : 0);
};

/**
 * Contrôles d'un dossier pour le formulaire du pays : champs obligatoires,
 * formats, cohérence des dates et validité du passeport.
 * `aujourdhui` : « AAAA-MM-JJ » (paramètre pour les tests).
 */
export function controler(
  pays: PaysAccueil,
  valeurs: Valeurs,
  aujourdhui: string = new Date().toISOString().slice(0, 10),
): Anomalie[] {
  const anomalies: Anomalie[] = [];
  const bloquant = (champ: string | null, message: string) =>
    anomalies.push({ champ, message, niveau: 'BLOQUANT' });
  const avertir = (champ: string | null, message: string) =>
    anomalies.push({ champ, message, niveau: 'AVERTISSEMENT' });

  for (const champ of CHAMPS) {
    const valeur = valeurs[champ.id];
    if (!valeur) {
      if (champ.obligatoire.includes(pays))
        bloquant(champ.id, `${champ.libelle} : à renseigner.`);
      continue;
    }
    // Valeurs anciennes ou importées : même règle qu'à la saisie.
    const n = normaliser(champ, valeur);
    if ('erreur' in n) bloquant(champ.id, n.erreur);
    else if (champ.latin && !REGEX_LATIN.test(n.valeur ?? ''))
      bloquant(
        champ.id,
        `${champ.libelle} : caractères non acceptés par le formulaire officiel.`,
      );
  }

  const v = (id: string) => {
    const valeur = valeurs[id];
    return valeur && estDateValide(valeur) ? valeur : undefined;
  };
  const naissance = v('dateNaissance');
  const delivrance = v('passeportDateDelivrance');
  const expiration = v('passeportDateExpiration');
  const arrivee = v('dateArrivee');
  const fin = v('dateFinSejour');

  if (naissance) {
    if (naissance >= aujourdhui)
      bloquant('dateNaissance', 'La date de naissance est dans le futur.');
    else if (ageAu(naissance, aujourdhui) < 17)
      avertir('dateNaissance', 'Le militaire aurait moins de 17 ans.');
  }
  if (delivrance && delivrance > aujourdhui)
    bloquant(
      'passeportDateDelivrance',
      'La date de délivrance du passeport est dans le futur.',
    );
  if (delivrance && expiration && expiration <= delivrance)
    bloquant(
      'passeportDateExpiration',
      "La date d'expiration du passeport précède sa date de délivrance.",
    );
  if (expiration) {
    if (expiration <= aujourdhui)
      bloquant('passeportDateExpiration', 'Le passeport est expiré.');
    else {
      const reference = fin ?? arrivee ?? aujourdhui;
      const limite = ajouterMois(reference, MOIS_VALIDITE_PASSEPORT);
      if (expiration < limite)
        bloquant(
          'passeportDateExpiration',
          `Le passeport doit être valable au moins ${MOIS_VALIDITE_PASSEPORT} mois après ${fin ? 'la fin du séjour' : arrivee ? "l'arrivée" : "aujourd'hui"} (jusqu'au ${limite.split('-').reverse().join('/')}).`,
        );
    }
  }
  if (arrivee && arrivee < aujourdhui)
    avertir('dateArrivee', "La date d'arrivée prévue est déjà passée.");
  if (arrivee && fin && fin <= arrivee)
    bloquant(
      'dateFinSejour',
      "La fin du séjour doit être postérieure à l'arrivée.",
    );
  if (valeurs.situationFamiliale === 'MARIE' && !valeurs.conjointNom)
    bloquant('conjointNom', 'Marié(e) : renseigner le conjoint.');
  if (valeurs.refusVisa === 'OUI' && !valeurs.refusVisaDetail)
    bloquant(
      'refusVisaDetail',
      'Refus de visa : préciser pays, date et motif.',
    );
  const declarationsOui = ['antecedentsJudiciaires', 'maladieGrave'].some(
    (id) => valeurs[id] === 'OUI',
  );
  if (declarationsOui && !valeurs.declarationsDetail)
    bloquant(
      'declarationsDetail',
      'Une déclaration est « Oui » : préciser les circonstances.',
    );
  return anomalies;
}

export const nombreBloquants = (anomalies: Anomalie[]) =>
  anomalies.filter((a) => a.niveau === 'BLOQUANT').length;
