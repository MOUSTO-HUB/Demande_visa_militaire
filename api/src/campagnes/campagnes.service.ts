import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { LIBELLES_STATUT } from '../dossiers/statuts.regles.js';
import {
  ActionAudit,
  StatutCampagne,
  type StatutDossier,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CHAMPS_PAR_ID } from '../referentiel/champs.js';
import { appliquer, lireValeurs, repartir } from '../referentiel/donnees.js';
import { piecesDeCampagne } from '../referentiel/pieces.js';
import { StockageService } from '../stockage/stockage.service.js';
import type {
  CreationCampagneDto,
  ModificationCampagneDto,
} from './campagnes.dto.js';

type Compteurs = Partial<Record<StatutDossier, number>>;

const total = (c: Compteurs) => Object.values(c).reduce((a, b) => a + b, 0);

/** « AAAA-MM-JJ » de la date limite → date en base. */
function versDonnees<T extends { dateLimiteFiche?: string | null }>(dto: T) {
  const { dateLimiteFiche, ...reste } = dto;
  return {
    ...reste,
    ...(dateLimiteFiche === undefined
      ? {}
      : {
          dateLimiteFiche: dateLimiteFiche
            ? new Date(`${dateLimiteFiche}T00:00:00Z`)
            : null,
        }),
  };
}

