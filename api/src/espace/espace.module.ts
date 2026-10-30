import { Module } from '@nestjs/common';
import { DossiersModule } from '../dossiers/dossiers.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { PiecesModule } from '../pieces/pieces.module.js';
import { AccesController } from './acces.controller.js';
import { AccesService } from './acces.service.js';
import { EspaceController } from './espace.controller.js';
import { EspaceService } from './espace.service.js';

@Module({
  imports: [DossiersModule, MessagesModule, PiecesModule],
  controllers: [EspaceController, AccesController],
  providers: [AccesService, EspaceService],
})
export class EspaceModule {}
