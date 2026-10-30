import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { UtilisateurConnecte } from '../auth/auth.types.js';
import { page, sauter, type PaginationDto } from '../common/pagination.js';
import { versLatin } from '../common/texte.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ActionAudit,
  Role,
  Sexe,
  StatutCampagne,
  StatutDossier,
  TypeMessage,
} from '../generated/prisma/enums.js';
import { MessagesService } from '../messages/messages.service.js';
import { conformite } from '../parametres/exigences.regles.js';
import { ParametresService } from '../parametres/parametres.service.js';
import { MESSAGE_MRZ_ILLISIBLE } from '../mrz/mrz.controller.js';
import { lireMrz } from '../mrz/mrz.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  appliquer,
  controler,
  fusionner,
  lireValeurs,
  nombreBloquants,
  repartir,
  type Anomalie,
  type Valeurs,
} from '../referentiel/donnees.js';
import { PIECES, piecesDeCampagne } from '../referentiel/pieces.js';
import type { ChangementStatutDto } from './dossiers.dto.js';
import { genererFiche } from './fiche-pdf.js';
import {
  peutModifierDonnees,
  refusTransition,
  suivantsPossibles,
} from './statuts.regles.js';

const INCLUSION = {
  militaire: true,
  campagne: true,
  operateur: { select: { id: true, prenoms: true, nom: true } },
  pieces: {
    omit: { cleStockage: true },
    orderBy: { creeLe: 'asc' },
  },
} satisfies Prisma.DossierInclude;

type DossierComplet = Prisma.DossierGetPayload<{ include: typeof INCLUSION }>;

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

/** Réponses de la fiche du militaire : colonnes et profil réunis. */
export function valeursFiche(m: DossierComplet['militaire']): Valeurs {
  const colonnes: Record<string, string | null | undefined> = {
    nom: m.nom,
    prenoms: m.prenoms,
    sexe: m.sexe,
    dateNaissance: iso(m.dateNaissance),
    telephone: m.telephone,
    email: m.email,
    grade: m.grade,
  };
  return {
    ...lireValeurs(m.profil),
    ...(Object.fromEntries(
      Object.entries(colonnes).filter(([, v]) => v),
    ) as Valeurs),
  };
}

/** Réponses effectives et anomalies (champs et pièces manquantes). */
export function analyserDossier(dossier: DossierComplet) {
  const { valeurs, origines } = fusionner(
    valeursFiche(dossier.militaire),
    lireValeurs(dossier.campagne.valeursCommunes),
    lireValeurs(dossier.donnees),
  );
  const anomalies: Anomalie[] = controler(dossier.campagne.pays, valeurs);
  const deposees = new Set(
    dossier.pieces.filter((p) => !p.purgeeLe).map((p) => p.type),
  );
  for (const code of piecesDeCampagne(
    dossier.campagne.pays,
    dossier.campagne.piecesExigees,
  ))
    if (!deposees.has(code))
      anomalies.push({
        champ: null,
        message: `Pièce manquante : ${PIECES.find((p) => p.code === code)?.libelle ?? code}.`,
        niveau: 'BLOQUANT',
      });
  return { valeurs, origines, anomalies };
}

export type { DossierComplet };

