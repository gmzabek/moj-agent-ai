-- Allow signed-in users to persist their own conversations and messages.
-- RLS policies still limit every operation to rows owned by auth.uid().

begin;

revoke all on table public.conversations from anon;
revoke all on table public.messages from anon;

grant select, insert, update, delete
  on table public.conversations
  to authenticated;

grant select, insert, update, delete
  on table public.messages
  to authenticated;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

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

commit;
