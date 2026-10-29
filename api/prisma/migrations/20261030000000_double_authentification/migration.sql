-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "codes_secours" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totp_dernier_pas" INTEGER,
ADD COLUMN     "totp_secret" TEXT;
