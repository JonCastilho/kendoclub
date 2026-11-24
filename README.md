# KendoClub

Sistema de gestão para clubes de kendo: cadastro de praticantes, mensalidades,
newsfeed e divulgação de eventos com confirmação de presença.

Software livre, feito para que qualquer clube consiga subir a própria instância e
ser dono dos próprios dados.

> **Status:** em desenvolvimento inicial. Ainda não há versão utilizável.
> O plano completo está em [PLANO.md](PLANO.md).

## Funcionalidades previstas

- **Praticantes** — cadastro, contato, responsável para menores de idade,
  histórico de graduações (kyu/dan) e situação (ativo, afastado, desligado).
- **Mensalidades** — geração das cobranças do mês, baixa manual pela diretoria,
  painel de inadimplência e, para o praticante, a chave Pix do clube.
- **Newsfeed** — publicações públicas (a cara do clube na internet) ou restritas
  a quem está logado.
- **Eventos e campeonatos** — divulgação, confirmação de presença e lista de
  confirmados para a diretoria.

## Tecnologia

Nuxt 3 (Vue 3 + TypeScript) com API no mesmo projeto, PostgreSQL via Prisma e
autenticação própria por e-mail e senha. Sem serviços externos obrigatórios além
de um servidor SMTP para redefinição de senha.

## Rodando localmente

Requisitos: **Node 20.19+** e um **PostgreSQL** acessível. Em produção, use uma
versão com suporte ativo (22 ou 24 LTS) — o Node 20 saiu de suporte em abril de
2026.

```bash
git clone https://github.com/JonCastilho/kendoclub.git
cd kendoclub
npm install
cp .env.example .env   # preencha DATABASE_URL e NUXT_SESSION_PASSWORD
npm run db:migrate     # cria as tabelas
npm run setup -- --email diretoria@seuclube.org --clube "Nome do Clube"
npm run dev
```

A aplicação sobe em <http://localhost:3000>.

O `setup` cria a conta inicial da diretoria, as modalidades de partida (Kendo e
Iaido, que podem ser renomeadas ou desativadas depois) e **mostra uma senha
sorteada uma única vez** — guarde-a nesse momento. Não existe senha padrão no código: se
existisse, toda instalação deste sistema nasceria com a mesma credencial, e ela
estaria publicada aqui.

Outros comandos: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run db:studio` (navegador de dados do Prisma).

Testes: `npm run test:unidade` cobre as regras de negócio e roda em segundos;
`npm run test:api` sobe a aplicação contra um banco de teste próprio e exercita
os endpoints; `npm test` roda os dois. O banco de teste e seu arquivo de
ambiente são criados sozinhos na primeira execução.

### Envio de e-mail

A redefinição de senha e o lembrete de mensalidade em atraso usam SMTP,
configurado em `.env`. **Sem SMTP configurado o sistema continua funcionando**: a
mensagem não sai e o texto é registrado no log do servidor, o que basta em
desenvolvimento. Os lembretes que não saíram não ficam marcados como enviados:
assim que o SMTP for configurado, a próxima execução os envia.

### Lembrete de mensalidade em atraso

Todo dia às 12h (horário do servidor) o sistema envia um e-mail a quem está com a
mensalidade em aberto há 15 e há 30 dias, e depois não avisa mais. O atraso conta
do vencimento do clube ou do dia de pagamento que a pessoa combinou na filiação,
o que for mais tarde. A diretoria pode disparar na hora pelo botão "Enviar
lembretes agora", na tela de mensalidades; é a mesma função, e repetir não reenvia
nada.

A tarefa roda dentro do próprio servidor, então **só dispara com o app no ar**:
hospedagem que hiberna o processo não a executa, e nesse caso o botão é o caminho.

### Imagens enviadas

As capas das notícias ficam em disco, na pasta apontada por `NUXT_UPLOAD_DIR`
(por padrão `./uploads`), e **não** no banco. Duas consequências para quem
hospeda:

- **O backup precisa incluir essa pasta**, não só o dump do PostgreSQL. Um
  backup só do banco restaura as notícias sem as imagens.
- **Hospedagem com disco efêmero** (contêiner que é recriado a cada implantação)
  perde as imagens. Nesses serviços, aponte `NUXT_UPLOAD_DIR` para um volume
  persistente.

A pasta não é servida como conteúdo estático: cada imagem passa pelo mesmo
controle de acesso da publicação a que pertence, para que a capa de uma notícia
interna não fique aberta na internet.

Os **comprovantes de pagamento** dos eventos ficam na subpasta `comprovantes`,
da mesma pasta, e são temporários: o arquivo é apagado quando a diretoria
aceita ou recusa o pagamento. Só o dono e a diretoria os abrem.

Todas as variáveis de ambiente estão documentadas em
[.env.example](.env.example).

## Licença

[AGPL-3.0-only](LICENSE).

Você pode usar, instalar e adaptar o sistema livremente. Se publicar uma versão
**modificada** para que outras pessoas a acessem pela rede, a AGPL exige que você
disponibilize o código-fonte dessa versão a esses usuários — na prática, basta
manter o link "código-fonte" do rodapé apontando para o seu repositório
(variável `NUXT_PUBLIC_SOURCE_URL`).

O nome e a identidade visual de cada clube **não** são cobertos por esta licença.
Quem instalar o sistema deve usar a própria identidade.

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md). Contribuições exigem `Signed-off-by`
(DCO) nos commits.
