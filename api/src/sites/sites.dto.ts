import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ModeCorrespondance } from '../generated/prisma/enums.js';

export const TYPES_CHAMP_SITE = [
  'texte',
  'liste',
  'date',
  'choix',
  'case',
  'cascade',
  'nombre',
] as const;

export class OptionSiteDto {
  @IsString()
  @MaxLength(300)
  valeur: string;

  @IsString()
  @MaxLength(300)
  libelle: string;
}

export class ChampReleveDto {
  /** Propriété du formulaire (Vue) ou, à défaut, « libelle:… ». */
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  cle: string;

  @IsString()
  @MaxLength(300)
  libelle: string;

  @IsIn(TYPES_CHAMP_SITE)
  type: (typeof TYPES_CHAMP_SITE)[number];

  @IsBoolean()
  obligatoire: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => OptionSiteDto)
  options?: OptionSiteDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  formatDate?: string;
}

export class ReleveDto {
  /** Adresse de la page sans paramètres, ex. « /VISA/apply/personal ». */
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  page: string;

  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => ChampReleveDto)
  champs: ChampReleveDto[];
}

export class CorrespondanceDto {
  @IsOptional()
  @IsEnum(ModeCorrespondance)
  mode?: ModeCorrespondance;

  /** Champ du dictionnaire (mode CHAMP) ; null pour retirer. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(60)
  champId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  valeurFixe?: string | null;

  /** Valeur du dossier → valeur du site. */
  @IsOptional()
  @IsObject()
  conversions?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  remplir?: boolean;
}

export class RemplissageDto {
  @IsUUID()
  dossierId: string;

  @IsString()
  @MaxLength(300)
  page: string;

  @IsInt()
  @Min(0)
  remplis: number;

  /** Clés des champs obligatoires restés vides (à saisir par l'agent). */
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  manquants: string[];
}
