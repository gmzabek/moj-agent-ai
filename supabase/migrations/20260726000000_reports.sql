-- Private generated reports owned by authenticated users.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (char_length(topic) between 5 and 300),
  content text not null check (char_length(content) between 100 and 100000),
  word_count integer not null default 0 check (word_count >= 0),
  source_count integer not null default 0 check (source_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists reports_user_id_created_at_idx
  on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;

drop policy if exists reports_owner_all on public.reports;
create policy reports_owner_all
  on public.reports
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.reports from anon;
grant select, insert, update, delete on table public.reports to authenticated;

commit;
