/**
 * Stage-11 merge must match the pre-split algorithm on a morning-sized slate.
 * Run with: node --experimental-strip-types src/lib/newspaper-press-merge.test.ts
 */
import { htmlToNewspaperText } from "./newspaper-copy.ts";
import { favoriteDeskWeight, isNewsMuted } from "./newspaper.ts";
import { hopSignature, checkpointBag } from "./newspaper-press-bag.ts";
import {
  attachRelatedGameCopy,
  attachRelatedGameCopyStep,
  isGameWrapCard,
  sameGameStory,
} from "./newspaper-sport-desk.ts";
import { storySource } from "./newspaper-source.ts";
import type { GameWrapCard } from "./newspaper-sports.ts";
import type { WireGame } from "./newspaper-wire.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function card(partial: Partial<GameWrapCard> & Pick<GameWrapCard, "id" | "headline">): GameWrapCard {
  return {
    favoriteKey: "",
    teamName: "",
    teamHref: "/",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    dek: null,
    body: null,
    scoreLine: null,
    when: null,
    won: null,
    gameHref: null,
    wrapHref: null,
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    ...partial,
  };
}

/** Snapshot of sameGameStory / attachRelatedGameCopy before the indexed rewrite. */
function eventIdOfLegacy(next: GameWrapCard): string | null {
  const raw = next.gameId ?? "";
  const fromId = raw.match(/(\d{6,})/)?.[1];
  if (fromId) return fromId;
  const href = `${next.wrapHref ?? ""} ${next.gameHref ?? ""}`;
  return href.match(/(?:gameId|event)[=/](\d{6,})/i)?.[1] ?? null;
}

const GAME_TOKEN_STOP = new Set([
  "beat", "over", "from", "with", "that", "will", "this", "have", "been", "were",
  "they", "into", "after", "week", "more", "than", "then", "when", "game", "win",
  "wins", "lead", "seals", "throws", "passes", "start", "best", "fuel",
]);

