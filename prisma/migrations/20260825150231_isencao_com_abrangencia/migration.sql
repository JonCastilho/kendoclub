-- CreateEnum
CREATE TYPE "AbrangenciaIsencao" AS ENUM ('MENSALIDADE', 'ALUGUEL', 'TUDO');

-- AlterTable
ALTER TABLE "Isencao" ADD COLUMN     "abrangencia" "AbrangenciaIsencao" NOT NULL DEFAULT 'TUDO';
