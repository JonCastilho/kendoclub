import { describe, expect, it } from 'vitest'
import {
  type MensalidadeParaLembrar,
  dataDeReferencia,
  diasDeAtraso,
  lerDiaDePagamento,
  marcoDevido,
  montarEmailDeLembrete,
  planejarLembretes,
} from '../shared/lembrete'

describe('lerDiaDePagamento', () => {
  it('vazio quer dizer o dia do clube, e não é erro', () => {
    expect(lerDiaDePagamento('')).toEqual({ dia: null, problema: null })
    expect(lerDiaDePagamento('   ')).toEqual({ dia: null, problema: null })
  })

  it('aceita de 1 a 31', () => {
    expect(lerDiaDePagamento('1').dia).toBe(1)
    expect(lerDiaDePagamento('20').dia).toBe(20)
    expect(lerDiaDePagamento('31').dia).toBe(31)
    expect(lerDiaDePagamento('05').dia).toBe(5)
  })

  it.each(['0', '32', '-3', '1.5', '10abc', '1e1', 'dez', '100'])('recusa %s', (entrada) => {
    const { dia, problema } = lerDiaDePagamento(entrada)
    expect(dia).toBeNull()
    expect(problema).toContain('1 a 31')
  })
})

describe('dataDeReferencia', () => {
  it('sem dia combinado, conta do vencimento da cobrança', () => {
    expect(dataDeReferencia('2026-10-10', '2026-10', null)).toBe('2026-10-10')
  })

  it('com dia combinado depois do vencimento, conta do dia combinado', () => {
    expect(dataDeReferencia('2026-10-10', '2026-10', 20)).toBe('2026-10-20')
  })

  it('com dia combinado antes do vencimento, conta do vencimento', () => {
    // Senão sairia "em atraso" de uma cobrança que ainda nem venceu.
    expect(dataDeReferencia('2026-10-10', '2026-10', 5)).toBe('2026-10-10')
    expect(dataDeReferencia('2026-10-10', '2026-10', 10)).toBe('2026-10-10')
  })

  it('dia que não existe no mês cai no último dia dele', () => {
    expect(dataDeReferencia('2026-02-10', '2026-02', 31)).toBe('2026-02-28')
    expect(dataDeReferencia('2028-02-10', '2028-02', 30)).toBe('2028-02-29')
    expect(dataDeReferencia('2026-04-10', '2026-04', 31)).toBe('2026-04-30')
  })
})

describe('diasDeAtraso', () => {
  it('conta dias de calendário', () => {
    expect(diasDeAtraso('2026-10-10', '2026-10-10')).toBe(0)
    expect(diasDeAtraso('2026-10-10', '2026-10-25')).toBe(15)
  })

  it('atravessa mês e ano', () => {
    expect(diasDeAtraso('2026-12-20', '2027-01-04')).toBe(15)
    expect(diasDeAtraso('2026-02-20', '2026-03-22')).toBe(30)
  })

  it('não sofre com a virada do horário de verão: dia é dia', () => {
    expect(diasDeAtraso('2026-10-30', '2026-11-30')).toBe(31)
    expect(diasDeAtraso('2026-03-01', '2026-04-01')).toBe(31)
  })

  it('é negativo enquanto a data não chegou', () => {
    expect(diasDeAtraso('2026-10-20', '2026-10-15')).toBe(-5)
  })
})

describe('marcoDevido', () => {
  it('só dispara dentro da janela de cada marco', () => {
    expect(marcoDevido(14, [])).toBeNull()
    expect(marcoDevido(15, [])).toBe(15)
    expect(marcoDevido(29, [])).toBe(15)
    expect(marcoDevido(30, [])).toBe(30)
    expect(marcoDevido(44, [])).toBe(30)
    expect(marcoDevido(45, [])).toBeNull()
    expect(marcoDevido(200, [])).toBeNull()
  })

  it('não repete marco já enviado', () => {
    expect(marcoDevido(20, [15])).toBeNull()
    expect(marcoDevido(35, [15, 30])).toBeNull()
    expect(marcoDevido(35, [30])).toBeNull()
  })

  it('o de 30 sai depois do de 15', () => {
    expect(marcoDevido(30, [15])).toBe(30)
  })

  it('quem perdeu o de 15 recebe só o de 30, e não os dois de uma vez', () => {
    expect(marcoDevido(35, [])).toBe(30)
  })

  it('antes do vencimento, ou no dia, não há lembrete', () => {
    expect(marcoDevido(-3, [])).toBeNull()
    expect(marcoDevido(0, [])).toBeNull()
  })
})

