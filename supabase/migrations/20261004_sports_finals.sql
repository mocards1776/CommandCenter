-- Telegram final-score photos (@FinalsAndStats_bot). Service role only.
-- The sweep in sports-finals reads and writes these tables. The browser does not.

create table if not exists public.sports_finals_watch (
  game_key text primary key,
  phase text not null check (phase in ('pregame', 'live', 'final')),
  ever_hot boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint sports_finals_watch_key_len check (char_length(game_key) between 3 and 80)
);

create index if not exists sports_finals_watch_updated_idx
  on public.sports_finals_watch (updated_at desc);

alter table public.sports_finals_watch enable row level security;
revoke all on table public.sports_finals_watch from anon, authenticated;
grant select, insert, update, delete on table public.sports_finals_watch to service_role;

create table if not exists public.sports_finals_sent (
  game_key text primary key,
  sport text not null,
  event_id text not null,
  sent_at timestamptz not null default now(),
  constraint sports_finals_sent_key_len check (char_length(game_key) between 3 and 80)
);

create index if not exists sports_finals_sent_sent_at_idx
  on public.sports_finals_sent (sent_at desc);

alter table public.sports_finals_sent enable row level security;
revoke all on table public.sports_finals_sent from anon, authenticated;
grant select, insert, update, delete on table public.sports_finals_sent to service_role;

-- Poll with the sports-push cadence once sports_finals_cron is in Vault.
-- The matching edge secret is TELEGRAM_FINALS_CRON_SECRET. If the vault
-- secret is missing, this block is a no-op — set it, then re-run.
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
  if not exists (select 1 from vault.decrypted_secrets where name = 'sports_finals_cron') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'sports-finals-sweep') then
    perform cron.unschedule('sports-finals-sweep');
  end if;
  perform cron.schedule(
    'sports-finals-sweep',
    '*/2 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sports-finals',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-sports-finals-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'sports_finals_cron')
      ),
      body := jsonb_build_object('action', 'sweep'),
      timeout_milliseconds := 120000
    );
    $job$
  );
end $$;
