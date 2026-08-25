-- AlterTable
ALTER TABLE "Aluguel" ADD COLUMN     "descricao" TEXT,
ALTER COLUMN "itemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ConfiguracaoClube" ADD COLUMN     "valorAluguelPadrao" DECIMAL(10,2) NOT NULL DEFAULT 0;
