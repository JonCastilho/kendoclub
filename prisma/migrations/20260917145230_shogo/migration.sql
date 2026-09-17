-- Shogo (Renshi, Kyoshi). Escrita à mão porque a carência passa a ter
-- exatamente um de dois campos, o que o schema do Prisma não expressa.

-- CreateEnum
CREATE TYPE "Shogo" AS ENUM ('RENSHI', 'KYOSHI');

-- AlterTable
ALTER TABLE "CarenciaGraduacao" ADD COLUMN "shogo" "Shogo",
ALTER COLUMN "grau" DROP NOT NULL;

ALTER TABLE "CarenciaGraduacao" ADD CONSTRAINT "CarenciaGraduacao_grau_ou_shogo"
  CHECK (num_nonnulls("grau", "shogo") = 1);

-- AlterTable
ALTER TABLE "InscricaoSubevento" ADD COLUMN "shogoPretendido" "Shogo";

-- CreateTable
CREATE TABLE "ShogoExame" (
    "id" TEXT NOT NULL,
    "shogo" "Shogo" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subeventoId" TEXT NOT NULL,

    CONSTRAINT "ShogoExame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShogoPraticante" (
    "id" TEXT NOT NULL,
    "shogo" "Shogo" NOT NULL,
    "obtidoEm" TIMESTAMP(3) NOT NULL,
    "praticanteModalidadeId" TEXT NOT NULL,

    CONSTRAINT "ShogoPraticante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShogoExame_subeventoId_shogo_key" ON "ShogoExame"("subeventoId", "shogo");

-- CreateIndex
CREATE UNIQUE INDEX "ShogoPraticante_praticanteModalidadeId_shogo_key" ON "ShogoPraticante"("praticanteModalidadeId", "shogo");

-- CreateIndex
CREATE UNIQUE INDEX "CarenciaGraduacao_modalidadeId_shogo_key" ON "CarenciaGraduacao"("modalidadeId", "shogo");

-- AddForeignKey
ALTER TABLE "ShogoExame" ADD CONSTRAINT "ShogoExame_subeventoId_fkey" FOREIGN KEY ("subeventoId") REFERENCES "Subevento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShogoPraticante" ADD CONSTRAINT "ShogoPraticante_praticanteModalidadeId_fkey" FOREIGN KEY ("praticanteModalidadeId") REFERENCES "PraticanteModalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
