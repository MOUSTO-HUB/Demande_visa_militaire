import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { lireMrz } from './mrz.js';

export class TexteMrzDto {
  /** Les deux lignes en bas de la page d'identité du passeport. */
  @IsString()
  @MinLength(80, { message: 'Saisissez les deux lignes complètes de la MRZ.' })
  @MaxLength(400)
  texte: string;
}

export const MESSAGE_MRZ_ILLISIBLE =
  'MRZ illisible : il faut deux lignes de 44 caractères, la première commençant par « P< ».';

@ApiTags('Passeport')
@ApiBearerAuth()
@Controller('mrz')
export class MrzController {
  /** Analyse seule, sans rien enregistrer (aperçu avant application à un dossier). */
  @Roles(Role.ADMIN, Role.GESTIONNAIRE, Role.OPERATEUR)
  @Post('analyse')
  @HttpCode(200)
  analyser(@Body() dto: TexteMrzDto) {
    const resultat = lireMrz(dto.texte);
    if (!resultat)
      throw new UnprocessableEntityException(MESSAGE_MRZ_ILLISIBLE);
    return resultat;
  }
}
