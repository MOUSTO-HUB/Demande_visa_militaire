import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import {
  chiffrerFichier,
  cleDepuisConfiguration,
  dechiffrerFichier,
} from '../securite/chiffrement.js';

/**
 * Stockage des pièces : un dossier sur le disque du serveur (STOCKAGE_DIR),
 * chaque fichier chiffré (AES-256-GCM, clé CLE_PIECES). La clé de stockage
 * n'est jamais exposée par l'API.
 */
@Injectable()
export class StockageService {
  private readonly racine: string;
  private readonly cle: Buffer;

  constructor(config: ConfigService) {
    this.racine = resolve(config.get<string>('STOCKAGE_DIR', 'stockage'));
    this.cle = cleDepuisConfiguration(
      config.get<string>('CLE_PIECES') || undefined,
      config.getOrThrow<string>('JWT_SECRET'),
      config.get<string>('NODE_ENV') === 'production',
    );
  }

  async enregistrer(cle: string, contenu: Buffer): Promise<void> {
    const chemin = this.chemin(cle);
    await mkdir(dirname(chemin), { recursive: true });
    await writeFile(chemin, chiffrerFichier(contenu, this.cle));
  }

  async lire(cle: string): Promise<Buffer | null> {
    let chiffre: Buffer;
    try {
      chiffre = await readFile(this.chemin(cle));
    } catch {
      return null;
    }
    return dechiffrerFichier(chiffre, this.cle);
  }

  async supprimer(cle: string): Promise<void> {
    await rm(this.chemin(cle), { force: true });
  }

  /** Chemin sur disque ; refuse toute clé qui sortirait du dossier de stockage. */
  private chemin(cle: string): string {
    const chemin = resolve(join(this.racine, cle));
    if (!chemin.startsWith(this.racine + sep)) {
      throw new BadRequestException('Clé de stockage invalide.');
    }
    return chemin;
  }
}
