import { Module } from '@nestjs/common';
import { MrzController } from './mrz.controller.js';

@Module({ controllers: [MrzController] })
export class MrzModule {}
