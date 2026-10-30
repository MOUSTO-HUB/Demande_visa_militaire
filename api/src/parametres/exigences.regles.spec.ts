import { EXIGENCES } from '../referentiel/pieces.js';
import { conformite, incoherences } from './exigences.regles.js';

const CHINE = EXIGENCES.CHINE;
const RUSSIE = EXIGENCES.RUSSIE;

describe('exigences des pièces', () => {
  it('accepte les valeurs d’origine et refuse les incohérences', () => {
    expect(incoherences(CHINE)).toEqual([]);
    expect(incoherences(RUSSIE)).toEqual([]);
    expect(
      incoherences({
        ...CHINE,
        photo: { ...CHINE.photo, poidsMinKo: 200, poidsMaxKo: 120 },
      }),
    ).toHaveLength(1);
    expect(
      incoherences({
        ...CHINE,
        photo: { ...CHINE.photo, largeur: 1500, hauteur: 300 },
      }),
    ).toHaveLength(1);
  });

  it('dit si une photo est conforme au site', () => {
    const photo = {
      type: 'PHOTO',
      typeMime: 'image/jpeg',
      taille: 60 * 1024,
      largeur: 354,
      hauteur: 472,
    };
    expect(conformite(photo, CHINE)).toEqual({ conforme: true, raisons: [] });
    // Le site change ses dimensions : la photo déjà déposée ne convient plus.
    const r = conformite(photo, {
      ...CHINE,
      photo: { ...CHINE.photo, largeur: 420, hauteur: 560 },
    });
    expect(r.conforme).toBe(false);
    expect(r.raisons).toEqual(['354×472 pixels au lieu de 420×560']);
    expect(
      conformite({ ...photo, taille: 8 * 1024 }, CHINE).raisons[0],
    ).toContain('moins que le minimum de 40 Ko');
  });

  it('refuse un PDF sur le site qui ne l’accepte pas', () => {
    const pdf = {
      type: 'PASSEPORT',
      typeMime: 'application/pdf',
      taille: 300 * 1024,
      largeur: null,
      hauteur: null,
    };
    expect(conformite(pdf, CHINE).conforme).toBe(false);
    expect(conformite(pdf, RUSSIE).conforme).toBe(true);
  });
});
