# Banco de dados (Supabase)

- `migrations/`: mudanças do banco, em ordem. O Supabase aplica sozinho as migrations novas quando o código chega à branch `main` do GitHub (**Project Settings → Integrations → GitHub**: Working directory `.`, **Deploy to production** ligado, branch `main`).
- `tests/`: testes do banco (RLS, restrições, `save_shift`) num PostgreSQL embutido. Rodam com `npm test`.

## Regras

1. Nunca edite uma migration que já foi aplicada em produção. Crie outra com data e hora no nome: `AAAAMMDDHHMMSS_descricao.sql`.
2. Toda tabela nova leva `enable row level security`, políticas com `(select auth.uid())` e `grant` explícito para `authenticated`. O projeto não expõe tabelas novas automaticamente.
3. Não rode no **SQL Editor** o que já está numa migration: a integração rodaria de novo e o deploy falharia.
4. Antes de enviar, rode `npm test`: as migrations são aplicadas do zero nos testes.
