-- Marca do veículo, escolhida no catálogo da Tabela FIPE do app (ou digitada).
-- O modelo continua em vehicles.model. Os grants de vehicles são por tabela,
-- então authenticated já lê e grava a coluna nova; anon segue sem acesso.

alter table public.vehicles add column if not exists brand text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicles_brand_length' and conrelid = 'public.vehicles'::regclass
  ) then
    alter table public.vehicles
      add constraint vehicles_brand_length check (brand is null or char_length(trim(brand)) between 1 and 40);
  end if;
end $$;
