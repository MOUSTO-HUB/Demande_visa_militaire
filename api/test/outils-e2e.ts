// Outils des tests de bout en bout : l'API compilée (dist/, comme en production)
// démarrée sur un port libre, avec une base dédiée et un faux expéditeur.
import { hash } from '@node-rs/argon2';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { urlE2e } from './base-e2e.js';

// Configuration lue par l'API au démarrage.
process.env.DATABASE_URL = urlE2e();
process.env.ENVOIS_AUTOMATIQUES = 'non';
process.env.PURGE_AUTOMATIQUE = 'non';
process.env.STOCKAGE_DIR = mkdtempSync(join(tmpdir(), 'visa-e2e-'));
process.env.JWT_SECRET ??= 'secret-des-tests-e2e-0123456789-0123456789';

const { AppModule } = await import('../dist/app.module.js');
const { configurerApplication } = await import('../dist/app.setup.js');
const { EnvoiService } = await import('../dist/messages/envoi.service.js');
const { MessagesService } =
  await import('../dist/messages/messages.service.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { chiffrerTexte, cleSecrets } =
  await import('../dist/securite/chiffrement.js');
const { codeTotp, nouveauSecretTotp, pasCourant } =
  await import('../dist/auth/totp.js');

/** Messages « envoyés » pendant les tests (au lieu de l'email et du SMS). */
export interface EnvoiCapture {
  canal: string;
  destinataire: string;
  sujet: string;
  texte: string;
}
export const envois: EnvoiCapture[] = [];

const expediteurFactice = {
  smsDisponibles: true,
  envoyer(canal: string, destinataire: string, sujet: string, texte: string) {
    envois.push({ canal, destinataire, sujet, texte });
    return Promise.resolve('ENVOYE' as const);
  },
};

export interface Api {
  url: string;
  app: INestApplication;
  /** Client Prisma de l'API (préparation des données des tests). */
  prisma: InstanceType<typeof PrismaService>;
  /** Envoie tout de suite les messages en file (le planificateur est coupé). */
  traiterFile: () => Promise<number>;
  fermer: () => Promise<void>;
}

export async function demarrer(): Promise<Api> {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EnvoiService)
    .useValue(expediteurFactice)
    .compile();
  const app = module.createNestApplication();
  configurerApplication(app);
  await app.listen(0, '127.0.0.1');
  const adresse = app.getHttpServer().address() as { port: number };
  const messages = app.get(MessagesService);
  return {
    url: `http://127.0.0.1:${adresse.port}/api`,
    app,
    prisma: app.get(PrismaService),
    traiterFile: () => messages.traiterFile(),
    fermer: () => app.close(),
  };
}

export interface Reponse<T = any> {
  statut: number;
  contenu: T;
}

export async function appel<T = any>(
  api: Api,
  jeton: string | null,
  methode: string,
  chemin: string,
  corps?: unknown,
): Promise<Reponse<T>> {
  const formulaire = corps instanceof FormData;
  const r = await fetch(api.url + chemin, {
    method: methode,
    headers: {
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      ...(corps !== undefined && !formulaire
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body: formulaire
      ? corps
      : corps === undefined
        ? undefined
        : JSON.stringify(corps),
  });
  const texte = await r.text();
  let contenu: unknown = texte;
  try {
    contenu = JSON.parse(texte);
  } catch {
    // Réponse non JSON (fichier).
  }
  return { statut: r.status, contenu: contenu as T };
}

const MOT_DE_PASSE = 'E2e-Mot-de-passe-2026';
let numero = 0;

/**
 * Compte d'agent prêt à l'emploi (créé en base), connecté ; ADMIN et
 * GESTIONNAIRE passent par leur double authentification, comme en réalité.
 */
export async function agent(
  api: Api,
  role: 'ADMIN' | 'GESTIONNAIRE' | 'OPERATEUR' | 'LECTEUR',
): Promise<string> {
  const email = `${role.toLowerCase()}.${++numero}@e2e.test`;
  const secret =
    role === 'ADMIN' || role === 'GESTIONNAIRE' ? nouveauSecretTotp() : null;
  await api.prisma.utilisateur.create({
    data: {
      email,
      prenoms: 'Essai',
      nom: role,
      role,
      motDePasseHash: await hash(MOT_DE_PASSE),
      motDePasseProvisoire: false,
      totpSecret: secret
        ? chiffrerTexte(secret, cleSecrets(process.env.JWT_SECRET!))
        : null,
    },
  });
  const etape = await appel(api, null, 'POST', '/auth/connexion', {
    email,
    motDePasse: MOT_DE_PASSE,
  });
  if (!etape.contenu.doubleAuth) return etape.contenu.jetonAcces as string;
  const session = await appel(
    api,
    null,
    'POST',
    '/auth/double-auth/verification',
    {
      jeton: etape.contenu.doubleAuth.jeton,
      code: codeTotp(secret!, pasCourant()),
    },
  );
  return session.contenu.jetonAcces as string;
}

/** Image JPEG fictive (aplat de couleur bruité), pour les pièces. */
export async function imageFictive(
  largeur = 800,
  hauteur = 1000,
): Promise<Blob> {
  const { default: sharp } = await import('sharp');
  const bruit = Buffer.alloc(largeur * hauteur * 3);
  for (let i = 0; i < bruit.length; i++) bruit[i] = 90 + ((i * 37) % 120);
  const jpeg = await sharp(bruit, {
    raw: { width: largeur, height: hauteur, channels: 3 },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
  return new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' });
}
