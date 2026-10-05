# CommandCenter

Personal dashboard: tasks, habits, and time tracking.

## Architecture

| Piece | Where | Stack |
| --- | --- | --- |
| Frontend | `CommandCenter-main/` | Vite + React 19 + TypeScript, Tailwind v4, TanStack Query, React Router |
| Database + auth | Supabase project `esdgrgulaxnewmhjuyzh` | Postgres 17, Supabase Auth, row-level security |
| Todoist proxy | `supabase/functions/todoist/` | Deno edge function |
| Book lookup / enrichment | `supabase/functions/book-lookup/`, `supabase/functions/backfill-covers/` | Deno edge functions |
| Highlights | `supabase/functions/readwise-sync/` | Readwise API v2 |
| AI search / recommendations / classification | `supabase/functions/book-ai/` | Grok 4.6 (user's own xAI key) |
| Thompson Times AI editor (front, order, spikes) | `supabase/functions/newspaper-editor/` | Grok 4.6, same `XAI_API_KEY` |
| Tasks | Todoist | unified `/api/v1` |
| Hosting | Vercel | root `vercel.json` builds `CommandCenter-main` |
| macOS widget | `NLCentralStandings/` | WidgetKit NL Central standings (M1 Mac, macOS 14+) |

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
  `book-lookup`, `backfill-covers`, `readwise-sync`, `book-ai`, `sports`, `rss`,
  `newspaper-editor`, `sports-push`, `sports-finals`, `sports-highlights`).
  Canonical source: `supabase/functions/`. Keep the mirror in sync with
  `scripts/sync-edge-copies.sh` (CI fails on drift). On `main`, GitHub Actions
  deploys `rss` / `sports` / `sports-push` / `sports-telegram` / `sports-finals` / `sports-highlights` when that tree changes — requires repo secrets
  `SUPABASE_ACCESS_TOKEN` (and optional `SUPABASE_PROJECT_REF`).

  **One-time GitHub secret setup** (so edge deploys aren’t skipped):

  ```bash
  # Create a token at https://supabase.com/dashboard/account/tokens
  gh secret set SUPABASE_ACCESS_TOKEN --repo mocards1776/CommandCenter
  gh secret set SUPABASE_PROJECT_REF --body "esdgrgulaxnewmhjuyzh" --repo mocards1776/CommandCenter
  ```

  Or in GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

  Manual deploy (no CI): `supabase login` then
  `supabase functions deploy sports --project-ref esdgrgulaxnewmhjuyzh --no-verify-jwt`
- **Migrations** — applied to the Supabase project; `supabase/migrations/`
  is the record.
- **Sports push** — iOS/Safari web push for the Sports Home Screen app.
  The sender is the `sports-push` edge function. Heat alerts use live drama
  only (a one-score game in another sport, line 68) and ignore series weight,
  the Cardinals bump, and interest sliders. The note itself uses the RUWT
  card's reason line plus the score and clock — it does not lead with the
  heat number or mention the interest slider. Favorite start/final is a
  second channel, off until turned on, and keeps its own wording.

  iOS Home Screen web push usually draws the Sports app icon, not the team
  logo in `icon`. It also ignores `vibrate` and the expanded `image`. Android
  and desktop show the team logo, that large image, and a short vibration.
  There is no Live Activity. The same `tag` replaces a note in place
  (`renotify` stays off) so one game does not stack alerts.

  Generate a VAPID key pair on your machine (the private key never goes in git):

  ```bash
  npx web-push generate-vapid-keys
  ```

  Then set the secrets on project `esdgrgulaxnewmhjuyzh` and redeploy the function:

  ```bash
  supabase secrets set \
    VAPID_PUBLIC_KEY="<public key>" \
    VAPID_PRIVATE_KEY="<private key>" \
    VAPID_SUBJECT="mailto:you@example.com" \
    SPORTS_PUSH_CRON_SECRET="$(openssl rand -hex 24)" \
    SPORTS_PUSH_ORIGIN="https://command-center-flax-gamma.vercel.app" \
    --project-ref esdgrgulaxnewmhjuyzh
  supabase functions deploy sports-push --project-ref esdgrgulaxnewmhjuyzh --no-verify-jwt
  ```

