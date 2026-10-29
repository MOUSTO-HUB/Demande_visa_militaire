import { Module } from '@nestjs/common';
import { DossiersController } from './dossiers.controller.js';
import { DossiersService } from './dossiers.service.js';

@Module({
  controllers: [DossiersController],
  providers: [DossiersService],
  exports: [DossiersService],
})
export class DossiersModule {}
