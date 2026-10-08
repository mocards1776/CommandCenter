-- Saved "Ask AI" answers on a sports player page.
-- Anyone can read (anon or signed-in). Inserts go through the player-ask
-- edge function with the service role. There is no write policy for the
-- browser roles, so a signed-in visitor cannot spend the xAI key by
-- inserting a row directly.

create table if not exists public.player_ai_answers (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  sport text not null,
  question text not null,
  answer text not null,
  sources jsonb not null default '[]'::jsonb,
  asked_at timestamptz not null default now(),
  asked_by uuid references auth.users (id) on delete set null,
  constraint player_ai_answers_player_id_len check (char_length(player_id) between 1 and 40),
  constraint player_ai_answers_sport check (sport in ('mlb', 'nfl', 'nhl', 'cfb')),
  constraint player_ai_answers_question_len check (char_length(question) between 1 and 500),
  constraint player_ai_answers_answer_len check (char_length(answer) between 1 and 8000),
  constraint player_ai_answers_sources_array check (jsonb_typeof(sources) = 'array')
);

comment on table public.player_ai_answers is
  'Ask AI Q&A saved on a player page. Public read. Writes only from the player-ask edge function (service role).';

create index if not exists player_ai_answers_player_asked_idx
  on public.player_ai_answers (sport, player_id, asked_at desc);

alter table public.player_ai_answers enable row level security;

revoke all on table public.player_ai_answers from anon, authenticated;
grant select on table public.player_ai_answers to anon, authenticated;
grant select, insert, update, delete on table public.player_ai_answers to service_role;

drop policy if exists "player_ai_answers_public_read" on public.player_ai_answers;
create policy "player_ai_answers_public_read"
  on public.player_ai_answers
  for select
  to anon, authenticated
  using (true);
