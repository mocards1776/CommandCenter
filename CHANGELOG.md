# CommandCenter Changelog

---

## Dispatch notes rail + contracts — August 12, 2026

- Notes sidebar (large screens): Cardinals current/next game, weather for
  **65706**, NL Central, and NL Wild Card standings.
- In-article highlights painted via DOM text walk (survives player-name links);
  curly quotes / entities normalized.
- Player contracts: direct edge fetch with timeout, Spotrac ID hints for the
  Cardinals roster, prefer Spotrac AAV when BBRef salary year is stale, cache
  bust (`v3` / query `v9`), Retry clears session cache. Redeploy `sports`.

---

## Dispatch reader polish — August 12, 2026

- “Highlight saved” toast now auto-dismisses (no hover/touch pause; reduced-motion
  no longer freezes react-hot-toast exit).
- Saved highlights are painted in the article body (and title) with a red mark.
- Large-screen notes column includes a compact **NL Central** standings table
  that scrolls with the page.
- Cardinals Wire auto-hides MLB Film Room `/video/` clips; `mlb.com/news` stays.

---

## Hide City SC soccer bleed — August 11, 2026

- Auto-hide clear MLS / City SC stories that leak into the STL Today Cardinals
  feed (URL section + “City SC” signals — not bare “city”).
- Ban on a row prefers a path filter (e.g. `sports/professional/mls`) over the
  whole `stltoday.com` host.

---

## Player contract + RotoWire brief — August 11, 2026

- Contract scrape: unwrap Baseball Reference HTML comments, better player match,
  stricter Spotrac URL picking; prefer combined `contract` action.
- Player pages show a **RotoWire** note (via ESPN) above the MLB game-log form
  summary; removed the “no AI summary” line.

---

## Dispatch reader UX — August 11, 2026

- Player names open an in-app peek (article stays open); any MLB player can link,
  not just Cardinals.
- Select text → small **Block** on the highlight sheet adds a phrase filter.
- Desktop ←/→ moves between articles; **Mark all read** for the visible list.

---

## Dispatch feed + filters — August 11, 2026

- Third feed: **Cardinals Wire** (`rss.app` tdKZI96…).
- Phrase + URL blacklist filters (`rss_filters`), managed under Filters in the
  sidebar; Ban on a row blacklists that host.

---

## Dispatch cleanup — August 11, 2026

- Strip STL Today share/gift/follow/notification chrome from extracted HTML;
  prefer `lee-article-text` paragraphs after TownNews decrypt.
- Reader UI: sidebar with Unread + feed folders and unread counts (classic
  RSS-reader layout).

---

## Dispatch (RSS) standalone — August 11, 2026

- Standalone **Dispatch** PWA (`/rss.html`, patriotic icon) like Reading/Sports.
- Second feed: STL Today Cardinals (`rss.app` NY6044…); TownNews subscriber
  cipher unlocked in the `rss` edge function so full text extracts.
- Highlights + comments (`rss_highlights`), read/unread (`rss_reads`).
- Feed thumbnails are clickable; Notes tab across articles.

---

## RSS reader — August 11, 2026

- Added `/rss` page with Missouri Scout feed (`rss.app` XML).
- New `rss` edge function fetches the feed and extracts full article HTML
  (reader-mode style) so truncated Squarespace snippets are readable in-app.
- Nav entry under Command Center chrome (desktop + mobile).

---

## NL Central macOS widget — August 10, 2026

- Added `NLCentralStandings/`: native WidgetKit desktop widget for NL Central
  standings (M1 MacBook Pro / macOS 14+).
- Live data from MLB Stats API (`statsapi.mlb.com`), same source as the Sports
  hub; Cardinals row highlighted with the Fenway scoreboard palette.
- Host app + Medium / Large / Extra Large widget sizes; README with install steps.

---

## Rebuild — August 6, 2026

Complete rewrite. Todoist became the source of truth for tasks; Supabase
replaced the FastAPI + DigitalOcean backend.

### Backend

- **DigitalOcean FastAPI backend retired.** `main.py` was 1,958 lines holding
  99 endpoints. Most of it was task/project CRUD that Todoist now provides.
