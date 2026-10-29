import { Module } from '@nestjs/common';
import { CampagnesController } from './campagnes.controller.js';
import { CampagnesService } from './campagnes.service.js';

@Module({
  controllers: [CampagnesController],
  providers: [CampagnesService],
  exports: [CampagnesService],
})
export class CampagnesModule {}
