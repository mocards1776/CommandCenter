-- Client story share links (Almanac-style scroll presentations).
-- Applied remotely as migration `story_links` on project esdgrgulaxnewmhjuyzh.
-- Staff mint via service-role edge function; anon cannot list tokens.

CREATE TABLE IF NOT EXISTS public.story_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  slug text NOT NULL,
  label text,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS story_links_active_slug_uidx
  ON public.story_links (slug)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS story_links_slug_idx ON public.story_links (slug);

ALTER TABLE public.story_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.story_links FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.story_links TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_story_link(p_token text)
RETURNS TABLE (slug text, label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.slug, s.label
  FROM public.story_links s
  WHERE s.token = trim(p_token)
    AND s.revoked_at IS NULL
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_story_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_story_link(text) TO anon, authenticated;
