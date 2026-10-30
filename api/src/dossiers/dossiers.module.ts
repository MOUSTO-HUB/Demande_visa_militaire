import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module.js';
import { DossiersController } from './dossiers.controller.js';
import { DossiersService } from './dossiers.service.js';

@Module({
  imports: [MessagesModule],
  controllers: [DossiersController],
  providers: [DossiersService],
  exports: [DossiersService],
})
export class DossiersModule {}
