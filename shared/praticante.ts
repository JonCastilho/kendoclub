import { problemasDoDocumento } from './documento'
import { ehMenorDeIdade } from './idade'

/**
 * Regras do cadastro de praticante que não são "campo obrigatório" — as que
 * dependem de outro campo. Ficam aqui, puras, para poderem ser testadas sem
 * banco e sem tela.
 */

export interface DadosDoCadastro {
  nomeCompleto: string
  dataNascimento: Date
  documento: string
  tipoDocumento: 'CPF' | 'DOCUMENTO_ESTRANGEIRO'
  titularDocumento: 'PROPRIO' | 'RESPONSAVEL'
  email: string
  telefone: string
  responsavelNome?: string | null
  responsavelTelefone?: string | null
  responsavelConsentimentoEm?: Date | null
  observacoesMedicas?: string | null
  consentimentoSaudeEm?: Date | null
}

const preenchido = (valor?: string | null): boolean => Boolean(valor && valor.trim())

export function problemasDoCadastro(dados: DadosDoCadastro, hoje: Date = new Date()): string[] {
  const problemas: string[] = []

  if (!preenchido(dados.nomeCompleto)) {
    problemas.push('Informe o nome completo.')
  }

  if (Number.isNaN(dados.dataNascimento.getTime())) {
    problemas.push('Informe uma data de nascimento válida.')
  }
  else if (dados.dataNascimento > hoje) {
    problemas.push('A data de nascimento não pode estar no futuro.')
  }

  problemas.push(...problemasDoDocumento(dados.documento, dados.tipoDocumento))

  if (!preenchido(dados.email)) problemas.push('Informe o e-mail de contato.')
  if (!preenchido(dados.telefone)) problemas.push('Informe o telefone.')

  const menor = !Number.isNaN(dados.dataNascimento.getTime())
    && ehMenorDeIdade(dados.dataNascimento, hoje)

  if (menor) {
    if (!preenchido(dados.responsavelNome) || !preenchido(dados.responsavelTelefone)) {
      problemas.push('Praticante menor de idade exige nome e telefone do responsável.')
    }
    if (!dados.responsavelConsentimentoEm) {
      problemas.push('Registre o consentimento do responsável (LGPD).')
    }
  }

  // Documento de terceiro só se justifica para quem ainda não tem o próprio.
  if (dados.titularDocumento === 'RESPONSAVEL' && !menor) {
    problemas.push('Documento do responsável só vale para praticante menor de idade.')
  }

  // Observação médica é dado sensível: sem consentimento específico, não se
  // guarda. Ver PLANO.md §11.
  if (preenchido(dados.observacoesMedicas) && !dados.consentimentoSaudeEm) {
    problemas.push(
      'Para registrar observações médicas é preciso o consentimento específico para dados de saúde.',
    )
  }

  return problemas
}

export function exigeResponsavel(dataNascimento: Date, hoje: Date = new Date()): boolean {
  return ehMenorDeIdade(dataNascimento, hoje)
}
