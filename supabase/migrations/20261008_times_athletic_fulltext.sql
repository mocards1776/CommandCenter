-- Athletic article text for the Times press. Keyed by the article URL.
-- The press reads this only when ATHLETIC_FULLTEXT=on. An empty or missing
-- table changes nothing. Service role writes; no anon or authenticated grant.
-- Do not schedule a fetch. The box script is run by hand.

create table if not exists public.times_athletic_fulltext (
  url text primary key,
  body text not null,
  fetched_at timestamptz not null default now()
);

comment on table public.times_athletic_fulltext is
  'Thompson Times: Athletic article body keyed by URL. Service role only. Read by the press when ATHLETIC_FULLTEXT=on.';

alter table public.times_athletic_fulltext enable row level security;
