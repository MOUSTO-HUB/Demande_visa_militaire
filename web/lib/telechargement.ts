import 'server-only';
import { appelApi, ErreurApi } from './api';

/** Relaie un fichier produit par l'API (export, modèle) au navigateur. */
export async function relayerFichier(chemin: string): Promise<Response> {
  try {
    const reponse = await appelApi(chemin);
    const entetes = new Headers();
    for (const nom of ['content-type', 'content-disposition']) {
      const valeur = reponse.headers.get(nom);
      if (valeur) entetes.set(nom, valeur);
    }
    return new Response(reponse.body, { status: 200, headers: entetes });
  } catch (e) {
    if (e instanceof ErreurApi) {
      return new Response(e.message, {
        status: e.statut,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    throw e;
  }
}
