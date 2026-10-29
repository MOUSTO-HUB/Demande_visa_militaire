import { Injectable } from '@nestjs/common';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ActionAudit } from '../generated/prisma/enums.js';
import { page, sauter, type PaginationDto } from '../common/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ipRequete } from '../securite/contexte-requete.js';

/** Journal d'audit : qui a vu, modifié, exporté ou soumis quoi (cahier des charges, 7.5). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async journaliser(
    utilisateur: UtilisateurConnecte,
    action: ActionAudit,
    entite: string,
    entiteId?: string,
    details?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.journalAudit.create({
      data: {
        utilisateurId: utilisateur.id,
        action,
        entite,
        entiteId,
        details,
        ip: ipRequete(),
      },
    });
  }

  async lister(
    filtre: { entite?: string; entiteId?: string; utilisateurId?: string },
    pagination: PaginationDto,
  ) {
    const where: Prisma.JournalAuditWhereInput = {
      entite: filtre.entite,
      entiteId: filtre.entiteId,
      utilisateurId: filtre.utilisateurId,
    };
    const [elements, total] = await this.prisma.$transaction([
      this.prisma.journalAudit.findMany({
        where,
        orderBy: { creeLe: 'desc' },
        ...sauter(pagination),
        include: {
          utilisateur: { select: { prenoms: true, nom: true, role: true } },
        },
      }),
      this.prisma.journalAudit.count({ where }),
    ]);
    return page(elements, total, pagination);
  }
}
