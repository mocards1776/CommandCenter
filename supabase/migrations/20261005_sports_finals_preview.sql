-- Evening RUWT preview photo (@FinalsAndStats_bot). Service role only.
-- One row per America/Chicago calendar day so a 5pm cron retry cannot double-post.

create table if not exists public.sports_finals_preview_sent (
  chicago_date date primary key,
  sent_at timestamptz not null default now(),
  game_keys text[] not null default '{}',
  bytes integer,
  constraint sports_finals_preview_sent_keys_len check (cardinality(game_keys) <= 16)
);

comment on table public.sports_finals_preview_sent is
  'Idempotency for the sports-finals evening-preview Telegram photo. One send per America/Chicago date.';

create index if not exists sports_finals_preview_sent_sent_at_idx
  on public.sports_finals_preview_sent (sent_at desc);

alter table public.sports_finals_preview_sent enable row level security;
revoke all on table public.sports_finals_preview_sent from anon, authenticated;
grant select, insert, update, delete on table public.sports_finals_preview_sent to service_role;

-- Daily 5:00pm America/Chicago. Prefer the timezone column when pg_cron has it;
-- otherwise the UTC fallback is 22:00 (5pm CDT / 4pm CST). Re-run after
-- sports_finals_cron is in Vault.
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
  if exists (select 1 from cron.job where jobname = 'sports-finals-evening-preview') then
    perform cron.unschedule('sports-finals-evening-preview');
  end if;
  perform cron.schedule(
    'sports-finals-evening-preview',
    '0 17 * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sports-finals',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-sports-finals-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'sports_finals_cron')
      ),
      body := jsonb_build_object('action', 'evening-preview'),
      timeout_milliseconds := 120000
    );
    $job$
  );
  begin
    update cron.job
      set timezone = 'America/Chicago'
      where jobname = 'sports-finals-evening-preview';
  exception
    when undefined_column then
      -- pg_cron without timezone: rewrite as 22:00 UTC (5pm CDT; 4pm CST).
      perform cron.unschedule('sports-finals-evening-preview');
      perform cron.schedule(
        'sports-finals-evening-preview',
        '0 22 * * *',
        $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sports-finals',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
            'x-sports-finals-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'sports_finals_cron')
          ),
          body := jsonb_build_object('action', 'evening-preview'),
          timeout_milliseconds := 120000
        );
        $job$
      );
  end;
end $$;
