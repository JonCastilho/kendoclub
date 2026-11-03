-- AlterTable
ALTER TABLE "CobrancaEvento" ADD COLUMN     "aceita" BOOLEAN,
ADD COLUMN     "analisadaEm" TIMESTAMP(3),
ADD COLUMN     "analisadaPorUsuarioId" TEXT,
ADD COLUMN     "comprovante" TEXT,
ADD COLUMN     "declaradaEm" TIMESTAMP(3),
ADD COLUMN     "motivoRecusa" TEXT,
ADD COLUMN     "observacao" TEXT;

-- AddForeignKey
ALTER TABLE "CobrancaEvento" ADD CONSTRAINT "CobrancaEvento_analisadaPorUsuarioId_fkey" FOREIGN KEY ("analisadaPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
