-- Distinguish magazine issues from books while sharing the same shelf/progress model.
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'book';

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_content_type_check;

ALTER TABLE public.books
  ADD CONSTRAINT books_content_type_check
  CHECK (content_type IN ('book', 'magazine'));

CREATE INDEX IF NOT EXISTS books_content_type_idx ON public.books (user_id, content_type);

COMMENT ON COLUMN public.books.content_type IS 'book (default) or magazine issue';
