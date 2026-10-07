-- Google account connections for the Sales & Outreach agent (Gmail + Calendar).
-- Only the backend (service role) reads or writes this table: RLS is on with
-- no policies, so the refresh token (encrypted by the backend anyway) never
-- reaches the browser.
create table if not exists public.google_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_email text not null,
  scopes text[] not null default '{}',
  refresh_token_encrypted text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_connections enable row level security;
