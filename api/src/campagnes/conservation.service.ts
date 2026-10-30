import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatutCampagne } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CampagnesService } from './campagnes.service.js';
import { datePurge, moisConservation } from './conservation.regles.js';

/**
 * Effacement automatique des pièces des campagnes closes depuis plus de
 * CONSERVATION_MOIS mois (6 par défaut), vérifié toutes les 6 heures.
 * PURGE_AUTOMATIQUE=non le coupe (l'ADMIN peut toujours effacer à la main).
 */
@Injectable()
export class ConservationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly journal = new Logger('Conservation');
  private readonly mois: number;
  private minuteries: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly campagnes: CampagnesService,
    private readonly config: ConfigService,
  ) {
    this.mois = moisConservation(config.get<string>('CONSERVATION_MOIS'));
  }

  onApplicationBootstrap(): void {
    if (this.config.get('PURGE_AUTOMATIQUE') === 'non') return;
    const tache = () =>
      void this.purger().catch((e: unknown) =>
        this.journal.error(e instanceof Error ? e.message : String(e)),
      );
    this.minuteries.push(
      setTimeout(tache, 30_000),
      setInterval(tache, 6 * 3_600_000),
    );
  }

  onApplicationShutdown(): void {
    this.minuteries.forEach(clearTimeout);
  }

  async purger(maintenant = new Date()): Promise<number> {
    const closes = await this.prisma.campagne.findMany({
      where: {
        statut: StatutCampagne.CLOSE,
        closeLe: { not: null },
        dossiers: { some: { pieces: { some: { purgeeLe: null } } } },
      },
      select: { id: true, libelle: true, closeLe: true },
    });
    let effacees = 0;
    for (const c of closes) {
      if (datePurge(c.closeLe!, this.mois) > maintenant) continue;
      const { piecesPurgees } = await this.campagnes.purgerPieces(null, c.id);
      effacees += piecesPurgees;
      this.journal.log(
        `${piecesPurgees} pièce(s) effacée(s) : « ${c.libelle} » (close depuis plus de ${this.mois} mois).`,
      );
    }
    return effacees;
  }
}
