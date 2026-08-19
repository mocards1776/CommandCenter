-- Persistent cache for ESPN wrap/preview feeds so a 15-minute cron can warm
-- them even when Dispatch is closed. Edge writes; authenticated clients read
-- via the rss function (not direct table access).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.rss_feed_cache (
  feed_url text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.rss_feed_cache enable row level security;

-- No anon/authenticated policies — service role (edge) only.
revoke all on table public.rss_feed_cache from anon, authenticated;
grant select, insert, update, delete on table public.rss_feed_cache to service_role;

create index if not exists rss_feed_cache_updated_at_idx
  on public.rss_feed_cache (updated_at desc);
