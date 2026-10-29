/**
 * Écriture des passeports et des formulaires officiels : lettres latines
 * majuscules sans accent. « Mamadou Aliou Diallo-Bah » → « MAMADOU ALIOU DIALLO-BAH »,
 * « Sékou Touré » → « SEKOU TOURE », espaces multiples réduits.
 */
export function versLatin(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/œ/gi, 'OE')
    .replace(/æ/gi, 'AE')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Caractères acceptés par les formulaires officiels dans un champ « latin ». */
export const REGEX_LATIN = /^[A-Z0-9 '.,\-/()#]*$/;

/** Clé de comparaison des en-têtes de colonnes : « Date de naissance » → « datedenaissance ». */
export const cleEntete = (valeur: string): string =>
  versLatin(valeur)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
