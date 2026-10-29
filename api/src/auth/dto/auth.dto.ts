import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { EstEmail } from '../../common/validation.js';

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
