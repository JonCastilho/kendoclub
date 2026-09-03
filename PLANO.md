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

> O banco hoje está no formato da etapa 0. O modelo abaixo é o alvo, revisado em
> agosto de 2026 a partir dos campos levantados pela diretoria; a migração
> acontece na etapa 2.

```
Usuario               id, email, senhaHash, papel (DIRETORIA|PRATICANTE),
                      praticanteId?, ativo, ultimoAcessoEm, criadoEm
TokenRedefinicaoSenha id, usuarioId, tokenHash, expiraEm, usadoEm?

Praticante            id, nomeCompleto, dataNascimento,
                      documento, tipoDocumento (CPF|DOCUMENTO_ESTRANGEIRO),
                      titularDocumento (PROPRIO|RESPONSAVEL), nacionalidade,
                      sexo (FEMININO|MASCULINO),
                      email (contato), telefone, telefoneAlternativo?,
                      cep?, logradouro?, numero?, complemento?, bairro?,
                      cidade?, uf?,
                      emergenciaNome?, emergenciaTelefone?, emergenciaParentesco?,
                      responsavelNome?, responsavelTelefone?,
                      observacoesMedicas?,          # dado sensível — ver §11
                      iniciouPraticaEm?, observacoes?,
                      consentimentoDadosEm?, consentimentoSaudeEm?,
                      autorizacaoImagemEm?, responsavelConsentimentoEm?
Filiacao              id, praticanteId, inicioEm, fimEm?, motivoSaida?
Modalidade            id, nome (único), kyuInicial, ativa
PraticanteModalidade  id, praticanteId, modalidadeId, desde, ate?,
                      grau? (KYU_10..KYU_1, DAN_1..DAN_8), graduadoEm?,
                      observacoesGraduacao?
Isencao               id, praticanteId, inicioEm, fimEm?, motivo,
                      concedidaPorUsuarioId

Item                  id, nome, identificador? (patrimônio), tipo?,
                      situacao (DISPONIVEL|MANUTENCAO|BAIXADO),
                      valorMensalAluguel, observacoes?
Aluguel               id, praticanteId, itemId?, descricao?, inicioEm, fimEm?,
                      valorMensal, observacao?

Mensalidade           id, praticanteId, competencia (AAAA-MM), vencimento,
                      valorTotal, situacao (ABERTA|PAGA|ISENTA|CANCELADA),
                      pagaEm?, valorPago?, formaPagamento?, observacao?,
                      baixadaPorUsuarioId?
LinhaMensalidade      id, mensalidadeId, tipo (MENSALIDADE|ALUGUEL|OUTRO),
                      descricao, valor, aluguelId?

Publicacao            id, titulo, slug, conteudo (markdown), imagemCapa?,
                      visibilidade (PUBLICA|RESTRITA), publicadaEm?, autorUsuarioId
Evento                id, titulo, slug, descricao (markdown), inicioEm, fimEm?,
                      local?, visibilidade (PUBLICA|RESTRITA),
                      prazoConfirmacao?, criadoPorUsuarioId
ConfirmacaoPresenca   id, eventoId, praticanteId,
                      situacao (VOU|NAO_VOU|TALVEZ), atualizadoEm
ConfiguracaoClube     nomeClube, logo?, chavePix, titularPix, emailContato,
                      valorMensalidade, diaVencimento, valorAluguelPadrao,
                      fusoHorario (America/Sao_Paulo), corPrimaria
```

Notas de modelagem:

- `Usuario` e `Praticante` separados de propósito: praticante menor de idade pode
  existir sem conta de acesso, e quem é da diretoria pode ter conta sem ser
  praticante.
- **O e-mail do praticante é de contato e pode repetir**; o e-mail único é o da
  conta de acesso. Sem essa separação, uma mãe com três filhos no dojo não
  conseguiria cadastrar o terceiro.
- **Situação de filiação é derivada**, não guardada: quem tem `Filiacao` em aberto
  está filiado. Períodos separados registram quem saiu e voltou sem reescrever o
  tempo de casa. O banco garante, por índice parcial, no máximo uma filiação
  aberta por praticante.
- **A data de filiação é informada, não presumida.** O cadastro sugere hoje, mas
  aceita data retroativa — o primeiro uso do sistema é justamente cadastrar quem
  treina há anos, e nascer com a data errada estragaria o tempo de casa de todo o
  quadro.
- `sexo` existe para inscrição em campeonato, onde as chaves são separadas.
- **Graduação pertence à modalidade**, não ao praticante: um 3º dan de kendo pode
  ser 1º dan de iaido.
