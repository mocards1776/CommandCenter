# CommandCenter Changelog

---

## Team pages: BR summary, payroll, leaders — August 14, 2026

- MLB team drawer: Baseball-Reference-style org summary (manager, president, farm/scouting directors, ballpark, attendance, park factors, Pythagorean W-L).
- Team salaries & contracts table from BBRef payroll pages.
- Team Leaders cards (Hitting / Pitching / Fielding) with headshots — Cardinals-style layout.
- MLB player hero: always shows service time; current salary + contract status on the hero.
- Sports edge: `teamBbrefSummary` + `teamPayroll` actions; more reliable service-time scrape.

---

## Wraps, sidebar leaders, golf tabs, NFL team stats — August 14, 2026

- MLB player links in Dispatch/wraps go to in-app player pages (mlb.com anchors rewritten even before name index loads).
- Dispatch notes aside: weather glyphs + Cardinals batting/pitching leaders with headshots.
- MLB highlight videos with “ABS” in the title are hidden.
- Box score HR notes use season totals.
- “See AP’s full MLB coverage” is stripped by default and can be hidden without wiping the whole wrap.
- Game wraps/previews: team form with L5 / L10 / L20.
- Golf leaderboard row spacing tightened; golfer cards get Overview / News & Video / Bio / Results tabs.
- NFL game wraps: ESPN-style recap + team stats + full boxscore; wraps feed stubs finals without articles + current-week scoreboard fallback.
- NFL + MLB team pages: ESPN-style player stats tables (passing/rushing/receiving/defense; batting/pitching).

---

## Golf FedEx polish, Hot Seat edge, RuWT today — August 14, 2026

- Golf leaderboard: subtle FedEx rank number after the name (not FX#).
- Golfer cards: full-season results + last win (via sports edge scrape).
- NFL Hot Seat: Kalshi coach markets fetched through the sports edge function (fixes browser CORS / Load failed).
- RuWT: today's games only (MLB + NFL, Chicago date).
- Highlights + hide-words on player RotoWire cards and game wraps/previews.
- Tagged-player RotoWire feeds: only notes published after the tag was added.
- Dispatch Favorites: collapsible folder.

---

## Prospects, Kalshi Hot Seat, golf results — August 14, 2026

- MiLB player photos: fall back to Pipeline `/headshot/milb` before the grey silhouette.
- Prospect **Pipeline #** on player hero cards and next to names in box scores.
- NFL wraps: finals only when ESPN has real summary text (same bar as MLB).
- Dispatch: long-press or right-click a feed/folder to favorite it.
- NFL Hot Seat: ranked by **Kalshi** coach-out markets (fixes scrambled ESPN coach/team data).
- NFL coaches: clickable full profile pages at `/sports/nfl/coach/:id`.
- Golfer cards: season tournament results table.
- Golf leaderboard: FedEx Cup rank badge next to players.

---

## Dispatch folders, NFL wraps, full-screen drawers — August 14, 2026

- Sports drawers (golf, team detail, customize board) open **full screen**.
- Dispatch: feed **folders** — tap left/middle for a combined feed; chevron expands children (Cardinals, MLB, NFL, Scout, Tags).
- NFL wraps & previews: include live games + score stubs when ESPN has no article (preseason-safe).
- Hot Seat NFL: resilient coach fetch (roster + core API fallback).
- Farm wraps: **finals only**, open full box score in-reader.
- Game wraps: fix missing ESPN story when MLB/ESPN abbrevs differ (CWS↔CHW); pass ESPN event id into recap.
- RUWT previews: division place under the record (e.g. 1st in NL Central).

---

## Sports polish: iPad golf, Hot Seat, NFL cards — August 14, 2026

- Golf (iPad): wider leaderboard drawer; **Favorites** pinned above the full field (no separate tab).
- Golfer cards: career totals from ESPN season log (fixes Spieth wins/earnings).
- RUWT: mixed MLB + NFL heat board with All / MLB / NFL selector.
- NFL: full player cards and team pages (roster, stats, graphics).
- **Hot Seat** (was Managers): MLB managers + NFL coaches with sport selector.
- MLB player cards: Origin + Bio moved to the bottom.
- iPad: edge swipe-to-back on player/team/golf panels.

---

## NFL scoreboard, golf profiles, Dispatch NFL wraps — August 14, 2026

- Sports: full **NFL** scoreboard, live field map + play-by-play, and clickable player pages with favorites.
- Dispatch: **NFL wraps & previews** feed (same pattern as MLB wraps).
- Golf: Favorites leaderboard (POS / Player / Tot / Thru / R1) and richer golfer profiles (rankings, career/season/bio/stats cards, highlights).
- RUWT: NFL games ranked alongside MLB, with separate NFL team interest sliders.

---

## Dispatch peeks, prospects, stats feed — August 13, 2026

- Player peek back/gesture returns to the article (history stack), not the feed.
- Player tags (e.g. #FormerCardinal) on player pages + Dispatch peeks.
- Team cards show manager + GM / baseball-ops lead.
- Sports: Cardinals **Prospects** page (Pipeline watch list, #Prospect tags, farm rosters).
- Feed header: hide-read toggle (off by default).
- Article swipe next/prev removed; use arrows or double-tap for next.
- Wrap readers use the ESPN article photo as a full-bleed header.
- New **MLB stats & standings** daily digest feed (divisions, wild cards, leaders).

---

## Dispatch quotes, saves, MLB wraps — August 13, 2026

- Saved notes are stylized quote cards; tap opens a shareable PNG card.
- **Save for later** inbox (`rss_saves`) with row + reader toggles.
- Archive from the reader (mark read, advance to next).
- Separate **MLB wraps & previews** feed (league-wide ESPN), kept out of Unread.
- In-article highlight marks are baked into HTML so they no longer vanish on scroll.

---

## Reading: covers, page counts, tags — August 13, 2026

- Catalog add keeps the search jacket, ISBN, and page count (then enriches).
- Book detail: editable page count; pull down on the sheet to close.
- Now Reading: subtle tap-to-log pages/% or add a page count.
- Recent week cells show historical week rank (same idea as day/month).
- Home Tags section + manage: rename/merge, mark as Came from vs Subject.
- DB: `profiles.tag_kinds` jsonb. Redeploy `book-ai` for richer catalog fields.

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
