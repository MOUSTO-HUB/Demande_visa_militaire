import type { PaysAccueil } from '../generated/prisma/enums.js';
import {
  CHAMPS,
  SECTIONS,
  type CodeSection,
  type DefinitionChamp,
} from '../referentiel/champs.js';
import {
  PIECES,
  piecesDeCampagne,
  type CodePiece,
} from '../referentiel/pieces.js';

/**
 * Questions posées au militaire dans son espace (cahier des charges, F3.2) :
 * - sa fiche personnelle (identité, passeport, famille, contacts, études,
 *   voyages) et les numéros de ses propres documents (admission, invitation) ;
 * - jamais les réponses communes de la campagne (établissement, dates,
 *   financement…), saisies une fois par la DGRECM ;
 * - jamais les questions sensibles (profession, employeur, déclarations) :
 *   elles relèvent de la DGRECM (principe de sincérité, section 3.3).
 */
export const SECTIONS_DGRECM: CodeSection[] = ['PROFESSION', 'DECLARATIONS'];

export const estPoseAuMilitaire = (c: DefinitionChamp) =>
  !SECTIONS_DGRECM.includes(c.section) &&
  (c.portee === 'MILITAIRE' || !!c.communInterdit);

export const CHAMPS_MILITAIRE = CHAMPS.filter(estPoseAuMilitaire);
export const IDS_CHAMPS_MILITAIRE = new Set(CHAMPS_MILITAIRE.map((c) => c.id));

/** Étapes du formulaire guidé : les sections qui ont au moins une question. */
export const etapes = () =>
  SECTIONS.filter((s) => CHAMPS_MILITAIRE.some((c) => c.section === s.code));

/** Pièces que le militaire peut déposer : celles de la campagne, plus « Autre document ». */
export function piecesDuMilitaire(
  pays: PaysAccueil,
  exigees: string[],
): { code: CodePiece; libelle: string; exigee: boolean }[] {
  const codes = piecesDeCampagne(pays, exigees);
  return [
    ...codes.map((code) => ({
      code,
      libelle: PIECES.find((p) => p.code === code)?.libelle ?? code,
      exigee: true,
    })),
    ...(codes.includes('AUTRE')
      ? []
      : [{ code: 'AUTRE' as const, libelle: 'Autre document', exigee: false }]),
  ];
}
