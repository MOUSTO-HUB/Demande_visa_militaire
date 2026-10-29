import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, Matches } from 'class-validator';

export const REGEX_TELEPHONE = /^\+[1-9]\d{7,14}$/;
export const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const REGEX_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Indicatif de la Guinée, ajouté aux numéros saisis sans indicatif. */
export const INDICATIF_GUINEE = '224';

/** Accepte « +224 621 12 34 56 » et le ramène à « +224621123456 » (E.164). */
export const normaliserTelephone = (valeur: string): string =>
  valeur.replace(/[\s.()-]/g, '');

/**
 * Convertit un numéro saisi librement en E.164 : « 621 12 34 56 » → « +224621123456 »,
 * « 00224… » → « +224… ». Renvoie la valeur nettoyée si elle ne peut pas être convertie.
 */
export function versE164(
  valeur: string,
  indicatif: string = INDICATIF_GUINEE,
): string {
  let numero = normaliserTelephone(valeur);
  if (numero.startsWith('00')) numero = `+${numero.slice(2)}`;
  if (/^\d+$/.test(numero)) {
    numero = numero.startsWith(indicatif)
      ? `+${numero}`
      : `+${indicatif}${numero}`;
  }
  return numero;
}

/** Vrai si « AAAA-MM-JJ » désigne un jour réel du calendrier. */
export function estDateValide(valeur: string): boolean {
  if (!REGEX_DATE.test(valeur)) return false;
  const date = new Date(`${valeur}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === valeur
  );
}

/** Champ téléphone au format international, espaces tolérés à la saisie. */
export const EstTelephone = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? versE164(value) : value,
    ),
    Matches(REGEX_TELEPHONE, {
      message:
        'Le numéro doit être au format international, par exemple +224621123456.',
    }),
  );

/** Supprime les espaces en début et fin ; une chaîne vide devient undefined. */
export const Nettoyer = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const nettoye = value.trim();
    return nettoye === '' ? undefined : nettoye;
  });

/** Email en minuscules, sans espaces. */
export const EstEmail = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsEmail({}, { message: "L'adresse email n'est pas valide." }),
  );
