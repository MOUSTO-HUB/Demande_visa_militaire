import {
  apresEchec,
  ESSAIS_AVANT_BLOCAGE,
  messageBlocage,
  PREMIER_BLOCAGE_MS,
} from './connexion.regles.js';

const MAINTENANT = new Date('2026-10-29T08:00:00Z');
const duree = (d: Date | null) => d!.getTime() - MAINTENANT.getTime();

describe('apresEchec', () => {
  it('ne bloque pas avant le 5e essai incorrect', () => {
    expect(apresEchec(0, MAINTENANT)).toEqual({
      echecsConnexion: 1,
      bloqueJusquA: null,
    });
  });

  it('bloque 15 minutes, puis double à chaque série', () => {
    expect(
      duree(apresEchec(ESSAIS_AVANT_BLOCAGE - 1, MAINTENANT).bloqueJusquA),
    ).toBe(PREMIER_BLOCAGE_MS);
    expect(
      duree(apresEchec(2 * ESSAIS_AVANT_BLOCAGE - 1, MAINTENANT).bloqueJusquA),
    ).toBe(2 * PREMIER_BLOCAGE_MS);
  });

  it('plafonne le blocage à 24 heures', () => {
    expect(
      duree(
        apresEchec(100 * ESSAIS_AVANT_BLOCAGE - 1, MAINTENANT).bloqueJusquA,
      ),
    ).toBe(24 * 3600 * 1000);
  });
});

describe('messageBlocage', () => {
  it('indique les minutes restantes', () => {
    expect(
      messageBlocage(new Date(MAINTENANT.getTime() + 90_000), MAINTENANT),
    ).toContain('2 minutes');
    expect(
      messageBlocage(new Date(MAINTENANT.getTime() - 1), MAINTENANT),
    ).toBeNull();
  });
});
