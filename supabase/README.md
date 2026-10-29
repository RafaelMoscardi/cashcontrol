# Banco de dados (Supabase)

- `migrations/`: mudanças do banco, em ordem. O Supabase aplica sozinho as migrations novas quando o código chega à branch `main` do GitHub (**Project Settings → Integrations → GitHub**: Working directory `.`, **Deploy to production** ligado, branch `main`).
- `tests/`: testes do banco (RLS, restrições, `save_shift`) num PostgreSQL embutido. Rodam com `npm test`.

## Regras

1. Nunca edite uma migration que já foi aplicada em produção. Crie outra com data e hora no nome: `AAAAMMDDHHMMSS_descricao.sql`.
2. Toda tabela nova leva `enable row level security`, políticas com `(select auth.uid())` e `grant` explícito para `authenticated`. O projeto não expõe tabelas novas automaticamente.
3. Não rode no **SQL Editor** o que já está numa migration: a integração rodaria de novo e o deploy falharia.
4. Antes de enviar, rode `npm test`: as migrations são aplicadas do zero nos testes.

## Aplicar pelo SQL Editor (caminho manual)

Se a integração não aplicar uma migration (foi o caso da primeira, em 29/10/2026), rode no **SQL Editor** o conteúdo da migration **seguido** do registro no histórico, trocando versão e nome. Assim a integração não a aplica de novo:

```sql
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;
insert into supabase_migrations.schema_migrations (version, name)
values ('20261025120000', 'initial_schema')
on conflict (version) do nothing;
```