- **Heat alert photos** — when a heat alert fires, `sports-push` asks the
  `sports-telegram` edge function for a tall PNG and Telegram `sendPhoto`.
  Sports App owns the drawing (logos, score, clock nest, down and distance,
  a compact field / ice / diamond, the live win-probability chart, and
  Apple-style team stats). RUWT owns the caption reason. Open game and
  RUWT board are Telegram Mini App (`web_app`) buttons (not Safari URL
  buttons or caption links). BotFather `/setdomain` is not required.
  The picture is rendered from the game, not from a screenshot and not
  from a stock photo.

  The signed-in preview is `/sports/heat-alert?sport=nfl&game=<espn id>`.
  Sending does not use that page.

  Secrets (Supabase → Edge Functions → Secrets). Never commit the token:

  ```bash
  supabase secrets set \
    TELEGRAM_BOT_TOKEN="<bot token from @BotFather>" \
    TELEGRAM_CHAT_IDS="<numeric chat id, comma-separated>" \
    SPORTS_TELEGRAM_SECRET="$(openssl rand -hex 24)" \
    SPORTS_PUSH_ORIGIN="https://command-center-flax-gamma.vercel.app" \
    --project-ref esdgrgulaxnewmhjuyzh
  supabase functions deploy sports-telegram --project-ref esdgrgulaxnewmhjuyzh --no-verify-jwt
  ```

  `TELEGRAM_CHAT_IDS` is the allowlist. A request `chatId` must be on that
  list; omit it to send to every listed chat. Group ids are negative numbers.

  Render one live (or recent) game on your machine, without signing in:

  ```bash
  cd scripts && npm install
  node --experimental-strip-types heat-alert-photo.ts --sport nfl
  # optional real send — token stays in the environment
  TELEGRAM_BOT_TOKEN="…" TELEGRAM_CHAT_IDS="123" \
    node --experimental-strip-types heat-alert-photo.ts --sport nfl --send --reason "One-score game"
  ```

  The same render through the deployed function (POST required to send):

  ```bash
  curl -X POST "$SUPABASE_URL/functions/v1/sports-telegram" \
    -H "Content-Type: application/json" \
    -H "x-sports-telegram-secret: $SPORTS_TELEGRAM_SECRET" \
    -d '{"action":"render","sport":"nfl"}' \
    -o heat-alert.png
  ```

  `action` is `render` (PNG back) or `send`. `reason` is the short heat line
  from RUWT. `gameId` is the ESPN event id; omit it to take the best live game.
  Fonts are SIL OFL (`supabase/functions/_shared/heat-alert/fonts`). Regenerating
  the embedded copies after a font change: `python3 scripts/embed-heat-alert-assets.py`.

  The sweep runs every two minutes from `pg_cron` once the same cron secret
  is in Vault as `sports_push_cron` (alongside the existing `project_url` and
  `anon_key` secrets). Re-run the schedule block in
  `supabase/migrations/20261003_sports_push.sql` after the vault secret exists.
  On iPhone, open the installed Sports app once after deploy, then allow alerts
  from the board or Customize. A denied permission stays off until iOS Settings
  → Notifications → Sports.

