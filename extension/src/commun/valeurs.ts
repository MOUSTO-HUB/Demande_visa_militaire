import type { ChampReleve, ChampSite, OptionSite, Ordre } from './types.js';

/**
 * Passage des réponses d'un dossier aux valeurs attendues par le site officiel.
 * Fonctions pures : testées sans navigateur.
 */

/** Comparaison des libellés : minuscules, sans accent ni ponctuation. */
export const normaliser = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * « 1990-03-15 » au format d'Element UI (yyyy, MM, dd, et leurs variantes) :
 * « dd/MM/yyyy » → « 15/03/1990 ».
 */
export function formaterDate(jour: string, format: string): string {
  const [a, m, j] = jour.split('-');
  return format
    .replace(/yyyy|YYYY/g, a)
    .replace(/yy|YY/g, a.slice(2))
    .replace(/MM/g, m)
    .replace(/(?<![A-Za-z])M(?![A-Za-z])/g, String(Number(m)))
    .replace(/dd|DD/g, j)
    .replace(/(?<![A-Za-z])[dD](?![A-Za-z])/g, String(Number(j)));
}

/**
 * Nationalité (lue dans la MRZ, en anglais, ou saisie en français) → pays :
 * les listes des sites proposent souvent des pays, pas des nationalités.
 */
const PAYS_DE_NATIONALITE: Record<string, string> = {
  guinean: 'guinea',
  guineen: 'guinee',
  guineenne: 'guinee',
  ivorian: 'cote d ivoire',
  ivoirien: 'cote d ivoire',
  ivoirienne: 'cote d ivoire',
  senegalese: 'senegal',
  senegalais: 'senegal',
  senegalaise: 'senegal',
  malian: 'mali',
  malien: 'mali',
  malienne: 'mali',
  'sierra leonean': 'sierra leone',
  liberian: 'liberia',
  french: 'france',
  francais: 'france',
  francaise: 'france',
  chinese: 'china',
  chinois: 'chine',
  russian: 'russia',
  russe: 'russie',
};

/** Choix du site pour une valeur du dossier : conversion réglée, valeur identique ou libellé. */
export function choisirOption(
  valeur: string,
  options: OptionSite[],
  conversions: Record<string, string>,
): OptionSite | null {
  const convertie = conversions[valeur];
  if (convertie !== undefined)
    return options.find((o) => o.valeur === convertie) ?? null;
  const exacte = options.find((o) => o.valeur === valeur);
  if (exacte) return exacte;
  const trouvee = chercherParLibelle(normaliser(valeur), options);
  if (trouvee) return trouvee;
  const pays = PAYS_DE_NATIONALITE[normaliser(valeur)];
  return pays ? chercherParLibelle(pays, options) : null;
}

function chercherParLibelle(
  cible: string,
  options: OptionSite[],
): OptionSite | null {
  if (!cible) return null;
  // Libellés bilingues : « GUINEA (几内亚) », « Guinée / Guinea ».
  const parties = (libelle: string) =>
    [libelle, ...libelle.split(/[()/|]/)].map(normaliser).filter(Boolean);
  return (
    options.find((o) => normaliser(o.libelle) === cible) ??
    unique(options.filter((o) => parties(o.libelle).includes(cible))) ??
    // Pays, villes : « GUINEA » dans « Guinea (Guinée) », sans ambiguïté seulement.
    unique(options.filter((o) => normaliser(o.libelle).startsWith(cible))) ??
    unique(
      options.filter((o) =>
        ` ${normaliser(o.libelle)} `.includes(` ${cible} `),
      ),
    )
  );
}

const unique = <T>(liste: T[]): T | null =>
  liste.length === 1 ? liste[0] : null;

export type Decision =
  { ordre: Ordre } | { manquant: string } | { ignore: string };

/**
 * Ce que l'extension fait pour un champ de la page : le remplir (ordre), le
 * signaler comme manquant (obligatoire sans réponse), ou l'ignorer.
 */