describe('planejarLembretes', () => {
  const base = (sobrescreve: Partial<MensalidadeParaLembrar> = {}, praticante: Partial<MensalidadeParaLembrar['praticante']> = {}): MensalidadeParaLembrar => ({
    id: 'm1',
    competencia: '2026-10',
    vencimento: '2026-10-10',
    valorTotal: '150',
    situacao: 'ABERTA',
    declaracoes: [],
    enviados: [],
    ...sobrescreve,
    praticante: {
      id: 'p1',
      nomeCompleto: 'Ana Souza',
      email: 'ana@teste.local',
      diaDePagamento: null,
      temAcesso: true,
      ...praticante,
    },
  })

  // 25 dias depois do vencimento de 10/10.
  const hoje = '2026-11-04'

  it('lembra quem está no marco de 15 dias', () => {
    const plano = planejarLembretes([base()], '2026-10-25')
    expect(plano).toHaveLength(1)
    expect(plano[0]!.itens).toEqual([{
      mensalidadeId: 'm1', competencia: '2026-10', valor: 150,
      referencia: '2026-10-10', atraso: 15, marco: 15,
    }])
  })

  it('não lembra antes do marco', () => {
    expect(planejarLembretes([base()], '2026-10-24')).toEqual([])
  })

  it('não lembra depois da janela do último marco', () => {
    expect(planejarLembretes([base()], '2026-11-25')).toEqual([])
  })

  it('o dia combinado desloca o lembrete', () => {
    const m = base({}, { diaDePagamento: 20 })
    // Pelo vencimento já seria o 15º dia; pelo dia 20, ainda faltam 10.
    expect(planejarLembretes([m], '2026-10-25')).toEqual([])
    expect(planejarLembretes([m], '2026-11-04')).toHaveLength(1)
  })

  it('dia combinado anterior ao vencimento não adianta o lembrete', () => {
    const m = base({}, { diaDePagamento: 2 })
    expect(planejarLembretes([m], '2026-10-24')).toEqual([])
    expect(planejarLembretes([m], '2026-10-25')).toHaveLength(1)
  })

  it('não lembra quem já pagou, é isento ou teve a cobrança cancelada', () => {
    for (const situacao of ['PAGA', 'ISENTA', 'CANCELADA']) {
      expect(planejarLembretes([base({ situacao })], hoje)).toEqual([])
    }
  })

  it('não lembra cobrança de valor zero', () => {
    // Mensalidade ainda sem valor configurado nasce aberta e zerada.
    expect(planejarLembretes([base({ valorTotal: '0' })], '2026-10-25')).toEqual([])
    expect(planejarLembretes([base({ valorTotal: 0 })], '2026-10-25')).toEqual([])
  })

  it('não lembra quem avisou que pagou e espera conferência', () => {
    const aviso = { pagoEm: '2026-10-20', analisadaEm: null, aceita: null }
    expect(planejarLembretes([base({ declaracoes: [aviso] })], '2026-10-25')).toEqual([])
  })

  it('volta a lembrar se a diretoria recusou o aviso', () => {
    const recusado = { pagoEm: '2026-10-20', analisadaEm: '2026-10-22', aceita: false, motivoRecusa: 'Não achei' }
    expect(planejarLembretes([base({ declaracoes: [recusado] })], '2026-10-25')).toHaveLength(1)
  })

  it('não lembra quem não tem e-mail', () => {
    expect(planejarLembretes([base({}, { email: '   ' })], '2026-10-25')).toEqual([])
  })

  it('não repete o marco já enviado', () => {
    expect(planejarLembretes([base({ enviados: [15] })], '2026-10-25')).toEqual([])
    expect(planejarLembretes([base({ enviados: [15] })], '2026-11-09')).toHaveLength(1)
  })

  it('junta as mensalidades de uma pessoa num só e-mail, cada uma no seu marco', () => {
    const nova = base({ id: 'nova' })
    const velha = base({ id: 'velha', competencia: '2026-09', vencimento: '2026-09-25' })
    const plano = planejarLembretes([nova, velha], '2026-10-25')

    // Um e-mail só, com a mais antiga primeiro.
    expect(plano).toHaveLength(1)
    expect(plano[0]!.itens.map(i => [i.mensalidadeId, i.marco])).toEqual([['velha', 30], ['nova', 15]])
  })

  it('ordena as pessoas pelo nome', () => {
    const bia = base({ id: 'b' }, { id: 'pb', nomeCompleto: 'Bia', email: 'b@t.local' })
    const ana = base({ id: 'a' }, { id: 'pa', nomeCompleto: 'Ana', email: 'a@t.local' })
    const plano = planejarLembretes([bia, ana], '2026-10-25')
    expect(plano.map(l => l.nome)).toEqual(['Ana', 'Bia'])
  })
})

