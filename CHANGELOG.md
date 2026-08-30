# CommandCenter Changelog

---

## CFB coaches: Wikipedia bios + fix broken headshots — August 30, 2026

- Coach pages no longer invent ESPN player-CDN portrait URLs (those 404’d into a broken question-mark image). Missing portraits fall back to the team logo or initials.
- Pull Wikipedia profile text, bio facts (born / hometown / alma mater), and full playing + coaching career path; enrich assistant coordinators with short wiki bios and portraits when available.

---

## Sports UI fixes: boards, CFB ranks, WAR — August 27, 2026

- **Dispatch boards:** Stop stripping repeated standings logos and leader headshots (WHIP/Last-N tables). Rename “form” → **recent records**. Compact reader mode drops the empty “MLB Stats API” hero. Scoreboard leads with yesterday’s finals (full inning box scores), then today/upcoming.
- **Player cards:** Newest news only (cross-source RotoWire/RotoWorld dedupe). Tighter tablet hero spacing. “Form” → “Recent”. Client-side BBRef WAR dump fallback when the sports edge returns blank (e.g. Tristan Peters).
- **CFB:** Top-25 poll ranks stay bold; everyone else shows smaller **FPI #N**. Pregame game pages show odds/predictor/last-5 instead of a blank page. Teams are clickable via new `/sports/cfb/team/:id` pages.

---

## Fetch book info for brand-new bestsellers — August 25, 2026

- **Enrichment miss:** Open Library often has no record yet for just-released titles, and the Google Books JSON API rate-limits anonymous callers. `backfill-covers` now sniffs an ISBN via DuckDuckGo lite and scrapes Google Books' public HTML page (blurb, page count, publisher, year, jacket) — still free, no API key.
- **Google jackets:** Reject the grayscale "no preview" stub and try zoom=4/2/1 when zoom=0 is empty art, so new covers actually store.
- **CI:** Edge deploy workflow now ships `backfill-covers` / `book-ai` (and the other reading functions), not only `rss` + `sports`.

---

## Team pages: BBRef detail, win trend, TV logos — August 22, 2026

- **Team overview:** Baseball-Reference org block on MLB team drawers now reliably includes manager (fixed `Manager:` scrape), president, farm/scouting directors, ballpark, attendance, park factors, Pythagorean W-L, and BBRef playoff odds (postseason + World Series) with a Schedule and Results link.
- **5-year win trend:** Horizontal win-total bars for the last five regular seasons on every MLB team drawer.
- **RUWT TV logos:** Replace the blank ESPN MLB.TV chip with the MLB league mark; map club `.TV` streams and RSNs (Marquee, KING 5, YES, NESN, etc.) to team/league icons so chips are no longer logo-less.

---

## RUWT: Premier League interest sliders — August 22, 2026

- Soccer **Rank teams** now always lists all Premier League clubs (static ESPN roster fallback when the live teams API fails), not just Wrexham and Wolves.

---

## MoScout inline highlights — August 23, 2026

- Restore DOM highlight painting after article render so saved quotes show red inline marks in Missouri Scout (and other Dispatch) articles, not only in the Notes panel. Game wraps and previews get the same fix via `SelectableHighlightRegion`.

---

## Team page polish — August 22, 2026

- **Baseball-Reference:** Org overview card always renders (with BBRef link + fallback when scrape fails) instead of disappearing silently.
- **Record readability:** Header record uses cream text instead of dark team-color on navy.
- **5-year win trend:** WC / DIV / LCS / WS badges on seasons that earned them.
- **Team stats:** Hitting and pitching tiles show MLB rank (e.g. “3rd in MLB”).
- **Roster & results:** Upcoming, Recent, and Roster sections collapse by default — tap to expand.

---

## Wrong MLB wrap + WAR dump — August 19, 2026

- **Wrong game wrap:** ESPN game summaries put other clubs’ recaps on the news rail. Dispatch was picking the longest story, so a Dodgers–Rockies wrap opened with a Jo Adell / Guardians headline and photo. Wraps now keep only copy that mentions both teams.
- **WAR:** Player-card WAR no longer depends on Cloudflare-blocked BBRef HTML. The sports edge reads Baseball-Reference’s daily bat+pitch WAR dumps (two-way totals summed), returns them on a fast `playerWar` action, and the card uses that before the slower extras scrape. Ohtani-style two-way seasons show combined WAR.

