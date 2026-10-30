import { Injectable, NotFoundException } from '@nestjs/common';
import {
  analyserDossier,
  DossiersService,
} from '../dossiers/dossiers.service.js';
import {
  ModeCorrespondance,
  PaysAccueil,
  StatutCampagne,
  StatutDossier,
  StatutMessage,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { nombreBloquants } from '../referentiel/donnees.js';
import { alertesDossier, type Alerte } from './alertes.regles.js';

const NIVEAUX = { URGENT: 0, ATTENTION: 1 } as const;

/** Alerte sur un site officiel, avec le lien vers ses correspondances. */
type AlerteSite = Alerte & { lien: string };

/** Tableau de bord par campagne (F7.1) et alertes (F7.3). */
@Injectable()
export class SuiviService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dossiers: DossiersService,
  ) {}

  async campagne(campagneId: string, aujourdhui = new Date()) {
    const campagne = await this.prisma.campagne.findUnique({
      where: { id: campagneId },
      select: {
        id: true,
        libelle: true,
        pays: true,
        statut: true,
        dateLimiteFiche: true,
      },
    });
    if (!campagne) throw new NotFoundException('Campagne introuvable.');
    const jour = aujourdhui.toISOString().slice(0, 10);
    const [dossiers, acces, messages] = await Promise.all([
      this.dossiers.chargerCampagne(campagneId),
      this.prisma.accesMilitaire.findMany({
        where: { dossier: { campagneId } },
        select: { dossierId: true, expireLe: true, derniereConnexion: true },
      }),
      // Dernier message de chaque dossier.
      this.prisma.message.findMany({
        where: { dossier: { campagneId } },
        orderBy: { creeLe: 'desc' },
        distinct: ['dossierId'],
        select: { dossierId: true, statut: true, erreur: true },
      }),
    ]);
    const accesPar = new Map(acces.map((a) => [a.dossierId, a]));
    const messagePar = new Map(messages.map((m) => [m.dossierId, m]));

    const parStatut = Object.fromEntries(
      Object.values(StatutDossier).map((s) => [s, 0]),
    ) as Record<StatutDossier, number>;
    let avecBloquants = 0;
    const lignes = dossiers.map((d) => {
      parStatut[d.statut]++;
      const { anomalies } = analyserDossier(d);
      const bloquants = nombreBloquants(anomalies);
      if (bloquants && d.statut !== StatutDossier.ABANDONNE) avecBloquants++;
      const a = accesPar.get(d.id);
      const m = messagePar.get(d.id);
      const alertes = alertesDossier(
        {
          statut: d.statut,
          anomalies,
          dateLimiteFiche:
            campagne.dateLimiteFiche?.toISOString().slice(0, 10) ?? null,
          dateRendezVous: d.dateRendezVous?.toISOString() ?? null,
          acces: !!a && a.expireLe > aujourdhui,
          echecMessage:
            m?.statut === StatutMessage.ECHEC ? (m.erreur ?? 'erreur') : null,
        },
        jour,
      );
      return {
        dossierId: d.id,
        militaire: {
          matricule: d.militaire.matricule,
          grade: d.militaire.grade,
          nom: d.militaire.nom,
          prenoms: d.militaire.prenoms,
        },
        statut: d.statut,
        anomaliesBloquantes: bloquants,
        acces: a
          ? { expireLe: a.expireLe, derniereConnexion: a.derniereConnexion }
          : null,
        alertes,
      };
    });
    const alertes = lignes
      .flatMap((l) =>
        l.alertes.map((a) => ({
          ...a,
          dossierId: l.dossierId,
          militaire: l.militaire,
        })),
      )
      .sort((x, y) => NIVEAUX[x.niveau] - NIVEAUX[y.niveau]);
    return {
      campagne: {
        ...campagne,
        dateLimiteFiche:
          campagne.dateLimiteFiche?.toISOString().slice(0, 10) ?? null,
      },
      total: dossiers.length,
      parStatut,
      indicateurs: {
        avecBloquants,
        enRetard: alertes.filter((a) => a.type === 'FICHE_EN_RETARD').length,
        liensEnvoyes: acces.length,
        connectes: acces.filter((a) => a.derniereConnexion).length,
        messagesEnEchec: messages.filter(
          (m) => m.statut === StatutMessage.ECHEC,
        ).length,
      },
      alertes,
      dossiers: lignes,
    };
  }

  /** Alertes de toutes les campagnes ouvertes, les plus urgentes d'abord. */
  async alertes(aujourdhui = new Date()) {
    const campagnes = await this.prisma.campagne.findMany({
      where: { statut: StatutCampagne.OUVERTE },
      select: { id: true },
      orderBy: { creeLe: 'desc' },
    });
    const resultat: (Alerte & {
      dossierId: string;
      militaire: { nom: string; prenoms: string; matricule: string };
      campagne: { id: string; libelle: string };
    })[] = [];
    for (const c of campagnes) {
      const suivi = await this.campagne(c.id, aujourdhui);
      for (const a of suivi.alertes)
        resultat.push({
          ...a,
          campagne: { id: c.id, libelle: suivi.campagne.libelle },
        });
    }
    return [...(await this.alertesSites()), ...resultat].sort(
      (x, y) => NIVEAUX[x.niveau] - NIVEAUX[y.niveau],
    );
  }

  /**
   * Sites officiels modifiés (risques, section 12) : champs relevés pas encore
   * reliés à une réponse du dossier, propositions à vérifier.
   */
  async alertesSites(): Promise<AlerteSite[]> {
    const groupes = await this.prisma.champSite.groupBy({
      by: ['pays', 'obligatoire', 'mode', 'propose'],
      _count: { _all: true },
    });
    const alertes: AlerteSite[] = [];
    for (const pays of Object.values(PaysAccueil)) {
      const du = groupes.filter((g) => g.pays === pays);
      const nonRelies = du
        .filter((g) => g.obligatoire && g.mode === ModeCorrespondance.A_DEFINIR)
        .reduce((n, g) => n + g._count._all, 0);
      const propositions = du
        .filter((g) => g.propose)
        .reduce((n, g) => n + g._count._all, 0);
      const lien = `/sites/${pays === PaysAccueil.CHINE ? 'chine' : 'russie'}`;
      const site = pays === PaysAccueil.CHINE ? 'COVA' : 'kdmid';
      if (nonRelies)
        alertes.push({
          type: 'SITE',
          niveau: 'URGENT',
          message: `Site ${site} : ${nonRelies} champ(s) obligatoire(s) relevé(s) mais pas encore relié(s) à une réponse du dossier.`,
          lien,
        });
      if (propositions)
        alertes.push({
          type: 'SITE',
          niveau: 'ATTENTION',
          message: `Site ${site} : ${propositions} correspondance(s) proposée(s) automatiquement à vérifier.`,
          lien,
        });
    }
    return alertes;
  }
}
