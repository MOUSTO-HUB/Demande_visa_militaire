// @vitest-environment jsdom
// Moteur HTML testé sur le formulaire d'essai fictif construit comme un formulaire ASP.NET WebForms.
import { readFileSync } from 'node:fs';
import { planifier } from '../commun/valeurs.js';
import type { ChampSite } from '../commun/types.js';
import { definirVisibilite } from './element.js';
import { formatIndique, releverNatif, remplirNatif } from './natif.js';

// jsdom ne calcule pas la mise en page : visible = hors d'une section masquée.
definirVisibilite((el) => !el.closest('.cache'));

// Sous jsdom, import.meta.url n'est pas une adresse de fichier : chemin depuis la racine du paquet.
const PAGE = readFileSync('essai/webforms.html', 'utf8');

let rechargements: number;

beforeEach(() => {
  // Le corps de la page, sans ses scripts (simulés ci-dessous).
  document.body.innerHTML = PAGE.split('<body>')[1]
    .split('</body>')[0]
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const validateur = document.getElementById(
    'essai_rfvNaissance',
  ) as HTMLElement & Record<string, unknown>;
  validateur.controltovalidate = 'essai_txtNaissance';
  validateur.evaluationfunction =
    function RequiredFieldValidatorEvaluateIsValid() {};
  (window as unknown as { Page_Validators: unknown[] }).Page_Validators = [
    validateur,
  ];
  rechargements = 0;
  document
    .getElementById('essai_ddlPays')!
    .addEventListener('change', () => rechargements++);
});

const parCle = () =>
  Object.fromEntries(releverNatif(document).map((c) => [c.cle, c]));

