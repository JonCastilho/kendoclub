<script setup lang="ts">
const props = defineProps<{
  acao: string
  praticante?: Record<string, unknown> | null
  textoBotao?: string
}>()

const p = computed(() => props.praticante ?? {})
const criando = computed(() => !props.praticante)

/** Data no formato que o `<input type="date">` entende. */
function paraCampoData(valor: unknown): string {
  if (!valor) return ''
  const data = new Date(valor as string)
  return Number.isNaN(data.getTime()) ? '' : data.toISOString().slice(0, 10)
}

const campo = (nome: string) => (p.value[nome] as string | null) ?? ''
const temData = (nome: string) => Boolean(p.value[nome])

const problemas = ref<string[]>([])
const enviando = ref(false)

/**
 * Envio por JavaScript quando ele existe: o formulário é longo, e recarregar a
 * página num erro de validação apagaria tudo o que foi digitado. Sem
 * JavaScript, o `method="post"` do formulário continua valendo e o servidor
 * responde com redirecionamento.
 */
async function enviar(evento: Event) {
  const formulario = evento.target as HTMLFormElement
  enviando.value = true
  problemas.value = []

  try {
    const resposta = await $fetch<{ ok: boolean, destino?: string, problemas?: string[] }>(
      props.acao,
      {
        method: 'POST',
        body: new FormData(formulario),
        headers: { accept: 'application/json' },
      },
    )
    if (resposta.destino) await navigateTo(resposta.destino)
  }
  catch (erro) {
    const dados = (erro as { data?: { problemas?: string[] } }).data
    problemas.value = dados?.problemas ?? ['Não foi possível salvar. Tente de novo.']
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  finally {
    enviando.value = false
  }
}

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']

const classeCampo = 'w-full rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div>
    <AvisoErros :problemas="problemas" />

    <form
      method="post"
      :action="acao"
      class="flex flex-col gap-8"
      @submit.prevent="enviar"
    >
      <section>
        <h2 class="font-semibold mb-3">
          Dados pessoais
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <CampoTexto
              nome="nomeCompleto"
              rotulo="Nome completo"
              obrigatorio
              :valor="campo('nomeCompleto')"
            />
          </div>

          <CampoTexto
            nome="dataNascimento"
            rotulo="Data de nascimento"
            tipo="date"
            obrigatorio
            :valor="paraCampoData(p.dataNascimento)"
          />

          <div>
            <label
              for="sexo"
              class="block text-sm font-medium mb-1"
            >Sexo <span class="text-error">*</span></label>
            <select
              id="sexo"
              name="sexo"
              required
              :class="classeCampo"
            >
              <option
                value="FEMININO"
                :selected="campo('sexo') === 'FEMININO'"
              >
                Feminino
              </option>
              <option
                value="MASCULINO"
                :selected="campo('sexo') !== 'FEMININO'"
              >
                Masculino
              </option>
            </select>
          </div>

          <div>
            <label
              for="tipoDocumento"
              class="block text-sm font-medium mb-1"
            >Tipo de documento <span class="text-error">*</span></label>
            <select
              id="tipoDocumento"
              name="tipoDocumento"
              :class="classeCampo"
            >
              <option
                value="CPF"
                :selected="campo('tipoDocumento') !== 'DOCUMENTO_ESTRANGEIRO'"
              >
                CPF
              </option>
              <option
                value="DOCUMENTO_ESTRANGEIRO"
                :selected="campo('tipoDocumento') === 'DOCUMENTO_ESTRANGEIRO'"
              >
                Documento estrangeiro
              </option>
            </select>
          </div>

          <CampoTexto
            nome="documento"
            rotulo="Número do documento"
            obrigatorio
            :valor="campo('documento')"
            ajuda="CPF é conferido; documento estrangeiro, não."
          />

          <div>
            <label
              for="titularDocumento"
              class="block text-sm font-medium mb-1"
            >De quem é o documento</label>
            <select
              id="titularDocumento"
              name="titularDocumento"
              :class="classeCampo"
            >
              <option
                value="PROPRIO"
                :selected="campo('titularDocumento') !== 'RESPONSAVEL'"
              >
                Do próprio praticante
              </option>
              <option
                value="RESPONSAVEL"
                :selected="campo('titularDocumento') === 'RESPONSAVEL'"
              >
                Do responsável (menor sem CPF)
              </option>
            </select>
          </div>

          <CampoTexto
            nome="nacionalidade"
            rotulo="Nacionalidade"
            :valor="campo('nacionalidade') || 'Brasileira'"
          />

          <CampoTexto
            nome="iniciouPraticaEm"
            rotulo="Começou a praticar em"
            tipo="date"
            :valor="paraCampoData(p.iniciouPraticaEm)"
            ajuda="Pode ser anterior à entrada no clube."
          />
        </div>
      </section>

      <section>
        <h2 class="font-semibold mb-3">
          Contato
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            nome="email"
            rotulo="E-mail"
            tipo="email"
            obrigatorio
            :valor="campo('email')"
            ajuda="Pode repetir entre irmãos. Não é o e-mail de acesso ao sistema."
          />
          <CampoTexto
            nome="telefone"
            rotulo="Telefone"
            obrigatorio
            :valor="campo('telefone')"
          />
          <CampoTexto
            nome="telefoneAlternativo"
            rotulo="Telefone alternativo"
            :valor="campo('telefoneAlternativo')"
          />
        </div>
      </section>

      <section>
        <h2 class="font-semibold mb-3">
          Endereço
        </h2>
        <div class="grid gap-4 sm:grid-cols-6">
          <div class="sm:col-span-2">
            <CampoTexto
              nome="cep"
              rotulo="CEP"
              :valor="campo('cep')"
            />
          </div>
          <div class="sm:col-span-3">
            <CampoTexto
              nome="logradouro"
              rotulo="Logradouro"
              :valor="campo('logradouro')"
            />
          </div>
          <CampoTexto
            nome="numero"
            rotulo="Número"
            :valor="campo('numero')"
          />
          <div class="sm:col-span-2">
            <CampoTexto
              nome="complemento"
              rotulo="Complemento"
              :valor="campo('complemento')"
            />
          </div>
          <div class="sm:col-span-2">
            <CampoTexto
              nome="bairro"
              rotulo="Bairro"
              :valor="campo('bairro')"
            />
          </div>
          <CampoTexto
            nome="cidade"
            rotulo="Cidade"
            :valor="campo('cidade')"
          />
          <div>
            <label
              for="uf"
              class="block text-sm font-medium mb-1"
            >UF</label>
            <select
              id="uf"
              name="uf"
              :class="classeCampo"
            >
              <option value="" />
              <option
                v-for="uf in UFS"
                :key="uf"
                :value="uf"
                :selected="campo('uf') === uf"
              >
                {{ uf }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 class="font-semibold mb-3">
          Responsável e emergência
        </h2>
        <p class="text-sm text-muted mb-3">
          Responsável é obrigatório para menores de 18 anos.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            nome="responsavelNome"
            rotulo="Nome do responsável"
            :valor="campo('responsavelNome')"
          />
          <CampoTexto
            nome="responsavelTelefone"
            rotulo="Telefone do responsável"
            :valor="campo('responsavelTelefone')"
          />
          <CampoTexto
            nome="emergenciaNome"
            rotulo="Contato de emergência"
            :valor="campo('emergenciaNome')"
          />
          <CampoTexto
            nome="emergenciaTelefone"
            rotulo="Telefone de emergência"
            :valor="campo('emergenciaTelefone')"
          />
          <CampoTexto
            nome="emergenciaParentesco"
            rotulo="Parentesco"
            :valor="campo('emergenciaParentesco')"
          />
        </div>
      </section>

      <section>
        <h2 class="font-semibold mb-3">
          Saúde e observações
        </h2>
        <div class="flex flex-col gap-4">
          <CampoTexto
            nome="observacoesMedicas"
            rotulo="Observações médicas"
            multilinha
            :valor="campo('observacoesMedicas')"
            ajuda="Dado sensível: só a diretoria vê, e nunca aparece em listagem. Exige o consentimento de saúde abaixo."
          />
          <CampoTexto
            nome="observacoes"
            rotulo="Observações gerais"
            multilinha
            :valor="campo('observacoes')"
          />
        </div>
      </section>

      <section>
        <h2 class="font-semibold mb-3">
          Consentimentos
        </h2>
        <div class="flex flex-col gap-2 text-sm">
          <label class="flex gap-2 items-start">
            <input
              type="checkbox"
              name="consentimentoDados"
              class="mt-1"
              :checked="temData('consentimentoDadosEm')"
            >
            <span>Consentiu com o tratamento dos dados pessoais (LGPD)</span>
          </label>
          <label class="flex gap-2 items-start">
            <input
              type="checkbox"
              name="consentimentoSaude"
              class="mt-1"
              :checked="temData('consentimentoSaudeEm')"
            >
            <span>Consentiu especificamente com o registro de dados de saúde</span>
          </label>
          <label class="flex gap-2 items-start">
            <input
              type="checkbox"
              name="autorizacaoImagem"
              class="mt-1"
              :checked="temData('autorizacaoImagemEm')"
            >
            <span>Autorizou o uso de imagem em publicações do clube</span>
          </label>
          <label class="flex gap-2 items-start">
            <input
              type="checkbox"
              name="responsavelConsentimento"
              class="mt-1"
              :checked="temData('responsavelConsentimentoEm')"
            >
            <span>Responsável consentiu (obrigatório para menores)</span>
          </label>
        </div>
      </section>

      <section v-if="criando">
        <h2 class="font-semibold mb-3">
          Filiação
        </h2>
        <div class="sm:w-1/2">
          <CampoTexto
            nome="filiacaoInicioEm"
            rotulo="Filiado ao clube desde"
            tipo="date"
            obrigatorio
            :valor="paraCampoData(new Date())"
            ajuda="Pode ser retroativa, para quem já treina há anos."
          />
        </div>
      </section>

      <div class="flex gap-3">
        <button
          type="submit"
          :disabled="enviando"
          class="rounded-md bg-primary text-inverted font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {{ enviando ? 'Salvando…' : (textoBotao ?? 'Salvar') }}
        </button>
        <ULink
          to="/praticantes"
          class="px-4 py-2"
        >
          Cancelar
        </ULink>
      </div>
    </form>
  </div>
</template>
