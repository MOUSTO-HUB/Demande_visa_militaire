import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  CreationMilitaireDto,
  ImportMilitairesDto,
  ModificationMilitaireDto,
  RechercheMilitairesDto,
} from './militaires.dto.js';
import { MilitairesService } from './militaires.service.js';

const GESTION = [Role.ADMIN, Role.GESTIONNAIRE];
const TOUS = [Role.ADMIN, Role.GESTIONNAIRE, Role.OPERATEUR, Role.LECTEUR];

@ApiTags('Militaires')
@ApiBearerAuth()
@Controller('militaires')
export class MilitairesController {
  constructor(private readonly service: MilitairesService) {}

  @Roles(...TOUS)
  @Get()
  lister(@Query() { q, horsCampagne, ...p }: RechercheMilitairesDto) {
    return this.service.lister({ q, horsCampagne }, p);
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
    @Body() dto: CreationMilitaireDto,
  ) {
    return this.service.creer(u, dto);
  }

  @Roles(...GESTION)
  @Patch(':id')
  modifier(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModificationMilitaireDto,
  ) {
    return this.service.modifier(u, id, dto);
  }

  /** Fichier Excel (.xlsx) ou CSV de la DGRECM ; champ « fichier », 5 Mo au plus. */
  @Roles(...GESTION)
  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('fichier', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  importer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @UploadedFile() fichier: Express.Multer.File | undefined,
    @Body() dto: ImportMilitairesDto,
  ) {
    if (!fichier) throw new BadRequestException('Choisissez un fichier.');
    return this.service.importer(u, fichier, {
      simulation: dto.simulation !== 'non',
      campagneId: dto.campagneId,
    });
  }
}
