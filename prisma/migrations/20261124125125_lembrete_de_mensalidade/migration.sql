-- AlterTable
ALTER TABLE "Praticante" ADD COLUMN     "diaDePagamento" INTEGER;

-- Escrito à mão: o Prisma não declara CHECK. O dia de pagamento é um dia do
-- mês; fora de 1 a 31 não significa nada, e o banco recusa mesmo que alguma
-- tela esqueça de validar.
ALTER TABLE "Praticante"
  ADD CONSTRAINT "Praticante_diaDePagamento_valido"
  CHECK ("diaDePagamento" IS NULL OR "diaDePagamento" BETWEEN 1 AND 31);

-- CreateTable
CREATE TABLE "LembreteDeMensalidade" (
    "id" TEXT NOT NULL,
    "dias" INTEGER NOT NULL,
    "para" TEXT NOT NULL,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mensalidadeId" TEXT NOT NULL,

    CONSTRAINT "LembreteDeMensalidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LembreteDeMensalidade_mensalidadeId_dias_key" ON "LembreteDeMensalidade"("mensalidadeId", "dias");

-- AddForeignKey
ALTER TABLE "LembreteDeMensalidade" ADD CONSTRAINT "LembreteDeMensalidade_mensalidadeId_fkey" FOREIGN KEY ("mensalidadeId") REFERENCES "Mensalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
