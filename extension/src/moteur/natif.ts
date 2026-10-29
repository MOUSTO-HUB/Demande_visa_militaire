import type {
  ChampReleve,
  Ordre,
  ResultatRemplissage,
  TypeChampSite,
} from '../commun/types.js';
import { normaliser } from '../commun/valeurs.js';
import { visible } from './element.js';

/**
 * Formulaires HTML ordinaires (site russe kdmid en ASP.NET WebForms, pages
 * sans Element UI) : champs <input>, <select> et <textarea>, groupés par nom
 * pour les boutons radio.
 *
 * Particularités prises en compte :
 * - libellé dans un élément voisin (`<span class="Label">`, cellule de tableau
 *   précédente) plutôt que dans un `<label for>` ;
 * - obligation signalée par une marque (`RequiredFieldMark` « * »), un
 *   validateur ASP.NET (`Page_Validators`) ou l'attribut `required` ;
 * - listes qui rechargent la page à chaque changement (`postback-dropdown`,
 *   `__doPostBack`) : posées une par clic, en dernier ;
 * - listes en cascade inactives ou vides tant que la précédente n'est pas choisie.
 */

type Saisissable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const IGNORES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'file',
  'password',
]);

const SELECTEUR = 'input, select, textarea';

const estSaisissable = (el: Element): el is Saisissable =>
  el.matches(SELECTEUR) &&
  !(el instanceof HTMLInputElement && IGNORES.has(el.type));

const cleDe = (el: Saisissable): string =>
  el.name ||
  el.id ||
  (el.type === 'radio' ? 'radio' : `libelle:${normaliser(libelleDe(el))}`);

/** Éléments voisins qui ne sont pas des libellés : marques, messages d'erreur. */
const ACCESSOIRE = /required|validat|error|erreur|tooltip|help/i;

const propre = (texte: string) =>
  texte
    .replace(/\s+/g, ' ')
    .replace(/^[*\s]+|[*:：\s]+$/g, '')
    .trim();

const estLimite = (el: Element) =>
  el === document.body || el.tagName === 'FORM';

/**
 * Plus grand ancêtre (4 niveaux au plus) qui ne contient que ce champ (ou ce
 * groupe de boutons radio) : sa marque d'obligation s'y trouve.
 */
function conteneurPropre(el: Saisissable): Element {
  const cle = cleDe(el);
  let conteneur: Element = el;
  for (let i = 0; i < 4 && conteneur.parentElement; i++) {
    const parent = conteneur.parentElement;
    if (
      estLimite(parent) ||
      [...parent.querySelectorAll(SELECTEUR)].some(
        (x) => estSaisissable(x) && cleDe(x) !== cle,
      )
    )
      break;
    conteneur = parent;
  }
  return conteneur;
}

/**
 * Texte placé avant l'élément : ses frères précédents, puis ceux de ses
 * ancêtres. S'arrête au premier autre champ rencontré (le texte serait le sien).
 */
function texteAvant(depart: Element, nettoyer = propre): string {
  let noeud: Element | null = depart;
  for (let niveau = 0; niveau < 5 && noeud && !estLimite(noeud); niveau++) {
    for (let f = noeud.previousSibling; f; f = f.previousSibling) {
      if (f instanceof Element) {
        if (['SCRIPT', 'STYLE', 'BR'].includes(f.tagName)) continue;
        if (
          estSaisissable(f) ||
          [...f.querySelectorAll(SELECTEUR)].some(estSaisissable)
        )
          return '';
        if (ACCESSOIRE.test(`${f.id} ${f.className}`)) continue;
      }
      const texte = nettoyer(f.textContent ?? '');
      if (texte) return texte;
    }
    noeud = noeud.parentElement;
  }
  return '';
}

function libelleDe(el: Saisissable): string {
  if (el instanceof HTMLInputElement && el.type === 'radio')
    return libelleGroupe(el);
  const texte =
    el.labels?.[0]?.textContent ??
    el.getAttribute('aria-label') ??
    document.getElementById(el.getAttribute('aria-labelledby') ?? '')
      ?.textContent ??
    (texteAvant(el) || null) ??
    el.getAttribute('placeholder') ??
    el.getAttribute('title') ??
    el.name;
  return propre(texte ?? '');
}

/** Libellé d'un groupe de boutons radio (fieldset, ou texte avant le groupe). */
function libelleGroupe(el: HTMLInputElement): string {
  const legende = el.closest('fieldset')?.querySelector('legend')?.textContent;
  return legende ? propre(legende) : texteAvant(conteneurPropre(el)) || el.name;
}

