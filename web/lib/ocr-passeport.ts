/**
 * Lecture de la MRZ sur une photo du passeport, dans le navigateur
 * (Tesseract.js servi par le site dans /ocr) : l'image ne quitte pas le poste,
 * seul le texte reconnu est ensuite analysé par l'API.
 */
import type { Worker } from 'tesseract.js';

/** Caractères possibles dans une MRZ. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
/**
 * Largeur de travail, photo agrandie ou réduite : les caractères de la MRZ
 * font alors une trentaine de pixels, taille où Tesseract lit le mieux.
 */
const LARGEUR = 2000;

let moteur: Promise<Worker> | null = null;

/** Moteur chargé une fois par page (3 Mo de modèle, gardé par le navigateur). */
export function chargerMoteur(
  progres?: (texte: string) => void,
): Promise<Worker> {
  moteur ??= import('tesseract.js').then(({ createWorker, OEM }) =>
    createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr',
      langPath: '/ocr',
      gzip: true,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        if (m.status.startsWith('loading'))
          progres?.(
            `Chargement du moteur de lecture… ${Math.round(m.progress * 100)} %`,
          );
      },
    }).then(async (w) => {
      await w.setParameters({ tessedit_char_whitelist: ALPHABET });
      return w;
    }),
  );
  moteur.catch(() => (moteur = null));
  return moteur;
}

export async function arreterMoteur(): Promise<void> {
  const m = moteur;
  moteur = null;
  if (m) await (await m).terminate();
}

interface Essai {
  libelle: string;
  rotation: 0 | 90 | 180 | 270;
  /** Part du bas de l'image gardée (la MRZ est en bas de la page d'identité). */
  bas: number;
  /** 6 : un bloc de texte ; 11 : texte épars (page entière). */
  mode: '6' | '11';
  /** Largeur de travail en pixels (la lecture varie d'une taille à l'autre). */
  largeur: number;
}

/**
 * Du plus probable au moins probable : photo droite, puis retournée ou de
 * côté ; deux tailles pour les cas les plus courants.
 */
const ESSAIS: Essai[] = [
  {
    libelle: 'bas de la page',
    rotation: 0,
    bas: 0.4,
    mode: '6',
    largeur: LARGEUR,
  },
  {
    libelle: 'bas de la page, plus petit',
    rotation: 0,
    bas: 0.4,
    mode: '6',
    largeur: 1400,
  },
  {
    libelle: 'page entière',
    rotation: 0,
    bas: 1,
    mode: '11',
    largeur: LARGEUR,
  },
  {
    libelle: 'photo retournée',
    rotation: 180,
    bas: 0.4,
    mode: '6',
    largeur: LARGEUR,
  },
  {
    libelle: 'photo retournée, plus petit',
    rotation: 180,
    bas: 0.4,
    mode: '6',
    largeur: 1400,
  },
  {
    libelle: 'photo tournée à droite',
    rotation: 90,
    bas: 0.4,
    mode: '6',
    largeur: LARGEUR,
  },
  {
    libelle: 'photo tournée à gauche',
    rotation: 270,
    bas: 0.4,
    mode: '6',
    largeur: LARGEUR,
  },
];

/**
 * Image préparée pour un essai : tournée, recadrée sur le bas, en niveaux de
 * gris avec le contraste étiré (les fonds guillochés des passeports pâlissent).
 */
function preparer(image: ImageBitmap, essai: Essai): HTMLCanvasElement {
  const deCote = essai.rotation === 90 || essai.rotation === 270;
  const largeur = deCote ? image.height : image.width;
  const hauteur = deCote ? image.width : image.height;
  const echelle = essai.largeur / largeur;
  const tourne = document.createElement('canvas');
  tourne.width = Math.round(largeur * echelle);
  tourne.height = Math.round(hauteur * echelle);
  const ct = tourne.getContext('2d')!;
  ct.translate(tourne.width / 2, tourne.height / 2);
  ct.rotate((essai.rotation * Math.PI) / 180);
  ct.scale(echelle, echelle);
  ct.drawImage(image, -image.width / 2, -image.height / 2);

  const haut = Math.round(tourne.height * (1 - essai.bas));
  const toile = document.createElement('canvas');
  toile.width = tourne.width;
  toile.height = tourne.height - haut;
  const c = toile.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(tourne, 0, -haut);

  const pixels = c.getImageData(0, 0, toile.width, toile.height);
  const d = pixels.data;
  const gris = new Uint8ClampedArray(d.length / 4);
  const histogramme = new Uint32Array(256);
  for (let i = 0; i < gris.length; i++) {
    const g = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
    gris[i] = g;
    histogramme[gris[i]]++;
  }
  // Contraste : les 2 % les plus sombres deviennent noirs, les 2 % les plus clairs blancs.
  const seuil = (part: number) => {
    let cumul = 0;
    for (let v = 0; v < 256; v++) {
      cumul += histogramme[v];
      if (cumul >= gris.length * part) return v;
    }
    return 255;
  };
  const noir = seuil(0.02);
  const blanc = Math.max(noir + 1, seuil(0.98));
  for (let i = 0; i < gris.length; i++) {
    const v = ((gris[i] - noir) * 255) / (blanc - noir);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  c.putImageData(pixels, 0, 0);
  return toile;
}

export interface TentativeOcr {
  libelle: string;
  texte: string;
}

/**
 * Essais successifs sur la photo ; `estValide` (analyse par l'API) arrête la
 * recherche dès qu'une MRZ passe les chiffres de contrôle. Renvoie toutes les
 * tentatives, la dernière étant la bonne si elle a été trouvée.
 */
export async function lireMrzSurPhoto(
  fichier: File,
  estValide: (texte: string) => Promise<boolean>,
  progres: (texte: string) => void,
): Promise<TentativeOcr[]> {
  const image = await createImageBitmap(fichier, {
    imageOrientation: 'from-image',
  });
  const w = await chargerMoteur(progres);
  const tentatives: TentativeOcr[] = [];
  try {
    for (const [n, essai] of ESSAIS.entries()) {
      progres(
        `Lecture (${essai.libelle}, essai ${n + 1} sur ${ESSAIS.length})…`,
      );
      await w.setParameters({
        tessedit_pageseg_mode: essai.mode as never,
      });
      const { data } = await w.recognize(preparer(image, essai));
      tentatives.push({ libelle: essai.libelle, texte: data.text });
      if (await estValide(data.text)) break;
    }
  } finally {
    image.close();
  }
  return tentatives;
}
