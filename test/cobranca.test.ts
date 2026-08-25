import { describe, expect, it } from 'vitest'
import {
  alugueisDaCompetencia,
  deveGerarPara,
  estavaAtivoEm,
  limitesDaCompetencia,
  montarLinhas,
  situacaoInicial,
  isencaoQueCobre,
  isencoesVigentesEm,
  totalDasLinhas,
} from '../shared/cobranca'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('limitesDaCompetencia', () => {
  it('acha o primeiro e o último dia', () => {
    const { primeiroDia, ultimoDia } = limitesDaCompetencia('2026-09')
    expect(primeiroDia).toEqual(d('2026-09-01'))
    expect(ultimoDia).toEqual(d('2026-09-30'))
  })

  it('acerta mês de 31 dias', () => {
    expect(limitesDaCompetencia('2026-08').ultimoDia).toEqual(d('2026-08-31'))
  })

  it('acerta fevereiro comum e bissexto', () => {
    expect(limitesDaCompetencia('2026-02').ultimoDia).toEqual(d('2026-02-28'))
    expect(limitesDaCompetencia('2028-02').ultimoDia).toEqual(d('2028-02-29'))
  })

  it('acerta dezembro sem virar o ano errado', () => {
    expect(limitesDaCompetencia('2026-12').ultimoDia).toEqual(d('2026-12-31'))
  })

  it('recusa competência inválida', () => {
    expect(() => limitesDaCompetencia('2026-13')).toThrow()
  })
})

describe('estavaAtivoEm', () => {
  it('período aberto cobre daí em diante', () => {
    expect(estavaAtivoEm([{ inicioEm: d('2020-01-01') }], d('2026-09-01'))).toBe(true)
  })

  it('não cobre antes de começar', () => {
    expect(estavaAtivoEm([{ inicioEm: d('2026-10-01') }], d('2026-09-01'))).toBe(false)
  })

  it('período fechado cobre o intervalo', () => {
    const p = [{ inicioEm: d('2026-01-01'), fimEm: d('2026-12-31') }]
    expect(estavaAtivoEm(p, d('2026-09-01'))).toBe(true)
  })

  it('não cobre depois de encerrado', () => {
    const p = [{ inicioEm: d('2020-01-01'), fimEm: d('2026-08-31') }]
    expect(estavaAtivoEm(p, d('2026-09-01'))).toBe(false)
  })

  it('sem períodos, nunca está ativo', () => {
    expect(estavaAtivoEm([], d('2026-09-01'))).toBe(false)
  })
})

describe('deveGerarPara', () => {
  it('gera para quem já era filiado no primeiro dia', () => {
    expect(deveGerarPara([{ inicioEm: d('2020-03-01') }], '2026-09')).toBe(true)
  })

  it('NÃO gera para quem se filiou no meio do mês', () => {
    // Regra da diretoria: quem entra no meio do mês paga a partir do seguinte.
    expect(deveGerarPara([{ inicioEm: d('2026-09-15') }], '2026-09')).toBe(false)
  })

  it('gera no mês seguinte para quem se filiou no meio do anterior', () => {
    expect(deveGerarPara([{ inicioEm: d('2026-09-15') }], '2026-10')).toBe(true)
  })

  it('gera para quem se filiou exatamente no dia primeiro', () => {
    expect(deveGerarPara([{ inicioEm: d('2026-09-01') }], '2026-09')).toBe(true)
  })

  it('não gera para quem já estava desligado', () => {
    const historico = [{ inicioEm: d('2020-01-01'), fimEm: d('2026-08-15') }]
    expect(deveGerarPara(historico, '2026-09')).toBe(false)
  })

  it('gera para quem saiu e voltou antes do mês', () => {
    const historico = [
      { inicioEm: d('2018-01-01'), fimEm: d('2020-01-01') },
      { inicioEm: d('2026-08-01') },
    ]
    expect(deveGerarPara(historico, '2026-09')).toBe(true)
  })

  it('não gera para quem se desligou no meio do mês anterior', () => {
    const historico = [{ inicioEm: d('2020-01-01'), fimEm: d('2026-08-20') }]
    expect(deveGerarPara(historico, '2026-09')).toBe(false)
  })
})

