-- Táxi como tipo de plataforma, ao lado de mototáxi. O tipo só organiza a lista
-- de plataformas: nenhum cálculo depende dele. A restrição nova aceita tudo o que
-- a antiga aceitava, então as linhas existentes continuam válidas.

alter table public.platforms drop constraint if exists platforms_kind_check;
alter table public.platforms
  add constraint platforms_kind_check check (kind in ('rides', 'delivery', 'taxi', 'mototaxi', 'private', 'other'));
