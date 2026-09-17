<script setup lang="ts">
import { ROTULO_DO_TIPO, formatarDia } from '~~/shared/evento'

definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Eventos - KendoClub' })

const { data } = await useFetch('/api/eventos', { query: { todos: '1' } })

function periodo(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return 'sem data'
  return inicio === fim ? formatarDia(inicio) : `${formatarDia(inicio)} a ${formatarDia(fim)}`
}

const classeCampo = 'w-full rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10">
    <AvisoErros />

    <h1 class="text-2xl font-bold">
      Eventos
    </h1>
    <p class="text-sm text-muted">
      Todos os eventos, inclusive rascunhos e os que já passaram.
    </p>

    <ul
      v-if="data?.eventos.length"
      class="mt-6 divide-y divide-default border-y border-default"
    >
      <li
        v-for="evento in data.eventos"
        :key="evento.id"
        class="py-3 flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <ULink :to="`/eventos/${evento.id}`">
            {{ evento.titulo }}
          </ULink>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{{ periodo(evento.inicio, evento.fim) }}</span>
            <UBadge
              :color="evento.publicadoEm ? 'success' : 'neutral'"
              variant="subtle"
            >
              {{ evento.publicadoEm ? 'publicado' : 'rascunho' }}
            </UBadge>
            <UBadge
              :color="evento.visibilidade === 'RESTRITA' ? 'info' : 'neutral'"
              variant="subtle"
            >
              {{ evento.visibilidade === 'RESTRITA' ? 'interno' : 'público' }}
            </UBadge>
            <span v-if="evento.subeventos.length">
              {{ evento.subeventos.map(s => `${ROTULO_DO_TIPO[s.tipo]} de ${s.modalidade}`).join(' · ') }}
            </span>
          </div>
        </div>

        <div class="flex gap-3 text-sm">
          <ULink :to="`/eventos/${evento.id}/inscritos`">
            inscritos
          </ULink>
          <ULink :to="`/agenda/${evento.slug}`">
            ver na agenda
          </ULink>
        </div>
      </li>
    </ul>

    <section class="mt-10 mb-16">
      <h2 class="font-semibold mb-3">
        Novo evento
      </h2>

      <form
        method="post"
        action="/api/eventos"
        class="flex flex-col gap-4"
      >
        <CampoTexto
          nome="titulo"
          rotulo="Título"
          obrigatorio
        />

        <EditorMarkdown
          nome="descricao"
          rotulo="Descrição"
          obrigatorio
          :linhas="8"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            nome="prazoInscricao"
            rotulo="Prazo de inscrição"
            tipo="date"
            obrigatorio
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
              <option value="PUBLICA">
                Qualquer pessoa
              </option>
              <option value="RESTRITA">
                Só praticantes com acesso ao sistema
              </option>
            </select>
          </div>
        </div>

        <div>
          <button
            type="submit"
            class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
          >
            Criar rascunho
          </button>
          <p class="mt-1 text-xs text-muted">
            Subeventos, alojamento e obento se configuram em seguida, na tela do
            evento. Publicar exige ao menos um subevento com data.
          </p>
        </div>
      </form>
    </section>
  </div>
</template>