describe('alugueisDaCompetencia', () => {
  const alugueis = [
    { id: 'antigo', inicioEm: d('2026-01-01') },
    { id: 'no-meio', inicioEm: d('2026-09-20') },
    { id: 'curto', inicioEm: d('2026-09-02'), fimEm: d('2026-09-28') },
    { id: 'devolvido-antes', inicioEm: d('2026-05-01'), fimEm: d('2026-08-15') },
    { id: 'futuro', inicioEm: d('2026-11-01') },
  ]

  describe('regra ABERTO_NO_PRIMEIRO_DIA (padrão)', () => {
    const daCompetencia = alugueisDaCompetencia(alugueis, '2026-09', 'ABERTO_NO_PRIMEIRO_DIA')
    const ids = daCompetencia.map(a => a.id)

    it('cobra o que já existia no dia primeiro', () => {
      expect(ids).toContain('antigo')
    })

    it('não cobra o que foi retirado no meio do mês', () => {
      expect(ids).not.toContain('no-meio')
    })

    it('não cobra quem retirou e devolveu dentro do mesmo mês', () => {
      expect(ids).not.toContain('curto')
    })

    it('não cobra o que já tinha sido devolvido', () => {
      expect(ids).not.toContain('devolvido-antes')
    })

    it('não cobra aluguel que nem começou', () => {
      expect(ids).not.toContain('futuro')
    })
  })

  describe('regra ABERTO_EM_QUALQUER_DIA', () => {
    const daCompetencia = alugueisDaCompetencia(alugueis, '2026-09', 'ABERTO_EM_QUALQUER_DIA')
    const ids = daCompetencia.map(a => a.id)

    it('cobra o que existiu em qualquer dia do mês', () => {
      expect(ids).toEqual(expect.arrayContaining(['antigo', 'no-meio', 'curto']))
    })

    it('continua sem cobrar o devolvido antes do mês', () => {
      expect(ids).not.toContain('devolvido-antes')
    })

    it('continua sem cobrar o que começa depois do mês', () => {
      expect(ids).not.toContain('futuro')
    })
  })

  it('devolução no primeiro dia ainda conta como aberto naquele dia', () => {
    const noLimite = [{ id: 'x', inicioEm: d('2026-08-01'), fimEm: d('2026-09-01') }]
    expect(alugueisDaCompetencia(noLimite, '2026-09', 'ABERTO_NO_PRIMEIRO_DIA')).toHaveLength(1)
  })
})

describe('totalDasLinhas', () => {
  it('soma sem erro de ponto flutuante', () => {
    // 0.1 + 0.2 em float dá 0.30000000000000004; somar em centavos evita isso.
    const linhas = [
      { tipo: 'MENSALIDADE' as const, descricao: 'a', valor: 0.1 },
      { tipo: 'ALUGUEL' as const, descricao: 'b', valor: 0.2 },
    ]
    expect(totalDasLinhas(linhas)).toBe(0.3)
  })

  it('soma valores de verdade', () => {
    const linhas = [
      { tipo: 'MENSALIDADE' as const, descricao: 'Mensalidade', valor: 150 },
      { tipo: 'ALUGUEL' as const, descricao: 'Kote', valor: 45.5 },
      { tipo: 'ALUGUEL' as const, descricao: 'Men', valor: 20.25 },
    ]
    expect(totalDasLinhas(linhas)).toBe(215.75)
  })

  it('lista vazia soma zero', () => {
    expect(totalDasLinhas([])).toBe(0)
  })
})

const alugueis = [
  { id: 'a1', descricao: 'Kote', valorMensal: 45 },
  { id: 'a2', descricao: 'Men', valorMensal: 20 },
]

const isencao = (
  abrangencia: 'MENSALIDADE' | 'ALUGUEL' | 'TUDO',
  motivo = 'Estudante bolsista',
) => ({ abrangencia, motivo, inicioEm: d('2020-01-01') })

describe('montarLinhas', () => {
  it('monta mensalidade e uma linha por aluguel', () => {
    const linhas = montarLinhas({ valorMensalidade: 150, isencoes: [], alugueis })
    expect(linhas).toHaveLength(3)
    expect(linhas[0]).toMatchObject({ tipo: 'MENSALIDADE', valor: 150 })
    expect(totalDasLinhas(linhas)).toBe(215)
  })

  it('guarda de qual aluguel veio cada linha', () => {
    const linhas = montarLinhas({ valorMensalidade: 150, isencoes: [], alugueis })
    expect(linhas[1]?.aluguelId).toBe('a1')
  })

  it('sem aluguéis, só a mensalidade', () => {
    const linhas = montarLinhas({ valorMensalidade: 150, isencoes: [], alugueis: [] })
    expect(linhas).toHaveLength(1)
    expect(totalDasLinhas(linhas)).toBe(150)
  })
})

