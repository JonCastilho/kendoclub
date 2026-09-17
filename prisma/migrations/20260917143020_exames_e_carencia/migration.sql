-- AlterTable
ALTER TABLE "InscricaoSubevento" ADD COLUMN     "grauPretendido" "Grau";

-- CreateTable
CREATE TABLE "GraduacaoExame" (
    "id" TEXT NOT NULL,
    "grau" "Grau" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subeventoId" TEXT NOT NULL,

    CONSTRAINT "GraduacaoExame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarenciaGraduacao" (
    "id" TEXT NOT NULL,
    "grau" "Grau" NOT NULL,
    "mesesMinimos" INTEGER NOT NULL,
    "modalidadeId" TEXT NOT NULL,

    CONSTRAINT "CarenciaGraduacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GraduacaoExame_subeventoId_grau_key" ON "GraduacaoExame"("subeventoId", "grau");

-- CreateIndex
CREATE UNIQUE INDEX "CarenciaGraduacao_modalidadeId_grau_key" ON "CarenciaGraduacao"("modalidadeId", "grau");

-- AddForeignKey
ALTER TABLE "GraduacaoExame" ADD CONSTRAINT "GraduacaoExame_subeventoId_fkey" FOREIGN KEY ("subeventoId") REFERENCES "Subevento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarenciaGraduacao" ADD CONSTRAINT "CarenciaGraduacao_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
