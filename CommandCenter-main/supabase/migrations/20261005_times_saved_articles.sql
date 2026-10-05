-- Saved Thompson Times stories. One snapshot per user per story id, so a
-- bookmark outlives the edition that printed it.

create table if not exists public.times_saved_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id text not null,
  headline text not null,
  dek text,
  body text,
  byline text,
  source text,
  url text,
  image text,
  section text,
  edition_date text,
  saved_at timestamptz not null default now(),
  unique (user_id, story_id)
);

comment on table public.times_saved_articles is
  'Thompson Times saved-for-later snapshots. Owner-scoped; survives edition rollover.';

create index if not exists times_saved_articles_user_saved_at_idx
  on public.times_saved_articles (user_id, saved_at desc);

alter table public.times_saved_articles enable row level security;

revoke all on table public.times_saved_articles from anon, public;
grant select, insert, update, delete on table public.times_saved_articles to authenticated;

drop policy if exists "own times_saved_articles" on public.times_saved_articles;
create policy "own times_saved_articles"
  on public.times_saved_articles
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
