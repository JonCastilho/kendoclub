# KendoClub — Plano do projeto

Sistema de gestão para clubes de kendo: cadastro de praticantes, mensalidades,
newsfeed e eventos com confirmação de presença. Software livre, pensado para que
qualquer clube no Brasil consiga subir a própria instância.

## 1. Princípios que guiam as decisões

1. **Poucas peças móveis.** Cada componente a mais é algo que um voluntário terá
   que entender e manter daqui a três anos.
2. **O clube é dono dos próprios dados.** Uma instância por clube, banco próprio.
3. **Celular em primeiro lugar.** O praticante vai usar isso no ônibus, não no desktop.
4. **Nada de dado sensível que não precise existir.** Sem cartão, sem documento
   digitalizado, sem integração de pagamento no MVP.

## 2. Decisões já tomadas

| Tema | Decisão |
|---|---|
| Stack | Nuxt 3.21 (Vue 3) full-stack — front e API no mesmo projeto |
| Mensalidades | Pix do clube + baixa manual pela diretoria |
| Login | E-mail + senha (autenticação própria) |
| Distribuição | Uma instância por clube |
| Licença | AGPL-3.0-only |
| Idioma do código | Domínio em português; inglês só onde o framework impõe |

## 3. Escopo

### MVP

- **Praticantes** — cadastro, contato, responsável (para menores), graduação
  (kyu/dan) com histórico, situação (ativo / afastado / desligado).
- **Mensalidades** — valor mensal por praticante, geração das cobranças do mês,
  baixa manual, painel de inadimplência, visão do praticante com a chave Pix.
- **Newsfeed** — posts com visibilidade pública ou restrita a logados; a parte
  pública é a página inicial do clube na internet.
- **Eventos e campeonatos** — divulgação, confirmação de presença
  (vou / não vou / talvez) e lista de confirmados para a diretoria.
- **Acesso** — dois papéis: diretoria e praticante.

### Fora do MVP (encaixa depois)

Presença nos treinos, histórico de exames de graduação, inventário de
equipamentos, mensagens internas, relatórios financeiros do clube, integração com
gateway de pagamento, app nativo.

## 4. Modelo de dados

**Convenção de nomes:** entidades e campos do domínio em **português sem
acentos**; em inglês, apenas o que o framework impõe (métodos do Prisma, pastas
do Nuxt, composables). Os termos de kendo — kyu, dan — ficam como são ditos.
O código fala a mesma língua da diretoria, da documentação e dos commits.

```
Usuario               id, email, senhaHash, papel (DIRETORIA|PRATICANTE),
                      praticanteId?, ativo, ultimoAcessoEm, criadoEm
TokenRedefinicaoSenha id, usuarioId, tokenHash, expiraEm, usadoEm?
Praticante            id, nomeCompleto, dataNascimento, telefone, email, endereco?,
                      responsavelNome?, responsavelTelefone?,      # menores
                      responsavelConsentimentoEm?,                 # LGPD
                      situacao (ATIVO|AFASTADO|DESLIGADO),
                      ingressouEm, desligadoEm?, valorMensalidade, observacoes?
Graduacao             id, praticanteId, grau (KYU_8..KYU_1, DAN_1..DAN_8),
                      obtidaEm, observacoes?
Mensalidade           id, praticanteId, competencia (AAAA-MM), valor, vencimento,
                      situacao (ABERTA|PAGA|ISENTA|CANCELADA),
                      pagaEm?, valorPago?, formaPagamento?, observacao?,
                      baixadaPorUsuarioId?
Publicacao            id, titulo, slug, conteudo (markdown), imagemCapa?,
                      visibilidade (PUBLICA|RESTRITA), publicadaEm?, autorUsuarioId
Evento                id, titulo, slug, descricao (markdown), inicioEm, fimEm?,
                      local?, visibilidade (PUBLICA|RESTRITA),
                      prazoConfirmacao?, criadoPorUsuarioId
ConfirmacaoPresenca   id, eventoId, praticanteId,
                      situacao (VOU|NAO_VOU|TALVEZ), atualizadoEm
ConfiguracaoClube     nomeClube, logo?, chavePix, titularPix, emailContato,
                      fusoHorario (America/Sao_Paulo), corPrimaria
```

