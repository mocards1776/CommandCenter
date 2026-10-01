-- Thompson Almanac (Supabase project sdixnhobyzxfimubxspi), not the Command Center project.
-- MO SD-30: Legio XIII PAC as Melanie Stinnett's allied PAC, with its Springfield radio buy
-- (estimate #1626, :30s, 392 spots, flight 10/2 5:00a - 10/8 4:59a = broadcast days 10/2-10/7, buyer Will Thompson).
--   Gross per station from the buy detail PDF (net is 85%): market total $38,595 gross / $32,805.75 net.
-- Side colors: competitive-races.ts already sets Stinnett #ef4444 (red-500) / Fogle #3b82f6 (blue-500), but with no
-- per-sponsor colors every PAC rendered in its candidate's exact color. sponsor_color_overrides wins over that
-- default, so candidate committees are pinned to the base color and PACs to the lighter -300 tint.
-- Planning CPP: SD-30 sits entirely in the Springfield DMA, so its blended "1,000 GRP" cost is just the Springfield
-- general-2026 row of planning_cpp (keyed by cycle + DMA, so it also prices every other Springfield race this cycle).
-- Safe to re-run.

begin;

insert into sponsors (race_slug, name, default_affiliation, sponsor_type, buyer)
values ('mo-sd30', 'Legio XIII PAC', 'Melanie Stinnett', 'pac', 'Will Thompson')
on conflict (race_slug, name) do update
  set default_affiliation = excluded.default_affiliation,
      sponsor_type = excluded.sponsor_type,
      buyer = excluded.buyer;

with sponsor as (
  select id from sponsors where race_slug = 'mo-sd30' and name = 'Legio XIII PAC'
),
lines(call_sign, spend) as (
  values ('KGBX-FM', 3750), ('KSGF-FM', 4700), ('KSWF-FM', 4945), ('KTOZ-FM', 5000),
         ('KTTS-FM', 7950), ('KTXR-FM', 4500), ('KWTO-FM', 5650), ('KXUS-FM', 2100)
)
insert into competitive_buys
  (race_slug, sponsor_id, station_id, spend, flight_start, flight_end, media_type, affiliation, grp35, grp55)
select 'mo-sd30', sponsor.id, st.id, lines.spend, date '2026-10-02', date '2026-10-07',
       'radio', 'Melanie Stinnett', 0, 0
from lines
cross join sponsor
join stations st on st.call_sign = lines.call_sign and st.market = 'Springfield' and st.media_type = 'radio'
where not exists (
  select 1 from competitive_buys b
  where b.race_slug = 'mo-sd30' and b.sponsor_id = sponsor.id and b.station_id = st.id
    and b.flight_start = date '2026-10-02' and b.flight_end = date '2026-10-07'
);

insert into sponsor_color_overrides (race_slug, sponsor, color)
values ('mo-sd30', 'Friends of Melanie Stinnett', '#ef4444'),
       ('mo-sd30', 'Missouri Senate Campaign Committee', '#fca5a5'),
       ('mo-sd30', 'Legio XIII PAC', '#fca5a5'),
       ('mo-sd30', 'Fogle for Missouri', '#3b82f6'),
       ('mo-sd30', 'Forward PAC', '#93c5fd')
on conflict (race_slug, sponsor) do update
  set color = excluded.color,
      updated_at = now();

insert into planning_cpp (cycle, dma, candidate_cpp, issue_cpp)
values ('general-2026', 'Springfield', 75, 165)
on conflict (cycle, dma) do update
  set candidate_cpp = excluded.candidate_cpp,
      issue_cpp = excluded.issue_cpp,
      updated_at = now();

commit;
