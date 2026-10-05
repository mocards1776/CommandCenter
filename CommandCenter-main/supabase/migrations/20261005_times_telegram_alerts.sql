-- Thompson Times "edition ready" alerts on @ThompsonTimes_bot (edge function times-telegram).
-- One row per issue: the function claims the row before it sends, so an edition alerts once.
-- Bot token and chat ids live in edge secrets TIMES_TELEGRAM_BOT_TOKEN / TIMES_TELEGRAM_CHAT_IDS.

create table if not exists public.times_telegram_alerts (
  issue_id text primary key,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 1,
  headline text,
  chats jsonb,
  error text
);

comment on table public.times_telegram_alerts is
  'Thompson Times Telegram alerts, one per newspaper_issues.id. Written by the times-telegram edge function (service role).';

alter table public.times_telegram_alerts enable row level security;
revoke all on table public.times_telegram_alerts from anon, authenticated;

-- Checks for a freshly printed edition every 5 minutes, offset from the press (*/15).
-- The job reads vault secrets project_url and anon_key, which stay out of the repo.
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
  perform cron.schedule(
    'times-telegram-alerts',
    '3-59/5 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/times-telegram',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
      ),
      body := jsonb_build_object('source', 'cron'),
      timeout_milliseconds := 60000
    );
    $job$
  );
end $$;
