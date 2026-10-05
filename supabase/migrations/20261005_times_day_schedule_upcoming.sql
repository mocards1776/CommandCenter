-- "Coming Up" on The Day Ahead: the next five days as of the morning the schedule was filed.
-- upcoming: [{date:'YYYY-MM-DD', events:[same shape as events]}]
alter table public.times_day_schedule
  add column if not exists upcoming jsonb not null default '[]'::jsonb;

alter table public.times_day_schedule
  drop constraint if exists times_day_schedule_upcoming_array;
alter table public.times_day_schedule
  add constraint times_day_schedule_upcoming_array check (jsonb_typeof(upcoming) = 'array');
