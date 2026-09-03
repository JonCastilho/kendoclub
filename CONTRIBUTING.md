# Contribuindo com o KendoClub

Obrigado pelo interesse. Este projeto é mantido por voluntários de clubes de
kendo — a prioridade é manter o sistema **simples de entender e de manter**, mais
do que completo.

## Antes de escrever código

- Abra uma issue descrevendo o problema ou a ideia. Isso evita trabalho perdido,
  principalmente se o assunto estiver fora do escopo descrito no
  [PLANO.md](PLANO.md).
- Mudanças pequenas e focadas são revisadas rápido; PRs grandes tendem a
  encalhar.

## Certificado de origem (DCO)

Toda contribuição precisa ser assinada. Ao assinar, você declara que tem o
direito de submeter aquele código sob a licença do projeto (AGPL-3.0-only), nos
termos do [Developer Certificate of Origin](https://developercertificate.org/).

Assinar é acrescentar `-s` ao commit:

```bash
git commit -s -m "Corrige cálculo do vencimento da mensalidade"
```

Isso adiciona a linha `Signed-off-by: Seu Nome <seu@email>` à mensagem. Commits
sem essa linha não podem ser aceitos.

## Padrões

- Mensagens de commit em português, no imperativo, descrevendo o efeito da
  mudança.
- **Nomes do domínio em português, sem acentos** (`Praticante`, `Mensalidade`,
  `valorMensalidade`). Fica em inglês só o que o framework impõe — métodos do
  Prisma, pastas do Nuxt, composables `useX`. Termos de kendo (kyu, dan) ficam
  como são ditos.
- `npm run lint`, `npm run typecheck` e `npm run test` precisam passar antes de
  abrir o PR. O `typecheck` não é opcional: o ESLint aqui não acusa identificador
  não declarado (esse papel é do TypeScript), então pular a checagem deixa passar
  função usada sem importar — que só quebra quando alguém usa a tela.
- Auto-import: o Nuxt alcança `server/utils/` inteiro, mas dentro de `shared/`
  apenas `shared/utils/` e `shared/types/`. Arquivo na raiz de `shared/` exige
  import explícito.
- Regras de negócio sensíveis — geração de cobrança, baixa de pagamento,
  permissões e visibilidade de conteúdo — devem vir com teste.
- **Dois conjuntos de teste, com propósitos diferentes:**
  - `npm run test:unidade` roda em segundos e cobre as regras puras. É o que se
    usa enquanto se escreve código.
  - `npm run test:api` sobe a aplicação de verdade contra um **banco próprio**
    (o mesmo nome do seu, com sufixo `_teste`) e exercita os endpoints. Leva
    cerca de um minuto e meio, quase tudo esperando o servidor subir.
  - `npm test` roda os dois.

  O `.env.test` é criado sozinho na primeira execução, a partir do seu `.env`,
  trocando apenas o nome do banco. O preparo **se recusa a rodar** se o banco
  não terminar em `_teste`, e ainda confirma pelo próprio servidor que ele está
  falando com o banco certo antes de escrever qualquer coisa — passar
  `DATABASE_URL` pelo ambiente não vence o `.env`, e sem essa checagem um teste
  destrutivo apagaria dados reais.
- Endpoint novo pede teste em `test/api/`, nem que seja só o de permissão. Os
  quatro bugs mais sérios do projeto até hoje estavam nessa fronteira.
- Verificação de permissão sempre no servidor. Esconder um botão na interface não
  é controle de acesso.
- Nada de dado real de praticante em teste, fixture ou seed.

## Licença das contribuições

Ao contribuir, você concorda que seu código seja distribuído sob a
[AGPL-3.0-only](LICENSE).
