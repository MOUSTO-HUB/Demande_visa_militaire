// @vitest-environment jsdom
// Moteur testé sur de vrais composants Vue 2 + Element UI (formulaire d'essai fictif).
import { createRequire } from 'node:module';
import { definition } from '../../essai/formulaire.js';
import { planifier } from '../commun/valeurs.js';
import type { ChampSite } from '../commun/types.js';
import { definirVisibilite, releverVue, remplirVue } from './element.js';

const require = createRequire(import.meta.url);
type Vm = {
  $data: { demande: Record<string, unknown> };
  $nextTick: () => Promise<void>;
};
type ConstructeurVue = {
  new (options: object): Vm & { $mount: (el: Element) => Vm };
  use: (p: unknown) => void;
  config: { productionTip: boolean; devtools: boolean };
};

// jsdom ne calcule pas la mise en page : visible = non masqué par v-show.
definirVisibilite((el) => !el.closest('[style*="display: none"]'));

let vm: Vm;

beforeEach(async () => {
  const Vue = require('vue/dist/vue.common.js') as ConstructeurVue;
  Vue.config.productionTip = false;
  Vue.config.devtools = false;
  Vue.use(require('element-ui'));
  document.body.innerHTML = '<div id="app"></div>';
  vm = new Vue(definition).$mount(document.getElementById('app')!);
  await vm.$nextTick();
});

const site = (s: Partial<ChampSite>): ChampSite => ({
  id: s.cle ?? 'x',
  page: '/essai',
  cle: '',
  libelle: '',
  type: 'texte',
  obligatoire: true,
  options: [],
  formatDate: null,
  mode: 'CHAMP',
  champId: null,
  valeurFixe: null,
  conversions: {},
  remplir: true,
  propose: false,
  ...s,
});

describe('relevé Element UI', () => {
  it('trouve chaque champ avec sa clé, son type et son caractère obligatoire', () => {
    const champs = releverVue(document);
    const parCle = Object.fromEntries(champs.map((c) => [c.cle, c]));
    expect(champs.map((c) => c.cle)).toEqual([
      'passeport.nom',
      'passeport.prenoms',
      'ancienNom',
      'sexe',
      'naissance',
      'nationalite',
      'etatCivil',
      'jw',
      'email',
      'militaire',
    ]);
    expect(parCle['passeport.nom']).toMatchObject({
      libelle: 'Nom de famille',
      type: 'texte',
      obligatoire: true,
      rempli: false,
    });
    expect(parCle.ancienNom.obligatoire).toBe(false);
    expect(parCle.sexe).toMatchObject({
      type: 'liste',
      options: [
        { valeur: '1', libelle: 'Masculin' },
        { valeur: '2', libelle: 'Féminin' },
      ],
    });
    expect(parCle.naissance).toMatchObject({
      type: 'date',
      formatDate: 'yyyy-MM-dd',
    });
    expect(parCle.etatCivil).toMatchObject({
      type: 'choix',
      options: [
        { valeur: 'S', libelle: 'Célibataire' },
        { valeur: 'M', libelle: 'Marié(e)' },
      ],
    });
    expect(parCle.militaire.type).toBe('case');
  });
});

describe('remplissage Element UI', () => {
  it('remplit les obligatoires dans le modèle de la page, saute les facultatifs', async () => {
    const sites = [
      site({ cle: 'passeport.nom', champId: 'nom' }),
      site({ cle: 'passeport.prenoms', champId: 'prenoms' }),
      site({
        cle: 'ancienNom',
        champId: 'autresNoms',
        obligatoire: false,
        remplir: false,
      }),
      site({
        cle: 'sexe',
        type: 'liste',
        champId: 'sexe',
        conversions: { MASCULIN: '1' },
        options: [
          { valeur: '1', libelle: 'Masculin' },
          { valeur: '2', libelle: 'Féminin' },
        ],
      }),
      site({
        cle: 'naissance',
        type: 'date',
        champId: 'dateNaissance',
        formatDate: 'yyyy-MM-dd',
      }),
      site({
        cle: 'nationalite',
        type: 'liste',
        champId: 'nationalite',
        options: [
          { valeur: 'GIN', libelle: 'GUINEA (几内亚)' },
          { valeur: 'GNB', libelle: 'GUINEA-BISSAU (几内亚比绍)' },
        ],
      }),
      site({
        cle: 'etatCivil',
        type: 'choix',
        champId: 'situationFamiliale',
        conversions: { MARIE: 'M', CELIBATAIRE: 'S' },
        options: [
          { valeur: 'S', libelle: 'Célibataire' },
          { valeur: 'M', libelle: 'Marié(e)' },
        ],
      }),
      site({ cle: 'jw', champId: 'numeroJW' }),
      site({
        cle: 'email',
        champId: 'email',
        obligatoire: false,
        remplir: false,
      }),
      site({
        cle: 'militaire',
        type: 'case',
        champId: 'serviceMilitaire',
        obligatoire: false,
        remplir: true,
      }),
    ];
    const valeurs = {
      nom: 'EXEMPLE',
      prenoms: 'ALPHA',
      autresNoms: 'NE DOIT PAS ETRE REMPLI',
      sexe: 'MASCULIN',
      dateNaissance: '1997-04-12',
      nationalite: 'GUINEA',
      situationFamiliale: 'CELIBATAIRE',
      email: 'ne-pas-remplir@exemple.test',
      serviceMilitaire: 'OUI',
    };
    const plan = planifier(releverVue(document), sites, valeurs, 'reglages');
    expect(plan.manquants.map((m) => m.cle)).toEqual(['jw']);

    const resultat = remplirVue(document, plan.ordres);
    await vm.$nextTick();
    expect(resultat.echecs).toEqual([]);
    expect(vm.$data.demande).toMatchObject({
      passeport: { nom: 'EXEMPLE', prenoms: 'ALPHA' },
      ancienNom: '',
      sexe: 1, // nombre, comme la valeur de l'option du site
      naissance: '1997-04-12',
      nationalite: 'GIN',
      etatCivil: 'S',
      jw: '',
      email: '',
      militaire: true,
    });
    // La page voit les champs remplis comme tels.
    const apres = Object.fromEntries(
      releverVue(document).map((c) => [c.cle, c.rempli]),
    );
    expect(apres).toMatchObject({
      'passeport.nom': true,
      sexe: true,
      naissance: true,
      jw: false,
    });
  });

  it("relève le champ apparu après un choix (conjoint d'un militaire marié)", async () => {
    remplirVue(document, [{ cle: 'etatCivil', type: 'choix', valeur: 'M' }]);
    await vm.$nextTick();
    const conjoint = releverVue(document).find((c) => c.cle === 'conjoint');
    expect(conjoint).toMatchObject({
      libelle: 'Nom du conjoint',
      obligatoire: true,
    });
  });
});
