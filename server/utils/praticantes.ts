import type { Prisma } from '@prisma/client'
import { normalizarDocumento } from '~~/shared/documento'
import { type DadosDoCadastro, problemasDoCadastro } from '~~/shared/praticante'

/**
 * Campos que a listagem devolve.
 *
 * Documento e observações médicas ficam de fora de propósito: CPF em tela aberta
 * é material de fraude, e observação médica é dado sensível que só aparece na
 * ficha, para a diretoria. Ver PLANO.md §11.
 */
export const camposDaListagem = {
  id: true,
  nomeCompleto: true,
  email: true,
  telefone: true,
  dataNascimento: true,
  filiacoes: { select: { inicioEm: true, fimEm: true } },
  modalidades: { select: { modalidade: { select: { nome: true } } } },
} satisfies Prisma.PraticanteSelect

export interface CorpoDoPraticante {
  dados: Omit<Prisma.PraticanteUncheckedCreateInput, 'id'>
  problemas: string[]
}

/**
 * Traduz o formulário para o formato do banco e aplica as regras de negócio.
 * `anteriores` preserva as datas de consentimento já registradas.
 */
export function lerFormularioDoPraticante(
  corpo: Record<string, unknown>,
  anteriores?: {
    consentimentoDadosEm?: Date | null
    consentimentoSaudeEm?: Date | null
    autorizacaoImagemEm?: Date | null
    responsavelConsentimentoEm?: Date | null
  },
): CorpoDoPraticante {
  const tipoDocumento = texto(corpo.tipoDocumento) === 'DOCUMENTO_ESTRANGEIRO'
    ? 'DOCUMENTO_ESTRANGEIRO'
    : 'CPF'
  const titularDocumento = texto(corpo.titularDocumento) === 'RESPONSAVEL'
    ? 'RESPONSAVEL'
    : 'PROPRIO'

  const dataNascimento = dataUtc(corpo.dataNascimento)
  const documento = normalizarDocumento(texto(corpo.documento), tipoDocumento)

  const consentimentoSaudeEm = consentimentoEm(
    corpo.consentimentoSaude, anteriores?.consentimentoSaudeEm)
  const responsavelConsentimentoEm = consentimentoEm(
    corpo.responsavelConsentimento, anteriores?.responsavelConsentimentoEm)

  const paraValidar: DadosDoCadastro = {
    nomeCompleto: texto(corpo.nomeCompleto),
    dataNascimento: dataNascimento ?? new Date(Number.NaN),
    documento,
    tipoDocumento,
    titularDocumento,
    email: texto(corpo.email),
    telefone: texto(corpo.telefone),
    responsavelNome: opcional(corpo.responsavelNome),
    responsavelTelefone: opcional(corpo.responsavelTelefone),
    responsavelConsentimentoEm,
    observacoesMedicas: opcional(corpo.observacoesMedicas),
    consentimentoSaudeEm,
  }

  const problemas = problemasDoCadastro(paraValidar)

  return {
    problemas,
    dados: {
      nomeCompleto: paraValidar.nomeCompleto,
      dataNascimento: dataNascimento ?? new Date(0),
      sexo: texto(corpo.sexo) === 'FEMININO' ? 'FEMININO' : 'MASCULINO',
      nacionalidade: texto(corpo.nacionalidade) || 'Brasileira',
      documento,
      tipoDocumento,
      titularDocumento,
      email: paraValidar.email,
      telefone: paraValidar.telefone,
      telefoneAlternativo: opcional(corpo.telefoneAlternativo),
      cep: opcional(corpo.cep),
      logradouro: opcional(corpo.logradouro),
      numero: opcional(corpo.numero),
      complemento: opcional(corpo.complemento),
      bairro: opcional(corpo.bairro),
      cidade: opcional(corpo.cidade),
      uf: opcional(corpo.uf)?.toUpperCase() ?? null,
      emergenciaNome: opcional(corpo.emergenciaNome),
      emergenciaTelefone: opcional(corpo.emergenciaTelefone),
      emergenciaParentesco: opcional(corpo.emergenciaParentesco),
      responsavelNome: paraValidar.responsavelNome,
      responsavelTelefone: paraValidar.responsavelTelefone,
      observacoesMedicas: paraValidar.observacoesMedicas,
      iniciouPraticaEm: dataUtc(corpo.iniciouPraticaEm),
      observacoes: opcional(corpo.observacoes),
      consentimentoDadosEm: consentimentoEm(
        corpo.consentimentoDados, anteriores?.consentimentoDadosEm),
      consentimentoSaudeEm,
      autorizacaoImagemEm: consentimentoEm(
        corpo.autorizacaoImagem, anteriores?.autorizacaoImagemEm),
      responsavelConsentimentoEm,
    },
  }
}

/**
 * Traduz erro de violação de índice único do Postgres para linguagem de gente.
 * O índice de documento próprio é parcial e criado à mão na migration, então o
 * Prisma não sabe o nome do campo — vem só o nome do índice.
 */
export function mensagemDeConflito(erro: unknown): string | null {
  const codigo = (erro as { code?: string })?.code
  if (codigo !== 'P2002') return null

  // Índices parciais são criados à mão na migration, então o Prisma não sabe a
  // qual campo pertencem: `meta.target` vem vazio e o nome do índice fica dentro
  // do erro original do driver. E a mensagem do Postgres vem no idioma do
  // servidor — por isso o casamento é pelo nome do índice, que não muda.
  const meta = JSON.stringify((erro as { meta?: unknown })?.meta ?? '')

  if (meta.includes('Praticante_documento_proprio_unico')) {
    return 'Já existe praticante cadastrado com este documento.'
  }
  if (meta.includes('Filiacao_aberta_unica')) {
    return 'Este praticante já tem uma filiação em aberto.'
  }
  return 'Registro duplicado.'
}
