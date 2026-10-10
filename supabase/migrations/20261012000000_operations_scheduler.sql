-- Operations agent: tasks the user puts on a schedule. Each task is 1-3
-- steps, each a message to one of the other agents, run in order into the
-- task's own chat. The backend runs them; pg_cron wakes the backend (which
-- sleeps when idle on Render's free plan) whenever a task is due or running.

create table if not exists public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- [{"agent": "data_reporting", "prompt": "..."}]
  steps jsonb not null,
  -- {"kind": "once" | "daily" | "weekly" | "monthly", "time": "09:00",
  --  "days": ["mon", ...], "day_of_month": 1..31 | -1 (last day),
  --  "date": "2026-10-20", "timezone": "Asia/Kolkata"}
  schedule jsonb not null,
  notify_email boolean not null default false,
  status text not null default 'active' check (status in ('active', 'paused', 'finished')),
  -- Why the task paused itself (repeated failures), shown on the Scheduled page.
  status_reason text,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text check (last_status in ('completed', 'failed', 'partial')),
  last_error text,
  failure_count integer not null default 0,
  run_count integer not null default 0,
  -- The chat each run's turns are added to.
  conversation_id uuid references public.conversations (id) on delete set null,
  -- Held while a run is in progress so no other worker starts it again.
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_tasks_due_idx
  on public.scheduled_tasks (next_run_at) where status = 'active';
create index if not exists scheduled_tasks_user_idx
  on public.scheduled_tasks (user_id, created_at);

create table if not exists public.scheduled_task_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.scheduled_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger text not null check (trigger in ('schedule', 'manual')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'partial')),
  scheduled_for timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- The agent_requests (chat turns) this run created, in order.
  request_ids uuid[] not null default '{}',
  error text,
  emailed boolean not null default false
);

create index if not exists scheduled_task_runs_task_idx
  on public.scheduled_task_runs (task_id, started_at desc);

-- Created and changed by the backend only; users can read their own.
alter table public.scheduled_tasks enable row level security;
alter table public.scheduled_task_runs enable row level security;

create policy "Users can view their own scheduled tasks" on public.scheduled_tasks
  for select using ((select auth.uid()) = user_id);
create policy "Users can view their own scheduled task runs" on public.scheduled_task_runs
  for select using ((select auth.uid()) = user_id);

-- Chat turns a scheduled run created (shown as "Scheduled" in the chat).
alter table public.agent_requests
  add column if not exists scheduled_task_id uuid references public.scheduled_tasks (id) on delete set null;

-- Claims up to max_tasks due tasks for one worker by locking them.
create or replace function public.claim_due_scheduled_tasks(max_tasks integer default 5, lock_seconds integer default 3600)
returns setof public.scheduled_tasks
language sql
security definer
set search_path = ''
as $$
  update public.scheduled_tasks t
     set locked_until = now() + make_interval(secs => lock_seconds)
   where t.id in (
     select s.id from public.scheduled_tasks s
      where s.status = 'active'
        and s.next_run_at <= now()
        and (s.locked_until is null or s.locked_until < now())
      order by s.next_run_at
      limit greatest(1, least(max_tasks, 20))
      for update skip locked
   )
  returning t.*;
$$;

-- Claims one task for a "Run now", unless a run of it is already going.
create or replace function public.claim_scheduled_task(task uuid, lock_seconds integer default 3600)
returns setof public.scheduled_tasks
language sql
security definer
set search_path = ''
as $$
  update public.scheduled_tasks t
     set locked_until = now() + make_interval(secs => lock_seconds)
   where t.id = task
     and (t.locked_until is null or t.locked_until < now())
  returning t.*;
$$;

-- The wake-up call's shared secret lives only in Vault; the backend checks
-- a caller's header against it through this function.
create or replace function public.check_operations_tick_secret(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
     where name = 'operations_tick_secret' and decrypted_secret = candidate
  );
$$;

revoke execute on function public.claim_due_scheduled_tasks(integer, integer) from public, anon, authenticated;
revoke execute on function public.claim_scheduled_task(uuid, integer) from public, anon, authenticated;
revoke execute on function public.check_operations_tick_secret(text) from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_tasks(integer, integer) to service_role;
grant execute on function public.claim_scheduled_task(uuid, integer) to service_role;
grant execute on function public.check_operations_tick_secret(text) to service_role;

-- Every minute: if a task is due (or a run is in progress, so the backend
-- isn't put to sleep mid-run), call the backend's /operations/tick. The URL
-- and secret are Vault secrets named operations_tick_url and
-- operations_tick_secret; without them nothing is called.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.wake_operations_scheduler()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tick_url text;
  tick_secret text;
begin
  if not exists (
    select 1 from public.scheduled_tasks
     where (status = 'active' and next_run_at <= now() and (locked_until is null or locked_until < now()))
        or locked_until > now()
  ) then
    return;
  end if;
  select decrypted_secret into tick_url from vault.decrypted_secrets where name = 'operations_tick_url';
  select decrypted_secret into tick_secret from vault.decrypted_secrets where name = 'operations_tick_secret';
  if tick_url is null or tick_secret is null then
    return;
  end if;
  perform net.http_post(
    url := tick_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Operations-Secret', tick_secret),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.wake_operations_scheduler() from public, anon, authenticated;

select cron.schedule('operations-wake', '* * * * *', 'select public.wake_operations_scheduler()');
