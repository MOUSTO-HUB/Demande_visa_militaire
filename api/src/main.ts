import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurerApplication, documenter } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurerApplication(app);
  if (process.env.NODE_ENV !== 'production' || process.env.DOCS_API === 'oui')
    documenter(app);
  const origines = (process.env.WEB_ORIGIN ?? 'http://localhost:3002')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origines });
  await app.listen(process.env.API_PORT ?? 3200);
}
await bootstrap();
