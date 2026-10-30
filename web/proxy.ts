import { NextResponse, type NextRequest } from 'next/server';
import {
  API_URL,
  COOKIE_ACCES,
  COOKIE_RAFRAICHISSEMENT,
  DUREE_ACCES_S,
  DUREE_RAFRAICHISSEMENT_S,
  expirationJeton,
  optionsCookie,
  type Session,
} from './lib/session';

const MARGE_MS = 60 * 1000;

/**
 * Vérification optimiste de la session et renouvellement du jeton d'accès.
 * La vraie vérification des droits reste faite par l'API à chaque appel.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const surConnexion = pathname === '/connexion';
  const acces = request.cookies.get(COOKIE_ACCES)?.value;
  const rafraichissement = request.cookies.get(COOKIE_RAFRAICHISSEMENT)?.value;

  // Chemin de la page, lu par le gabarit (redirection vers « Mon compte »).
  const suivante = () => {
    const entetes = new Headers(request.headers);
    entetes.set('x-chemin', pathname);
    return NextResponse.next({ request: { headers: entetes } });
  };

  const expiration = acces ? expirationJeton(acces) : null;
  if (expiration && expiration - Date.now() > MARGE_MS) {
    return surConnexion
      ? NextResponse.redirect(new URL('/', request.url))
      : suivante();
  }

  if (rafraichissement) {
    const session = await rafraichir(rafraichissement);
    if (session) {
      // Les nouveaux jetons servent dès cette requête (côté serveur) et sont renvoyés au navigateur.
      request.cookies.set(COOKIE_ACCES, session.jetonAcces);
      request.cookies.set(
        COOKIE_RAFRAICHISSEMENT,
        session.jetonRafraichissement,
      );
      const reponse = surConnexion
        ? NextResponse.redirect(new URL('/', request.url))
        : suivante();
      reponse.cookies.set(
        COOKIE_ACCES,
        session.jetonAcces,
        optionsCookie(DUREE_ACCES_S),
      );
      reponse.cookies.set(
        COOKIE_RAFRAICHISSEMENT,
        session.jetonRafraichissement,
        optionsCookie(DUREE_RAFRAICHISSEMENT_S),
      );
      return reponse;
    }
  }

  if (surConnexion) return NextResponse.next();
  const connexion = new URL('/connexion', request.url);
  connexion.searchParams.set('suite', pathname + search);
  const reponse = NextResponse.redirect(connexion);
  reponse.cookies.delete(COOKIE_ACCES);
  reponse.cookies.delete(COOKIE_RAFRAICHISSEMENT);
  return reponse;
}

async function rafraichir(jeton: string): Promise<Session | null> {
  try {
    const reponse = await fetch(`${API_URL}/auth/rafraichir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jetonRafraichissement: jeton }),
      cache: 'no-store',
    });
    return reponse.ok ? ((await reponse.json()) as Session) : null;
  } catch {
    return null;
  }
}

export const config = {
  // Tout sauf les fichiers statiques de Next, les images, le moteur de lecture
  // du passeport et l'espace du militaire (lien /m/…, pages /espace : sa propre session).
  matcher: [
    '/((?!_next/static|_next/image|ocr/|m/|espace(?:/|$)|.*\\.(?:png|svg|ico)$).*)',
  ],
};