@Injectable()
export class CampagnesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stockage: StockageService,
  ) {}

  /** Nombre de dossiers par statut, pour chaque campagne. */
  private async compteurs(campagneIds: string[]) {
    const groupes = await this.prisma.dossier.groupBy({
      by: ['campagneId', 'statut'],
      where: { campagneId: { in: campagneIds } },
      _count: { _all: true },
    });
    const resultat = new Map<string, Compteurs>();
    for (const g of groupes) {
      const c = resultat.get(g.campagneId) ?? {};
      c[g.statut] = g._count._all;
      resultat.set(g.campagneId, c);
    }
    return resultat;
  }

  async lister() {
    const campagnes = await this.prisma.campagne.findMany({
      orderBy: [{ statut: 'asc' }, { annee: 'desc' }, { creeLe: 'desc' }],
      omit: { valeursCommunes: true },
    });
    const compteurs = await this.compteurs(campagnes.map((c) => c.id));
    return campagnes.map((c) => {
      const parStatut = compteurs.get(c.id) ?? {};
      return { ...c, dossiers: total(parStatut), parStatut };
    });
  }

  async detail(id: string) {
    const campagne = await this.existante(id);
    const parStatut = (await this.compteurs([id])).get(id) ?? {};
    return {
      ...campagne,
      valeursCommunes: lireValeurs(campagne.valeursCommunes),
      pieces: piecesDeCampagne(campagne.pays, campagne.piecesExigees),
      dossiers: total(parStatut),
      parStatut,
    };
  }

  async creer(u: UtilisateurConnecte, dto: CreationCampagneDto) {
    const cree = await this.prisma.campagne.create({
      data: { ...versDonnees(dto), creePar: u.id },
    });
    await this.audit.journaliser(u, ActionAudit.CREATION, 'Campagne', cree.id);
    return this.detail(cree.id);
  }

  async modifier(
    u: UtilisateurConnecte,
    id: string,
    dto: ModificationCampagneDto,
  ) {
    const campagne = await this.ouverte(id);
    if (dto.pays && dto.pays !== campagne.pays) {
      const dossiers = await this.prisma.dossier.count({
        where: { campagneId: id },
      });
      if (dossiers)
        throw new BadRequestException(
          'La campagne a déjà des dossiers : son pays ne peut plus changer.',
        );
    }
    await this.prisma.campagne.update({
      where: { id },
      data: versDonnees(dto),
    });
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Campagne', id, {
      ...dto,
    });
    return this.detail(id);
  }

  /** Valeurs communes (champs DOSSIER) : héritées par tous les dossiers de la campagne. */
  async definirValeursCommunes(
    u: UtilisateurConnecte,
    id: string,
    saisie: Record<string, unknown>,
  ) {
    const campagne = await this.ouverte(id);
    const { dossier, erreurs } = repartir(saisie, ['DOSSIER']);
    for (const champ of Object.keys(dossier)) {
      const definition = CHAMPS_PAR_ID.get(champ);
      if (definition?.communInterdit)
        erreurs.push({
          champ,
          message: `${definition.libelle} : réponse propre à chaque militaire, pas de valeur commune.`,
        });
    }
    if (erreurs.length)
      throw new BadRequestException(erreurs.map((e) => e.message));
    await this.prisma.campagne.update({
      where: { id },
      data: {
        valeursCommunes: appliquer(
          lireValeurs(campagne.valeursCommunes),
          dossier,
        ),
      },
    });
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Campagne', id, {
      valeursCommunes: Object.keys(dossier),
    });
    return this.detail(id);
  }

  async cloturer(u: UtilisateurConnecte, id: string) {
    await this.ouverte(id);
    await this.prisma.campagne.update({
      where: { id },
      data: { statut: StatutCampagne.CLOSE, closeLe: new Date() },
    });
    await this.audit.journaliser(u, ActionAudit.STATUT, 'Campagne', id, {
      statut: StatutCampagne.CLOSE,
    });
    return this.detail(id);
  }

  /** Ajoute des militaires à la campagne (ceux qui y sont déjà sont ignorés). */
  async ajouterDossiers(
    u: UtilisateurConnecte,
    id: string,
    militaireIds: string[],
  ) {
    await this.ouverte(id);
    const uniques = [...new Set(militaireIds)];
    const existants = await this.prisma.militaire.count({
      where: { id: { in: uniques } },
    });
    if (existants !== uniques.length)
      throw new NotFoundException('Un des militaires est introuvable.');
    const { count } = await this.prisma.dossier.createMany({
      data: uniques.map((militaireId) => ({
        campagneId: id,
        militaireId,
        creePar: u.id,
      })),
      skipDuplicates: true,
    });
    await this.audit.journaliser(
      u,
      ActionAudit.CREATION,
      'Dossier',
      undefined,
      {
        campagneId: id,
        ajoutes: count,
      },
    );
    return { ajoutes: count, dejaPresents: uniques.length - count };
  }

  /** Tableau Excel des dossiers de la campagne, pour la hiérarchie. */
  async exporter(u: UtilisateurConnecte, id: string): Promise<Buffer> {
    const campagne = await this.existante(id);
    const dossiers = await this.prisma.dossier.findMany({
      where: { campagneId: id },
      include: {
        militaire: true,
        operateur: { select: { prenoms: true, nom: true } },
      },
      orderBy: [
        { militaire: { nom: 'asc' } },
        { militaire: { prenoms: 'asc' } },
      ],
    });
    const classeur = new ExcelJS.Workbook();
    const feuille = classeur.addWorksheet('Dossiers');
    feuille.columns = [
      { header: 'Matricule', key: 'matricule', width: 14 },
      { header: 'Grade', key: 'grade', width: 14 },
      { header: 'Nom', key: 'nom', width: 22 },
      { header: 'Prénoms', key: 'prenoms', width: 26 },
      { header: 'Unité', key: 'unite', width: 20 },
      { header: 'Statut', key: 'statut', width: 22 },
      { header: 'N° de demande', key: 'numero', width: 20 },
      { header: 'Rendez-vous', key: 'rdv', width: 18 },
      { header: 'Opérateur', key: 'operateur', width: 22 },
      { header: 'Dernière modification', key: 'modifie', width: 20 },
    ];
    for (const d of dossiers)
      feuille.addRow({
        matricule: d.militaire.matricule,
        grade: d.militaire.grade,
        nom: d.militaire.nom,
        prenoms: d.militaire.prenoms,
        unite: d.militaire.unite,
        statut: LIBELLES_STATUT[d.statut],
        numero: d.numeroDemande,
        rdv: d.dateRendezVous,
        operateur: d.operateur
          ? `${d.operateur.prenoms} ${d.operateur.nom}`
          : '',
        modifie: d.modifieLe,
      });
    feuille.getRow(1).font = { bold: true };
    feuille.views = [{ state: 'frozen', ySplit: 1 }];
    feuille.autoFilter = { from: 'A1', to: 'J1' };
    await this.audit.journaliser(u, ActionAudit.EXPORT, 'Campagne', id, {
      dossiers: dossiers.length,
      libelle: campagne.libelle,
    });
    return Buffer.from(await classeur.xlsx.writeBuffer());
  }

  /**
   * Efface les fichiers des pièces d'une campagne close (cahier des charges, 7.4) ;
   * la liste des pièces reste, marquée « purgée ».
   */
  async purgerPieces(u: UtilisateurConnecte, id: string) {
    const campagne = await this.existante(id);
    if (campagne.statut !== StatutCampagne.CLOSE)
      throw new BadRequestException(
        "Clôturez la campagne avant d'effacer ses pièces.",
      );
    const pieces = await this.prisma.piece.findMany({
      where: { dossier: { campagneId: id }, purgeeLe: null },
      select: { id: true, cleStockage: true },
    });
    for (const p of pieces) await this.stockage.supprimer(p.cleStockage);
    await this.prisma.piece.updateMany({
      where: { id: { in: pieces.map((p) => p.id) } },
      data: { purgeeLe: new Date() },
    });
    await this.audit.journaliser(u, ActionAudit.SUPPRESSION, 'Campagne', id, {
      piecesPurgees: pieces.length,
    });
    return { piecesPurgees: pieces.length };
  }

  async existante(id: string) {
    const campagne = await this.prisma.campagne.findUnique({ where: { id } });
    if (!campagne) throw new NotFoundException('Campagne introuvable.');
    return campagne;
  }

  private async ouverte(id: string) {
    const campagne = await this.existante(id);
    if (campagne.statut === StatutCampagne.CLOSE)
      throw new ConflictException('Cette campagne est close.');
    return campagne;
  }
}
