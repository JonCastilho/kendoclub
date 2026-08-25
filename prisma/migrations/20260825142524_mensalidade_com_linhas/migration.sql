/*
  Warnings:

  - You are about to drop the column `valor` on the `Mensalidade` table. All the data in the column will be lost.
  - Added the required column `valorTotal` to the `Mensalidade` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoLinhaMensalidade" AS ENUM ('MENSALIDADE', 'ALUGUEL', 'OUTRO');

-- CreateEnum
CREATE TYPE "RegraCobrancaAluguel" AS ENUM ('ABERTO_NO_PRIMEIRO_DIA', 'ABERTO_EM_QUALQUER_DIA');

-- AlterTable
ALTER TABLE "ConfiguracaoClube" ADD COLUMN     "regraCobrancaAluguel" "RegraCobrancaAluguel" NOT NULL DEFAULT 'ABERTO_NO_PRIMEIRO_DIA';

-- AlterTable
ALTER TABLE "Mensalidade" DROP COLUMN "valor",
ADD COLUMN     "valorTotal" DECIMAL(10,2) NOT NULL;

-- CreateTable
CREATE TABLE "LinhaMensalidade" (
    "id" TEXT NOT NULL,
    "tipo" "TipoLinhaMensalidade" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "mensalidadeId" TEXT NOT NULL,
    "aluguelId" TEXT,

    CONSTRAINT "LinhaMensalidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinhaMensalidade_mensalidadeId_idx" ON "LinhaMensalidade"("mensalidadeId");

-- AddForeignKey
ALTER TABLE "LinhaMensalidade" ADD CONSTRAINT "LinhaMensalidade_mensalidadeId_fkey" FOREIGN KEY ("mensalidadeId") REFERENCES "Mensalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaMensalidade" ADD CONSTRAINT "LinhaMensalidade_aluguelId_fkey" FOREIGN KEY ("aluguelId") REFERENCES "Aluguel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
