import type {
  ChampReleve,
  Ordre,
  ResultatRemplissage,
  TypeChampSite,
} from '../commun/types.js';
import { normaliser } from '../commun/valeurs.js';

/**
 * Formulaires HTML ordinaires (pages sans Element UI, futur site russe) :
 * champs <input>, <select> et <textarea>, groupés par nom pour les boutons radio.
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

function libelleDe(el: Saisissable): string {
  const texte =
    el.labels?.[0]?.textContent ??
    el.getAttribute('aria-label') ??
    el.closest('label')?.textContent ??
    el.getAttribute('placeholder') ??
    el.name;
  return (texte ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[*:：\s]+$/, '')
    .trim();
}

const cleDe = (el: Saisissable) =>
  el.name || el.id || `libelle:${normaliser(libelleDe(el))}`;

function champsVisibles(racine: ParentNode): Saisissable[] {
  return [
    ...racine.querySelectorAll<Saisissable>('input, select, textarea'),
  ].filter(
    (el) =>
      !(el instanceof HTMLInputElement && IGNORES.has(el.type)) &&
      !el.disabled &&
      el.getClientRects().length > 0,
  );
}

export function releverNatif(racine: ParentNode): ChampReleve[] {
  const champs = new Map<string, ChampReleve>();
  for (const el of champsVisibles(racine)) {
    const cle = cleDe(el);
    const obligatoire =
      el.required || el.getAttribute('aria-required') === 'true';
    if (el instanceof HTMLInputElement && el.type === 'radio') {
      const groupe = champs.get(cle);
      const option = { valeur: el.value, libelle: libelleDe(el) || el.value };
      if (groupe) {
        groupe.options!.push(option);
        groupe.obligatoire ||= obligatoire;
        groupe.rempli ||= el.checked;
      } else
        champs.set(cle, {
          cle,
          libelle:
            el
              .closest('fieldset')
              ?.querySelector('legend')
              ?.textContent?.trim() ?? cle,
          type: 'choix',
          obligatoire,
          options: [option],
          rempli: el.checked,
        });
      continue;
    }
    let type: TypeChampSite = 'texte';
    if (el instanceof HTMLSelectElement) type = 'liste';
    else if (el instanceof HTMLInputElement && el.type === 'checkbox')
      type = 'case';
    else if (el instanceof HTMLInputElement && el.type === 'date')
      type = 'date';
    else if (el instanceof HTMLInputElement && el.type === 'number')
      type = 'nombre';
    champs.set(cle, {
      cle,
      libelle: libelleDe(el) || cle,
      type,
      obligatoire,
      ...(el instanceof HTMLSelectElement
        ? {
            options: [...el.options]
              .filter((o) => o.value)
              .map((o) => ({ valeur: o.value, libelle: o.text.trim() })),
          }
        : {}),
      ...(type === 'date' ? { formatDate: 'yyyy-MM-dd' } : {}),
      rempli:
        el instanceof HTMLInputElement && el.type === 'checkbox'
          ? el.checked
          : el.value !== '',
    });
  }
  return [...champs.values()];
}

/** Valeur posée comme une frappe (les frameworks écoutent « input » et « change »). */
function poser(el: Saisissable, valeur: string): void {
  const prototype = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, valeur);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function remplirNatif(
  racine: ParentNode,
  ordres: Ordre[],
): ResultatRemplissage {
  const resultat: ResultatRemplissage = { remplis: [], echecs: [] };
  const elements = champsVisibles(racine);
  for (const ordre of ordres) {
    const cibles = elements.filter((el) => cleDe(el) === ordre.cle);
    if (!cibles.length) {
      resultat.echecs.push({
        cle: ordre.cle,
        raison: 'champ absent de la page affichée',
      });
      continue;
    }
    const el = cibles[0];
    if (ordre.type === 'choix') {
      const bouton = cibles.find(
        (c) =>
          c instanceof HTMLInputElement && c.value === String(ordre.valeur),
      ) as HTMLInputElement | undefined;
      if (!bouton) {
        resultat.echecs.push({ cle: ordre.cle, raison: 'choix introuvable' });
        continue;
      }
      bouton.click();
    } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (el.checked !== Boolean(ordre.valeur)) el.click();
    } else poser(el, String(ordre.valeur));
    resultat.remplis.push(ordre.cle);
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
