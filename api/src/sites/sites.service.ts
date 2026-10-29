import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import {
  ActionAudit,
  ModeCorrespondance,
  type PaysAccueil,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CHAMPS_PAR_ID } from '../referentiel/champs.js';
import type {
  CorrespondanceDto,
  ReleveDto,
  RemplissageDto,
} from './sites.dto.js';
import { proposerChamp, proposerConversions } from './proposition.js';

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Enregistre les champs d'une page relevés par l'extension. Un nouveau champ
   * reçoit une correspondance proposée d'après son libellé, et n'est rempli
   * par défaut que s'il est obligatoire. Un champ déjà connu garde ses réglages.
   */
  async releve(u: UtilisateurConnecte, pays: PaysAccueil, dto: ReleveDto) {
    let nouveaux = 0;
    for (const champ of dto.champs) {
      const options = champ.options ?? [];
      const releve = {
        libelle: champ.libelle,
        type: champ.type,
        obligatoire: champ.obligatoire,
        options: options.map((o) => ({ valeur: o.valeur, libelle: o.libelle })),
        formatDate: champ.formatDate ?? null,
        dernierReleve: new Date(),
      };
      const existant = await this.prisma.champSite.findUnique({
        where: { pays_page_cle: { pays, page: dto.page, cle: champ.cle } },
        select: { id: true, formatDate: true, options: true },
      });
      if (existant) {
        await this.prisma.champSite.update({
          where: { id: existant.id },
          data: {
            ...releve,
            // Format réglé à la main et choix d'une liste en cascade relevée
            // vide : gardés si la page ne les donne pas.
            formatDate: releve.formatDate ?? existant.formatDate,
            options: options.length ? releve.options : (existant.options ?? []),
          },
        });
        continue;
      }
      const propose = proposerChamp(champ.libelle);
      await this.prisma.champSite.create({
        data: {
          pays,
          page: dto.page,
          cle: champ.cle,
          ...releve,
          mode: propose
            ? ModeCorrespondance.CHAMP
            : ModeCorrespondance.A_DEFINIR,
          champId: propose,
          propose: !!propose,
          conversions: proposerConversions(propose, options),
          remplir: champ.obligatoire,
        },
      });
      nouveaux++;
    }
    await this.audit.journaliser(
      u,
      ActionAudit.RELEVE,
      'ChampSite',
      undefined,
      {
        pays,
        page: dto.page,
        champs: dto.champs.length,
        nouveaux,
      },
    );
    const page = await this.prisma.champSite.findMany({
      where: { pays, page: dto.page },
      select: { obligatoire: true, mode: true },
    });
    return {
      page: dto.page,
      releves: dto.champs.length,
      nouveaux,
      obligatoires: page.filter((c) => c.obligatoire).length,
      obligatoiresSansCorrespondance: page.filter(
        (c) => c.obligatoire && c.mode === ModeCorrespondance.A_DEFINIR,
      ).length,
    };
  }

  /** Tous les champs relevés d'un site, avec leurs correspondances (extension et réglages). */
  lister(pays: PaysAccueil) {
    return this.prisma.champSite.findMany({
      where: { pays },
      orderBy: [{ page: 'asc' }, { premierReleve: 'asc' }, { cle: 'asc' }],
    });
  }

  async modifier(u: UtilisateurConnecte, id: string, dto: CorrespondanceDto) {
    const champ = await this.prisma.champSite.findUnique({ where: { id } });
    if (!champ) throw new NotFoundException('Champ introuvable.');
    const mode = dto.mode ?? champ.mode;
    const champId = dto.champId === undefined ? champ.champId : dto.champId;
    if (mode === ModeCorrespondance.CHAMP && !champId)
      throw new BadRequestException(
        'Choisissez la réponse du dossier à recopier dans ce champ.',
      );
    if (champId && !CHAMPS_PAR_ID.has(champId))
      throw new BadRequestException(`Champ du dossier inconnu : ${champId}.`);
    const valeurFixe =
      dto.valeurFixe === undefined ? champ.valeurFixe : dto.valeurFixe;
    if (mode === ModeCorrespondance.FIXE && !valeurFixe?.trim())
      throw new BadRequestException('Saisissez la valeur fixe.');
    const modifie = await this.prisma.champSite.update({
      where: { id },
      data: {
        mode,
        champId: mode === ModeCorrespondance.CHAMP ? champId : null,
        valeurFixe:
          mode === ModeCorrespondance.FIXE ? valeurFixe!.trim() : null,
        ...(dto.conversions ? { conversions: dto.conversions } : {}),
        ...(dto.remplir === undefined ? {} : { remplir: dto.remplir }),
        ...(dto.formatDate === undefined
          ? {}
          : { formatDate: dto.formatDate || null }),
        // Un champ ignoré n'est jamais rempli.
        ...(mode === ModeCorrespondance.IGNORER ? { remplir: false } : {}),
        propose: false,
      },
    });
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'ChampSite', id, {
      ...dto,
    });
    return modifie;
  }

  /** Champ qui n'existe plus sur le site (relevé obsolète). */
  async supprimer(u: UtilisateurConnecte, id: string) {
    const champ = await this.prisma.champSite.findUnique({ where: { id } });
    if (!champ) throw new NotFoundException('Champ introuvable.');
    await this.prisma.champSite.delete({ where: { id } });
    await this.audit.journaliser(u, ActionAudit.SUPPRESSION, 'ChampSite', id, {
      pays: champ.pays,
      page: champ.page,
      cle: champ.cle,
    });
  }

  /** Trace d'une page remplie par l'extension (qui, quel dossier, combien de champs). */
  async remplissage(
    u: UtilisateurConnecte,
    pays: PaysAccueil,
    dto: RemplissageDto,
  ) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dto.dossierId },
      select: { id: true },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable.');
    await this.audit.journaliser(
      u,
      ActionAudit.REMPLISSAGE,
      'Dossier',
      dto.dossierId,
      {
        pays,
        page: dto.page,
        remplis: dto.remplis,
        manquants: dto.manquants,
      },
    );
  }
}