describe('montarEmailDeLembrete', () => {
  const item = (competencia: string, referencia: string, atraso: number, valor = 150) => ({
    mensalidadeId: competencia, competencia, valor, referencia, atraso, marco: 15 as const,
  })

  it('diz o que está em aberto, até quando era e quantos dias faz', () => {
    const { assunto, texto } = montarEmailDeLembrete({
      nomeClube: 'Clube de Teste',
      nome: 'Ana Souza',
      diaDePagamento: null,
      itens: [item('2026-10', '2026-10-10', 15)],
      link: 'https://clube.exemplo/minhas-mensalidades',
    })

    expect(assunto).toBe('Mensalidade em atraso - Clube de Teste')
    expect(texto).toContain('Olá, Ana.')
    expect(texto).toContain('Esta mensalidade do Clube de Teste segue em aberto')
    expect(texto).toContain('outubro/2026')
    expect(texto).toContain('150,00')
    expect(texto).toContain('10/10/2026')
    expect(texto).toContain('15 dias de atraso')
    expect(texto).toContain('https://clube.exemplo/minhas-mensalidades')
  })

  it('usa o plural com mais de uma mensalidade', () => {
    const { assunto, texto } = montarEmailDeLembrete({
      nomeClube: 'Clube',
      nome: 'Ana',
      diaDePagamento: null,
      itens: [item('2026-09', '2026-09-10', 45), item('2026-10', '2026-10-10', 15)],
      link: null,
    })

    expect(assunto).toBe('Mensalidades em atraso - Clube')
    expect(texto).toContain('Estas mensalidades do Clube seguem em aberto')
    expect(texto).toContain('setembro/2026')
    expect(texto).toContain('outubro/2026')
  })

  it('lembra o dia combinado, quando há', () => {
    const com = montarEmailDeLembrete({
      nomeClube: 'C', nome: 'Ana', diaDePagamento: 20, itens: [item('2026-10', '2026-10-20', 15)], link: null,
    })
    expect(com.texto).toContain('Você combinou pagar no dia 20 de cada mês.')

    const sem = montarEmailDeLembrete({
      nomeClube: 'C', nome: 'Ana', diaDePagamento: null, itens: [item('2026-10', '2026-10-10', 15)], link: null,
    })
    expect(sem.texto).not.toContain('combinou')
  })

  it('sem acesso ao sistema, manda procurar a diretoria e não promete link', () => {
    const { texto } = montarEmailDeLembrete({
      nomeClube: 'C', nome: 'Ana', diaDePagamento: null, itens: [item('2026-10', '2026-10-10', 15)], link: null,
    })

    expect(texto).not.toContain('http')
    expect(texto).toContain('Procure a diretoria')
  })

  it('escreve "1 dia" no singular', () => {
    const { texto } = montarEmailDeLembrete({
      nomeClube: 'C', nome: 'Ana', diaDePagamento: null, itens: [item('2026-10', '2026-10-10', 1)], link: null,
    })
    expect(texto).toContain('1 dia de atraso')
  })
})
