import sharp from 'sharp';
import { EXIGENCES } from '../referentiel/pieces.js';
import { preparerPhoto, preparerScan, typeFichier } from './preparation.js';

/** Image de test avec du bruit (une image unie se compresse trop bien). */
async function image(
  largeur: number,
  hauteur: number,
  format: 'png' | 'jpeg' = 'png',
) {
  const pixels = Buffer.alloc(largeur * hauteur * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 7919) % 251;
  const base = sharp(pixels, {
    raw: { width: largeur, height: hauteur, channels: 3 },
  });
  return format === 'png' ? base.png().toBuffer() : base.jpeg().toBuffer();
}

describe('typeFichier', () => {
  it('reconnaît le format au contenu', async () => {
    expect(typeFichier(await image(10, 10))).toBe('image/png');
    expect(typeFichier(Buffer.from('%PDF-1.7 ...'))).toBe('application/pdf');
    expect(typeFichier(Buffer.from('MZ exécutable'))).toBeNull();
  });
});

describe('preparerPhoto', () => {
  it('produit les dimensions et le poids exigés par la Chine', async () => {
    const exigence = EXIGENCES.CHINE.photo;
    const r = await preparerPhoto(await image(1200, 1600), exigence);
    const meta = await sharp(r.contenu).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([
      exigence.largeur,
      exigence.hauteur,
    ]);
    expect(r.contenu.length).toBeLessThanOrEqual(exigence.poidsMaxKo * 1024);
  });

  it('reste entre le poids minimal et maximal, même pour une photo JPEG très détaillée', async () => {
    const exigence = EXIGENCES.CHINE.photo;
    const r = await preparerPhoto(await image(1200, 1600, 'jpeg'), exigence);
    expect(r.contenu.length).toBeLessThanOrEqual(exigence.poidsMaxKo * 1024);
    expect(r.contenu.length).toBeGreaterThanOrEqual(exigence.poidsMinKo * 1024);
  });

  it('prévient quand la photo est trop petite', async () => {
    const r = await preparerPhoto(
      await image(200, 260),
      EXIGENCES.RUSSIE.photo,
    );
    expect(r.avertissements[0]).toContain('faible résolution');
  });

  it('refuse un PDF', async () => {
    await expect(
      preparerPhoto(Buffer.from('%PDF-1.4'), EXIGENCES.CHINE.photo),
    ).rejects.toThrow('JPEG');
  });
});

describe('preparerScan', () => {
  it('réduit un grand scan sous le poids maximal', async () => {
    const exigence = { coteMax: 1600, poidsMaxKo: 300, pdfAccepte: false };
    const r = await preparerScan(await image(3000, 4000, 'jpeg'), exigence);
    expect(r.contenu.length).toBeLessThanOrEqual(300 * 1024);
    expect(Math.max(r.largeur!, r.hauteur!)).toBeLessThanOrEqual(1600);
  });

  it("refuse un PDF quand le site ne l'accepte pas", async () => {
    await expect(
      preparerScan(Buffer.from('%PDF-1.4'), EXIGENCES.CHINE.scan),
    ).rejects.toThrow('PDF');
    const r = await preparerScan(
      Buffer.from('%PDF-1.4'),
      EXIGENCES.RUSSIE.scan,
    );
    expect(r.type).toBe('application/pdf');
  });
});
