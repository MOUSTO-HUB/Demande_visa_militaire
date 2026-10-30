import { Module } from '@nestjs/common';
import { DossiersModule } from '../dossiers/dossiers.module.js';
import { PiecesController } from './pieces.controller.js';
import { PiecesService } from './pieces.service.js';

@Module({
  imports: [DossiersModule],
  controllers: [PiecesController],
  providers: [PiecesService],
  exports: [PiecesService],
})
export class PiecesModule {}
