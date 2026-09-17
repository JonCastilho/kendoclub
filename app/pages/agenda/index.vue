<script setup lang="ts">
import { ROTULO_DO_TIPO, formatarDia } from '~~/shared/evento'

useHead({ title: 'Agenda - KendoClub' })

const { data } = await useFetch('/api/eventos')
const { loggedIn } = useUserSession()

function periodo(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return 'sem data'
  return inicio === fim ? formatarDia(inicio) : `${formatarDia(inicio)} a ${formatarDia(fim)}`
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold">
      Agenda
    </h1>

    <p
      v-if="!loggedIn"
      class="mt-2 text-sm text-muted"
    >
      Para se inscrever, e para ver os eventos internos do clube,
      <ULink to="/entrar?destino=/agenda">
        entre
      </ULink>.
    </p>

    <div
      v-if="!data?.eventos.length"
      class="mt-12 text-center text-muted"
    >
      Nenhum evento marcado.
    </div>

    <ul
      v-else
      class="mt-8 flex flex-col gap-6"
    >
      <li
        v-for="evento in data.eventos"
        :key="evento.id"
      >
        <article>
          <h2 class="text-xl font-semibold">
            <ULink :to="`/agenda/${evento.slug}`">
              {{ evento.titulo }}
            </ULink>
          </h2>

          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
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
            <UBadge
              :color="evento.prazoAberto ? 'success' : 'neutral'"
              variant="subtle"
            >
              {{ evento.prazoAberto
                ? `inscrições até ${formatarDia(evento.prazoInscricao)}`
                : 'inscrições encerradas' }}
            </UBadge>
          </div>

          <p
            v-if="evento.subeventos.length"
            class="mt-2 text-sm"
          >
            {{ evento.subeventos.map(s => `${ROTULO_DO_TIPO[s.tipo]} de ${s.modalidade}`).join(' · ') }}
          </p>

          <p class="mt-2 text-muted">
            {{ evento.resumo }}
          </p>
        </article>
      </li>
    </ul>
  </div>
</template>
