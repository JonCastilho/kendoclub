<script setup lang="ts">
import {
  ROTULO_DO_SEXO,
  ROTULO_DO_TIPO_DE_CATEGORIA,
  TIPOS_DE_CATEGORIA,
  type TipoCategoria,
  rotuloDaFaixaDeGrau,
  rotuloDaIdade,
} from '~~/shared/competicao'
import { formatarReais } from '~~/shared/dinheiro'
import {
  type EventoDetalhado,
  ROTULO_DO_TIPO,
  type SituacaoNoExame,
  type SubeventoDetalhado,
  formatarDia,
} from '~~/shared/evento'
import type { Grau } from '@prisma/client'
import { ROTULO_DO_SHOGO, type Shogo, rotuloComShogo, rotuloDaGraduacao } from '~~/shared/graduacao'

const rota = useRoute()
const slug = rota.params.slug as string

// A diretoria escolhe por quem está inscrevendo; a escolha vai na query, para a
// página funcionar sem JavaScript e o endereço poder ser recarregado.
const praticanteEscolhido = computed(() =>
  typeof rota.query.praticante === 'string' ? rota.query.praticante : '')

const { data: evento, error } = await useFetch<EventoDetalhado>(`/api/eventos/${slug}`, {
  query: { praticante: praticanteEscolhido },
})

// Rascunho e evento interno respondem 404 de verdade, como as notícias.
if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Evento não encontrado.', fatal: true })
}

useHead({ title: () => `${evento.value?.titulo ?? 'Evento'} - KendoClub` })

const { user } = useUserSession()

// Lista para o seletor da diretoria. Praticante nunca faz esta chamada.
const { data: praticantes } = await useFetch('/api/praticantes', {
  immediate: evento.value?.podeEditar ?? false,
})

// Quem está usando a tela já aparece como "Eu mesmo".
const outrosPraticantes = computed(() =>
  (praticantes.value?.praticantes ?? []).filter(p => p.id !== user.value?.praticanteId))

/** Categorias da disputa que servem ao cadastro de quem está sendo inscrito. */
function categoriasQueServem(subevento: SubeventoDetalhado, tipo: TipoCategoria) {
  const compativeis = evento.value?.competidor[subevento.id]?.compativeis ?? []
  return subevento.categorias.filter(c => c.tipo === tipo && compativeis.includes(c.id))
}

function temDisputa(subevento: SubeventoDetalhado, tipo: TipoCategoria) {
  return subevento.categorias.some(c => c.tipo === tipo)
}

/**
 * Categoria marcada na disputa. Em inscrição nova, a individual já vem marcada
 * quando só uma categoria serve; as demais começam em "não participo".
 */
function categoriaEscolhida(subevento: SubeventoDetalhado, tipo: TipoCategoria) {
  const participacao = evento.value?.inscricao?.competicoes[subevento.id]
  if (!participacao) {
    const unica = categoriasQueServem(subevento, tipo)
    return tipo === 'INDIVIDUAL' && unica.length === 1 ? unica[0]!.id : ''
  }
  return (tipo === 'INDIVIDUAL' ? participacao.categoriaIndividualId : participacao.categoriaEquipeId) ?? ''
}

/** Nome do campo do formulário: `individual_<id>` e `equipe_<id>`. */
function campoDaDisputa(subevento: SubeventoDetalhado, tipo: TipoCategoria) {
  return `${tipo === 'INDIVIDUAL' ? 'individual' : 'equipe'}_${subevento.id}`
}

/** Preço de quem compete na categoria: o da competição, ou nada se isenta. */
function precoNaCategoria(subevento: SubeventoDetalhado, isenta: boolean) {
  if (isenta) return 'isenta'
  return subevento.valor ? formatarReais(subevento.valor) : 'gratuita'
}

function exameDe(subevento: SubeventoDetalhado) {
  return evento.value!.examinando[subevento.id]!
}

/** O que a pessoa poderia prestar mas não tem banca, em texto: "7º dan nem Renshi". */
function semBanca(exame: SituacaoNoExame) {
  return [
    exame.grau && !exame.temBancaDeGrau ? rotuloDaGraduacao(exame.grau) : null,
    exame.shogo && !exame.temBancaDeShogo ? ROTULO_DO_SHOGO[exame.shogo] : null,
  ].filter(Boolean).join(' nem para ')
}