---

## RUWT: drop hero, show TV, today-only soccer — August 19, 2026

- Remove the large RUWT hero (“Best games right now”) — keep sport filters + Rank/Refresh only.
- TV network chips always show the network name (logos when available); MLB matches ESPN via abbrev aliases (CWS↔CHW).
- Soccer RUWT is strict Chicago-today only (no undated / next-fixture spill like Watford–Wrexham on 8/22).

---

## RUWT TV networks + today-only; WAR edge deploy — August 19, 2026

- RUWT game cards show TV/stream networks (MLB.TV OK) with logos when ESPN provides them.
- RUWT boards are Chicago **today only** for MLB, NFL, and soccer (no multi-day soccer slate).
- Player WAR: FanGraphs leaders run in parallel with BBRef inside `playerExtras`; drop the soft-timeout race that could return blank WAR while the scrape was still running; deploy the sports edge function with the full source (not a stale GitHub pin).
- **Burleson blank-WAR fix:** BBRef fetch falls back through `allorigins` when Cloudflare blocks the edge IP; contract scrape also returns season/career WAR; player card prefers BBRef service time (`3.029`) over ESPN “5th Season” and can display WAR from the contract payload when extras is empty.

---

## MLB wraps: wait for recap text; wrap link contrast; game/season lines — August 19, 2026

- **Why wraps wait for recap text:** Scoreboard-only “Final: SCORE” stubs used to keep MLB/Cardinals Dispatch feeds full when ESPN lagged. Those items opened empty readers. Previews already required written ESPN copy; finals now use the same bar — list a wrap only when ESPN has real recap prose (and prefer `news.articles` when `article.story` is empty).
- Wrap story links use light `#eef3ff` again (a layout revert had put accent red back on in-body player/story links).
- Favorite players and Top prospects cards show game lines as **H-AB** (e.g. `0-5`) plus extras, and a **Season** line (AVG/HR/RBI or W-L/ERA/SV).

---

## Game preview + player card fixes — August 18, 2026

- ESPN last-5: match AZ↔ARI (and other abbrev aliases) / team ids so both clubs load.
- Player splits: keep all columns aligned when vs L/R omit `runs` (no more shifted HR/AVG).
- “How he arrived”: prefer draft over same-club signing for draft signees.
- Game preview: stack both lineups (with logos) and both batting + pitching leaders (no tabs).

---

## Standings: Leaders above Wild Card (MLB.com layout) — August 18, 2026

- Notes aside pairs **NL/AL Leaders** (E/C/W) directly above each league’s wild-card board.
- Leaders tables use the same W/L/PCT/WCGB/L10/STRK/DIFF columns as wild card.
- Dispatch standings article includes the same Leaders → Wild Card blocks.

---

## ESPN game extras: logos + clickable games — August 18, 2026

- Matchup predictor, last 5, season series, team stats, and injuries show team logos (`TeamMark`).
- Last 5 and season-series rows link to the MLB game page (schedule `gamePk` hydration, with ESPN event-id fallback).

---

## Remove RotoWorld Dispatch feed — August 18, 2026

- Drop the **RotoWorld player news** synthetic feed from Dispatch (MLB folder / Unread).
- RotoWorld notes stay on MLB player pages (and tagged-player Dispatch items) via the existing sports scrape.

---

## MLB WAR + ESPN game preview extras — August 18, 2026

- WAR: stop skipping Baseball-Reference year rows that use `colspan` spacers (that blanked season WAR); hero chip falls back to career WAR when season is missing; extras cache key bumped to `v4`.
- Game preview order: probables / lineups / leaders first, then ESPN preview text, then ESPN extras (matchup predictor, last 5, season series, team stats, injuries), then Baseball-Reference matchups.

---

## Dispatch: center articles, standings leaders, RotoWorld, results cards — August 18, 2026

