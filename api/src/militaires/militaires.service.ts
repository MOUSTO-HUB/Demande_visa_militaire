import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { estDoublon } from '../common/erreurs-prisma.js';
import { page, sauter, type PaginationDto } from '../common/pagination.js';
import { versLatin } from '../common/texte.js';
import { Prisma } from '../generated/prisma/client.js';
import { ActionAudit, StatutCampagne } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { analyserImport } from './import.regles.js';
import { lireTableur } from './lecture-tableur.js';
import type {
  CreationMilitaireDto,
  ModificationMilitaireDto,
} from './militaires.dto.js';

/** Au-delà, le fichier est probablement une erreur (mauvaise feuille, export complet…). */
const LIGNES_MAX = 2000;

const jour = (date?: string | null) =>
  date ? new Date(`${date}T00:00:00Z`) : date === null ? null : undefined;

@Injectable()
export class MilitairesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async lister(
    filtre: { q?: string; horsCampagne?: string },
    pagination: PaginationDto,
  ) {
    const q = filtre.q ? versLatin(filtre.q) : undefined;
    const where: Prisma.MilitaireWhereInput = {
      ...(q
        ? {
            OR: [
              { matricule: { contains: q.replace(/\s/g, '') } },
              { nom: { contains: q } },
              { prenoms: { contains: q } },
            ],
          }
        : {}),
      ...(filtre.horsCampagne
        ? { dossiers: { none: { campagneId: filtre.horsCampagne } } }
        : {}),
    };
    const [elements, total] = await this.prisma.$transaction([
      this.prisma.militaire.findMany({
        where,
        orderBy: [{ nom: 'asc' }, { prenoms: 'asc' }],
        ...sauter(pagination),
        omit: { profil: true },
        include: { _count: { select: { dossiers: true } } },
      }),
      this.prisma.militaire.count({ where }),
    ]);
    return page(elements, total, pagination);
  }

  async detail(id: string) {
    const militaire = await this.prisma.militaire.findUnique({
      where: { id },
      omit: { profil: true },
      include: {
        dossiers: {
          orderBy: { creeLe: 'desc' },
          select: {
            id: true,
            statut: true,
            numeroDemande: true,
            campagne: {
              select: { id: true, libelle: true, pays: true, annee: true },
            },
          },
        },
      },
    });
    if (!militaire) throw new NotFoundException('Militaire introuvable.');
    return militaire;
  }

  async creer(u: UtilisateurConnecte, dto: CreationMilitaireDto) {
    try {
      const cree = await this.prisma.militaire.create({
        data: {
          ...dto,
          dateNaissance: jour(dto.dateNaissance),
          creePar: u.id,
        },
      });
      await this.audit.journaliser(
        u,
        ActionAudit.CREATION,
        'Militaire',
        cree.id,
      );
      return this.detail(cree.id);
    } catch (e) {
      if (estDoublon(e))
        throw new ConflictException('Ce matricule est déjà enregistré.');
      throw e;
    }
  }

  async modifier(
    u: UtilisateurConnecte,
    id: string,
    dto: ModificationMilitaireDto,
  ) {
    await this.detail(id);
    try {
      await this.prisma.militaire.update({
        where: { id },
        data: { ...dto, dateNaissance: jour(dto.dateNaissance) },
      });
    } catch (e) {
      if (estDoublon(e))
        throw new ConflictException('Ce matricule est déjà enregistré.');
      throw e;
    }
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Militaire', id, {
      champs: Object.keys(dto),
    });
    return this.detail(id);
  }

  /**
   * Import de la liste des boursiers. Un matricule déjà connu met à jour la
   * fiche (seulement les colonnes remplies) ; avec `campagneId`, chaque
   * militaire du fichier reçoit un dossier dans la campagne.
   */
  async importer(
    u: UtilisateurConnecte,
    fichier: { buffer: Buffer; originalname: string },
    options: { simulation: boolean; campagneId?: string },
  ) {
    if (options.campagneId) {
      const campagne = await this.prisma.campagne.findUnique({
        where: { id: options.campagneId },
      });
      if (!campagne) throw new NotFoundException('Campagne introuvable.');
      if (campagne.statut === StatutCampagne.CLOSE)
        throw new ConflictException('Cette campagne est close.');
    }
    const { entetes, lignes, numeros } = await lireTableur(
      fichier.buffer,
      fichier.originalname,
    );
    if (lignes.length > LIGNES_MAX)
      throw new BadRequestException(
        `Le fichier contient ${lignes.length} lignes : ${LIGNES_MAX} au plus par import.`,
      );
    const analyse = analyserImport(entetes, lignes, numeros);
    const existants = new Set(
      (
        await this.prisma.militaire.findMany({
          where: { matricule: { in: analyse.valides.map((v) => v.matricule) } },
          select: { matricule: true },
        })
      ).map((m) => m.matricule),
    );
    const rapport = {
      simulation: options.simulation,
      totalLignes: analyse.valides.length + analyse.erreurs.length,
      valides: analyse.valides.length,
      nouveaux: analyse.valides.filter((v) => !existants.has(v.matricule))
        .length,
      misAJour: analyse.valides.filter((v) => existants.has(v.matricule))
        .length,
      dossiersCrees: 0,
      erreurs: analyse.erreurs,
      colonnesIgnorees: analyse.colonnesIgnorees,
    };
    // Rien n'est enregistré si une ligne est fausse : le fichier est corrigé puis renvoyé.
    if (options.simulation || analyse.erreurs.length) return rapport;

    await this.prisma.$transaction(
      async (tx) => {
        for (const { ligne: _, ...m } of analyse.valides) {
          const commun = {
            nom: m.nom,
            prenoms: m.prenoms,
            ...(m.grade ? { grade: m.grade } : {}),
            ...(m.sexe ? { sexe: m.sexe } : {}),
            ...(m.dateNaissance
              ? { dateNaissance: jour(m.dateNaissance) }
              : {}),
            ...(m.unite ? { unite: m.unite } : {}),
            ...(m.telephone ? { telephone: m.telephone } : {}),
            ...(m.email ? { email: m.email } : {}),
          };
          const militaire = await tx.militaire.upsert({
            where: { matricule: m.matricule },
            create: { matricule: m.matricule, ...commun, creePar: u.id },
            update: commun,
            select: { id: true },
          });
          if (options.campagneId) {
            const { count } = await tx.dossier.createMany({
              data: [
                {
                  campagneId: options.campagneId,
                  militaireId: militaire.id,
                  creePar: u.id,
                },
              ],
              skipDuplicates: true,
            });
            rapport.dossiersCrees += count;
          }
        }
      },
      { timeout: 60_000 },
    );
    await this.audit.journaliser(
      u,
      ActionAudit.IMPORT,
      'Militaire',
      undefined,
      {
        fichier: fichier.originalname,
        nouveaux: rapport.nouveaux,
        misAJour: rapport.misAJour,
        campagneId: options.campagneId ?? null,
        dossiersCrees: rapport.dossiersCrees,
      },
    );
    return rapport;
  }
}
