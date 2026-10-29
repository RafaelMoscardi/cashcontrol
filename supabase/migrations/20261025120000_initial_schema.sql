-- =============================================================================
-- CashControl: esquema inicial (etapa 1)
--
-- Tabelas: profiles, vehicles, platforms, shifts, shift_earnings, expenses.
-- Regras:
--   * RLS em todas as tabelas: cada usuário só enxerga e altera o que é seu.
--   * Referências compostas (id, user_id): nem com o UUID de outra conta dá
--     para ligar uma jornada a um veículo ou plataforma de outro usuário.
--   * Restrições EXCLUDE impedem jornadas com horário sobreposto (por usuário)
--     ou hodômetro sobreposto (por veículo): a mesma corrida nunca conta duas vezes.
--   * O banco guarda fatos e a "foto" dos custos do veículo no dia da jornada.
--     As fórmulas ficam no app (src/domain), com testes.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- Utilidades ------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Perfis ----------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 80),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Dados do usuário além do Auth. Criado por gatilho no cadastro.';
comment on column public.profiles.onboarded_at is 'Quando o primeiro acesso (plataformas + veículo) foi concluído.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil assim que a conta nasce no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 80));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Veículos --------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  kind text not null check (kind in ('car', 'motorcycle')),
  powertrain text not null check (powertrain in ('combustion', 'hybrid', 'plugin_hybrid', 'electric')),

  -- Combustível (combustão, híbrido e híbrido plug-in). GNV usa m³ no lugar de litro.
  fuel_type text check (fuel_type in ('gasoline', 'ethanol', 'diesel', 'cng')),
  fuel_km_per_unit numeric(6, 2) check (fuel_km_per_unit > 0 and fuel_km_per_unit <= 200),
  fuel_price_per_unit numeric(7, 3) check (fuel_price_per_unit > 0 and fuel_price_per_unit <= 100),

  -- Eletricidade (elétrico e híbrido plug-in)
  electric_km_per_kwh numeric(5, 2) check (electric_km_per_kwh > 0 and electric_km_per_kwh <= 50),
  electricity_price_per_kwh numeric(6, 3) check (electricity_price_per_kwh >= 0 and electricity_price_per_kwh <= 20),
  electric_share_pct numeric(5, 2) check (electric_share_pct >= 0 and electric_share_pct <= 100),

  -- Reservas por km (entram no resultado operacional; manutenções pagas saem delas)
  maintenance_per_km numeric(7, 4) not null default 0 check (maintenance_per_km >= 0 and maintenance_per_km <= 10),
  tires_per_km numeric(7, 4) not null default 0 check (tires_per_km >= 0 and tires_per_km <= 10),
  depreciation_per_km numeric(7, 4) not null default 0 check (depreciation_per_km >= 0 and depreciation_per_km <= 10),

  -- Custos fixos (rateados por dia no resultado operacional)
  ownership text not null default 'owned' check (ownership in ('owned', 'financed', 'rented', 'other')),
  rent_amount numeric(10, 2) not null default 0 check (rent_amount >= 0 and rent_amount <= 100000),
  rent_period text not null default 'week' check (rent_period in ('week', 'month')),
  insurance_monthly numeric(10, 2) not null default 0 check (insurance_monthly >= 0 and insurance_monthly <= 100000),
  taxes_yearly numeric(10, 2) not null default 0 check (taxes_yearly >= 0 and taxes_yearly <= 1000000),
  other_fixed_monthly numeric(10, 2) not null default 0 check (other_fixed_monthly >= 0 and other_fixed_monthly <= 100000),
  -- Parcela: só fluxo de caixa (a depreciação já representa o desgaste do veículo)
  financing_monthly numeric(10, 2) not null default 0 check (financing_monthly >= 0 and financing_monthly <= 100000),
  fixed_costs_start date not null default current_date,

  model text check (model is null or char_length(model) <= 60),
  plate text check (plate is null or char_length(plate) <= 10),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),

  -- Cada motorização exige exatamente a configuração de energia que usa
  constraint vehicles_energy_config check (
    case powertrain
      when 'electric' then
        electric_km_per_kwh is not null and electricity_price_per_kwh is not null
        and fuel_type is null and fuel_km_per_unit is null and fuel_price_per_unit is null
        and electric_share_pct is null
      when 'plugin_hybrid' then
        fuel_type is not null and fuel_km_per_unit is not null and fuel_price_per_unit is not null
        and electric_km_per_kwh is not null and electricity_price_per_kwh is not null
        and electric_share_pct is not null
      else
        fuel_type is not null and fuel_km_per_unit is not null and fuel_price_per_unit is not null
        and electric_km_per_kwh is null and electricity_price_per_kwh is null
        and electric_share_pct is null
    end
  ),
  constraint vehicles_motorcycle_powertrain check (kind = 'car' or powertrain in ('combustion', 'electric')),
  constraint vehicles_rent_only_rented check (ownership = 'rented' or rent_amount = 0),
  constraint vehicles_financing_only_financed check (ownership = 'financed' or financing_monthly = 0),
  constraint vehicles_rented_no_depreciation check (ownership <> 'rented' or depreciation_per_km = 0)
);