- **Só o grau atual é guardado, dentro do próprio vínculo** — registrar uma
  graduação substitui a anterior, e não há histórico de exames. Para exame de
  graduação o que importa é o grau vigente e desde quando, que é o que fica.
  Grau nulo é **mukyu** (無級, "sem grau"): ausência de valor, e não um item do
  enum que significaria "nenhum".
  *Decisão de agosto/2026, a pedido da diretoria; antes existia uma tabela
  `Graduacao` com histórico.*
- **Isenção tem período, motivo e responsável**, porque mexe em dinheiro. O mês de
  quem tem isenção vigente gera `Mensalidade` com situação `ISENTA`, e não
  ausência de cobrança: buraco no histórico ninguém sabe explicar depois.
- **Mensalidade é composta por linhas** (a mensalidade do clube mais o aluguel de
  cada item). O praticante enxerga de que se compõe o valor, e taxa de exame ou
  camiseta entram depois sem mudar o modelo.
- **Valor da mensalidade fica na configuração do clube**, porque é o mesmo para
  todos. Cada `LinhaMensalidade` guarda o valor aplicado na geração — reajuste
  não reescreve o passado. `Aluguel.valorMensal` segue a mesma regra em relação a
  `Item.valorMensalAluguel`.
- `Mensalidade` tem unicidade `(praticanteId, competencia)`: o banco impede gerar
  a mesma competência duas vezes para o mesmo praticante.
- **Documento, não "CPF".** O campo aceita CPF ou documento estrangeiro, e a
  verificação dos dígitos verificadores só roda no CPF. CPF é guardado apenas com
  os números, para o mesmo praticante não entrar duas vezes com pontuação
  diferente.
- **`titularDocumento` existe por causa dos irmãos.** Menor sem CPF é cadastrado
  com o do responsável; dois filhos da mesma mãe teriam o mesmo número e o
  segundo esbarraria no índice único. A unicidade vale, por índice parcial,
  somente para documento próprio: adulto duplicado continua barrado, irmãos
  passam.
- **Nacionalidade, não naturalidade.** O que o cadastro precisa saber é se a
  pessoa é brasileira — e quem de fato decide a validação é `tipoDocumento`.
  Cidade de nascimento não é coletada: não tem uso no clube.
- **Não existe "afastado".** Quem para de treinar se desliga, e volta com uma nova
  filiação. Um estado a menos é uma regra a menos na geração de mensalidade.
- **Faixa de graduação parametrizável.** O enum guarda a faixa máxima possível
  (10º kyu a 8º dan) e `Modalidade.kyuInicial` decide onde a lista começa em cada
  modalidade — kendo pode começar no 6º kyu e iaido no 5º. Mudar a faixa nunca
  vira migração de banco.
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
| 2 | Praticantes: cadastro completo, filiações, modalidades (Kendo e Iaido), graduações, isenções, busca e filtros | A diretoria cadastra o quadro inteiro do clube |
| 3 | Itens alugáveis: cadastro de itens e controle de aluguel por praticante | Sabe-se quem está com qual bogu, desde quando e por quanto |
| 4 | Mensalidades: geração do mês com linhas, baixa, inadimplência, visão do praticante com Pix | Fecha um mês inteiro de cobrança sem planilha |
| 5 | Declaração de pagamento: o praticante avisa que pagou, a diretoria confere e dá baixa | A conferência sai do WhatsApp e vira fila no sistema |
| 6 | Newsfeed: posts públicos e restritos, home pública, imagem de capa | O clube publica e o post aparece só para quem deve ver |
| 7 | Eventos: cadastro, agenda, confirmação de presença, lista de confirmados | Um campeonato real é divulgado e confirmado pelo app |
| 8 | Empacotamento: Docker, docs de instalação, dados de demonstração, CI | Outro clube instala seguindo só o README |

As etapas 1 a 7 já são utilizáveis pelo seu clube antes de a 8 existir. A etapa 8
é o que transforma "meu sistema" em "software que outro clube usa".

Os itens alugáveis vêm **antes** das mensalidades porque a cobrança do mês inclui
linha de aluguel: sem aluguel cadastrado, não há o que somar.

### Regras da geração de mensalidade (etapa 4)

- **Quem se filia no meio do mês só paga a partir do mês seguinte.** Não há
  cálculo proporcional — a geração olha quem estava filiado no primeiro dia da
  competência.
- Quem tem **isenção vigente** gera mensalidade com situação `ISENTA`, e não
  ausência de cobrança: buraco no histórico ninguém sabe explicar depois.
- Quem **não está filiado** no início da competência não gera nada.
- A cobrança é a soma de **linhas**: a mensalidade do clube mais um aluguel por
  item ou peça em aberto, cada linha com o valor combinado na contratação.
