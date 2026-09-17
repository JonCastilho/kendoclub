-- O valor de participação passa a ser da competição (o subevento), e a
-- categoria só diz se é isenta. Escrita à mão para não perder o que já foi
-- cadastrado: a conversão preserva o sentido de cada linha antes de apagar a
-- coluna antiga.

-- AlterTable
ALTER TABLE "CategoriaCompeticao" ADD COLUMN "isenta" BOOLEAN NOT NULL DEFAULT false;

-- Categoria de valor zero era, na prática, uma categoria isenta.
UPDATE "CategoriaCompeticao" SET "isenta" = true WHERE "valor" = 0;

-- Competição sem valor próprio herda o maior valor das suas categorias: é o
-- preço que alguém da tabela pagaria.
UPDATE "Subevento" AS s
SET "valor" = c.maior
FROM (
  SELECT "subeventoId", MAX("valor") AS maior
  FROM "CategoriaCompeticao"
  GROUP BY "subeventoId"
) AS c
WHERE s."id" = c."subeventoId" AND s."tipo" = 'COMPETICAO' AND s."valor" IS NULL;

-- AlterTable
ALTER TABLE "CategoriaCompeticao" DROP COLUMN "valor";
