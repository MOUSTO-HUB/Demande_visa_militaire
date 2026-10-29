-- CreateEnum
CREATE TYPE "ModeCorrespondance" AS ENUM ('A_DEFINIR', 'CHAMP', 'FIXE', 'IGNORER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionAudit" ADD VALUE 'RELEVE';
ALTER TYPE "ActionAudit" ADD VALUE 'REMPLISSAGE';

-- CreateTable
CREATE TABLE "champs_site" (
    "id" TEXT NOT NULL,
    "pays" "PaysAccueil" NOT NULL,
    "page" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "obligatoire" BOOLEAN NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "format_date" TEXT,
    "mode" "ModeCorrespondance" NOT NULL DEFAULT 'A_DEFINIR',
    "champ_id" TEXT,
    "valeur_fixe" TEXT,
    "conversions" JSONB NOT NULL DEFAULT '{}',
    "remplir" BOOLEAN NOT NULL,
    "propose" BOOLEAN NOT NULL DEFAULT false,
    "premier_releve" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dernier_releve" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "champs_site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "champs_site_pays_page_idx" ON "champs_site"("pays", "page");

-- CreateIndex
CREATE UNIQUE INDEX "champs_site_pays_page_cle_key" ON "champs_site"("pays", "page", "cle");
