import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { MilitaireConnecte } from '../auth/auth.types.js';
import {
  EspaceMilitaire,
  MilitaireCourant,
} from '../auth/decorators/espace-militaire.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Limiteur } from '../securite/limiteur.js';
import { AccesService } from './acces.service.js';
import {
  ConnexionEspaceDto,
  DemandeCodeDto,
  LienDto,
  PieceEspaceDto,
  ReponsesEspaceDto,
} from './espace.dto.js';
import { EspaceService } from './espace.service.js';

/** 30 ouvertures de lien ou essais de code par quart d'heure et par adresse IP. */
const limiteEspace = new Limiteur(30, 15 * 60 * 1000);

/**
 * Espace du militaire : connexion par lien personnel et code, puis sa seule
 * fiche (le dossier vient du jeton, jamais d'un paramètre).
 */
@ApiTags('Espace du militaire')
@Controller('espace')
export class EspaceController {
  constructor(
    private readonly acces: AccesService,
    private readonly espace: EspaceService,
  ) {}

  /** Ouverture du lien : prénom et moyens de recevoir le code (masqués). */
  @Public()
  @Post('acces')
  @HttpCode(200)
  ouvrir(@Body() dto: LienDto, @Ip() ip: string) {
    limiteEspace.verifier(ip);
    return this.acces.ouvrir(dto.jeton);
  }

  /** Envoie un code à 6 chiffres (10 minutes) par email ou SMS. */
  @Public()
  @Post('code')
  @HttpCode(200)
  demanderCode(@Body() dto: DemandeCodeDto, @Ip() ip: string) {
    limiteEspace.verifier(ip);
    return this.acces.demanderCode(dto.jeton, dto.canal);
  }

  /** Code juste : jeton de l'espace, valable 2 heures. */
  @Public()
  @Post('connexion')
  @HttpCode(200)
  connecter(@Body() dto: ConnexionEspaceDto, @Ip() ip: string) {
    limiteEspace.verifier(ip);
    return this.acces.connecter(dto.jeton, dto.code);
  }

  @EspaceMilitaire()
  @ApiBearerAuth()
  @Get('dossier')
  lire(@MilitaireCourant() m: MilitaireConnecte) {
    return this.espace.lire(m.dossierId);
  }

  /** Réponses du militaire (une seule pour l'enregistrement au fil de la saisie). */
  @EspaceMilitaire()
  @ApiBearerAuth()
  @Put('donnees')
  enregistrer(
    @MilitaireCourant() m: MilitaireConnecte,
    @Body() dto: ReponsesEspaceDto,
  ) {
    return this.espace.enregistrer(m.dossierId, dto.valeurs);
  }

  /** Image (JPEG, PNG, WebP) ou PDF, 10 Mo au plus ; champ « fichier ». */
  @EspaceMilitaire()
  @ApiBearerAuth()
  @Post('pieces')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('fichier', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  deposer(
    @MilitaireCourant() m: MilitaireConnecte,
    @UploadedFile() fichier: Express.Multer.File | undefined,
    @Body() dto: PieceEspaceDto,
  ) {
    if (!fichier) throw new BadRequestException('Choisissez un fichier.');
    return this.espace.deposerPiece(m.dossierId, dto.type, fichier);
  }

  @EspaceMilitaire()
  @ApiBearerAuth()
  @Delete('pieces/:id')
  @HttpCode(204)
  async supprimer(
    @MilitaireCourant() m: MilitaireConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.espace.supprimerPiece(m.dossierId, id);
  }

  /** Envoi à la DGRECM pour validation ; la fiche n'est plus modifiable ensuite. */
  @EspaceMilitaire()
  @ApiBearerAuth()
  @Post('envoi')
  @HttpCode(200)
  envoyer(@MilitaireCourant() m: MilitaireConnecte) {
    return this.espace.envoyer(m.dossierId);
  }
}
