<script setup lang="ts">
import { ROTULO_DO_SEXO, rotuloDaFaixaDeGrau, rotuloDaIdade } from '~~/shared/competicao'
import { formatarReais } from '~~/shared/dinheiro'
import {
  type EventoDetalhado,
  ROTULO_DO_TIPO,
  type SubeventoDetalhado,
  formatarDia,
} from '~~/shared/evento'
import { rotuloDaGraduacao } from '~~/shared/graduacao'

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

function categoriasQueServem(subevento: SubeventoDetalhado) {
  const compativeis = evento.value?.competidor[subevento.id]?.compativeis ?? []
  return subevento.categorias.filter(c => compativeis.includes(c.id))
}

/** Preço de quem compete na categoria: o da competição, ou nada se isenta. */
function precoNaCategoria(subevento: SubeventoDetalhado, isenta: boolean) {
  if (isenta) return 'isenta'
  return subevento.valor ? formatarReais(subevento.valor) : 'gratuita'
}

function periodo(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return 'sem data'
  return inicio === fim ? formatarDia(inicio) : `${formatarDia(inicio)} a ${formatarDia(fim)}`
}

const classeCampo = 'w-full rounded-md border border-default bg-default px-3 py-2'
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
          <ul
            v-if="subevento.tipo === 'COMPETICAO'"
            class="mt-1 text-sm"
          >
            <li
              v-for="categoria in subevento.categorias"
              :key="categoria.id"
            >
              {{ categoria.nome }} ({{ ROTULO_DO_SEXO[categoria.sexo].toLowerCase() }},
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
                      <span class="text-sm text-muted">
                        — {{ subevento.valor ? formatarReais(subevento.valor) : 'gratuito' }}
                      </span>
                    </span>
                  </label>

                  <!-- Competição: a categoria sai do cadastro. Só se pergunta
                       algo quando mais de uma categoria serve. -->
                  <div
                    v-if="subevento.tipo === 'COMPETICAO' && evento.competidor[subevento.id]"
                    class="ml-6 mt-2 flex flex-col gap-2 text-sm"
                  >
                    <p class="text-muted">
                      Idade no ano do evento: {{ evento.competidor[subevento.id]!.idade }} ·
                      graduação: {{ rotuloDaGraduacao(evento.competidor[subevento.id]!.grau) }}
                    </p>

                    <p
                      v-if="!categoriasQueServem(subevento).length"
                      class="text-warning"
                    >
                      Nenhuma categoria desta competição atende a este cadastro. A
                      tabela de categorias provavelmente está incompleta — avise a
                      diretoria.
                    </p>

                    <template v-else>
                      <p v-if="categoriasQueServem(subevento).length === 1">
                        Categoria: <strong>{{ categoriasQueServem(subevento)[0]!.nome }}</strong>
                        — {{ precoNaCategoria(subevento, categoriasQueServem(subevento)[0]!.isenta) }}
                      </p>

                      <div v-else>
                        <label
                          :for="`categoria_${subevento.id}`"
                          class="block"
                        >Você se encaixa em mais de uma categoria. Escolha uma:</label>
                        <select
                          :id="`categoria_${subevento.id}`"
                          :name="`categoria_${subevento.id}`"
                          :class="classeCampo"
                        >
                          <option
                            value=""
                            :selected="!evento.inscricao?.competicoes[subevento.id]"
                          >
                            Escolha
                          </option>
                          <option
                            v-for="categoria in categoriasQueServem(subevento)"
                            :key="categoria.id"
                            :value="categoria.id"
                            :selected="evento.inscricao?.competicoes[subevento.id]?.categoriaId === categoria.id"
                          >
                            {{ categoria.nome }} — {{ precoNaCategoria(subevento, categoria.isenta) }}
                          </option>
                        </select>
                      </div>

                      <div class="flex gap-4">
                        <label class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            :name="`individual_${subevento.id}`"
                            :checked="evento.inscricao?.competicoes[subevento.id]?.individual ?? true"
                          >
                          Individual
                        </label>
                        <label class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            :name="`equipe_${subevento.id}`"
                            :checked="evento.inscricao?.competicoes[subevento.id]?.equipe"
                          >
                          Equipe
                        </label>
                      </div>
                    </template>
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
            Total estimado: <strong>{{ formatarReais(evento.inscricao.total) }}</strong>.
            A cobrança é gerada quando as inscrições fecham.
          </p>
        </form>
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
