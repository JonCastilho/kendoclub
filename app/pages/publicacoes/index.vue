<script setup lang="ts">
definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Publicações - KendoClub' })

const { data } = await useFetch('/api/publicacoes')

function data_(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const classeCampo = 'w-full rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10">
    <AvisoErros />

    <h1 class="text-2xl font-bold">
      Publicações
    </h1>
    <p class="text-sm text-muted">
      Aqui a diretoria enxerga tudo, inclusive rascunhos.
    </p>

    <ul
      v-if="data?.publicacoes.length"
      class="mt-6 divide-y divide-default border-y border-default"
    >
      <li
        v-for="publicacao in data.publicacoes"
        :key="publicacao.id"
        class="py-3 flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <ULink :to="`/publicacoes/${publicacao.id}`">
            {{ publicacao.titulo }}
          </ULink>
          <div class="mt-1 flex items-center gap-2 text-xs text-muted">
            <UBadge
              :color="publicacao.publicadaEm ? 'success' : 'neutral'"
              variant="subtle"
            >
              {{ publicacao.publicadaEm ? `publicada em ${data_(publicacao.publicadaEm)}` : 'rascunho' }}
            </UBadge>
            <UBadge
              :color="publicacao.visibilidade === 'RESTRITA' ? 'info' : 'neutral'"
              variant="subtle"
            >
              {{ publicacao.visibilidade === 'RESTRITA' ? 'interna' : 'pública' }}
            </UBadge>
          </div>
        </div>

        <ULink
          v-if="publicacao.publicadaEm"
          :to="`/noticias/${publicacao.slug}`"
          class="text-sm"
        >
          ver publicada
        </ULink>
      </li>
    </ul>

    <section class="mt-10 mb-16">
      <h2 class="font-semibold mb-3">
        Nova publicação
      </h2>

      <form
        method="post"
        action="/api/publicacoes"
        class="flex flex-col gap-4"
      >
        <CampoTexto
          nome="titulo"
          rotulo="Título"
          obrigatorio
        />

        <div>
          <label
            for="conteudo"
            class="block text-sm font-medium mb-1"
          >Conteúdo</label>
          <textarea
            id="conteudo"
            name="conteudo"
            rows="8"
            required
            :class="classeCampo"
          />
          <p class="mt-1 text-xs text-muted">
            Aceita markdown simples: **negrito**, *itálico*, listas e links.
            HTML escrito aqui aparece como texto, não é interpretado.
          </p>
        </div>

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
              Qualquer pessoa, inclusive quem não é do clube
            </option>
            <option value="RESTRITA">
              Só praticantes com acesso ao sistema
            </option>
          </select>
        </div>

        <div>
          <button
            type="submit"
            class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
          >
            Criar rascunho
          </button>
          <p class="mt-1 text-xs text-muted">
            A publicação nasce como rascunho. Publicar é um segundo passo.
          </p>
        </div>
      </form>
    </section>
  </div>
</template>
