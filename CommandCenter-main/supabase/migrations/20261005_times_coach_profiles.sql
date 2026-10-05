-- Slow-changing Favorite Coaches facts for Thompson Times.
-- Live season W-L is added from ESPN; these rows are completed seasons
-- plus cited salary/contract figures. Never invent: a null field is omitted.

create table if not exists public.times_coach_profiles (
  coach_id text primary key,
  coach_name text not null,
  school text,
  team_id text,
  league text not null default 'CFB',
  hire_year integer,
  school_wins integer,
  school_losses integer,
  career_wins integer,
  career_losses integer,
  bowl_wins integer,
  bowl_losses integer,
  playoff_wins integer,
  playoff_losses integer,
  titles_note text,
  nfl_record text,
  salary_annual numeric,
  salary_note text,
  contract_end_year integer,
  buyout numeric,
  source_url text not null,
  source_label text not null,
  record_source_url text,
  record_source_label text,
  as_of date not null,
  updated_at timestamptz not null default now()
);

comment on table public.times_coach_profiles is
  'Thompson Times Favorite Coaches: cited salary/contract/title facts and completed-season records. Live W-L comes from ESPN.';

create index if not exists times_coach_profiles_team_id_idx
  on public.times_coach_profiles (team_id);

alter table public.times_coach_profiles enable row level security;

revoke all on table public.times_coach_profiles from anon, public;
grant select on table public.times_coach_profiles to anon, authenticated;

drop policy if exists "read times_coach_profiles" on public.times_coach_profiles;
create policy "read times_coach_profiles"
  on public.times_coach_profiles
  for select
  to anon, authenticated
  using (true);

insert into public.times_coach_profiles (
  coach_id, coach_name, school, team_id, league, hire_year,
  school_wins, school_losses, career_wins, career_losses,
  bowl_wins, bowl_losses, playoff_wins, playoff_losses,
  titles_note, nfl_record,
  salary_annual, salary_note, contract_end_year, buyout,
  source_url, source_label, record_source_url, record_source_label, as_of
) values
  (
    '4409388', 'Eliah Drinkwitz', 'Missouri', '142', 'CFB', 2020,
    46, 29, 58, 30,
    2, 3, null, null,
    '1 Sun Belt (2019)', null,
    10750000, 'avg', 2031, null,
    'https://mutigers.com/news/2025/11/27/mizzou-athletics-announces-new-contract-for-head-football-coach-eliah-drinkwitz',
    'Mizzou Athletics, Nov 2025',
    'https://en.wikipedia.org/wiki/Eliah_Drinkwitz',
    'Wikipedia (through 2025)',
    '2026-01-20'
  ),
  (
    '145698', 'Lincoln Riley', 'USC', '30', 'CFB', 2022,
    35, 18, 90, 28,
    3, 5, 0, 3,
    '4 Big 12 (2017–20)', null,
    11537560, null, null, null,
    'https://sportsdata.usatoday.com/ncaa/salaries/football/coach',
    'USA Today, 2025',
    'https://en.wikipedia.org/wiki/Lincoln_Riley',
    'Wikipedia (through 2025)',
    '2026-01-20'
  ),
  (
    '560112', 'Deion Sanders', 'Colorado', '38', 'CFB', 2023,
    16, 21, 43, 27,
    0, 1, null, null,
    '2 SWAC East (2021–22)', null,
    10000000, null, 2029, 33625000,
    'https://www.sportingnews.com/us/ncaa-football/news/deion-sanders-contract-details-colorado-extension/fc6c7f997b5e65641cfa4911',
    'Sporting News / USA Today, 2025',
    'https://en.wikipedia.org/wiki/Deion_Sanders',
    'Wikipedia (through 2025)',
    '2026-01-20'
  ),
  (
    '560247', 'Bill Belichick', 'North Carolina', '153', 'CFB', 2025,
    4, 8, 4, 8,
    null, null, null, null,
    '6 Super Bowls (NFL HC)', '333–178 NFL',
    10100000, null, 2029, 20833333,
    'https://sportsdata.usatoday.com/ncaa/salaries/football/coach',
    'USA Today, 2025',
    'https://en.wikipedia.org/wiki/Bill_Belichick',
    'Wikipedia (through 2025)',
    '2026-01-20'
  ),
  (
    '5120149', 'Alex Golesh', 'Auburn', '2', 'CFB', 2026,
    0, 0, 23, 15,
    2, 0, null, null,
    null, null,
    6750000, '2026', 2031, null,
    'https://www.montgomeryadvertiser.com/story/sports/college/auburn/2026/08/24/alex-golesh-contract-auburn-football-buyout-details/87624147007/',
    'Montgomery Advertiser, Aug 2026',
    'https://en.wikipedia.org/wiki/Alex_Golesh',
    'Wikipedia (through 2025)',
    '2026-01-20'
  )
on conflict (coach_id) do update set
  coach_name = excluded.coach_name,
  school = excluded.school,
  team_id = excluded.team_id,
  hire_year = excluded.hire_year,
  school_wins = excluded.school_wins,
  school_losses = excluded.school_losses,
  career_wins = excluded.career_wins,
  career_losses = excluded.career_losses,
  bowl_wins = excluded.bowl_wins,
  bowl_losses = excluded.bowl_losses,
  playoff_wins = excluded.playoff_wins,
  playoff_losses = excluded.playoff_losses,
  titles_note = excluded.titles_note,
  nfl_record = excluded.nfl_record,
  salary_annual = excluded.salary_annual,
  salary_note = excluded.salary_note,
  contract_end_year = excluded.contract_end_year,
  buyout = excluded.buyout,
  source_url = excluded.source_url,
  source_label = excluded.source_label,
  record_source_url = excluded.record_source_url,
  record_source_label = excluded.record_source_label,
  as_of = excluded.as_of,
  updated_at = now();
