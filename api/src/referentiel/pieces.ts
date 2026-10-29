import { PaysAccueil } from '../generated/prisma/enums.js';

/**
 * Pièces justificatives et exigences de format des sites officiels.
 * Les valeurs sont celles connues à la rédaction : À CONFIRMER lors du relevé
 * de la phase 0, puis à tenir à jour (les sites les changent sans prévenir).
 */

export type CodePiece =
  | 'PHOTO'
  | 'PASSEPORT'
  | 'ADMISSION'
  | 'JW'
  | 'INVITATION'
  | 'DIPLOME'
  | 'ASSURANCE'
  | 'ORDRE_MISSION'
  | 'CERTIFICAT_MEDICAL'
  | 'AUTRE';

export interface DefinitionPiece {
  code: CodePiece;
  libelle: string;
  /** Pays qui l'exigent par défaut (une campagne peut changer la liste). */
  exigeePar: PaysAccueil[];
}

export const PIECES: DefinitionPiece[] = [
  {
    code: 'PHOTO',
    libelle: "Photo d'identité",
    exigeePar: [PaysAccueil.CHINE, PaysAccueil.RUSSIE],
  },
  {
    code: 'PASSEPORT',
    libelle: "Page d'identité du passeport",
    exigeePar: [PaysAccueil.CHINE, PaysAccueil.RUSSIE],
  },
  {
    code: 'ADMISSION',
    libelle: "Lettre d'admission",
    exigeePar: [PaysAccueil.CHINE, PaysAccueil.RUSSIE],
  },
  {
    code: 'JW',
    libelle: 'Formulaire JW201 / JW202',
    exigeePar: [PaysAccueil.CHINE],
  },
  {
    code: 'INVITATION',
    libelle: "Invitation du ministère russe de l'Intérieur",
    exigeePar: [PaysAccueil.RUSSIE],
  },
  { code: 'DIPLOME', libelle: 'Dernier diplôme', exigeePar: [] },
  {
    code: 'ASSURANCE',
    libelle: 'Attestation d’assurance santé',
    exigeePar: [PaysAccueil.RUSSIE],
  },
  { code: 'ORDRE_MISSION', libelle: 'Ordre de mission', exigeePar: [] },
  {
    code: 'CERTIFICAT_MEDICAL',
    libelle: 'Certificat médical',
    exigeePar: [],
  },
  { code: 'AUTRE', libelle: 'Autre document', exigeePar: [] },
];

export const CODES_PIECES = PIECES.map((p) => p.code);

export const estCodePiece = (v: unknown): v is CodePiece =>
  typeof v === 'string' && (CODES_PIECES as string[]).includes(v);

/** Format attendu d'une photo par un site (pixels et poids). */
export interface ExigencePhoto {
  largeur: number;
  hauteur: number;
  poidsMinKo: number;
  poidsMaxKo: number;
}

/** Format attendu des documents scannés. */
export interface ExigenceScan {
  /** Plus grand côté, en pixels, après réduction. */
  coteMax: number;
  poidsMaxKo: number;
  pdfAccepte: boolean;
}

export const EXIGENCES: Record<
  PaysAccueil,
  { photo: ExigencePhoto; scan: ExigenceScan }
> = {
  // COVA : JPEG de 354×472 à 420×560 pixels, 40 à 120 Ko (à confirmer).
  CHINE: {
    photo: { largeur: 354, hauteur: 472, poidsMinKo: 40, poidsMaxKo: 120 },
    scan: { coteMax: 1600, poidsMaxKo: 1024, pdfAccepte: false },
  },
  // kdmid : photo 35×45 mm, soit 413×531 pixels à 300 ppp (à confirmer).
  RUSSIE: {
    photo: { largeur: 413, hauteur: 531, poidsMinKo: 10, poidsMaxKo: 1024 },
    scan: { coteMax: 2000, poidsMaxKo: 2048, pdfAccepte: true },
  },
};

/** Pièces demandées pour une campagne : sa liste, sinon celles du pays. */
export const piecesDeCampagne = (
  pays: PaysAccueil,
  liste: string[],
): CodePiece[] =>
  liste.length
    ? liste.filter(estCodePiece)
    : PIECES.filter((p) => p.exigeePar.includes(pays)).map((p) => p.code);
