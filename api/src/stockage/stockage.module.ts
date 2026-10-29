import { Global, Module } from '@nestjs/common';
import { StockageService } from './stockage.service.js';

@Global()
@Module({ providers: [StockageService], exports: [StockageService] })
export class StockageModule {}
