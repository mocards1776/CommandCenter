-- Telegram Blues goal clips (@CommandCenterHighlights_bot). Service role only.
-- The sweep in sports-highlights reads and writes this table. The browser does not.

create table if not exists public.sports_highlights_sent (
  highlight_id text primary key,
  source text not null default 'nhl',
  team_abbrev text not null,
  nhl_game_id text,
  espn_event_id text,
  caption text,
  sharing_url text,
  sent_at timestamptz not null default now(),
  constraint sports_highlights_sent_id_len check (char_length(highlight_id) between 3 and 80),
  constraint sports_highlights_sent_source_len check (char_length(source) between 2 and 20)
);

create index if not exists sports_highlights_sent_sent_at_idx
  on public.sports_highlights_sent (sent_at desc);

create index if not exists sports_highlights_sent_game_idx
  on public.sports_highlights_sent (nhl_game_id);

alter table public.sports_highlights_sent enable row level security;
revoke all on table public.sports_highlights_sent from anon, authenticated;
grant select, insert, update, delete on table public.sports_highlights_sent to service_role;

-- Poll with the sports-push cadence once sports_highlights_cron is in Vault.
-- The matching edge secret is TELEGRAM_HIGHLIGHTS_CRON_SECRET. If the vault
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
  if not exists (select 1 from vault.decrypted_secrets where name = 'sports_highlights_cron') then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'sports-highlights-sweep') then
    perform cron.unschedule('sports-highlights-sweep');
  end if;
  perform cron.schedule(
    'sports-highlights-sweep',
    '*/2 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sports-highlights',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-sports-highlights-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'sports_highlights_cron')
      ),
      body := jsonb_build_object('action', 'sweep'),
      timeout_milliseconds := 120000
    );
    $job$
  );
end $$;
