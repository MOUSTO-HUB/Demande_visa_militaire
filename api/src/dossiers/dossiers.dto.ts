import {
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.js';
import { Nettoyer } from '../common/validation.js';
import { StatutDossier } from '../generated/prisma/enums.js';

export class RechercheDossiersDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  campagneId?: string;

  @IsOptional()
  @IsEnum(StatutDossier)
  statut?: StatutDossier;

  /** Id d'un agent, ou « moi » pour ses propres dossiers. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  operateur?: string;

  /** Matricule, nom ou prénoms du militaire. */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class DonneesDossierDto {
  /** { idDuChamp: valeur } ; null ou "" efface la réponse. */
  @IsObject()
  valeurs: Record<string, string | null>;
}

export class ChangementStatutDto {
  @IsEnum(StatutDossier, { message: 'Statut inconnu.' })
  statut: StatutDossier;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;

  /** Numéro attribué par le site officiel (passage à « Soumis »). */
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(60)
  numeroDemande?: string;

  /** Date et heure du rendez-vous à l'ambassade. */
  @IsOptional()
  @IsISO8601({}, { message: 'Date de rendez-vous invalide.' })
  dateRendezVous?: string;
}

export class AttributionDto {
  /** null : retire l'attribution. */
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  operateurId: string | null;
}
