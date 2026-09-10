import { describe, expect, it } from 'vitest'
import {
  LIMITE_BYTES,
  extensaoDoTipo,
  nomeDeCapaValido,
  problemasDaImagem,
  tipoDaImagem,
  urlDaCapa,
} from '../shared/imagem'

/** Cabeçalho de arquivo seguido de recheio, que é o que um arquivo real tem. */
function arquivo(assinatura: number[], tamanho = 64): Uint8Array {
  const bytes = new Uint8Array(tamanho)
  bytes.set(assinatura, 0)
  return bytes
}

const JPEG = [0xFF, 0xD8, 0xFF, 0xE0]
const PNG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]

function webp(): Uint8Array {
  const bytes = arquivo([0x52, 0x49, 0x46, 0x46])
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  return bytes
}

function texto(conteudo: string): Uint8Array {
  return new TextEncoder().encode(conteudo)
}

describe('tipoDaImagem', () => {
  it('reconhece JPEG, PNG e WebP', () => {
    expect(tipoDaImagem(arquivo(JPEG))).toBe('image/jpeg')
    expect(tipoDaImagem(arquivo(PNG))).toBe('image/png')
    expect(tipoDaImagem(webp())).toBe('image/webp')
  })

  it('recusa SVG, que é texto com script dentro', () => {
    expect(tipoDaImagem(texto('<svg onload="alert(1)"></svg>'))).toBeNull()
  })

  it('recusa HTML com nome de imagem', () => {
    // O caso que motiva conferir os bytes: o arquivo se chama foto.jpg e o
    // navegador anuncia image/jpeg, mas o conteúdo é uma página.
    expect(tipoDaImagem(texto('<!doctype html><script>alert(1)</script>'))).toBeNull()
  })

  it('recusa arquivo vazio e arquivo menor que a assinatura', () => {
    expect(tipoDaImagem(new Uint8Array(0))).toBeNull()
    expect(tipoDaImagem(new Uint8Array([0xFF, 0xD8]))).toBeNull()
  })

  it('recusa RIFF que não é WebP', () => {
    // Um .wav também começa com RIFF; só o que vem no oitavo byte separa os dois.
    const wav = arquivo([0x52, 0x49, 0x46, 0x46])
    wav.set([0x57, 0x41, 0x56, 0x45], 8)
    expect(tipoDaImagem(wav)).toBeNull()
  })

  it('não se deixa enganar por assinatura fora do começo', () => {
    const bytes = new Uint8Array(64)
    bytes.set(PNG, 4)
    expect(tipoDaImagem(bytes)).toBeNull()
  })
})

describe('problemasDaImagem', () => {
  it('aceita imagem dentro do limite', () => {
    expect(problemasDaImagem(arquivo(PNG))).toEqual([])
  })

  it('reclama de arquivo vazio', () => {
    expect(problemasDaImagem(new Uint8Array(0))).toHaveLength(1)
  })

  it('reclama de arquivo acima do limite, mesmo sendo imagem de verdade', () => {
    const grande = arquivo(JPEG, LIMITE_BYTES + 1)
    expect(problemasDaImagem(grande)[0]).toContain('3 MB')
  })

  it('reclama de arquivo que não é imagem', () => {
    expect(problemasDaImagem(texto('não sou uma imagem'))[0]).toContain('JPEG')
  })
})

describe('extensaoDoTipo', () => {
  it('dá a extensão de cada tipo aceito', () => {
    expect(extensaoDoTipo('image/jpeg')).toBe('jpg')
    expect(extensaoDoTipo('image/png')).toBe('png')
    expect(extensaoDoTipo('image/webp')).toBe('webp')
  })
})

describe('nomeDeCapaValido', () => {
  const sorteado = 'a'.repeat(32)

  it('aceita o formato que geramos', () => {
    expect(nomeDeCapaValido(`${sorteado}.jpg`)).toBe(true)
    expect(nomeDeCapaValido(`${sorteado}.webp`)).toBe(true)
  })

  it('recusa caminho com subida de diretório', () => {
    expect(nomeDeCapaValido('../../.env')).toBe(false)
    expect(nomeDeCapaValido(`../${sorteado}.jpg`)).toBe(false)
    expect(nomeDeCapaValido(`${sorteado}.jpg/../../.env`)).toBe(false)
  })

  it('recusa extensão fora da lista', () => {
    expect(nomeDeCapaValido(`${sorteado}.svg`)).toBe(false)
    expect(nomeDeCapaValido(`${sorteado}.html`)).toBe(false)
  })

  it('recusa nome de tamanho diferente', () => {
    expect(nomeDeCapaValido('abc.jpg')).toBe(false)
  })
})

describe('urlDaCapa', () => {
  it('monta o endereço com o nome do arquivo, para o cache não segurar a capa antiga', () => {
    expect(urlDaCapa('treino-de-sabado', `${'b'.repeat(32)}.png`))
      .toBe(`/api/publicacoes/treino-de-sabado/capa/${'b'.repeat(32)}.png`)
  })

  it('devolve nulo quando não há capa', () => {
    expect(urlDaCapa('treino-de-sabado', null)).toBeNull()
    expect(urlDaCapa('treino-de-sabado', undefined)).toBeNull()
  })
})