comment on table public.vehicles is 'Veículos do usuário com a configuração de custos vigente.';
comment on column public.vehicles.fuel_km_per_unit is 'km por litro (ou por m³ no GNV).';
comment on column public.vehicles.electric_share_pct is 'Híbrido plug-in: % dos km rodados no modo elétrico.';
comment on column public.vehicles.fixed_costs_start is 'A partir desta data os custos fixos entram no rateio diário.';

create index vehicles_user_idx on public.vehicles (user_id);

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- Plataformas -----------------------------------------------------------------

create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 30),
  kind text not null default 'rides' check (kind in ('rides', 'delivery', 'mototaxi', 'private', 'other')),
  color text not null default '#8b5cf6' check (color ~ '^#[0-9a-f]{6}$'),
  sort_order smallint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

comment on table public.platforms is 'Plataformas de trabalho (Uber, 99, iFood…). Arquivar em vez de apagar.';

create unique index platforms_user_name_active_key
  on public.platforms (user_id, lower(name))
  where archived_at is null;

-- Jornadas --------------------------------------------------------------------

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id uuid not null,
  work_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  odometer_start numeric(9, 1) not null check (odometer_start >= 0),
  odometer_end numeric(9, 1) not null check (odometer_end >= 0),

  -- Foto dos custos do veículo no momento do registro (R$/km)
  energy_cost_per_km numeric(10, 5) not null check (energy_cost_per_km >= 0 and energy_cost_per_km <= 50),
  maintenance_per_km numeric(7, 4) not null default 0 check (maintenance_per_km >= 0 and maintenance_per_km <= 10),
  tires_per_km numeric(7, 4) not null default 0 check (tires_per_km >= 0 and tires_per_km <= 10),
  depreciation_per_km numeric(7, 4) not null default 0 check (depreciation_per_km >= 0 and depreciation_per_km <= 10),
  cost_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(cost_snapshot) = 'object'),

  notes text check (notes is null or char_length(notes) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),
  foreign key (vehicle_id, user_id) references public.vehicles (id, user_id) on delete restrict,

  constraint shifts_time_order check (ended_at > started_at),
  constraint shifts_max_duration check (ended_at - started_at <= interval '24 hours'),
  constraint shifts_break_fits check (break_minutes * interval '1 minute' < ended_at - started_at),
  constraint shifts_odometer_order check (odometer_end >= odometer_start),
  constraint shifts_distance_limit check (odometer_end - odometer_start <= 2000),
  constraint shifts_no_time_overlap
    exclude using gist (user_id with =, tstzrange(started_at, ended_at) with &&),
  constraint shifts_no_odometer_overlap
    exclude using gist (vehicle_id with =, numrange(odometer_start, odometer_end) with &&)
);

comment on table public.shifts is 'Jornadas de trabalho. work_date é o dia local em que a jornada começou.';
comment on column public.shifts.energy_cost_per_km is 'R$/km de combustível ou energia vigente no dia (foto).';
comment on column public.shifts.cost_snapshot is 'Parâmetros usados na foto: preço, consumo, motorização…';

create index shifts_user_date_idx on public.shifts (user_id, work_date desc);
create index shifts_vehicle_end_idx on public.shifts (vehicle_id, ended_at desc);

create trigger shifts_set_updated_at
  before update on public.shifts
  for each row execute function public.set_updated_at();

-- Ganhos por plataforma em cada jornada ---------------------------------------

create table public.shift_earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shift_id uuid not null,
  platform_id uuid not null,
  -- Valor que a plataforma pagou, já sem a taxa dela. A taxa nunca é lançada como despesa.
  amount numeric(10, 2) not null check (amount >= 0 and amount <= 100000),
  tips numeric(10, 2) not null default 0 check (tips >= 0 and tips <= 100000),
  bonus numeric(10, 2) not null default 0 check (bonus >= 0 and bonus <= 100000),
  trips integer check (trips is null or (trips >= 0 and trips <= 500)),
  position smallint not null default 0,
  created_at timestamptz not null default now(),

  foreign key (shift_id, user_id) references public.shifts (id, user_id) on delete cascade,
  foreign key (platform_id, user_id) references public.platforms (id, user_id) on delete restrict,
  -- Uma linha por plataforma por jornada: o mesmo ganho não entra duas vezes
  unique (shift_id, platform_id)
);

