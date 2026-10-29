import { randomBytes } from 'node:crypto';
import {
  chiffrerFichier,
  cleDepuisConfiguration,
  dechiffrerFichier,
} from './chiffrement.js';

describe('chiffrement des pièces', () => {
  const cle = randomBytes(32);

  it("retrouve le contenu d'origine", () => {
    const contenu = Buffer.from('scan du passeport');
    const chiffre = chiffrerFichier(contenu, cle);
    expect(chiffre.includes(contenu)).toBe(false);
    expect(dechiffrerFichier(chiffre, cle)).toEqual(contenu);
  });

  it('détecte une modification ou une mauvaise clé', () => {
    const chiffre = chiffrerFichier(Buffer.from('x'.repeat(50)), cle);
    chiffre[chiffre.length - 1] ^= 1;
    expect(() => dechiffrerFichier(chiffre, cle)).toThrow();
    expect(() =>
      dechiffrerFichier(
        chiffrerFichier(Buffer.from('a'), cle),
        randomBytes(32),
      ),
    ).toThrow();
  });

  it('exige CLE_PIECES en production', () => {
    expect(() => cleDepuisConfiguration(undefined, 's', true)).toThrow();
    expect(cleDepuisConfiguration(undefined, 's', false)).toHaveLength(32);
    expect(() => cleDepuisConfiguration('court', 's', false)).toThrow();
  });
});
