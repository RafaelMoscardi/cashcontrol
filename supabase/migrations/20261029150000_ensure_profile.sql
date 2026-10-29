-- Perfil que some do banco (linha apagada à mão no painel) não trava mais o app: quando a busca do
-- perfil não acha nada, o app chama ensure_profile e a conta recomeça pelo primeiro acesso, como nova.
-- Para zerar uma conta de vez, o caminho continua sendo apagar o usuário em Authentication → Users,
-- que leva junto todos os dados dele.

create or replace function public.ensure_profile()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.profiles (id, full_name)
  select u.id, left(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 80)
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;
$$;

revoke execute on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

-- Contas que já estão sem perfil voltam ao primeiro acesso
insert into public.profiles (id, full_name)
select u.id, left(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 80)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
