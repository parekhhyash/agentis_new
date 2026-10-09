-- CRM connections over MCP (HubSpot, Salesforce, Zoho CRM). One row per
-- user and CRM. Credentials are encrypted by the backend (Fernet,
-- INTEGRATIONS_ENCRYPTION_KEY): the OAuth refresh token for HubSpot and
-- Salesforce, and for Zoho the MCP server URL itself, which embeds its key.

create table if not exists public.crm_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('hubspot', 'salesforce', 'zoho')),
  account_label text,
  mcp_url_encrypted text not null,
  refresh_token_encrypted text,
  tool_count integer,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- Backend only: RLS on with no policies, like google_connections.
alter table public.crm_connections enable row level security;
