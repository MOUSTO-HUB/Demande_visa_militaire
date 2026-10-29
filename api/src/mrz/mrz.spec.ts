import { chiffreControle, extraireLignes, lireMrz } from './mrz.js';

// Spécimen de la norme OACI 9303.
const SPECIMEN = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
].join('\n');

const AUJOURDHUI = new Date('2026-10-29T00:00:00Z');

/** Ligne 2 d'un passeport guinéen fictif, avec des chiffres de contrôle justes. */
function ligne2(
  numero: string,
  naissance: string,
  sexe: string,
  expiration: string,
) {
  const n = numero.padEnd(9, '<');
  const perso = '<'.repeat(14);
  const debut = `${n}${chiffreControle(n)}GIN${naissance}${chiffreControle(naissance)}${sexe}${expiration}${chiffreControle(expiration)}${perso}${chiffreControle(perso)}`;
  const global = debut.slice(0, 10) + debut.slice(13, 20) + debut.slice(21, 43);
  return debut + chiffreControle(global);
}

describe('chiffreControle', () => {
  it('suit les poids 7-3-1 de la norme', () => {
    expect(chiffreControle('L898902C3')).toBe(6);
    expect(chiffreControle('740812')).toBe(2);
    expect(chiffreControle('120415')).toBe(9);
  });
});

describe('lireMrz', () => {
  it('lit le spécimen OACI', () => {
    const r = lireMrz(SPECIMEN, AUJOURDHUI)!;
    expect(r.valide).toBe(true);
    expect(r.champs).toMatchObject({
      nom: 'ERIKSSON',
      prenoms: 'ANNA MARIA',
      passeportNumero: 'L898902C3',
      dateNaissance: '1974-08-12',
      sexe: 'FEMININ',
      passeportDateExpiration: '2012-04-15',
    });
  });

  it('traduit le code GIN et place les siècles correctement', () => {
    const l2 = ligne2('R0123456', '010203', 'M', '310615');
    const r = lireMrz(
      `P<GINDIALLO<<MAMADOU<ALIOU<<<<<<<<<<<<<<<<<<\n${l2}`,
      AUJOURDHUI,
    )!;
    expect(r.valide).toBe(true);
    expect(r.champs).toMatchObject({
      nom: 'DIALLO',
      prenoms: 'MAMADOU ALIOU',
      passeportNumero: 'R0123456',
      passeportPaysEmetteur: 'GUINEA',
      nationalite: 'GUINEAN',
      dateNaissance: '2001-02-03',
      sexe: 'MASCULIN',
      passeportDateExpiration: '2031-06-15',
    });
  });

  it('corrige les lettres lues à la place des chiffres', () => {
    const bruite = SPECIMEN.replace('7408122F', '74O8l22F');
    expect(lireMrz(bruite, AUJOURDHUI)?.valide).toBe(true);
  });

  it('signale une erreur de lecture par les chiffres de contrôle', () => {
    const faux = SPECIMEN.replace('L898902C3', 'L898902C8');
    const r = lireMrz(faux, AUJOURDHUI)!;
    expect(r.valide).toBe(false);
    expect(r.controles.numero).toBe(false);
  });

  it('ignore les espaces et les lignes parasites', () => {
    const texte = `Passeport\n${SPECIMEN.split('\n')[0].replace(/(.{10})/g, '$1 ')}\n${SPECIMEN.split('\n')[1]}\n`;
    expect(extraireLignes(texte)?.[0]).toBe(SPECIMEN.split('\n')[0]);
  });

  it('renvoie null sans deux lignes de passeport', () => {
    expect(lireMrz('bonjour')).toBeNull();
  });
});