- Article / ESPN game / MLB game reader shells center with `mx-auto` + `justify-self-center` (sidebar stays put); arrow-key prev/next via `useArticleNavKeys` on article, ESPN game, MLB game, and player shells (blocked when lightbox/quote open).
- Notes aside: NL/AL division leaders (`- E` / `- C` / `- W`) above wild-card tables; standings rows carry WCGB / L10 / run diff.
- Reader body links, player links, and game/player kickers use bold cream (`#fffaf5`); chrome accent red unchanged. Recap/story cache keys bumped (`mlb-game-recap-v5`, `espn-story-fallback-v2`).
- RotoWorld player news on MLB player pages from NBC Sports listing HTML (`PlayerNewsPost`); `rotoWorldNews` sports action; tag feeds merge board notes with unique `app:mlb-player/{id}?n=…` links (RotoWire vs RotoWorld no longer soft-hide each other).
- MLB daily **results** as ESPN-style cards: logos beside names, R/H/E, extras, W/L/S mugs + season lines, cream Watch/Wrap/Box/Story; hero uses MLB league logo (results logos/mugs skipped by `firstContentImageUrl`).
- ESPN fetches prefer `site.web.api` then `site.api` (longer story wins); preview candidates sliced before finals so `maxItems` does not drop today; hollow vs/records stubs rejected.
- Soccer: standings logos in white discs; wraps `lookAheadDays: 1`; preview shows full ESPN story alone when long enough (cream header).

---

## MLB previews require ESPN text — August 18, 2026

- MLB wraps/previews feeds only list a preview when ESPN has written preview copy (no scoreboard pitcher/time stubs).
- Game readers omit the preview story card until ESPN publishes one; probables and leaders still show.
- Cardinals edge wrap feed uses the same preview-text gate.

---

## MLB player WAR scrape — August 18, 2026

- Fix Baseball-Reference WAR parsing: the value-table slice was truncating on `entity-id="…"`, so season/career WAR never loaded.
- Read WAR from full value/standard tables (including bold leader cells) and trust the MLB-id redirect page.
- Browser fallback fills WAR when the sports edge still returns blanks; player extras cache key bumped to v3.

---

## MLB ESPN preview text — August 18, 2026

- Stop treating ESPN's league news rail as a game preview (the fantasy-hitter "Stay ahead of the game…" blurb).
- When ESPN has no written preview, build one from the summary: series, probables, last five, matchup predictor, weather, and recent availability.
- Recap fetch falls back to `site.web.api.espn.com` when `site.api` is blocked.

---

## MLB manager Kalshi odds — August 18, 2026

- Restore **Next fired** Kalshi odds on MLB managers (list, hot seat, manager detail), with a direct Kalshi client fallback when the sports edge returns empty.
- Add **Manager of the Year** (AL/NL) Kalshi odds as a safety signal on the same surfaces; MOTY % lowers hot-seat heat.
- Sports edge: harden next-fired scrape (more markets, better name fields) and add `managerMotyOdds`.

---

## MLB feed, contracts, extracts — August 18, 2026

- MLB wraps list today's (and tomorrow's) game previews from the scoreboard when ESPN has no story yet — probable pitchers, records, and first-pitch time.
- League-leader cards keep player names readable (dark text on the white list; reader Tailwind no longer hides them).
- Daily standings/results tables use tighter, even row spacing so division boards don't float apart on mobile.
- The MLB folder gets a daily **MLB results** article with every final (and remaining games).
- MLB.com news extracts prefer the real article body (JSON-LD / AMP) instead of a one-paragraph teaser; the reader has a **Re-extract** button when a pull is thin or fails.
- “How he arrived” is the signing, draft, or trade into the organization — not a later call-up. Call-ups stay on the transaction list.
- Contract cards infer minor-league / selected-from-minors status when Spotrac/BBRef have no salary table, and scrape more salary shapes.
- Manager hero / résumé chips count AL/NL Manager of the Year only; the awards list under Career résumé still shows Carolina and other MiLB MOTY.
- Game wraps add a **Favorite players in this game** card (same layout as top prospects) for favorited players who appeared.

---

## MLB previews, player WAR/tags, soccer extracts, sidebar odds — August 16, 2026

- MLB game previews keep existing ESPN stats and add Baseball-Reference matchups: team form splits, season series, batter/pitcher tables, and a link to the full BBRef preview.
- Player hero: Favorite/tags sit on the open line under Born (School is text-only); Favorite always uses the starred pill; favorite query keys invalidate correctly.
- WAR/contract scrapes validate BBRef player pages against the requested name and pass MLB ids; acquisition story prefers the trade/signing that brought the player to his **current** team; transaction list includes “Signed as Free Agent” and sorts newest-first.
- Season-stat ranks use the full player pool so poor ranks still show.
- Soccer match/preview extracts use ESPN summary APIs (real copy or structured match card — not mashed scoreboard text). Club wraps include Arsenal and look ahead for upcoming previews.
- Dispatch wrap/preview readers keep the Notes sidebar; Cardinals playoff odds sit under Cardinals games.

