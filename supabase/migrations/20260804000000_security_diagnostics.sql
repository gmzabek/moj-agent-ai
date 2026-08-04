create or replace function public.security_violation_counts()
returns table (
  user_id uuid,
  violations_last_hour bigint,
  violations_last_24_hours bigint,
  violations_total bigint,
  last_violation_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    logs.user_id,
    count(*) filter (
      where logs.created_at >= now() - interval '1 hour'
    ) as violations_last_hour,
    count(*) filter (
      where logs.created_at >= now() - interval '24 hours'
    ) as violations_last_24_hours,
    count(*) as violations_total,
    max(logs.created_at) as last_violation_at
  from public.message_logs as logs
  where logs.blocked = true
  group by logs.user_id
  order by violations_total desc, last_violation_at desc
  limit 50;
$$;

revoke all on function public.security_violation_counts() from public;
grant execute on function public.security_violation_counts() to service_role;
