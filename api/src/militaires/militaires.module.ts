import { Module } from '@nestjs/common';
import { MilitairesController } from './militaires.controller.js';
import { MilitairesService } from './militaires.service.js';

@Module({
  controllers: [MilitairesController],
  providers: [MilitairesService],
})
export class MilitairesModule {}
