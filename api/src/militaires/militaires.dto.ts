import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { versLatin } from '../common/texte.js';
import { EstEmail, EstTelephone, Nettoyer } from '../common/validation.js';
import { Sexe } from '../generated/prisma/enums.js';

/** Nom et prénoms comme dans le passeport : majuscules latines sans accent. */
const Latin = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? versLatin(value) : value,
  );

export class CreationMilitaireDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? versLatin(value).replace(/\s/g, '') : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Le matricule est obligatoire.' })
  @MaxLength(30)
  matricule: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(50)
  grade?: string;

  @Latin()
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(100)
  nom: string;

  @Latin()
  @IsString()
  @IsNotEmpty({ message: 'Les prénoms sont obligatoires.' })
  @MaxLength(150)
  prenoms: string;

  @IsOptional()
  @IsEnum(Sexe)
  sexe?: Sexe;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Date de naissance invalide.' })
  dateNaissance?: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  unite?: string;

  @IsOptional()
  @EstTelephone()
  telephone?: string;

  @IsOptional()
  @EstEmail()
  email?: string;
}

export class ModificationMilitaireDto extends PartialType(
  CreationMilitaireDto,
) {}

export class RechercheMilitairesDto extends PaginationDto {
  /** Matricule, nom ou prénoms. */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Exclut les militaires déjà dans cette campagne (ajout de dossiers). */
  @IsOptional()
  @IsUUID()
  horsCampagne?: string;
}

export class ImportMilitairesDto {
  /** « oui » : analyse le fichier sans rien enregistrer. */
  @IsOptional()
  @IsIn(['oui', 'non'])
  simulation?: 'oui' | 'non';

  /** Crée aussi un dossier dans cette campagne pour chaque militaire du fichier. */
  @IsOptional()
  @IsUUID()
  campagneId?: string;
}