function teamTokensLegacy(next: GameWrapCard): string[] {
  return `${next.headline} ${next.scoreLine ?? ""} ${next.teamName}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !GAME_TOKEN_STOP.has(w));
}

function sameGameStoryLegacy(a: GameWrapCard, b: GameWrapCard): boolean {
  const idA = eventIdOfLegacy(a);
  const idB = eventIdOfLegacy(b);
  if (idA && idB && idA === idB) return true;
  if (a.leaguePath && b.leaguePath && a.leaguePath !== b.leaguePath) return false;
  if (a.scoreLine && b.scoreLine && a.scoreLine === b.scoreLine && a.leaguePath === b.leaguePath) {
    return true;
  }
  const ta = new Set(teamTokensLegacy(a));
  const tb = teamTokensLegacy(b);
  const shared = tb.filter((w) => ta.has(w));
  return shared.length >= 2 && Boolean(a.scoreLine || b.scoreLine || isGameWrapCard(a) || isGameWrapCard(b));
}

function isFeatureOutletLegacy(next: GameWrapCard): boolean {
  const source = (storySource(next) ?? next.caption ?? "").toLowerCase();
  if (source.includes("athletic") || source.includes("post-dispatch")) return true;
  return next.id.startsWith("athletic-") || /theathletic\.com|stltoday\.com/i.test(`${next.wrapHref ?? ""} ${next.feedUrl ?? ""}`);
}

function isPreviewCardLegacy(next: GameWrapCard): boolean {
  if (next.status && /\b(scheduled|pre-?game|preview)\b/i.test(next.status)) return true;
  if (next.wrapHref && /\/preview\b/i.test(next.wrapHref)) return true;
  if (/\bBOTTOM LINE:|\bLINE:\s|Data Skrive/.test(next.body ?? "")) return true;
  const head = `${next.headline} ${next.dek ?? ""}`;
  return (
    /\b(hosts?|visits?|face|take on|meet)\b.*\bto (start|open|begin|kick off)\b/i.test(head) ||
    /\b(preview|what to watch|how to watch|keys to the game|prediction)\b/i.test(next.headline)
  );
}

function wrapPreferenceLegacy(next: GameWrapCard): number {
  if (next.wrapKind === "espn" || next.id.startsWith("wire-")) return 0;
  if ((storySource(next) ?? "").includes("Associated Press")) return 1;
  if (next.wrapKind === "box") return 2;
  if (isGameWrapCard(next)) return 3;
  return 4;
}

function asRelatedLegacy(next: GameWrapCard) {
  return {
    id: next.id,
    headline: next.headline,
    href: next.wrapHref ?? next.gameHref,
    source: storySource(next) ?? next.caption ?? null,
  };
}

function attachRelatedGameCopyLegacy(cards: GameWrapCard[]): GameWrapCard[] {
  const wraps = cards.filter(isGameWrapCard);
  const rest = cards.filter((c) => !isGameWrapCard(c));
  const keptWraps: GameWrapCard[] = [];
  for (const next of wraps) {
    const idx = keptWraps.findIndex((prev) => sameGameStoryLegacy(next, prev));
    if (idx < 0) {
      keptWraps.push({ ...next, related: next.related ? [...next.related] : [] });
      continue;
    }
    const prev = keptWraps[idx]!;
    const nextWins = wrapPreferenceLegacy(next) < wrapPreferenceLegacy(prev);
    const winner = nextWins ? next : prev;
    const loser = nextWins ? prev : next;
    keptWraps[idx] = {
      ...winner,
      related: [...(winner.related ?? []), asRelatedLegacy(loser), ...(loser.related ?? [])],
    };
  }
  const leftover: GameWrapCard[] = [];
  for (const next of rest) {
    const wrap = keptWraps.find((w) => sameGameStoryLegacy(next, w));
    if (wrap && (isFeatureOutletLegacy(next) || isPreviewCardLegacy(next))) {
      wrap.related = [...(wrap.related ?? []), asRelatedLegacy(next)];
      continue;
    }
    leftover.push(next);
  }
  return [...keptWraps, ...leftover];
}

const NFL = [
  ["Chiefs", "Raiders", "KC", "LV", "nfl-kc"],
  ["Lions", "Cowboys", "DET", "DAL", "nfl-det"],
  ["Eagles", "Giants", "PHI", "NYG", ""],
  ["Packers", "Bears", "GB", "CHI", ""],
  ["Bills", "Jets", "BUF", "NYJ", ""],
  ["Ravens", "Steelers", "BAL", "PIT", ""],
  ["49ers", "Seahawks", "SF", "SEA", ""],
  ["Dolphins", "Patriots", "MIA", "NE", ""],
  ["Vikings", "Falcons", "MIN", "ATL", ""],
  ["Commanders", "Chargers", "WSH", "LAC", ""],
] as const;
const MLB = [
  ["Cardinals", "Cubs", "STL", "CHC", "mlb-stl"],
  ["Dodgers", "Brewers", "LAD", "MIL", ""],
  ["Yankees", "Red Sox", "NYY", "BOS", ""],
  ["Phillies", "Mets", "PHI", "NYM", ""],
] as const;
const NHL = [
  ["Blues", "Blackhawks", "STL", "CHI", "nhl-stl"],
  ["Avalanche", "Stars", "COL", "DAL", ""],
  ["Oilers", "Flames", "EDM", "CGY", ""],
] as const;
const CFB = [
  ["Missouri", "Florida", "MIZ", "FLA", "cfb-mizzou"],
  ["Georgia", "Alabama", "UGA", "ALA", ""],
  ["Ohio State", "Texas", "OSU", "TEX", ""],
  ["Missouri State", "Youngstown", "MOST", "YSU", "cfb-missouri-state"],
] as const;

function bodyFor(name: string, n: number): string {
  return `${name} won in a late drive. The bench emptied after a long night of football. `.repeat(n * 8);
}

function buildSlate(): { clubCopy: GameWrapCard[]; leagueNews: GameWrapCard[]; athletic: GameWrapCard[]; games: WireGame[] } {
  const clubCopy: GameWrapCard[] = [];
  const leagueNews: GameWrapCard[] = [];
  const athletic: GameWrapCard[] = [];
  const games: WireGame[] = [];
  let event = 401770000;

  const addGame = (
    leaguePath: string,
    sportLabel: string,
    away: string,
    home: string,
    awayAb: string,
    homeAb: string,
    fav: string,
    extraWraps: number,
  ) => {
    event += 1;
    const gameId = String(event);
    const score = `${awayAb} 27  ·  ${homeAb} 24`;
    const headline = `${away} beat ${home}`;
    clubCopy.push(
      card({
        id: `wire-${sportLabel.toLowerCase()}-${gameId}`,
        headline,
        scoreLine: score,
        gameId,
        leaguePath,
        sportLabel,
        favoriteKey: fav,
        followed: Boolean(fav),
        teamName: fav ? away : "",
        wrapKind: "espn",
        status: "Final",
        body: bodyFor(away, 12),
        wrapHref: `https://www.espn.com/${sportLabel.toLowerCase()}/recap/_/gameId/${gameId}`,
      }),
    );
    if (extraWraps) {
      clubCopy.push(
        card({
          id: `recap-${sportLabel.toLowerCase()}-${gameId}-box`,
          headline: `${away} ${home} box`,
          scoreLine: score,
          gameId,
          leaguePath,
          sportLabel,
          wrapKind: "box",
          status: "Final",
          body: bodyFor(home, 6),
        }),
      );
    }
    leagueNews.push(
      card({
        id: `athletic-${sportLabel.toLowerCase()}-${gameId}`,
        headline: `What the ${away}-${home} tape said`,
        caption: "The Athletic",
        gameId,
        leaguePath,
        sportLabel,
        wrapHref: `https://www.nytimes.com/athletic/${gameId}`,
        body: bodyFor(away, 8),
      }),
    );
    leagueNews.push(
      card({
        id: `news-${sportLabel.toLowerCase()}-${gameId}-preview`,
        headline: `${away} preview: what to watch against ${home}`,
        leaguePath,
        sportLabel,
        wrapHref: `https://www.espn.com/${sportLabel.toLowerCase()}/preview/_/gameId/${gameId}`,
        status: "Preview",
        gameId,
      }),
    );
    games.push({
      id: gameId,
      eventId: gameId,
      path: leaguePath,
      league: sportLabel,
      sportLabel,
      round: null,
      series: null,
      postseason: false,
      preseason: false,
      final: true,
      live: false,
      statusDetail: "Final",
      startedAt: "2026-10-05T17:00:00Z",
      day: "2026-10-05",
      away: {
        id: null,
        name: away,
        short: away,
        abbrev: awayAb,
        score: "27",
        record: "4-1",
        winner: true,
        logo: null,
        color: null,
        seed: null,
      },
      home: {
        id: null,
        name: home,
        short: home,
        abbrev: homeAb,
        score: "24",
        record: "3-2",
        winner: false,
        logo: null,
        color: null,
        seed: null,
      },
      headline,
      body: bodyFor(away, 4),
      dateline: "KANSAS CITY",
      photo: null,
      href: `https://www.espn.com/game/_/gameId/${gameId}`,
      leaders: [],
      favoriteKeys: fav ? [fav] : [],
      wrapKind: "espn",
    } as WireGame);
  };

  for (const [away, home, awayAb, homeAb, fav] of NFL) {
    addGame("football/nfl", "NFL", away, home, awayAb, homeAb, fav, 1);
  }
  for (const [away, home, awayAb, homeAb, fav] of MLB) {
    addGame("baseball/mlb", "MLB", away, home, awayAb, homeAb, fav, 1);
  }
  for (const [away, home, awayAb, homeAb, fav] of NHL) {
    addGame("hockey/nhl", "NHL", away, home, awayAb, homeAb, fav, 0);
  }
  for (const [away, home, awayAb, homeAb, fav] of CFB) {
    addGame("football/college-football", "CFB", away, home, awayAb, homeAb, fav, 1);
  }

  // Token-only matches (no shared event id) and leftover news so the slate is morning-sized.
  for (let i = 0; i < 40; i++) {
    clubCopy.push(
      card({
        id: `wire-nfl-token-${i}`,
        headline: `Sunday notes ${i} Chiefs Raiders leftover`,
        scoreLine: i % 2 === 0 ? "KC 30 · LV 27" : null,
        leaguePath: "football/nfl",
        sportLabel: "NFL",
        wrapKind: "espn",
        body: bodyFor("notes", 5),
      }),
    );
  }
  for (let i = 0; i < 80; i++) {
    leagueNews.push(
      card({
        id: `league-nfl-${i}`,
        headline: i % 11 === 0 ? `Arsenal notebook ${i}` : `League notebook ${i} around the NFL`,
        leaguePath: "football/nfl",
        sportLabel: "NFL",
        dek: i % 7 === 0 ? "Chiefs stay in the mix" : null,
        body: bodyFor("notebook", 4),
      }),
    );
  }
  for (let i = 0; i < 90; i++) {
    clubCopy.push(
      card({
        id: `news-unique-${i}`,
        headline: `Desk brief ${i} on the waiver wire and the trade market`,
        leaguePath: i % 2 === 0 ? "football/nfl" : "baseball/mlb",
        sportLabel: i % 2 === 0 ? "NFL" : "MLB",
        body: bodyFor(`brief${i}`, 3),
      }),
    );
  }
  for (let i = 0; i < 20; i++) {
    athletic.push(
      card({
        id: `athletic-extra-${i}`,
        headline: `The Athletic extra ${i} on the Cardinals`,
        caption: "The Athletic",
        leaguePath: "baseball/mlb",
        sportLabel: "MLB",
        wrapHref: `https://www.nytimes.com/athletic/extra-${i}`,
        body: bodyFor("Cardinals", 7),
      }),
    );
  }

  return { clubCopy, leagueNews, athletic, games };
}

