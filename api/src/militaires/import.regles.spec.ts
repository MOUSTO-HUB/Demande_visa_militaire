import { analyserImport, reperer } from './import.regles.js';

const ENTETES = [
  'N° Matricule',
  'Grade',
  'NOM',
  'Prénom(s)',
  'Sexe',
  'Date de naissance',
  'Unité',
  'Téléphone',
  'Observations',
];

describe('reperer', () => {
  it('reconnaît les en-têtes sans tenir compte des accents ni de la casse', () => {
    const { positions, ignorees } = reperer(ENTETES);
    expect(positions).toMatchObject({
      matricule: 0,
      nom: 2,
      prenoms: 3,
      dateNaissance: 5,
      telephone: 7,
    });
    expect(ignorees).toEqual(['Observations']);
  });
});

describe('analyserImport', () => {
  it('normalise les lignes valides', () => {
    const r = analyserImport(ENTETES, [
      [
        'ag 1234',
        'Capitaine',
        'Sylla',
        'Fatoumata Binta',
        'f',
        '05/03/1995',
        'BATAILLON 1',
        '621 00 00 01',
        '',
      ],
    ]);
    expect(r.erreurs).toEqual([]);
    expect(r.valides[0]).toMatchObject({
      ligne: 2,
      matricule: 'AG1234',
      nom: 'SYLLA',
      prenoms: 'FATOUMATA BINTA',
      sexe: 'FEMININ',
      dateNaissance: '1995-03-05',
      telephone: '+224621000001',
    });
  });

  it('signale chaque erreur avec son numéro de ligne', () => {
    const r = analyserImport(ENTETES, [
      ['A1', '', 'Bah', '', 'Z', '31/02/1990', '', '12', ''],
      ['A2', '', 'Bah', 'Ali', '', '', '', '', ''],
      ['A2', '', 'Diallo', 'Ibrahima', '', '', '', '', ''],
    ]);
    expect(r.valides).toHaveLength(1);
    expect(r.erreurs.map((e) => e.ligne)).toEqual([2, 4]);
    expect(r.erreurs[0].messages).toHaveLength(4);
    expect(r.erreurs[1].messages[0]).toContain('déjà présent ligne 3');
  });

  it('ignore les lignes vides', () => {
    expect(
      analyserImport(ENTETES, [['', '', '', '', '', '', '', '', '']]).valides,
    ).toEqual([]);
  });

  it('exige les colonnes matricule, nom et prénoms', () => {
    const r = analyserImport(['Nom', 'Grade'], [['BAH', 'Sergent']]);
    expect(r.erreurs[0].messages[0]).toContain('matricule');
  });
});
