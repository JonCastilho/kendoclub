-- Categorias passam a ter tipo (individual ou equipe), e a inscrição guarda
-- uma categoria de cada tipo. Escrita à mão para não perder o que já foi
-- cadastrado: a conversão preserva o sentido de cada linha antes de apagar as
-- colunas antigas.

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('INDIVIDUAL', 'EQUIPE');

-- AlterTable
ALTER TABLE "CategoriaCompeticao" ADD COLUMN "tipo" "TipoCategoria" NOT NULL DEFAULT 'INDIVIDUAL';

-- O nome só precisa ser único dentro do tipo: "Adulto" existe nas duas disputas.
DROP INDEX "CategoriaCompeticao_subeventoId_nome_key";

-- Categoria antiga valia para os dois modos: vira duas, uma de cada tipo, com
-- as mesmas faixas. O prefixo no id deixa achar a gêmea logo abaixo.
INSERT INTO "CategoriaCompeticao"
  ("id", "nome", "tipo", "sexo", "idadeMinima", "idadeMaxima", "grauMinimo", "grauMaximo", "isenta", "criadoEm", "subeventoId")
SELECT
  'eq_' || "id", "nome", 'EQUIPE', "sexo", "idadeMinima", "idadeMaxima", "grauMinimo", "grauMaximo", "isenta", "criadoEm", "subeventoId"
FROM "CategoriaCompeticao";

ALTER TABLE "CategoriaCompeticao" ALTER COLUMN "tipo" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaCompeticao_subeventoId_tipo_nome_key" ON "CategoriaCompeticao"("subeventoId", "tipo", "nome");

-- AlterTable
ALTER TABLE "InscricaoSubevento" ADD COLUMN "categoriaIndividualId" TEXT,
ADD COLUMN "categoriaEquipeId" TEXT;

-- Quem competia no individual fica na categoria original; quem competia em
-- equipe, na gêmea. Linha sem modo marcado, que não deveria existir, vai para o
-- individual.
UPDATE "InscricaoSubevento" SET "categoriaIndividualId" = "categoriaId"
WHERE "categoriaId" IS NOT NULL AND (COALESCE("individual", false) OR NOT COALESCE("equipe", false));

UPDATE "InscricaoSubevento" SET "categoriaEquipeId" = 'eq_' || "categoriaId"
WHERE "categoriaId" IS NOT NULL AND COALESCE("equipe", false);

-- DropForeignKey
ALTER TABLE "InscricaoSubevento" DROP CONSTRAINT "InscricaoSubevento_categoriaId_fkey";

-- AlterTable
ALTER TABLE "InscricaoSubevento" DROP COLUMN "categoriaId",
DROP COLUMN "individual",
DROP COLUMN "equipe";

-- AddForeignKey
ALTER TABLE "InscricaoSubevento" ADD CONSTRAINT "InscricaoSubevento_categoriaIndividualId_fkey" FOREIGN KEY ("categoriaIndividualId") REFERENCES "CategoriaCompeticao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoSubevento" ADD CONSTRAINT "InscricaoSubevento_categoriaEquipeId_fkey" FOREIGN KEY ("categoriaEquipeId") REFERENCES "CategoriaCompeticao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
