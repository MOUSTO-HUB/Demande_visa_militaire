import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatutCampagne, StatutDossier } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MessagesService } from './messages.service.js';
import { rappelsDus } from './rappels.regles.js';

/**
 * Tâches régulières de l'API : envoi de la file des messages (30 secondes) et
 * rappels automatiques (chaque heure). ENVOIS_AUTOMATIQUES=non les coupe
 * (tests, deuxième instance de l'API).
 */
@Injectable()
export class PlanificateurService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly journal = new Logger('Planificateur');
  private minuteries: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get('ENVOIS_AUTOMATIQUES') === 'non') return;
    const proteger = (nom: string, tache: () => Promise<unknown>) => () =>
      void tache().catch((e: unknown) =>
        this.journal.error(
          `${nom} : ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    const file = proteger('File des messages', () =>
      this.messages.traiterFile(),
    );
    const rappels = proteger('Rappels', () => this.planifierRappels());
    this.minuteries.push(
      setInterval(file, 30_000),
      setInterval(rappels, 3_600_000),
      setTimeout(rappels, 10_000),
    );
  }

  onApplicationShutdown(): void {
    this.minuteries.forEach(clearTimeout);
  }

  /** Met en file les rappels du jour (une seule fois chacun, grâce à leur clé). */
  async planifierRappels(aujourdhui = new Date()): Promise<number> {
    const jour = aujourdhui.toISOString().slice(0, 10);
    const dossiers = await this.prisma.dossier.findMany({
      where: {
        campagne: { statut: StatutCampagne.OUVERTE },
        statut: { in: [StatutDossier.A_COMPLETER, StatutDossier.RDV_PRIS] },
      },
      select: {
        id: true,
        statut: true,
        dateRendezVous: true,
        acces: { select: { expireLe: true } },
        campagne: { select: { dateLimiteFiche: true } },
      },
    });
    let crees = 0;
    for (const d of dossiers)
      for (const rappel of rappelsDus(
        {
          id: d.id,
          statut: d.statut,
          acces: !!d.acces && d.acces.expireLe > aujourdhui,
          dateLimiteFiche:
            d.campagne.dateLimiteFiche?.toISOString().slice(0, 10) ?? null,
          dateRendezVous: d.dateRendezVous?.toISOString() ?? null,
        },
        jour,
      ))
        if (
          await this.messages.enfiler(d.id, rappel.type, rappel.parametres, {
            cle: rappel.cle,
          })
        )
          crees++;
    if (crees) this.journal.log(`${crees} rappel(s) mis en file.`);
    return crees;
  }
}
