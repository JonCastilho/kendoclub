import { describe, expect, it } from 'vitest'
import {
  crc16,
  gerarPix,
  limiteDaMensagem,
  montarMensagemDoPix,
  nomeCurto,
  problemasDoPix,
  textoAscii,
} from '../shared/pix'

/** Lê o BR Code em campos: identificador → valor, sem descer nos campos compostos. */
function campos(payload: string): Record<string, string> {
  const lidos: Record<string, string> = {}
  let posicao = 0
  while (posicao < payload.length) {
    const id = payload.slice(posicao, posicao + 2)
    const tamanho = Number(payload.slice(posicao + 2, posicao + 4))
    lidos[id] = payload.slice(posicao + 4, posicao + 4 + tamanho)
    posicao += 4 + tamanho
  }
  return lidos
}

const clube = { chave: 'clube@exemplo.org', nome: 'Clube de Kendo Fukuhaku', cidade: 'Sao Paulo' }

describe('crc16', () => {
  it('bate com o vetor de teste conhecido do CRC16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1')
  })

  it('bate com o exemplo do manual do Pix do Banco Central', () => {
    const semCrc = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000'
      + '5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'
    expect(crc16(semCrc)).toBe('1D3D')
  })
})

describe('textoAscii', () => {
  it('tira acento e troca travessão por hífen', () => {
    expect(textoAscii('Campeonato — Competição de Iaidô')).toBe('Campeonato - Competicao de Iaido')
  })

  it('descarta o que não é ASCII e espaços repetidos', () => {
    expect(textoAscii('  剣道   Kendo  ')).toBe('Kendo')
  })
})

describe('gerarPix', () => {
  const pix = gerarPix({ ...clube, valor: 150, mensagem: 'Jonas Castilho - Campeonato: exame' })
  const lidos = campos(pix)

  it('segue a estrutura do BR Code estático com valor', () => {
    expect(lidos['00']).toBe('01')
    expect(lidos['01']).toBe('11')
    expect(lidos['52']).toBe('0000')
    expect(lidos['53']).toBe('986')
    expect(lidos['54']).toBe('150.00')
    expect(lidos['58']).toBe('BR')
    expect(campos(lidos['62']!)['05']).toBe('***')
  })

  it('guarda a chave e a mensagem dentro do campo da conta', () => {
    const conta = campos(lidos['26']!)
    expect(conta['00']).toBe('br.gov.bcb.pix')
    expect(conta['01']).toBe('clube@exemplo.org')
    expect(conta['02']).toBe('Jonas Castilho - Campeonato: exame')
  })

  it('escreve titular e cidade em maiúsculas, sem acento, dentro do limite', () => {
    const acentuado = campos(gerarPix({
      ...clube, nome: 'Associação de Kendô Fukuhaku do Estado de São Paulo', cidade: 'São José dos Campos', valor: 10,
    }))
    expect(acentuado['59']).toBe('ASSOCIACAO DE KENDO FUKUH')
    expect(acentuado['60']).toBe('SAO JOSE DOS CA')
  })

  it('termina com o CRC do que veio antes', () => {
    const semCrc = pix.slice(0, -4)
    expect(semCrc.endsWith('6304')).toBe(true)
    expect(pix.slice(-4)).toBe(crc16(semCrc))
  })

  it('sem mensagem, o campo 02 não existe', () => {
    const conta = campos(campos(gerarPix({ ...clube, valor: 10 }))['26']!)
    expect(conta['02']).toBeUndefined()
  })

  it('corta a mensagem no que cabe, em vez de gerar um código que o banco recusa', () => {
    const chave = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    const longa = 'x'.repeat(200)
    const conta = campos(campos(gerarPix({ ...clube, chave, valor: 10, mensagem: longa }))['26']!)
    expect(conta['02']).toHaveLength(limiteDaMensagem(chave))
    expect(Object.values(conta).join('').length + 6).toBeLessThanOrEqual(99)
  })

  it('o conteúdo do campo 26 nunca passa de 99 caracteres', () => {
    const chave = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    const lido = campos(gerarPix({ ...clube, chave, valor: 10, mensagem: 'y'.repeat(300) }))['26']!
    expect(lido.length).toBeLessThanOrEqual(99)
  })
})

describe('limiteDaMensagem', () => {
  it('sobra menos espaço com chave comprida', () => {
    expect(limiteDaMensagem('12345678901')).toBe(62)
    expect(limiteDaMensagem('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(37)
  })
})

describe('problemasDoPix', () => {
  it('aceita o Pix completo', () => {
    expect(problemasDoPix({ ...clube, valor: 50 })).toEqual([])
  })

  it('recusa configuração incompleta e valor zerado', () => {
    expect(problemasDoPix({ chave: '', nome: '', cidade: '', valor: 50 })).toHaveLength(3)
    expect(problemasDoPix({ ...clube, valor: 0 })[0]).toContain('maior que zero')
  })
})

describe('montarMensagemDoPix', () => {
  const dados = {
    nome: 'Jonas Thadeu Castilho',
    evento: 'Campeonato Fukuhaku',
    itens: ['competição', 'exame', 'obento (2)'],
  }

  it('diz quem paga e o que paga, em ASCII', () => {
    expect(montarMensagemDoPix(dados, 90))
      .toBe('Jonas Thadeu Castilho - Campeonato Fukuhaku: competicao, exame, obento (2)')
  })

  it('tira os nomes do meio quando não cabe', () => {
    expect(montarMensagemDoPix(dados, 70))
      .toBe('Jonas Castilho - Campeonato Fukuhaku: competicao, exame, obento (2)')
  })

  it('encurta o evento antes de perder os itens', () => {
    const mensagem = montarMensagemDoPix(dados, 60)
    expect(mensagem.length).toBeLessThanOrEqual(60)
    expect(mensagem.startsWith('Jonas Castilho - Campeonato')).toBe(true)
    expect(mensagem.endsWith(': competicao, exame, obento (2)')).toBe(true)
  })

  it('sem espaço legível para o evento, ficam o nome e os itens', () => {
    expect(montarMensagemDoPix(dados, 55)).toBe('Jonas Castilho: competicao, exame, obento (2)')
  })

  it('no limite mais apertado, ainda traz o nome e cabe', () => {
    const mensagem = montarMensagemDoPix(dados, 20)
    expect(mensagem.length).toBeLessThanOrEqual(20)
    expect(mensagem.startsWith('Jonas Castilho')).toBe(true)
  })

  it('sem itens, só nome e evento', () => {
    expect(montarMensagemDoPix({ ...dados, itens: [] }, 90)).toBe('Jonas Thadeu Castilho - Campeonato Fukuhaku')
  })
})

describe('nomeCurto', () => {
  it('fica com o primeiro e o último nome', () => {
    expect(nomeCurto('Jonas Thadeu Castilho')).toBe('Jonas Castilho')
    expect(nomeCurto('Ana Silva')).toBe('Ana Silva')
    expect(nomeCurto('Ana')).toBe('Ana')
  })
})
