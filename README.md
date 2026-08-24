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
git clone <url-do-repositorio> kendoclub
cd kendoclub
npm install
cp .env.example .env   # preencha DATABASE_URL e NUXT_SESSION_PASSWORD
npm run db:migrate     # cria as tabelas
npm run dev
```

A aplicação sobe em <http://localhost:3000>.

Outros comandos: `npm run lint`, `npm run test`, `npm run build`,
`npm run db:studio` (navegador de dados do Prisma).

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
