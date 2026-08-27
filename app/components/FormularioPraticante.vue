<script setup lang="ts">
import { MAIORIDADE, calcularIdade } from '~~/shared/idade'

const props = defineProps<{
  acao: string
  praticante?: Record<string, unknown> | null
  textoBotao?: string
}>()

const p = computed(() => props.praticante ?? {})
const criando = computed(() => !props.praticante)

/**
 * A data de nascimento é o único campo com estado próprio: dela sai a idade, e
 * da idade sai a decisão de pedir ou não os dados do responsável. Sem isso, o
 * formulário mostraria campos de responsável para um adulto de 40 anos.
 */
const nascimento = ref('')

const idade = computed(() => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento.value)) return null
  const data = new Date(`${nascimento.value}T00:00:00.000Z`)
  if (Number.isNaN(data.getTime()) || data > new Date()) return null
  return calcularIdade(data, new Date())
})

const menorDeIdade = computed(() => idade.value !== null && idade.value < MAIORIDADE)

/** Data no formato que o `<input type="date">` entende. */
function paraCampoData(valor: unknown): string {
  if (!valor) return ''
  const data = new Date(valor as string)
  return Number.isNaN(data.getTime()) ? '' : data.toISOString().slice(0, 10)
}

// Na edição, o campo já nasce com a data de quem está sendo editado.
nascimento.value = paraCampoData(props.praticante?.dataNascimento)

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

  // Enviado como urlencoded, e não como FormData: FormData vira
  // multipart/form-data, e o readBody do h3 só interpreta JSON, urlencoded e
  // texto — multipart chegaria ao servidor como um corpo que ele não sabe ler,
  // e todo campo pareceria vazio. É o mesmo formato do envio nativo do
  // formulário, então os dois caminhos entregam a mesma coisa.
  const dados = new URLSearchParams()
  for (const [chave, valor] of new FormData(formulario)) {
    dados.append(chave, String(valor))
  }

  try {
    const resposta = await $fetch<{ ok: boolean, destino?: string, problemas?: string[] }>(
      props.acao,
      {
        method: 'POST',
        body: dados,
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
              autocomplete="name"
              obrigatorio
              :valor="campo('nomeCompleto')"
            />
          </div>

          <div>
            <label
              for="dataNascimento"
              class="block text-sm font-medium mb-1"
            >
              Data de nascimento<span class="text-error"> *</span>
              <span
                v-if="idade !== null"
                class="ml-1 font-normal text-muted"
              >— {{ idade }} anos</span>
            </label>
            <input
              id="dataNascimento"
              v-model="nascimento"
              name="dataNascimento"
              type="date"
              autocomplete="bday"
              required
              :class="classeCampo"
            >
          </div>

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
              <!-- Sem opção pré-escolhida: com "Masculino" já selecionado, quem
                   passasse direto salvaria um dado que ninguém informou. -->
              <option
                value=""
                :selected="!campo('sexo')"
                disabled
              >
                Selecione
              </option>
              <option
                value="FEMININO"
                :selected="campo('sexo') === 'FEMININO'"
              >
                Feminino
              </option>
              <option
                value="MASCULINO"
                :selected="campo('sexo') === 'MASCULINO'"
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
            autocomplete="email"
            tipo="email"
            obrigatorio
            :valor="campo('email')"
            ajuda="Pode repetir entre irmãos. Não é o e-mail de acesso ao sistema."
          />
          <CampoTexto
            nome="telefone"
            rotulo="Telefone"
            autocomplete="tel"
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
              autocomplete="postal-code"
              :valor="campo('cep')"
            />
          </div>
          <div class="sm:col-span-3">
            <CampoTexto
              nome="logradouro"
              rotulo="Logradouro"
              autocomplete="address-line1"
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
            autocomplete="address-level2"
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

      <!-- Só aparece para menor de 18: pedir responsável a um adulto de 40 anos
           é ruído, e o campo é obrigatório justamente quando aparece. -->
      <section v-if="menorDeIdade">
        <h2 class="font-semibold mb-3">
          Responsável
        </h2>
        <p class="text-sm text-muted mb-3">
          Praticante com {{ idade }} anos: nome e telefone do responsável são
          obrigatórios, e o consentimento dele também.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            nome="responsavelNome"
            rotulo="Nome do responsável"
            obrigatorio
            :valor="campo('responsavelNome')"
          />
          <CampoTexto
            nome="responsavelTelefone"
            rotulo="Telefone do responsável"
            obrigatorio
            :valor="campo('responsavelTelefone')"
          />
        </div>
      </section>

      <section>
        <h2 class="font-semibold mb-3">
          Contato de emergência
        </h2>
        <div class="grid gap-4 sm:grid-cols-3">
          <CampoTexto
            nome="emergenciaNome"
            rotulo="Nome"
            :valor="campo('emergenciaNome')"
          />
          <CampoTexto
            nome="emergenciaTelefone"
            rotulo="Telefone"
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
          <label
            v-if="menorDeIdade"
            class="flex gap-2 items-start"
          >
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
