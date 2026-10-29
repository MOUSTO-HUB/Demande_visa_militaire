// Chiffrement des pièces (scans de passeport, photos…) sur le disque :
// AES-256-GCM. Une copie du dossier de stockage seule ne suffit pas à les lire.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const IV = 12;
const ETIQUETTE = 16;

/**
 * Clé de 32 octets : CLE_PIECES (base64) en production ; en développement,
 * dérivée de JWT_SECRET si CLE_PIECES est absente.
 */
export function cleDepuisConfiguration(
  clePieces: string | undefined,
  secretJwt: string,
  production: boolean,
): Buffer {
  if (clePieces) {
    const cle = Buffer.from(clePieces, 'base64');
    if (cle.length !== 32)
      throw new Error('CLE_PIECES doit contenir 32 octets encodés en base64.');
    return cle;
  }
  if (production) throw new Error('CLE_PIECES est obligatoire en production.');
  return createHash('sha256').update(`visa:pieces:${secretJwt}`).digest();
}

/** Contenu chiffré : iv (12 octets) | étiquette (16) | données. */
export function chiffrerFichier(contenu: Buffer, cle: Buffer): Buffer {
  const iv = randomBytes(IV);
  const chiffreur = createCipheriv('aes-256-gcm', cle, iv);
  const donnees = Buffer.concat([chiffreur.update(contenu), chiffreur.final()]);
  return Buffer.concat([iv, chiffreur.getAuthTag(), donnees]);
}

/** Lève une erreur si le fichier a été modifié ou si la clé n'est pas la bonne. */
export function dechiffrerFichier(contenu: Buffer, cle: Buffer): Buffer {
  if (contenu.length < IV + ETIQUETTE)
    throw new Error('Fichier chiffré invalide.');
  const dechiffreur = createDecipheriv(
    'aes-256-gcm',
    cle,
    contenu.subarray(0, IV),
  );
  dechiffreur.setAuthTag(contenu.subarray(IV, IV + ETIQUETTE));
  return Buffer.concat([
    dechiffreur.update(contenu.subarray(IV + ETIQUETTE)),
    dechiffreur.final(),
  ]);
}

// ─── Secrets en base (clé des applications d'authentification) ───────────────

/** Clé dérivée de JWT_SECRET : une copie de la base seule ne suffit pas à lire les secrets. */
export const cleSecrets = (secretJwt: string): Buffer =>
  createHash('sha256').update(`visa:secrets:${secretJwt}`).digest();

/** Texte chiffré, encodé en base64url pour une colonne texte. */
export const chiffrerTexte = (texte: string, cle: Buffer): string =>
  chiffrerFichier(Buffer.from(texte, 'utf8'), cle).toString('base64url');

export const dechiffrerTexte = (valeur: string, cle: Buffer): string =>
  dechiffrerFichier(Buffer.from(valeur, 'base64url'), cle).toString('utf8');
