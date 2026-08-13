-- Tag category labels: where a book came from (library, gift…) vs subject (sports…).
-- Stored per-user; renaming a tag merges when the target name already exists.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tag_kinds jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.tag_kinds IS
  'Map of tag name -> kind (source|subject). Keys are exact tag strings used on books.tags.';
