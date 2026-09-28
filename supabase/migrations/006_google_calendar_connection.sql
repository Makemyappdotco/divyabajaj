-- One Google Calendar connection per environment (test/production), storing
-- the refresh token needed to keep reading Divya's busy times and creating
-- events without her signing in again. Tokens are encrypted at rest by the
-- application (GOOGLE_TOKEN_ENCRYPTION_KEY) before they ever reach this
-- table - it never sees a usable token in plain text.
--
-- Locked down the same way calendar_sync_events already is: RLS enabled, no
-- policies, reachable only through the backend's service role key.

create table if not exists public.google_calendar_connections (
  id text primary key,
  environment text not null default 'test',
  google_account_email text not null default '',
  calendar_id text not null default 'primary',
  refresh_token_encrypted text not null,
  access_token_encrypted text not null default '',
  access_token_expires_at timestamptz,
  scope text not null default '',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One connection per environment - reconnecting replaces it rather than
-- creating a second row that the rest of the code would never look at.
create unique index if not exists google_calendar_connections_environment_unique
  on public.google_calendar_connections(environment);

alter table public.google_calendar_connections enable row level security;
