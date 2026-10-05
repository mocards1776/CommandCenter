-- Thompson Times image alerts (edge function times-telegram-shots + GitHub Actions runner).
-- times_telegram_alerts.mode records which path sent an edition: 'text' or 'image'.
-- times_telegram_runner is the runner's heartbeat; while it is fresh, times-telegram
-- holds the text alert for the image alert (and falls back to text if it never comes).

alter table public.times_telegram_alerts add column if not exists mode text;

create table if not exists public.times_telegram_runner (
  id text primary key,
  last_poll_at timestamptz not null default now(),
  detail jsonb
);

comment on table public.times_telegram_runner is
  'Heartbeat of the GitHub Actions screenshot runner (times-telegram-shots). While it is fresh, times-telegram waits for the image alert before falling back to text.';

alter table public.times_telegram_runner enable row level security;
revoke all on table public.times_telegram_runner from anon, authenticated;
