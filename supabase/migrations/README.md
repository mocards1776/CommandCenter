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

Run `get_advisors` after any schema change; it catches missing RLS and
mutable-search_path functions.
