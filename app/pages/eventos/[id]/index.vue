<script setup lang="ts">
import { rotuloDaFaixaDeGrau, rotuloDaIdade } from '~~/shared/competicao'
import { formatarReais } from '~~/shared/dinheiro'
import { GRAUS_DE_EXAME, SHOGOS } from '~~/shared/exame'
import { ROTULO_DO_SHOGO, grausDaModalidade, rotuloDoGrau } from '~~/shared/graduacao'
import {
  type EventoDetalhado,
  type SubeventoDetalhado,
  ROTULO_DO_TIPO,
  TIPOS_DISPONIVEIS,
  formatarDia,
} from '~~/shared/evento'

definePageMeta({ middleware: 'diretoria' })

const id = useRoute().params.id as string

const { data: evento } = await useFetch<EventoDetalhado>(`/api/eventos/${id}`)
const { data: modalidades } = await useFetch('/api/modalidades')

useHead({ title: () => `Editar ${evento.value?.titulo ?? ''} - KendoClub` })

const modalidadesAtivas = computed(() => (modalidades.value ?? []).filter(m => m.ativa))

/** Valor para o campo de texto, no formato que se digita: "80,00". */
function valorNoCampo(valor: number | null) {
  return valor === null ? '' : valor.toFixed(2).replace('.', ',')
}

/**
 * Campos de data de um subevento: os dias que ele já tem, mais vagas em branco.
 * Vários campos, e não um repetido, para a tela funcionar sem JavaScript.
 */
function vagasDeDia(dias: string[]) {
  return [...dias, ...Array(Math.max(4 - dias.length, 1)).fill('')] as string[]
}

/** Graduações de exame da modalidade que ainda não têm banca neste exame. */
function grausParaOferecer(subevento: SubeventoDetalhado) {
  const daModalidade = grausDaModalidade(subevento.modalidade.kyuInicial)
  return GRAUS_DE_EXAME.filter(grau =>
    daModalidade.includes(grau) && !subevento.graduacoes.some(g => g.grau === grau))
}

function shogosParaOferecer(subevento: SubeventoDetalhado) {
  return SHOGOS.filter(shogo => !subevento.shogos.some(s => s.shogo === shogo))
}

const temEncomendas = computed(() =>
  Object.values(evento.value?.obentosPorDia ?? {}).some(q => q > 0))

