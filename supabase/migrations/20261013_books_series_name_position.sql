-- Series name + position on books, for the series strip on each book's view.
--
-- `series` is the series name (PostgREST column name the app and the
-- book-ai classifier already read/write; magazines reuse it as the
-- publication name). `series_position` is the volume number — numeric, not
-- integer, because publishers number novellas 0.5 / 12.5.
--
-- Both columns are already live on esdgrgulaxnewmhjuyzh (shipped with the
-- original `books` migration); every statement here is idempotent so a
-- re-apply is a no-op.
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS series text;

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS series_position numeric;

-- A blank series name is "no series", never an empty-string group. Position
-- without a series is meaningless and only breaks "unnumbered" sorting.
UPDATE public.books
   SET series = NULL
 WHERE series IS NOT NULL AND btrim(series) = '';

UPDATE public.books
   SET series = btrim(series)
 WHERE series IS NOT NULL AND series <> btrim(series);

UPDATE public.books
   SET series_position = NULL
 WHERE series IS NULL AND series_position IS NOT NULL;

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_series_position_check;

ALTER TABLE public.books
  ADD CONSTRAINT books_series_position_check
  CHECK (series_position IS NULL OR series_position >= 0);

-- Ordered "every volume of this series" read. Leading columns match the old
-- (user_id, series) index, so that one is redundant and dropped.
CREATE INDEX IF NOT EXISTS books_series_position_idx
  ON public.books (user_id, series, series_position)
  WHERE series IS NOT NULL;

DROP INDEX IF EXISTS public.books_series_idx;

COMMENT ON COLUMN public.books.series IS
  'Series name (e.g. "Joe Pickett"); magazines store the publication name here';
COMMENT ON COLUMN public.books.series_position IS
  'Volume number within the series; numeric so 0.5 / 12.5 novellas sort in place';
