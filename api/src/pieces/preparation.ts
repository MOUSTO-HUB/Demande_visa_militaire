import sharp, { type Sharp } from 'sharp';
import type { ExigencePhoto, ExigenceScan } from '../referentiel/pieces.js';

export type TypeFichier =
  'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

/** Reconnaît le format réel d'un fichier à ses premiers octets (pas à son nom). */
export function typeFichier(contenu: Buffer): TypeFichier | null {
  if (contenu.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return 'image/jpeg';
  if (
    contenu
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (
    contenu.subarray(0, 4).toString('latin1') === 'RIFF' &&
    contenu.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp';
  if (contenu.subarray(0, 5).toString('latin1') === '%PDF-')
    return 'application/pdf';
  return null;
}

export interface FichierPrepare {
  contenu: Buffer;
  type: 'image/jpeg' | 'application/pdf';
  largeur: number | null;
  hauteur: number | null;
  avertissements: string[];
}

export class ErreurPreparation extends Error {}

const Ko = 1024;

/** JPEG le plus net (donc le plus lourd) possible sous `maxKo`, qualité décroissante. */
async function jpegSous(
  image: Sharp,
  maxKo: number,
  { depuis = 92, pas = 6 } = {},
): Promise<Buffer | null> {
  for (let qualite = depuis; qualite >= 40; qualite -= pas) {
    const sortie = await image
      .clone()
      .jpeg({ quality: qualite, mozjpeg: true })
      .toBuffer();
    if (sortie.length <= maxKo * Ko) return sortie;
  }
  return null;
}

/**
 * Photo d'identité aux dimensions exactes du site (recadrage centré sur le
 * visage par l'algorithme « attention » de sharp), fond blanc, JPEG sous le poids maximal.
 */
export async function preparerPhoto(
  source: Buffer,
  exigence: ExigencePhoto,
): Promise<FichierPrepare> {
  const type = typeFichier(source);
  if (!type || type === 'application/pdf')
    throw new ErreurPreparation(
      'La photo doit être une image JPEG, PNG ou WebP.',
    );
  const orientee = sharp(source, { failOn: 'error' }).rotate();
  const meta = await sharp(source).metadata();
  // Orientation EXIF 5 à 8 : la photo est tournée d'un quart de tour.
  const tournee = (meta.orientation ?? 1) >= 5;
  const width = (tournee ? meta.height : meta.width) ?? 0;
  const height = (tournee ? meta.width : meta.height) ?? 0;
  const avertissements: string[] = [];
  if (width < exigence.largeur || height < exigence.hauteur)
    avertissements.push(
      `Photo de faible résolution (${width}×${height}) : elle a été agrandie, la netteté peut être insuffisante.`,
    );
  const image = orientee
    .resize(exigence.largeur, exigence.hauteur, {
      fit: 'cover',
      position: sharp.strategy.attention,
    })
    .flatten({ background: '#ffffff' });
  // Pas fin depuis la qualité maximale : certains sites refusent aussi une photo
  // trop légère, on garde donc la plus lourde qui respecte le maximum.
  const contenu = await jpegSous(image, exigence.poidsMaxKo, {
    depuis: 100,
    pas: 2,
  });
  if (!contenu)
    throw new ErreurPreparation(
      `Impossible de faire tenir la photo sous ${exigence.poidsMaxKo} Ko.`,
    );
  if (contenu.length < exigence.poidsMinKo * Ko)
    avertissements.push(
      `La photo pèse ${Math.round(contenu.length / Ko)} Ko, moins que le minimum de ${exigence.poidsMinKo} Ko du site : utilisez une photo plus détaillée.`,
    );
  return {
    contenu,
    type: 'image/jpeg',
    largeur: exigence.largeur,
    hauteur: exigence.hauteur,
    avertissements,
  };
}

/**
 * Document scanné ou photographié : redressé, réduit et compressé en JPEG
 * sous le poids accepté par le site. Un PDF est gardé tel quel s'il est accepté.
 */
export async function preparerScan(
  source: Buffer,
  exigence: ExigenceScan,
): Promise<FichierPrepare> {
  const type = typeFichier(source);
  if (!type)
    throw new ErreurPreparation(
      'Format non reconnu : envoyez une image (JPEG, PNG, WebP) ou un PDF.',
    );
  if (type === 'application/pdf') {
    if (!exigence.pdfAccepte)
      throw new ErreurPreparation(
        "Le site officiel n'accepte pas les PDF pour ce pays : envoyez une photo ou un scan en image.",
      );
    if (source.length > exigence.poidsMaxKo * Ko)
      throw new ErreurPreparation(
        `Le PDF pèse ${Math.round(source.length / Ko)} Ko : ${exigence.poidsMaxKo} Ko au plus. Rescannez-le en résolution plus basse.`,
      );
    return {
      contenu: source,
      type,
      largeur: null,
      hauteur: null,
      avertissements: [],
    };
  }
  for (
    let cote = exigence.coteMax;
    cote >= 600;
    cote = Math.round(cote * 0.8)
  ) {
    const image = sharp(source, { failOn: 'error' })
      .rotate()
      .resize(cote, cote, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' });
    const contenu = await jpegSous(image, exigence.poidsMaxKo);
    if (contenu) {
      const { width, height } = await sharp(contenu).metadata();
      return {
        contenu,
        type: 'image/jpeg',
        largeur: width ?? null,
        hauteur: height ?? null,
        avertissements: [],
      };
    }
  }
  throw new ErreurPreparation(
    `Impossible de faire tenir le document sous ${exigence.poidsMaxKo} Ko.`,
  );
}
