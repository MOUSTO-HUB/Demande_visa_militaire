import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  CreationUtilisateurDto,
  ModificationUtilisateurDto,
} from './utilisateurs.dto.js';
import { UtilisateursService } from './utilisateurs.service.js';

@ApiTags('Comptes')
@ApiBearerAuth()
@Controller('utilisateurs')
export class UtilisateursController {
  constructor(private readonly service: UtilisateursService) {}

  @Roles(Role.ADMIN)
  @Get()
  lister() {
    return this.service.lister();
  }

  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @Get('operateurs')
  operateurs() {
    return this.service.operateurs();
  }

  @Roles(Role.ADMIN)
  @Post()
  creer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Body() dto: CreationUtilisateurDto,
  ) {
    return this.service.creer(u, dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModificationUtilisateurDto,
  ) {
    return this.service.modifier(u, id, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reinitialisation')
  reinitialiser(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.reinitialiser(u, id);
  }
}
