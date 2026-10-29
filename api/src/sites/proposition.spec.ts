import {
  normaliserLibelle,
  proposerChamp,
  proposerConversions,
} from './proposition.js';

describe('proposerChamp', () => {
  it('reconnaît les libellés en français, en anglais et en chinois', () => {
    expect(proposerChamp('Date de naissance :')).toBe('dateNaissance');
    expect(proposerChamp('Date of birth')).toBe('dateNaissance');
    expect(proposerChamp('出生日期')).toBe('dateNaissance');
    expect(proposerChamp('* Numéro du passeport')).toBe('passeportNumero');
    expect(proposerChamp('Passport No.')).toBe('passeportNumero');
  });

  it('préfère le champ le plus précis', () => {
    expect(proposerChamp("Date d'expiration du passeport")).toBe(
      'passeportDateExpiration',
    );
    expect(proposerChamp('Nom du conjoint')).toBe('conjointNom');
    expect(proposerChamp('Prénom(s)')).toBe('prenoms');
    expect(proposerChamp('Nom de famille')).toBe('nom');
  });

  it("ne compare un idéogramme seul qu'en entier", () => {
    expect(proposerChamp('姓')).toBe('nom');
    expect(proposerChamp('名')).toBe('prenoms');
  });

  it('ne propose rien pour un libellé inconnu', () => {
    expect(proposerChamp('Couleur préférée')).toBeNull();
    expect(proposerChamp('')).toBeNull();
  });
});

describe('proposerConversions', () => {
  it('relie les choix du dictionnaire à ceux du site', () => {
    expect(
      proposerConversions('sexe', [
        { valeur: '1', libelle: 'Male' },
        { valeur: '2', libelle: 'Female' },
      ]),
    ).toEqual({ MASCULIN: '1', FEMININ: '2' });
    expect(
      proposerConversions('refusVisa', [
        { valeur: 'Y', libelle: 'Oui' },
        { valeur: 'N', libelle: 'Non' },
      ]),
    ).toEqual({ OUI: 'Y', NON: 'N' });
  });

  it('laisse vide ce qui ne correspond à rien', () => {
    expect(
      proposerConversions('situationFamiliale', [
        { valeur: 'A', libelle: 'Marié(e)' },
        { valeur: 'B', libelle: 'Autre' },
      ]),
    ).toEqual({ MARIE: 'A' });
    expect(proposerConversions(null, [{ valeur: 'x', libelle: 'x' }])).toEqual(
      {},
    );
  });
});

describe('normaliserLibelle', () => {
  it('ignore accents, casse, astérisque et deux-points', () => {
    expect(normaliserLibelle('  * Prénom :  ')).toBe('prenom');
  });
});