- **Quais aluguéis entram no mês é parametrizável**, em
  `ConfiguracaoClube.regraCobrancaAluguel`:
  - `ABERTO_NO_PRIMEIRO_DIA` (padrão) — só entra o aluguel que já existia no
    primeiro dia da competência. Quem retira dia 20 paga a partir do mês
    seguinte, e quem retira e devolve dentro do mesmo mês não é cobrado.
  - `ABERTO_EM_QUALQUER_DIA` — entra todo aluguel que existiu em algum dia do
    mês. Mais favorável ao clube e mais difícil de explicar ao praticante.

  *Por que este vira parâmetro e o controle de patrimônio não virou:* aqui muda
  uma cláusula da consulta, com a mesma tela, o mesmo cálculo e um caso a mais
  de teste. Lá seriam dois caminhos de cobrança para manter. Parâmetro barato
  se justifica; modo, não.

  A regra da **filiação** no meio do mês continua fixa (paga no mês seguinte).
  Torná-la proporcional não seria um parâmetro barato: mudaria o cálculo do
  valor, e não a seleção de quem entra.

### Declaração de pagamento (etapa 5)

O fluxo já existe no clube, só que no WhatsApp: o praticante paga o Pix, manda o
print para o tesoureiro, e ele confere e anota. A etapa traz isso para dentro do
sistema — sem mudar quem decide.

- **A baixa continua sendo da diretoria.** O praticante declara o pagamento; a
  confirmação é ato de quem responde por ela, com registro de quem confirmou e
  quando. Se declarar desse baixa, bastaria dizer que pagou.
- **Começa sem arquivo:** "paguei em DD/MM" já tira a conversa do WhatsApp e dá
  à diretoria uma fila do que conferir, sem guardar dado financeiro de ninguém.
  O anexo de comprovante vem depois, se a declaração sozinha não bastar.
- **"Em análise" é derivado**, não é situação nova da mensalidade: é cobrança
  aberta com declaração pendente de conferência.

Sobre anexar o comprovante, quando chegar a hora — levantamento de agosto/2026:

- **Armazenamento não é o custo.** Com 12 cobranças por ano por praticante e
  500 KB por arquivo, um clube de 100 gera 600 MB/ano; em cinco anos, 3 GB. Cabe
  no disco gratuito da Oracle Always Free (200 GB) e na cota grátis do
  Cloudflare R2 (10 GB). Acima disso, 6 GB custam cerca de US$ 0,09 por mês.
- **O custo está na LGPD.** Comprovante de Pix mostra nome, banco e chave, e
  print de tela às vezes mostra saldo e outras transações — inclusive de um pai
  que paga pelo filho, alguém que nem é do clube. Exige acesso restrito e
  **prazo de descarte**: apagar o arquivo algum tempo depois da baixa, mantendo
  o registro do pagamento. O que tem valor contábil é a baixa, não a imagem.
- **E no backup**, que deixa de ser um `pg_dump` de texto e passa a ter duas
  partes que precisam ser restauradas coerentes.
- **Sem compressão no servidor.** Reduzir um custo que já é zero não paga uma
  dependência com binário nativo. Limite de tamanho por arquivo resolve.
- Entrega sempre por rota autenticada que confere de quem é a cobrança; nunca
  pasta pública. Tipo validado pelos bytes, não pela extensão.

**Concluídas:** etapas 0, 1, 2, 3, 4 e 5 (agosto de 2026). A etapa 6 está com o
núcleo pronto — publicações, visibilidade e home pública —, faltando a imagem de
capa, que traz upload de arquivo.

Decisões da etapa 6:

- **A visibilidade é aplicada na consulta ao banco**, não na camada de cima:
  rascunho e publicação restrita não saem do Postgres para quem não tem direito.
  Filtro esquecido depois da consulta vira vazamento.
- **Endereço inexistente e endereço proibido respondem igual: 404.** Um 403
  confirmaria que existe um post interno naquele endereço.
- **A página responde 404 de verdade**, e não 200 com corpo vazio — senão um
  buscador indexaria o "não encontrado" como página válida. Descoberto testando
  a tela, depois de a API já estar correta.
- **Markdown com HTML desligado.** Marcação escrita dentro do post é escapada,
  não interpretada: não há caminho para script vindo do conteúdo, mesmo com uma
  conta de diretoria comprometida.
- **Publicar é ato separado de escrever.** A publicação nasce rascunho, e
  corrigir uma vírgula não tira a notícia do ar. Republicar preserva a data
  original, para o feed não se reordenar a cada ajuste de texto.
