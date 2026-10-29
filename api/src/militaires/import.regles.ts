import { cleEntete, versLatin } from '../common/texte.js';
import {
  estDateValide,
  REGEX_EMAIL,
  REGEX_TELEPHONE,
  versE164,
} from '../common/validation.js';
import { Sexe } from '../generated/prisma/enums.js';
import { versDateIso } from '../referentiel/donnees.js';

/** Colonnes reconnues dans le fichier de la DGRECM (en-têtes souples, sans accent ni casse). */
const COLONNES = {
  matricule: ['matricule', 'mle', 'numeromatricule', 'nmatricule'],
  grade: ['grade'],
  nom: ['nom', 'noms', 'nomdefamille'],
  prenoms: ['prenoms', 'prenom'],
  sexe: ['sexe', 'genre'],
  dateNaissance: ['datedenaissance', 'datenaissance', 'nele', 'neele'],
  unite: ['unite', 'corps', 'service', 'affectation'],
  telephone: ['telephone', 'tel', 'contact', 'numero'],
  email: ['email', 'mail', 'courriel', 'adresseemail'],
} as const;

type Colonne = keyof typeof COLONNES;

export const COLONNES_OBLIGATOIRES: Colonne[] = ['matricule', 'nom', 'prenoms'];

export interface MilitaireImporte {
  ligne: number;
  matricule: string;
  grade: string | null;
  nom: string;
  prenoms: string;
  sexe: Sexe | null;
  dateNaissance: string | null;
  unite: string | null;
  telephone: string | null;
  email: string | null;
}

export interface AnalyseImport {
  valides: MilitaireImporte[];
  erreurs: { ligne: number; messages: string[] }[];
  /** Colonnes du fichier qui n'ont pas été reconnues (ignorées). */
  colonnesIgnorees: string[];
}

/** Indice de chaque colonne connue dans la ligne d'en-tête. */
export function reperer(entetes: string[]): {
  positions: Partial<Record<Colonne, number>>;
  ignorees: string[];
} {
  const positions: Partial<Record<Colonne, number>> = {};
  const ignorees: string[] = [];
  entetes.forEach((entete, i) => {
    const cle = cleEntete(entete);
    const colonne = (Object.keys(COLONNES) as Colonne[]).find(
      (c) =>
        positions[c] === undefined &&
        (COLONNES[c] as readonly string[]).includes(cle),
    );
    if (colonne) positions[colonne] = i;
    else if (entete.trim()) ignorees.push(entete.trim());
  });
  return { positions, ignorees };
}

function lireSexe(valeur: string): Sexe | null | undefined {
  const v = versLatin(valeur);
  if (!v) return null;
  if (['M', 'H', 'MASCULIN', 'HOMME'].includes(v)) return Sexe.MASCULIN;
  if (['F', 'FEMININ', 'FEMME'].includes(v)) return Sexe.FEMININ;
  return undefined;
}

/**
 * Analyse les lignes d'un fichier Excel ou CSV (première ligne : en-têtes).
 * Les cellules sont déjà converties en texte (dates en « AAAA-MM-JJ »).
 * `numerosLigne` : numéro de chaque ligne dans le fichier, pour les messages.
 */
export function analyserImport(
  entetes: string[],
  lignes: string[][],
  numerosLigne: number[] = lignes.map((_, i) => i + 2),
): AnalyseImport {
  const { positions, ignorees } = reperer(entetes);
  const manquantes = COLONNES_OBLIGATOIRES.filter(
    (c) => positions[c] === undefined,
  );
  if (manquantes.length)
    return {
      valides: [],
      erreurs: [
        {
          ligne: 1,
          messages: [
            `Colonnes obligatoires absentes : ${manquantes.join(', ')}. La première ligne doit contenir les en-têtes (Matricule, Nom, Prénoms…).`,
          ],
        },
      ],
      colonnesIgnorees: ignorees,
    };

  const valides: MilitaireImporte[] = [];
  const erreurs: AnalyseImport['erreurs'] = [];
  const vus = new Map<string, number>();

  lignes.forEach((cellules, i) => {
    const ligne = numerosLigne[i];
    const lire = (c: Colonne) => {
      const p = positions[c];
      return p === undefined ? '' : (cellules[p] ?? '').trim();
    };
    // Ligne entièrement vide : ignorée.
    if (cellules.every((c) => !c?.trim())) return;

    const messages: string[] = [];
    const matricule = versLatin(lire('matricule')).replace(/\s/g, '');
    const nom = versLatin(lire('nom'));
    const prenoms = versLatin(lire('prenoms'));
    if (!matricule) messages.push('Matricule manquant.');
    if (!nom) messages.push('Nom manquant.');
    if (!prenoms) messages.push('Prénoms manquants.');

    const sexe = lireSexe(lire('sexe'));
    if (sexe === undefined)
      messages.push(`Sexe « ${lire('sexe')} » non reconnu (M ou F).`);

    let dateNaissance: string | null = null;
    if (lire('dateNaissance')) {
      dateNaissance = versDateIso(lire('dateNaissance'));
      if (!estDateValide(dateNaissance)) {
        messages.push(
          `Date de naissance « ${lire('dateNaissance')} » invalide (JJ/MM/AAAA).`,
        );
        dateNaissance = null;
      }
    }

    let telephone: string | null = null;
    if (lire('telephone')) {
      telephone = versE164(lire('telephone'));
      if (!REGEX_TELEPHONE.test(telephone))
        messages.push(`Téléphone « ${lire('telephone')} » invalide.`);
    }

    const email = lire('email').toLowerCase() || null;
    if (email && !REGEX_EMAIL.test(email))
      messages.push(`Email « ${email} » invalide.`);

    if (matricule) {
      const premiere = vus.get(matricule);
      if (premiere)
        messages.push(
          `Matricule ${matricule} déjà présent ligne ${premiere} du fichier.`,
        );
      else vus.set(matricule, ligne);
    }

    if (messages.length) {
      erreurs.push({ ligne, messages });
      return;
    }
    valides.push({
      ligne,
      matricule,
      grade: lire('grade') || null,
      nom,
      prenoms,
      sexe: sexe ?? null,
      dateNaissance,
      unite: lire('unite') || null,
      telephone,
      email,
    });
  });

  return { valides, erreurs, colonnesIgnorees: ignorees };
}