/** Champs visés par un validateur « obligatoire » d'ASP.NET (variable globale du site). */
function champsValidesObligatoires(): Set<string> {
  const validateurs = (
    window as unknown as {
      Page_Validators?: {
        controltovalidate?: string;
        evaluationfunction?: unknown;
      }[];
    }
  ).Page_Validators;
  const ids = new Set<string>();
  for (const v of validateurs ?? []) {
    const fonction =
      typeof v.evaluationfunction === 'function'
        ? v.evaluationfunction.name
        : String(v.evaluationfunction ?? '');
    if (v.controltovalidate && /required/i.test(fonction))
      ids.add(v.controltovalidate);
  }
  return ids;
}

function obligatoireDe(el: Saisissable, requis: Set<string>): boolean {
  if (el.required || el.getAttribute('aria-required') === 'true') return true;
  if (el.id && requis.has(el.id)) return true;
  const conteneur = conteneurPropre(el);
  if (
    [...conteneur.querySelectorAll('[class*="equired"]')].some((m) =>
      (m.textContent ?? '').includes('*'),
    )
  )
    return true;
  // « Nom * » : astérisque dans le libellé.
  const libelle =
    el.labels?.[0]?.textContent ?? texteAvant(el, (t) => t.trim());
  return libelle.includes('*');
}

/** « __.__.____ » (masque de saisie) compte comme vide. */
const vide = (valeur: string) => !/[^\s_./-]/.test(valeur);

/** Premier choix d'invite : « Choisir », « Choose country », « --- »… */
const estInvite = (o: HTMLOptionElement, i: number) =>
  !o.value ||
  (i === 0 && /choisi|choose|select|выбер|^\W*$/iu.test(o.text.trim()));

/**
 * Format d'une date saisie en texte, d'après l'indication voisine
 * (« jj.mm.aaaa », « ДД.ММ.ГГГГ », « dd/mm/yyyy ») ou le masque « __.__.____ ».
 */
export function formatIndique(indication: string): string | undefined {
  const jour =
    /(?<!\p{L})(?:dd|jj|дд)([./-])(?:mm|мм)\1(?:yyyy|aaaa|гггг)(?!\p{L})/iu.exec(
      indication,
    );
  if (jour) return `dd${jour[1]}MM${jour[1]}yyyy`;
  const mois = /(?<!\p{L})mm([./-])dd\1yyyy(?!\p{L})/iu.exec(indication);
  if (mois) return `MM${mois[1]}dd${mois[1]}yyyy`;
  const masque = /(?<![_\d])_{2}([./-])_{2}\1_{4}(?![_\d])/.exec(indication);
  return masque ? `dd${masque[1]}MM${masque[1]}yyyy` : undefined;
}

/** Choix qui recharge la page (AutoPostBack d'ASP.NET). */
const recharge = (el: Saisissable) =>
  el.classList.contains('postback-dropdown') ||
  /__doPostBack/.test(
    `${el.getAttribute('onchange') ?? ''} ${el.getAttribute('onclick') ?? ''}`,
  );

function champsVisibles(racine: ParentNode): Saisissable[] {
  return [...racine.querySelectorAll<Saisissable>(SELECTEUR)].filter(
    (el) => estSaisissable(el) && visible(el),
  );
}

/**
 * Tous les champs affichés, y compris ceux encore inactifs (liste en cascade
 * qui attend la précédente) : ils seront remplis à un clic suivant.
 */
