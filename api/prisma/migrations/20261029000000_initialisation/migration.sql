-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GESTIONNAIRE', 'OPERATEUR', 'LECTEUR');

-- CreateEnum
CREATE TYPE "PaysAccueil" AS ENUM ('CHINE', 'RUSSIE');

-- CreateEnum
CREATE TYPE "StatutCampagne" AS ENUM ('OUVERTE', 'CLOSE');

-- CreateEnum
CREATE TYPE "StatutDossier" AS ENUM ('A_COMPLETER', 'A_VALIDER', 'VALIDE', 'EN_SAISIE', 'SOUMIS', 'RDV_PRIS', 'DEPOSE', 'VISA_OBTENU', 'REFUSE', 'ABANDONNE');

-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('MASCULIN', 'FEMININ');

-- CreateEnum
CREATE TYPE "ActionAudit" AS ENUM ('CONNEXION', 'CREATION', 'MODIFICATION', 'CONSULTATION', 'EXPORT', 'IMPORT', 'STATUT', 'SUPPRESSION');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "prenoms" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "mot_de_passe_hash" TEXT NOT NULL,
    "mot_de_passe_provisoire" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniere_connexion" TIMESTAMP(3),
    "echecs_connexion" INTEGER NOT NULL DEFAULT 0,
    "bloque_jusqu_a" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jetons_rafraichissement" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "jeton_hash" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "revoque_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jetons_rafraichissement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campagnes" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "pays" "PaysAccueil" NOT NULL,
    "annee" INTEGER NOT NULL,
    "type_visa" TEXT NOT NULL,
    "reference_accord" TEXT,
    "valeurs_communes" JSONB NOT NULL DEFAULT '{}',
    "pieces_exigees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statut" "StatutCampagne" NOT NULL DEFAULT 'OUVERTE',
    "close_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "campagnes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "militaires" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "grade" TEXT,
    "nom" TEXT NOT NULL,
    "prenoms" TEXT NOT NULL,
    "sexe" "Sexe",
    "date_naissance" DATE,
    "unite" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "profil" JSONB NOT NULL DEFAULT '{}',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "militaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" TEXT NOT NULL,
    "campagne_id" TEXT NOT NULL,
    "militaire_id" TEXT NOT NULL,
    "statut" "StatutDossier" NOT NULL DEFAULT 'A_COMPLETER',
    "donnees" JSONB NOT NULL DEFAULT '{}',
    "operateur_id" TEXT,
    "numero_demande" TEXT,
    "date_rendez_vous" TIMESTAMP(3),
    "commentaire" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "cree_par" TEXT,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_statuts" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "depuis" "StatutDossier",
    "vers" "StatutDossier" NOT NULL,
    "commentaire" TEXT,
    "utilisateur_id" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historique_statuts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "type_mime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "largeur" INTEGER,
    "hauteur" INTEGER,
    "cle_stockage" TEXT NOT NULL,
    "purgee_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" TEXT,

    CONSTRAINT "pieces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT,
    "action" "ActionAudit" NOT NULL,
    "entite" TEXT NOT NULL,
    "entite_id" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "jetons_rafraichissement_jeton_hash_key" ON "jetons_rafraichissement"("jeton_hash");

-- CreateIndex
CREATE INDEX "jetons_rafraichissement_utilisateur_id_idx" ON "jetons_rafraichissement"("utilisateur_id");

-- CreateIndex
CREATE INDEX "campagnes_pays_annee_idx" ON "campagnes"("pays", "annee");

-- CreateIndex
CREATE UNIQUE INDEX "militaires_matricule_key" ON "militaires"("matricule");

-- CreateIndex
CREATE INDEX "militaires_nom_prenoms_idx" ON "militaires"("nom", "prenoms");

-- CreateIndex
CREATE INDEX "dossiers_campagne_id_statut_idx" ON "dossiers"("campagne_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_campagne_id_militaire_id_key" ON "dossiers"("campagne_id", "militaire_id");

-- CreateIndex
CREATE INDEX "historique_statuts_dossier_id_cree_le_idx" ON "historique_statuts"("dossier_id", "cree_le");

-- CreateIndex
CREATE UNIQUE INDEX "pieces_cle_stockage_key" ON "pieces"("cle_stockage");

-- CreateIndex
CREATE INDEX "pieces_dossier_id_type_idx" ON "pieces"("dossier_id", "type");

-- CreateIndex
CREATE INDEX "journal_audit_cree_le_idx" ON "journal_audit"("cree_le");

-- CreateIndex
CREATE INDEX "journal_audit_entite_entite_id_idx" ON "journal_audit"("entite", "entite_id");

-- AddForeignKey
ALTER TABLE "jetons_rafraichissement" ADD CONSTRAINT "jetons_rafraichissement_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagnes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_militaire_id_fkey" FOREIGN KEY ("militaire_id") REFERENCES "militaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_operateur_id_fkey" FOREIGN KEY ("operateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_statuts" ADD CONSTRAINT "historique_statuts_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_statuts" ADD CONSTRAINT "historique_statuts_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
