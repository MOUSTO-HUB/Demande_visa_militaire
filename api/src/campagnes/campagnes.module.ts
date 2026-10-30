import { Module } from '@nestjs/common';
import { CampagnesController } from './campagnes.controller.js';
import { CampagnesService } from './campagnes.service.js';
import { ConservationService } from './conservation.service.js';

@Module({
  controllers: [CampagnesController],
  providers: [CampagnesService, ConservationService],
  exports: [CampagnesService],
})
export class CampagnesModule {}
