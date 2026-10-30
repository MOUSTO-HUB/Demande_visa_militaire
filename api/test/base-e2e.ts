// Base de données des tests de bout en bout : « <base>_e2e » sur le même serveur,
// jamais la base de développement.
import { config } from 'dotenv';

config({ path: ['.env', '../.env'], quiet: true });

export function urlE2e(): string {
  const brute = process.env.DATABASE_URL_E2E ?? process.env.DATABASE_URL;
  if (!brute)
    throw new Error('DATABASE_URL est nécessaire aux tests de bout en bout.');
  const url = new URL(brute);
  if (!process.env.DATABASE_URL_E2E && !url.pathname.endsWith('_e2e'))
    url.pathname = `${url.pathname}_e2e`;
  return url.toString();
}

/** Base d'origine (pour créer la base des tests si elle n'existe pas). */
export function urlServeur(): string {
  const url = new URL(urlE2e());
  url.pathname = url.pathname.replace(/_e2e$/, '');
  return url.toString();
}
