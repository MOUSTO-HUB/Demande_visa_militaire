import { Module } from '@nestjs/common';
import { DossiersModule } from '../dossiers/dossiers.module.js';
import { SuiviController } from './suivi.controller.js';
import { SuiviService } from './suivi.service.js';

@Module({
  imports: [DossiersModule],
  controllers: [SuiviController],
  providers: [SuiviService],
})
export class SuiviModule {}
