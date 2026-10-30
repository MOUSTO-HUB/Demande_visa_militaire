-- CreateEnum
CREATE TYPE "TypeMessage" AS ENUM ('LIEN_ACCES', 'CODE_ACCES', 'RAPPEL_FICHE', 'RENVOI_FICHE', 'CONVOCATION_DEPOT', 'RAPPEL_RDV');

-- CreateEnum
CREATE TYPE "CanalMessage" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "StatutMessage" AS ENUM ('A_ENVOYER', 'ENVOYE', 'SIMULE', 'ECHEC');

-- AlterEnum
ALTER TYPE "ActionAudit" ADD VALUE 'MESSAGE';

-- AlterTable
ALTER TABLE "campagnes" ADD COLUMN     "date_limite_fiche" DATE;

-- CreateTable
CREATE TABLE "acces_militaires" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "jeton_hash" TEXT NOT NULL,
    "jeton_chiffre" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "code_hash" TEXT,
    "code_expire_le" TIMESTAMP(3),
    "code_essais" INTEGER NOT NULL DEFAULT 0,
    "code_envoye_le" TIMESTAMP(3),
    "derniere_connexion" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "acces_militaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "type" "TypeMessage" NOT NULL,
    "canal" "CanalMessage" NOT NULL,
    "destinataire" TEXT NOT NULL,
    "parametres" JSONB NOT NULL DEFAULT '{}',
    "statut" "StatutMessage" NOT NULL DEFAULT 'A_ENVOYER',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "erreur" TEXT,
    "apercu" TEXT,
    "cle" TEXT,
    "envoye_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "acces_militaires_dossier_id_key" ON "acces_militaires"("dossier_id");

-- CreateIndex
CREATE UNIQUE INDEX "acces_militaires_jeton_hash_key" ON "acces_militaires"("jeton_hash");

-- CreateIndex
CREATE UNIQUE INDEX "messages_cle_key" ON "messages"("cle");

-- CreateIndex
CREATE INDEX "messages_statut_cree_le_idx" ON "messages"("statut", "cree_le");

-- CreateIndex
CREATE INDEX "messages_dossier_id_cree_le_idx" ON "messages"("dossier_id", "cree_le");

-- AddForeignKey
ALTER TABLE "acces_militaires" ADD CONSTRAINT "acces_militaires_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
