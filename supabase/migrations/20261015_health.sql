-- Health log: food, saved foods, weigh-ins.
-- Owner-scoped like finance. The health edge function writes with the
-- service role (bypasses RLS) after checking x-health-secret.

create table if not exists public.health_saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kcal numeric(8, 1) not null check (kcal >= 0),
  protein_g numeric(8, 1) not null check (protein_g >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists health_saved_foods_user_idx
  on public.health_saved_foods (user_id, sort_order);

create table if not exists public.health_food_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null,
  log_date date not null,
  item text not null,
  kcal numeric(8, 1) not null check (kcal >= 0),
  protein_g numeric(8, 1) not null check (protein_g >= 0),
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create index if not exists health_food_log_user_day_idx
  on public.health_food_log (user_id, log_date, logged_at);

create table if not exists public.health_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weighed_on date not null,
  weight_lb numeric(6, 2) not null check (weight_lb > 0),
  fat numeric(8, 2),
  bone numeric(8, 2),
  muscle numeric(8, 2),
  hydration numeric(8, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, weighed_on)
);

create index if not exists health_weights_user_day_idx
  on public.health_weights (user_id, weighed_on);

alter table public.health_saved_foods enable row level security;
alter table public.health_food_log enable row level security;
alter table public.health_weights enable row level security;

drop policy if exists health_saved_foods_owner on public.health_saved_foods;
create policy health_saved_foods_owner on public.health_saved_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists health_food_log_owner on public.health_food_log;
create policy health_food_log_owner on public.health_food_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists health_weights_owner on public.health_weights;
create policy health_weights_owner on public.health_weights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.health_saved_foods from anon, public;
revoke all on table public.health_food_log from anon, public;
revoke all on table public.health_weights from anon, public;

grant select, insert, update, delete on table public.health_saved_foods to authenticated, service_role;
grant select, insert, update, delete on table public.health_food_log to authenticated, service_role;
grant select, insert, update, delete on table public.health_weights to authenticated, service_role;

drop trigger if exists health_saved_foods_touch on public.health_saved_foods;
create trigger health_saved_foods_touch
  before update on public.health_saved_foods
  for each row execute function public.touch_updated_at();

drop trigger if exists health_food_log_touch on public.health_food_log;
create trigger health_food_log_touch
  before update on public.health_food_log
  for each row execute function public.touch_updated_at();

drop trigger if exists health_weights_touch on public.health_weights;
create trigger health_weights_touch
  before update on public.health_weights
  for each row execute function public.touch_updated_at();

-- Saved foods. One row per existing profile so a re-apply is a no-op.
insert into public.health_saved_foods (user_id, name, kcal, protein_g, sort_order)
select p.id, v.name, v.kcal, v.protein_g, v.sort_order
from public.profiles p
cross join (
  values
    ('crackers', 200::numeric, 4::numeric, 1),
    ('Holten''s patty', 300, 20, 2),
    ('burger bun', 150, 0, 3),
    ('Member''s Mark Colby Jack stick', 80, 5, 4),
    ('Ruffles Original (12 chips)', 160, 2, 5),
    ('Oikos Salted Caramel shake', 170, 30, 6),
    ('Ready Caramel Crunch bar', 200, 20, 7),
    ('Barebells Cookies & Caramel bar', 210, 20, 8),
    ('Equate Caramel shake', 170, 30, 9),
    ('Premier Caramel shake', 160, 30, 10),
    ('Ensure Max Caramel shake', 150, 30, 11)
) as v(name, kcal, protein_g, sort_order)
on conflict (user_id, name) do nothing;

-- 2026-10-14 America/Chicago food log. Times are Chicago wall clock.
insert into public.health_food_log (user_id, logged_at, log_date, item, kcal, protein_g, source_key)
select
  p.id,
  v.logged_at,
  date '2026-10-14',
  v.item,
  v.kcal,
  v.protein_g,
  v.source_key
from public.profiles p
cross join (
  values
    (timestamptz '2026-10-14 08:49:00 America/Chicago', 'crackers', 200::numeric, 4::numeric, 'seed-2026-10-14-0849-crackers'),
    (timestamptz '2026-10-14 13:50:00 America/Chicago', 'crackers', 200, 4, 'seed-2026-10-14-1350-crackers'),
    (timestamptz '2026-10-14 17:45:00 America/Chicago', 'burger (Holten''s patty + bun + 2 slices pepper jack)', 650, 39, 'seed-2026-10-14-1745-burger'),
    (timestamptz '2026-10-14 17:52:00 America/Chicago', 'Ruffles Original ~14 chips', 185, 2, 'seed-2026-10-14-1752-ruffles'),
    (timestamptz '2026-10-14 18:24:00 America/Chicago', 'Colby Jack stick', 80, 5, 'seed-2026-10-14-1824-colby'),
    (timestamptz '2026-10-14 19:51:00 America/Chicago', 'crackers', 200, 4, 'seed-2026-10-14-1951-crackers')
) as v(logged_at, item, kcal, protein_g, source_key)
on conflict (user_id, source_key) do nothing;

-- Anchor weigh-in. Historical Withings rows belong in
-- data/health/withings_weight.csv (Date, Weight lb, Fat, Bone, Muscle, Hydration).
-- That file was not in the tree when this migration was written, so only the
-- requested 2026-10-14 point is seeded here. scripts/health-weight-seed.mjs
-- prints additional upserts once the CSV is present.
insert into public.health_weights (user_id, weighed_on, weight_lb)
select p.id, date '2026-10-14', 175.0
from public.profiles p
on conflict (user_id, weighed_on) do update
  set weight_lb = excluded.weight_lb;
