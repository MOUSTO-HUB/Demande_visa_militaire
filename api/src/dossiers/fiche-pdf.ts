// Fiche récapitulative d'un dossier, imprimée pour le dépôt à l'ambassade.
import PDFDocument from 'pdfkit';
import type { PaysAccueil, StatutDossier } from '../generated/prisma/enums.js';
import { CHAMPS, SECTIONS } from '../referentiel/champs.js';
import type { Valeurs } from '../referentiel/donnees.js';
import { PIECES, type CodePiece } from '../referentiel/pieces.js';
import { LIBELLES_STATUT } from './statuts.regles.js';

export interface DonneesFiche {
  militaire: {
    matricule: string;
    grade: string | null;
    nom: string;
    prenoms: string;
    unite: string | null;
  };
  campagne: { libelle: string; pays: PaysAccueil; typeVisa: string };
  statut: StatutDossier;
  numeroDemande: string | null;
  dateRendezVous: Date | null;
  valeurs: Valeurs;
  pieces: { code: CodePiece; deposee: boolean }[];
  anomaliesBloquantes: number;
}

const MARGE = 36;
const LARGEUR = 595.28 - 2 * MARGE;
const BAS_DE_PAGE = 841.89 - MARGE - 20;
const ENCRE = '#18181b';
const GRIS = '#52525b';
const TRAIT = '#d4d4d8';
const PAYS: Record<PaysAccueil, string> = { CHINE: 'Chine', RUSSIE: 'Russie' };

const jourFr = (jour: string) => jour.split('-').reverse().join('/');

/** Valeur lisible : dates en JJ/MM/AAAA, libellés des listes. */
function lisible(id: string, valeur: string): string {
  const champ = CHAMPS.find((c) => c.id === id);
  if (champ?.type === 'date') return jourFr(valeur);
  if (champ?.type === 'oui_non') return valeur === 'OUI' ? 'Oui' : 'Non';
  return champ?.options?.find((o) => o.valeur === valeur)?.libelle ?? valeur;
}

export async function genererFiche(d: DonneesFiche): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGE,
    info: {
      Title: `Dossier de visa – ${d.militaire.nom} ${d.militaire.prenoms}`,
      Author: 'DGRECM',
    },
  });
  const morceaux: Buffer[] = [];
  doc.on('data', (m: Buffer) => morceaux.push(m));
  const fini = new Promise<Buffer>((ok, ko) => {
    doc.on('end', () => ok(Buffer.concat(morceaux)));
    doc.on('error', ko);
  });

  const nouvelleLigneSiBesoin = (hauteur: number) => {
    if (doc.y + hauteur > BAS_DE_PAGE) doc.addPage();
  };

  // En-tête
  doc
    .fillColor(GRIS)
    .font('Helvetica')
    .fontSize(9)
    .text('RÉPUBLIQUE DE GUINÉE – Ministère de la Défense nationale')
    .text(
      'Direction Générale des Relations Extérieures et de la Coopération Militaire',
    );
  doc
    .moveDown(0.8)
    .fillColor(ENCRE)
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(`Demande de visa d'études – ${PAYS[d.campagne.pays]}`);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(GRIS)
    .text(`${d.campagne.libelle} · visa ${d.campagne.typeVisa}`);

  // Encadré identité et suivi
  doc.moveDown(0.6);
  const haut = doc.y;
  doc.rect(MARGE, haut, LARGEUR, 74).strokeColor(TRAIT).stroke();
  doc
    .fillColor(ENCRE)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(`${d.militaire.nom} ${d.militaire.prenoms}`, MARGE + 10, haut + 10, {
      width: LARGEUR / 2,
    });
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(GRIS)
    .text(
      [
        `Matricule ${d.militaire.matricule}`,
        d.militaire.grade,
        d.militaire.unite,
      ]
        .filter(Boolean)
        .join(' · '),
      { width: LARGEUR / 2 },
    );
  const droite = MARGE + LARGEUR / 2 + 10;
  const rdv = d.dateRendezVous
    ? d.dateRendezVous.toLocaleString('fr-FR', {
        timeZone: 'Africa/Conakry',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—';
  doc
    .fillColor(ENCRE)
    .fontSize(9.5)
    .text(`Statut : ${LIBELLES_STATUT[d.statut]}`, droite, haut + 10, {
      width: LARGEUR / 2 - 20,
    })
    .text(`N° de demande : ${d.numeroDemande ?? '—'}`)
    .text(`Rendez-vous : ${rdv}`);
  if (d.anomaliesBloquantes)
    doc
      .fillColor('#b91c1c')
      .text(
        `${d.anomaliesBloquantes} point(s) bloquant(s) à corriger avant le dépôt.`,
      );
  doc.x = MARGE;
  doc.y = haut + 86;

  // Pièces à apporter
  doc
    .fillColor(ENCRE)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Pièces à apporter', MARGE);
  doc.moveDown(0.3).font('Helvetica').fontSize(9.5);
  for (const piece of d.pieces) {
    const libelle =
      PIECES.find((p) => p.code === piece.code)?.libelle ?? piece.code;
    doc
      .fillColor(piece.deposee ? ENCRE : '#b91c1c')
      .text(
        `[${piece.deposee ? 'x' : ' '}]  ${libelle}${piece.deposee ? '' : ' (non déposée dans le dossier)'}`,
      );
  }
  doc
    .fillColor(GRIS)
    .text('[ ]  Formulaire imprimé et signé depuis le site officiel');

  // Réponses, par section
  for (const section of SECTIONS) {
    const lignes = CHAMPS.filter(
      (c) => c.section === section.code && d.valeurs[c.id],
    );
    if (!lignes.length) continue;
    doc.moveDown(0.8);
    nouvelleLigneSiBesoin(40);
    doc
      .fillColor(ENCRE)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(section.libelle, MARGE);
    doc
      .moveTo(MARGE, doc.y + 2)
      .lineTo(MARGE + LARGEUR, doc.y + 2)
      .strokeColor(TRAIT)
      .stroke();
    doc.moveDown(0.4);
    for (const champ of lignes) {
      const valeur = lisible(champ.id, d.valeurs[champ.id]);
      const hauteur = Math.max(
        doc.heightOfString(champ.libelle, { width: 190 }),
        doc.heightOfString(valeur, { width: LARGEUR - 200 }),
      );
      nouvelleLigneSiBesoin(hauteur + 4);
      const y = doc.y;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(GRIS)
        .text(champ.libelle, MARGE, y, { width: 190 });
      doc
        .fillColor(ENCRE)
        .text(valeur, MARGE + 200, y, { width: LARGEUR - 200 });
      doc.x = MARGE;
      doc.y = y + hauteur + 3;
    }
  }

  doc
    .moveDown(1)
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor(GRIS)
    .text(
      `Fiche éditée le ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Africa/Conakry' })}. Document à usage interne : données personnelles, ne pas diffuser.`,
      MARGE,
    );
  doc.end();
  return fini;
}
