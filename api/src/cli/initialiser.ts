// Premier compte ADMIN (DGSIC) d'une installation :
//   node dist/cli/initialiser.js <email> <prénoms> <nom>
// Le mot de passe provisoire s'affiche une seule fois ; il est à changer à la première connexion.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '../generated/prisma/client.js';
import { Role } from '../generated/prisma/enums.js';
import { motDePasseProvisoire } from '../utilisateurs/utilisateurs.regles.js';

const [email, prenoms, nom] = process.argv.slice(2);
if (!email || !prenoms || !nom) {
  console.error('Usage : node dist/cli/initialiser.js <email> <prénoms> <nom>');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const admins = await prisma.utilisateur.count({
    where: { role: Role.ADMIN },
  });
  if (admins > 0) {
    console.error(
      'Un compte ADMIN existe déjà : créez les autres comptes depuis le site.',
    );
    process.exitCode = 1;
  } else {
    const provisoire = motDePasseProvisoire();
    await prisma.utilisateur.create({
      data: {
        email: email.toLowerCase(),
        prenoms,
        nom,
        role: Role.ADMIN,
        motDePasseHash: await hash(provisoire),
      },
    });
    console.log(`Compte ADMIN créé pour ${email}.`);
    console.log(
      `Mot de passe provisoire (affiché une seule fois) : ${provisoire}`,
    );
  }
} finally {
  await prisma.$disconnect();
}
