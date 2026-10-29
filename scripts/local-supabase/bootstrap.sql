-- Ambiente mínimo parecido com o Supabase para rodar as migrations no PGlite.
-- Usado pelos testes do banco e pelo servidor local de desenvolvimento.
-- No Supabase de verdade isto já existe; este arquivo nunca vai para lá.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema if not exists extensions;
create schema if not exists auth;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  aud text not null default 'authenticated',
  role text not null default 'authenticated',
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb not null default '{"provider": "email", "providers": ["email"]}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mesma lógica do Supabase: lê o "sub" das claims do JWT da requisição
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.role', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    ),
    ''
  )::text
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

-- Só o servidor local usa: refresh tokens e links de e-mail (recuperação, confirmação)
create table auth.local_refresh_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table auth.local_email_links (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('signup', 'recovery')),
  email text not null,
  redirect_to text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Controle de migrations aplicadas (equivalente ao do Supabase CLI)
create schema if not exists supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);
