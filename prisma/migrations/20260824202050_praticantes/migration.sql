/*
  Warnings:

  - You are about to drop the column `desligadoEm` on the `Praticante` table. All the data in the column will be lost.
  - You are about to drop the column `endereco` on the `Praticante` table. All the data in the column will be lost.
  - You are about to drop the column `ingressouEm` on the `Praticante` table. All the data in the column will be lost.
  - You are about to drop the column `situacao` on the `Praticante` table. All the data in the column will be lost.
  - You are about to drop the column `valorMensalidade` on the `Praticante` table. All the data in the column will be lost.
  - Added the required column `modalidadeId` to the `Graduacao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documento` to the `Praticante` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sexo` to the `Praticante` table without a default value. This is not possible if the table is not empty.
  - Made the column `dataNascimento` on table `Praticante` required. This step will fail if there are existing NULL values in that column.
  - Made the column `telefone` on table `Praticante` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `Praticante` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('FEMININO', 'MASCULINO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CPF', 'DOCUMENTO_ESTRANGEIRO');

-- CreateEnum
CREATE TYPE "TitularDocumento" AS ENUM ('PROPRIO', 'RESPONSAVEL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Grau" ADD VALUE 'KYU_10';
ALTER TYPE "Grau" ADD VALUE 'KYU_9';

-- DropIndex
DROP INDEX "Graduacao_praticanteId_obtidaEm_idx";

-- DropIndex
DROP INDEX "Praticante_situacao_idx";

-- AlterTable
ALTER TABLE "ConfiguracaoClube" ADD COLUMN     "diaVencimento" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "valorMensalidade" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Graduacao" ADD COLUMN     "modalidadeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Praticante" DROP COLUMN "desligadoEm",
DROP COLUMN "endereco",
DROP COLUMN "ingressouEm",
DROP COLUMN "situacao",
DROP COLUMN "valorMensalidade",
ADD COLUMN     "autorizacaoImagemEm" TIMESTAMP(3),
ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "consentimentoDadosEm" TIMESTAMP(3),
ADD COLUMN     "consentimentoSaudeEm" TIMESTAMP(3),
ADD COLUMN     "documento" TEXT NOT NULL,
ADD COLUMN     "emergenciaNome" TEXT,
ADD COLUMN     "emergenciaParentesco" TEXT,
ADD COLUMN     "emergenciaTelefone" TEXT,
ADD COLUMN     "iniciouPraticaEm" TIMESTAMP(3),
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "nacionalidade" TEXT NOT NULL DEFAULT 'Brasileira',
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "observacoesMedicas" TEXT,
ADD COLUMN     "sexo" "Sexo" NOT NULL,
ADD COLUMN     "telefoneAlternativo" TEXT,
ADD COLUMN     "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'CPF',
ADD COLUMN     "titularDocumento" "TitularDocumento" NOT NULL DEFAULT 'PROPRIO',
ADD COLUMN     "uf" TEXT,
ALTER COLUMN "dataNascimento" SET NOT NULL,
ALTER COLUMN "telefone" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- DropEnum
DROP TYPE "SituacaoPraticante";

-- CreateTable
CREATE TABLE "Filiacao" (
    "id" TEXT NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3),
    "motivoSaida" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "praticanteId" TEXT NOT NULL,

    CONSTRAINT "Filiacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modalidade" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "kyuInicial" INTEGER NOT NULL DEFAULT 6,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Modalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PraticanteModalidade" (
    "id" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "ate" TIMESTAMP(3),
    "praticanteId" TEXT NOT NULL,
    "modalidadeId" TEXT NOT NULL,

    CONSTRAINT "PraticanteModalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Isencao" (
    "id" TEXT NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3),
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "praticanteId" TEXT NOT NULL,
    "concedidaPorUsuarioId" TEXT,

    CONSTRAINT "Isencao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Filiacao_praticanteId_inicioEm_idx" ON "Filiacao"("praticanteId", "inicioEm");

-- CreateIndex
CREATE UNIQUE INDEX "Modalidade_nome_key" ON "Modalidade"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "PraticanteModalidade_praticanteId_modalidadeId_key" ON "PraticanteModalidade"("praticanteId", "modalidadeId");

-- CreateIndex
CREATE INDEX "Isencao_praticanteId_inicioEm_idx" ON "Isencao"("praticanteId", "inicioEm");

-- CreateIndex
CREATE INDEX "Graduacao_praticanteId_modalidadeId_obtidaEm_idx" ON "Graduacao"("praticanteId", "modalidadeId", "obtidaEm");

-- CreateIndex
CREATE INDEX "Praticante_documento_idx" ON "Praticante"("documento");

-- AddForeignKey
ALTER TABLE "Filiacao" ADD CONSTRAINT "Filiacao_praticanteId_fkey" FOREIGN KEY ("praticanteId") REFERENCES "Praticante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PraticanteModalidade" ADD CONSTRAINT "PraticanteModalidade_praticanteId_fkey" FOREIGN KEY ("praticanteId") REFERENCES "Praticante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PraticanteModalidade" ADD CONSTRAINT "PraticanteModalidade_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Graduacao" ADD CONSTRAINT "Graduacao_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Isencao" ADD CONSTRAINT "Isencao_praticanteId_fkey" FOREIGN KEY ("praticanteId") REFERENCES "Praticante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Isencao" ADD CONSTRAINT "Isencao_concedidaPorUsuarioId_fkey" FOREIGN KEY ("concedidaPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Índices parciais acrescentados à mão: o Prisma não os expressa no schema.
-- São regras que o banco sustenta, e não apenas a interface.

-- No máximo uma filiação aberta por praticante. A situação é derivada de haver
-- período em aberto; dois períodos abertos tornariam a resposta ambígua.
CREATE UNIQUE INDEX "Filiacao_aberta_unica"
  ON "Filiacao" ("praticanteId")
  WHERE "fimEm" IS NULL;

-- Documento único somente quando é do próprio praticante. Menor sem CPF é
-- cadastrado com o do responsável, e nesse caso irmãos repetem o mesmo número.
CREATE UNIQUE INDEX "Praticante_documento_proprio_unico"
  ON "Praticante" ("documento")
  WHERE "titularDocumento" = 'PROPRIO';