comment on column public.shift_earnings.amount is 'Líquido recebido da plataforma (já descontada a taxa da plataforma).';

create index shift_earnings_platform_idx on public.shift_earnings (platform_id);

-- Despesas --------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shift_id uuid,
  vehicle_id uuid,
  spent_on date not null,
  category text not null check (
    category in ('fuel', 'maintenance', 'toll', 'parking', 'food', 'wash', 'phone', 'fees', 'fine', 'other')
  ),
  amount numeric(10, 2) not null check (amount > 0 and amount <= 100000),
  description text check (description is null or char_length(description) <= 80),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (shift_id, user_id) references public.shifts (id, user_id) on delete cascade,
  foreign key (vehicle_id, user_id) references public.vehicles (id, user_id) on delete set null (vehicle_id)
);

comment on table public.expenses is
  'Despesas pagas. fuel e maintenance só entram no fluxo de caixa: no resultado operacional '
  'são cobertas pela estimativa de energia e pelas reservas por km.';

create index expenses_user_date_idx on public.expenses (user_id, spent_on desc);
create index expenses_shift_idx on public.expenses (shift_id) where shift_id is not null;

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- Despesa lançada numa jornada herda a data e o veículo da jornada.
create or replace function public.expenses_sync_with_shift()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_shift record;
begin
  if new.shift_id is not null then
    select s.work_date, s.vehicle_id into v_shift
    from public.shifts s
    where s.id = new.shift_id;

    if found then
      new.spent_on := v_shift.work_date;
      new.vehicle_id := v_shift.vehicle_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger expenses_sync_with_shift
  before insert or update on public.expenses
  for each row execute function public.expenses_sync_with_shift();

create or replace function public.shifts_propagate_to_expenses()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.expenses
  set spent_on = new.work_date, vehicle_id = new.vehicle_id
  where shift_id = new.id;
  return null;
end;
$$;

create trigger shifts_propagate_to_expenses
  after update of work_date, vehicle_id on public.shifts
  for each row
  when (old.work_date is distinct from new.work_date or old.vehicle_id is distinct from new.vehicle_id)
  execute function public.shifts_propagate_to_expenses();

-- Row Level Security ----------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.platforms enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_earnings enable row level security;
alter table public.expenses enable row level security;

create policy "profiles: dono lê" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: dono altera" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "vehicles: dono lê" on public.vehicles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "vehicles: dono cria" on public.vehicles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "vehicles: dono altera" on public.vehicles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "vehicles: dono apaga" on public.vehicles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "platforms: dono lê" on public.platforms
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "platforms: dono cria" on public.platforms
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "platforms: dono altera" on public.platforms
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "platforms: dono apaga" on public.platforms
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "shifts: dono lê" on public.shifts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "shifts: dono cria" on public.shifts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "shifts: dono altera" on public.shifts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "shifts: dono apaga" on public.shifts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "shift_earnings: dono lê" on public.shift_earnings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "shift_earnings: dono cria" on public.shift_earnings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "shift_earnings: dono altera" on public.shift_earnings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "shift_earnings: dono apaga" on public.shift_earnings
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "expenses: dono lê" on public.expenses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "expenses: dono cria" on public.expenses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "expenses: dono altera" on public.expenses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "expenses: dono apaga" on public.expenses
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Privilégios: anônimo não acessa nada; o perfil é criado só pelo gatilho.
revoke all on table
  public.profiles, public.vehicles, public.platforms, public.shifts, public.shift_earnings, public.expenses
  from anon;
grant select, update on table public.profiles to authenticated;
revoke insert, delete, truncate on table public.profiles from authenticated;
grant select, insert, update, delete on table
  public.vehicles, public.platforms, public.shifts, public.shift_earnings, public.expenses
  to authenticated;

-- Gravação atômica da jornada -------------------------------------------------
-- Insere (sem id) ou atualiza (com id) a jornada e substitui ganhos e despesas
-- na mesma transação. security invoker: o RLS continua valendo.

create or replace function public.save_shift(
  p_shift jsonb,
  p_earnings jsonb default '[]'::jsonb,
  p_expenses jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_shift ->> 'id', '')::uuid;
