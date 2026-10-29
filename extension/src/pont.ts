// Script de l'extension (monde isolé) : relaie les demandes de la fenêtre de
// l'extension vers le script de la page, et renvoie la réponse.
import type { MessagePage } from './commun/types.js';

const DEMANDE = 'visa-dgrecm:demande';
const REPONSE = 'visa-dgrecm:reponse';

chrome.runtime.onMessage.addListener(
  (message: MessagePage, _expediteur, repondre) => {
    const id = crypto.randomUUID();
    const attente = setTimeout(() => {
      window.removeEventListener('message', ecouter);
      repondre({ ok: false, erreur: 'La page ne répond pas. Rechargez-la.' });
    }, 5000);
    function ecouter(evenement: MessageEvent) {
      const d = evenement.data as {
        type?: string;
        id?: string;
        resultat?: unknown;
      } | null;
      if (evenement.source !== window || d?.type !== REPONSE || d.id !== id)
        return;
      clearTimeout(attente);
      window.removeEventListener('message', ecouter);
      repondre(d.resultat);
    }
    window.addEventListener('message', ecouter);
    window.postMessage({ type: DEMANDE, id, message }, '*');
    return true; // réponse asynchrone
  },
);
