import type { Grau } from '@prisma/client'
import { grauPertenceAModalidade, ordemDoGrau, rotuloDaGraduacao } from './graduacao'

/**
 * Regras da competição (etapa 7.2). Motivos em PLANO.md, etapa 7.
 *
 * Cada campeonato traz a própria tabela de categorias, separada por disputa
 * (individual e por equipes). As categorias que servem a cada pessoa saem do
 * cadastro — sexo, idade no ano e graduação na modalidade —, e a pessoa escolhe
 * no máximo uma de cada disputa.
 */

export type SexoCategoria = 'MASCULINO' | 'FEMININO' | 'MISTO'

export type TipoCategoria = 'INDIVIDUAL' | 'EQUIPE'

export const TIPOS_DE_CATEGORIA: TipoCategoria[] = ['INDIVIDUAL', 'EQUIPE']

export const ROTULO_DO_TIPO_DE_CATEGORIA: Record<TipoCategoria, string> = {
  INDIVIDUAL: 'Individual',
  EQUIPE: 'Por equipes',
}

export const ROTULO_DO_SEXO: Record<SexoCategoria, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
  MISTO: 'Misto',
}

/**
 * Idade que a pessoa completa ou completou no ano do evento.
 *
 * É a regra usada nos campeonatos: só o ano conta, então quem nasceu em
 * dezembro compete na mesma faixa de quem nasceu em janeiro.
 */
export function idadeNoAno(dataNascimento: string, diaDoEvento: string): number {
  return Number(diaDoEvento.slice(0, 4)) - Number(dataNascimento.slice(0, 4))
}

/**
 * Posição do grau para comparar, com mukyu abaixo de todos.
 * Mukyu é a ausência de grau, então fica fora da escala do enum.
 */
function posicao(grau: Grau | null): number {
  return grau === null ? Number.NEGATIVE_INFINITY : ordemDoGrau(grau)
}

export interface Categoria {
  id: string
  nome: string
  tipo: TipoCategoria
  sexo: SexoCategoria
  idadeMinima: number | null
  idadeMaxima: number | null
  grauMinimo: Grau | null
  grauMaximo: Grau | null
  /** Quem compete nesta categoria não paga a participação. */
  isenta: boolean
}

export interface Competidor {
  sexo: 'MASCULINO' | 'FEMININO'
  idade: number
  /** Nulo é mukyu. */
  grau: Grau | null
}

/** Faixa em branco é faixa sem limite; os dois extremos entram. */
export function categoriaServe(categoria: Categoria, competidor: Competidor): boolean {
  if (categoria.sexo !== 'MISTO' && categoria.sexo !== competidor.sexo) return false

  if (categoria.idadeMinima !== null && competidor.idade < categoria.idadeMinima) return false
  if (categoria.idadeMaxima !== null && competidor.idade > categoria.idadeMaxima) return false

  const grau = posicao(competidor.grau)
  if (categoria.grauMinimo !== null && grau < ordemDoGrau(categoria.grauMinimo)) return false
  if (categoria.grauMaximo !== null && grau > ordemDoGrau(categoria.grauMaximo)) return false

  return true
}

export function categoriasCompativeis<T extends Categoria>(categorias: T[], competidor: Competidor): T[] {
  return categorias.filter(c => categoriaServe(c, competidor))
}

export interface EscolhaNaCompeticao {
  /** Categoria escolhida em cada disputa; vazio é "não participo". */
  individual: string
  equipe: string
}

/**
 * Valida a participação numa competição.
 *
 * A pessoa escolhe no máximo uma categoria de cada disputa, entre as que servem
 * ao cadastro, e ao menos uma disputa. Escolher categoria que não serve é
 * recusa — e quando nenhuma da disputa serve, a mensagem aponta a tabela,
 * porque quase sempre é ela que está incompleta, não a pessoa que está errada.
 */
