import { randomInt } from 'node:crypto';

export const LONGUEUR_MIN_MOT_DE_PASSE = 10;

/** Message si le mot de passe est trop faible, sinon null. */
export function erreurMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE)
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`;
  if (
    !/[a-z]/.test(motDePasse) ||
    !/[A-Z]/.test(motDePasse) ||
    !/\d/.test(motDePasse)
  )
    return 'Le mot de passe doit mélanger minuscules, majuscules et chiffres.';
  return null;
}

// Sans caractères ambigus (0/O, 1/l/I) : le mot de passe est recopié à la main.
const MINUSCULES = 'abcdefghjkmnpqrstuvwxyz';
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CHIFFRES = '23456789';

/** Mot de passe provisoire lisible, ex. « Kmwt-7f3q-Pz8r », toujours conforme. */
export function motDePasseProvisoire(): string {
  const tirer = (alphabet: string) => alphabet[randomInt(alphabet.length)];
  const tous = MINUSCULES + MAJUSCULES + CHIFFRES;
  const groupes = [
    tirer(MAJUSCULES) + tirer(MINUSCULES) + tirer(tous) + tirer(tous),
    tirer(CHIFFRES) + tirer(MINUSCULES) + tirer(tous) + tirer(tous),
    tirer(MAJUSCULES) + tirer(tous) + tirer(CHIFFRES) + tirer(tous),
  ];
  return groupes.join('-');
}
