import { Prisma } from '../generated/prisma/client.js';

/** Vrai si l'erreur est une violation de contrainte d'unicité (P2002). */
export const estDoublon = (erreur: unknown): boolean =>
  erreur instanceof Prisma.PrismaClientKnownRequestError &&
  erreur.code === 'P2002';