- **Supabase** (project `esdgrgulaxnewmhjuyzh`) holds the 9 tables Todoist has
  no concept of: profiles, habits, habit_completions, time_entries,
  time_blocks, notes, crm_people, braindump_entries, favorite_sports_teams.
- **Dropped entirely**: `tasks`, `projects`, `tags`, `categories`, `users`.
- **Supabase Auth** replaced the hand-rolled JWT in `auth.py`. Old
  `werkzeug` password hashes do not port — accounts must be recreated.
- **Todoist edge function** proxies all Todoist traffic so the API token stays
  server-side, gated on a valid Supabase JWT plus a resource allowlist.

### Schema fixes carried over from old bugs

- `habits.name` is a real column. It was `title` with a `.name` property alias,
  which is why habits rendered as `—` (see Lexington 1 below).
- All timestamps are `timestamptz`. The old schema used naive `DateTime` with
  hand-rolled Central-time conversion scattered across the codebase.
- `notes.tags` is `text[]`, was a comma-joined `varchar(500)`.
- `habits.custom_days` is `smallint[]`, was JSON inside a text column.
- `unique (habit_id, completed_date)` prevents double-completing a habit.
- Row-level security on every table, owner-scoped to `auth.uid()`.

### Frontend

- Rebuilt Login, Dashboard, Todos, Habits against Supabase + Todoist.
- Deleted ~940K of stale duplicate directories that had been committed inside
  `CommandCenter-main/`.
- Removed 18 unused dependencies (all of Radix, recharts, zustand, date-fns,
  workbox, axios).
- Fenway scoreboard palette kept, moved into Tailwind v4 `@theme` tokens.
- The scoreboard is computed client-side from loaded data. The old
  `/dashboard/` endpoint silently dropping fields was what blanked the stats.
- Natural-language date parsing deleted (~80 lines); Todoist's `due_string`
  does it server-side.

### Build fixes

- `tsconfig.app.json` used `erasableSyntaxOnly` (TS 5.8+) and
  `ignoreDeprecations: "6.0"` against TypeScript 5.7 — typechecking had been
  failing. Upgraded to 5.9, removed the invalid option.
- `eslint.config.js` referenced `reactHooks.configs.flat`, removed in
  eslint-plugin-react-hooks 5.2. ESLint could not run at all.
- `npm run build` now typechecks before building.

### Gotchas discovered the hard way

- Writes to a Supabase project in `COMING_UP` state are silently discarded when
  the restore completes. The first schema migration was lost this way.
- PostgREST reports missing table *grants* as `PGRST205 "not found in schema
  cache"`, which sends you chasing the wrong problem.
- Todoist REST v2 returns HTTP 410; the unified `/api/v1` is the live API.

---

## Lexington 1 — May 3, 2026

**Fixed by AI (Perplexity / Claude session).**

### What broke
Tasks stopped completing on Saturday evening. The frontend at `command-center-flax-gamma.vercel.app` was sending `PATCH` requests to the DigitalOcean backend at `orca-app-v7oew.ondigitalocean.app`, but the live server was rejecting them with a CORS preflight error:

> "Method PATCH is not allowed by Access-Control-Allow-Methods in preflight response"

### Root cause
A previous AI session (Claude) had modified `main.py` but the DigitalOcean deployment was **stale** — the running container never picked up the CORS fix that included `PATCH` in `allow_methods`. A force rebuild on DigitalOcean resolved the immediate CORS issue.

### Additional fixes applied in this session
1. **Dashboard stats were all blank (`---`)** — The `/dashboard/` endpoint was not returning `completed_tasks_today`, `total_tasks_today`, `time_tracked_seconds`, or the `gamification` block. The frontend `GameScoreboard` component reads all of these directly. Fixed by computing and returning the full gamification object (batting average, hitting streak, hits, strikeouts, focus minutes).

2. **Habits showing as `—`** — Habit entries in `today_habits` only had a `title` field, but `DashHabitRow` looks for `entry?.name` first. Since `name` was missing, it rendered as `—`. Fixed by returning both `title` and `name` on every habit entry.
