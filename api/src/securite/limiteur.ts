import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Limite le nombre d'essais par clé (ex. adresse IP) sur une fenêtre glissante.
 * En mémoire : suffisant pour un serveur unique ; Redis si l'API est répartie.
 */
export class Limiteur {
  private readonly essais = new Map<string, number[]>();

  constructor(
    private readonly maximum: number,
    private readonly fenetreMs: number,
  ) {}

  verifier(cle: string, maintenant: number = Date.now()): void {
    const recents = (this.essais.get(cle) ?? []).filter(
      (t) => maintenant - t < this.fenetreMs,
    );
    if (recents.length >= this.maximum) {
      this.essais.set(cle, recents);
      throw new HttpException(
        'Trop de tentatives depuis ce poste. Réessayez dans quelques minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recents.push(maintenant);
    this.essais.set(cle, recents);
    // Ménage : la carte ne grossit pas indéfiniment.
    if (this.essais.size > 10_000)
      for (const [c, t] of this.essais)
        if (!t.some((x) => maintenant - x < this.fenetreMs))
          this.essais.delete(c);
  }
}