const site = (s: Partial<ChampSite>): ChampSite => ({
  id: s.cle ?? 'x',
  page: '/webforms',
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

describe('relevé WebForms', () => {
  it('trouve les champs affichés avec leur libellé voisin', () => {
    const champs = releverNatif(document);
    expect(champs.map((c) => [c.cle, c.libelle])).toEqual([
      ['essai$txtNom', 'Nom de famille'],
      ['essai$txtPrenoms', 'Prénom(s)'],
      ['essai$txtSurnom', 'Surnom (facultatif)'],
      ['essai$txtNaissance', 'Date de naissance (jj.mm.aaaa)'],
      ['essai$rblSexe', 'Sexe'],
      ['essai$ddlPays', 'Pays de résidence'],
      ['essai$ddlVille', 'Ville de résidence'],
      ['essai$txtCourriel', 'Adresse électronique'],
      ['essai$cbExact', "Je certifie l'exactitude des réponses"],
    ]);
  });

  it('distingue obligatoires (marque « * », validateur, required) et facultatifs', () => {
    const c = parCle();
    expect(c['essai$txtNom'].obligatoire).toBe(true);
    expect(c['essai$txtSurnom'].obligatoire).toBe(false);
    expect(c['essai$txtNaissance'].obligatoire).toBe(true);
    expect(c['essai$rblSexe'].obligatoire).toBe(false);
    expect(c['essai$ddlVille'].obligatoire).toBe(true);
    expect(c['essai$cbExact'].obligatoire).toBe(true);
  });

  it('reconnaît la date en texte, le masque vide, les choix sans invite', () => {
    const c = parCle();
    expect(c['essai$txtNaissance']).toMatchObject({
      type: 'date',
      formatDate: 'dd.MM.yyyy',
      rempli: false,
    });
    expect(c['essai$rblSexe']).toMatchObject({
      type: 'choix',
      options: [
        { valeur: 'M', libelle: 'Masculin' },
        { valeur: 'F', libelle: 'Féminin' },
      ],
    });
    expect(c['essai$ddlPays'].options?.map((o) => o.libelle)).toEqual([
      'GUINEA',
      'GUINEA-BISSAU',
      'SENEGAL',
    ]);
    expect(c['essai$ddlPays'].rempli).toBe(false);
    expect(c['essai$ddlVille'].options).toEqual([]);
  });
});

describe('remplissage WebForms', () => {
  const reglages = [
    site({ cle: 'essai$txtNom', champId: 'nom' }),
    site({ cle: 'essai$txtPrenoms', champId: 'prenoms' }),
    site({
      cle: 'essai$txtSurnom',
      champId: 'autresNoms',
      obligatoire: false,
      remplir: false,
    }),
    site({
      cle: 'essai$txtNaissance',
      type: 'date',
      formatDate: 'dd.MM.yyyy',
      champId: 'dateNaissance',
    }),
    site({
      cle: 'essai$rblSexe',
      type: 'choix',
      obligatoire: false,
      remplir: true,
      champId: 'sexe',
      options: [
        { valeur: 'M', libelle: 'Masculin' },
        { valeur: 'F', libelle: 'Féminin' },
      ],
    }),
    site({
      cle: 'essai$ddlPays',
      type: 'liste',
      champId: 'nationalite',
      options: [
        { valeur: '10', libelle: 'GUINEA' },
        { valeur: '11', libelle: 'GUINEA-BISSAU' },
        { valeur: '20', libelle: 'SENEGAL' },
      ],
    }),
    site({ cle: 'essai$ddlVille', type: 'liste', champId: 'ville' }),
    site({ cle: 'essai$txtCourriel', champId: 'email' }),
    site({
      cle: 'essai$cbExact',
      type: 'case',
      mode: 'FIXE',
      valeurFixe: 'OUI',
    }),
  ];
  const valeurs = {
    nom: 'CAMARA',
    prenoms: 'MOUSSA',
    autresNoms: 'MOMO',
    dateNaissance: '1998-03-05',
    sexe: 'MASCULIN',
    nationalite: 'GUINEENNE',
    ville: 'CONAKRY',
  };
  const valeur = (id: string) =>
    (document.getElementById(id) as HTMLInputElement).value;

  it('remplit les obligatoires, saute les facultatifs, pose la liste qui recharge en dernier', async () => {
    vi.useFakeTimers();
    const plan = planifier(
      releverNatif(document),
      reglages,
      valeurs,
      'obligatoires',
    );
    // Sexe (facultatif) et surnom sautés ; villes pas encore chargées ;
    // courriel absent du dossier.
    expect(plan.sautes).toBe(2);
    expect(plan.manquants.map((m) => m.cle)).toEqual([
      'essai$ddlVille',
      'essai$txtCourriel',
    ]);

    const resultat = remplirNatif(document, plan.ordres);
    expect(valeur('essai_txtNom')).toBe('CAMARA');
    expect(valeur('essai_txtNaissance')).toBe('05.03.1998');
    expect(
      (document.getElementById('essai_cbExact') as HTMLInputElement).checked,
    ).toBe(true);
    expect(valeur('essai_txtSurnom')).toBe('');
    // Le pays n'est posé qu'après la réponse (il recharge la page).
    expect(resultat.echecs).toEqual([]);
    expect(resultat.rechargement).toEqual({
      cle: 'essai$ddlPays',
      enAttente: [],
    });
    expect(valeur('essai_ddlPays')).toBe('');
    expect(rechargements).toBe(0);
    vi.advanceTimersByTime(300);
    expect(valeur('essai_ddlPays')).toBe('10');
    expect(rechargements).toBe(1);
    vi.useRealTimers();
  });

  it('au clic suivant (page rechargée), complète sans rien écraser', () => {
    // État après le rechargement : valeurs reprises, villes chargées.
    (document.getElementById('essai_txtNom') as HTMLInputElement).value =
      'CAMARA';
    const pays = document.getElementById('essai_ddlPays') as HTMLSelectElement;
    pays.value = '10';
    const ville = document.getElementById(
      'essai_ddlVille',
    ) as HTMLSelectElement;
    ville.disabled = false;
    for (const v of ['CONAKRY', 'KANKAN']) ville.add(new Option(v, v));

    // Les villes, absentes du relevé enregistré, sont lues sur la page.
    const plan = planifier(
      releverNatif(document),
      reglages,
      { ...valeurs, nom: 'AUTRE' },
      'reglages',
    );
    const resultat = remplirNatif(document, plan.ordres);
    expect(valeur('essai_txtNom')).toBe('CAMARA');
    expect(ville.value).toBe('CONAKRY');
    expect(resultat.rechargement).toBeUndefined();
    expect(
      (document.getElementById('essai_rblSexe_0') as HTMLInputElement).checked,
    ).toBe(true);
    expect(rechargements).toBe(0);
  });
});

describe('formatIndique', () => {
  it('lit les indications de format en français, anglais et russe', () => {
    expect(formatIndique('Date (jj.mm.aaaa)')).toBe('dd.MM.yyyy');
    expect(formatIndique('Дата рождения (ДД.ММ.ГГГГ)')).toBe('dd.MM.yyyy');
    expect(formatIndique('dd/mm/yyyy')).toBe('dd/MM/yyyy');
    expect(formatIndique('mm/dd/yyyy')).toBe('MM/dd/yyyy');
    expect(formatIndique('__.__.____')).toBe('dd.MM.yyyy');
    expect(formatIndique('Nom de famille')).toBeUndefined();
  });
});
