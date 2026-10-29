# Supabase local (desenvolvimento e testes)

Servidor que imita a parte do Supabase que o CashControl usa, rodando as **mesmas migrations** de `supabase/migrations` num PostgreSQL embutido ([PGlite](https://pglite.dev)). Não precisa de Docker nem de conta no Supabase. **Não é usado em produção.**

```bash
npm run dev:local        # Supabase local + Vite (http://localhost:5180)
npm run local-supabase   # só o servidor (http://127.0.0.1:54321)
```

- Dados ficam em `.local-supabase/data` (ignorado pelo Git). Para começar do zero, apague essa pasta com o servidor parado.
- E-mails (recuperação de senha, confirmação) não são enviados: aparecem no terminal e em http://127.0.0.1:54321/__dev/mailbox.
- Confirmação de e-mail fica desligada (como no `supabase start`). Para testar o fluxo com confirmação: `LOCAL_SUPABASE_CONFIRM_EMAIL=1 npm run dev:local`.
- O RLS vale aqui como no Supabase: cada requisição roda com o papel `authenticated` e o `sub` do JWT.

## O que está implementado

| Área | Rotas |
| --- | --- |
| Auth | `signup`, `token` (password e refresh_token), `user` (GET/PUT), `logout`, `recover`, `verify` |
| REST | `GET/POST/PATCH/DELETE /rest/v1/<tabela>` com `select` de colunas, filtros `eq, neq, gt, gte, lt, lte, like, ilike, is, in`, `order`, `limit`, `offset`, `count=exact`, objeto único; `POST /rest/v1/rpc/<função>` |

Recursos aninhados no `select` (`select=*,tabela(*)`) não existem aqui de propósito: leituras com relações usam funções RPC (`shifts_between`, `shift_detail`), que funcionam igual no Supabase.

## Contas de teste locais

Usadas só neste servidor local (nunca em produção):

| Uso | E-mail | Senha |
| --- | --- | --- |
| Teste manual dos fluxos | `teste@cashcontrol.local` | `Teste12345` |
| Teste de recuperação de senha | `recupera@cashcontrol.local` | `Antiga12345` → `Nova12345` |
| Dados de demonstração (`npm run seed:local`) | `demo@cashcontrol.local` | `Demo12345` |
