import { Role, StatutDossier } from '../generated/prisma/enums.js';
import {
  peutModifierDonnees,
  refusTransition,
  suivantsPossibles,
} from './statuts.regles.js';

const base = { role: Role.GESTIONNAIRE, anomaliesBloquantes: 0 };

describe('refusTransition', () => {
  it('valide un dossier sans anomalie', () => {
    expect(
      refusTransition({
        ...base,
        depuis: StatutDossier.A_VALIDER,
        vers: StatutDossier.VALIDE,
      }),
    ).toBeNull();
  });

  it('refuse la validation tant qu’il reste des anomalies bloquantes', () => {
    expect(
      refusTransition({
        ...base,
        anomaliesBloquantes: 2,
        depuis: StatutDossier.A_VALIDER,
        vers: StatutDossier.VALIDE,
      }),
    ).toContain('2 anomalies bloquantes');
  });

  it('réserve la validation à la gestion', () => {
    expect(
      refusTransition({
        ...base,
        role: Role.OPERATEUR,
        depuis: StatutDossier.A_VALIDER,
        vers: StatutDossier.VALIDE,
      }),
    ).toContain('rôle');
  });

  it('exige le numéro de demande pour passer à « Soumis »', () => {
    const demande = {
      ...base,
      role: Role.OPERATEUR,
      depuis: StatutDossier.EN_SAISIE,
      vers: StatutDossier.SOUMIS,
    };
    expect(refusTransition(demande)).toContain('numéro de demande');
    expect(refusTransition({ ...demande, numeroDemande: 'CN123' })).toBeNull();
  });

  it('exige un motif pour un renvoi ou un abandon', () => {
    const renvoi = {
      ...base,
      depuis: StatutDossier.A_VALIDER,
      vers: StatutDossier.A_COMPLETER,
    };
    expect(refusTransition(renvoi)).toContain('motif');
    expect(
      refusTransition({ ...renvoi, commentaire: 'Photo floue' }),
    ).toBeNull();
  });

  it('refuse un saut d’étape', () => {
    expect(
      refusTransition({
        ...base,
        depuis: StatutDossier.A_COMPLETER,
        vers: StatutDossier.SOUMIS,
      }),
    ).toContain('Passage impossible');
  });

  it('ne rouvre pas un dossier terminé', () => {
    expect(suivantsPossibles(Role.ADMIN, StatutDossier.VISA_OBTENU)).toEqual(
      [],
    );
  });

  it('ne donne rien à faire au lecteur', () => {
    for (const statut of Object.values(StatutDossier))
      expect(suivantsPossibles(Role.LECTEUR, statut)).toEqual([]);
  });
});

describe('peutModifierDonnees', () => {
  it('bloque la modification après validation', () => {
    expect(peutModifierDonnees(Role.OPERATEUR, StatutDossier.A_COMPLETER)).toBe(
      true,
    );
    expect(peutModifierDonnees(Role.OPERATEUR, StatutDossier.A_VALIDER)).toBe(
      false,
    );
    expect(
      peutModifierDonnees(Role.GESTIONNAIRE, StatutDossier.A_VALIDER),
    ).toBe(true);
    expect(peutModifierDonnees(Role.ADMIN, StatutDossier.VALIDE)).toBe(false);
    expect(peutModifierDonnees(Role.LECTEUR, StatutDossier.A_COMPLETER)).toBe(
      false,
    );
  });
});