function precoDoGrau(subevento: SubeventoDetalhado, grau: Grau) {
  const valor = subevento.graduacoes.find(g => g.grau === grau)?.valor ?? 0
  return valor ? formatarReais(valor) : 'gratuito'
}

function precoDoShogo(subevento: SubeventoDetalhado, shogo: Shogo) {
  const valor = subevento.shogos.find(s => s.shogo === shogo)?.valor ?? 0
  return valor ? formatarReais(valor) : 'gratuito'
}

function periodo(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return 'sem data'
  return inicio === fim ? formatarDia(inicio) : `${formatarDia(inicio)} a ${formatarDia(fim)}`
}

const classeCampo = 'w-full rounded-md border border-default bg-default px-3 py-2'

const copiado = ref(false)

async function copiarPix() {
  const codigo = evento.value?.cobranca?.pix?.copiaECola
  if (!codigo) return
  await navigator.clipboard.writeText(codigo)
  copiado.value = true
  setTimeout(() => (copiado.value = false), 3000)
}
</script>

<template>
  <!-- eslint-disable vue/no-v-html — descrição em markdown renderizada no
       servidor com HTML desligado. -->
  <article
    v-if="evento"
    class="max-w-2xl mx-auto px-4 py-10"
  >
    <AvisoErros />

    <h1 class="text-3xl font-bold">
      {{ evento.titulo }}
    </h1>

    <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
      <span>{{ periodo(evento.inicio, evento.fim) }}</span>
      <UBadge
        v-if="evento.visibilidade === 'RESTRITA'"
        color="info"
        variant="subtle"
      >
        interno
      </UBadge>
      <UBadge
        v-if="!evento.publicadoEm"
        color="neutral"
        variant="subtle"
      >
        rascunho
      </UBadge>
    </div>

    <div
      class="mt-6 flex flex-col gap-4 leading-relaxed"
      v-html="evento.html"
    />

    <section class="mt-8">
      <h2 class="text-lg font-semibold">
        Programação
      </h2>
      <ul class="mt-3 flex flex-col gap-3">
        <li
          v-for="subevento in evento.subeventos"
          :key="subevento.id"
          class="rounded-md border border-default p-3"
        >
          <div class="font-medium">
            {{ ROTULO_DO_TIPO[subevento.tipo] }} de {{ subevento.modalidade.nome }}
          </div>
          <div class="text-sm text-muted">
            {{ subevento.dias.map(formatarDia).join(', ') }} · {{ subevento.local }}
          </div>
          <div
            v-if="subevento.valor !== null"
            class="text-sm"
          >
            {{ subevento.valor === 0 ? 'Gratuito' : formatarReais(subevento.valor) }}
          </div>
          <p
            v-if="subevento.tipo === 'EXAME'"
            class="mt-1 text-sm"
          >
            {{ [
              ...subevento.graduacoes.map(g => `${rotuloDaGraduacao(g.grau)} (${g.valor ? formatarReais(g.valor) : 'gratuito'})`),
              ...subevento.shogos.map(x => `${ROTULO_DO_SHOGO[x.shogo]} (${x.valor ? formatarReais(x.valor) : 'gratuito'})`),
            ].join(' · ') }}
          </p>
          <ul
            v-if="subevento.tipo === 'COMPETICAO'"
            class="mt-1 text-sm"
          >
            <li
              v-for="categoria in subevento.categorias"
              :key="categoria.id"
            >
              {{ ROTULO_DO_TIPO_DE_CATEGORIA[categoria.tipo] }}: {{ categoria.nome }}
              ({{ ROTULO_DO_SEXO[categoria.sexo].toLowerCase() }},
              {{ rotuloDaIdade(categoria.idadeMinima, categoria.idadeMaxima) }},
              {{ rotuloDaFaixaDeGrau(categoria.grauMinimo, categoria.grauMaximo) }})
              — {{ precoNaCategoria(subevento, categoria.isenta) }}
            </li>
          </ul>
        </li>
      </ul>

      <dl class="mt-4 grid gap-2 text-sm">
        <div v-if="evento.ofereceAlojamento">
          <dt class="inline font-medium">
            Alojamento:
          </dt>
          <dd class="inline">
            {{ formatarReais(evento.valorAlojamento) }} pelo evento inteiro ·
            {{ evento.enderecoAlojamento }}
          </dd>
        </div>
        <div v-if="evento.diasObento.length">
          <dt class="inline font-medium">
            Obento:
          </dt>
          <dd class="inline">
            {{ formatarReais(evento.valorObento) }} a unidade, em
            {{ evento.diasObento.map(formatarDia).join(', ') }}
          </dd>
        </div>
        <div>
          <dt class="inline font-medium">
            Inscrições:
          </dt>
          <dd class="inline">
            {{ evento.prazoAberto
              ? `até ${formatarDia(evento.prazoInscricao)}`
              : `encerradas em ${formatarDia(evento.prazoInscricao)}` }}
          </dd>
        </div>
      </dl>
    </section>

    <section class="mt-10 border-t border-default pt-8">
      <h2 class="text-lg font-semibold">
        Inscrição
      </h2>

      <!-- A diretoria escolhe por quem inscreve. Formulário GET: recarrega a
           página com a inscrição da pessoa escolhida. -->
      <form
        v-if="evento.podeEditar"
        method="get"
        :action="`/agenda/${evento.slug}`"
        class="mt-4 flex flex-wrap items-end gap-3 rounded-md bg-elevated p-3"
      >
        <div class="grow">
          <label
            for="praticante"
            class="block text-sm font-medium mb-1"
          >Inscrevendo</label>
          <select
            id="praticante"
            name="praticante"
            :class="classeCampo"
          >
            <option
              v-if="user?.praticanteId"
              value=""
              :selected="!praticanteEscolhido"
            >
              Eu mesmo
            </option>
            <option
              v-else
              value=""
              disabled
              :selected="!praticanteEscolhido"
            >
              Escolha o praticante
            </option>
            <option
              v-for="p in outrosPraticantes"
              :key="p.id"
              :value="p.id"
              :selected="p.id === praticanteEscolhido"
            >
              {{ p.nomeCompleto }}{{ p.filiado ? '' : ' (não filiado)' }}
            </option>
          </select>
        </div>
        <button
          type="submit"
          class="rounded-md border border-default px-4 py-2"
        >
          Trocar
        </button>
      </form>

      <p
        v-if="!evento.leitorLogado"
        class="mt-3 text-sm"
      >
        <ULink :to="`/entrar?destino=/agenda/${evento.slug}`">
          Entre
        </ULink> para se inscrever.
      </p>

      <p
        v-else-if="!evento.inscrevendo"
        class="mt-3 text-sm text-muted"
      >
        {{ evento.podeEditar
          ? 'Escolha acima o praticante que vai inscrever.'
          : 'Sua conta não está ligada a um praticante. Fale com a diretoria.' }}
      </p>

      <template v-else>
        <p
          v-if="!evento.inscrevendo.proprio"
          class="mt-3 text-sm"
        >
          Inscrição de <strong>{{ evento.inscrevendo.nome }}</strong>.
        </p>

        <p
          v-if="!evento.prazoAberto"
          class="mt-3 text-sm text-muted"
        >
          {{ evento.podeEditar
            ? 'O prazo terminou, mas a diretoria ainda pode inscrever e remover.'
            : 'O prazo terminou. Para qualquer mudança, fale com a diretoria.' }}
        </p>

        <form
          method="post"
          action="/api/eventos/inscricao"
          class="mt-4 flex flex-col gap-6"
        >
          <input
            type="hidden"
            name="eventoId"
            :value="evento.id"
          >
          <input
            v-if="!evento.inscrevendo.proprio"
            type="hidden"
            name="praticanteId"
            :value="evento.inscrevendo.praticanteId"
          >

          <!-- fieldset desabilitado inteiro quando não pode mais mudar: a
               pessoa vê o que está inscrita, sem controles que não funcionam. -->
          <fieldset
            :disabled="!evento.podeInscrever"
            class="flex flex-col gap-6"
          >
            <fieldset v-if="evento.subeventos.length">
              <legend class="font-medium mb-2">
                De que vai participar
              </legend>
              <div class="flex flex-col gap-3">
                <div
                  v-for="subevento in evento.subeventos"
                  :key="subevento.id"
                >
                  <label class="flex items-start gap-2">
                    <input
                      type="checkbox"
                      :name="`subevento_${subevento.id}`"
                      :checked="evento.inscricao?.subeventoIds.includes(subevento.id)"
                      class="mt-1"
                    >
                    <span>
                      {{ ROTULO_DO_TIPO[subevento.tipo] }} de {{ subevento.modalidade.nome }}
                      <span
                        v-if="subevento.tipo !== 'EXAME'"
                        class="text-sm text-muted"
                      >
                        — {{ subevento.valor === null ? 'valor a definir' : subevento.valor ? formatarReais(subevento.valor) : 'gratuito' }}
                      </span>
                    </span>
                  </label>

                  <!-- Exame: graduação e shogo saem do cadastro. Só se pergunta
                       algo a quem pode prestar os dois. -->
                  <div
                    v-if="subevento.tipo === 'EXAME' && evento.examinando[subevento.id]"
                    class="ml-6 mt-2 flex flex-col gap-1 text-sm"
                  >
                    <p class="text-muted">
                      Graduação atual:
                      {{ rotuloComShogo(exameDe(subevento).grauAtual, exameDe(subevento).shogosAtuais) }}
                    </p>

                    <template v-if="exameDe(subevento).temBancaDeGrau && exameDe(subevento).temBancaDeShogo">
                      <p>Você pode prestar os dois exames. Marque um, outro ou os dois:</p>
                      <label class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          :name="`exame_grau_${subevento.id}`"
                          :checked="evento.inscricao ? Boolean(evento.inscricao.exames[subevento.id]?.grau) : true"
                        >
                        {{ rotuloDaGraduacao(exameDe(subevento).grau) }}
                        — {{ precoDoGrau(subevento, exameDe(subevento).grau!) }}
                      </label>
                      <label class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          :name="`exame_shogo_${subevento.id}`"
                          :checked="Boolean(evento.inscricao?.exames[subevento.id]?.shogo)"
                        >
                        {{ ROTULO_DO_SHOGO[exameDe(subevento).shogo!] }}
                        — {{ precoDoShogo(subevento, exameDe(subevento).shogo!) }}
                      </label>
                    </template>

                    <template v-else-if="exameDe(subevento).temBancaDeGrau || exameDe(subevento).temBancaDeShogo">
                      <p v-if="exameDe(subevento).temBancaDeGrau">
                        Exame para <strong>{{ rotuloDaGraduacao(exameDe(subevento).grau) }}</strong>
                        — {{ precoDoGrau(subevento, exameDe(subevento).grau!) }}
                      </p>
                      <p v-else>
                        Exame de <strong>{{ ROTULO_DO_SHOGO[exameDe(subevento).shogo!] }}</strong>
                        — {{ precoDoShogo(subevento, exameDe(subevento).shogo!) }}
                      </p>
                      <p
                        v-if="semBanca(exameDe(subevento))"
                        class="text-muted"
                      >
                        Não haverá banca para {{ semBanca(exameDe(subevento)) }} neste exame.
                      </p>
                    </template>

                    <p
                      v-else-if="!semBanca(exameDe(subevento))"
                      class="text-warning"
                    >
                      Este cadastro já está na graduação e no título máximos.
                    </p>

                    <p
                      v-else
                      class="text-warning"
                    >
                      Este exame não terá banca para {{ semBanca(exameDe(subevento)) }}, que é o que
                      este cadastro pode prestar.
                    </p>
                  </div>

                  <!-- Competição: as categorias que servem saem do cadastro, e a
                       pessoa escolhe no máximo uma de cada disputa. -->
                  <div
                    v-if="subevento.tipo === 'COMPETICAO' && evento.competidor[subevento.id]"
                    class="ml-6 mt-2 flex flex-col gap-3 text-sm"
                  >
                    <p class="text-muted">
                      Idade no ano do evento: {{ evento.competidor[subevento.id]!.idade }} ·
                      graduação: {{ rotuloDaGraduacao(evento.competidor[subevento.id]!.grau) }}
                    </p>

                    <template
                      v-for="tipo in TIPOS_DE_CATEGORIA"
                      :key="tipo"
                    >
                      <div v-if="temDisputa(subevento, tipo)">
                        <p
                          v-if="!categoriasQueServem(subevento, tipo).length"
                          class="text-warning"
                        >
                          {{ ROTULO_DO_TIPO_DE_CATEGORIA[tipo] }}: nenhuma categoria atende a este
                          cadastro. A tabela de categorias provavelmente está incompleta — avise a
                          diretoria.
                        </p>

                        <label
                          v-else-if="categoriasQueServem(subevento, tipo).length === 1"
                          class="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            :name="campoDaDisputa(subevento, tipo)"
                            :value="categoriasQueServem(subevento, tipo)[0]!.id"
                            :checked="categoriaEscolhida(subevento, tipo) === categoriasQueServem(subevento, tipo)[0]!.id"
                          >
                          <span>
                            {{ ROTULO_DO_TIPO_DE_CATEGORIA[tipo] }}:
                            <strong>{{ categoriasQueServem(subevento, tipo)[0]!.nome }}</strong>
                            — {{ precoNaCategoria(subevento, categoriasQueServem(subevento, tipo)[0]!.isenta) }}
                          </span>
                        </label>

                        <div v-else>
                          <label
                            :for="campoDaDisputa(subevento, tipo)"
                            class="block"
                          >{{ ROTULO_DO_TIPO_DE_CATEGORIA[tipo] }}: você se encaixa em mais de uma
                            categoria. Escolha uma, ou nenhuma para não participar:</label>
                          <select
                            :id="campoDaDisputa(subevento, tipo)"
                            :name="campoDaDisputa(subevento, tipo)"
                            :class="classeCampo"
                          >
                            <option
                              value=""
                              :selected="!categoriaEscolhida(subevento, tipo)"
                            >
                              Não participo
                            </option>
                            <option
                              v-for="categoria in categoriasQueServem(subevento, tipo)"
                              :key="categoria.id"
                              :value="categoria.id"
                              :selected="categoriaEscolhida(subevento, tipo) === categoria.id"
                            >
                              {{ categoria.nome }} — {{ precoNaCategoria(subevento, categoria.isenta) }}
                            </option>
                          </select>
                        </div>
                      </div>
                    </template>

                    <p class="text-xs text-muted">
                      A participação é paga uma vez, mesmo competindo nas duas disputas, e só é
                      gratuita se todas as categorias escolhidas forem isentas.
                    </p>
                  </div>
                </div>
              </div>
            </fieldset>

            <label
              v-if="evento.ofereceAlojamento"
              class="flex items-start gap-2"
            >
              <input
                type="checkbox"
                name="alojamento"
                :checked="evento.inscricao?.alojamento"
                class="mt-1"
              >
              <span>
                Quero alojamento
                <span class="text-sm text-muted">
                  — {{ formatarReais(evento.valorAlojamento) }}, só para quem participa de algum subevento
                </span>
              </span>
            </label>

            <fieldset v-if="evento.diasObento.length">
              <legend class="font-medium">
                Obento
              </legend>
              <p class="text-sm text-muted mb-2">
                {{ formatarReais(evento.valorObento) }} a unidade. Pode encomendar
                para acompanhantes, e mesmo sem participar dos subeventos.
              </p>
              <div class="flex flex-col gap-2 max-w-xs">
                <CampoQuantidade
                  v-for="dia in evento.diasObento"
                  :key="dia"
                  :nome="`obento_${dia}`"
                  :rotulo="formatarDia(dia)"
                  :valor="evento.inscricao?.obentos[dia] ?? 0"
                />
              </div>
            </fieldset>

            <div
              v-if="evento.podeInscrever"
              class="flex flex-wrap items-center gap-3"
            >
              <button
                type="submit"
                class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
              >
                {{ evento.inscricao ? 'Salvar inscrição' : 'Inscrever' }}
              </button>
              <span class="text-sm text-muted">
                Para desistir, desmarque tudo e salve.
              </span>
            </div>
          </fieldset>

          <p
            v-if="evento.inscricao"
            class="text-sm"
          >
            Total: <strong>{{ formatarReais(evento.inscricao.total) }}</strong>.
            Para pagar, gere o Pix logo abaixo.
          </p>
        </form>

        <!-- O Pix é da inscrição salva: quem muda o formulário e não salva
             ainda não mudou o que vai pagar. -->
        <div
          v-if="evento.inscricao"
          id="pix"
          class="mt-8 border-t border-default pt-6"
        >
          <h3 class="font-medium">
            Pagamento
          </h3>

          <p
            v-if="evento.inscricao.total <= 0"
            class="mt-2 text-sm text-muted"
          >
            Esta inscrição não tem nada a pagar.
          </p>

          <template v-else>
            <p class="mt-2 text-sm text-muted">
              O Pix cobre a inscrição salva. Se você mudar a inscrição, gere um
              novo.
            </p>

            <div
              v-if="evento.cobranca?.pix"
              class="mt-4 flex flex-col gap-4 sm:flex-row"
            >
              <img
                :src="evento.cobranca.pix.qrCode"
                :alt="`QR code do Pix de ${formatarReais(evento.cobranca.valor)}`"
                width="224"
                height="224"
                class="rounded-md border border-default bg-white"
              >
              <div class="flex flex-col gap-2 text-sm min-w-0">
                <p>
                  Valor: <strong>{{ formatarReais(evento.cobranca.valor) }}</strong>
                  — {{ evento.cobranca.itens.join(', ') }}
                </p>
                <p class="text-muted">
                  Mensagem do Pix: {{ evento.cobranca.pix.mensagem }}
                </p>
                <label
                  for="pix-copia-e-cola"
                  class="font-medium"
                >Pix copia e cola</label>
                <textarea
                  id="pix-copia-e-cola"
                  readonly
                  rows="4"
                  :class="`${classeCampo} font-mono text-xs`"
                  :value="evento.cobranca.pix.copiaECola"
                />
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    class="rounded-md border border-default px-3 py-1"
                    @click="copiarPix"
                  >
                    Copiar código
                  </button>
                  <span
                    v-if="copiado"
                    role="status"
                    class="text-success"
                  >Copiado.</span>
                </div>
              </div>
            </div>

            <p
              v-else-if="evento.cobranca"
              class="mt-4 text-sm text-warning"
            >
              A inscrição mudou depois que o Pix de
              {{ formatarReais(evento.cobranca.valor) }} foi gerado. Gere um novo,
              com {{ formatarReais(evento.inscricao.total) }}.
            </p>

            <form
              v-if="!evento.cobranca?.pix && evento.pixDisponivel"
              method="post"
              action="/api/eventos/pix"
              class="mt-4"
            >
              <input
                type="hidden"
                name="eventoId"
                :value="evento.id"
              >
              <input
                v-if="!evento.inscrevendo.proprio"
                type="hidden"
                name="praticanteId"
                :value="evento.inscrevendo.praticanteId"
              >
              <button
                type="submit"
                class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
              >
                Gerar PIX
              </button>
            </form>

            <p
              v-else-if="!evento.pixDisponivel"
              class="mt-4 text-sm text-warning"
            >
              O clube ainda não configurou o Pix.
              {{ evento.podeEditar ? 'Preencha chave, titular e cidade em Configurações.' : 'Avise a diretoria.' }}
            </p>
          </template>
        </div>
      </template>
    </section>

    <div class="mt-10 flex gap-4 text-sm">
      <ULink to="/agenda">
        Voltar à agenda
      </ULink>
      <template v-if="evento.podeEditar">
        <ULink :to="`/eventos/${evento.id}`">
          Editar evento
        </ULink>
        <ULink :to="`/eventos/${evento.id}/inscritos`">
          Inscritos
        </ULink>
      </template>
    </div>
  </article>
</template>
