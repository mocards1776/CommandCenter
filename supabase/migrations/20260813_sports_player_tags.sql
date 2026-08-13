-- User-defined tags on MLB players (e.g. Former Cardinal, Prospect).
CREATE TABLE IF NOT EXISTS public.sports_player_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, player_id, tag),
  CONSTRAINT sports_player_tags_tag_len CHECK (char_length(tag) BETWEEN 1 AND 40)
);

CREATE INDEX IF NOT EXISTS sports_player_tags_user_player_idx
  ON public.sports_player_tags (user_id, player_id);

CREATE INDEX IF NOT EXISTS sports_player_tags_user_tag_idx
  ON public.sports_player_tags (user_id, tag);

ALTER TABLE public.sports_player_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own sports_player_tags" ON public.sports_player_tags;
CREATE POLICY "own sports_player_tags" ON public.sports_player_tags
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
