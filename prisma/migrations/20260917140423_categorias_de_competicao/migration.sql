-- CreateEnum
CREATE TYPE "SexoCategoria" AS ENUM ('MASCULINO', 'FEMININO', 'MISTO');

-- AlterTable
ALTER TABLE "InscricaoSubevento" ADD COLUMN     "categoriaId" TEXT,
ADD COLUMN     "equipe" BOOLEAN,
ADD COLUMN     "individual" BOOLEAN;

-- CreateTable
CREATE TABLE "CategoriaCompeticao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sexo" "SexoCategoria" NOT NULL,
    "idadeMinima" INTEGER,
    "idadeMaxima" INTEGER,
    "grauMinimo" "Grau",
    "grauMaximo" "Grau",
    "valor" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subeventoId" TEXT NOT NULL,

    CONSTRAINT "CategoriaCompeticao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaCompeticao_subeventoId_nome_key" ON "CategoriaCompeticao"("subeventoId", "nome");

-- AddForeignKey
ALTER TABLE "CategoriaCompeticao" ADD CONSTRAINT "CategoriaCompeticao_subeventoId_fkey" FOREIGN KEY ("subeventoId") REFERENCES "Subevento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoSubevento" ADD CONSTRAINT "InscricaoSubevento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaCompeticao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
