-- Save-for-later queue for Dispatch (independent of rss_reads archive).
CREATE TABLE IF NOT EXISTS public.rss_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_url text NOT NULL,
  article_title text,
  feed_url text,
  image text,
  snippet text,
  author text,
  published_at timestamptz,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_url)
);

CREATE INDEX IF NOT EXISTS rss_saves_user_saved_at_idx
  ON public.rss_saves (user_id, saved_at DESC);

ALTER TABLE public.rss_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rss_saves" ON public.rss_saves;
CREATE POLICY "own rss_saves" ON public.rss_saves
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
