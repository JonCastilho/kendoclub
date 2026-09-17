<script setup lang="ts">
import { markdownParaHtml } from '~~/shared/markdown'

/**
 * Campo de texto com markdown, barra de botões e prévia.
 *
 * Os botões só escrevem os símbolos do markdown em volta do trecho selecionado:
 * o que é gravado continua sendo o mesmo texto das notícias, renderizado com
 * HTML desligado. Sem JavaScript, a barra não aparece e o campo segue
 * funcionando como texto comum.
 */
const props = withDefaults(defineProps<{
  nome: string
  rotulo: string
  valor?: string | null
  obrigatorio?: boolean
  linhas?: number
}>(), {
  valor: '',
  obrigatorio: false,
  linhas: 10,
})

const conteudo = ref(props.valor ?? '')
const campo = ref<HTMLTextAreaElement | null>(null)
const previa = ref(false)
const montado = ref(false)

onMounted(() => {
  montado.value = true
})

// Mesmo renderizador e mesma configuração do servidor: o que aparece na prévia
// é o que vai para a página.
const html = computed(() => markdownParaHtml(conteudo.value))

function alternarPrevia() {
  previa.value = !previa.value
}

async function envolver(antes: string, depois: string, exemplo: string) {
  const elemento = campo.value
  if (!elemento) return

  const inicio = elemento.selectionStart
  const fim = elemento.selectionEnd
  const selecionado = conteudo.value.slice(inicio, fim) || exemplo

  conteudo.value = conteudo.value.slice(0, inicio) + antes + selecionado + depois
    + conteudo.value.slice(fim)

  await nextTick()
  elemento.focus()
  elemento.setSelectionRange(inicio + antes.length, inicio + antes.length + selecionado.length)
}

async function lista() {
  const elemento = campo.value
  if (!elemento) return

  const inicio = elemento.selectionStart
  const fim = elemento.selectionEnd
  // Começa na linha onde está o cursor, para "- " não cair no meio da frase.
  const inicioDaLinha = conteudo.value.lastIndexOf('\n', inicio - 1) + 1
  const trecho = conteudo.value.slice(inicioDaLinha, fim) || 'item'
  const comMarcadores = trecho.split('\n').map(linha => `- ${linha}`).join('\n')

  conteudo.value = conteudo.value.slice(0, inicioDaLinha) + comMarcadores + conteudo.value.slice(fim)

  await nextTick()
  elemento.focus()
}

const botoes = [
  { rotulo: 'Negrito', texto: 'N', classe: 'font-bold', agir: () => envolver('**', '**', 'texto em negrito') },
  { rotulo: 'Itálico', texto: 'I', classe: 'italic', agir: () => envolver('*', '*', 'texto em itálico') },
  { rotulo: 'Lista', texto: '• Lista', classe: '', agir: lista },
  { rotulo: 'Link', texto: 'Link', classe: 'underline', agir: () => envolver('[', '](https://)', 'texto do link') },
]

const classes = 'w-full rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div>
    <label
      :for="nome"
      class="block text-sm font-medium mb-1"
    >
      {{ rotulo }}<span
        v-if="obrigatorio"
        class="text-error"
      > *</span>
    </label>

    <div
      v-if="montado"
      role="toolbar"
      :aria-label="`Formatação de ${rotulo.toLowerCase()}`"
      class="mb-1 flex flex-wrap items-center gap-1"
    >
      <UButton
        v-for="botao in botoes"
        :key="botao.rotulo"
        type="button"
        size="sm"
        color="neutral"
        variant="ghost"
        :class="botao.classe"
        :aria-label="botao.rotulo"
        :title="botao.rotulo"
        :disabled="previa"
        @click="botao.agir"
      >
        {{ botao.texto }}
      </UButton>
      <UButton
        type="button"
        size="sm"
        color="neutral"
        variant="outline"
        class="ml-auto"
        :aria-pressed="previa"
        @click="alternarPrevia"
      >
        {{ previa ? 'Voltar a editar' : 'Ver prévia' }}
      </UButton>
    </div>

    <!-- O campo continua no formulário durante a prévia, só escondido: é ele que
         leva o texto no envio. -->
    <textarea
      :id="nome"
      ref="campo"
      v-model="conteudo"
      :name="nome"
      :rows="linhas"
      :required="obrigatorio && !previa"
      :class="classes"
      :hidden="previa"
    />

    <!-- eslint-disable vue/no-v-html — markdown com HTML desligado, o mesmo
         renderizador do servidor; marcação digitada vira texto. -->
    <div
      v-if="previa"
      class="min-h-24 rounded-md border border-default px-3 py-2 flex flex-col gap-3 leading-relaxed"
      aria-live="polite"
      v-html="html"
    />

    <p class="mt-1 text-xs text-muted">
      Negrito, itálico, listas e links. HTML escrito aqui aparece como texto, não
      é interpretado.
    </p>
  </div>
</template>