const classeCampo = 'w-full rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div
    v-if="evento"
    class="max-w-3xl mx-auto px-4 py-10"
  >
    <AvisoErros />

    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">
          {{ evento.titulo }}
        </h1>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <UBadge
            :color="evento.publicadoEm ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ evento.publicadoEm ? 'publicado' : 'rascunho' }}
          </UBadge>
          <span>/agenda/{{ evento.slug }}</span>
        </div>
        <div class="mt-2 flex gap-4 text-sm">
          <ULink :to="`/agenda/${evento.slug}`">
            Ver na agenda
          </ULink>
          <ULink :to="`/eventos/${evento.id}/inscritos`">
            Inscritos
          </ULink>
        </div>
      </div>

      <form
        method="post"
        action="/api/eventos/publicar"
      >
        <input
          type="hidden"
          name="id"
          :value="evento.id"
        >
        <input
          v-if="evento.publicadoEm"
          type="hidden"
          name="acao"
          value="despublicar"
        >
        <button
          type="submit"
          class="rounded-md border border-default px-4 py-2"
        >
          {{ evento.publicadoEm ? 'Voltar a rascunho' : 'Publicar' }}
        </button>
      </form>
    </div>

    <form
      method="post"
      action="/api/eventos"
      class="mt-8 flex flex-col gap-4"
    >
      <input
        type="hidden"
        name="id"
        :value="evento.id"
      >

      <CampoTexto
        nome="titulo"
        rotulo="Título"
        obrigatorio
        :valor="evento.titulo"
        ajuda="O endereço do evento não muda ao corrigir o título."
      />

      <EditorMarkdown
        nome="descricao"
        rotulo="Descrição"
        obrigatorio
        :valor="evento.descricao"
      />

      <div class="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          nome="prazoInscricao"
          rotulo="Prazo de inscrição"
          tipo="date"
          obrigatorio
          :valor="evento.prazoInscricao"
          ajuda="Vale até o fim do dia. Não pode ser depois do primeiro dia do evento."
        />

        <div>
          <label
            for="visibilidade"
            class="block text-sm font-medium mb-1"
          >Quem pode ver</label>
          <select
            id="visibilidade"
            name="visibilidade"
            :class="classeCampo"
          >
            <option
              value="PUBLICA"
              :selected="evento.visibilidade === 'PUBLICA'"
            >
              Qualquer pessoa
            </option>
            <option
              value="RESTRITA"
              :selected="evento.visibilidade === 'RESTRITA'"
            >
              Só praticantes com acesso ao sistema
            </option>
          </select>
        </div>
      </div>

      <fieldset class="rounded-md border border-default p-4 flex flex-col gap-3">
        <legend class="px-1 font-medium">
          Alojamento
        </legend>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            name="ofereceAlojamento"
            :checked="evento.ofereceAlojamento"
          >
          O evento oferece alojamento
        </label>
        <div class="grid gap-4 sm:grid-cols-3">
          <CampoTexto
            nome="valorAlojamento"
            rotulo="Valor pelo evento inteiro"
            :valor="valorNoCampo(evento.valorAlojamento)"
            placeholder="0,00"
          />
          <div class="sm:col-span-2">
            <CampoTexto
              nome="enderecoAlojamento"
              rotulo="Endereço"
              :valor="evento.enderecoAlojamento"
            />
          </div>
        </div>
      </fieldset>

      <fieldset class="rounded-md border border-default p-4 flex flex-col gap-3">
        <legend class="px-1 font-medium">
          Obento
        </legend>

        <p
          v-if="!evento.diasDoEvento.length"
          class="text-sm text-muted"
        >
          Os dias de obento aparecem aqui depois que algum subevento tiver data.
        </p>

        <template v-else>
          <div class="max-w-xs">
            <CampoTexto
              nome="valorObento"
              rotulo="Valor da unidade"
              :valor="valorNoCampo(evento.valorObento)"
              placeholder="0,00"
            />
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium">Dias com oferta</span>
            <label
              v-for="dia in evento.diasDoEvento"
              :key="dia"
              class="flex items-center gap-2"
            >
              <input
                type="checkbox"
                :name="`obento_${dia}`"
                :checked="evento.diasObento.includes(dia)"
              >
              {{ formatarDia(dia) }}
              <span
                v-if="evento.obentosPorDia[dia]"
                class="text-sm text-muted"
              >
                — {{ evento.obentosPorDia[dia] }} encomendado(s)
              </span>
            </label>
          </div>

          <label
            v-if="temEncomendas"
            class="flex items-start gap-2 text-sm"
          >
            <input
              type="checkbox"
              name="confirmarApagarObentos"
              class="mt-1"
            >
            Se eu tirar a oferta de um dia que já tem encomendas, apagar essas
            encomendas.
          </label>
        </template>
      </fieldset>

      <div class="flex gap-3">
        <button
          type="submit"
          class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
        >
          Salvar evento
        </button>
        <ULink
          to="/eventos"
          class="px-4 py-2"
        >
          Voltar
        </ULink>
      </div>
    </form>

    <section class="mt-12 border-t border-default pt-8">
      <h2 class="text-lg font-semibold">
        Subeventos
      </h2>
      <p class="mt-1 text-sm text-muted">
        Cada subevento é de uma modalidade. O mesmo tipo pode se repetir em
        modalidades diferentes. Depois de criado, o tipo não muda.
      </p>

      <div
        v-for="subevento in evento.subeventos"
        :key="subevento.id"
        class="mt-6 rounded-md border border-default p-4"
      >
        <h3 class="font-medium">
          {{ ROTULO_DO_TIPO[subevento.tipo] }} de {{ subevento.modalidade.nome }}
          <span class="text-sm text-muted font-normal">
            — {{ subevento.inscritos }} inscrito(s)
            <template v-if="subevento.valor !== null">· {{ formatarReais(subevento.valor) }}</template>
          </span>
        </h3>

        <FormularioSubevento
          :evento-id="evento.id"
          :subevento="subevento"
          :modalidades="modalidadesAtivas"
          :tipos="TIPOS_DISPONIVEIS"
          :vagas-de-dia="vagasDeDia(subevento.dias)"
          :valor-no-campo="valorNoCampo(subevento.valor)"
          :pede-confirmacao="temEncomendas"
        />

        <div
          v-if="subevento.tipo === 'COMPETICAO'"
          class="mt-5 border-t border-default pt-4"
        >
          <h4 class="font-medium">
            Categorias
          </h4>
          <p class="text-xs text-muted">
            Idade no ano do evento e graduação nesta modalidade; faixa em branco
            não limita. Quem compete em categoria isenta não paga a participação.
            Sem categoria, a competição não pode ser publicada.
          </p>

          <div
            v-for="categoria in subevento.categorias"
            :key="categoria.id"
            class="mt-3 rounded-md bg-elevated p-2"
          >
            <FormularioCategoria
              :subevento-id="subevento.id"
              :kyu-inicial="subevento.modalidade.kyuInicial"
              :categoria="categoria"
            />
            <form
              method="post"
              action="/api/eventos/categorias/remover"
              class="mt-1 flex flex-wrap items-center gap-3 text-xs"
            >
              <input
                type="hidden"
                name="id"
                :value="categoria.id"
              >
              <span class="text-muted">
                {{ rotuloDaIdade(categoria.idadeMinima, categoria.idadeMaxima) }} ·
                {{ rotuloDaFaixaDeGrau(categoria.grauMinimo, categoria.grauMaximo) }} ·
                {{ categoria.isenta ? 'isenta · ' : '' }}{{ categoria.inscritos }} inscrito(s)
              </span>
              <label
                v-if="categoria.inscritos > 0"
                class="flex items-center gap-1"
              >
                <input
                  type="checkbox"
                  name="confirmar"
                >
                confirmo tirar os inscritos da competição
              </label>
              <button
                type="submit"
                class="underline text-error"
              >
                Remover categoria
              </button>
            </form>
          </div>

          <div class="mt-3 rounded-md border border-dashed border-default p-2">
            <FormularioCategoria
              :subevento-id="subevento.id"
              :kyu-inicial="subevento.modalidade.kyuInicial"
            />
          </div>
        </div>

        <div
          v-if="subevento.tipo === 'EXAME'"
          class="mt-5 border-t border-default pt-4"
        >
          <h4 class="font-medium">
            Graduações com banca
          </h4>
          <p class="text-xs text-muted">
            Quem se inscreve presta a graduação seguinte à do cadastro — aspirante
            vai direto ao 1º kyu, e quem tem título o mantém (5º dan Renshi presta
            na banca de 6º dan). Sem banca para ela, a inscrição é recusada. Sem
            nenhuma banca, o exame não pode ser publicado.
          </p>

          <div
            v-for="graduacao in subevento.graduacoes"
            :key="graduacao.id"
            class="mt-2 flex flex-wrap items-center gap-3 rounded-md bg-elevated p-2 text-sm"
          >
            <form
              method="post"
              action="/api/eventos/graduacoes"
              class="flex flex-wrap items-center gap-2"
            >
              <input
                type="hidden"
                name="subeventoId"
                :value="subevento.id"
              >
              <input
                type="hidden"
                name="id"
                :value="graduacao.id"
              >
              <span class="w-16 font-medium">{{ rotuloDoGrau(graduacao.grau) }}</span>
              <input
                name="valor"
                inputmode="decimal"
                required
                :aria-label="`Valor do exame de ${rotuloDoGrau(graduacao.grau)}`"
                :value="valorNoCampo(graduacao.valor)"
                class="w-24 rounded-md border border-default bg-default px-2 py-1"
              >
              <button
                type="submit"
                class="rounded-md border border-default px-2 py-1"
              >
                Salvar
              </button>
              <span class="text-muted">{{ graduacao.inscritos }} inscrito(s)</span>
            </form>

            <form
              method="post"
              action="/api/eventos/graduacoes/remover"
              class="flex items-center gap-2 text-xs"
            >
              <input
                type="hidden"
                name="id"
                :value="graduacao.id"
              >
              <label
                v-if="graduacao.inscritos > 0"
                class="flex items-center gap-1"
              >
                <input
                  type="checkbox"
                  name="confirmar"
                >
                confirmo tirar os inscritos do exame
              </label>
              <button
                type="submit"
                class="underline text-error"
              >
                Remover
              </button>
            </form>
          </div>

          <form
            v-if="grausParaOferecer(subevento).length"
            method="post"
            action="/api/eventos/graduacoes"
            class="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-default p-2 text-sm"
          >
            <input
              type="hidden"
              name="subeventoId"
              :value="subevento.id"
            >
            <label>
              <span class="block text-xs text-muted">Graduação</span>
              <select
                name="grau"
                class="rounded-md border border-default bg-default px-2 py-1"
              >
                <option
                  v-for="grau in grausParaOferecer(subevento)"
                  :key="grau"
                  :value="grau"
                >
                  {{ rotuloDoGrau(grau) }}
                </option>
              </select>
            </label>
            <label>
              <span class="block text-xs text-muted">Valor</span>
              <input
                name="valor"
                inputmode="decimal"
                placeholder="0,00"
                required
                class="w-24 rounded-md border border-default bg-default px-2 py-1"
              >
            </label>
            <button
              type="submit"
              class="rounded-md border border-default px-2 py-1"
            >
              Oferecer
            </button>
          </form>

          <h4 class="mt-5 font-medium">
            Shogo
          </h4>
          <p class="text-xs text-muted">
            Renshi: 5º dan ou acima, ainda sem título. Kyoshi: 7º ou 8º dan Renshi.
            Quem pode prestar dan e shogo escolhe um, outro ou os dois.
          </p>

          <div
            v-for="oferecido in subevento.shogos"
            :key="oferecido.id"
            class="mt-2 flex flex-wrap items-center gap-3 rounded-md bg-elevated p-2 text-sm"
          >
            <form
              method="post"
              action="/api/eventos/shogos"
              class="flex flex-wrap items-center gap-2"
            >
              <input
                type="hidden"
                name="subeventoId"
                :value="subevento.id"
              >
              <input
                type="hidden"
                name="id"
                :value="oferecido.id"
              >
              <span class="w-16 font-medium">{{ ROTULO_DO_SHOGO[oferecido.shogo] }}</span>
              <input
                name="valor"
                inputmode="decimal"
                required
                :aria-label="`Valor do exame de ${ROTULO_DO_SHOGO[oferecido.shogo]}`"
                :value="valorNoCampo(oferecido.valor)"
                class="w-24 rounded-md border border-default bg-default px-2 py-1"
              >
              <button
                type="submit"
                class="rounded-md border border-default px-2 py-1"
              >
                Salvar
              </button>
              <span class="text-muted">{{ oferecido.inscritos }} inscrito(s)</span>
            </form>

            <form
              method="post"
              action="/api/eventos/shogos/remover"
              class="flex items-center gap-2 text-xs"
            >
              <input
                type="hidden"
                name="id"
                :value="oferecido.id"
              >
              <label
                v-if="oferecido.inscritos > 0"
                class="flex items-center gap-1"
              >
                <input
                  type="checkbox"
                  name="confirmar"
                >
                confirmo tirar este exame dos inscritos
              </label>
              <button
                type="submit"
                class="underline text-error"
              >
                Remover
              </button>
            </form>
          </div>

          <form
            v-if="shogosParaOferecer(subevento).length"
            method="post"
            action="/api/eventos/shogos"
            class="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-default p-2 text-sm"
          >
            <input
              type="hidden"
              name="subeventoId"
              :value="subevento.id"
            >
            <label>
              <span class="block text-xs text-muted">Shogo</span>
              <select
                name="shogo"
                class="rounded-md border border-default bg-default px-2 py-1"
              >
                <option
                  v-for="shogo in shogosParaOferecer(subevento)"
                  :key="shogo"
                  :value="shogo"
                >
                  {{ ROTULO_DO_SHOGO[shogo] }}
                </option>
              </select>
            </label>
            <label>
              <span class="block text-xs text-muted">Valor</span>
              <input
                name="valor"
                inputmode="decimal"
                placeholder="0,00"
                required
                class="w-24 rounded-md border border-default bg-default px-2 py-1"
              >
            </label>
            <button
              type="submit"
              class="rounded-md border border-default px-2 py-1"
            >
              Oferecer
            </button>
          </form>
        </div>

        <form
          method="post"
          action="/api/eventos/subeventos/remover"
          class="mt-3 flex flex-wrap items-center gap-3 text-sm"
        >
          <input
            type="hidden"
            name="id"
            :value="subevento.id"
          >
          <label
            v-if="subevento.inscritos > 0 || temEncomendas"
            class="flex items-center gap-2"
          >
            <input
              type="checkbox"
              name="confirmar"
            >
            Confirmo apagar as inscrições e encomendas que dependem dele
          </label>
          <button
            type="submit"
            class="underline text-error"
          >
            Remover subevento
          </button>
        </form>
      </div>

      <div class="mt-6 rounded-md border border-dashed border-default p-4">
        <h3 class="font-medium">
          Novo subevento
        </h3>
        <FormularioSubevento
          :evento-id="evento.id"
          :modalidades="modalidadesAtivas"
          :tipos="TIPOS_DISPONIVEIS"
          :vagas-de-dia="vagasDeDia([])"
          valor-no-campo=""
          :pede-confirmacao="false"
        />
      </div>
    </section>
  </div>
</template>