describe('abrangência da isenção', () => {
  it('MENSALIDADE zera a mensalidade e mantém o aluguel', () => {
    const linhas = montarLinhas({
      valorMensalidade: 150, isencoes: [isencao('MENSALIDADE')], alugueis,
    })
    expect(linhas[0]?.valor).toBe(0)
    expect(totalDasLinhas(linhas)).toBe(65)
  })

  it('ALUGUEL zera os aluguéis e mantém a mensalidade', () => {
    const linhas = montarLinhas({
      valorMensalidade: 150, isencoes: [isencao('ALUGUEL')], alugueis,
    })
    expect(linhas[0]?.valor).toBe(150)
    expect(totalDasLinhas(linhas)).toBe(150)
  })

  it('TUDO zera a cobrança inteira', () => {
    const linhas = montarLinhas({
      valorMensalidade: 150, isencoes: [isencao('TUDO')], alugueis,
    })
    expect(totalDasLinhas(linhas)).toBe(0)
  })

  it('duas isenções somam abrangências', () => {
    const linhas = montarLinhas({
      valorMensalidade: 150,
      isencoes: [isencao('MENSALIDADE', 'Bolsista'), isencao('ALUGUEL', 'Bogu doado')],
      alugueis,
    })
    expect(totalDasLinhas(linhas)).toBe(0)
  })

  it('a linha isenta mostra o motivo, em vez de sumir', () => {
    const linhas = montarLinhas({
      valorMensalidade: 150, isencoes: [isencao('TUDO', 'Bogu doado')], alugueis,
    })
    expect(linhas).toHaveLength(3)
    expect(linhas[1]?.descricao).toContain('Bogu doado')
  })

  it('não deixa a isenção sem motivo escrito', () => {
    const linhas = montarLinhas({
      valorMensalidade: 150, isencoes: [isencao('TUDO', '  ')], alugueis: [],
    })
    expect(linhas[0]?.descricao).toContain('sem motivo registrado')
  })
})

describe('situacaoInicial', () => {
  it('isenção total sem aluguel nasce ISENTA', () => {
    const isencoes = [isencao('TUDO')]
    const linhas = montarLinhas({ valorMensalidade: 150, isencoes, alugueis: [] })
    expect(situacaoInicial(linhas, isencoes)).toBe('ISENTA')
  })

  it('isenção só da mensalidade, com aluguel, nasce ABERTA', () => {
    const isencoes = [isencao('MENSALIDADE')]
    const linhas = montarLinhas({ valorMensalidade: 150, isencoes, alugueis })
    expect(situacaoInicial(linhas, isencoes)).toBe('ABERTA')
  })

  it('isenção total com aluguel nasce ISENTA', () => {
    const isencoes = [isencao('TUDO')]
    const linhas = montarLinhas({ valorMensalidade: 150, isencoes, alugueis })
    expect(situacaoInicial(linhas, isencoes)).toBe('ISENTA')
  })

  it('quem paga nasce ABERTA', () => {
    const linhas = montarLinhas({ valorMensalidade: 150, isencoes: [], alugueis: [] })
    expect(situacaoInicial(linhas, [])).toBe('ABERTA')
  })

  it('mensalidade zerada sem isenção continua ABERTA', () => {
    // Clube que ainda não configurou o valor não deve ver tudo como isento.
    const linhas = montarLinhas({ valorMensalidade: 0, isencoes: [], alugueis: [] })
    expect(situacaoInicial(linhas, [])).toBe('ABERTA')
  })
})

describe('isencoesVigentesEm', () => {
  it('vale quando cobre o primeiro dia', () => {
    expect(isencoesVigentesEm([isencao('TUDO')], '2026-09')).toHaveLength(1)
  })

  it('não vale quando começa no meio do mês', () => {
    const tardia = { ...isencao('TUDO'), inicioEm: d('2026-09-10') }
    expect(isencoesVigentesEm([tardia], '2026-09')).toHaveLength(0)
  })

  it('não vale quando já terminou', () => {
    const encerrada = { ...isencao('TUDO'), fimEm: d('2026-06-30') }
    expect(isencoesVigentesEm([encerrada], '2026-09')).toHaveLength(0)
  })
})

describe('isencaoQueCobre', () => {
  it('TUDO cobre os dois tipos', () => {
    const isencoes = [isencao('TUDO')]
    expect(isencaoQueCobre(isencoes, 'MENSALIDADE')).not.toBeNull()
    expect(isencaoQueCobre(isencoes, 'ALUGUEL')).not.toBeNull()
  })

  it('abrangência específica não cobre a outra', () => {
    const isencoes = [isencao('MENSALIDADE')]
    expect(isencaoQueCobre(isencoes, 'MENSALIDADE')).not.toBeNull()
    expect(isencaoQueCobre(isencoes, 'ALUGUEL')).toBeNull()
  })

  it('sem isenção, não cobre nada', () => {
    expect(isencaoQueCobre([], 'MENSALIDADE')).toBeNull()
  })
})
