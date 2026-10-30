import {
  datePurge,
  MOIS_CONSERVATION_DEFAUT,
  moisConservation,
} from './conservation.regles.js';

describe('conservation des pièces', () => {
  it('efface les pièces 6 mois après la clôture', () => {
    expect(datePurge(new Date('2026-11-15T10:00:00Z'), 6).toISOString()).toBe(
      '2027-05-15T10:00:00.000Z',
    );
  });

  it('prend le dernier jour du mois quand le jour n’existe pas', () => {
    expect(
      datePurge(new Date('2026-08-31T00:00:00Z'), 6).toISOString().slice(0, 10),
    ).toBe('2027-02-28');
  });

  it('lit la durée configurée, 6 mois sinon', () => {
    expect(moisConservation('12')).toBe(12);
    expect(moisConservation('0')).toBe(0);
    for (const v of [undefined, '', 'six', '-1', '1.5', '120'])
      expect(moisConservation(v)).toBe(MOIS_CONSERVATION_DEFAUT);
  });
});