- **Finals and Stats** — Telegram photos when a tracked game goes final.
  Bot `@FinalsAndStats_bot`. Token secret `TELEGRAM_FINALS_BOT_TOKEN` (not the
  heat bot’s `TELEGRAM_BOT_TOKEN`).   The graphic is the post-game page: score,
  logos, records, linescore, team stats, box leaders, the win-probability
  chart when ESPN has a series, and each club’s division or conference
  standings beside that chart (full-width WP if standings are missing).
  The live field is left out. Canvas is 1080×~1350. Samples:
  `artifacts/` and `docs/sports-finals/`.

  Which games fire (`TELEGRAM_FINALS_SCOPE`, default `favorites,ruwt`):

  - `favorites` — teams in `TELEGRAM_FINALS_FAVORITES` (`nfl:CLE`, `cfb:333`,
    team id or abbreviation). If that secret is unset, favorites are the ones
    already stored on sports-push subscriptions with favorite alerts on.
  - `ruwt` — the game was hot on the live-drama line while it was in progress.
  - `all` — every final in `TELEGRAM_FINALS_SPORTS` (default
    `nfl,cfb,mlb,nhl` when the secret is empty).

  Claim scope stays `favorites,ruwt` unless you set `all`. A favorite
  team only fires when `TELEGRAM_FINALS_FAVORITES` lists it or a
  sports-push subscription has `favorite_alerts` on. Cardinals / Blues
  will not get a finals photo from favorites if `favorite_alerts` is
  false and the game was never `ever_hot`.

  The caption is a short narrative (winner, records, one highlight).
  Open game and RUWT board are Mini App (`web_app`) buttons. BotFather
  `/setdomain` is not required.

  The first time a game is seen, nothing sends, so a deploy does not photo
  finals already on the board. Chat allowlist `TELEGRAM_FINALS_CHAT_IDS`
  defaults to Josh’s DM `857547432`. A `chat_id` outside that list is refused.

  ```bash
  supabase secrets set \
    TELEGRAM_FINALS_BOT_TOKEN="<bot token from BotFather>" \
    TELEGRAM_FINALS_CRON_SECRET="$(openssl rand -hex 24)" \
    TELEGRAM_FINALS_CHAT_IDS="857547432" \
    TELEGRAM_FINALS_SCOPE="favorites,ruwt" \
    TELEGRAM_FINALS_SPORTS="nfl,cfb,mlb,nhl" \
    SPORTS_FINALS_ORIGIN="https://command-center-flax-gamma.vercel.app" \
    --project-ref esdgrgulaxnewmhjuyzh
  supabase functions deploy sports-finals --project-ref esdgrgulaxnewmhjuyzh --no-verify-jwt
  ```

  Put the same cron secret in Vault as `sports_finals_cron`, then re-run the
  schedule block in `supabase/migrations/20261004_sports_finals.sql`. The sweep
  is every two minutes. `TELEGRAM_FINALS_CRON_SECRET` may fall back to
  `SPORTS_PUSH_CRON_SECRET`, and the header `x-sports-push-cron` is accepted.

  Test one final (records the send so the sweep will not repeat it). `render`
  returns the PNG and does not text anyone. `record:false` skips the sent log.

  ```bash
  curl -X POST "$SUPABASE_URL/functions/v1/sports-finals" \
    -H "Content-Type: application/json" \
    -H "x-sports-finals-cron: $TELEGRAM_FINALS_CRON_SECRET" \
    -d '{"action":"send","sport":"nfl","eventId":"401872964"}'
  ```

  **Evening preview** — one Telegram photo around 5:00pm America/Chicago with
  tonight's top not-started games (MLB / NFL / NHL / CFB / soccer). Ranking is
  a Deno port of RUWT Today's Top (`rankRuwtGames`, `rankRuwtNflGames`,
  `rankRuwtNhlGames`, `rankRuwtCfbGames`, `rankRuwtSoccerGames`). Live heat and
  `sports_push_game_state.drama_score` are not used. Cap is 8 (board target;
  the RUWT section default is 6). Window is send time through ~1:30am CT so
  late West Coast games count. Empty slate skips the send. Idempotent once per
  Chicago date via `sports_finals_preview_sent`.

  Cron job `sports-finals-evening-preview` is in
  `supabase/migrations/20261005_sports_finals_preview.sql`. Same Vault secret
  and `x-sports-finals-cron` header as the sweep. The schedule is `0 17 * * *`
  with `timezone = America/Chicago` when pg_cron has that column; otherwise it
  falls back to `0 22 * * *` UTC (5pm CDT / 4pm CST).

  ```bash
  curl -X POST "$SUPABASE_URL/functions/v1/sports-finals" \
    -H "Content-Type: application/json" \
    -H "x-sports-finals-cron: $TELEGRAM_FINALS_CRON_SECRET" \
    -d '{"action":"evening-preview","dryRun":true}'

  curl -X POST "$SUPABASE_URL/functions/v1/sports-finals" \
    -H "Content-Type: application/json" \
    -H "x-sports-finals-cron: $TELEGRAM_FINALS_CRON_SECRET" \
    -d '{"action":"evening-preview","render":true}' \
    -o evening-preview.png
  ```