function fingerprint(cards: GameWrapCard[]): string {
  return cards
    .map((c) =>
      [
        c.id,
        c.favoriteKey,
        c.followed ? "1" : "0",
        c.teamName,
        (c.related ?? []).map((r) => r.id).join(","),
        c.scoreLine ?? "",
        c.gameId ?? "",
      ].join("|"),
    )
    .join("\n");
}

const FAVS = [
  { key: "nfl-kc", name: "Kansas City Chiefs", shortName: "Chiefs", names: ["chiefs", "kansas city chiefs", "kc"] },
  { key: "nfl-det", name: "Detroit Lions", shortName: "Lions", names: ["lions", "detroit lions"] },
  { key: "mlb-stl", name: "St. Louis Cardinals", shortName: "Cardinals", names: ["cardinals", "st. louis cardinals", "stl"] },
  { key: "nhl-stl", name: "St. Louis Blues", shortName: "Blues", names: ["blues", "st. louis blues"] },
  { key: "cfb-mizzou", name: "Mizzou Football", shortName: "Mizzou FB", names: ["mizzou", "missouri tigers"] },
  { key: "cfb-missouri-state", name: "Missouri State Football", shortName: "MOST FB", names: ["missouri state", "bears"] },
];

const HAY_NAME_RE = new Map<string, RegExp>();
function hayHasNameNew(hay: string, name: string): boolean {
  if (name.length <= 3) {
    let re = HAY_NAME_RE.get(name);
    if (!re) {
      re = new RegExp(`(?:^|[^a-z0-9])${name.replace(/\./g, "\\.")}(?:[^a-z0-9]|$)`, "i");
      HAY_NAME_RE.set(name, re);
    }
    return re.test(hay);
  }
  return hay.includes(name);
}
function hayHasNameLegacy(hay: string, name: string): boolean {
  if (name.length <= 3) {
    const re = new RegExp(`(?:^|[^a-z0-9])${name.replace(/\./g, "\\.")}(?:[^a-z0-9]|$)`, "i");
    return re.test(hay);
  }
  return hay.includes(name);
}

