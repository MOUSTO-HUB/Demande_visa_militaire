import { StatutDossier } from '../generated/prisma/enums.js';
import { alertesDossier, type EtatAlerte } from './alertes.regles.js';

const base: EtatAlerte = {
  statut: StatutDossier.A_COMPLETER,
  anomalies: [],
  dateLimiteFiche: '2026-11-15',
  dateRendezVous: null,
  acces: true,
  echecMessage: null,
};
const types = (e: Partial<EtatAlerte>, jour: string) =>
  alertesDossier({ ...base, ...e }, jour).map((a) => `${a.type}:${a.niveau}`);

describe('alertes du suivi', () => {
  it('signale la fiche non envoyée à J-3, puis en retard', () => {
    expect(types({}, '2026-11-10')).toEqual([]);
    expect(types({}, '2026-11-12')).toEqual(['FICHE_BIENTOT:ATTENTION']);
    expect(types({}, '2026-11-16')).toEqual(['FICHE_EN_RETARD:URGENT']);
    expect(alertesDossier(base, '2026-11-18')[0].message).toContain(
      'dépassée de 3 jour(s)',
    );
  });

  it("signale l'absence de lien d'accès", () => {
    expect(types({ acces: false }, '2026-11-01')).toEqual([
      'SANS_ACCES:ATTENTION',
    ]);
  });

  it("ne prend pas une date d'expiration non saisie pour un passeport qui expire", () => {
    const anomalies = [
      {
        champ: 'passeportDateExpiration',
        message: "Date d'expiration : à renseigner.",
        niveau: 'BLOQUANT' as const,
      },
    ];
    expect(
      types({ anomalies, statut: StatutDossier.VALIDE }, '2026-11-01'),
    ).toEqual([]);
  });

  it('signale passeport et pièces manquantes avant la soumission', () => {
    const anomalies = [
      {
        champ: 'passeportDateExpiration',
        message: 'Le passeport expire moins de 6 mois après la fin du séjour.',
        niveau: 'BLOQUANT' as const,
      },
      {
        champ: null,
        message: "Pièce manquante : Photo d'identité.",
        niveau: 'BLOQUANT' as const,
      },
      {
        champ: null,
        message: "Pièce manquante : Lettre d'admission.",
        niveau: 'BLOQUANT' as const,
      },
    ];
    const alertes = alertesDossier(
      { ...base, statut: StatutDossier.VALIDE, anomalies },
      '2026-11-01',
    );
    expect(alertes.map((a) => a.type)).toEqual(['PASSEPORT', 'PIECES']);
    expect(alertes[1].message).toBe(
      "2 pièce(s) manquante(s) : Photo d'identité, Lettre d'admission.",
    );
    // Après la soumission, les pièces ne sont plus signalées ; le passeport, si.
    expect(
      types({ statut: StatutDossier.SOUMIS, anomalies }, '2026-11-01'),
    ).toEqual(['PASSEPORT:URGENT']);
  });

  it('annonce le rendez-vous de la veille au jour J, puis le rendez-vous passé', () => {
    const rdv = {
      statut: StatutDossier.RDV_PRIS,
      dateRendezVous: '2026-11-20T09:30:00.000Z',
    };
    expect(types(rdv, '2026-11-19')).toEqual(['RDV:ATTENTION']);
    expect(types(rdv, '2026-11-20')).toEqual(['RDV:URGENT']);
    expect(types(rdv, '2026-11-22')).toEqual(['RDV:ATTENTION']);
    expect(alertesDossier({ ...base, ...rdv }, '2026-11-19')[0].message).toBe(
      'Rendez-vous de dépôt demain à 09:30.',
    );
  });

  it('ne dit rien pour un dossier terminé', () => {
    expect(
      types(
        { statut: StatutDossier.VISA_OBTENU, echecMessage: 'erreur' },
        '2026-11-20',
      ),
    ).toEqual([]);
  });
});
