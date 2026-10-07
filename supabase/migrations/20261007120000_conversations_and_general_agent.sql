-- Chat continuity: a conversation holds a sequence of agent requests (turns),
-- so follow-up messages stay in the same chat and agents can see what came
-- before. Also renames the unused "manager" agent type to "general".

alter type public.agent_type rename value 'manager' to 'general';

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;

create policy "Users can view their own conversations" on public.conversations
  for select using ((select auth.uid()) = user_id);
create policy "Users can create their own conversations" on public.conversations
  for insert with check ((select auth.uid()) = user_id);
create policy "Users can update their own conversations" on public.conversations
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own conversations" on public.conversations
  for delete using ((select auth.uid()) = user_id);

alter table public.agent_requests
  add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;

create index if not exists agent_requests_conversation_idx
  on public.agent_requests (conversation_id, created_at);

-- A request may only be added to one of the user's own conversations.
drop policy if exists "Users can create their own requests" on public.agent_requests;
create policy "Users can create their own requests" on public.agent_requests
  for insert with check (
    (select auth.uid()) = user_id
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.user_id = (select auth.uid())
      )
    )
  );

-- Existing requests each become their own conversation (same id).
insert into public.conversations (id, user_id, title, created_at, updated_at)
select r.id, r.user_id, left(r.prompt, 80), r.created_at, r.created_at
from public.agent_requests r
where r.conversation_id is null
on conflict (id) do nothing;

update public.agent_requests set conversation_id = id where conversation_id is null;

-- New turns move their conversation to the top of the list.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function public.touch_conversation() from public, anon, authenticated;

drop trigger if exists agent_requests_touch_conversation on public.agent_requests;
create trigger agent_requests_touch_conversation
  after insert on public.agent_requests
  for each row
  when (new.conversation_id is not null)
  execute function public.touch_conversation();
