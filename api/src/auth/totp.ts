// Codes à 6 chiffres des applications d'authentification (Google Authenticator,
// Microsoft Authenticator…) : TOTP, RFC 6238 (HMAC-SHA1, pas de 30 secondes).
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';

export const PAS_TOTP_S = 30;
const CHIFFRES = 6;
const ALPHABET_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(octets: Buffer): string {
  let bits = 0;
  let valeur = 0;
  let sortie = '';
  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET_BASE32[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET_BASE32[(valeur << (5 - bits)) & 31];
  return sortie;
}

export function depuisBase32(texte: string): Buffer {
  const propre = texte.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let valeur = 0;
  const octets: number[] = [];
  for (const c of propre) {
    const i = ALPHABET_BASE32.indexOf(c);
    if (i < 0) throw new Error('Clé base32 invalide.');
    valeur = (valeur << 5) | i;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

/** Nouvelle clé secrète (160 bits), en base32 comme l'attendent les applications. */
export const nouveauSecretTotp = () => base32(randomBytes(20));

export const pasCourant = (maintenant = Date.now()) =>
  Math.floor(maintenant / 1000 / PAS_TOTP_S);

/** Code du pas donné (HOTP, RFC 4226). */
export function codeTotp(secret: string, pas: number): string {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(pas));
  const hmac = createHmac('sha1', depuisBase32(secret))
    .update(compteur)
    .digest();
  const decalage = hmac[hmac.length - 1] & 0xf;
  const nombre = (hmac.readUInt32BE(decalage) & 0x7fffffff) % 10 ** CHIFFRES;
  return nombre.toString().padStart(CHIFFRES, '0');
}

/**
 * Pas du code s'il est valable (une période d'écart tolérée : horloge du
 * téléphone décalée), sinon null. `apresPas` refuse un code déjà utilisé.
 */
export function verifierTotp(
  secret: string,
  code: string,
  apresPas: number | null = null,
  maintenant = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const courant = pasCourant(maintenant);
  for (const pas of [courant, courant - 1, courant + 1]) {
    if (apresPas !== null && pas <= apresPas) continue;
    if (codeTotp(secret, pas) === code) return pas;
  }
  return null;
}

/** Lien lu par les applications (QR code) : otpauth://totp/… */
export function lienTotp(secret: string, compte: string): string {
  const emetteur = 'Visa-DGRECM';
  const libelle = encodeURIComponent(`${emetteur}:${compte}`);
  return `otpauth://totp/${libelle}?secret=${secret}&issuer=${emetteur}&algorithm=SHA1&digits=${CHIFFRES}&period=${PAS_TOTP_S}`;
}

// ─── Codes de secours (téléphone perdu) ───────────────────────────────────────

export const NOMBRE_CODES_SECOURS = 10;
const CARACTERES_SECOURS = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Forme saisie indifférente : majuscules, espaces et tirets ignorés. */
const normaliser = (code: string) => code.toLowerCase().replace(/[\s-]/g, '');

export const empreinteCodeSecours = (code: string) =>
  createHash('sha256').update(normaliser(code)).digest('hex');

export const estFormeCodeSecours = (code: string) =>
  /^[a-z0-9]{8}$/.test(normaliser(code));

/** Codes à usage unique, ex. « k7pm-x3qa », affichés une seule fois. */
export function nouveauxCodesSecours(): string[] {
  return Array.from({ length: NOMBRE_CODES_SECOURS }, () => {
    const c = Array.from(
      { length: 8 },
      () => CARACTERES_SECOURS[randomInt(CARACTERES_SECOURS.length)],
    ).join('');
    return `${c.slice(0, 4)}-${c.slice(4)}`;
  });
}