export function decidirCompeticao(
  escolha: EscolhaNaCompeticao,
  compativeis: Array<{ id: string, tipo: TipoCategoria }>,
  nomeDaCompeticao: string,
): { categoriaIndividualId: string | null, categoriaEquipeId: string | null, problemas: string[] } {
  const problemas: string[] = []

  const decidir = (tipo: TipoCategoria, escolhida: string, disputa: string) => {
    if (!escolhida) return null

    const daDisputa = compativeis.filter(c => c.tipo === tipo)
    if (daDisputa.some(c => c.id === escolhida)) return escolhida

    problemas.push(daDisputa.length === 0
      ? `Nenhuma categoria ${disputa} de ${nomeDaCompeticao} atende a este cadastro. `
      + 'A tabela de categorias provavelmente está incompleta — avise a diretoria.'
      : `A categoria ${disputa} escolhida em ${nomeDaCompeticao} não atende a este cadastro.`)
    return null
  }

  const categoriaIndividualId = decidir('INDIVIDUAL', escolha.individual, 'individual')
  const categoriaEquipeId = decidir('EQUIPE', escolha.equipe, 'por equipes')

  if (!escolha.individual && !escolha.equipe) {
    problemas.push(`Em ${nomeDaCompeticao}, escolha a disputa individual, por equipes ou as duas.`)
  }

  return { categoriaIndividualId, categoriaEquipeId, problemas }
}

/** A participação só é gratuita se todas as categorias escolhidas são isentas. */
export function participacaoIsenta(escolhidas: Array<{ isenta: boolean } | undefined>): boolean {
  return escolhidas.length > 0 && escolhidas.every(c => c?.isenta === true)
}

export interface DadosDaCategoria {
  nome: string
  tipo: string
  sexo: string
  idadeMinima: number | null
  idadeMaxima: number | null
  grauMinimo: string | null
  grauMaximo: string | null
}

/** Número de idade vindo de formulário: vazio é "sem limite", lixo é NaN. */
export function lerIdade(bruto: string): number | null {
  const limpo = bruto.trim()
  if (!limpo) return null
  return /^\d+$/.test(limpo) ? Number(limpo) : Number.NaN
}

export function problemasDaCategoria(dados: DadosDaCategoria, kyuInicial: number): string[] {
  const problemas: string[] = []

  if (!dados.nome.trim()) problemas.push('Informe o nome da categoria.')
  if (!TIPOS_DE_CATEGORIA.includes(dados.tipo as TipoCategoria)) {
    problemas.push('Escolha o tipo da categoria: individual ou por equipes.')
  }
  if (!['MASCULINO', 'FEMININO', 'MISTO'].includes(dados.sexo)) problemas.push('Escolha o sexo da categoria.')

  const idades = [dados.idadeMinima, dados.idadeMaxima]
  if (idades.some(i => i !== null && (!Number.isInteger(i) || i < 0 || i > 120))) {
    problemas.push('A idade precisa ser um número inteiro, de 0 a 120.')
  }
  else if (dados.idadeMinima !== null && dados.idadeMaxima !== null && dados.idadeMinima > dados.idadeMaxima) {
    problemas.push('A idade mínima não pode ser maior que a máxima.')
  }

  const graus = [dados.grauMinimo, dados.grauMaximo].filter((g): g is string => g !== null)
  if (graus.some(g => !grauPertenceAModalidade(g as Grau, kyuInicial))) {
    problemas.push('Graduação fora da faixa desta modalidade.')
  }
  else if (dados.grauMinimo && dados.grauMaximo
    && ordemDoGrau(dados.grauMinimo as Grau) > ordemDoGrau(dados.grauMaximo as Grau)) {
    problemas.push('A graduação mínima não pode ser maior que a máxima.')
  }

  return problemas
}

/** "18 a 35 anos", "a partir de 18 anos", "até 12 anos", "qualquer idade". */
export function rotuloDaIdade(minima: number | null, maxima: number | null): string {
  if (minima !== null && maxima !== null) {
    return minima === maxima ? `${minima} anos` : `${minima} a ${maxima} anos`
  }
  if (minima !== null) return `a partir de ${minima} anos`
  if (maxima !== null) return `até ${maxima} anos`
  return 'qualquer idade'
}

/** "3º kyu a 1º dan", "a partir de 1º dan", "até 2º kyu", "qualquer graduação". */
export function rotuloDaFaixaDeGrau(minimo: Grau | null, maximo: Grau | null): string {
  if (minimo && maximo) {
    return minimo === maximo
      ? rotuloDaGraduacao(minimo)
      : `${rotuloDaGraduacao(minimo)} a ${rotuloDaGraduacao(maximo)}`
  }
  if (minimo) return `a partir de ${rotuloDaGraduacao(minimo)}`
  if (maximo) return `até ${rotuloDaGraduacao(maximo)}`
  return 'qualquer graduação'
}
