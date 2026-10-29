import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator.js';

@ApiTags('Santé')
@Controller()
export class AppController {
  /** Supervision : l'API répond. */
  @Public()
  @Get('sante')
  sante() {
    return { statut: 'ok' };
  }
}
