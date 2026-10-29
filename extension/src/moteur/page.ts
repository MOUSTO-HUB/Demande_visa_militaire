// Script exécuté dans la page du site officiel (monde « MAIN » : accès aux
// composants Vue). Il ne parle qu'au script « pont » de l'extension, par
// messages de fenêtre, et n'agit que sur demande de l'agent.
import type { MessagePage, ReleveDePage } from '../commun/types.js';
import { clePage } from '../commun/valeurs.js';
import { releverVue, remplirVue, signalerVue } from './element.js';
import { releverNatif, remplirNatif, signalerNatif } from './natif.js';

const DEMANDE = 'visa-dgrecm:demande';
const REPONSE = 'visa-dgrecm:reponse';

const avecVue = () =>
  [...document.querySelectorAll('.el-form-item')].some(
    (el) => (el as HTMLElement & { __vue__?: unknown }).__vue__,
  );

function relever(): ReleveDePage {
  const vue = avecVue();
  return {
    page: clePage(location.pathname, location.hash),
    vue,
    champs: vue ? releverVue(document) : releverNatif(document),
  };
}

function traiter(message: MessagePage): unknown {
  if (message.action === 'relever') return relever();
  const vue = avecVue();
  const resultat = vue
    ? remplirVue(document, message.ordres)
    : remplirNatif(document, message.ordres);
  // Laisser la page afficher les champs remplis avant de les marquer.
  setTimeout(() => {
    const etats = { ...message.aSignaler };
    for (const cle of resultat.remplis) etats[cle] = 'rempli';
    if (vue) signalerVue(document, etats);
    else signalerNatif(document, etats);
  }, 50);
  return resultat;
}

window.addEventListener('message', (evenement) => {
  if (evenement.source !== window) return;
  const donnees = evenement.data as {
    type?: string;
    id?: string;
    message?: MessagePage;
  } | null;
  if (donnees?.type !== DEMANDE || !donnees.id || !donnees.message) return;
  let resultat: unknown;
  try {
    resultat = { ok: true, valeur: traiter(donnees.message) };
  } catch (e) {
    resultat = { ok: false, erreur: String(e) };
  }
  window.postMessage({ type: REPONSE, id: donnees.id, resultat }, '*');
});
