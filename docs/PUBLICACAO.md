# CashControl: execução local e publicação

Tudo aqui é gratuito: Supabase (plano Free), Cloudflare Pages e GitHub.

## 1. Rodar no seu computador

Pré-requisitos: [Node.js 22.18 ou mais novo](https://nodejs.org) (você tem o 24) e Git.

```bash
cd cashcontrol
npm install
npm run dev:local
```

Abra http://localhost:5180. O `dev:local` sobe junto um **Supabase local** (as mesmas migrations rodando num PostgreSQL embutido), então dá para usar tudo sem criar conta no Supabase. Os dados ficam em `.local-supabase/` e os e-mails de recuperação de senha aparecem em http://127.0.0.1:54321/__dev/mailbox.

Para ver o painel cheio, com 3 semanas de jornadas de exemplo, rode em outro terminal (com o `dev:local` ligado):

```bash
npm run seed:local
```

O e-mail e a senha da conta de demonstração estão em [scripts/local-supabase/README.md](../scripts/local-supabase/README.md).

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev:local` | App + Supabase local (sem conta, sem Docker) |
| `npm run dev` | App apontando para o Supabase do `.env.local` |
| `npm run seed:local` | Conta de demonstração no Supabase local |
| `npm run check` | Tipos + lint + todos os testes |
| `npm test` | Testes (fórmulas, banco/RLS, servidor local) |
| `npm run build` | Build de produção em `dist/` (inclui o service worker do PWA) |
| `npm run preview` | Serve o build em http://localhost:4180 |
| `npm run icons` | Regera os ícones PNG a partir de `public/favicon.svg` |

## 2. Supabase (banco e login de verdade)

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo. Região: **South America (São Paulo)**. Guarde a senha do banco.
2. **Crie as tabelas.** No painel do projeto, abra **SQL Editor → New query**, cole todo o conteúdo de [`supabase/migrations/20261025120000_initial_schema.sql`](../supabase/migrations/20261025120000_initial_schema.sql) e clique em **Run**. Deve terminar sem erro.
   - Alternativa pela linha de comando: `npx supabase login`, `npx supabase link --project-ref SEU_REF` e `npx supabase db push`.
3. **Endereços do app.** Em **Authentication → URL Configuration**:
   - *Site URL*: o endereço publicado (ex.: `https://cashcontrol.pages.dev`). Antes de publicar, use `http://localhost:5180`.
   - *Redirect URLs*: adicione `http://localhost:5180/**` e, depois de publicar, `https://SEU-PROJETO.pages.dev/**`.
4. **E-mails.** O envio padrão do Supabase é só para testes (limite baixo por hora e, em projetos novos, apenas para e-mails da equipe do projeto). Para usuários reais:
   - configure um SMTP gratuito em **Authentication → Emails → SMTP Settings** (por exemplo Resend ou Brevo, que têm planos grátis);
   - em **Authentication → Sign In / Providers → Email**, decida se exige confirmação de e-mail. Com ela ligada, o app mostra a tela "Confirme seu e-mail" depois do cadastro;
   - opcional: traduza os modelos em **Authentication → Emails → Templates** ("Confirm signup" e "Reset password").
5. **Chaves.** Em **Project Settings → API Keys**, copie a *Project URL* e a *Publishable key* (`sb_publishable_…`; projetos antigos mostram a chave `anon`, que também funciona). Crie `cashcontrol/.env.local`:

   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Nunca use a chave secreta (`service_role` / `sb_secret_…`) no app.
6. Teste: `npm run dev`, abra http://localhost:5180, crie sua conta e registre uma jornada. No **Table Editor** do Supabase aparecem as linhas em `vehicles`, `shifts`, `shift_earnings`.

## 3. GitHub

O repositório Git já está iniciado na pasta `cashcontrol`. Para enviar ao GitHub:

1. Em [github.com/new](https://github.com/new), crie o repositório `cashcontrol` (pode ser privado), **sem** README nem .gitignore.
2. Na pasta do projeto:

   ```bash
   git add .
   git commit -m "Etapa 1: cadastro, veículos, jornadas e painel"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/cashcontrol.git
   git push -u origin main
   ```

A cada push, o GitHub Actions (`.github/workflows/ci.yml`) roda tipos, lint, testes e build.

## 4. Cloudflare Pages

1. Em [dash.cloudflare.com](https://dash.cloudflare.com): **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório `cashcontrol`. (Se a tela abrir em "Workers", troque para a aba **Pages**.)
2. Configuração do build:

   | Campo | Valor |
   | --- | --- |
   | Framework preset | React (Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | deixe vazio |

3. **Environment variables** (em Production e em Preview):

   | Nome | Valor |
   | --- | --- |
   | `VITE_SUPABASE_URL` | a Project URL do Supabase |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | a Publishable key |
   | `NODE_VERSION` | `22` |

4. **Save and Deploy.** Em 1 a 2 minutos o app fica em `https://cashcontrol.pages.dev` (ou o nome que a Cloudflare der).
5. Volte ao Supabase (passo 2.3) e coloque esse endereço em *Site URL* e em *Redirect URLs*.
6. Abra o endereço no celular e instale: Android/Chrome mostra "Instalar app"; no iPhone, Safari → Compartilhar → **Adicionar à Tela de Início**.

Depois disso, cada `git push` na branch `main` publica sozinho; outras branches geram endereços de pré-visualização.

**Detalhes já configurados no projeto:**
- `public/_headers`: cabeçalhos de segurança (CSP liberando só o próprio site e `*.supabase.co`) e cache (arquivos com hash por 1 ano; `sw.js` e `index.html` sempre revalidados, para atualizações do PWA chegarem logo). Se usar domínio próprio no Supabase, inclua-o no `connect-src`.
- Rotas internas (ex.: `/jornadas/nova`) funcionam ao recarregar: sem `404.html`, a Cloudflare Pages serve o `index.html` (modo SPA).
- `.node-version` fixa o Node 22 no build.

Publicar sem Git (opcional): `npx wrangler login` e `npx wrangler pages deploy dist --project-name cashcontrol` (gere o `dist` com as variáveis do Supabase no `.env.local`).

## Roteiro de teste da etapa 1

Com `npm run dev:local` (ou já publicado):

1. **Cadastro e login.** Crie uma conta → cai no primeiro acesso. Envie o formulário vazio: as mensagens aparecem em português.
2. **Primeiro acesso.** Escolha Uber, 99 e iFood → Continuar → cadastre o veículo: 12 km/l, R$ 6,00/l, manutenção R$ 0,10/km, alugado por R$ 2.400 por mês. O formulário mostra R$ 0,50/km de energia e R$ 2.400/mês de fixos.
3. **Painel vazio.** "Mês" mostra o aluguel proporcional aos dias já decorridos (25 de outubro → −R$ 1.935,48).
4. **Jornada.** Registrar: 08:00–18:00, pausa de 60 min, km 45.000 → 45.120, Uber R$ 300,00, despesa "Combustível / recarga" de R$ 100,00. A prévia mostra 9 h, combustível R$ 60,00 (10 l), reservas R$ 12,00, lucro **R$ 228,00**, R$ 25,33/h, custo R$ 0,60/km e caixa +R$ 200,00. Salve: o histórico mostra os mesmos valores.
5. **Sobreposição.** Tente outra jornada das 17:00 às 20:00 no mesmo dia: o app recusa ("Já existe uma jornada nesse horário"). O km inicial já vem preenchido com 45.120.
6. **Foto dos custos.** Mude o preço do combustível do veículo para R$ 6,49. A jornada antiga continua com lucro de R$ 228,00.
7. **Painel.** "Hoje": lucro real = R$ 228,00 − 1 dia de aluguel. O fluxo de caixa mostra o abastecimento de R$ 100; o resultado operacional, não.
8. **Recuperar senha.** Saia → "Esqueci minha senha" → abra o link na caixa de e-mails local → defina a nova senha → entre com ela. Abrir o mesmo link de novo mostra "Link inválido".
9. **Celular.** No tamanho de celular não há rolagem horizontal; a barra inferior respeita a área do gesto do iPhone; no desktop aparece a barra lateral.
