import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { AccesService } from './acces.service.js';
import { MessageManuelDto } from './espace.dto.js';

const GESTION = [Role.ADMIN, Role.GESTIONNAIRE];
const AGENTS = [...GESTION, Role.OPERATEUR];

/** Liens d'accès des militaires et messages, côté DGRECM. */
@ApiTags('Espace du militaire')
@ApiBearerAuth()
@Controller()
export class AccesController {
  constructor(private readonly acces: AccesService) {}

  /** Crée ou renouvelle le lien personnel et l'envoie ; le lien est aussi rendu à l'agent. */
  @Roles(...GESTION)
  @Post('dossiers/:id/acces')
  creerLien(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.acces.creerLien(u, id);
  }

  /** Liens pour tous les dossiers « à compléter » de la campagne qui n'en ont pas. */
  @Roles(...GESTION)
  @Post('campagnes/:id/acces')
  creerLiensCampagne(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.acces.creerLiensCampagne(u, id);
  }

  /** État du lien (jamais le lien lui-même) et messages envoyés au militaire. */
  @Roles(...AGENTS)
  @Get('dossiers/:id/messages')
  etat(@Param('id', ParseUUIDPipe) id: string) {
    return this.acces.etat(id);
  }

  /** Relance (fiche à compléter) ou convocation au dépôt. */
  @Roles(...GESTION)
  @Post('dossiers/:id/messages')
  envoyer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MessageManuelDto,
  ) {
    return this.acces.envoyerMessage(u, id, dto.type);
  }
}
