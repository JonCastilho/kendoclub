
-- CreateTable
CREATE TABLE "DeclaracaoPagamento" (
    "id" TEXT NOT NULL,
    "pagoEm" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mensalidadeId" TEXT NOT NULL,
    "analisadaEm" TIMESTAMP(3),
    "aceita" BOOLEAN,
    "motivoRecusa" TEXT,
    "analisadaPorUsuarioId" TEXT,

    CONSTRAINT "DeclaracaoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeclaracaoPagamento_mensalidadeId_idx" ON "DeclaracaoPagamento"("mensalidadeId");

-- AddForeignKey
ALTER TABLE "DeclaracaoPagamento" ADD CONSTRAINT "DeclaracaoPagamento_mensalidadeId_fkey" FOREIGN KEY ("mensalidadeId") REFERENCES "Mensalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclaracaoPagamento" ADD CONSTRAINT "DeclaracaoPagamento_analisadaPorUsuarioId_fkey" FOREIGN KEY ("analisadaPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Índice parcial escrito à mão: uma única declaração pendente por mensalidade.
-- Sem isto, clicar duas vezes em "já paguei" encheria a fila da diretoria com
-- avisos repetidos da mesma cobrança.
CREATE UNIQUE INDEX "Declaracao_pendente_unica_por_mensalidade"
  ON "DeclaracaoPagamento" ("mensalidadeId")
  WHERE "analisadaEm" IS NULL;