@Injectable()
export class DossiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly messages: MessagesService,
    private readonly parametres: ParametresService,
  ) {}

  async lister(
    u: UtilisateurConnecte,
    filtre: {
      campagneId?: string;
      statut?: StatutDossier;
      operateur?: string;
      q?: string;
    },
    pagination: PaginationDto,
  ) {
    const q = filtre.q ? versLatin(filtre.q) : undefined;
    const where: Prisma.DossierWhereInput = {
      campagneId: filtre.campagneId,
      statut: filtre.statut,
      operateurId:
        filtre.operateur === 'moi' ? u.id : filtre.operateur || undefined,
      ...(q
        ? {
            militaire: {
              OR: [
                { matricule: { contains: q.replace(/\s/g, '') } },
                { nom: { contains: q } },
                { prenoms: { contains: q } },
              ],
            },
          }
        : {}),
    };
    const [elements, total] = await this.prisma.$transaction([
      this.prisma.dossier.findMany({
        where,
        orderBy: [
          { militaire: { nom: 'asc' } },
          { militaire: { prenoms: 'asc' } },
        ],
        ...sauter(pagination),
        select: {
          id: true,
          statut: true,
          numeroDemande: true,
          dateRendezVous: true,
          modifieLe: true,
          militaire: {
            select: {
              id: true,
              matricule: true,
              grade: true,
              nom: true,
              prenoms: true,
            },
          },
          campagne: { select: { id: true, libelle: true, pays: true } },
          operateur: { select: { id: true, prenoms: true, nom: true } },
          _count: { select: { pieces: true } },
        },
      }),
      this.prisma.dossier.count({ where }),
    ]);
    return page(elements, total, pagination);
  }

  /** Dossier avec militaire, campagne et pièces (espace du militaire, suivi). */
  async charger(id: string): Promise<DossierComplet> {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id },
      include: INCLUSION,
    });
    if (!dossier) throw new NotFoundException('Dossier introuvable.');
    return dossier;
  }

  /** Dossiers d'une campagne, complets (tableau de bord et alertes). */
  chargerCampagne(campagneId: string): Promise<DossierComplet[]> {
    return this.prisma.dossier.findMany({
      where: { campagneId },
      include: INCLUSION,
      orderBy: [
        { militaire: { nom: 'asc' } },
        { militaire: { prenoms: 'asc' } },
      ],
    });
  }

  private analyser(dossier: DossierComplet) {
    return analyserDossier(dossier);
  }

  async detail(u: UtilisateurConnecte, id: string) {
    const dossier = await this.charger(id);
    const historique = await this.prisma.historiqueStatut.findMany({
      where: { dossierId: id },
      orderBy: { creeLe: 'desc' },
      include: {
        utilisateur: { select: { prenoms: true, nom: true, role: true } },
      },
    });
    await this.audit.journaliser(u, ActionAudit.CONSULTATION, 'Dossier', id);
    const { militaire, campagne, ...reste } = dossier;
    const { valeursCommunes: _, ...infosCampagne } = campagne;
    const exigences = await this.parametres.exigences(campagne.pays);
    return {
      ...reste,
      donnees: undefined,
      // Indicateur « conforme / non conforme » au site du pays (F5.3).
      pieces: reste.pieces.map((p) => ({
        ...p,
        conformite: p.purgeeLe ? null : conformite(p, exigences),
      })),
      militaire: {
        id: militaire.id,
        matricule: militaire.matricule,
        grade: militaire.grade,
        nom: militaire.nom,
        prenoms: militaire.prenoms,
        unite: militaire.unite,
      },
      campagne: {
        ...infosCampagne,
        pieces: piecesDeCampagne(campagne.pays, campagne.piecesExigees),
      },
      ...this.analyser(dossier),
      historique,
      suivants: suivantsPossibles(u.role, dossier.statut),
      modifiable:
        campagne.statut === StatutCampagne.OUVERTE &&
        peutModifierDonnees(u.role, dossier.statut),
    };
  }

  /**
   * Enregistre des réponses : les champs MILITAIRE vont dans la fiche (réutilisée
   * par les campagnes suivantes), les champs DOSSIER dans le dossier.
   */
  async modifierDonnees(
    u: UtilisateurConnecte,
    id: string,
    saisie: Record<string, unknown>,
  ) {
    const dossier = await this.charger(id);
    this.verifierModifiable(u, dossier);
    await this.enregistrerReponses(u, dossier, saisie);
    return this.detail(u, id);
  }

  /**
   * Enregistrement sans contrôle des droits (fait par l'appelant) ; `u` null :
   * le militaire dans son espace.
   */
  async enregistrerReponses(
    u: UtilisateurConnecte | null,
    dossier: DossierComplet,
    saisie: Record<string, unknown>,
  ): Promise<void> {
    const id = dossier.id;
    const { colonnes, profil, dossier: propres, erreurs } = repartir(saisie);
    if (erreurs.length)
      throw new BadRequestException(erreurs.map((e) => e.message));
    if (colonnes.nom === null || colonnes.prenoms === null)
      throw new BadRequestException('Le nom et les prénoms sont obligatoires.');

    const champsColonnes: Prisma.MilitaireUpdateInput = {};
    for (const [champ, valeur] of Object.entries(colonnes)) {
      if (champ === 'dateNaissance')
        champsColonnes.dateNaissance = valeur
          ? new Date(`${valeur}T00:00:00Z`)
          : null;
      else if (champ === 'sexe')
        champsColonnes.sexe = valeur ? (valeur as Sexe) : null;
      else (champsColonnes as Record<string, string | null>)[champ] = valeur;
    }

    await this.prisma.$transaction([
      this.prisma.militaire.update({
        where: { id: dossier.militaireId },
        data: {
          ...champsColonnes,
          profil: appliquer(lireValeurs(dossier.militaire.profil), profil),
        },
      }),
      this.prisma.dossier.update({
        where: { id },
        data: { donnees: appliquer(lireValeurs(dossier.donnees), propres) },
      }),
    ]);
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Dossier', id, {
      champs: Object.keys(saisie),
      ...(u ? {} : { par: 'MILITAIRE' }),
    });
  }

  /** Lecture de la MRZ du passeport, puis enregistrement des valeurs si les contrôles sont justes. */
  async appliquerMrz(u: UtilisateurConnecte, id: string, texte: string) {
    const resultat = lireMrz(texte);
    if (!resultat)
      throw new UnprocessableEntityException(MESSAGE_MRZ_ILLISIBLE);
    if (!resultat.valide)
      throw new UnprocessableEntityException(
        'Les chiffres de contrôle de la MRZ ne correspondent pas : relisez les deux lignes (0 et O, 1 et I, 5 et S…).',
      );
    const valeurs = Object.fromEntries(
      Object.entries(resultat.champs).filter(([, v]) => v),
    );
    return this.modifierDonnees(u, id, valeurs);
  }

  async changerStatut(
    u: UtilisateurConnecte,
    id: string,
    dto: ChangementStatutDto,
  ) {
    const dossier = await this.charger(id);
    if (dossier.campagne.statut === StatutCampagne.CLOSE)
      throw new ConflictException('Cette campagne est close.');
    const numeroDemande = dto.numeroDemande ?? dossier.numeroDemande;
    const dateRendezVous = dto.dateRendezVous ?? dossier.dateRendezVous;
    const refus = refusTransition({
      role: u.role,
      depuis: dossier.statut,
      vers: dto.statut,
      anomaliesBloquantes:
        dto.statut === StatutDossier.VALIDE &&
        dossier.statut === StatutDossier.A_VALIDER
          ? nombreBloquants(this.analyser(dossier).anomalies)
          : 0,
      commentaire: dto.commentaire,
      numeroDemande,
      dateRendezVous,
    });
    if (refus) throw new BadRequestException(refus);

    await this.prisma.$transaction([
      this.prisma.dossier.update({
        where: { id },
        data: {
          statut: dto.statut,
          numeroDemande,
          dateRendezVous: dateRendezVous ? new Date(dateRendezVous) : null,
          ...(dto.commentaire ? { commentaire: dto.commentaire } : {}),
          // L'agent qui ouvre la saisie la prend en charge, sauf attribution déjà faite.
          ...(dto.statut === StatutDossier.EN_SAISIE && !dossier.operateurId
            ? { operateurId: u.id }
            : {}),
        },
      }),
      this.prisma.historiqueStatut.create({
        data: {
          dossierId: id,
          depuis: dossier.statut,
          vers: dto.statut,
          commentaire: dto.commentaire,
          utilisateurId: u.id,
        },
      }),
    ]);
    await this.audit.journaliser(u, ActionAudit.STATUT, 'Dossier', id, {
      depuis: dossier.statut,
      vers: dto.statut,
    });
    await this.prevenirMilitaire(dossier, dto, dateRendezVous);
    return this.detail(u, id);
  }

  /**
   * Messages automatiques au militaire : convocation quand le rendez-vous est
   * pris, motif quand la DGRECM lui renvoie sa fiche (s'il a un lien d'accès).
   */
  private async prevenirMilitaire(
    dossier: DossierComplet,
    dto: ChangementStatutDto,
    dateRendezVous: Date | string | null | undefined,
  ): Promise<void> {
    if (dto.statut === StatutDossier.RDV_PRIS && dateRendezVous) {
      const iso = new Date(dateRendezVous).toISOString();
      await this.messages.enfiler(
        dossier.id,
        TypeMessage.CONVOCATION_DEPOT,
        { dateRendezVous: iso },
        { cle: `CONVOCATION_DEPOT:${dossier.id}:${iso}` },
      );
    }
    if (
      dto.statut === StatutDossier.A_COMPLETER &&
      (await this.prisma.accesMilitaire.count({
        where: { dossierId: dossier.id },
      }))
    )
      await this.messages.enfiler(dossier.id, TypeMessage.RENVOI_FICHE, {
        motif: dto.commentaire ?? '',
      });
  }

  async attribuer(
    u: UtilisateurConnecte,
    id: string,
    operateurId: string | null,
  ) {
    await this.charger(id);
    if (operateurId) {
      const agent = await this.prisma.utilisateur.findUnique({
        where: { id: operateurId },
        select: { actif: true, role: true },
      });
      if (!agent?.actif || agent.role === Role.LECTEUR)
        throw new BadRequestException(
          'Cet agent ne peut pas recevoir de dossiers.',
        );
    }
    await this.prisma.dossier.update({ where: { id }, data: { operateurId } });
    await this.audit.journaliser(u, ActionAudit.MODIFICATION, 'Dossier', id, {
      operateurId,
    });
    return this.detail(u, id);
  }

  /** Fiche récapitulative PDF (dépôt à l'ambassade). */
  async fiche(u: UtilisateurConnecte, id: string): Promise<Buffer> {
    const dossier = await this.charger(id);
    const { valeurs, anomalies } = this.analyser(dossier);
    await this.audit.journaliser(u, ActionAudit.EXPORT, 'Dossier', id, {
      fiche: true,
    });
    return genererFiche({
      militaire: dossier.militaire,
      campagne: dossier.campagne,
      statut: dossier.statut,
      numeroDemande: dossier.numeroDemande,
      dateRendezVous: dossier.dateRendezVous,
      valeurs,
      pieces: piecesDeCampagne(
        dossier.campagne.pays,
        dossier.campagne.piecesExigees,
      ).map((code) => ({
        code,
        deposee: dossier.pieces.some((p) => p.type === code && !p.purgeeLe),
      })),
      anomaliesBloquantes: nombreBloquants(anomalies),
    });
  }

  /** Vérifie que l'utilisateur peut modifier ce dossier (statut, campagne ouverte). */
  verifierModifiable(
    u: UtilisateurConnecte,
    dossier: {
      statut: StatutDossier;
      campagne: { statut: StatutCampagne };
    },
  ): void {
    if (dossier.campagne.statut === StatutCampagne.CLOSE)
      throw new ConflictException('Cette campagne est close.');
    if (!peutModifierDonnees(u.role, dossier.statut))
      throw new ForbiddenException(
        dossier.statut === StatutDossier.A_VALIDER
          ? 'Le dossier attend la validation de la DGRECM : seule la gestion peut le corriger.'
          : 'Ce dossier est validé : il faut le rouvrir (retour « À compléter ») pour le modifier.',
      );
  }

  /**
   * Le militaire ne modifie sa fiche que tant qu'il ne l'a pas envoyée, ou
   * quand la DGRECM la lui renvoie (cahier des charges, F3.4).
   */
  verifierModifiableParMilitaire(dossier: {
    statut: StatutDossier;
    campagne: { statut: StatutCampagne };
  }): void {
    if (dossier.campagne.statut === StatutCampagne.CLOSE)
      throw new ConflictException('Cette campagne est close.');
    if (dossier.statut !== StatutDossier.A_COMPLETER)
      throw new ForbiddenException(
        'Votre fiche a été envoyée à la DGRECM : elle ne peut plus être modifiée. Contactez la DGRECM pour une correction.',
      );
  }
}