Notas de modelagem:

- `Usuario` e `Praticante` separados de propósito: praticante menor de idade pode
  existir sem conta de acesso, e quem é da diretoria pode ter conta sem ser
  praticante.
- `Mensalidade` guarda o valor cobrado (não deriva de
  `Praticante.valorMensalidade` na hora de exibir) — senão, reajustar a
  mensalidade reescreveria o histórico.
- `Mensalidade` tem unicidade `(praticanteId, competencia)`: o banco impede gerar
  a mesma competência duas vezes para o mesmo praticante.
- `ConfirmacaoPresenca` não se chama `Presenca` porque o controle de presença nos
  treinos, previsto para depois do MVP, vai precisar desse nome.
- `Grau` começa no 8º kyu para atender clubes com turma infantil.
- `ConfiguracaoClube` é uma linha única; é o que cada clube personaliza ao
  instalar.

## 5. Permissões

| Ação | Diretoria | Praticante | Visitante |
|---|---|---|---|
| Ver posts e eventos públicos | sim | sim | sim |
| Ver posts e eventos restritos | sim | sim | não |
| Confirmar presença em evento | sim | sim | não |
| Ver as próprias mensalidades | sim | sim | não |
| Cadastrar e editar praticantes | sim | não | não |
| Gerar cobranças e dar baixa | sim | não | não |
| Publicar posts e eventos | sim | não | não |
| Configurar o clube | sim | não | não |

A checagem de permissão fica **no servidor**, em cada rota de API. O que a
interface esconde é conveniência, não segurança.

## 6. Telas

**Público:** home com o feed público, página do post, agenda de eventos, login.

**Praticante:** feed completo, evento com botão de confirmação, "minhas
mensalidades" (em aberto e pagas, com a chave Pix para copiar), meus dados.

**Diretoria:** painel (inadimplentes do mês, próximos eventos, confirmações),
praticantes (lista com filtro por situação, ficha, graduações), mensalidades
(gerar mês, dar baixa), posts, eventos (com lista de confirmados), configurações
do clube, usuários.

## 7. Stack detalhada

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | Nuxt 3.21 (Vue 3, TypeScript) | Front e API num projeto só; SSR deixa o feed público indexável |
| UI | Nuxt UI 3.3 (Tailwind 4 por baixo) | Componentes prontos, acessíveis e responsivos; pouca CSS própria |
| Banco | PostgreSQL | Roda em free tier gerenciado e em VPS; sem depender de disco persistente |
| ORM | Prisma | Schema declarativo e migrations versionadas; familiar para quem vem de JPA |
| Autenticação | nuxt-auth-utils | Sessão em cookie selado e hash de senha embutidos, sem serviço externo |
| Validação | Zod | Mesmo schema valida no cliente e no servidor |
| E-mail | Nodemailer via SMTP | Só para redefinição de senha e convites; SMTP é o denominador comum |
| Conteúdo | Markdown | Editor simples e sem HTML colado — corta a superfície de XSS |
| Testes | Vitest (regras de negócio) e Playwright (fluxos críticos) | Cobertura onde errar sai caro: cobrança, permissão, RSVP |

### Node e por que Nuxt 3, não Nuxt 4

A máquina de desenvolvimento fica no **Node 20.20.2** (última da linha 20), e o
Nuxt 4 exige Node `^22.19 || ^24.11 || >=26`. Daí o projeto nascer em Nuxt 3.21,
que é a última versão que roda no Node 20 — o corte fica em Nuxt 3.18, que já
pede Node 20.19, e a 3.17.7 era a última compatível com o 20.17 original.

Limites conferidos no registro do npm (ago/2026):

| Peça | Escolhida | Por que não a atual |
|---|---|---|
| Nuxt | 3.21.11 | 4.x exige Node 22.19+ |
| Nuxt UI | 3.3.7 | 4.x depende de `@nuxt/kit ^4.5`, ou seja, é Nuxt 4 na prática |
| Prisma | 7.9.1 | — (7.x roda a partir do Node 20.19) |
| ESLint | 10.x | — |
| Vitest | 4.x | — |

