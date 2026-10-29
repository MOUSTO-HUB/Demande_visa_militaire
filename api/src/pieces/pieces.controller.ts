import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UtilisateurCourant } from '../auth/decorators/utilisateur-courant.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { CODES_PIECES, type CodePiece } from '../referentiel/pieces.js';
import { PiecesService } from './pieces.service.js';

class DepotPieceDto {
  @IsIn(CODES_PIECES, { message: 'Type de pièce inconnu.' })
  type: CodePiece;
}

const AGENTS = [Role.ADMIN, Role.GESTIONNAIRE, Role.OPERATEUR];

@ApiTags('Pièces')
@ApiBearerAuth()
@Controller()
export class PiecesController {
  constructor(private readonly service: PiecesService) {}

  /** Image (JPEG, PNG, WebP) ou PDF, 10 Mo au plus ; champ « fichier ». */
  @Roles(...AGENTS)
  @Post('dossiers/:id/pieces')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('fichier', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  deposer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() fichier: Express.Multer.File | undefined,
    @Body() dto: DepotPieceDto,
  ) {
    if (!fichier) throw new BadRequestException('Choisissez un fichier.');
    return this.service.deposer(u, id, dto.type, fichier);
  }

  /** Fichier prêt à téléverser sur le site officiel. */
  @Roles(...AGENTS)
  @Get('pieces/:id/fichier')
  async lire(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { contenu, type, nom } = await this.service.lire(u, id);
    return new StreamableFile(contenu, {
      type,
      disposition: `attachment; filename="${encodeURIComponent(nom)}"`,
    });
  }

  @Roles(...AGENTS)
  @Delete('pieces/:id')
  @HttpCode(204)
  async supprimer(
    @UtilisateurCourant() u: UtilisateurConnecte,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.supprimer(u, id);
  }
}
