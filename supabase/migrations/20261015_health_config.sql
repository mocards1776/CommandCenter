-- Ingest secret fallback for the health edge function.
-- HEALTH_INGEST_SECRET (platform secret) wins when it is set.
-- Otherwise the function reads key 'ingest_secret' with the service role.
-- RLS is on and there are no policies, so anon and authenticated cannot read
-- the row. Grants are also revoked from those roles. Do not insert the
-- secret value in this file.

create table if not exists public.health_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  constraint health_config_key_len check (char_length(key) between 1 and 64),
  constraint health_config_value_len check (char_length(value) between 1 and 512)
);

alter table public.health_config enable row level security;

revoke all on table public.health_config from public, anon, authenticated, service_role;
grant select on table public.health_config to service_role;
