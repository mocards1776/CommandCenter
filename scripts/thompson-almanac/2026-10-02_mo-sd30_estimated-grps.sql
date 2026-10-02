-- Thompson Almanac (Supabase project sdixnhobyzxfimubxspi), not the Command Center project.
-- MO SD-30: estimated GRPs for every competitive buy, none of which came with points of its own.
--   grp35 = round(spend / planning CPP), CPP read from the buy's own station DMA in planning_cpp general-2026
--   (Springfield: candidate_cpp 75 for candidate committees, issue_cpp 165 for PACs / issue committees).
-- Only grp35 is filled. It's the Adults 35+ number every GRP surface in RaceDashboard reads (the GRP KPI card,
-- share of voice, CPP = spend / GRPs 35+), and it's what the batch-add modal derives from a CPP the same way:
-- round(spend / cpp) into grp35 with grp55 left at 0. grp55 (A55+) only exists where a real order or ratings book
-- supplied it, so an estimate has nothing to put there.
-- Broadcast only. No race in the Almanac carries GRPs on radio or cable, and the planning CPP is a TV rate.
-- Recomputes from current spend and CPP, so it's safe to re-run after either changes.

begin;

update competitive_buys b
set grp35 = round(b.spend / case when s.sponsor_type = 'candidate' then c.candidate_cpp else c.issue_cpp end)
from sponsors s, stations st, planning_cpp c
where b.race_slug = 'mo-sd30'
  and b.media_type = 'broadcast'
  and b.spend > 0
  and s.id = b.sponsor_id
  and st.id = b.station_id
  and c.cycle = 'general-2026'
  and c.dma = st.market
  and (case when s.sponsor_type = 'candidate' then c.candidate_cpp else c.issue_cpp end) > 0
  and b.grp35 is distinct from round(b.spend / case when s.sponsor_type = 'candidate' then c.candidate_cpp else c.issue_cpp end);

commit;
