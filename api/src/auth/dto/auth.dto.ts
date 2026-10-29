import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { EstEmail } from '../../common/validation.js';

/** 6 chiffres de l'application, ou code de secours (« k7pm-x3qa »). */
const REGEX_CODE = /^\s*(\d{6}|[A-Za-z0-9]{4}[\s-]?[A-Za-z0-9]{4})\s*$/;

export class VerificationDoubleAuthDto {
  /** Jeton d'étape renvoyé par /auth/connexion. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  jeton: string;

  @IsString()
  @Matches(REGEX_CODE, {
    message: 'Saisissez le code à 6 chiffres (ou un code de secours).',
  })
  code: string;
}

export class ConfirmationMotDePasseDto {
  @IsString()
  @IsNotEmpty({ message: 'Saisissez votre mot de passe.' })
  @MaxLength(200)
  motDePasse: string;
}

export class ActivationDoubleAuthDto {
  /** Jeton de préparation (15 minutes) contenant la clé chiffrée. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  jeton: string;

  @Matches(/^\d{6}$/, { message: 'Le code contient 6 chiffres.' })
  code: string;
}

export class ConnexionDto {
  @EstEmail()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MaxLength(200)
  motDePasse: string;
}

export class RafraichissementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  jetonRafraichissement: string;
}

export class ChangementMotDePasseDto {
  @IsString()
  @IsNotEmpty({ message: 'Saisissez votre mot de passe actuel.' })
  @MaxLength(200)
  actuel: string;

  @IsString()
  @MaxLength(200)
  nouveau: string;
}
