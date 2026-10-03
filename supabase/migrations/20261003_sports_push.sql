-- Sports PWA web push. Subscriptions and the heat-line ledger are service-role
-- only: the endpoint keys are push secrets, and the sweep runs in the
-- sports-push edge function. The browser never reads this table back.

create table if not exists public.sports_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  heat_alerts boolean not null default true,
  favorite_alerts boolean not null default false,
  favorites jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sports_push_subscriptions_endpoint_len check (char_length(endpoint) between 12 and 2000),
  constraint sports_push_subscriptions_keys_len check (
    char_length(p256dh) between 8 and 200
    and char_length(auth) between 8 and 200
  )
);

create index if not exists sports_push_subscriptions_user_idx
  on public.sports_push_subscriptions (user_id);

alter table public.sports_push_subscriptions enable row level security;
revoke all on table public.sports_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.sports_push_subscriptions to service_role;

create table if not exists public.sports_push_game_state (
  game_key text primary key,
  phase text not null check (phase in ('pregame', 'live', 'final')),
  hot boolean not null default false,
  drama_score integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint sports_push_game_state_key_len check (char_length(game_key) between 3 and 80)
);

create index if not exists sports_push_game_state_updated_idx
  on public.sports_push_game_state (updated_at desc);

alter table public.sports_push_game_state enable row level security;
revoke all on table public.sports_push_game_state from anon, authenticated;
grant select, insert, update, delete on table public.sports_push_game_state to service_role;

create table if not exists public.sports_push_sent (
  game_key text not null,
  reason text not null check (reason in ('heat', 'favorite-start', 'favorite-final')),
  sent_at timestamptz not null default now(),
  primary key (game_key, reason),
  constraint sports_push_sent_key_len check (char_length(game_key) between 3 and 80)
);

create index if not exists sports_push_sent_sent_at_idx
  on public.sports_push_sent (sent_at desc);

alter table public.sports_push_sent enable row level security;
revoke all on table public.sports_push_sent from anon, authenticated;
grant select, insert, update, delete on table public.sports_push_sent to service_role;

-- Poll live boards every two minutes once the cron secret is in Vault.
-- The matching edge secret is SPORTS_PUSH_CRON_SECRET. If the vault secret
-- is missing, this is a no-op — set it, then re-run this block.
do $$
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    return;
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'anon_key') then
    return;
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'sports_push_cron') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'sports-push-sweep') then
    perform cron.unschedule('sports-push-sweep');
  end if;
  perform cron.schedule(
    'sports-push-sweep',
    '*/2 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sports-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-sports-push-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'sports_push_cron')
      ),
      body := jsonb_build_object('action', 'sweep'),
      timeout_milliseconds := 60000
    );
    $job$
  );
end $$;
