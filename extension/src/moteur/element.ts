import type {
  ChampReleve,
  OptionSite,
  Ordre,
  ResultatRemplissage,
  TypeChampSite,
} from '../commun/types.js';
import { normaliser } from '../commun/valeurs.js';

/**
 * Lecture et remplissage d'un formulaire Vue 2 + Element UI (site COVA).
 * Les listes, dates et boutons radio d'Element UI ne sont pas des champs HTML
 * ordinaires : on passe par leurs composants (`__vue__`), comme le ferait un
 * clic, ce qui met aussi à jour le formulaire de la page et ses contrôles.
 */

/** Instance de composant Vue 2 (partie utilisée). */
export interface Composant {
  $options: { name?: string };
  $children: Composant[];
  $el: HTMLElement;
  $emit: (evenement: string, ...args: unknown[]) => void;
  [propriete: string]: unknown;
}

type ElementVue = HTMLElement & { __vue__?: Composant };

const TYPES: Record<string, TypeChampSite> = {
  ElSelect: 'liste',
  ElDatePicker: 'date',
  ElTimeSelect: 'texte',
  ElRadioGroup: 'choix',
  ElCheckboxGroup: 'liste',
  ElCheckbox: 'case',
  ElCascader: 'cascade',
  ElInputNumber: 'nombre',
  ElAutocomplete: 'texte',
  ElInput: 'texte',
};

/** Contrôle de saisie d'un élément de formulaire (le plus haut dans l'arbre). */
export function controle(item: Composant): Composant | null {
  const file = [...item.$children];
  while (file.length) {
    const c = file.shift()!;
    if (c.$options.name && c.$options.name in TYPES) return c;
    file.push(...c.$children);
  }
  return null;
}

const enTexte = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

function texteVisible(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Choix d'une liste, de boutons radio ou d'une cascade. */
export function optionsDe(c: Composant): OptionSite[] {
  switch (c.$options.name) {
    case 'ElSelect':
      return ((c.options as Composant[] | undefined) ?? [])
        .filter((o) => !o.disabled)
        .map((o) => ({
          valeur: enTexte(o.value),
          libelle: String(o.currentLabel ?? o.label ?? o.value),
        }));
    case 'ElRadioGroup':
    case 'ElCheckboxGroup': {
      const boutons: Composant[] = [];
      const file = [...c.$children];
      while (file.length) {
        const x = file.shift()!;
        if (/^El(Radio|Checkbox)(Button)?$/.test(x.$options.name ?? ''))
          boutons.push(x);
        else file.push(...x.$children);
      }
      return boutons.map((b) => ({
        valeur: enTexte(b.label),
        libelle: texteVisible(b.$el) || enTexte(b.label),
      }));
    }
    case 'ElCascader': {
      const config = (c.props ?? {}) as Record<string, string>;
      const cleValeur = config.value ?? 'value';
      const cleLibelle = config.label ?? 'label';
      const cleEnfants = config.children ?? 'children';
      const feuilles: OptionSite[] = [];
      const parcourir = (
        noeuds: Record<string, unknown>[],
        chemin: unknown[],
        libelles: string[],
      ) => {
        for (const n of noeuds) {
          const enfants = n[cleEnfants] as
            Record<string, unknown>[] | undefined;
          const suite = [...chemin, n[cleValeur]];
          const noms = [...libelles, String(n[cleLibelle])];
          if (enfants?.length) parcourir(enfants, suite, noms);
          else
            feuilles.push({
              valeur: JSON.stringify(suite),
              libelle: noms.join(' / '),
            });
        }
      };
      parcourir((c.options as Record<string, unknown>[]) ?? [], [], []);
      return feuilles.slice(0, 400);
    }
    default:
      return [];
  }
}

const estVide = (v: unknown) =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0);

/** Vrai si l'élément est affiché (les sections masquées du formulaire sont ignorées). */
let estVisible = (el: HTMLElement) => el.getClientRects().length > 0;

/** Pour les tests (jsdom ne calcule pas la mise en page). */
export function definirVisibilite(f: (el: HTMLElement) => boolean): void {
  estVisible = f;
}

/** Même règle de visibilité pour le moteur des formulaires HTML. */
export const visible = (el: HTMLElement) => estVisible(el);

function elementsVisibles(racine: ParentNode): ElementVue[] {
  return [...racine.querySelectorAll<ElementVue>('.el-form-item')].filter(
    (el) => el.__vue__ && estVisible(el),
  );
}

export function cleItem(item: Composant, libelle: string): string {
  const prop = item.prop as string | undefined;
  return prop ? prop : `libelle:${normaliser(libelle)}`;
}