Duas consequências práticas do Node 20, ambas contornadas e documentadas no
código: o npm 10 quebra ao instalar as dependências do Nuxt (`.npmrc` liga
`legacy-peer-deps`), e as ferramentas do módulo `@nuxt/eslint` exigem Node 21+
(usam `Object.groupBy`), então o lint é uma configuração ESLint direta —
`eslint-plugin-vue` + `typescript-eslint`, uma peça a menos.

Para que a migração futura para o Nuxt 4 seja quase de graça, o projeto já usa
`future.compatibilityVersion: 4` no `nuxt.config`: a estrutura de pastas e o
comportamento são os do Nuxt 4 desde o começo. No dia em que o Node subir para 22
ou 24, migrar vira trocar a versão do pacote.

**Node 20 está fora do suporte desde abril de 2026** — o runtime não recebe mais
correção de segurança. Antes de a instância ir para a internet, a produção deve
rodar em Node 22 ou 24 (o container define isso, independente da máquina de
desenvolvimento).

**Banco no desenvolvimento:** sem Docker instalado, a saída mais rápida é um
Postgres gerenciado gratuito (Neon ou Supabase) com um branch de desenvolvimento —
mesmo motor em dev e em produção, nada para instalar. Alternativas: instalar o
Postgres localmente, ou instalar o Docker Desktop e usar o `docker-compose.yml`
que de todo modo será entregue para os clubes que quiserem se auto-hospedar.

**Imagens de posts e eventos:** o MVP grava em disco num diretório configurável;
armazenamento S3-compatível fica como opção posterior atrás da mesma interface.

## 8. Hospedagem e operação

- **Entrega:** `Dockerfile` e `docker-compose.yml` (app + Postgres) — o clube sobe
  com um comando numa VPS de cerca de US$5. Quem preferir PaaS (Railway, Render,
  Fly) usa a mesma imagem.
- **Configuração:** tudo por variáveis de ambiente, com `.env.example` documentado.
  Nenhum dado do clube dentro do código.
- **Primeiro acesso:** um comando de setup cria o usuário admin e as configurações
  do clube — sem senha padrão embutida no código.
- **Backup:** `pg_dump` diário para fora do servidor. Vai documentado no README; é
  o item que clube pequeno mais esquece.
- **Fuso e moeda:** `America/Sao_Paulo` e BRL fixos no MVP.

## 9. Roadmap

| Etapa | Entrega | Fica pronto quando |
|---|---|---|
| 0 | Fundação: Node 20.20, Nuxt 3.21 + TS, Nuxt UI, Prisma, banco de dev, lint, `.env.example`, LICENSE, README | `npm run dev` sobe a home e a migration inicial roda |
| 1 | Autenticação: login, logout, sessão, papéis, redefinição de senha, setup do admin | Diretoria e praticante entram e cada um vê o que lhe cabe |
| 2 | Praticantes: CRUD, graduações, situação, busca e filtros | A diretoria consegue migrar a planilha atual para o sistema |
| 3 | Mensalidades: geração do mês, baixa, inadimplência, visão do praticante com Pix | Fecha um mês inteiro de cobrança sem planilha |
| 4 | Newsfeed: posts públicos e restritos, home pública, imagem de capa | O clube publica e o post aparece só para quem deve ver |
| 5 | Eventos: cadastro, agenda, RSVP, lista de confirmados | Um campeonato real é divulgado e confirmado pelo app |
| 6 | Empacotamento: Docker, docs de instalação, dados de demonstração, CI | Outro clube instala seguindo só o README |

As etapas 1 a 5 já são utilizáveis pelo seu clube antes de a 6 existir. A etapa 6
é o que transforma "meu sistema" em "software que outro clube usa".

## 10. Abertura do código

### Licença: AGPL-3.0-only

