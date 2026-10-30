import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CampagnesModule } from './campagnes/campagnes.module.js';
import { DossiersModule } from './dossiers/dossiers.module.js';
import { EspaceModule } from './espace/espace.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { MilitairesModule } from './militaires/militaires.module.js';
import { MrzModule } from './mrz/mrz.module.js';
import { PiecesModule } from './pieces/pieces.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReferentielModule } from './referentiel/referentiel.module.js';
import { SitesModule } from './sites/sites.module.js';
import { StockageModule } from './stockage/stockage.module.js';
import { SuiviModule } from './suivi/suivi.module.js';
import { UtilisateursModule } from './utilisateurs/utilisateurs.module.js';

@Module({
  imports: [
    // Le .env est à la racine du monorepo ; api/.env reste possible en local.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    PrismaModule,
    AuditModule,
    StockageModule,
    AuthModule,
    UtilisateursModule,
    ReferentielModule,
    MrzModule,
    CampagnesModule,
    MilitairesModule,
    DossiersModule,
    PiecesModule,
    SitesModule,
    MessagesModule,
    EspaceModule,
    SuiviModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
