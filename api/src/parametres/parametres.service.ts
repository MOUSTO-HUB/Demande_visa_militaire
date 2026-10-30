import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { ActionAudit, PaysAccueil } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EXIGENCES } from '../referentiel/pieces.js';
import { incoherences, type Exigences } from './exigences.regles.js';

/**
 * Exigences de format des pièces par site officiel : celles réglées par
 * l'ADMIN (table parametres_pays), sinon celles du code. Gardées en mémoire,
 * relues après chaque modification.
 */
@Injectable()
export class ParametresService {
  private cache: Map<PaysAccueil, Exigences> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async toutes(): Promise<
    Record<PaysAccueil, Exigences & { personnalisees: boolean }>
  > {
    const cache = await this.charger();
    const resultat = {} as Record<
      PaysAccueil,
      Exigences & { personnalisees: boolean }
    >;
    for (const pays of Object.values(PaysAccueil))
      resultat[pays] = {
        ...(cache.get(pays) ?? EXIGENCES[pays]),
        personnalisees: cache.has(pays),
      };
    return resultat;
  }

  async exigences(pays: PaysAccueil): Promise<Exigences> {
    return (await this.charger()).get(pays) ?? EXIGENCES[pays];
  }

  async modifier(
    u: UtilisateurConnecte,
    pays: PaysAccueil,
    exigences: Exigences,
  ) {
    const erreurs = incoherences(exigences);
    if (erreurs.length) throw new BadRequestException(erreurs);
    // Seuls les champs connus sont enregistrés.
    const { photo, scan } = exigences;
    const valeur = {
      photo: {
        largeur: photo.largeur,
        hauteur: photo.hauteur,
        poidsMinKo: photo.poidsMinKo,
        poidsMaxKo: photo.poidsMaxKo,
      },
      scan: {
        coteMax: scan.coteMax,
        poidsMaxKo: scan.poidsMaxKo,
        pdfAccepte: scan.pdfAccepte,
      },
    };
    await this.prisma.parametrePays.upsert({
      where: { pays },
      create: { pays, exigences: valeur, modifiePar: u.id },
      update: { exigences: valeur, modifiePar: u.id },
    });
    this.cache = null;
    await this.audit.journaliser(
      u,
      ActionAudit.MODIFICATION,
      'ParametrePays',
      pays,
      valeur,
    );
    return this.toutes();
  }

  /** Retour aux valeurs du code (src/referentiel/pieces.ts). */
  async retablir(u: UtilisateurConnecte, pays: PaysAccueil) {
    await this.prisma.parametrePays.deleteMany({ where: { pays } });
    this.cache = null;
    await this.audit.journaliser(
      u,
      ActionAudit.SUPPRESSION,
      'ParametrePays',
      pays,
    );
    return this.toutes();
  }

  private async charger(): Promise<Map<PaysAccueil, Exigences>> {
    if (!this.cache) {
      const lignes = await this.prisma.parametrePays.findMany();
      this.cache = new Map(
        lignes.map((l) => [l.pays, l.exigences as unknown as Exigences]),
      );
    }
    return this.cache;
  }
}