- **O endereço não muda quando o título é corrigido**, para link já
  compartilhado continuar valendo. Título repetido ganha sufixo numérico.

Decisões da etapa 5:

- **A diretoria cria o acesso do praticante**, e a senha nasce aleatória: quem a
  define é o próprio praticante, pelo link. Assim a diretoria não passa a
  conhecer a senha de quem cadastra. Sem SMTP configurado, o link volta na tela
  para ser entregue à mão — sem isso, dojo sem servidor de e-mail não daria
  acesso a ninguém.
- **Dar baixa aceita a declaração pendente**, na mesma transação. Exigir um
  segundo clique para "aceitar o aviso" seria burocracia sem informação nova.
- **Recusar exige motivo escrito.** Um "não" sem explicação devolve o praticante
  ao ponto de partida sem saber o que fazer.
- **Uma declaração pendente por cobrança**, garantido por índice parcial: clicar
  duas vezes em "já paguei" não pode encher a fila da diretoria com avisos
  repetidos da mesma cobrança.
- **Declarar é do dono da cobrança; recusar é da diretoria.** Nem a diretoria
  declara pelo praticante — ela dá baixa, que é o ato dela.

Decisões da etapa 4:

- **A isenção tem abrangência**: cobre a mensalidade, os aluguéis, ou tudo
  (padrão). "Gratuidade" significa coisas diferentes em clubes diferentes, e sem
  esse campo a escolha ficaria implícita no código em vez de ser da diretoria.
  A linha isenta aparece zerada e com o motivo escrito, em vez de sumir — assim
  a cobrança explica a si mesma. Duas isenções somam abrangências.
- **A cobrança gerada pode ser recalculada individualmente.** A geração é um
  retrato do mês: isenção concedida ou aluguel registrado depois não mudam
  sozinhos o que já foi emitido. Sem recálculo, a saída seria corrigir no banco à
  mão — que é como clube pequeno perde o controle do próprio histórico.
  Cobrança **paga** não recalcula nem cancela (estorne antes), e **cancelada**
  não recalcula (reabra antes). Cancelamento e reabertura carimbam a observação
  com quem fez e quando.
- **Geração e recálculo usam o mesmo cálculo.** Se fossem dois, um dia
  discordariam — e a diferença apareceria como centavos inexplicáveis.
- **Gerar o mês é idempotente.** Rodar de novo não duplica: a unicidade
  `(praticanteId, competencia)` está no banco e as existentes são contadas e
  puladas. "Gerar" é o botão que alguém vai clicar duas vezes.
- **Somas em centavos.** `0.1 + 0.2` em ponto flutuante dá `0.30000000000000004`;
  com uma mensalidade e três aluguéis, a diferença aparece no total que o
  praticante confere.
- **Estorno não apaga, carimba.** Estornar uma baixa devolve a cobrança para
  aberta e registra na observação quem estornou e quando. Cobrança paga não some
  em silêncio.
- **O resumo da geração volta na URL** para a tela dizer o que aconteceu depois
  do redirecionamento. Clicar em "gerar" e não ver retorno é o silêncio que faz
  a pessoa clicar de novo.

Decisões da etapa 3:

- **O item é opcional no aluguel.** Nem todo dojo controla patrimônio, e bogu é
  um conjunto de peças que muitas vezes se aluga separado — kote hoje, men mês
  que vem. Quem só quer somar a taxa na mensalidade registra a descrição livre
  ("Kote") e nunca cadastra item nenhum; quem controla vincula o item e ganha o
  "quem está com o quê" por cima do mesmo registro.
  *Por que não um modo simples com um `alugaBogu` booleano:* o booleano não
  guarda desde quando, apaga o histórico quando desmarcado e não comporta valores
  diferentes por peça — os mesmos três motivos que fizeram filiação e isenção
  virarem períodos. E dois modos seriam dois caminhos de cobrança para manter.
- **O aluguel nasce também da ficha do praticante**, não só da página do item —
  que não existe para quem não cadastra itens.
- **`ALUGADO` saiu da situação do item.** O enum previsto misturava estado
  administrativo (manutenção, baixado) com estado derivado (alugado), que é
  exatamente o erro corrigido no praticante. "Alugado" é consequência de existir
  aluguel em aberto, e um índice parcial garante um único aberto por item.
- **Praticante desligado não aluga.** A partir da etapa 4 o aluguel vira linha de
  cobrança; permitir geraria mensalidade para quem não é mais do clube.
- **A ficha do praticante avisa quais itens do clube estão com ele**, que é o que
  a diretoria precisa ver antes de desligar alguém.
