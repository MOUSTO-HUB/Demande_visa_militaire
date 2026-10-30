import { Global, Module } from '@nestjs/common';
import { ParametresController } from './parametres.controller.js';
import { ParametresService } from './parametres.service.js';

/** Global : les pièces, le référentiel et les dossiers lisent les exigences. */
@Global()
@Module({
  controllers: [ParametresController],
  providers: [ParametresService],
  exports: [ParametresService],
})
export class ParametresModule {}
