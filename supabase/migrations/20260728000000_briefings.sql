create extension if not exists pgcrypto;

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null check (length(trim(content)) > 0),
  date date not null,
  user_id uuid null references auth.users(id) on delete cascade
);

create index if not exists briefings_created_at_idx
  on public.briefings (created_at desc);

create index if not exists briefings_date_idx
  on public.briefings (date desc);

alter table public.briefings enable row level security;

comment on table public.briefings is
  'Poranne briefingi generowane automatycznie przez endpoint cron.';

comment on column public.briefings.user_id is
  'Opcjonalny właściciel briefingu; null oznacza briefing wspólny.';
