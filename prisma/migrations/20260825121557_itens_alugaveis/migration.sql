-- CreateEnum
CREATE TYPE "SituacaoItem" AS ENUM ('DISPONIVEL', 'MANUTENCAO', 'BAIXADO');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "identificador" TEXT,
    "tipo" TEXT,
    "situacao" "SituacaoItem" NOT NULL DEFAULT 'DISPONIVEL',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "valorMensalAluguel" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aluguel" (
    "id" TEXT NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3),
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorMensal" DECIMAL(10,2) NOT NULL,
    "itemId" TEXT NOT NULL,
    "praticanteId" TEXT NOT NULL,

    CONSTRAINT "Aluguel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_situacao_idx" ON "Item"("situacao");

-- CreateIndex
CREATE INDEX "Item_nome_idx" ON "Item"("nome");

-- CreateIndex
CREATE INDEX "Aluguel_itemId_inicioEm_idx" ON "Aluguel"("itemId", "inicioEm");

-- CreateIndex
CREATE INDEX "Aluguel_praticanteId_idx" ON "Aluguel"("praticanteId");

-- AddForeignKey
ALTER TABLE "Aluguel" ADD CONSTRAINT "Aluguel_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluguel" ADD CONSTRAINT "Aluguel_praticanteId_fkey" FOREIGN KEY ("praticanteId") REFERENCES "Praticante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
