create extension if not exists pgcrypto;

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('feedback', 'alert', 'order')),
  data jsonb not null,
  analysis text not null check (length(trim(analysis)) > 0)
);

create index if not exists webhook_events_created_at_idx
  on public.webhook_events (created_at desc);

create index if not exists webhook_events_type_idx
  on public.webhook_events (type);

alter table public.webhook_events enable row level security;

comment on table public.webhook_events is
  'Zewnętrzne zdarzenia przeanalizowane przez agenta AI.';
