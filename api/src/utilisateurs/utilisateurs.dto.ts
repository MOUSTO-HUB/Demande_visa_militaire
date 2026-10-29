import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstEmail, Nettoyer } from '../common/validation.js';
import { Role } from '../generated/prisma/enums.js';

export class CreationUtilisateurDto {
  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Les prénoms sont obligatoires.' })
  @MaxLength(100)
  prenoms: string;

  @Nettoyer()
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(100)
  nom: string;

  @EstEmail()
  email: string;

  @IsEnum(Role, { message: 'Rôle inconnu.' })
  role: Role;
}

export class ModificationUtilisateurDto {
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  prenoms?: string;

  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  nom?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Rôle inconnu.' })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
