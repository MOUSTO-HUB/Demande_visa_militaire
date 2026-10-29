import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { PaysAccueil, Role } from '../generated/prisma/enums.js';
import { CorrespondanceDto, ReleveDto, RemplissageDto } from './sites.dto.js';
import { SitesService } from './sites.service.js';

const AGENTS = [Role.ADMIN, Role.GESTIONNAIRE, Role.OPERATEUR];
const GESTION = [Role.ADMIN, Role.GESTIONNAIRE];
const pays = new ParseEnumPipe(PaysAccueil, {
  exceptionFactory: () => new BadRequestException('Pays inconnu.'),
});

/** Champs des formulaires officiels relevés par l'extension, et leurs correspondances. */
@ApiTags('Sites officiels')
@ApiBearerAuth()
@Controller('sites')
export class SitesController {
  constructor(private readonly service: SitesService) {}

  @Roles(...AGENTS)
  @Get(':pays/champs')
  lister(@Param('pays', pays) p: PaysAccueil) {
    return this.service.lister(p);
  }

  /** L'extension envoie les champs de la page affichée (aucune donnée de dossier). */
  @Roles(...AGENTS)
  @Post(':pays/releves')
  @HttpCode(200)
  releve(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('pays', pays) p: PaysAccueil,
    @Body() dto: ReleveDto,
  ) {
    return this.service.releve(u, p, dto);
  }

  @Roles(...AGENTS)
  @Post(':pays/remplissages')
  @HttpCode(204)
  async remplissage(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('pays', pays) p: PaysAccueil,
    @Body() dto: RemplissageDto,
  ): Promise<void> {
    await this.service.remplissage(u, p, dto);
  }

  @Roles(...GESTION)
  @Patch('champs/:id')
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrespondanceDto,
  ) {
    return this.service.modifier(u, id, dto);
  }

  @Roles(...GESTION)
  @Delete('champs/:id')
  @HttpCode(204)
  async supprimer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.supprimer(u, id);
  }
}
