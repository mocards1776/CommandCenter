-- Thompson Almanac (Supabase project sdixnhobyzxfimubxspi), not the Command Center project.
-- MO SD-30: Forward PAC as Betsy Fogle's allied PAC, with TV orders for estimate #4577 (:30s, 10/3-10/12).
--   Gray Media order (Forward PAC-Hulsen Media Services LLC.xlsx): KYTV 109,185 / KSPR 17,510 / KYCW 4,720
--   Nexstar political comp (Nexstar Political Comp - Forward PAC.xlsx): KOLR 16,280 / KRBK 12,270 / KOZL 2,780
-- Her Health, Her Future PAC rides the same Gray email but is the statewide Yes on Amendment 3 committee and is
-- intentionally not added to mo-sd30.
-- Safe to re-run.

begin;

insert into stations (call_sign, market, timezone, media_type, owner_group)
select 'KOZL', 'Springfield', 'America/Chicago', 'tv', 'Nexstar Media Group'
where not exists (select 1 from stations where call_sign = 'KOZL' and market = 'Springfield');

insert into sponsors (race_slug, name, default_affiliation, sponsor_type, buyer)
values ('mo-sd30', 'Forward PAC', 'Betsy Fogle', 'pac', 'Hulsen Media Services LLC')
on conflict (race_slug, name) do update
  set default_affiliation = excluded.default_affiliation,
      sponsor_type = excluded.sponsor_type,
      buyer = excluded.buyer;

with sponsor as (
  select id from sponsors where race_slug = 'mo-sd30' and name = 'Forward PAC'
),
lines(call_sign, spend) as (
  values ('KYTV', 109185), ('KSPR', 17510), ('KYCW', 4720),
         ('KOLR', 16280), ('KRBK', 12270), ('KOZL', 2780)
)
insert into competitive_buys
  (race_slug, sponsor_id, station_id, spend, flight_start, flight_end, media_type, affiliation, grp35, grp55)
select 'mo-sd30', sponsor.id, st.id, lines.spend, date '2026-10-03', date '2026-10-12',
       'broadcast', 'Betsy Fogle', 0, 0
from lines
cross join sponsor
join stations st on st.call_sign = lines.call_sign and st.market = 'Springfield'
where not exists (
  select 1 from competitive_buys b
  where b.race_slug = 'mo-sd30' and b.sponsor_id = sponsor.id and b.station_id = st.id
    and b.flight_start = date '2026-10-03' and b.flight_end = date '2026-10-12'
);

commit;
