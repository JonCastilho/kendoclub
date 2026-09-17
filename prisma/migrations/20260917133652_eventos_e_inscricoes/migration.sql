/*
  Warnings:

  - You are about to drop the column `local` on the `Evento` table. All the data in the column will be lost.
  - You are about to drop the column `prazoConfirmacao` on the `Evento` table. All the data in the column will be lost.
  - You are about to drop the `ConfirmacaoPresenca` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `prazoInscricao` to the `Evento` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoSubevento" AS ENUM ('SEMINARIO', 'COMPETICAO', 'EXAME');

-- DropForeignKey
ALTER TABLE "ConfirmacaoPresenca" DROP CONSTRAINT "ConfirmacaoPresenca_eventoId_fkey";

-- DropForeignKey
ALTER TABLE "ConfirmacaoPresenca" DROP CONSTRAINT "ConfirmacaoPresenca_praticanteId_fkey";

-- AlterTable
ALTER TABLE "Evento" DROP COLUMN "local",
DROP COLUMN "prazoConfirmacao",
ADD COLUMN     "diasObento" TIMESTAMP(3)[],
ADD COLUMN     "enderecoAlojamento" TEXT,
ADD COLUMN     "ofereceAlojamento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prazoInscricao" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "publicadoEm" TIMESTAMP(3),
ADD COLUMN     "valorAlojamento" DECIMAL(10,2),
ADD COLUMN     "valorObento" DECIMAL(10,2),
ALTER COLUMN "inicioEm" DROP NOT NULL;

-- DropTable
DROP TABLE "ConfirmacaoPresenca";

-- DropEnum
DROP TYPE "SituacaoConfirmacao";

-- CreateTable
CREATE TABLE "Subevento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoSubevento" NOT NULL,
    "local" TEXT NOT NULL,
    "dias" TIMESTAMP(3)[],
    "valor" DECIMAL(10,2),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventoId" TEXT NOT NULL,
    "modalidadeId" TEXT NOT NULL,

    CONSTRAINT "Subevento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscricaoEvento" (
    "id" TEXT NOT NULL,
    "alojamento" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "eventoId" TEXT NOT NULL,
    "praticanteId" TEXT NOT NULL,
    "inscritoPorUsuarioId" TEXT,

    CONSTRAINT "InscricaoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscricaoSubevento" (
    "id" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inscricaoEventoId" TEXT NOT NULL,
    "subeventoId" TEXT NOT NULL,

    CONSTRAINT "InscricaoSubevento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncomendaObento" (
    "id" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "inscricaoEventoId" TEXT NOT NULL,

    CONSTRAINT "EncomendaObento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subevento_eventoId_tipo_modalidadeId_key" ON "Subevento"("eventoId", "tipo", "modalidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "InscricaoEvento_eventoId_praticanteId_key" ON "InscricaoEvento"("eventoId", "praticanteId");

-- CreateIndex
CREATE INDEX "InscricaoSubevento_subeventoId_idx" ON "InscricaoSubevento"("subeventoId");

-- CreateIndex
CREATE UNIQUE INDEX "InscricaoSubevento_inscricaoEventoId_subeventoId_key" ON "InscricaoSubevento"("inscricaoEventoId", "subeventoId");

-- CreateIndex
CREATE UNIQUE INDEX "EncomendaObento_inscricaoEventoId_dia_key" ON "EncomendaObento"("inscricaoEventoId", "dia");

-- AddForeignKey
ALTER TABLE "Subevento" ADD CONSTRAINT "Subevento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subevento" ADD CONSTRAINT "Subevento_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoEvento" ADD CONSTRAINT "InscricaoEvento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoEvento" ADD CONSTRAINT "InscricaoEvento_praticanteId_fkey" FOREIGN KEY ("praticanteId") REFERENCES "Praticante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoEvento" ADD CONSTRAINT "InscricaoEvento_inscritoPorUsuarioId_fkey" FOREIGN KEY ("inscritoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoSubevento" ADD CONSTRAINT "InscricaoSubevento_inscricaoEventoId_fkey" FOREIGN KEY ("inscricaoEventoId") REFERENCES "InscricaoEvento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoSubevento" ADD CONSTRAINT "InscricaoSubevento_subeventoId_fkey" FOREIGN KEY ("subeventoId") REFERENCES "Subevento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncomendaObento" ADD CONSTRAINT "EncomendaObento_inscricaoEventoId_fkey" FOREIGN KEY ("inscricaoEventoId") REFERENCES "InscricaoEvento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Escrito à mão: encomenda só existe com quantidade positiva. Zerar um dia
-- apaga a linha, em vez de guardar "0 obentos".
ALTER TABLE "EncomendaObento" ADD CONSTRAINT "EncomendaObento_quantidade_positiva" CHECK ("quantidade" > 0);
