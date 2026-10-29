import {
  erreurMotDePasse,
  motDePasseProvisoire,
} from './utilisateurs.regles.js';

describe('erreurMotDePasse', () => {
  it('exige 10 caractères mêlant minuscules, majuscules et chiffres', () => {
    expect(erreurMotDePasse('Court1')).toContain('10 caractères');
    expect(erreurMotDePasse('toutenminuscules1')).toContain('mélanger');
    expect(erreurMotDePasse('Correct-Horse-7')).toBeNull();
  });
});

describe('motDePasseProvisoire', () => {
  it('est toujours accepté par la règle', () => {
    for (let i = 0; i < 200; i++) {
      const mdp = motDePasseProvisoire();
      expect(mdp).toMatch(/^\w{4}-\w{4}-\w{4}$/);
      expect(erreurMotDePasse(mdp)).toBeNull();
    }
  });
});