function tagWith(cards: GameWrapCard[], hayFn: (hay: string, name: string) => boolean): GameWrapCard[] {
  return cards.map((next) => {
    if (next.favoriteKey) return { ...next, followed: true };
    const hay = `${next.headline} ${next.dek ?? ""} ${next.teamName ?? ""}`.toLowerCase();
    const hits = FAVS.filter((f) => f.names.some((n) => hayFn(hay, n)));
    if (!hits.length) return next;
    hits.sort((a, b) => favoriteDeskWeight(b.key) - favoriteDeskWeight(a.key));
    const fav = hits[0]!;
    return { ...next, favoriteKey: fav.key, followed: true, teamName: next.teamName || fav.shortName };
  });
}

function cardEventId(next: GameWrapCard): string | null {
  return (next.gameId ?? "").match(/(\d{6,})/)?.[1] ?? null;
}

function mergeStoryCards(wire: GameWrapCard[], teamCards: GameWrapCard[]): GameWrapCard[] {
  const takenEvents = new Set(wire.map(cardEventId).filter(Boolean) as string[]);
  const takenHeads = new Set(wire.map((c) => c.headline.toLowerCase()));
  const extra = teamCards.filter((c) => {
    const id = cardEventId(c);
    if (id && takenEvents.has(id)) return false;
    return !takenHeads.has(c.headline.toLowerCase());
  });
  return [...wire, ...extra];
}

