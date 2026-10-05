-- Thompson Times Beez page: Josh's adult rec hockey club.
-- One current row (id = 'current'), reprinted in every edition.
-- Already live in prod; this file is the record. create table if not exists
-- plus a guarded policy so applying it there is a no-op.

create table if not exists public.times_beez (
  id text primary key default 'current',
  season text,
  division text,
  team jsonb not null default '{}'::jsonb,
  standings jsonb not null default '[]'::jsonb,
  skaters jsonb not null default '[]'::jsonb,
  goalies jsonb not null default '[]'::jsonb,
  last_game jsonb,
  results jsonb not null default '[]'::jsonb,
  upcoming jsonb not null default '[]'::jsonb,
  source text default 'sportninja',
  updated_at timestamptz not null default now()
);

comment on table public.times_beez is
  'Thompson Times Beez page: one current adult-rec hockey desk. Service role writes; authenticated reads.';

alter table public.times_beez enable row level security;

grant select on table public.times_beez to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policy
    where polrelid = 'public.times_beez'::regclass
      and polname = 'times_beez_read'
  ) then
    create policy times_beez_read
      on public.times_beez
      for select
      to authenticated
      using (true);
  end if;
end $$;
