create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  tokens_input integer not null default 0 check (tokens_input >= 0),
  tokens_output integer not null default 0 check (tokens_output >= 0),
  model text not null check (char_length(model) between 1 and 160),
  endpoint text not null check (char_length(endpoint) between 1 and 200)
);

create index if not exists api_usage_user_created_at_idx
  on public.api_usage (user_id, created_at desc);

alter table public.api_usage enable row level security;

drop policy if exists "Users can read own API usage" on public.api_usage;
create policy "Users can read own API usage"
  on public.api_usage
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own API usage" on public.api_usage;
create policy "Users can insert own API usage"
  on public.api_usage
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.get_my_daily_api_usage()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(tokens_input::bigint + tokens_output::bigint), 0)
  from public.api_usage
  where user_id = (select auth.uid())
    and created_at >= (
      date_trunc('day', now() at time zone 'Europe/Warsaw')
      at time zone 'Europe/Warsaw'
    )
    and created_at < (
      (
        date_trunc('day', now() at time zone 'Europe/Warsaw')
        + interval '1 day'
      ) at time zone 'Europe/Warsaw'
    );
$$;

revoke all on function public.get_my_daily_api_usage() from public;
grant execute on function public.get_my_daily_api_usage() to authenticated;

revoke all on table public.api_usage from anon;
grant select, insert on table public.api_usage to authenticated;
