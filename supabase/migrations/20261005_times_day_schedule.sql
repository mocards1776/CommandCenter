-- Thompson Times "The Day Ahead" page: one printed schedule per calendar date (America/Chicago).
-- Written by the assistant (service role) from Chief of Staff's morning message; read by the
-- logged-in paper. events: [{start:'HH:MM'|null, end:'HH:MM'|null, all_day:bool, title, kind:'work'|'family', location:string|null}]
create table if not exists public.times_day_schedule (
  schedule_date date primary key,
  events jsonb not null default '[]'::jsonb,
  source text,
  received_at timestamptz default now(),
  constraint times_day_schedule_events_array check (jsonb_typeof(events) = 'array')
);

comment on table public.times_day_schedule is
  'Thompson Times "The Day Ahead" page: the day''s calendar, one row per America/Chicago date. Service role writes; authenticated reads.';

alter table public.times_day_schedule enable row level security;

revoke all on table public.times_day_schedule from anon, authenticated;
grant select on table public.times_day_schedule to authenticated;

drop policy if exists "times_day_schedule_read" on public.times_day_schedule;
create policy "times_day_schedule_read" on public.times_day_schedule
  for select to authenticated using (true);
