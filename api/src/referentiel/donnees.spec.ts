import { PaysAccueil } from '../generated/prisma/enums.js';
import { CHAMPS } from './champs.js';
import {
  appliquer,
  controler,
  fusionner,
  nombreBloquants,
  normaliser,
  repartir,
  versDateIso,
  type Valeurs,
} from './donnees.js';

const champ = (id: string) => CHAMPS.find((c) => c.id === id)!;
const AUJOURDHUI = '2026-10-29';

/** Dossier complet pour un pays : aucune anomalie bloquante. */
function dossierComplet(pays: PaysAccueil): Valeurs {
  const valeurs: Valeurs = {};
  for (const c of CHAMPS) {
    if (!c.obligatoire.includes(pays)) continue;
    valeurs[c.id] =
      c.type === 'date'
        ? '2000-01-01'
        : c.type === 'telephone'
          ? '+224621123456'
          : c.type === 'email'
            ? 'agent@exemple.gn'
            : c.type === 'oui_non'
              ? 'NON'
              : c.type === 'liste'
                ? c.options![0].valeur
                : 'VALEUR';
  }
  return {
    ...valeurs,
    serviceMilitaire: 'OUI',
    passeportDateDelivrance: '2024-01-10',
    passeportDateExpiration: '2034-01-09',
    dateArrivee: '2027-09-01',
    dateFinSejour: '2031-07-01',
    dateNaissance: '1998-05-20',
  };
}

describe('normaliser', () => {
  it('met les champs latins en majuscules sans accent', () => {
    expect(normaliser(champ('lieuNaissanceVille'), ' Nzérékoré ')).toEqual({
      valeur: 'NZEREKORE',
    });
  });

  it('accepte les dates JJ/MM/AAAA et refuse les jours impossibles', () => {
    expect(normaliser(champ('dateNaissance'), '5/3/1990')).toEqual({
      valeur: '1990-03-05',
    });
    expect(normaliser(champ('dateNaissance'), '31/02/1990')).toHaveProperty(
      'erreur',
    );
  });

  it("ajoute l'indicatif de la Guinée aux numéros locaux", () => {
    expect(normaliser(champ('telephone'), '621 12 34 56')).toEqual({
      valeur: '+224621123456',
    });
  });

  it('vide un champ avec une chaîne vide', () => {
    expect(normaliser(champ('autresNoms'), '  ')).toEqual({ valeur: null });
  });

  it('refuse un choix hors liste', () => {
    expect(normaliser(champ('sexe'), 'X')).toHaveProperty('erreur');
  });
});

describe('versDateIso', () => {
  it('convertit JJ.MM.AAAA', () => {
    expect(versDateIso('01.12.2026')).toBe('2026-12-01');
  });
});

describe('fusionner', () => {
  it('prend la réponse du dossier, sinon la valeur commune', () => {
    const { valeurs, origines } = fusionner(
      { nom: 'BAH' },
      { etablissementAccueil: 'UNIVERSITE A', villeEntree: 'PEKIN' },
      { villeEntree: 'SHANGHAI' },
    );
    expect(valeurs).toMatchObject({
      nom: 'BAH',
      etablissementAccueil: 'UNIVERSITE A',
      villeEntree: 'SHANGHAI',
    });
    expect(origines).toMatchObject({
      nom: 'MILITAIRE',
      etablissementAccueil: 'CAMPAGNE',
      villeEntree: 'DOSSIER',
    });
  });

  it("n'applique jamais de valeur commune aux déclarations personnelles", () => {
    const { valeurs } = fusionner({}, { antecedentsJudiciaires: 'NON' }, {});
    expect(valeurs.antecedentsJudiciaires).toBeUndefined();
  });
});

describe('repartir', () => {
  it('sépare colonnes, profil et dossier', () => {
    const r = repartir({
      nom: 'Camara',
      lieuNaissanceVille: 'Kankan',
      villeEntree: 'Moscou',
    });
    expect(r.colonnes).toEqual({ nom: 'CAMARA' });
    expect(r.profil).toEqual({ lieuNaissanceVille: 'KANKAN' });
    expect(r.dossier).toEqual({ villeEntree: 'MOSCOU' });
    expect(r.erreurs).toEqual([]);
  });

  it('refuse un champ inconnu ou hors portée', () => {
    expect(repartir({ inconnu: 'x' }).erreurs).toHaveLength(1);
    expect(repartir({ nom: 'X' }, ['DOSSIER']).erreurs).toHaveLength(1);
  });
});

describe('appliquer', () => {
  it('ajoute, remplace et supprime', () => {
    expect(appliquer({ a: '1', b: '2' }, { b: null, c: '3' })).toEqual({
      a: '1',
      c: '3',
    });
  });
});

describe('controler', () => {
  it('ne trouve rien à redire à un dossier complet', () => {
    for (const pays of [PaysAccueil.CHINE, PaysAccueil.RUSSIE])
      expect(
        nombreBloquants(controler(pays, dossierComplet(pays), AUJOURDHUI)),
      ).toBe(0);
  });

  it('liste les champs obligatoires du pays', () => {
    const champs = controler(PaysAccueil.RUSSIE, {}, AUJOURDHUI).map(
      (a) => a.champ,
    );
    expect(champs).toContain('numeroInvitation');
    expect(champs).not.toContain('numeroJW');
  });

  it('exige un passeport valable 6 mois après la fin du séjour', () => {
    const valeurs = {
      ...dossierComplet(PaysAccueil.CHINE),
      passeportDateExpiration: '2031-12-01',
    };
    const anomalie = controler(PaysAccueil.CHINE, valeurs, AUJOURDHUI).find(
      (a) => a.champ === 'passeportDateExpiration',
    );
    expect(anomalie?.niveau).toBe('BLOQUANT');
    expect(anomalie?.message).toContain('01/01/2032');
  });

  it('refuse un passeport expiré et des dates incohérentes', () => {
    const valeurs = {
      ...dossierComplet(PaysAccueil.CHINE),
      passeportDateExpiration: '2026-01-01',
      dateFinSejour: '2027-08-01',
    };
    const messages = controler(PaysAccueil.CHINE, valeurs, AUJOURDHUI).map(
      (a) => a.message,
    );
    expect(messages).toContain('Le passeport est expiré.');
    expect(messages).toContain(
      "La fin du séjour doit être postérieure à l'arrivée.",
    );
  });

  it('demande des précisions pour une déclaration « Oui »', () => {
    const valeurs = {
      ...dossierComplet(PaysAccueil.CHINE),
      antecedentsJudiciaires: 'OUI',
    };
    expect(
      controler(PaysAccueil.CHINE, valeurs, AUJOURDHUI).map((a) => a.champ),
    ).toContain('declarationsDetail');
  });
});
