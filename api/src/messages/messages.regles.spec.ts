import { StatutDossier } from '../generated/prisma/enums.js';
import { apercu, composer, masquer, versSms } from './modeles.js';
import { ecartJours, rappelsDus, type EtatRappel } from './rappels.regles.js';

const DONNEES = {
  prenoms: 'MOUSSA',
  nom: 'CAMARA',
  grade: 'Lieutenant',
  campagne: 'Chine 2026 – Université fictive',
  lien: 'http://localhost:3002/m/JETONFICTIF0123456789abcd',
  dateLimite: '2026-11-15',
};

describe('modèles de messages', () => {
  it('compose un email complet et un SMS court sans accent', () => {
    const email = composer('LIEN_ACCES', 'EMAIL', DONNEES);
    expect(email.sujet).toContain('Chine 2026');
    expect(email.texte).toContain('Lieutenant MOUSSA CAMARA');
    expect(email.texte).toContain('avant le 15/11/2026');
    expect(email.texte).toContain(DONNEES.lien);
    expect(email.texte).toContain('DGRECM');

    const sms = composer('RAPPEL_FICHE', 'SMS', DONNEES);
    expect(sms.texte).not.toMatch(/[éèàùâêîôûç–]/);
    expect(sms.texte).toContain(DONNEES.lien);
  });

  it('donne la date et l’heure du rendez-vous', () => {
    const t = composer('CONVOCATION_DEPOT', 'EMAIL', {
      ...DONNEES,
      dateRendezVous: '2026-11-20T09:30:00.000Z',
    }).texte;
    expect(t).toContain('20/11/2026 à 09:30');
  });

  it('ne garde dans l’historique ni le lien ni le code', () => {
    const d = { ...DONNEES, code: '482913' };
    const { texte } = composer('CODE_ACCES', 'EMAIL', d);
    expect(texte).toContain('482913');
    const garde = apercu(`${texte} ${d.lien}`, d);
    expect(garde).not.toContain('482913');
    expect(garde).not.toContain(DONNEES.lien);
    expect(garde).toContain('[lien personnel]');
  });

  it('masque les coordonnées montrées au militaire', () => {
    expect(masquer('EMAIL', 'moussa.camara@exemple.gn')).toBe(
      'm•••••@exemple.gn',
    );
    expect(masquer('SMS', '+224621123456')).toBe('+224 •••• 56');
    expect(versSms('Déposé à l’ambassade')).toBe("Depose a l'ambassade");
  });
});

describe('rappels automatiques', () => {
  const base: EtatRappel = {
    id: 'd1',
    statut: StatutDossier.A_COMPLETER,
    acces: true,
    dateLimiteFiche: '2026-11-15',
    dateRendezVous: null,
  };

  it('compte les jours entre deux dates', () => {
    expect(ecartJours('2026-11-08', '2026-11-15')).toBe(7);
    expect(ecartJours('2026-11-16', '2026-11-15')).toBe(-1);
  });

  it('rappelle la fiche à J-7, J-3, J-1 et le lendemain de la date limite', () => {
    const jours = ['2026-11-08', '2026-11-12', '2026-11-14', '2026-11-16'];
    expect(jours.map((j) => rappelsDus(base, j)[0]?.cle)).toEqual([
      'RAPPEL_FICHE:d1:2026-11-15:J-7',
      'RAPPEL_FICHE:d1:2026-11-15:J-3',
      'RAPPEL_FICHE:d1:2026-11-15:J-1',
      'RAPPEL_FICHE:d1:2026-11-15:retard',
    ]);
    expect(rappelsDus(base, '2026-11-10')).toEqual([]);
    expect(rappelsDus(base, '2026-11-20')).toEqual([]);
  });

  it('ne rappelle pas sans lien, ni une fiche déjà envoyée', () => {
    expect(rappelsDus({ ...base, acces: false }, '2026-11-12')).toEqual([]);
    expect(
      rappelsDus({ ...base, statut: StatutDossier.A_VALIDER }, '2026-11-12'),
    ).toEqual([]);
  });

  it('rappelle le rendez-vous la veille', () => {
    const rdv = {
      ...base,
      statut: StatutDossier.RDV_PRIS,
      dateRendezVous: '2026-11-20T09:30:00.000Z',
    };
    expect(rappelsDus(rdv, '2026-11-19')).toEqual([
      {
        type: 'RAPPEL_RDV',
        cle: 'RAPPEL_RDV:d1:2026-11-20T09:30:00.000Z',
        parametres: { dateRendezVous: '2026-11-20T09:30:00.000Z' },
      },
    ]);
    expect(rappelsDus(rdv, '2026-11-18')).toEqual([]);
  });
});
