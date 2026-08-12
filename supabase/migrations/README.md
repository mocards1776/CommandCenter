# Migrations

Applied to Supabase project `esdgrgulaxnewmhjuyzh`, in order:

1. `initial_schema` — the 9 tables, indexes, `updated_at` triggers, and the
   `handle_new_user` signup trigger that creates a `profiles` row.
2. `row_level_security` — RLS enabled on every table with owner-only policies
   keyed to `auth.uid()`, plus explicit grants to the API roles.
3. `grant_api_roles` — `ALTER DEFAULT PRIVILEGES` so new tables get grants
   automatically. Without grants, PostgREST hides a table and reports
   `PGRST205 "not found in schema cache"`.
4. `harden_functions` — pins `search_path` on `touch_updated_at` and revokes
   `EXECUTE` on `handle_new_user` so it is not callable as an RPC.
5. `books` … `daily_page_goal` — the reading library: books, reading sessions,
   goals, on-deck ordering, per-book progress mode, read-through log.
6. `books_add_subjects` — `books.subjects text[]`, genre chips from Open
   Library.
7. `book_highlights_and_sync_state` — Readwise highlights (`book_highlights`,
   owner-scoped RLS, `unique (user_id, readwise_id)` so a re-sync upserts
   rather than duplicates) and `integration_sync`, the per-service bookmark
   that makes the pull incremental.

8. `fiction_series_and_highlight_notes` — `books.fiction` and
   `books.classified_at` (the classifier's batch bookmark), an index on
   `(user_id, series)`, and `book_highlights.my_note` — the reader's own note,
   separate from Readwise's `note` so a re-sync can't overwrite it.

9. `rss_filters` — per-user phrase / URL blacklist for Dispatch (`kind` in
   `phrase|url`, unique `(user_id, kind, value)`, owner-scoped RLS).

10. `story_links` — secret client scroll-story tokens (`token`, `slug`,
    optional `label`, soft-revoke via `revoked_at`). Unique partial index on
    active slug. RLS on with no anon/authenticated table policies; writes go
    through the `story-link` edge function (service role). Public resolve via
    `resolve_story_link(token)` SECURITY DEFINER RPC (returns slug/label only).

11. `health` — calorie log (`calorie_entries`), daily goal (`health_settings`),
    synced metrics (`health_metrics`), and OAuth token vault
    (`health_connections`, service-role only). Apple Health has no public web
    API — imports go through the `apple-health` edge function; Withings uses
    the `withings` edge function.

Run `get_advisors` after any schema change; it catches missing RLS and
mutable-search_path functions.
