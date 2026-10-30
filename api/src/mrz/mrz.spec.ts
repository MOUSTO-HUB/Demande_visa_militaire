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

  it('corrige un sosie dans le numéro seulement sans ambiguïté', () => {
    // « R0123456 » lu « RO123456 » : seule la variante 0 satisfait les deux contrôles.
    const l2 = ligne2('R0123456', '980305', 'M', '310914');
    const l1 = 'P<GINCAMARA<<MOUSSA<<<<<<<<<<<<<<<<<<<<<<<<<';
    const r = lireMrz(`${l1}\n${l2.replace('R0', 'RO')}`, AUJOURDHUI)!;
    expect(r.valide).toBe(true);
    expect(r.champs.passeportNumero).toBe('R0123456');
    expect(r.lignes[1]).toBe(l2);
    expect(r.corrections).toBe(1);
  });

  it('reconnaît le séparateur « << » lu « <K< » et le remplissage lu « K »', () => {
    // Lecture réelle d'une photo fictive : les chiffres de contrôle passent
    // déjà (K compte comme « < »), seules les règles de remplissage corrigent.
    const r = lireMrz(
      'P<GINCAMARA<K<MOUSSA<<<<<<<<<<<<<<<<<<<<<<<<\nR0123456<0GIN9803053M3109144<<<<<<K<K<<<<<00',
      AUJOURDHUI,
    )!;
    expect(r.valide).toBe(true);
    expect(r.champs.nom).toBe('CAMARA');
    expect(r.champs.prenoms).toBe('MOUSSA');
    expect(r.lignes[1]).toBe(ligne2('R0123456', '980305', 'M', '310914'));
  });

  it('accepte une ligne 1 sans « P » ou raccourcie, avec un parasite au bout', () => {
    const l2 = ligne2('R1100339', '000101', 'F', '320505');
    const r = lireMrz(
      `bruit\n<GINSOUMAH<<MARIAMALL<LLLLLLLLLLLLLLS\n${l2.slice(0, 28)}<<<<<<L<L<L<L<L<L<<L${l2.slice(-2)}`,
      AUJOURDHUI,
    )!;
    expect(r.valide).toBe(true);
    expect(r.lignes[0]).toMatch(/^P<GINSOUMAH<<MARIAMALL<+$/);
    expect(r.lignes[1]).toBe(l2);
  });

  it('retire un caractère lu en trop dans la ligne 2 si une seule version est juste', () => {
    const l2 = ligne2('R1100339', '000101', 'F', '320505');
    const l1 = 'P<GINSOUMAH<<MARIAMA<<<<<<<<<<<<<<<<<<<<<<<<';
    const enTrop = l2.replace('GIN000101', 'GIN0000101');
    expect(enTrop).toHaveLength(45);
    const r = lireMrz(`${l1}\n${enTrop}`, AUJOURDHUI)!;
    expect(r.valide).toBe(true);
    expect(r.lignes[1]).toBe(l2);
    expect(r.champs.dateNaissance).toBe('2000-01-01');
    // Lecture réelle d'une photo floue fictive : un « 0 » en trop et des « < »
    // perdus (44 ou 43 caractères).
    for (const lue of [
      'R1100339<4GIN00001018F3205057<<<<<L<L<<LLL00',
      'R1100339<4GIN00001018F3205057<<<<L<L<<LLL00',
      // Retirer le « G » donnerait aussi une ligne juste (nationalité « INO ») :
      // le pays émetteur de la ligne 1 départage.
      'R1100339<4GINOO0O1018F3205057<<<<<L<L<<LLLL<<L<00',
    ]) {
      const floue = lireMrz(`${l1}\n${lue}`, AUJOURDHUI)!;
      expect(floue.valide).toBe(true);
      expect(floue.lignes[1]).toBe(l2);
    }
  });

  it("n'invente pas un numéro : une erreur hors sosies reste signalée", () => {
    const faux = SPECIMEN.replace('L898902C3', 'L898902C8');
    expect(lireMrz(faux, AUJOURDHUI)?.valide).toBe(false);
  });

  it('remet le remplissage lu « LLLL » ou « KKKK » en fin de ligne 1', () => {
    const l2 = ligne2('R0123456', '980305', 'M', '310914');
    const r = lireMrz(
      `P<GINDIALLO<<KALL<FATOUMATA<<<<<<<KKKKLLLLLL\n${l2}`,
      AUJOURDHUI,
    )!;
    expect(r.champs.nom).toBe('DIALLO');
    // « KALL » (un nom) est gardé ; seules les suites de remplissage changent.
    expect(r.champs.prenoms).toBe('KALL FATOUMATA');
    expect(r.lignes[0]).toBe('P<GINDIALLO<<KALL<FATOUMATA<<<<<<<<<<<<<<<<<');
  });

  it('rattrape un « < » perdu ou en trop dans la zone personnelle', () => {
    const l2 = ligne2('R0123456', '980305', 'M', '310914');
    const l1 = 'P<GINCAMARA<<MOUSSA<<<<<<<<<<<<<<<<<<<<<<<<<';
    const court = l2.slice(0, 30) + l2.slice(31);
    const long = l2.slice(0, 30) + '<' + l2.slice(30);
    expect(lireMrz(`${l1}\n${court}`, AUJOURDHUI)?.valide).toBe(true);
    expect(lireMrz(`${l1}\n${long}`, AUJOURDHUI)?.valide).toBe(true);
  });

  it('ignore les espaces et les lignes parasites', () => {
    const texte = `Passeport\n${SPECIMEN.split('\n')[0].replace(/(.{10})/g, '$1 ')}\n${SPECIMEN.split('\n')[1]}\n`;
    expect(extraireLignes(texte)?.[0]).toBe(SPECIMEN.split('\n')[0]);
  });

  it('renvoie null sans deux lignes de passeport', () => {
    expect(lireMrz('bonjour')).toBeNull();
  });
});
