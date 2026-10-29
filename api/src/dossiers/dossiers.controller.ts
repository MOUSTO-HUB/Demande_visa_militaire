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
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { TexteMrzDto } from '../mrz/mrz.controller.js';
import {
  AttributionDto,
  ChangementStatutDto,
  DonneesDossierDto,
  RechercheDossiersDto,
} from './dossiers.dto.js';
import { DossiersService } from './dossiers.service.js';

const AGENTS = [Role.ADMIN, Role.GESTIONNAIRE, Role.OPERATEUR];
const TOUS = [...AGENTS, Role.LECTEUR];

@ApiTags('Dossiers')
@ApiBearerAuth()
@Controller('dossiers')
export class DossiersController {
  constructor(private readonly service: DossiersService) {}

  @Roles(...TOUS)
  @Get()
  lister(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Query() { campagneId, statut, operateur, q, ...p }: RechercheDossiersDto,
  ) {
    return this.service.lister(u, { campagneId, statut, operateur, q }, p);
  }

  /** Réponses effectives, anomalies, pièces, historique et statuts possibles. */
  @Roles(...TOUS)
  @Get(':id')
  detail(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(u, id);
  }

  @Roles(...AGENTS)
  @Put(':id/donnees')
  modifierDonnees(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DonneesDossierDto,
  ) {
    return this.service.modifierDonnees(u, id, dto.valeurs);
  }

  /** Lit la MRZ du passeport et remplit identité et passeport. */
  @Roles(...AGENTS)
  @Post(':id/mrz')
  @HttpCode(200)
  appliquerMrz(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TexteMrzDto,
  ) {
    return this.service.appliquerMrz(u, id, dto.texte);
  }

  /** Les règles de passage sont dans statuts.regles.ts (rôle vérifié par transition). */
  @Roles(...AGENTS)
  @Post(':id/statut')
  @HttpCode(200)
  changerStatut(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangementStatutDto,
  ) {
    return this.service.changerStatut(u, id, dto);
  }

  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @Patch(':id/attribution')
  attribuer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttributionDto,
  ) {
    return this.service.attribuer(u, id, dto.operateurId);
  }

  @Roles(...TOUS)
  @Get(':id/fiche')
  async fiche(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return new StreamableFile(await this.service.fiche(u, id), {
      type: 'application/pdf',
      disposition: 'inline; filename="fiche-dossier.pdf"',
    });
  }
}
