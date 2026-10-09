-- Data & Reporting agent: spreadsheets the user uploads (parsed by the
-- backend into typed rows) and file attachments on chat messages.

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  filename text not null,
  -- [{"name": "Amount", "type": "number" | "date" | "text" | "boolean"}]
  columns jsonb not null,
  -- Array of rows, each an array of values in column order (numbers as
  -- numbers, dates as ISO strings, blanks as null).
  rows jsonb not null,
  row_count integer not null,
  size_bytes integer not null,
  created_at timestamptz not null default now()
);

create index if not exists datasets_user_created_idx
  on public.datasets (user_id, created_at desc);

alter table public.datasets enable row level security;

-- Uploads are parsed and inserted by the backend; users read and remove their own.
create policy "Users can view their own datasets" on public.datasets
  for select using ((select auth.uid()) = user_id);
create policy "Users can delete their own datasets" on public.datasets
  for delete using ((select auth.uid()) = user_id);

-- Files attached to a chat message: [{"type": "dataset", "id": "...", "name": "..."}].
alter table public.agent_requests
  add column if not exists attachments jsonb;
