import type { ExigencePhoto, ExigenceScan } from '../referentiel/pieces.js';

/**
 * Exigences de format des pièces (cahier des charges, F5 et F8.2) : contrôle
 * des valeurs saisies par l'ADMIN, et conformité d'une pièce déposée.
 */

export interface Exigences {
  photo: ExigencePhoto;
  scan: ExigenceScan;
}

/** Valeurs incohérentes (le format est déjà vérifié par le DTO). */
export function incoherences(e: Exigences): string[] {
  const erreurs: string[] = [];
  if (e.photo.poidsMinKo >= e.photo.poidsMaxKo)
    erreurs.push(
      'Photo : le poids minimal doit être inférieur au poids maximal.',
    );
  const rapport = e.photo.largeur / e.photo.hauteur;
  if (rapport < 0.5 || rapport > 1.5)
    erreurs.push(
      'Photo : rapport largeur / hauteur improbable (vérifiez les dimensions).',
    );
  return erreurs;
}

export interface PieceDeposee {
  type: string;
  typeMime: string;
  /** Octets. */
  taille: number;
  largeur: number | null;
  hauteur: number | null;
}

export interface Conformite {
  conforme: boolean;
  /** Ce qui ne va pas, en clair (vide si conforme). */
  raisons: string[];
}

const ko = (octets: number) => Math.round(octets / 1024);

/**
 * La pièce, telle que préparée et enregistrée, respecte-t-elle les exigences
 * actuelles du site ? (Elles ont pu changer depuis son dépôt.)
 */
export function conformite(p: PieceDeposee, e: Exigences): Conformite {
  const raisons: string[] = [];
  if (p.type === 'PHOTO') {
    if (p.largeur !== e.photo.largeur || p.hauteur !== e.photo.hauteur)
      raisons.push(
        `${p.largeur ?? '?'}×${p.hauteur ?? '?'} pixels au lieu de ${e.photo.largeur}×${e.photo.hauteur}`,
      );
    if (ko(p.taille) < e.photo.poidsMinKo)
      raisons.push(
        `${ko(p.taille)} Ko, moins que le minimum de ${e.photo.poidsMinKo} Ko`,
      );
    if (ko(p.taille) > e.photo.poidsMaxKo)
      raisons.push(
        `${ko(p.taille)} Ko, plus que le maximum de ${e.photo.poidsMaxKo} Ko`,
      );
    if (p.typeMime !== 'image/jpeg') raisons.push('la photo doit être en JPEG');
  } else {
    if (p.typeMime === 'application/pdf' && !e.scan.pdfAccepte)
      raisons.push('PDF refusé par ce site : déposer une image');
    if (
      p.largeur &&
      p.hauteur &&
      Math.max(p.largeur, p.hauteur) > e.scan.coteMax
    )
      raisons.push(
        `${Math.max(p.largeur, p.hauteur)} pixels de côté, plus que ${e.scan.coteMax}`,
      );
    if (ko(p.taille) > e.scan.poidsMaxKo)
      raisons.push(
        `${ko(p.taille)} Ko, plus que le maximum de ${e.scan.poidsMaxKo} Ko`,
      );
  }
  return { conforme: raisons.length === 0, raisons };
}
