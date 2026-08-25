-- Índice parcial escrito à mão: o Prisma não expressa índice com filtro.
--
-- Um item só pode ter um aluguel em aberto. Sem isto, o mesmo bogu poderia
-- constar com duas pessoas ao mesmo tempo — e, a partir da etapa 4, a
-- mensalidade cobraria as duas.
CREATE UNIQUE INDEX "Aluguel_aberto_unico_por_item"
  ON "Aluguel" ("itemId")
  WHERE "fimEm" IS NULL;
