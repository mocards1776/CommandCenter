# CommandCenter

Personal dashboard: tasks, habits, and time tracking.

## Architecture

| Piece | Where | Stack |
| --- | --- | --- |
| Frontend | `CommandCenter-main/` | Vite + React 19 + TypeScript, Tailwind v4, TanStack Query, React Router |
| Database + auth | Supabase project `esdgrgulaxnewmhjuyzh` | Postgres 17, Supabase Auth, row-level security |
| Todoist proxy | `supabase/functions/todoist/` | Deno edge function |
| Book lookup / enrichment | `supabase/functions/book-lookup/`, `supabase/functions/backfill-covers/` | Deno edge functions |
| Tasks | Todoist | unified `/api/v1` |
| Hosting | Vercel | root `vercel.json` builds `CommandCenter-main` |

**Todoist owns all task data.** Tasks, projects, sections, and labels live in
Todoist and are never mirrored into Postgres — there is no sync to drift.
Supabase holds only what Todoist has no concept of: habits, time entries, time
blocks, notes, CRM contacts, braindump entries, and sports teams.

### Why the Todoist proxy exists

The Todoist API token grants full account access, so it must never reach the
browser. All Todoist traffic goes through the `todoist` edge function, which
holds the token as a Supabase secret, requires a valid Supabase JWT
(`verify_jwt: true`), and refuses any resource outside a small allowlist.

## Local development

```bash
cd CommandCenter-main
npm install
npm run dev
```

Requires a `.env.local` with:

```
VITE_SUPABASE_URL=https://esdgrgulaxnewmhjuyzh.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

Both are safe in the browser — row-level security is what guards the data, not
key secrecy. The **Todoist token is not here**; it lives only in Supabase.

```bash
npm run build   # typechecks, then builds
npm run lint
```

## Deploying

- **Frontend** — pushes to the connected branch deploy via Vercel. Environment
  variable changes do *not* apply to existing deployments; redeploy after
  editing them.
- **Edge functions** — `supabase functions deploy <name>` (`todoist`,
  `book-lookup`, `backfill-covers`)
- **Migrations** — applied to the Supabase project; `supabase/migrations/`
  is the record.

## Things that will bite you

- **Todoist REST v2 is retired** and returns HTTP 410. Use `/api/v1/`. Most
  tutorials online still show v2.
- **Todoist priority is inverted**: `4` is urgent, `1` is none.
- **Todoist parses dates itself.** Pass `due_string: "tomorrow at 3pm"` and let
  it do the work — this app deliberately has no date-parsing code.
- **Never write to the database while the project is restoring.** A project in
  `COMING_UP` accepts writes and then discards them when the restore lands.
  Confirm `ACTIVE_HEALTHY` first.
- **New tables need grants.** PostgREST hides tables its roles lack privileges
  on and reports it as `PGRST205 "not found in schema cache"`, which points at
  the wrong problem. `ALTER DEFAULT PRIVILEGES` is configured to cover new
  tables; verify with `get_advisors` after any migration.
- **Open Library keeps descriptions on the *work*, not the edition.**
  `/api/books?jscmd=details` never returns one, so the enrichment function
  follows `details.works[0].key` to `/works/OL…W.json`. Missing this produced
  exactly 1 description across 385 enriched books.
- **Google Books rate-limits anonymous callers to nothing.** Every unauthenticated
  `volumes?q=isbn:` request comes back 429. It is a fallback only. Set
  `GOOGLE_BOOKS_API_KEY` as a Supabase secret to make it useful — Open Library
  alone covers roughly half the library.
- **Third-party keys belong in Supabase, never Vercel.** Anything prefixed
  `VITE_` is compiled into the bundle and shipped to every browser. That applies
  to `TODOIST_API_TOKEN`, `GOOGLE_BOOKS_API_KEY`, `ANTHROPIC_API_KEY`, and
  `READWISE_TOKEN`.
- **All dates are Central time** (`America/Chicago`), computed in
  `src/lib/utils.ts`. Using UTC makes tasks flip to "tomorrow" at 6–7pm local.
- **Free-tier Supabase projects pause after ~7 days idle** and the free plan
  caps at 2 active projects.
- **Never sign up test users with made-up addresses.** Email confirmation is on,
  so every signup sends a real message; fake addresses bounce and Supabase
  throttles the project's email sending. Turn confirmation off in Auth settings
  before any signup testing, or test against the account you actually own.

## Status

Rebuilt pages: Login, Dashboard, Todos, Habits, Reading — "Capitol" theme (navy
and red, engraved star field, Playfair Display + Libre Franklin).

Not yet rebuilt — the schema supports them, the UI does not exist yet: Focus,
Calendar/TimeBlock, Stats, Notes, Braindump, Daily Summary, Weather, Sports,
CRM.

The FastAPI backend in `CommandCenter-backend/` is **retired** and no longer
called by the frontend. It is kept only for reference until the rebuild is
complete.