- **Valores entram no formato brasileiro.** "120,50", "1.234,56" e "120.50" são
  aceitos; o que não dá para entender é recusado, em vez de virar um número que
  ninguém quis.

Decisões da etapa 2:

- **Duas regras vivem no banco, não só na tela**, por índices parciais escritos à
  mão na migration: no máximo uma filiação aberta por praticante, e documento
  único apenas quando é do próprio. O Prisma não expressa índice parcial, então a
  tradução do erro de violação casa pelo **nome do índice** — a mensagem do
  Postgres vem no idioma do servidor, e `meta.target` chega vazio nesse caso.
- **Formulário longo envia por JavaScript quando ele existe**, para que um erro
  de validação não apague o que foi digitado; sem JavaScript, o `method="post"`
  continua valendo e o servidor responde com redirecionamento. Os endpoints
  devolvem JSON ou redirecionam conforme o cabeçalho `accept`.
- **Datas de calendário são gravadas como meia-noite UTC.** No horário de
  Brasília, gravar e reexibir uma data local mostraria o dia anterior — e data de
  nascimento e de filiação são dias, não instantes.
- **Consentimento registrado não é reescrito** ao salvar de novo: a data guardada
  é a do primeiro aceite.
- **Desvincular modalidade não apaga graduações.** O histórico de exames é do
  praticante e não some porque ele parou de treinar aquela modalidade.

Decisões da etapa 1, registradas para não serem desfeitas por engano:

- **Formulários nativos com `method="post"`.** Entrar, sair e redefinir senha são
  formulários HTML de verdade: funcionam antes da hidratação e sem JavaScript. É
  o que neutraliza o aviso GHSA-gj2h-2fpw-fhv9 do Nuxt UI 3.
- **Sair é POST.** Como link GET, bastaria uma imagem em outro site para derrubar
  a sessão de quem passasse por lá.
- **Cookie `HttpOnly` e `SameSite=Lax`.** O navegador não envia o cookie em POST
  vindo de outro domínio, o que já barra CSRF nos formulários deste projeto.
- **Mesma mensagem para e-mail inexistente e senha errada**, com verificação
  contra um hash descartável quando o e-mail não existe — sem isso, o tempo de
  resposta entregaria quem tem cadastro no clube.
- **Cinco tentativas por conta e endereço**, em janela de quinze minutos que
  reinicia a cada falha. Em memória, porque o modelo é uma instância por clube.
- **Senha em scrypt** (N=16384, r=8, p=1), com os parâmetros dentro do próprio
  hash, para permitir aumentar o custo no futuro sem invalidar os existentes.
- **Token de redefinição guardado só como hash**, uso único, uma hora de
  validade; os pendentes do mesmo usuário caem quando um é usado.

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
- **Observações médicas são dado sensível** (LGPD, art. 5º, II — dados de saúde),
  não apenas dado pessoal. Tratamento: consentimento próprio e destacado
  (`consentimentoSaudeEm`), visível somente para a diretoria, **nunca em listagem
  nem em exportação**, e sempre acompanhado do contato de emergência, que é o que
  serve na hora do problema.
  *Decisão de não cifrar em repouso:* num sistema mantido por voluntário, a chave
  se perde, e o dado se perde junto — o risco real vira indisponibilidade. A
  proteção fica no acesso ao banco e na restrição por papel.
- **CPF pede cuidado redobrado**: validar os dígitos verificadores, guardar só os
  números, índice único, e não exibir em listagem — número de CPF em tela aberta
  é material de fraude.
- **Autorização de uso de imagem** (`autorizacaoImagemEm`) existe porque o
  newsfeed publica foto de treino e campeonato, boa parte com menores. Sem esse
  registro, cada publicação é uma aposta.
- **Praticante com histórico financeiro não se apaga, se anonimiza.** Excluir a
  pessoa apagaria mensalidades pagas, que são registro contábil do clube. O
  atendimento ao pedido de exclusão remove os dados pessoais e preserva os
  lançamentos.
- **Envio de e-mail.** É a única dependência externa do MVP. Clube sem SMTP precisa
  de um plano B: a diretoria gera um link de redefinição direto no painel.
- **Dinheiro pede trilha.** Toda baixa registra quem deu e quando; sem exclusão
  silenciosa de cobrança paga.
- **Sessão em cookie** com `Secure`, `HttpOnly` e `SameSite`; HTTPS obrigatório em
  produção.
- **Sessão aberta não é revogável.** O cookie é selado e não tem registro no
  servidor, então trocar a senha não derruba uma sessão já ativa em outro
  aparelho — ela cai quando expira, em sete dias. Encerrar todas exigiria guardar
  sessão no banco; fica para quando houver motivo concreto.
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