begin
  if jsonb_typeof(p_shift) is distinct from 'object'
    or jsonb_typeof(p_earnings) is distinct from 'array'
    or jsonb_typeof(p_expenses) is distinct from 'array' then
    raise exception 'Formato inválido: jornada deve ser objeto; ganhos e despesas, listas.'
      using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.shifts (
      vehicle_id, work_date, started_at, ended_at, break_minutes,
      odometer_start, odometer_end,
      energy_cost_per_km, maintenance_per_km, tires_per_km, depreciation_per_km,
      cost_snapshot, notes
    )
    values (
      (p_shift ->> 'vehicle_id')::uuid,
      (p_shift ->> 'work_date')::date,
      (p_shift ->> 'started_at')::timestamptz,
      (p_shift ->> 'ended_at')::timestamptz,
      coalesce((p_shift ->> 'break_minutes')::integer, 0),
      (p_shift ->> 'odometer_start')::numeric,
      (p_shift ->> 'odometer_end')::numeric,
      (p_shift ->> 'energy_cost_per_km')::numeric,
      coalesce((p_shift ->> 'maintenance_per_km')::numeric, 0),
      coalesce((p_shift ->> 'tires_per_km')::numeric, 0),
      coalesce((p_shift ->> 'depreciation_per_km')::numeric, 0),
      coalesce(p_shift -> 'cost_snapshot', '{}'::jsonb),
      nullif(trim(p_shift ->> 'notes'), '')
    )
    returning id into v_id;
  else
    update public.shifts set
      vehicle_id = (p_shift ->> 'vehicle_id')::uuid,
      work_date = (p_shift ->> 'work_date')::date,
      started_at = (p_shift ->> 'started_at')::timestamptz,
      ended_at = (p_shift ->> 'ended_at')::timestamptz,
      break_minutes = coalesce((p_shift ->> 'break_minutes')::integer, 0),
      odometer_start = (p_shift ->> 'odometer_start')::numeric,
      odometer_end = (p_shift ->> 'odometer_end')::numeric,
      energy_cost_per_km = (p_shift ->> 'energy_cost_per_km')::numeric,
      maintenance_per_km = coalesce((p_shift ->> 'maintenance_per_km')::numeric, 0),
      tires_per_km = coalesce((p_shift ->> 'tires_per_km')::numeric, 0),
      depreciation_per_km = coalesce((p_shift ->> 'depreciation_per_km')::numeric, 0),
      cost_snapshot = coalesce(p_shift -> 'cost_snapshot', '{}'::jsonb),
      notes = nullif(trim(p_shift ->> 'notes'), '')
    where id = v_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Jornada não encontrada.' using errcode = 'P0002';
    end if;

    delete from public.shift_earnings where shift_id = v_id;
    delete from public.expenses where shift_id = v_id;
  end if;

  insert into public.shift_earnings (shift_id, platform_id, amount, tips, bonus, trips, position)
  select
    v_id,
    (e ->> 'platform_id')::uuid,
    (e ->> 'amount')::numeric,
    coalesce((e ->> 'tips')::numeric, 0),
    coalesce((e ->> 'bonus')::numeric, 0),
    (e ->> 'trips')::integer,
    n - 1
  from jsonb_array_elements(p_earnings) with ordinality as t (e, n);

  insert into public.expenses (shift_id, spent_on, category, amount, description, position)
  select
    v_id,
    (p_shift ->> 'work_date')::date,
    x ->> 'category',
    (x ->> 'amount')::numeric,
    nullif(trim(x ->> 'description'), ''),
    n - 1
  from jsonb_array_elements(p_expenses) with ordinality as t (x, n);

  return v_id;
end;
$$;

comment on function public.save_shift(jsonb, jsonb, jsonb) is
  'Grava a jornada com ganhos e despesas numa transação. Sem id insere; com id substitui.';

-- Leitura: jornadas de um intervalo com ganhos e despesas aninhados -----------

create or replace function public.shifts_between(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      to_jsonb(s) || jsonb_build_object(
        'earnings', coalesce((
          select jsonb_agg(to_jsonb(e) order by e.position, e.created_at, e.id)
          from public.shift_earnings e
          where e.shift_id = s.id
        ), '[]'::jsonb),
        'expenses', coalesce((
          select jsonb_agg(to_jsonb(x) order by x.position, x.created_at, x.id)
          from public.expenses x
          where x.shift_id = s.id
        ), '[]'::jsonb)
      )
      order by s.started_at desc
    ),
    '[]'::jsonb
  )
  from public.shifts s
  where s.work_date between p_from and p_to;
$$;

create or replace function public.shift_detail(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select to_jsonb(s) || jsonb_build_object(
    'earnings', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.position, e.created_at, e.id)
      from public.shift_earnings e
      where e.shift_id = s.id
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.position, x.created_at, x.id)
      from public.expenses x
      where x.shift_id = s.id
    ), '[]'::jsonb)
  )
  from public.shifts s
  where s.id = p_id;
$$;

revoke execute on function public.save_shift(jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.shifts_between(date, date) from public, anon;
revoke execute on function public.shift_detail(uuid) from public, anon;
grant execute on function public.save_shift(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.shifts_between(date, date) to authenticated;
grant execute on function public.shift_detail(uuid) to authenticated;
