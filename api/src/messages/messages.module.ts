import { Module } from '@nestjs/common';
import { EnvoiService } from './envoi.service.js';
import { MessagesService } from './messages.service.js';
import { PlanificateurService } from './planificateur.service.js';

@Module({
  providers: [EnvoiService, MessagesService, PlanificateurService],
  exports: [MessagesService, PlanificateurService],
})
export class MessagesModule {}
