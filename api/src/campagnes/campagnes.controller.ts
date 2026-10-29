import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  AjoutDossiersDto,
  CreationCampagneDto,
  ModificationCampagneDto,
  ValeursCommunesDto,
} from './campagnes.dto.js';
import { CampagnesService } from './campagnes.service.js';

const GESTION = [Role.ADMIN, Role.GESTIONNAIRE];
const TOUS = [Role.ADMIN, Role.GESTIONNAIRE, Role.OPERATEUR, Role.LECTEUR];

@ApiTags('Campagnes')
@ApiBearerAuth()
@Controller('campagnes')
export class CampagnesController {
  constructor(private readonly service: CampagnesService) {}

  @Roles(...TOUS)
  @Get()
  lister() {
    return this.service.lister();
  }

  @Roles(...TOUS)
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }

  @Roles(...GESTION)
  @Post()
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreationCampagneDto,
  ) {
    return this.service.creer(u, dto);
  }

  @Roles(...GESTION)
  @Patch(':id')
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModificationCampagneDto,
  ) {
    return this.service.modifier(u, id, dto);
  }

  @Roles(...GESTION)
  @Put(':id/valeurs-communes')
  valeursCommunes(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValeursCommunesDto,
  ) {
    return this.service.definirValeursCommunes(u, id, dto.valeurs);
  }

  @Roles(...GESTION)
  @Post(':id/cloture')
  @HttpCode(200)
  cloturer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cloturer(u, id);
  }

  @Roles(...GESTION)
  @Post(':id/dossiers')
  ajouterDossiers(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AjoutDossiersDto,
  ) {
    return this.service.ajouterDossiers(u, id, dto.militaireIds);
  }

  @Roles(Role.ADMIN, Role.GESTIONNAIRE, Role.LECTEUR)
  @Get(':id/export')
  async exporter(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return new StreamableFile(await this.service.exporter(u, id), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="dossiers.xlsx"',
    });
  }

  /** Efface les fichiers des pièces d'une campagne close. */
  @Roles(Role.ADMIN)
  @Post(':id/purge-pieces')
  @HttpCode(200)
  purgerPieces(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.purgerPieces(u, id);
  }
}
