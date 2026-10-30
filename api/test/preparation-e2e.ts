// Avant les tests de bout en bout : base « _e2e » créée si besoin, migrée, puis vidée.
import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { urlE2e, urlServeur } from './base-e2e.js';

export default async function preparer() {
  const e2e = urlE2e();
  const nom = new URL(e2e).pathname.slice(1);
  if (!/^[a-z0-9_]+$/i.test(nom))
    throw new Error(`Nom de base inattendu : ${nom}`);

  const serveur = new PrismaClient({
    adapter: new PrismaPg({ connectionString: urlServeur() }),
  });
  try {
    await serveur.$executeRawUnsafe(`CREATE DATABASE "${nom}"`);
  } catch (e) {
    // 42P04 : la base existe déjà.
    if (!String(e).includes('42P04') && !String(e).includes('already exists'))
      throw e;
  } finally {
    await serveur.$disconnect();
  }

  execSync('pnpm exec prisma migrate deploy --config prisma7.config.ts', {
    env: { ...process.env, DATABASE_URL: e2e },
    stdio: 'pipe',
  });

  // Base réservée aux tests : vidée à chaque lancement.
  const base = new PrismaClient({
    adapter: new PrismaPg({ connectionString: e2e }),
  });
  const tables = await base.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );
  if (tables.length)
    await base.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`,
    );
  await base.$disconnect();
}
