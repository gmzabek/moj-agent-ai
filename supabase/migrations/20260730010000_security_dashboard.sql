create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  message_length integer not null default 0 check (message_length >= 0),
  message_excerpt text not null default '',
  blocked boolean not null default false,
  block_reason text,
  stage text not null default 'input'
    check (stage in ('input', 'output', 'rate_limit')),
  endpoint text not null default '/api/chat'
    check (char_length(endpoint) between 1 and 200)
);

create index if not exists message_logs_user_created_at_idx
  on public.message_logs (user_id, created_at desc);

create index if not exists message_logs_blocked_created_at_idx
  on public.message_logs (blocked, created_at desc);

alter table public.message_logs enable row level security;

drop policy if exists "Users can read own message logs" on public.message_logs;
create policy "Users can read own message logs"
  on public.message_logs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own message logs" on public.message_logs;
create policy "Users can insert own message logs"
  on public.message_logs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.message_logs from anon;
grant select, insert on table public.message_logs to authenticated;

create or replace function public.security_usage_by_user()
returns table (
  user_id uuid,
  tokens_today bigint,
  tokens_week bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (
        date_trunc('day', now() at time zone 'Europe/Warsaw')
        at time zone 'Europe/Warsaw'
      ) as day_start,
      (
        date_trunc('week', now() at time zone 'Europe/Warsaw')
        at time zone 'Europe/Warsaw'
      ) as week_start
  )
  select
    usage.user_id,
    coalesce(
      sum(usage.tokens_input::bigint + usage.tokens_output::bigint)
        filter (where usage.created_at >= bounds.day_start),
      0
    ) as tokens_today,
    coalesce(
      sum(usage.tokens_input::bigint + usage.tokens_output::bigint),
      0
    ) as tokens_week
  from public.api_usage as usage
  cross join bounds
  where usage.created_at >= bounds.week_start
  group by usage.user_id
  order by tokens_week desc
  limit 5;
$$;

create or replace function public.security_dashboard_stats()
returns table (
  tokens_today bigint,
  tokens_week bigint,
  blocked_messages bigint,
  average_tokens_per_user numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (
        date_trunc('day', now() at time zone 'Europe/Warsaw')
        at time zone 'Europe/Warsaw'
      ) as day_start,
      (
        date_trunc('week', now() at time zone 'Europe/Warsaw')
        at time zone 'Europe/Warsaw'
      ) as week_start
  ),
  usage_stats as (
    select
      coalesce(
        sum(tokens_input::bigint + tokens_output::bigint)
          filter (where created_at >= bounds.day_start),
        0
      ) as tokens_today,
      coalesce(sum(tokens_input::bigint + tokens_output::bigint), 0) as tokens_week,
      count(distinct user_id) as active_users
    from public.api_usage
    cross join bounds
    where created_at >= bounds.week_start
  )
  select
    usage_stats.tokens_today,
    usage_stats.tokens_week,
    (select count(*) from public.message_logs where blocked = true),
    case
      when usage_stats.active_users = 0 then 0
      else round(usage_stats.tokens_week::numeric / usage_stats.active_users, 1)
    end
  from usage_stats;
$$;

create or replace function public.security_high_frequency_users()
returns table (
  user_id uuid,
  messages_last_10_minutes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    logs.user_id,
    count(*) as messages_last_10_minutes
  from public.message_logs as logs
  where logs.stage = 'input'
    and logs.created_at >= now() - interval '10 minutes'
  group by logs.user_id
  having count(*) > 20
  order by messages_last_10_minutes desc;
$$;

revoke all on function public.security_usage_by_user() from public;
revoke all on function public.security_dashboard_stats() from public;
revoke all on function public.security_high_frequency_users() from public;

grant execute on function public.security_usage_by_user() to service_role;
grant execute on function public.security_dashboard_stats() to service_role;
grant execute on function public.security_high_frequency_users() to service_role;