export function decider(
  site: ChampSite,
  valeurs: Record<string, string>,
): Decision {
  if (site.mode === 'IGNORER') return { ignore: 'ignoré dans les réglages' };
  if (site.mode === 'A_DEFINIR')
    return site.obligatoire
      ? { manquant: 'pas encore relié à une réponse du dossier' }
      : { ignore: 'pas encore relié' };
  const brute =
    site.mode === 'FIXE' ? site.valeurFixe : valeurs[site.champId ?? ''];
  if (!brute)
    return site.obligatoire
      ? { manquant: 'réponse absente du dossier' }
      : { ignore: 'réponse absente du dossier' };

  switch (site.type) {
    case 'liste':
    case 'choix': {
      const option = choisirOption(brute, site.options, site.conversions);
      return option
        ? { ordre: { cle: site.cle, type: site.type, valeur: option.valeur } }
        : { manquant: `« ${brute} » ne correspond à aucun choix du site` };
    }
    case 'cascade': {
      // Options de cascade : valeur = chemin JSON, libellé « Pays / Ville ».
      const feuilles = site.options.map((o) => ({
        ...o,
        libelle: o.libelle.split(' / ').pop() ?? o.libelle,
      }));
      const option = choisirOption(brute, feuilles, site.conversions);
      return option
        ? {
            ordre: {
              cle: site.cle,
              type: 'cascade',
              valeur: JSON.parse(option.valeur) as string[],
            },
          }
        : { manquant: `« ${brute} » introuvable dans la liste du site` };
    }
    case 'case':
      return {
        ordre: {
          cle: site.cle,
          type: 'case',
          valeur: (site.conversions[brute] ?? brute) === 'OUI',
        },
      };
    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(brute))
        return { manquant: `date « ${brute} » illisible` };
      return site.formatDate
        ? {
            ordre: {
              cle: site.cle,
              type: 'date',
              valeur: formaterDate(brute, site.formatDate),
            },
          }
        : {
            ordre: {
              cle: site.cle,
              type: 'date',
              valeur: brute,
              dateObjet: true,
            },
          };
    case 'nombre':
      return Number.isFinite(Number(brute))
        ? { ordre: { cle: site.cle, type: 'nombre', valeur: Number(brute) } }
        : { manquant: `« ${brute} » n'est pas un nombre` };
    default:
      return { ordre: { cle: site.cle, type: 'texte', valeur: brute } };
  }
}

export type ModeRemplissage = 'reglages' | 'obligatoires';

export interface Plan {
  ordres: Ordre[];
  /** Champs obligatoires de la page que l'agent devra saisir lui-même. */
  manquants: { cle: string; libelle: string; raison: string }[];
  /** Champs de la page jamais relevés : il faut cliquer « Relever cette page ». */
  nonReleves: ChampReleve[];
  /** Champs volontairement laissés de côté (facultatifs, ignorés). */
  sautes: number;
}

/**
 * Plan de remplissage de la page affichée.
 * - « reglages » : les champs cochés « Remplir » (par défaut, les obligatoires) ;
 * - « obligatoires » : seulement les champs que le site exige.
 * Un champ déjà rempli sur la page n'est pas écrasé.
 */
export function planifier(
  page: ChampReleve[],
  sites: ChampSite[],
  valeurs: Record<string, string>,
  mode: ModeRemplissage,
): Plan {
  const parCle = new Map(sites.map((s) => [s.cle, s]));
  const plan: Plan = { ordres: [], manquants: [], nonReleves: [], sautes: 0 };
  for (const champ of page) {
    const site = parCle.get(champ.cle);
    if (!site) {
      plan.nonReleves.push(champ);
      continue;
    }
    // L'obligation lue sur la page en direct prime (champ devenu obligatoire).
    const obligatoire = champ.obligatoire || site.obligatoire;
    const voulu =
      mode === 'obligatoires' ? obligatoire : site.remplir || obligatoire;
    if (!voulu || champ.rempli) {
      plan.sautes++;
      continue;
    }
    const decision = decider({ ...site, obligatoire }, valeurs);
    if ('ordre' in decision) plan.ordres.push(decision.ordre);
    else if ('manquant' in decision)
      plan.manquants.push({
        cle: champ.cle,
        libelle: champ.libelle,
        raison: decision.manquant,
      });
    else plan.sautes++;
  }
  return plan;
}

/**
 * Adresse de la page sans paramètres ni identifiants :
 * « /VISA/apply/123456/personal?x=1 » → « /VISA/apply/:id/personal ».
 */
export function clePage(chemin: string, ancre = ''): string {
  const propre = (s: string) =>
    s
      .split('?')[0]
      .replace(/\/\d{3,}(?=\/|$)/g, '/:id')
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id');
  const route = ancre.startsWith('#/') ? propre(ancre.slice(1)) : '';
  return (propre(chemin) + (route ? `#${route}` : '')).slice(0, 300);
}