export function releverNatif(racine: ParentNode): ChampReleve[] {
  const requis = champsValidesObligatoires();
  const champs = new Map<string, ChampReleve>();
  for (const el of champsVisibles(racine)) {
    const cle = cleDe(el);
    const obligatoire = obligatoireDe(el, requis);
    if (el instanceof HTMLInputElement && el.type === 'radio') {
      const groupe = champs.get(cle);
      const option = {
        valeur: el.value,
        libelle: propre(el.labels?.[0]?.textContent ?? '') || el.value,
      };
      if (groupe) {
        groupe.options!.push(option);
        groupe.obligatoire ||= obligatoire;
        groupe.rempli ||= el.checked;
      } else
        champs.set(cle, {
          cle,
          libelle: libelleGroupe(el),
          type: 'choix',
          obligatoire,
          options: [option],
          rempli: el.checked,
        });
      continue;
    }
    const libelle = libelleDe(el) || cle;
    let type: TypeChampSite = 'texte';
    let formatDate: string | undefined;
    if (el instanceof HTMLSelectElement) type = 'liste';
    else if (el instanceof HTMLInputElement && el.type === 'checkbox')
      type = 'case';
    else if (el instanceof HTMLInputElement && el.type === 'date') {
      type = 'date';
      formatDate = 'yyyy-MM-dd';
    } else if (el instanceof HTMLInputElement && el.type === 'number')
      type = 'nombre';
    else if (el instanceof HTMLInputElement) {
      formatDate = formatIndique(
        [
          el.placeholder,
          el.title,
          el.value,
          conteneurPropre(el).textContent ?? '',
          libelle,
        ].join(' '),
      );
      if (formatDate) type = 'date';
    }
    champs.set(cle, {
      cle,
      libelle,
      type,
      obligatoire,
      ...(el instanceof HTMLSelectElement
        ? {
            options: [...el.options]
              .filter((o, i) => !estInvite(o, i))
              .map((o) => ({ valeur: o.value, libelle: o.text.trim() })),
          }
        : {}),
      ...(formatDate ? { formatDate } : {}),
      rempli:
        el instanceof HTMLInputElement && el.type === 'checkbox'
          ? el.checked
          : el instanceof HTMLSelectElement
            ? el.selectedIndex >= 0 &&
              !estInvite(el.options[el.selectedIndex], el.selectedIndex)
            : !vide(el.value),
    });
  }
  return [...champs.values()];
}

/** Valeur posée comme une frappe (les scripts du site écoutent « input » et « change »). */
function poser(el: Saisissable, valeur: string): void {
  const prototype = Object.getPrototypeOf(el) as object;
  el.dispatchEvent(new Event('focus'));
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, valeur);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur'));
}

/** Raison pour laquelle l'ordre ne peut pas être appliqué, ou null. */
function empechement(cibles: Saisissable[], ordre: Ordre): string | null {
  const el = cibles[0];
  if (cibles.every((c) => c.disabled))
    return 'champ encore inactif : remplissez le champ précédent, puis cliquez de nouveau « Remplir »';
  if (
    ordre.type === 'choix' &&
    !cibles.some((c) => c.value === String(ordre.valeur))
  )
    return 'choix introuvable';
  if (
    el instanceof HTMLSelectElement &&
    ![...el.options].some((o) => o.value === String(ordre.valeur))
  )
    return 'choix absent de la liste (liste pas encore chargée ?)';
  return null;
}

function appliquer(cibles: Saisissable[], ordre: Ordre): void {
  const el = cibles[0];
  if (ordre.type === 'choix') {
    const bouton = cibles.find(
      (c) => c.value === String(ordre.valeur),
    ) as HTMLInputElement;
    if (!bouton.checked) bouton.click();
  } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
    if (el.checked !== Boolean(ordre.valeur)) el.click();
  } else poser(el, String(ordre.valeur));
}

/**
 * Remplit les champs de la page. Un choix qui recharge la page est posé en
 * dernier, après la réponse au moteur (le rechargement interromprait la
 * suite) ; un seul par clic.
 */
export function remplirNatif(
  racine: ParentNode,
  ordres: Ordre[],
  attente = 300,
): ResultatRemplissage {
  const resultat: ResultatRemplissage = { remplis: [], echecs: [] };
  const elements = champsVisibles(racine);
  const differes: { cibles: Saisissable[]; ordre: Ordre }[] = [];
  for (const ordre of ordres) {
    const cibles = elements.filter((el) => cleDe(el) === ordre.cle);
    const raison = cibles.length
      ? empechement(cibles, ordre)
      : 'champ absent de la page affichée';
    if (raison) resultat.echecs.push({ cle: ordre.cle, raison });
    else if (cibles.some(recharge)) differes.push({ cibles, ordre });
    else {
      appliquer(cibles, ordre);
      resultat.remplis.push(ordre.cle);
    }
  }
  const [premier, ...suivants] = differes;
  if (premier) {
    resultat.remplis.push(premier.ordre.cle);
    resultat.rechargement = {
      cle: premier.ordre.cle,
      enAttente: suivants.map((d) => d.ordre.cle),
    };
    setTimeout(() => appliquer(premier.cibles, premier.ordre), attente);
  }
  return resultat;
}

export function signalerNatif(
  racine: ParentNode,
  etats: Record<string, 'manquant' | 'rempli'>,
): void {
  for (const el of champsVisibles(racine)) {
    const etat = etats[cleDe(el)];
    el.style.outline =
      etat === 'rempli'
        ? '2px solid #16a34a'
        : etat === 'manquant'
          ? '2px dashed #dc2626'
          : '';
  }
}
