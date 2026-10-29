// Données de démonstration (développement uniquement) : comptes, une campagne
// Chine avec ses valeurs communes et trois militaires FICTIFS.
//   pnpm db:seed
import { config } from 'dotenv';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PaysAccueil, Role, Sexe } from '../src/generated/prisma/enums.js';

config({ path: ['.env', '../.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  console.error('Pas de données de démonstration en production.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const motDePasse = process.env.SEED_MOT_DE_PASSE ?? 'Visa-Dev-2026';

const COMPTES = [
  {
    email: 'admin@dgsic.test',
    prenoms: 'Admin',
    nom: 'DGSIC',
    role: Role.ADMIN,
  },
  {
    email: 'gestion@dgrecm.test',
    prenoms: 'Gestionnaire',
    nom: 'DGRECM',
    role: Role.GESTIONNAIRE,
  },
  {
    email: 'operateur@dgrecm.test',
    prenoms: 'Opérateur',
    nom: 'SAISIE',
    role: Role.OPERATEUR,
  },
  {
    email: 'lecteur@defense.test',
    prenoms: 'Lecteur',
    nom: 'HIERARCHIE',
    role: Role.LECTEUR,
  },
];

const MILITAIRES = [
  {
    matricule: 'TEST0001',
    grade: 'Lieutenant',
    nom: 'EXEMPLE',
    prenoms: 'ALPHA',
    sexe: Sexe.MASCULIN,
    dateNaissance: new Date('1997-04-12T00:00:00Z'),
    unite: 'Unité de démonstration',
  },
  {
    matricule: 'TEST0002',
    grade: 'Sous-lieutenant',
    nom: 'EXEMPLE',
    prenoms: 'BETA',
    sexe: Sexe.FEMININ,
    dateNaissance: new Date('1999-09-30T00:00:00Z'),
    unite: 'Unité de démonstration',
  },
  {
    matricule: 'TEST0003',
    grade: 'Sergent',
    nom: 'EXEMPLE',
    prenoms: 'GAMMA',
    sexe: Sexe.MASCULIN,
    dateNaissance: new Date('2000-01-15T00:00:00Z'),
    unite: 'Unité de démonstration',
  },
];

async function principal() {
  const empreinte = await hash(motDePasse);
  for (const compte of COMPTES)
    await prisma.utilisateur.upsert({
      where: { email: compte.email },
      create: {
        ...compte,
        motDePasseHash: empreinte,
        motDePasseProvisoire: false,
      },
      update: {},
    });

  let campagne = await prisma.campagne.findFirst({
    where: { libelle: 'Chine 2026 – démonstration' },
  });
  campagne ??= await prisma.campagne.create({
    data: {
      libelle: 'Chine 2026 – démonstration',
      pays: PaysAccueil.CHINE,
      annee: 2026,
      typeVisa: 'X1',
      referenceAccord: 'Exemple fictif',
      valeursCommunes: {
        objetSejour: 'STUDY',
        dateArrivee: '2027-09-01',
        dateFinSejour: '2031-07-15',
        villeEntree: 'BEIJING',
        etablissementAccueil: 'UNIVERSITE DE DEMONSTRATION',
        etablissementAdresse: '1 RUE EXEMPLE, BEIJING',
        adresseSejour: 'RESIDENCE UNIVERSITAIRE, BEIJING',
        financement: 'PAYS_ACCUEIL',
        organismePayeur: 'GOUVERNEMENT DU PAYS D ACCUEIL',
      },
    },
  });

  for (const m of MILITAIRES) {
    const militaire = await prisma.militaire.upsert({
      where: { matricule: m.matricule },
      create: {
        ...m,
        profil: {
          nationalite: 'GUINEAN',
          lieuNaissancePays: 'GUINEA',
          profession: 'MILITARY OFFICER',
          employeur: 'FORCES ARMEES GUINEENNES',
        },
      },
      update: {},
    });
    await prisma.dossier.upsert({
      where: {
        campagneId_militaireId: {
          campagneId: campagne.id,
          militaireId: militaire.id,
        },
      },
      create: { campagneId: campagne.id, militaireId: militaire.id },
      update: {},
    });
  }
  console.log(
    `Comptes de démonstration (mot de passe : SEED_MOT_DE_PASSE) : ${COMPTES.map((c) => c.email).join(', ')}`,
  );
}

try {
  await principal();
} finally {
  await prisma.$disconnect();
}
