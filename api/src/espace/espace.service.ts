import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import {
  analyserDossier,
  DossiersService,
} from '../dossiers/dossiers.service.js';
import { LIBELLES_STATUT } from '../dossiers/statuts.regles.js';
import {
  ActionAudit,
  StatutCampagne,
  StatutDossier,
} from '../generated/prisma/enums.js';
import { PiecesService } from '../pieces/pieces.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CodePiece } from '../referentiel/pieces.js';
import {
  CHAMPS_MILITAIRE,
  etapes,
  IDS_CHAMPS_MILITAIRE,
  piecesDuMilitaire,
} from './champs-militaire.js';

/**
 * Espace du militaire (cahier des charges, 5.3) : sa fiche seulement, par
 * étapes courtes, enregistrée au fil de la saisie, puis envoyée à la DGRECM.
 */
@Injectable()
export class EspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dossiers: DossiersService,
    private readonly pieces: PiecesService,
    private readonly audit: AuditService,
  ) {}

  async lire(dossierId: string) {
    const d = await this.dossiers.charger(dossierId);
    const { valeurs, anomalies } = analyserDossier(d);
    const pays = d.campagne.pays;
    const erreurs = Object.fromEntries(
      anomalies
        .filter((a) => a.champ && IDS_CHAMPS_MILITAIRE.has(a.champ))
        .map((a) => [a.champ, a.message]),
    );
    const sections = etapes().map((s) => {
      const champs = CHAMPS_MILITAIRE.filter((c) => c.section === s.code);
      return {
        ...s,
        champs: champs.map((c) => ({ ...c, valeur: valeurs[c.id] ?? null })),
        remplis: champs.filter((c) => valeurs[c.id]).length,
        obligatoiresManquants: champs.filter(
          (c) => c.obligatoire.includes(pays) && !valeurs[c.id],
        ).length,
      };
    });
    const modifiable =
      d.statut === StatutDossier.A_COMPLETER &&
      d.campagne.statut === StatutCampagne.OUVERTE;
    return {
      statut: d.statut,
      libelleStatut: LIBELLES_STATUT[d.statut],
      // Motif du renvoi par la DGRECM, à corriger.
      commentaire:
        d.statut === StatutDossier.A_COMPLETER ? d.commentaire : null,
      modifiable,
      campagne: {
        libelle: d.campagne.libelle,
        pays,
        dateLimiteFiche:
          d.campagne.dateLimiteFiche?.toISOString().slice(0, 10) ?? null,
      },
      militaire: {
        grade: d.militaire.grade,
        nom: d.militaire.nom,
        prenoms: d.militaire.prenoms,
      },
      numeroDemande: d.numeroDemande,
      dateRendezVous: d.dateRendezVous,
      sections,
      erreurs,
      pieces: piecesDuMilitaire(pays, d.campagne.piecesExigees).map((p) => {
        const deposee = d.pieces.find((x) => x.type === p.code && !x.purgeeLe);
        return {
          ...p,
          deposee: deposee
            ? {
                id: deposee.id,
                nomFichier: deposee.nomFichier,
                creeLe: deposee.creeLe,
              }
            : null,
        };
      }),
      reponsesObligatoiresManquantes: sections.reduce(
        (n, s) => n + s.obligatoiresManquants,
        0,
      ),
    };
  }

  /** Enregistrement (au fil de la saisie ou par étape) : seulement ses propres questions. */
  async enregistrer(dossierId: string, saisie: Record<string, unknown>) {
    const interdits = Object.keys(saisie).filter(
      (id) => !IDS_CHAMPS_MILITAIRE.has(id),
    );
    if (interdits.length)
      throw new BadRequestException(
        `Question non modifiable dans votre espace : ${interdits.join(', ')}.`,
      );
    const d = await this.dossiers.charger(dossierId);
    this.dossiers.verifierModifiableParMilitaire(d);
    await this.dossiers.enregistrerReponses(null, d, saisie);
    return this.lire(dossierId);
  }

  async deposerPiece(
    dossierId: string,
    type: CodePiece,
    fichier: { buffer: Buffer; originalname: string },
  ) {
    const d = await this.dossiers.charger(dossierId);
    if (
      !piecesDuMilitaire(d.campagne.pays, d.campagne.piecesExigees).some(
        (p) => p.code === type,
      )
    )
      throw new BadRequestException('Cette pièce n’est pas demandée.');
    const { avertissements } = await this.pieces.deposer(
      null,
      dossierId,
      type,
      fichier,
    );
    return { avertissements };
  }

  supprimerPiece(dossierId: string, pieceId: string) {
    return this.pieces.supprimer(null, pieceId, dossierId);
  }

  /**
   * Envoi à la DGRECM : la fiche n'est plus modifiable par le militaire, sauf
   * renvoi par un gestionnaire (F3.4). Les pièces manquantes n'empêchent pas
   * l'envoi (la DGRECM peut les ajouter) ; les réponses obligatoires, si.
   */
  async envoyer(dossierId: string) {
    const d = await this.dossiers.charger(dossierId);
    this.dossiers.verifierModifiableParMilitaire(d);
    const { reponsesObligatoiresManquantes, erreurs } =
      await this.lire(dossierId);
    if (reponsesObligatoiresManquantes > 0)
      throw new BadRequestException(
        `Il manque ${reponsesObligatoiresManquantes} réponse(s) obligatoire(s) : complétez les étapes signalées avant d’envoyer.`,
      );
    if (Object.keys(erreurs).length)
      throw new BadRequestException(
        `Corrigez d’abord ${Object.keys(erreurs).length} réponse(s) signalée(s) en rouge.`,
      );
    await this.prisma.$transaction([
      this.prisma.dossier.update({
        where: { id: dossierId },
        data: { statut: StatutDossier.A_VALIDER },
      }),
      this.prisma.historiqueStatut.create({
        data: {
          dossierId,
          depuis: StatutDossier.A_COMPLETER,
          vers: StatutDossier.A_VALIDER,
          commentaire: 'Fiche envoyée par le militaire depuis son espace.',
        },
      }),
    ]);
    await this.audit.journaliser(
      null,
      ActionAudit.STATUT,
      'Dossier',
      dossierId,
      {
        depuis: StatutDossier.A_COMPLETER,
        vers: StatutDossier.A_VALIDER,
        par: 'MILITAIRE',
      },
    );
    return this.lire(dossierId);
  }
}
