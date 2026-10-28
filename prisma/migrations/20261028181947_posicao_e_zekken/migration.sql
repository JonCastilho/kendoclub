-- CreateEnum
CREATE TYPE "PosicaoNaEquipe" AS ENUM ('SENPO', 'JIHO', 'CHUKEN', 'FUKUSHO', 'TAISHO', 'AVULSO');

-- AlterTable
ALTER TABLE "InscricaoSubevento" ADD COLUMN     "nomeNoZekken" TEXT,
ADD COLUMN     "posicaoNaEquipe" "PosicaoNaEquipe";
