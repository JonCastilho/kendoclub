-- A graduação passa a viver no vínculo praticante-modalidade: o clube guarda o
-- grau atual, e o anterior é substituído. Não há mais histórico de exames.

ALTER TABLE "PraticanteModalidade"
  ADD COLUMN "grau" "Grau",
  ADD COLUMN "graduadoEm" TIMESTAMP(3),
  ADD COLUMN "observacoesGraduacao" TEXT;

-- Preserva o que já existe: para cada praticante e modalidade, leva a graduação
-- mais recente para o novo campo. As anteriores se perdem, que é o efeito
-- pretendido da mudança.
UPDATE "PraticanteModalidade" pm
SET "grau" = g."grau",
    "graduadoEm" = g."obtidaEm",
    "observacoesGraduacao" = g."observacoes"
FROM (
  SELECT DISTINCT ON ("praticanteId", "modalidadeId")
         "praticanteId", "modalidadeId", "grau", "obtidaEm", "observacoes"
  FROM "Graduacao"
  ORDER BY "praticanteId", "modalidadeId", "obtidaEm" DESC
) g
WHERE pm."praticanteId" = g."praticanteId"
  AND pm."modalidadeId" = g."modalidadeId";

DROP TABLE "Graduacao";