function runLegacy(clubCopy: GameWrapCard[], leagueNews: GameWrapCard[], athletic: GameWrapCard[]) {
  const withLeague = mergeStoryCards(clubCopy, leagueNews);
  const merged = mergeStoryCards(withLeague, athletic).filter((next) => !isNewsMuted(next));
  return tagWith(attachRelatedGameCopyLegacy(merged), hayHasNameLegacy);
}

function runNew(clubCopy: GameWrapCard[], leagueNews: GameWrapCard[], athletic: GameWrapCard[]) {
  const withLeague = mergeStoryCards(clubCopy, leagueNews);
  const merged = mergeStoryCards(withLeague, athletic).filter((next) => !isNewsMuted(next));
  return tagWith(attachRelatedGameCopy(merged), hayHasNameNew);
}

function runChunked(clubCopy: GameWrapCard[], leagueNews: GameWrapCard[], athletic: GameWrapCard[]) {
  const withLeague = mergeStoryCards(clubCopy, leagueNews);
  const merged = mergeStoryCards(withLeague, athletic).filter((next) => !isNewsMuted(next));
  let cursor = null as Parameters<typeof attachRelatedGameCopyStep>[1];
  let hops = 0;
  let related: GameWrapCard[] = [];
  for (;;) {
    hops += 1;
    const step = attachRelatedGameCopyStep(merged, cursor, 0);
    if (step.done) {
      related = step.cards ?? [];
      break;
    }
    cursor = step.cursor;
    if (hops > 5_000) throw new Error("chunked related copy did not finish");
  }
  const tagged: GameWrapCard[] = [];
  for (let i = 0; i < related.length; i += 20) {
    tagged.push(...tagWith(related.slice(i, i + 20), hayHasNameNew));
  }
  return { cards: tagged, hops };
}

const slate = buildSlate();
const mergedCount =
  mergeStoryCards(mergeStoryCards(slate.clubCopy, slate.leagueNews), slate.athletic).filter((c) => !isNewsMuted(c))
    .length;
assert(mergedCount >= 260, `fixture has ${mergedCount} merged stories, need ≥260`);
assert(slate.leagueNews.length >= 90, `fixture has ${slate.leagueNews.length} league news, need ≥90`);

const tLegacy = Date.now();
const legacy = runLegacy(slate.clubCopy, slate.leagueNews, slate.athletic);
const legacyMs = Date.now() - tLegacy;
const tNew = Date.now();
const next = runNew(slate.clubCopy, slate.leagueNews, slate.athletic);
const newMs = Date.now() - tNew;
const tChunk = Date.now();
const chunked = runChunked(slate.clubCopy, slate.leagueNews, slate.athletic);
const chunkMs = Date.now() - tChunk;

assert(fingerprint(next) === fingerprint(legacy), "new one-shot merge matches legacy stories, order, related, tags");
assert(fingerprint(chunked.cards) === fingerprint(legacy), "chunked merge matches legacy");
assert(next.length === legacy.length, "same story count");
assert(chunked.hops > 1, "tiny budget forced more than one related-copy hop");