---

## Org + Top-100 prospect ranks, MLB Top Prospects section — August 16, 2026

- Keep organization Pipeline ranks and MLB Top-100 ranks separate on players (hero, scouting, box scores).
- Prospects page: Cardinals org rankings plus a full **MLB Top Prospects** (Top 100) section.

---

## Player hero: tags on School, season stats in card — August 16, 2026

- Restore bio grid on the hero (HT/WT, Bat/Thr, etc.) with Age + WAR chips only.
- Tags sit on the same line as School (no separate Labels block under the card).
- Top-four season stats (W-L/ERA/SO/WHIP or AVG/HR/RBI/OPS) embed in the hero below Born.

---

## Pre-extract Dispatch articles — August 16, 2026

- Idle feed lists warm the next ~10 extracts into React Query (unread first).
- While reading, next/prev neighbors are prefetched so swipe-next is already cached.
- Client sessionStorage + edge in-memory extract cache (~45 min) so repeat opens skip a cold scrape.

---

## Harden wraps so feeds never go empty — August 16, 2026

- If an ESPN summary fetch fails or preview copy is hollow, wrap feeds still emit scoreboard stubs (Final / Preview / Live) instead of dropping the game.
- Soccer-bleed filter no longer runs on wrap feeds (it was meant for news wires only).

---

## Restore MLB wraps & previews feed — August 16, 2026

- Wrap feeds no longer import the heavy sports module (that path could stall and return 0 articles).
- ESPN scoreboards try site.api → site.web → sports-edge; MLB/Cardinals/EPL wraps keep score stubs when recap copy lags.

---

## Dispatch wraps, MiLB, prospects, standings — August 16, 2026

- Filter AP/Data Skrive auto-wires (and FanDuel game-update stubs) out of Cardinals/MLB feeds.
- Clean mashed article titles (trailing URLs) and scrub Pre-Gamin / game-thread chrome.
- MLB standings digest: keep team logos tiny (no full-bleed hero from the first logo).
- MLB / NFL / soccer wraps route ESPN scoreboards through the sports edge when Akamai blocks the browser; Wrexham & Wolves pull Championship + PL boards.
- Farm wraps: Single-A and up only; affiliate logos on every recap; L5/L10/L20 works for MiLB teams.
- Prospects: prefer league Top-100 ranks (org Top-30 always has a fallback number); new “Top prospects in this game” section on box scores.

---

## Player profile: WAR deploy, tags, double-tap — August 16, 2026

- Deploy sports edge WAR scrape (MLB id redirect + year-row parse; skip league-rank timeout) so hero WAR stops showing `—`.
- Tagged RotoWire player articles: double-tap advances to the next item (same as other Dispatch readers).
- `#Favorite` merges with the starred Favorite pill; adding “Favorite” favorites the player instead of a sky tag.
- Player hero: HT/WT, Bat/Thr, Birthdate, and Born move into hero chips; labels sit inline under School.

---

## WAR, soccer RUWT, golf embeds, promotion odds — August 15, 2026

- MLB player WAR: resolve Baseball Reference via MLB id redirect, parse current-season WAR from year rows, and skip the slow league-rank scrape so the hero chip stops timing out to `—`.
- Golfer ESPN clips embed in-app from MP4 sources (tap to play) instead of only linking out.
- Soccer RUWT: resilient ESPN fetch, multi-day + open slate when today is empty, and always include Wrexham / Wolves next fixtures.
- Wrexham & Wolves show Championship promotion odds (Polymarket when live, else ESPN projected finish → implied odds) on board cards and team drawers.
- Soccer team drawers: table with GD/Pts + promotion zones, club form chips, promotion odds panel, and roster grouped with headshots.

---

## Soccer feeds, RUWT, golf cleanup — August 15, 2026

