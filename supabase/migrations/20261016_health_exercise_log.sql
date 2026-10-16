-- Health exercise log: one row per set (or timed effort).
-- Owner-scoped like the other health tables. The health edge function writes
-- with the service role (bypasses RLS) after checking x-health-secret.
--
-- `date` and `time` are America/Chicago wall clock, not UTC.
-- (user_id, date, time, exercise) is the natural key: re-posting or
-- re-importing the same entry updates it instead of duplicating it.

create table if not exists public.health_exercise_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  time time not null default '12:00',
  exercise text not null check (char_length(btrim(exercise)) between 1 and 120),
  sets int check (sets is null or sets > 0),
  reps int check (reps is null or reps >= 0),
  weight_lb numeric(6, 1) check (weight_lb is null or weight_lb >= 0),
  duration_min numeric(7, 2) check (duration_min is null or duration_min >= 0),
  kcal_burned numeric(8, 1) check (kcal_burned is null or kcal_burned >= 0),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, date, time, exercise)
);

create index if not exists health_exercise_log_user_day_idx
  on public.health_exercise_log (user_id, date, time);

alter table public.health_exercise_log enable row level security;

drop policy if exists health_exercise_log_owner on public.health_exercise_log;
create policy health_exercise_log_owner on public.health_exercise_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.health_exercise_log from anon, public;
grant select, insert, update, delete on table public.health_exercise_log to authenticated, service_role;
