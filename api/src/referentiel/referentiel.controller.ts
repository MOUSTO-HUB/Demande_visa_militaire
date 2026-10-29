import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LIBELLES_STATUT } from '../dossiers/statuts.regles.js';
import { CHAMPS, SECTIONS } from './champs.js';
import { MOIS_VALIDITE_PASSEPORT } from './donnees.js';
import { EXIGENCES, PIECES } from './pieces.js';

@ApiTags('Référentiel')
@ApiBearerAuth()
@Controller('referentiel')
export class ReferentielController {
  /** Tout utilisateur connecté : dictionnaire des champs, pièces et statuts (formulaires du site). */
  @Get()
  lire() {
    return {
      sections: SECTIONS,
      champs: CHAMPS,
      pieces: PIECES,
      exigences: EXIGENCES,
      statuts: LIBELLES_STATUT,
      moisValiditePasseport: MOIS_VALIDITE_PASSEPORT,
    };
  }
}
