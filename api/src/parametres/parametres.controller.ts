import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min, ValidateNested } from 'class-validator';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { PaysAccueil, Role } from '../generated/prisma/enums.js';
import { ParametresService } from './parametres.service.js';

class ExigencePhotoDto {
  @IsInt()
  @Min(100)
  @Max(3000)
  largeur: number;

  @IsInt()
  @Min(100)
  @Max(3000)
  hauteur: number;

  @IsInt()
  @Min(0)
  @Max(10240)
  poidsMinKo: number;

  @IsInt()
  @Min(10)
  @Max(10240)
  poidsMaxKo: number;
}

class ExigenceScanDto {
  /** Plus grand côté, en pixels, après réduction. */
  @IsInt()
  @Min(500)
  @Max(6000)
  coteMax: number;

  @IsInt()
  @Min(50)
  @Max(10240)
  poidsMaxKo: number;

  @IsBoolean()
  pdfAccepte: boolean;
}

export class ExigencesDto {
  @ValidateNested()
  @Type(() => ExigencePhotoDto)
  photo: ExigencePhotoDto;

  @ValidateNested()
  @Type(() => ExigenceScanDto)
  scan: ExigenceScanDto;
}

const pays = new ParseEnumPipe(PaysAccueil, {
  exceptionFactory: () => new BadRequestException('Pays inconnu.'),
});

/** Paramètres des sites officiels (cahier des charges, F8.2). */
@ApiTags('Paramètres')
@ApiBearerAuth()
@Controller('parametres')
export class ParametresController {
  constructor(private readonly parametres: ParametresService) {}

  /** Exigences de format des pièces, par pays (« personnalisees » : réglées par l'ADMIN). */
  @Roles(Role.ADMIN, Role.GESTIONNAIRE, Role.OPERATEUR, Role.LECTEUR)
  @Get('exigences')
  lire() {
    return this.parametres.toutes();
  }

  /** Nouvelles exigences d'un site (photo et scans), quand il les change. */
  @Roles(Role.ADMIN)
  @Put('exigences/:pays')
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('pays', pays) p: PaysAccueil,
    @Body() dto: ExigencesDto,
  ) {
    return this.parametres.modifier(u, p, dto);
  }

  /** Retour aux valeurs d'origine. */
  @Roles(Role.ADMIN)
  @Delete('exigences/:pays')
  retablir(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('pays', pays) p: PaysAccueil,
  ) {
    return this.parametres.retablir(u, p);
  }
}
