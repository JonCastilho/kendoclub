-- AlterTable
ALTER TABLE "ConfiguracaoClube" ADD COLUMN     "cidadePix" TEXT;

-- CreateTable
CREATE TABLE "CobrancaEvento" (
    "id" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "itens" TEXT[],
    "geradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inscricaoEventoId" TEXT NOT NULL,

    CONSTRAINT "CobrancaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CobrancaEvento_inscricaoEventoId_key" ON "CobrancaEvento"("inscricaoEventoId");

-- AddForeignKey
ALTER TABLE "CobrancaEvento" ADD CONSTRAINT "CobrancaEvento_inscricaoEventoId_fkey" FOREIGN KEY ("inscricaoEventoId") REFERENCES "InscricaoEvento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
