-- Thompson Times national-news desk. One row per newspaper edition
-- (issue_id matches newspaper_issues.id, e.g. 2026-10-05-morning).
-- Written only by the newspaper-national edge function (service role).
-- A failure here must never block or rewrite a sports edition.

create table if not exists public.times_national_news (
  issue_id text primary key,
  day text not null,
  edition text not null check (edition in ('morning', 'midday', 'evening')),
  stories jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  editor jsonb not null default '{}'::jsonb,
  printed_at timestamptz not null default now()
);

comment on table public.times_national_news is
  'Thompson Times National News section, one row per edition. Written by newspaper-national (service role).';

alter table public.times_national_news enable row level security;

revoke all on table public.times_national_news from anon, public;
grant select on table public.times_national_news to authenticated;

drop policy if exists "read national news" on public.times_national_news;
create policy "read national news"
  on public.times_national_news
  for select
  to authenticated
  using (true);

-- Independent of thompson-times-press. Offset seven minutes from the
-- 15-minute sports press so a national miss never shares a cron tick.
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
    'thompson-times-national',
    '7,22,37,52 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/newspaper-national',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
      ),
      body := jsonb_build_object('source', 'cron'),
      timeout_milliseconds := 120000
    );
    $job$
  );
end $$;