/** Champs Element UI de la page. */
export function releverVue(racine: ParentNode): ChampReleve[] {
  const champs: ChampReleve[] = [];
  const vus = new Set<string>();
  for (const el of elementsVisibles(racine)) {
    const item = el.__vue__!;
    const c = controle(item);
    if (!c) continue;
    const libelle =
      String(item.label ?? '').trim() ||
      texteVisible(
        el.querySelector<HTMLElement>('.el-form-item__label') ?? el,
      ).slice(0, 200);
    const cle = cleItem(item, libelle);
    if (vus.has(cle)) continue;
    vus.add(cle);
    const type = TYPES[c.$options.name!];
    const options = optionsDe(c);
    champs.push({
      cle,
      libelle: libelle.replace(/[*:：\s]+$/, '').replace(/^\*\s*/, ''),
      type,
      obligatoire:
        item.isRequired === true || el.classList.contains('is-required'),
      ...(options.length ? { options } : {}),
      ...(type === 'date' && typeof c.valueFormat === 'string'
        ? { formatDate: c.valueFormat }
        : {}),
      // Une case décochée est l'état par défaut, pas une réponse.
      rempli: type === 'case' ? c.value === true : !estVide(c.value),
    });
  }
  return champs;
}

/** Valeur dans le type de l'option du site (nombre si le site utilise des nombres). */
function valeurOption(c: Composant, valeur: string): unknown {
  if (c.$options.name === 'ElSelect') {
    const o = ((c.options as Composant[] | undefined) ?? []).find(
      (x) => enTexte(x.value) === valeur,
    );
    return o ? o.value : valeur;
  }
  if (c.$options.name === 'ElRadioGroup') {
    const o = optionsDe(c).find((x) => x.valeur === valeur);
    if (!o) return valeur;
    try {
      return typeof JSON.parse(valeur) === 'number' ? Number(valeur) : valeur;
    } catch {
      return valeur;
    }
  }
  return valeur;
}

/** Remplit les champs demandés, puis lance les contrôles de la page sur ces champs. */
export function remplirVue(
  racine: ParentNode,
  ordres: Ordre[],
): ResultatRemplissage {
  const resultat: ResultatRemplissage = { remplis: [], echecs: [] };
  const parCle = new Map(ordres.map((o) => [o.cle, o]));
  for (const el of elementsVisibles(racine)) {
    const item = el.__vue__!;
    const c = controle(item);
    if (!c) continue;
    const libelle =
      String(item.label ?? '').trim() ||
      texteVisible(el.querySelector<HTMLElement>('.el-form-item__label') ?? el);
    const cle = cleItem(item, libelle);
    const ordre = parCle.get(cle);
    if (!ordre) continue;
    parCle.delete(cle);
    try {
      let valeur: unknown = ordre.valeur;
      if (ordre.type === 'liste' || ordre.type === 'choix')
        valeur = valeurOption(c, String(ordre.valeur));
      if (ordre.type === 'date' && ordre.dateObjet)
        valeur = new Date(`${String(ordre.valeur)}T00:00:00`);
      if (c.$options.name === 'ElCheckboxGroup' && !Array.isArray(valeur))
        valeur = [valeur];
      // Comme une saisie de l'agent : v-model, puis événement de changement.
      c.$emit('input', valeur);
      c.$emit('change', valeur);
      const valider = item.validate as
        ((declencheur: string, rappel?: () => void) => void) | undefined;
      valider?.call(item, '', () => undefined);
      resultat.remplis.push(cle);
    } catch (e) {
      resultat.echecs.push({ cle, raison: String(e) });
    }
  }
  for (const cle of parCle.keys())
    resultat.echecs.push({ cle, raison: 'champ absent de la page affichée' });
  return resultat;
}

/** Repère visuel : vert = rempli par l'extension, rouge = obligatoire à saisir par l'agent. */
export function signalerVue(
  racine: ParentNode,
  etats: Record<string, 'manquant' | 'rempli'>,
): void {
  for (const el of elementsVisibles(racine)) {
    const item = el.__vue__!;
    const libelle =
      String(item.label ?? '').trim() ||
      texteVisible(el.querySelector<HTMLElement>('.el-form-item__label') ?? el);
    const etat = etats[cleItem(item, libelle)];
    el.style.outline =
      etat === 'rempli'
        ? '2px solid #16a34a'
        : etat === 'manquant'
          ? '2px dashed #dc2626'
          : '';
    el.style.outlineOffset = etat ? '3px' : '';
    el.style.borderRadius = etat ? '6px' : '';
  }
}
