import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UtilisateursController } from './utilisateurs.controller.js';
import { UtilisateursService } from './utilisateurs.service.js';

@Module({
  imports: [AuthModule],
  controllers: [UtilisateursController],
  providers: [UtilisateursService],
})
export class UtilisateursModule {}
