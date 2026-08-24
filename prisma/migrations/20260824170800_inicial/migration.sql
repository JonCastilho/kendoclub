-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('DIRETORIA', 'PRATICANTE');

-- CreateEnum
CREATE TYPE "SituacaoPraticante" AS ENUM ('ATIVO', 'AFASTADO', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "Grau" AS ENUM ('KYU_8', 'KYU_7', 'KYU_6', 'KYU_5', 'KYU_4', 'KYU_3', 'KYU_2', 'KYU_1', 'DAN_1', 'DAN_2', 'DAN_3', 'DAN_4', 'DAN_5', 'DAN_6', 'DAN_7', 'DAN_8');

-- CreateEnum
CREATE TYPE "SituacaoMensalidade" AS ENUM ('ABERTA', 'PAGA', 'ISENTA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Visibilidade" AS ENUM ('PUBLICA', 'RESTRITA');

-- CreateEnum
CREATE TYPE "SituacaoConfirmacao" AS ENUM ('VOU', 'NAO_VOU', 'TALVEZ');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'PRATICANTE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcessoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "praticanteId" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRedefinicaoSenha" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "TokenRedefinicaoSenha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Praticante" (
    "id" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3),
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "situacao" "SituacaoPraticante" NOT NULL DEFAULT 'ATIVO',
    "ingressouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desligadoEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "responsavelNome" TEXT,
    "responsavelTelefone" TEXT,
    "responsavelConsentimentoEm" TIMESTAMP(3),
    "valorMensalidade" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Praticante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Graduacao" (
    "id" TEXT NOT NULL,
    "grau" "Grau" NOT NULL,
    "obtidaEm" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "praticanteId" TEXT NOT NULL,

    CONSTRAINT "Graduacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensalidade" (
    "id" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "situacao" "SituacaoMensalidade" NOT NULL DEFAULT 'ABERTA',
    "pagaEm" TIMESTAMP(3),
    "valorPago" DECIMAL(10,2),
    "formaPagamento" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "praticanteId" TEXT NOT NULL,
    "baixadaPorUsuarioId" TEXT,

    CONSTRAINT "Mensalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publicacao" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "imagemCapa" TEXT,
    "visibilidade" "Visibilidade" NOT NULL DEFAULT 'PUBLICA',
    "publicadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "autorUsuarioId" TEXT NOT NULL,

    CONSTRAINT "Publicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "local" TEXT,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3),
    "visibilidade" "Visibilidade" NOT NULL DEFAULT 'PUBLICA',
    "prazoConfirmacao" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoPorUsuarioId" TEXT NOT NULL,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmacaoPresenca" (
    "id" TEXT NOT NULL,
    "situacao" "SituacaoConfirmacao" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "eventoId" TEXT NOT NULL,
    "praticanteId" TEXT NOT NULL,

    CONSTRAINT "ConfirmacaoPresenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoClube" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nomeClube" TEXT NOT NULL DEFAULT 'Clube de Kendo',
    "logo" TEXT,
    "emailContato" TEXT,
    "chavePix" TEXT,
    "titularPix" TEXT,
    "corPrimaria" TEXT NOT NULL DEFAULT '#1e3a8a',
    "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoClube_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_praticanteId_key" ON "Usuario"("praticanteId");

-- CreateIndex
CREATE INDEX "Usuario_papel_idx" ON "Usuario"("papel");

-- CreateIndex
CREATE UNIQUE INDEX "TokenRedefinicaoSenha_tokenHash_key" ON "TokenRedefinicaoSenha"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenRedefinicaoSenha_usuarioId_idx" ON "TokenRedefinicaoSenha"("usuarioId");

-- CreateIndex
CREATE INDEX "Praticante_situacao_idx" ON "Praticante"("situacao");

-- CreateIndex
CREATE INDEX "Praticante_nomeCompleto_idx" ON "Praticante"("nomeCompleto");

-- CreateIndex
CREATE INDEX "Graduacao_praticanteId_obtidaEm_idx" ON "Graduacao"("praticanteId", "obtidaEm");

-- CreateIndex
CREATE INDEX "Mensalidade_situacao_vencimento_idx" ON "Mensalidade"("situacao", "vencimento");

-- CreateIndex
CREATE INDEX "Mensalidade_competencia_idx" ON "Mensalidade"("competencia");

-- CreateIndex
CREATE UNIQUE INDEX "Mensalidade_praticanteId_competencia_key" ON "Mensalidade"("praticanteId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "Publicacao_slug_key" ON "Publicacao"("slug");

-- CreateIndex
CREATE INDEX "Publicacao_visibilidade_publicadaEm_idx" ON "Publicacao"("visibilidade", "publicadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "Evento_slug_key" ON "Evento"("slug");

-- CreateIndex
CREATE INDEX "Evento_inicioEm_idx" ON "Evento"("inicioEm");

-- CreateIndex
CREATE INDEX "Evento_visibilidade_inicioEm_idx" ON "Evento"("visibilidade", "inicioEm");

-- CreateIndex
CREATE INDEX "ConfirmacaoPresenca_eventoId_situacao_idx" ON "ConfirmacaoPresenca"("eventoId", "situacao");

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmacaoPresenca_eventoId_praticanteId_key" ON "ConfirmacaoPresenca"("eventoId", "praticanteId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_praticanteId_fkey" FOREIGN KEY ("praticanteId") REFERENCES "Praticante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenRedefinicaoSenha" ADD CONSTRAINT "TokenRedefinicaoSenha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Graduacao" ADD CONSTRAINT "Graduacao_praticanteId_fkey" FOREIGN KEY ("praticanteId") REFERENCES "Praticante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensalidade" ADD CONSTRAINT "Mensalidade_praticanteId_fkey" FOREIGN KEY ("praticanteId") REFERENCES "Praticante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensalidade" ADD CONSTRAINT "Mensalidade_baixadaPorUsuarioId_fkey" FOREIGN KEY ("baixadaPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publicacao" ADD CONSTRAINT "Publicacao_autorUsuarioId_fkey" FOREIGN KEY ("autorUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_criadoPorUsuarioId_fkey" FOREIGN KEY ("criadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmacaoPresenca" ADD CONSTRAINT "ConfirmacaoPresenca_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmacaoPresenca" ADD CONSTRAINT "ConfirmacaoPresenca_praticanteId_fkey" FOREIGN KEY ("praticanteId") REFERENCES "Praticante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
