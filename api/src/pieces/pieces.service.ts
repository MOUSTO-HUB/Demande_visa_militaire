import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { DossiersService } from '../dossiers/dossiers.service.js';
import { ActionAudit } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ParametresService } from '../parametres/parametres.service.js';
import type { CodePiece } from '../referentiel/pieces.js';
import { StockageService } from '../stockage/stockage.service.js';
import {
  ErreurPreparation,
  preparerPhoto,
  preparerScan,
} from './preparation.js';

@Injectable()
export class PiecesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stockage: StockageService,
    private readonly dossiers: DossiersService,
    private readonly parametres: ParametresService,
  ) {}

  /**
   * Dépose une pièce, préparée au format du site officiel du pays de la campagne.
   * Une nouvelle pièce du même type remplace l'ancienne (sauf « Autre document »).
   * `u` null : le militaire, dans son espace, sur son propre dossier.
   */
  async deposer(
    u: UtilisateurConnecte | null,
    dossierId: string,
    type: CodePiece,
    fichier: { buffer: Buffer; originalname: string },
  ) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id: dossierId },
      include: { campagne: true },
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable.');
    if (u) this.dossiers.verifierModifiable(u, dossier);
    else this.dossiers.verifierModifiableParMilitaire(dossier);

    const exigences = await this.parametres.exigences(dossier.campagne.pays);
    let prepare;
    try {
      prepare =
        type === 'PHOTO'
          ? await preparerPhoto(fichier.buffer, exigences.photo)
          : await preparerScan(fichier.buffer, exigences.scan);
    } catch (e) {
      if (e instanceof ErreurPreparation)
        throw new BadRequestException(e.message);
      throw new BadRequestException(
        'Fichier illisible : il est peut-être abîmé. Réenregistrez-le puis réessayez.',
      );
    }

    const anciennes =
      type === 'AUTRE'
        ? []
        : await this.prisma.piece.findMany({
            where: { dossierId, type, purgeeLe: null },
          });
    const cleStockage = `dossiers/${dossierId}/${randomUUID()}`;
    await this.stockage.enregistrer(cleStockage, prepare.contenu);
    const extension = prepare.type === 'application/pdf' ? 'pdf' : 'jpg';
    const base = fichier.originalname.replace(/\.[^.]*$/, '').slice(0, 80);
    const piece = await this.prisma.piece.create({
      data: {
        dossierId,
        type,
        nomFichier: `${base || type.toLowerCase()}.${extension}`,
        typeMime: prepare.type,
        taille: prepare.contenu.length,
        largeur: prepare.largeur,
        hauteur: prepare.hauteur,
        cleStockage,
        creePar: u?.id ?? 'MILITAIRE',
      },
      omit: { cleStockage: true },
    });
    for (const ancienne of anciennes) {
      await this.stockage.supprimer(ancienne.cleStockage);
      await this.prisma.piece.delete({ where: { id: ancienne.id } });
    }
    await this.audit.journaliser(u, ActionAudit.CREATION, 'Piece', piece.id, {
      dossierId,
      type,
      remplace: anciennes.length,
      ...(u ? {} : { par: 'MILITAIRE' }),
    });
    return { piece, avertissements: prepare.avertissements };
  }

  /** Contenu déchiffré, pour l'agent qui le téléverse sur le site officiel. */
  async lire(u: UtilisateurConnecte, id: string) {
    const piece = await this.prisma.piece.findUnique({ where: { id } });
    if (!piece) throw new NotFoundException('Pièce introuvable.');
    if (piece.purgeeLe)
      throw new GoneException(
        'Ce fichier a été effacé à la clôture de la campagne.',
      );
    const contenu = await this.stockage.lire(piece.cleStockage);
    if (!contenu) throw new NotFoundException('Fichier introuvable.');
    await this.audit.journaliser(u, ActionAudit.CONSULTATION, 'Piece', id, {
      dossierId: piece.dossierId,
    });
    return { contenu, type: piece.typeMime, nom: piece.nomFichier };
  }

  /** `u` null : le militaire, qui ne retire que les pièces de son dossier. */
  async supprimer(
    u: UtilisateurConnecte | null,
    id: string,
    dossierMilitaire?: string,
  ) {
    const piece = await this.prisma.piece.findUnique({
      where: { id },
      include: { dossier: { include: { campagne: true } } },
    });
    if (!piece || (!u && piece.dossierId !== dossierMilitaire))
      throw new NotFoundException('Pièce introuvable.');
    if (u) this.dossiers.verifierModifiable(u, piece.dossier);
    else this.dossiers.verifierModifiableParMilitaire(piece.dossier);
    await this.stockage.supprimer(piece.cleStockage);
    await this.prisma.piece.delete({ where: { id } });
    await this.audit.journaliser(u, ActionAudit.SUPPRESSION, 'Piece', id, {
      dossierId: piece.dossierId,
      type: piece.type,
      ...(u ? {} : { par: 'MILITAIRE' }),
    });
  }
}