Decidida. É a única licença comum cujo gatilho alcança uso via rede: quem
modificar o sistema e oferecê-lo a usuários pela web precisa disponibilizar o
código alterado. Num app web, GPL e MPL não teriam efeito — o gatilho delas é a
distribuição, que nunca acontece quando o software é oferecido como serviço.

Um clube que apenas instala e usa não tem obrigação nenhuma; adaptar para uso
interno também é livre. A obrigação nasce ao servir a versão modificada a
usuários.

Execução:

1. `LICENSE` na raiz com o texto íntegro, copiado de
   <https://www.gnu.org/licenses/agpl-3.0.txt> (não vale versão resumida).
2. `"license": "AGPL-3.0-only"` no `package.json` (identificador SPDX).
3. Link **"código-fonte"** no rodapé do app, apontando para o repositório — é o
   que cumpre o artigo 13 e serve de exemplo para quem instalar.
4. `CONTRIBUTING.md` exigindo `Signed-off-by` nos commits (DCO). Sem isso,
   relicenciar no futuro passa a depender do aval de cada contribuidor.
5. Cabeçalho de copyright nos arquivos-fonte principais e aviso no README.
6. **Logo e nome do clube ficam fora da licença.** Licença de código não cobre
   marca nem identidade visual: os arquivos de identidade entram como direitos
   reservados ou viram placeholder no repositório público, e o README avisa que
   quem instalar deve usar a própria identidade.

### Demais itens

- **README** com instalação em passos, capturas de tela e escopo explícito.
- **Dados de demonstração** (`seed`) para que qualquer um veja o sistema
  funcionando em minutos.
- Textos da interface centralizados desde o início — barato agora, e é o que
  permite traduzir depois se surgir interesse fora do Brasil.

## 11. Pontos de atenção

- **LGPD e menores.** O sistema guarda dados de crianças e adolescentes. Coletar o
  mínimo, registrar o consentimento do responsável no cadastro e ter como excluir
  um praticante de verdade quando ele pedir.
- **Envio de e-mail.** É a única dependência externa do MVP. Clube sem SMTP precisa
  de um plano B: a diretoria gera um link de redefinição direto no painel.
- **Dinheiro pede trilha.** Toda baixa registra quem deu e quando; sem exclusão
  silenciosa de cobrança paga.
- **Sessão em cookie** com `Secure`, `HttpOnly` e `SameSite`; HTTPS obrigatório em
  produção.
- **Aviso de segurança do Nuxt UI 3** (GHSA-gj2h-2fpw-fhv9, moderado): o markup
  renderizado no servidor por `UForm`/`UAuthForm` omite o atributo `method`, e um
  envio feito antes da hidratação vai por GET — o que colocaria a senha na URL. A
  correção está no Nuxt UI 4.8.1+, que exige Nuxt 4 e está fora do alcance
  enquanto o desenvolvimento for em Node 20. **Mitigação obrigatória na etapa 1:**
  o formulário de login usa `<form method="post">` explícito, e nenhum campo de
  senha entra num formulário que dependa de hidratação para definir o método.
- **Aviso do `deepmerge-ts`** (GHSA-ggr8-5vv4-36mx, alto) chega pelo
  `@prisma/config`, usado apenas pela CLI do Prisma em tempo de desenvolvimento,
  sobre um arquivo de configuração escrito por nós. Não há exposição em produção:
  o pacote não vai para o `.output`. A alternativa seria voltar ao Prisma 6.12,
  que traz problemas maiores. Revisar quando o Prisma publicar a correção.

## 12. Em aberto

1. Onde vai hospedar e se já há domínio. Levantamento feito em ago/2026: a
   Oracle Cloud Always Free (2 OCPU ARM, 12 GB de RAM, 200 GB de disco, região
   São Paulo) é a única opção gratuita sem hibernação e com disco persistente,
   e é a que casa com o `docker-compose.yml` da etapa 6. Descartado o plano
   gratuito do Render: hiberna após 15 minutos e o Postgres expira em 30 dias.
2. Identidade visual: logo e cores do clube.
3. Existe hoje uma planilha de praticantes e mensalidades para importar?

Resolvido: o repositório público é <https://github.com/JonCastilho/kendoclub>.
