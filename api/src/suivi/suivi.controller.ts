import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { SuiviService } from './suivi.service.js';

const TOUS = [Role.ADMIN, Role.GESTIONNAIRE, Role.OPERATEUR, Role.LECTEUR];

@ApiTags('Suivi')
@ApiBearerAuth()
@Controller()
export class SuiviController {
  constructor(private readonly suivi: SuiviService) {}

  /** Tableau de bord d'une campagne : statuts, retards, anomalies, alertes. */
  @Roles(...TOUS)
  @Get('campagnes/:id/suivi')
  campagne(@Param('id', ParseUUIDPipe) id: string) {
    return this.suivi.campagne(id);
  }

  /** Alertes de toutes les campagnes ouvertes. */
  @Roles(...TOUS)
  @Get('alertes')
  alertes() {
    return this.suivi.alertes();
  }
}
