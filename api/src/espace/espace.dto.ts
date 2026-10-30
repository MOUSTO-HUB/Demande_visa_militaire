import { IsIn, IsObject, IsString, Matches } from 'class-validator';
import { CanalMessage } from '../generated/prisma/enums.js';
import { CODES_PIECES, type CodePiece } from '../referentiel/pieces.js';

export class LienDto {
  /** Jeton du lien personnel (partie finale de l'adresse). */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{20,64}$/, { message: 'Lien invalide.' })
  jeton: string;
}

export class DemandeCodeDto extends LienDto {
  @IsIn(Object.values(CanalMessage), { message: 'Moyen de contact inconnu.' })
  canal: CanalMessage;
}

export class ConnexionEspaceDto extends LienDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code a 6 chiffres.' })
  code: string;
}

export class ReponsesEspaceDto {
  /** { idDuChamp: valeur } ; une seule réponse pour l'enregistrement au fil de la saisie. */
  @IsObject()
  valeurs: Record<string, unknown>;
}

export class PieceEspaceDto {
  @IsIn(CODES_PIECES, { message: 'Type de pièce inconnu.' })
  type: CodePiece;
}

export class MessageManuelDto {
  @IsIn(['RAPPEL_FICHE', 'CONVOCATION_DEPOT'], {
    message: 'Message inconnu.',
  })
  type: 'RAPPEL_FICHE' | 'CONVOCATION_DEPOT';
}
