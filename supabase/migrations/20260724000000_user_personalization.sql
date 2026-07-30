-- Create a personal profile for every authenticated user.

begin;

alter table public.user_profiles
  add column if not exists display_name text;

update public.user_profiles
set display_name = name
where display_name is null
  and name is not null;

insert into public.user_profiles (id, display_name, preferences)
select auth_user.id, null, '{}'::jsonb
from auth.users auth_user
on conflict (id) do nothing;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name, preferences)
  values (new.id, null, '{}'::jsonb)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row
  execute function public.create_profile_for_new_user();

commit;
