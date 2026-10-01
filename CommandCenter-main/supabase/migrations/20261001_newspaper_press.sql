-- The Thompson Times press file. An edition is printed on a schedule and opened as a document.
-- The composer the schedule runs lives in private.press_bundle (base64 of compose.bundle.js).

create schema if not exists private;

create table if not exists private.press_bundle (
  seq integer primary key,
  body text not null
);

revoke all on schema private from public, anon, authenticated;
revoke all on table private.press_bundle from public, anon, authenticated;
alter table private.press_bundle enable row level security;

create table if not exists public.newspaper_issues (
  id text primary key,
  version integer not null default 1,
  status text not null default 'ready' check (status in ('printing', 'ready')),
  stories jsonb not null default '[]'::jsonb,
  queries jsonb not null default '[]'::jsonb,
  printed_at timestamptz not null default now()
);

alter table public.newspaper_issues enable row level security;

drop policy if exists "read printed issues" on public.newspaper_issues;
create policy "read printed issues"
  on public.newspaper_issues
  for select
  to authenticated
  using (status = 'ready');

drop policy if exists "file a new issue" on public.newspaper_issues;
create policy "file a new issue"
  on public.newspaper_issues
  for insert
  to authenticated
  with check (status = 'ready');

create table if not exists public.newspaper_desk (
  id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  fav_order text[] not null default '{}',
  hidden text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.newspaper_desk enable row level security;

drop policy if exists "household desk" on public.newspaper_desk;
create policy "household desk"
  on public.newspaper_desk
  for all
  to authenticated
  using (true)
  with check (true);

-- Prints the edition at 6 a.m., noon, and 5 p.m. Central by checking every 15 minutes.
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
    'thompson-times-press',
    '*/15 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/newspaper-press',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
      ),
      body := jsonb_build_object('source', 'cron'),
      timeout_milliseconds := 150000
    );
    $job$
  );
end $$;
