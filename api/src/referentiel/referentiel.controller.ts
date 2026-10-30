import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LIBELLES_STATUT } from '../dossiers/statuts.regles.js';
import { CHAMPS, SECTIONS } from './champs.js';
import { MOIS_VALIDITE_PASSEPORT } from './donnees.js';
import { ParametresService } from '../parametres/parametres.service.js';
import { PIECES } from './pieces.js';

@ApiTags('Référentiel')
@ApiBearerAuth()
@Controller('referentiel')
export class ReferentielController {
  constructor(private readonly parametres: ParametresService) {}

  /** Tout utilisateur connecté : dictionnaire des champs, pièces et statuts (formulaires du site). */
  @Get()
  async lire() {
    return {
      sections: SECTIONS,
      champs: CHAMPS,
      pieces: PIECES,
      exigences: await this.parametres.toutes(),
      statuts: LIBELLES_STATUT,
      moisValiditePasseport: MOIS_VALIDITE_PASSEPORT,
    };
  }
}
