import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { memoriserRequete } from './securite/contexte-requete.js';

/** Configuration commune à main.ts et aux tests. */
export function configurerApplication(app: INestApplication): void {
  const express = app as NestExpressApplication;
  // IP réelle du client derrière le relais HTTPS ou le serveur du site :
  // seuls les relais du réseau local ou privé sont crus (X-Forwarded-For).
  express.set('trust proxy', 'loopback, uniquelocal');
  express.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  express.use(memoriserRequete);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

/** Documentation OpenAPI sur /api/docs, hors production (ou DOCS_API=oui). */
export function documenter(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('API Demande de visa – DGRECM')
    .setDescription(
      'Préparation et suivi des demandes de visa d’études des militaires boursiers.',
    )
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
}
