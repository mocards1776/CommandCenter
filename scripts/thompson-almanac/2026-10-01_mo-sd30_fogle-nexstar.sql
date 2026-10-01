-- Thompson Almanac (Supabase project sdixnhobyzxfimubxspi), not the Command Center project.
-- MO SD-30: Fogle for Missouri (candidate) Nexstar Springfield broadcast, weekly :30s 9/1-11/3
-- (Nexstar Political Comp - Betsy Fogle.xlsx, buyer Debra Schommer Media Group).
--   KOLR 70,465 / KRBK 30,260 / page total 100,725
-- Weeks 9/1-10/5 were already loaded; this adds 10/6-11/3 and re-aligns every Nexstar week to the file.
-- Gray (KYTV/KSPR), cable, and Forward PAC rows are intentionally untouched.
-- Safe to re-run.

begin;

insert into sponsors (race_slug, name, default_affiliation, sponsor_type, buyer)
values ('mo-sd30', 'Fogle for Missouri', 'Betsy Fogle', 'candidate', 'Debra Schommer Media Group')
on conflict (race_slug, name) do update
  set default_affiliation = excluded.default_affiliation,
      sponsor_type = excluded.sponsor_type,
      buyer = excluded.buyer;

create temp table fogle_nexstar_lines (call_sign text, flight_start date, flight_end date, spend numeric) on commit drop;

insert into fogle_nexstar_lines values
  ('KOLR', '2026-09-01', '2026-09-07',  3885), ('KRBK', '2026-09-01', '2026-09-07', 2405),
  ('KOLR', '2026-09-08', '2026-09-14',  4805), ('KRBK', '2026-09-08', '2026-09-14', 2650),
  ('KOLR', '2026-09-15', '2026-09-21',  6515), ('KRBK', '2026-09-15', '2026-09-21', 2155),
  ('KOLR', '2026-09-22', '2026-09-28',  9120), ('KRBK', '2026-09-22', '2026-09-28', 2690),
  ('KOLR', '2026-09-29', '2026-10-05',  8375), ('KRBK', '2026-09-29', '2026-10-05', 1680),
  ('KOLR', '2026-10-06', '2026-10-12',  9260), ('KRBK', '2026-10-06', '2026-10-12', 3640),
  ('KOLR', '2026-10-13', '2026-10-19', 10300), ('KRBK', '2026-10-13', '2026-10-19', 4035),
  ('KOLR', '2026-10-20', '2026-10-26',  8955), ('KRBK', '2026-10-20', '2026-10-26', 3270),
  ('KOLR', '2026-10-27', '2026-11-03',  9250), ('KRBK', '2026-10-27', '2026-11-03', 7735);

update competitive_buys b
set spend = l.spend
from fogle_nexstar_lines l
join stations st on st.call_sign = l.call_sign and st.market = 'Springfield'
join sponsors s on s.race_slug = 'mo-sd30' and s.name = 'Fogle for Missouri'
where b.race_slug = 'mo-sd30' and b.sponsor_id = s.id and b.station_id = st.id
  and b.media_type = 'broadcast'
  and b.flight_start = l.flight_start and b.flight_end = l.flight_end
  and b.spend is distinct from l.spend;

insert into competitive_buys
  (race_slug, sponsor_id, station_id, spend, flight_start, flight_end, media_type, affiliation, grp35, grp55)
select 'mo-sd30', s.id, st.id, l.spend, l.flight_start, l.flight_end, 'broadcast', 'Betsy Fogle', 0, 0
from fogle_nexstar_lines l
join stations st on st.call_sign = l.call_sign and st.market = 'Springfield'
join sponsors s on s.race_slug = 'mo-sd30' and s.name = 'Fogle for Missouri'
where not exists (
  select 1 from competitive_buys b
  where b.race_slug = 'mo-sd30' and b.sponsor_id = s.id and b.station_id = st.id
    and b.media_type = 'broadcast'
    and b.flight_start = l.flight_start and b.flight_end = l.flight_end
);

commit;