for (const a of slate.clubCopy.slice(0, 30)) {
  for (const b of slate.clubCopy.slice(0, 30)) {
    assert(sameGameStory(a, b) === sameGameStoryLegacy(a, b), `sameGameStory ${a.id} vs ${b.id}`);
  }
}

const slimHtml = "<p>The <strong>Chiefs</strong> won late.</p><p>Mahomes threw two scores.</p>";
const fromHtml = htmlToNewspaperText(slimHtml);
assert(fromHtml.includes("Chiefs") && fromHtml.includes("Mahomes"), "article HTML converts to the text filing uses");

const HOP_BUDGET_MS = 1_200;
const hopRows: { hop: number; stage: number; cursor: string; bagBytes: number; elapsedMs: number }[] = [];
function recordHop(stage: number, bag: Record<string, unknown>, started: number) {
  const slim = checkpointBag({ ...bag, stage });
  hopRows.push({
    hop: hopRows.length + 1,
    stage,
    cursor: hopSignature(slim),
    bagBytes: JSON.stringify(slim).length,
    elapsedMs: Date.now() - started,
  });
}

{
  const started = Date.now();
  const withLeague = mergeStoryCards(slate.clubCopy, slate.leagueNews);
  const pool = mergeStoryCards(withLeague, slate.athletic).filter((c) => !isNewsMuted(c));
  recordHop(11, { stage: 11, mergeStep: "related-wraps", pool, wireGames: slate.games }, started);
  let cursor = null as Parameters<typeof attachRelatedGameCopyStep>[1];
  let related: GameWrapCard[] = [];
  for (;;) {
    const hopStart = Date.now();
    const step = attachRelatedGameCopyStep(pool, cursor, HOP_BUDGET_MS);
    if (step.done) {
      related = step.cards ?? [];
      recordHop(11, { stage: 11, mergeStep: "tag", tagCursor: 0, pool: related, wireGames: slate.games }, hopStart);
      break;
    }
    cursor = step.cursor;
    recordHop(
      11,
      {
        stage: 11,
        mergeStep: step.phase,
        wrapCursor: step.cursor.wrapAt,
        restCursor: step.cursor.restAt,
        keptWraps: step.cursor.keptWraps,
        leftover: step.cursor.leftover,
        pool,
        wireGames: slate.games,
      },
      hopStart,
    );
  }
  const raw: GameWrapCard[] = [];
  for (let at = 0; at < related.length; ) {
    const hopStart = Date.now();
    let progressed = false;
    while (at < related.length && !(progressed && Date.now() - hopStart >= HOP_BUDGET_MS)) {
      raw.push(
        ...tagWith(related.slice(at, at + 20), hayHasNameNew),
      );
      at += 20;
      progressed = true;
    }
    recordHop(11, { stage: at < related.length ? 11 : 12, mergeStep: "tag", tagCursor: at, raw, pool: related }, hopStart);
  }
  const fresh: GameWrapCard[] = [];
  for (let at = 0; at < raw.length; ) {
    const hopStart = Date.now();
    let progressed = false;
    while (at < raw.length && !(progressed && Date.now() - hopStart >= HOP_BUDGET_MS)) {
      fresh.push(...raw.slice(at, at + 20).map((c) => ({ ...c })));
      at += 20;
      progressed = true;
    }
    recordHop(14, { stage: 14, extractFileCursor: at, raw, fresh }, hopStart);
  }
}

const maxHop = Math.max(...hopRows.map((r) => r.elapsedMs));
assert(maxHop < 1500, `max simulated hop ${maxHop} ms must stay under 1500`);
assert(
  fingerprint(next) === fingerprint(legacy),
  "pipeline stories still match legacy after hop simulation",
);

console.log(
  JSON.stringify(
    {
      fixture: {
        clubCopy: slate.clubCopy.length,
        leagueNews: slate.leagueNews.length,
        athletic: slate.athletic.length,
        merged: mergedCount,
        filed: next.length,
        relatedHops: chunked.hops,
      },
      timingMs: { legacyOneHop: legacyMs, newOneShot: newMs, chunked: chunkMs, maxPressHop: maxHop },
      hops: hopRows,
    },
    null,
    2,
  ),
);
console.log("newspaper-press-merge ok");