- **Blues goal highlights** — Telegram `sendVideo` of NHL goal MP4s to a
  private DM. Bot `@CommandCenterHighlights_bot`. Token secret
  `TELEGRAM_HIGHLIGHTS_BOT_TOKEN` (not the heat or finals bots). Clips come
  from the same NHL gamecenter + Brightcove path the Sports app already uses
  (`highlightClip` on `api-web.nhle.com`, then a progressive MP4). A clip is
  sent only when the scoring team — landing abbrev, and play-by-play
  `eventOwnerTeamId` when that feed is up — is in `HIGHLIGHTS_TEAM_IDS`
  (default `STL` / id 19). Opponent goals, empty-net goals, own goals, and
  `discreteClip` stand-ins are skipped.

  Each Brightcove id is claimed in `sports_highlights_sent` before send, so a
  cron rerun is safe. Caption is short (`Blues score — Player vs OPP`). If the
  ESPN event id resolves, the message includes an **Open game** Mini App
  button. When NHL provides `highlightClipSharingUrl`, a **Watch clip** link
  opens that page.

  Game wraps are never `sendVideo`. When the right rail has `threeMinRecap`
  (otherwise `condensedGame`) for a finished Blues game, the bot sends one
  text message, or a photo when Brightcove has an https poster. The keyboard
  matches heat and finals: **Open game** and **RUWT board**, both Mini App
  `web_app` buttons. Open game goes to `/sports/nhl/game/{espnId}?solo=1` on
  `SPORTS_HIGHLIGHTS_ORIGIN` — that page is where the wrap plays. There is no
  separate wrap route. If the ESPN id is missing, RUWT still ships alone.
  The wrap MP4 is not downloaded. Heat / finals / newspaper / Times are unchanged.

  Secrets for Josh (Supabase project `esdgrgulaxnewmhjuyzh`). Never commit:

  ```bash
  supabase secrets set \
    TELEGRAM_HIGHLIGHTS_BOT_TOKEN="<bot token from BotFather>" \
    TELEGRAM_HIGHLIGHTS_CHAT_IDS="857547432" \
    TELEGRAM_HIGHLIGHTS_CRON_SECRET="$(openssl rand -hex 24)" \
    HIGHLIGHTS_TEAM_IDS="STL" \
    SPORTS_HIGHLIGHTS_ORIGIN="https://command-center-flax-gamma.vercel.app" \
    --project-ref esdgrgulaxnewmhjuyzh
  supabase functions deploy sports-highlights --project-ref esdgrgulaxnewmhjuyzh --no-verify-jwt
  ```

  Put the same cron secret in Vault as `sports_highlights_cron`, then re-run
  the schedule block in `supabase/migrations/20261005_sports_highlights.sql`.
  The sweep is every two minutes. `TELEGRAM_HIGHLIGHTS_CRON_SECRET` may fall
  back to `SPORTS_PUSH_CRON_SECRET`, and the header `x-sports-push-cron` is
  accepted. Optional: `HIGHLIGHTS_LOOKBACK_HOURS` (default 72),
  `HIGHLIGHTS_MAX_SENDS` (default 6).

  One-clip dry-run (resolves a live MP4, does not text anyone, no token):

  ```bash
  node --experimental-strip-types scripts/highlights-send-one.ts
  ```

  One real test video to Josh's DM `857547432`. Run this on a machine that has
  the bot token. It sends that single clip and then stops. It does **not**
  write `sports_highlights_sent`, so the first cron sweep will send the same
  clip again unless you claim it (edge `send` below does claim).

  ```bash
  TELEGRAM_HIGHLIGHTS_BOT_TOKEN="<@CommandCenterHighlights_bot token>" \
    node --experimental-strip-types scripts/highlights-send-one.ts \
    --send --clip 6406147120112 --nhl-game 2026020020
  ```

  That clip is Mason McTavish vs DAL (NHL `2026020020`, ESPN `401891782`).
  Brightcove URLs are signed and expire, so re-run the script instead of
  pasting an old `mp4` into Telegram.

  After the function is deployed, the same one-clip test through the edge
  function claims the id (cron will not repeat it). Omit `clipId` only when
  you mean every unsent goal in that game.

  ```bash
  curl -X POST "$SUPABASE_URL/functions/v1/sports-highlights" \
    -H "Content-Type: application/json" \
    -H "x-sports-highlights-cron: $TELEGRAM_HIGHLIGHTS_CRON_SECRET" \
    -d '{"action":"send","nhlGameId":"2026020020","clipId":"6406147120112","dryRun":true}'

  curl -X POST "$SUPABASE_URL/functions/v1/sports-highlights" \
    -H "Content-Type: application/json" \
    -H "x-sports-highlights-cron: $TELEGRAM_HIGHLIGHTS_CRON_SECRET" \
    -d '{"action":"send","nhlGameId":"2026020020","clipId":"6406147120112"}'
  ```

  List every recent Blues MP4 without sending:

  ```bash
  curl -X POST "$SUPABASE_URL/functions/v1/sports-highlights" \
    -H "Content-Type: application/json" \
    -H "x-sports-highlights-cron: $TELEGRAM_HIGHLIGHTS_CRON_SECRET" \
    -d '{"action":"sweep","dryRun":true}'
  ```

  Local unit check without Telegram:

  ```bash
  node --experimental-strip-types supabase/functions/sports-highlights/sports-highlights.test.ts
  ```

### Why changes can feel “stuck”

1. **Two ships** — Vercel updates the UI; Supabase edge updates feed extraction /
   contracts / Kalshi proxies. Merging a PR is not enough if edge wasn’t deployed.
2. **Twin source trees** — `supabase/functions` and
   `CommandCenter-main/supabase/functions` must match. Edit one, deploy the other,
   and production stays on old behavior.
