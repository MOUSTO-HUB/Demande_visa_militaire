import { cleEntete, versLatin } from './texte.js';

describe('versLatin', () => {
  it('écrit comme dans un passeport', () => {
    expect(versLatin('  Sékou   Touré ')).toBe('SEKOU TOURE');
    expect(versLatin('N’Zérékoré')).toBe("N'ZEREKORE");
  });
});

describe('cleEntete', () => {
  it('compare des en-têtes écrits différemment', () => {
    expect(cleEntete('Date de naissance')).toBe(cleEntete('DATE_DE_NAISSANCE'));
  });
});
