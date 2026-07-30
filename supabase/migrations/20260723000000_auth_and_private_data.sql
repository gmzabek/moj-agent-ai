-- Supabase Auth ownership and row-level isolation for every private record.
-- This migration intentionally removes legacy rows that have no owner.

begin;

alter table public.conversations
  add column if not exists user_id uuid;

alter table public.documents
  add column if not exists user_id uuid;

delete from public.conversations
where user_id is null;

delete from public.documents
where user_id is null;

delete from public.user_profiles profile
where not exists (
  select 1
  from auth.users auth_user
  where auth_user.id = profile.id
);

alter table public.conversations
  alter column user_id set not null;

alter table public.documents
  alter column user_id set not null;

alter table public.user_profiles
  alter column id drop default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_user_id_fkey'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
      add constraint conversations_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_user_id_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_auth_user_fkey'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_auth_user_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

create index if not exists conversations_user_id_updated_at_idx
  on public.conversations (user_id, updated_at desc);

create index if not exists documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "anon full access (dev)" on public.conversations;
drop policy if exists "anon full access (dev)" on public.messages;
drop policy if exists "anon full access (dev)" on public.user_profiles;

drop policy if exists conversations_owner_all on public.conversations;
create policy conversations_owner_all
  on public.conversations
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists messages_owner_all on public.messages;
create policy messages_owner_all
  on public.messages
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.conversations conversation
      where conversation.id = messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.conversations conversation
      where conversation.id = messages.conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists documents_owner_all on public.documents;
create policy documents_owner_all
  on public.documents
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists user_profiles_owner_all on public.user_profiles;
create policy user_profiles_owner_all
  on public.user_profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop function if exists public.match_documents(vector, double precision, integer);

create function public.match_documents(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  added_at timestamptz,
  similarity float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    document.id,
    document.title,
    document.content,
    document.metadata,
    document.created_at as added_at,
    1 - (document.embedding <=> query_embedding) as similarity
  from public.documents document
  where document.user_id = (select auth.uid())
    and 1 - (document.embedding <=> query_embedding) > match_threshold
  order by document.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_documents(vector, float, int) from public;
grant execute on function public.match_documents(vector, float, int) to authenticated;

commit;