3. **Client caches** — Dispatch/React Query keep feeds for ~90s and articles longer;
   contract lookups cache up to 24h in `sessionStorage`. Tap the logo twice to
   hard-reload the PWA after a deploy.
4. **Open PR sprawl** — work sitting on agent branches never reaches the Vercel
   production branch until it merges to `main`.

**Ship checklist:** merge to `main` → confirm Vercel deploy → confirm edge
workflow (or run `supabase functions deploy rss sports`) → hard-reload the app.

### Thompson Times AI editor

Once per press, after the stories are filed and deduped, `pressStep`
(`src/lib/newspaper-compose.ts`) sends the top 24 **news** stories (team news
`news-*`, league news `league-*`, The Athletic `athletic-*`: headline, dek, a
short snippet, club, league, status, source, rule rank) to `newspaper-editor`.
Game wraps (`wire-*`, `recap-*`, `recent-*`, `wrap-*`) never count against
that budget: the rule desk files one for every game, and the editor sees up to
16 of them only as context. Grok answers with up to three A1 front picks (news
or a game), an order for the news, and a news spike list. The answer is stamped
onto the filed stories (`editorFront`, `editorRank`, `editorSpiked`) and saved
as the `tt-editor` query, so every device that opens the edition sets the same
front. `buildEdition` reorders the news inside the slots the rule desk gave
news; wraps keep their places. Box scores, schedules, standings, leaders,
weather and agate never go through the editor.
If the call fails, times out (60s), or returns ids it was never shown, the
stories file unstamped and the rule desk (`storyRank`) sets the paper exactly
as before. A device that sets the paper itself first adopts the press's filed
copy if it exists, otherwise asks the editor with the reader's session.

Setup:

```bash
# Same key book-ai uses. Supabase secret only — never Vercel / VITE_.
supabase secrets set XAI_API_KEY=xai-... --project-ref esdgrgulaxnewmhjuyzh
# The function checks the caller itself (service-role key or a signed-in user).
supabase functions deploy newspaper-editor --project-ref esdgrgulaxnewmhjuyzh --no-verify-jwt
# The press worker runs the bundle stored in private.press_bundle, so after a
# bundle rebuild (node scripts/bundle-newspaper-press.mjs) replace those rows
# and redeploy newspaper-press.
```

Kill switch: `supabase secrets set NEWSPAPER_EDITOR=off` makes the press skip
the call.

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
  alone covers roughly half the library. Brand-new bestsellers missing from both
  still enrich via a free DuckDuckGo ISBN sniff + Google Books HTML scrape
  (`backfill-covers`). Google jacket fetches must try zoom=4 (not only zoom=0):
  new titles often return a grayscale stub at zoom=0/3.
- **Readwise calls everything a "book."** Articles, tweets and podcasts come
  back from the same `/export/` endpoint; only `category === "books"` is
  matched against the library. Matching is on a normalised title (subtitle
  dropped — Readwise stores the cover title) plus author surname, and a bare
  title shared by two library books is treated as no match rather than a
  guess.
- **Web search results carry citations, and citations are rejected alongside
  `output_config.format`.** So `book-ai` uses structured outputs for
  recommendations (no tools) and a parsed JSON block for search (web search) —
  combining the two 400s.
- **Open Library has no usable series data.** 0 of 2,635 books returned a
  `series` field, and only 11 titles carry a parseable parenthetical, so series
  and fiction/non-fiction both come from the model (`book-ai` mode `classify`),
  batched with `classified_at` as the bookmark.
- **Storage serves covers with `access-control-allow-origin: *`**, which is
  what lets the highlight card export a jacket-backed image — a canvas that
  draws a cross-origin image without CORS taints and throws only at
  `toBlob()`. An image load also needs its own timeout: `onerror` does not fire
  for a connection that stalls rather than refuses, which silently produced a
  blank card.
- **Third-party keys belong in Supabase, never Vercel.** Anything prefixed
  `VITE_` is compiled into the bundle and shipped to every browser. That applies
  to `TODOIST_API_TOKEN`, `GOOGLE_BOOKS_API_KEY`, `XAI_API_KEY`, and
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

Rebuilt pages: Login, Dashboard, Todos, Habits, Reading, RSS, Sports — "Capitol" theme (navy
and red, engraved star field, Playfair Display + Libre Franklin).

Not yet rebuilt — the schema supports them, the UI does not exist yet: Focus,
Calendar/TimeBlock, Stats, Notes, Braindump, Daily Summary, Weather, CRM.

The FastAPI backend in `CommandCenter-backend/` is **retired** and no longer
called by the frontend. It is kept only for reference until the rebuild is
complete.
