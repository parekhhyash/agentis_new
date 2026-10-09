-- LinkedIn and X (Twitter) connections for the Content & Copy agent's
-- "post" buttons. One row per user and network; tokens are encrypted by the
-- backend (Fernet, INTEGRATIONS_ENCRYPTION_KEY) and never reach the browser.

create table if not exists public.social_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('linkedin', 'x')),
  -- LinkedIn member id (OpenID "sub") or X user id.
  account_id text not null,
  -- Display name or @handle.
  account_label text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- Backend only: RLS on with no policies.
alter table public.social_connections enable row level security;
