import { PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Nettoyer } from '../common/validation.js';
import { PaysAccueil } from '../generated/prisma/enums.js';
import { CODES_PIECES } from '../referentiel/pieces.js';

export class CreationCampagneDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le libellé est obligatoire.' })
  @MaxLength(150)
  libelle: string;

  @IsEnum(PaysAccueil, { message: 'Pays inconnu.' })
  pays: PaysAccueil;

  @IsInt()
  @Min(2020)
  @Max(2100)
  annee: number;

  /** Ex. « X1 » (Chine), « Visa d'études » (Russie). */
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le type de visa est obligatoire.' })
  @MaxLength(50)
  typeVisa: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(200)
  referenceAccord?: string;

  /** Pièces demandées ; vide : celles exigées par le pays. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(CODES_PIECES, { each: true, message: 'Pièce inconnue.' })
  piecesExigees?: string[];
}

export class ModificationCampagneDto extends PartialType(CreationCampagneDto) {}

export class ValeursCommunesDto {
  /** { idDuChamp: valeur } ; null ou "" efface la valeur commune. */
  @IsObject()
  valeurs: Record<string, string | null>;
}

export class AjoutDossiersDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  militaireIds: string[];
}
