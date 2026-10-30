-- CreateTable
CREATE TABLE "parametres_pays" (
    "pays" "PaysAccueil" NOT NULL,
    "exigences" JSONB NOT NULL,
    "modifie_le" TIMESTAMP(3) NOT NULL,
    "modifie_par" TEXT,

    CONSTRAINT "parametres_pays_pkey" PRIMARY KEY ("pays")
);