- Wrexham / Wolves favorites use Championship (`eng.2`) paths; team cards hide hollow `0-0-0`, fill standings from the table, and backfill last/next from schedule + scoreboard days.
- New Dispatch **Soccer** folder: Wrexham & Wolves wraps/previews, plus Premier League wraps using the same rules as MLB wraps.
- RUWT adds a Soccer filter with Premier League interest sliders plus seeded Wrexham / Wolves.
- Golfer cards: headshot URL fallbacks, most-recent round/event for scorecards, scorecard removed from Overview, hole play-by-play list removed.

---

## Standings feeds, wrap spacing, tags — August 15, 2026

- MLB standings and league leaders are separate Dispatch articles; standings tables include team logos and fixed W-L columns.
- League leaders render as team-leader-style cards, split by AL/NL, with clickable player links.
- New **MLB form standings** feed ranks the full league over the last 5 / 10 / 20 / 30 / 40 / 50 games.
- Game headers use league rank (“12th in National League”) instead of a vague “in league” division place.
- Game wrap spacing no longer eats spaces around linked names; top performers sit under the linescore.
- Favorite vs tag markers differ (star vs blue dot / sky pills); team-lead stats are italic blue, not bold.
- Player hero always shows a WAR chip; NFL previews wait for real copy and drop Last 5/10/20 chips.

---

## Sports polish batch — August 15, 2026

- Yesterday favorites on the MLB board are baseball-only (golf stars no longer show as DNP).
- Golf leaderboard: Today shows the most recent completed round between rounds; Thru shows F when play is complete; Rn column tracks the latest round.
- Golfer cards: scorecard tables + hole play-by-play results (Par/Birdie/…) without the fake map; shot yardage isn’t in public ESPN data.
- NFL player cards pull a fuller ESPN/core bio when available.
- Manager detail no longer rebuilds the full 30-team hot-seat board first (cache + lite path); tenure probes run in parallel.
- Dispatch: ESPN story URLs load full `now.core` body text; Cardinals feeds drop articles that never mention the club.
- Team sidebar: Standings above Leaders; standing text uses “3rd in National League Central”; form chips spell out Last 5 / Last 10 / Last 20.
- MLB game: wrap sits under the linescore; hero drops H/E for a cleaner score focus.

---

## Golf: kill fake map, videos, RotoWire notes — August 15, 2026

- Removed the fake hole-map / play-by-play board from golfer cards (no TourCast shot-trail data in public APIs). Scorecard tab is traditional front/back-9 tables only.
- Wired ESPN golfer highlight clips into Overview + News & Video.
- Added after-round RotoWire notes on the golfer Overview (sports edge scrape of rotowire.com/golf).

---

## Dispatch box score, hide, dedupe, taps — August 15, 2026

- NFL game wraps use the MLB-style matchup header (logos, centered score, no “Final · Final”).
- Box score (team logo circles / linescore) sits above wrap text; hero no longer repeats the wrap headline.
- L5 / L10 / L20 move into the teams box-score area; league rank sits under each record (9px).
- Soft-dedupe catches ESPN same-gameId URLs and same-scoreline recap vs feature pairs.
- Reader scrub strips share chrome, “Opens in new window”, and mashed breadcrumbs like SportsMLBCubs; hide phrases work on short list/nav chrome.
- Article list uses a full-row hit target; swipe listeners no longer capture touches ahead of taps.

---

## Highlight → save / hide text / block article — August 14, 2026

- Selection sheet in the article reader now offers three clear actions: **Save quote**, **Hide text**, or **Block article**.
- Block article adds a URL filter for that story and closes the reader.

---

## Sports UI + feed polish — August 14, 2026

- Quote share cards size to the full quote; brand with the article publisher (no “Dispatch”).
- Article reader chrome uses the publisher (The Athletic, ESPN, …) instead of “Dispatch” / “Original”.
- Always show an article header image (content image, team logos, or branded fallback); strip duplicate body images.
- Cardinals Wire filters out stories that never mention the Cardinals.
- ESPN wraps: team-logo thumbnails when story art is missing or fails to load.
- Game hero cards: L5 / L10 / L20 under each record; remove the separate Standings & form pair on MLB game pages.
- Sports home: move the “Your board” intro card to the bottom.
- Golf leaderboard: show next-round tee times instead of a premature “F”.
- Golfer cards: clearer hero portrait; remove overview article circles.
- Prospects: Yesterday lines for tagged players (same shape as MLB favorites).

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
