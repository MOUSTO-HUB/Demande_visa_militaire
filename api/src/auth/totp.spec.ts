import {
  base32,
  codeTotp,
  depuisBase32,
  empreinteCodeSecours,
  estFormeCodeSecours,
  lienTotp,
  nouveauSecretTotp,
  nouveauxCodesSecours,
  verifierTotp,
} from './totp.js';

// Secret des exemples de la RFC 6238 (SHA-1) : « 12345678901234567890 ».
const SECRET_RFC = base32(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it('base32 aller-retour', () => {
    expect(SECRET_RFC).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(depuisBase32(SECRET_RFC).toString()).toBe('12345678901234567890');
    expect(nouveauSecretTotp()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('donne les codes des exemples de la RFC (6 derniers chiffres)', () => {
    expect(codeTotp(SECRET_RFC, Math.floor(59 / 30))).toBe('287082');
    expect(codeTotp(SECRET_RFC, Math.floor(1111111109 / 30))).toBe('081804');
    expect(codeTotp(SECRET_RFC, Math.floor(1234567890 / 30))).toBe('005924');
  });

  it("tolère une période d'écart, pas plus, et refuse un code déjà utilisé", () => {
    const t = 1234567890 * 1000;
    const pas = Math.floor(1234567890 / 30);
    expect(verifierTotp(SECRET_RFC, '005924', null, t)).toBe(pas);
    expect(verifierTotp(SECRET_RFC, '005924', null, t + 30_000)).toBe(pas);
    expect(verifierTotp(SECRET_RFC, '005924', null, t + 60_000)).toBeNull();
    expect(verifierTotp(SECRET_RFC, '005924', pas, t)).toBeNull();
    expect(verifierTotp(SECRET_RFC, '12345', null, t)).toBeNull();
  });

  it('produit le lien lu par les applications', () => {
    expect(lienTotp('ABC', 'dir@ecole.sn')).toBe(
      'otpauth://totp/Visa-DGRECM%3Adir%40ecole.sn?secret=ABC&issuer=Visa-DGRECM&algorithm=SHA1&digits=6&period=30',
    );
  });
});

describe('codes de secours', () => {
  it('10 codes distincts, saisie indifférente à la casse et au tiret', () => {
    const codes = nouveauxCodesSecours();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    const c = codes[0];
    expect(estFormeCodeSecours(c.toUpperCase().replace('-', ' '))).toBe(true);
    expect(empreinteCodeSecours(c.toUpperCase().replace('-', ''))).toBe(
      empreinteCodeSecours(c),
    );
    expect(estFormeCodeSecours('123456')).toBe(false);
  });
});
