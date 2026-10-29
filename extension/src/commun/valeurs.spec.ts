import type { ChampReleve, ChampSite } from './types.js';
import {
  choisirOption,
  clePage,
  decider,
  formaterDate,
  planifier,
} from './valeurs.js';

const site = (s: Partial<ChampSite>): ChampSite => ({
  id: 'x',
  page: '/p',
  cle: 'k',
  libelle: 'L',
  type: 'texte',
  obligatoire: true,
  options: [],
  formatDate: null,
  mode: 'CHAMP',
  champId: 'nom',
  valeurFixe: null,
  conversions: {},
  remplir: true,
  propose: false,
  ...s,
});

const releve = (c: Partial<ChampReleve>): ChampReleve => ({
  cle: 'k',
  libelle: 'L',
  type: 'texte',
  obligatoire: true,
  rempli: false,
  ...c,
});

describe('formaterDate', () => {
  it('suit les formats des sélecteurs de date', () => {
    expect(formaterDate('1990-03-05', 'yyyy-MM-dd')).toBe('1990-03-05');
    expect(formaterDate('1990-03-05', 'dd/MM/yyyy')).toBe('05/03/1990');
    expect(formaterDate('1990-03-05', 'yyyyMMdd')).toBe('19900305');
    expect(formaterDate('1990-03-05', 'YYYY-MM-DD')).toBe('1990-03-05');
  });
});

describe('choisirOption', () => {
  const pays = [
    { valeur: '324', libelle: 'GUINEA (几内亚)' },
    { valeur: '624', libelle: 'GUINEA-BISSAU' },
    { valeur: '226', libelle: 'EQUATORIAL GUINEA' },
  ];

  it('utilise la conversion réglée, puis la valeur, puis le libellé', () => {
    const sexe = [
      { valeur: '1', libelle: 'Male' },
      { valeur: '2', libelle: 'Female' },
    ];
    expect(choisirOption('MASCULIN', sexe, { MASCULIN: '1' })?.valeur).toBe(
      '1',
    );
    expect(choisirOption('2', sexe, {})?.valeur).toBe('2');
    expect(choisirOption('female', sexe, {})?.valeur).toBe('2');
  });

  it('trouve un pays sans se tromper de voisin', () => {
    expect(choisirOption('GUINEA', pays, {})?.valeur).toBe('324');
    expect(choisirOption('EQUATORIAL GUINEA', pays, {})?.valeur).toBe('226');
  });

  it('passe de la nationalité au pays', () => {
    expect(choisirOption('GUINEAN', pays, {})?.valeur).toBe('324');
    expect(
      choisirOption('GUINEENNE', [{ valeur: 'G', libelle: 'Guinée' }], {})
        ?.valeur,
    ).toBe('G');
  });

  it('ne choisit rien en cas de doute', () => {
    expect(choisirOption('GUI', pays, {})).toBeNull();
    expect(choisirOption('FRANCE', pays, {})).toBeNull();
  });

  it('passe du pays en français à la liste en anglais ou en russe', () => {
    expect(choisirOption('GUINEE', pays, {})?.valeur).toBe('324');
    const russe = [
      { valeur: 'a', libelle: 'ГВИНЕЯ' },
      { valeur: 'b', libelle: 'ГВИНЕЯ-БИСАУ' },
    ];
    expect(choisirOption('GUINEENNE', russe, {})?.valeur).toBe('a');
    expect(
      choisirOption(
        'COTE D IVOIRE',
        [{ valeur: 'c', libelle: 'IVORY COAST' }],
        {},
      )?.valeur,
    ).toBe('c');
  });
});

describe('decider', () => {
  it('découpe une date pour un texte ou des listes jour / mois / année', () => {
    const valeurs = { dateNaissance: '1998-03-05' };
    const champ = { champId: 'dateNaissance' };
    expect(
      decider(site({ ...champ, formatDate: 'dd.MM.yyyy' }), valeurs),
    ).toEqual({ ordre: { cle: 'k', type: 'texte', valeur: '05.03.1998' } });
    const jours = ['4', '5', '6'].map((j) => ({ valeur: j, libelle: j }));
    expect(
      decider(
        site({ ...champ, type: 'liste', formatDate: 'd', options: jours }),
        valeurs,
      ),
    ).toEqual({ ordre: { cle: 'k', type: 'liste', valeur: '5' } });
  });

  it('recopie la réponse du dossier ou la valeur fixe', () => {
    expect(decider(site({}), { nom: 'BAH' })).toEqual({
      ordre: { cle: 'k', type: 'texte', valeur: 'BAH' },
    });
    expect(
      decider(site({ mode: 'FIXE', valeurFixe: 'STUDY' }), {}),
    ).toMatchObject({ ordre: { valeur: 'STUDY' } });
  });

  it('signale un obligatoire sans réponse, saute un facultatif', () => {
    expect(decider(site({}), {})).toHaveProperty('manquant');
    expect(decider(site({ obligatoire: false }), {})).toHaveProperty('ignore');
    expect(
      decider(site({ mode: 'A_DEFINIR', champId: null }), {}),
    ).toHaveProperty('manquant');
    expect(decider(site({ mode: 'IGNORER' }), { nom: 'X' })).toHaveProperty(
      'ignore',
    );
  });

  it('convertit dates, cases et listes', () => {
    expect(
      decider(
        site({
          type: 'date',
          champId: 'dateNaissance',
          formatDate: 'dd/MM/yyyy',
        }),
        { dateNaissance: '1995-06-12' },
      ),
    ).toMatchObject({ ordre: { valeur: '12/06/1995' } });
    expect(
      decider(site({ type: 'date', champId: 'dateNaissance' }), {
        dateNaissance: '1995-06-12',
      }),
    ).toMatchObject({ ordre: { dateObjet: true } });
    expect(
      decider(site({ type: 'case', champId: 'refusVisa' }), {
        refusVisa: 'NON',
      }),
    ).toMatchObject({ ordre: { valeur: false } });
    expect(
      decider(
        site({
          type: 'liste',
          champId: 'sexe',
          options: [{ valeur: '1', libelle: 'Homme' }],
        }),
        { sexe: 'FEMININ' },
      ),
    ).toHaveProperty('manquant');
  });

  it('choisit une feuille de cascade par son libellé', () => {
    expect(
      decider(
        site({
          type: 'cascade',
          champId: 'villeEntree',
          options: [
            { valeur: '["CN","BJ"]', libelle: 'CHINA / BEIJING' },
            { valeur: '["CN","SH"]', libelle: 'CHINA / SHANGHAI' },
          ],
        }),
        { villeEntree: 'BEIJING' },
      ),
    ).toMatchObject({ ordre: { valeur: ['CN', 'BJ'] } });
  });
});

describe('planifier', () => {
  const sites = [
    site({ cle: 'nom', champId: 'nom' }),
    site({
      cle: 'surnom',
      champId: 'autresNoms',
      obligatoire: false,
      remplir: false,
    }),
    site({
      cle: 'tel',
      champId: 'telephone',
      obligatoire: false,
      remplir: true,
    }),
    site({ cle: 'jw', champId: 'numeroJW' }),
  ];
  const page = [
    releve({ cle: 'nom' }),
    releve({ cle: 'surnom', obligatoire: false }),
    releve({ cle: 'tel', obligatoire: false }),
    releve({ cle: 'jw' }),
    releve({ cle: 'nouveau', libelle: 'Nouveau champ' }),
  ];
  const valeurs = { nom: 'BAH', autresNoms: 'X', telephone: '+224621000000' };

  it('remplit les obligatoires et les champs cochés, saute les autres', () => {
    const plan = planifier(page, sites, valeurs, 'reglages');
    expect(plan.ordres.map((o) => o.cle)).toEqual(['nom', 'tel']);
    expect(plan.manquants.map((m) => m.cle)).toEqual(['jw']);
    expect(plan.nonReleves.map((c) => c.cle)).toEqual(['nouveau']);
    expect(plan.sautes).toBe(1);
  });

  it('mode « obligatoires seulement »', () => {
    const plan = planifier(page, sites, valeurs, 'obligatoires');
    expect(plan.ordres.map((o) => o.cle)).toEqual(['nom']);
    expect(plan.sautes).toBe(2);
  });

  it("n'écrase pas un champ déjà rempli sur la page", () => {
    const plan = planifier(
      [releve({ cle: 'nom', rempli: true })],
      sites,
      valeurs,
      'reglages',
    );
    expect(plan.ordres).toEqual([]);
  });
});

describe('clePage', () => {
  it('retire paramètres et identifiants', () => {
    expect(clePage('/VISA/apply/1234567/personal?x=1')).toBe(
      '/VISA/apply/:id/personal',
    );
    expect(clePage('/VISA/', '#/apply/family?step=2')).toBe(
      '/VISA/#/apply/family',
    );
  });
});
