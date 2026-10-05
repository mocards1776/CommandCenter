/**
 * Printed timetable for the Times viewing guide: tiers, Central-time blocks,
 * short network names, and the sample slate. Fetching lives in newspaper-watch.ts.
 */

export type WatchLeague = "MLB" | "NFL" | "NHL" | "CFB" | "Soccer";

export type WatchSide = {
  name: string;
  abbrev: string;
  logo: string | null;
  record: string | null;
  /** AP rank, college football only. */
  rank?: number | null;
  /** ESPN / MLB team id — used to match the Times desk at press time. */
  teamId?: string | null;
};

export type WatchGame = {
  id: string;
  league: WatchLeague;
  /** Competition name when the league label is not enough (Premier League, Championship). */
  competition: string | null;
  away: WatchSide;
  home: WatchSide;
  /** Start as an ISO instant; the page prints it in Central time. */
  when: string | null;
  status: string | null;
  live: boolean;
  venue: string | null;
  tv: string[];
  /** Pregame RUWT heat, frozen into the issue. Higher is more worth turning on. */
  heat: number;
  reasons: string[];
  /** Times-desk club in the matchup. Frozen at press — not a browser slider. */
  favorite?: boolean;
  favoriteLabel?: string | null;
  /** One-line reason printed on must-watch rows. Frozen with the issue. */
  printReason?: string | null;
};

export type WatchFavorite = {
  espnPath: string;
  league: string;
  sport: string;
  name?: string;
  shortName?: string;
  mlbTeamId?: number;
};

export type WatchListOpts = {
  limit?: number;
  favorites?: WatchFavorite[];
};

export type WatchTier = "must" | "worth" | "around";
export type WatchBlockId = "morning" | "noon" | "afternoon" | "prime" | "late";

export type WatchNetwork = {
  name: string;
  streaming: boolean;
};

export type WatchListing = WatchGame & {
  tier: WatchTier;
  reason: string | null;
  networks: WatchNetwork[];
  clock: string;
};

export type WatchAlsoOn = {
  id: string;
  match: string;
  clock: string;
  network: string;
};

export type WatchTimeBlock = {
  id: WatchBlockId;
  label: string;
  hours: string;
  mark: string;
  listings: WatchListing[];
  alsoOn: WatchAlsoOn[];
};

export type WatchPageModel = {
  feature: WatchListing | null;
  blocks: WatchTimeBlock[];
};

/** One printed page: a game of the day and a Central-time timetable. */
export const WATCH_PAGE_GAMES = 40;

/** Phone-card / older callers that omit a limit still get a short slate. */
export const WATCH_LIST_DEFAULT = 12;

/** A time block folds lowest-tier soccer once it grows past this many rows. */
export const WATCH_BLOCK_OVERFLOW = 8;

export const WATCH_TZ = "America/Chicago";

export const WATCH_BLOCKS: {
  id: WatchBlockId;
  label: string;
  hours: string;
  mark: string;
  startHour: number;
  endHour: number | null;
}[] = [
  { id: "morning", label: "Morning", hours: "before noon", mark: "6a", startHour: 0, endHour: 12 },
  { id: "noon", label: "Noon", hours: "12–3", mark: "12p", startHour: 12, endHour: 15 },
  { id: "afternoon", label: "Afternoon", hours: "3–6", mark: "3p", startHour: 15, endHour: 18 },
  { id: "prime", label: "Prime Time", hours: "6–9", mark: "6p", startHour: 18, endHour: 21 },
  { id: "late", label: "Late", hours: "9+", mark: "9p", startHour: 21, endHour: null },
];

const TIMES_INTEREST = 10;

const SKIP_REASON =
  /^(live(\s+now)?|upcoming|final|your #1|high interest|on your board|followed club|pitching set|watch player|favorite pitchers?|favorite manager|watch \w+|both teams ranked|both clubs ranked|tight score|even records|matched records|strong clubs|contenders)$/i;

/** Known short names only. Unknown long RSNs stay blank — never invent a network. */
const NETWORKS: { test: RegExp; name: string; streaming?: boolean }[] = [
  { test: /^espn\+$/i, name: "ESPN+", streaming: true },
  { test: /^espn2$/i, name: "ESPN2" },
  { test: /^espnu$/i, name: "ESPNU" },
  { test: /^espnews$/i, name: "ESPNews" },
  { test: /^espn(\s*unlmtd|\s*unlimited)?$/i, name: "ESPN" },
  { test: /^abc$/i, name: "ABC" },
  { test: /^cbs\s*sports\s*network$|^cbssn$/i, name: "CBSSN" },
  { test: /^cbs$/i, name: "CBS" },
  { test: /^nbc$/i, name: "NBC" },
  { test: /^fox\s*sports\s*1$|^fs1$/i, name: "FS1" },
  { test: /^fox\s*sports\s*2$|^fs2$/i, name: "FS2" },
  { test: /^fox(\s*sports)?$/i, name: "FOX" },
  { test: /^apple(\s*tv\+?)?$/i, name: "Apple TV+", streaming: true },
  { test: /^peacock$/i, name: "Peacock", streaming: true },
  { test: /paramount\+|^para\+$/i, name: "Para+", streaming: true },
  { test: /prime\s*video|^amazon|^\s*prime\s*$/i, name: "Prime", streaming: true },
  { test: /^netflix$/i, name: "Netflix", streaming: true },
  { test: /^usa(\s*network)?$/i, name: "USA" },
  { test: /^tnt$/i, name: "TNT" },
  { test: /^tbs$/i, name: "TBS" },
  { test: /^mlb\.?tv$/i, name: "MLB.TV", streaming: true },
  { test: /^max$/i, name: "Max", streaming: true },
  { test: /^disney\+$/i, name: "Disney+", streaming: true },
  { test: /^fubo(\s*tv)?$/i, name: "Fubo", streaming: true },
  { test: /^dazn$/i, name: "DAZN", streaming: true },
  { test: /^secn?\+$/i, name: "SECN+", streaming: true },
  { test: /^sec(\s*network)?$|^secn$/i, name: "SECN" },
  { test: /^acc\s*network$|^accn$/i, name: "ACCN" },
  { test: /^big\s*ten(\s*network)?$|^btn$/i, name: "BTN" },
  { test: /^nfl\s*network$|^nfln$/i, name: "NFLN" },
  { test: /^nhl\s*network$|^nhln$/i, name: "NHLN" },
  { test: /^ion$/i, name: "ION" },
  { test: /^the\s*cw$|^cw$/i, name: "CW" },
  { test: /^unim[aá]s$/i, name: "UniMás" },
  { test: /^univision$/i, name: "Univision" },
  { test: /^telemundo$/i, name: "Telemundo" },
  { test: /^fanduel/i, name: "FanDuel" },
  { test: /^bally/i, name: "Bally" },
  { test: /^yes(\s*network)?$/i, name: "YES" },
  { test: /^nesn$/i, name: "NESN" },
  { test: /^sny$/i, name: "SNY" },
];

export function espnTeamIdFromPath(espnPath: string): string | null {
  const m = /\/teams\/(\d+)/.exec(espnPath);
  return m?.[1] ?? null;
}

export function timesTeamInterest(favs: WatchFavorite[]): {
  mlb: Record<string, number>;
  nfl: Record<string, number>;
  nhl: Record<string, number>;
  cfb: Record<string, number>;
  soccer: Record<string, number>;
  ids: Set<string>;
  byId: Map<string, WatchFavorite>;
} {
  const mlb: Record<string, number> = {};
  const nfl: Record<string, number> = {};
  const nhl: Record<string, number> = {};
  const cfb: Record<string, number> = {};
  const soccer: Record<string, number> = {};
  const ids = new Set<string>();
  const byId = new Map<string, WatchFavorite>();
  const bump = (map: Record<string, number>, id: string | null | undefined, fav: WatchFavorite) => {
    if (!id) return;
    map[id] = TIMES_INTEREST;
    ids.add(id);
    byId.set(id, fav);
  };
  for (const fav of favs) {
    const path = fav.espnPath ?? "";
    const espnId = espnTeamIdFromPath(path);
    if (fav.mlbTeamId != null || /baseball\/mlb/i.test(path) || fav.league === "MLB") {
      bump(mlb, fav.mlbTeamId != null ? String(fav.mlbTeamId) : espnId, fav);
    } else if (/football\/nfl/i.test(path) || fav.league === "NFL") {
      bump(nfl, espnId, fav);
    } else if (/hockey\/nhl/i.test(path) || fav.league === "NHL") {
      bump(nhl, espnId, fav);
    } else if (/college-football/i.test(path)) {
      bump(cfb, espnId, fav);
    } else if (/\/soccer\//i.test(path) || fav.sport === "Soccer") {
      bump(soccer, espnId, fav);
    }
  }
  return { mlb, nfl, nhl, cfb, soccer, ids, byId };
}

export function asPrintGame<G extends { live: boolean }>(g: G): G {
  if (!g.live) return g;
  const copy = { ...g, live: false } as G & {
    pregame?: boolean;
    inning?: string | null;
    situation?: unknown;
    period?: number | null;
    homeWinPct?: number | null;
    barLeaderWinPct?: number | null;
    away?: { score?: unknown };
    home?: { score?: unknown };
  };
  copy.pregame = true;
  if ("inning" in copy) copy.inning = null;
  if ("situation" in copy) copy.situation = null;
  if ("period" in copy) copy.period = null;
  if ("homeWinPct" in copy) copy.homeWinPct = null;
  if ("barLeaderWinPct" in copy) copy.barLeaderWinPct = null;
  if (copy.away && typeof copy.away === "object") copy.away = { ...copy.away, score: null };
  if (copy.home && typeof copy.home === "object") copy.home = { ...copy.home, score: null };
  return copy;
}

export function printNetworks(tv: string[]): WatchNetwork[] {
  const out: WatchNetwork[] = [];
  const seen = new Set<string>();
  for (const raw of tv) {
    const name = raw.trim();
    if (!name) continue;
    let mapped: WatchNetwork | null = null;
    for (const row of NETWORKS) {
      if (row.test.test(name)) {
        mapped = { name: row.name, streaming: Boolean(row.streaming) };
        break;
      }
    }
    if (!mapped) {
      // Already-short API names may print; long unknown RSNs stay blank.
      if (name.length <= 12 && !/\s/.test(name)) mapped = { name, streaming: false };
      else continue;
    }
    const key = mapped.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
    if (out.length === 2) break;
  }
  return out;
}

export function printReason(game: WatchGame, favoriteLabel = game.favoriteLabel ?? null): string | null {
  if (game.printReason) return game.printReason;
  const awayR = game.away.rank;
  const homeR = game.home.rank;
  if (awayR && homeR && awayR <= 10 && homeR <= 10) return "Top-10 clash";
  for (const r of game.reasons) {
    if (/playoff|series|october|world series|alcs|nlcs|wild card|pennant/i.test(r)) return r;
  }
  for (const r of game.reasons) {
    if (/rivalry/i.test(r)) return r.length <= 28 ? r : "Rivalry";
  }
  if (favoriteLabel) return favoriteLabel;
  if (awayR && homeR) return "Ranked matchup";
  if ((awayR && awayR <= 10) || (homeR && homeR <= 10)) return "Top-10 team";
  for (const r of game.reasons) {
    if (!SKIP_REASON.test(r) && !/\binterest \d/i.test(r)) return r;
  }
  return null;
}

export function printClock(iso: string | null | undefined): string {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleTimeString("en-US", { timeZone: WATCH_TZ, hour: "numeric", minute: "2-digit" }).replace(":00 ", " ");
}

export function centralHour(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: WATCH_TZ, hour: "numeric", hourCycle: "h23" })
      .formatToParts(d)
      .find((p) => p.type === "hour")?.value,
  );
  return Number.isFinite(hour) ? hour % 24 : null;
}

export function watchBlockId(iso: string | null | undefined): WatchBlockId {
  const hour = centralHour(iso);
  if (hour == null) return "late";
  for (const block of WATCH_BLOCKS) {
    if (block.endHour == null) {
      if (hour >= block.startHour) return block.id;
    } else if (hour >= block.startHour && hour < block.endHour) {
      return block.id;
    }
  }
  return "late";
}

export function assignWatchTiers(games: WatchGame[]): Map<string, WatchTier> {
  const ranked = [...games].sort(byHeat);
  const mustN = ranked.length >= 16 ? 5 : Math.min(4, ranked.length);
  const worthN = Math.min(10, Math.max(0, ranked.length - mustN));
  const map = new Map<string, WatchTier>();
  ranked.forEach((g, i) => {
    map.set(g.id, i < mustN ? "must" : i < mustN + worthN ? "worth" : "around");
  });
  return map;
}

function byHeat(a: WatchGame, b: WatchGame): number {
  return b.heat - a.heat || String(a.when ?? "").localeCompare(String(b.when ?? "")) || a.id.localeCompare(b.id);
}

function byKickoff(a: WatchGame, b: WatchGame): number {
  return String(a.when ?? "~").localeCompare(String(b.when ?? "~")) || b.heat - a.heat || a.id.localeCompare(b.id);
}

function toListing(game: WatchGame, tier: WatchTier): WatchListing {
  return {
    ...game,
    tier,
    reason: printReason(game),
    networks: printNetworks(game.tv),
    clock: printClock(game.when),
  };
}

function foldOverflowSoccer(listings: WatchListing[]): { listings: WatchListing[]; alsoOn: WatchAlsoOn[] } {
  if (listings.length <= WATCH_BLOCK_OVERFLOW) return { listings, alsoOn: [] };
  const extra = listings.length - WATCH_BLOCK_OVERFLOW;
  const foldable = listings.filter((g) => g.tier === "around" && g.league === "Soccer");
  const toFold = [...foldable].sort((a, b) => a.heat - b.heat || byKickoff(a, b)).slice(0, extra);
  if (!toFold.length) return { listings, alsoOn: [] };
  const foldIds = new Set(toFold.map((g) => g.id));
  return {
    listings: listings.filter((g) => !foldIds.has(g.id)),
    alsoOn: [...toFold].sort(byKickoff).map((g) => ({
      id: g.id,
      match: `${g.away.name}–${g.home.name}`,
      clock: g.clock,
      network: g.networks[0]?.name ?? "",
    })),
  };
}

/** Heat picks the page and the tiers; the printed grid is kickoff order. */
export function composeWatchPage(games: WatchGame[]): WatchPageModel {
  if (!games.length) return { feature: null, blocks: [] };
  const tiers = assignWatchTiers(games);
  const featureGame = [...games].sort(byHeat)[0]!;
  const feature = toListing(featureGame, tiers.get(featureGame.id) ?? "must");
  const rest = games.filter((g) => g.id !== featureGame.id);
  const blocks: WatchTimeBlock[] = [];
  for (const meta of WATCH_BLOCKS) {
    const inBlock = rest.filter((g) => watchBlockId(g.when) === meta.id).sort(byKickoff);
    if (!inBlock.length) continue;
    const folded = foldOverflowSoccer(inBlock.map((g) => toListing(g, tiers.get(g.id) ?? "around")));
    if (!folded.listings.length && !folded.alsoOn.length) continue;
    blocks.push({
      id: meta.id,
      label: meta.label,
      hours: meta.hours,
      mark: meta.mark,
      listings: folded.listings,
      alsoOn: folded.alsoOn,
    });
  }
  return { feature, blocks };
}

/** Games still worth turning on, hottest first. Finished games are yesterday's paper. */
export function pickWatchGames(
  games: (WatchGame & { final?: boolean })[],
  limit = WATCH_PAGE_GAMES,
): WatchGame[] {
  return games
    .filter((g) => !g.final)
    .sort(byHeat)
    .slice(0, limit)
    .map((g) => {
      const out = { ...g };
      delete out.final;
      return out;
    });
}

function ctIso(day: string, hour: number, minute = 0): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  // Build the Central instant, then emit UTC. CDT (UTC−5) covers October.
  const utc = Date.UTC(y, m - 1, d, hour + 5, minute, 0);
  return new Date(utc).toISOString();
}

/**
 * A full printed slate for tests and the watch-page preview. Heat-ordered so
 * the first row is the game of the day; composeWatchPage then sorts by clock.
 */
export function sampleWatchSlate(day = "2026-10-05"): WatchGame[] {
  const mlb = (id: number) => `https://www.mlbstatic.com/team-logos/${id}.svg`;
  const espn = (sport: string, id: string) => `https://a.espncdn.com/i/teamlogos/${sport}/500/${id}.png`;
  const g = (
    partial: Omit<WatchGame, "live" | "status" | "competition"> & { competition?: string | null; live?: boolean; status?: string | null },
  ): WatchGame => ({
    live: false,
    status: null,
    competition: partial.competition ?? null,
    ...partial,
  });
  const games: WatchGame[] = [
    g({
      id: "mlb-stl-chc",
      league: "MLB",
      away: { name: "St. Louis Cardinals", abbrev: "STL", logo: mlb(138), record: "83-79", teamId: "138" },
      home: { name: "Chicago Cubs", abbrev: "CHC", logo: mlb(112), record: "92-70", teamId: "112" },
      when: ctIso(day, 19, 15),
      venue: "Wrigley Field",
      tv: ["ESPN"],
      heat: 96,
      reasons: ["Rivalry", "Cardinals", "Playoff race"],
      favorite: true,
      favoriteLabel: "Cardinals",
      printReason: "Rivalry",
    }),
    g({
      id: "nfl-kc-buf",
      league: "NFL",
      away: { name: "Kansas City Chiefs", abbrev: "KC", logo: espn("nfl", "12"), record: "4-1", teamId: "12" },
      home: { name: "Buffalo Bills", abbrev: "BUF", logo: espn("nfl", "2"), record: "4-1", teamId: "2" },
      when: ctIso(day, 19, 20),
      venue: "Highmark Stadium",
      tv: ["NBC"],
      heat: 91,
      reasons: ["Chiefs", "National TV"],
      favorite: true,
      favoriteLabel: "Chiefs",
      printReason: "Chiefs",
    }),
    g({
      id: "cfb-miz-ala",
      league: "CFB",
      away: { name: "Missouri", abbrev: "MIZ", logo: espn("ncaa", "142"), record: "5-1", rank: 21, teamId: "142" },
      home: { name: "Alabama", abbrev: "BAMA", logo: espn("ncaa", "333"), record: "5-1", rank: 8, teamId: "333" },
      when: ctIso(day, 14, 30),
      venue: "Bryant-Denny Stadium",
      tv: ["ABC"],
      heat: 88,
      reasons: ["Ranked matchup", "SEC"],
      favorite: true,
      favoriteLabel: "Mizzou",
      printReason: "Mizzou",
    }),
    g({
      id: "mlb-playoff-3",
      league: "MLB",
      away: { name: "Philadelphia Phillies", abbrev: "PHI", logo: mlb(143), record: "96-66", teamId: "143" },
      home: { name: "Los Angeles Dodgers", abbrev: "LAD", logo: mlb(119), record: "98-64", teamId: "119" },
      when: ctIso(day, 20, 8),
      venue: "Dodger Stadium",
      tv: ["FOX"],
      heat: 86,
      reasons: ["Playoff Game 3"],
      printReason: "Playoff Game 3",
    }),
    g({
      id: "cfb-top10",
      league: "CFB",
      away: { name: "Oregon", abbrev: "ORE", logo: espn("ncaa", "2483"), record: "6-0", rank: 3, teamId: "2483" },
      home: { name: "Ohio State", abbrev: "OSU", logo: espn("ncaa", "194"), record: "6-0", rank: 1, teamId: "194" },
      when: ctIso(day, 18, 30),
      venue: "Ohio Stadium",
      tv: ["FOX"],
      heat: 84,
      reasons: ["Ranked matchup"],
      printReason: "Top-10 clash",
    }),
    g({
      id: "nfl-det-min",
      league: "NFL",
      away: { name: "Detroit Lions", abbrev: "DET", logo: espn("nfl", "8"), record: "4-1", teamId: "8" },
      home: { name: "Minnesota Vikings", abbrev: "MIN", logo: espn("nfl", "16"), record: "3-2", teamId: "16" },
      when: ctIso(day, 12, 0),
      venue: "U.S. Bank Stadium",
      tv: ["FOX"],
      heat: 78,
      reasons: ["Lions"],
      favorite: true,
      favoriteLabel: "Lions",
      printReason: "Lions",
    }),
    g({
      id: "nhl-stl-dal",
      league: "NHL",
      away: { name: "St. Louis Blues", abbrev: "STL", logo: espn("nhl", "19"), record: "2-1-0", teamId: "19" },
      home: { name: "Dallas Stars", abbrev: "DAL", logo: espn("nhl", "9"), record: "2-1-1", teamId: "9" },
      when: ctIso(day, 19, 0),
      venue: "American Airlines Center",
      tv: ["FanDuel Sports"],
      heat: 74,
      reasons: ["Blues"],
      favorite: true,
      favoriteLabel: "Blues",
      printReason: "Blues",
    }),
    g({
      id: "cfb-sec-night",
      league: "CFB",
      away: { name: "Georgia", abbrev: "UGA", logo: espn("ncaa", "61"), record: "5-1", rank: 5, teamId: "61" },
      home: { name: "Texas", abbrev: "TEX", logo: espn("ncaa", "251"), record: "5-1", rank: 7, teamId: "251" },
      when: ctIso(day, 18, 0),
      venue: "Darrell K Royal Stadium",
      tv: ["ABC"],
      heat: 73,
      reasons: ["Ranked matchup"],
      printReason: "Top-10 clash",
    }),
    g({
      id: "soccer-ars",
      league: "Soccer",
      competition: "Premier League",
      away: { name: "Arsenal", abbrev: "ARS", logo: espn("soccer", "359"), record: "6-1-1", teamId: "359" },
      home: { name: "Liverpool", abbrev: "LIV", logo: espn("soccer", "364"), record: "5-2-1", teamId: "364" },
      when: ctIso(day, 11, 30),
      venue: "Anfield",
      tv: ["Peacock"],
      heat: 71,
      reasons: ["Premier League", "Arsenal"],
      favorite: true,
      favoriteLabel: "Arsenal",
      printReason: "Arsenal",
    }),
    g({
      id: "nfl-dal-nyg",
      league: "NFL",
      away: { name: "Dallas Cowboys", abbrev: "DAL", logo: espn("nfl", "6"), record: "3-2", teamId: "6" },
      home: { name: "New York Giants", abbrev: "NYG", logo: espn("nfl", "19"), record: "1-4", teamId: "19" },
      when: ctIso(day, 15, 25),
      venue: "MetLife Stadium",
      tv: ["CBS"],
      heat: 68,
      reasons: ["Cowboys"],
      favorite: true,
      favoriteLabel: "Cowboys",
      printReason: "Cowboys",
    }),
    g({
      id: "cfb-noon-big",
      league: "CFB",
      away: { name: "Penn State", abbrev: "PSU", logo: espn("ncaa", "213"), record: "5-1", rank: 9, teamId: "213" },
      home: { name: "Iowa", abbrev: "IOWA", logo: espn("ncaa", "2294"), record: "4-2", teamId: "2294" },
      when: ctIso(day, 11, 0),
      venue: "Kinnick Stadium",
      tv: ["CBS"],
      heat: 66,
      reasons: ["Ranked team"],
      printReason: "Top-10 team",
    }),
    g({
      id: "mlb-afternoon",
      league: "MLB",
      away: { name: "New York Yankees", abbrev: "NYY", logo: mlb(147), record: "94-68", teamId: "147" },
      home: { name: "Boston Red Sox", abbrev: "BOS", logo: mlb(111), record: "81-81", teamId: "111" },
      when: ctIso(day, 15, 10),
      venue: "Fenway Park",
      tv: ["ESPN", "MLB.TV"],
      heat: 64,
      reasons: ["Playoff race"],
      printReason: "Playoff race",
    }),
    g({
      id: "cfb-btn",
      league: "CFB",
      away: { name: "Michigan", abbrev: "MICH", logo: espn("ncaa", "130"), record: "4-2", rank: 22, teamId: "130" },
      home: { name: "Washington", abbrev: "WASH", logo: espn("ncaa", "264"), record: "5-1", rank: 18, teamId: "264" },
      when: ctIso(day, 14, 30),
      venue: "Husky Stadium",
      tv: ["NBC"],
      heat: 62,
      reasons: ["Ranked matchup"],
      printReason: "Ranked matchup",
    }),
    g({
      id: "nhl-early",
      league: "NHL",
      away: { name: "Colorado Avalanche", abbrev: "COL", logo: espn("nhl", "17"), record: "3-0-0", teamId: "17" },
      home: { name: "Vegas Golden Knights", abbrev: "VGK", logo: espn("nhl", "37"), record: "2-1-0", teamId: "37" },
      when: ctIso(day, 21, 0),
      venue: "T-Mobile Arena",
      tv: ["ESPN"],
      heat: 58,
      reasons: ["National TV"],
      printReason: "National TV",
    }),
    g({
      id: "soccer-wxm",
      league: "Soccer",
      competition: "Championship",
      away: { name: "Wrexham", abbrev: "WXM", logo: espn("soccer", "352"), record: "8-2-2", teamId: "352" },
      home: { name: "Leeds United", abbrev: "LEE", logo: espn("soccer", "357"), record: "7-3-2", teamId: "357" },
      when: ctIso(day, 9, 0),
      venue: "Elland Road",
      tv: ["Paramount+"],
      heat: 56,
      reasons: ["Wrexham"],
      favorite: true,
      favoriteLabel: "Wrexham",
      printReason: "Wrexham",
    }),
  ];

  const around: Array<{
    id: string;
    league: WatchLeague;
    competition?: string | null;
    away: [string, string, string?];
    home: [string, string, string?];
    hour: number;
    minute?: number;
    tv?: string[];
    heat: number;
    reason?: string;
  }> = [
    { id: "mlb-cle-det", league: "MLB", away: ["Cleveland", "CLE"], home: ["Detroit", "DET"], hour: 12, minute: 10, tv: ["MLB.TV"], heat: 48, reason: "Contenders" },
    { id: "mlb-hou-sea", league: "MLB", away: ["Houston", "HOU"], home: ["Seattle", "SEA"], hour: 15, minute: 40, tv: ["FS1"], heat: 47 },
    { id: "mlb-atl-ny", league: "MLB", away: ["Atlanta", "ATL"], home: ["New York Mets", "NYM"], hour: 18, minute: 10, tv: ["Apple TV+"], heat: 46 },
    { id: "nfl-late-mnf", league: "NFL", away: ["Green Bay", "GB"], home: ["Chicago", "CHI"], hour: 19, minute: 15, tv: ["ABC", "ESPN"], heat: 54, reason: "National TV" },
    { id: "nhl-east", league: "NHL", away: ["Boston", "BOS"], home: ["Toronto", "TOR"], hour: 18, minute: 0, tv: ["TNT"], heat: 44 },
    { id: "cfb-g5", league: "CFB", away: ["Tulane", "TULN"], home: ["Memphis", "MEM"], hour: 15, minute: 0, tv: ["ESPN2"], heat: 42 },
    { id: "cfb-night2", league: "CFB", away: ["Florida", "FLA"], home: ["Tennessee", "TENN"], hour: 18, minute: 45, tv: ["SECN"], heat: 52, reason: "SEC" },
    { id: "soccer-bre-ful", league: "Soccer", competition: "Premier League", away: ["Brentford", "BRE"], home: ["Fulham", "FUL"], hour: 9, minute: 0, tv: ["USA"], heat: 36 },
    { id: "soccer-nap-rom", league: "Soccer", competition: "Serie A", away: ["Napoli", "NAP"], home: ["Roma", "ROM"], hour: 13, minute: 45, tv: ["Para+"], heat: 35 },
    { id: "soccer-che-bha", league: "Soccer", competition: "Premier League", away: ["Chelsea", "CHE"], home: ["Brighton", "BHA"], hour: 8, minute: 30, tv: ["Peacock"], heat: 34 },
    { id: "soccer-tot-eve", league: "Soccer", competition: "Premier League", away: ["Spurs", "TOT"], home: ["Everton", "EVE"], hour: 11, minute: 0, tv: ["USA"], heat: 33 },
    { id: "soccer-mci-nfo", league: "Soccer", competition: "Premier League", away: ["Man City", "MCI"], home: ["Nottm Forest", "NFO"], hour: 10, minute: 0, tv: ["Peacock"], heat: 32 },
    { id: "soccer-wol", league: "Soccer", competition: "Championship", away: ["Wolves", "WOL"], home: ["Coventry", "COV"], hour: 9, minute: 0, tv: ["Paramount+"], heat: 40, reason: "Wolves" },
    { id: "soccer-late-pl", league: "Soccer", competition: "Premier League", away: ["Newcastle", "NEW"], home: ["Bournemouth", "BOU"], hour: 13, minute: 0, tv: ["USA"], heat: 31 },
    { id: "soccer-serie2", league: "Soccer", competition: "Serie A", away: ["Inter", "INT"], home: ["Milan", "MIL"], hour: 14, minute: 45, tv: ["Para+"], heat: 38, reason: "Derby" },
    { id: "soccer-laliga", league: "Soccer", competition: "LaLiga", away: ["Barcelona", "BAR"], home: ["Sevilla", "SEV"], hour: 14, minute: 0, tv: ["ESPN+"], heat: 30 },
    { id: "soccer-bund", league: "Soccer", competition: "Bundesliga", away: ["Bayern", "BAY"], home: ["Dortmund", "BVB"], hour: 8, minute: 30, tv: ["ESPN+"], heat: 29 },
    { id: "soccer-around1", league: "Soccer", competition: "Championship", away: ["Sheffield Utd", "SHU"], home: ["Norwich", "NOR"], hour: 9, minute: 0, tv: [], heat: 22 },
    { id: "soccer-around2", league: "Soccer", competition: "Championship", away: ["Burnley", "BUR"], home: ["QPR", "QPR"], hour: 9, minute: 0, tv: [], heat: 21 },
    { id: "mlb-late-west", league: "MLB", away: ["San Diego", "SD"], home: ["San Francisco", "SF"], hour: 21, minute: 45, tv: ["MLB.TV"], heat: 41 },
    { id: "nhl-late", league: "NHL", away: ["Edmonton", "EDM"], home: ["Vancouver", "VAN"], hour: 21, minute: 30, tv: ["ESPN+"], heat: 37 },
    { id: "cfb-late", league: "CFB", away: ["USC", "USC"], home: ["Michigan St.", "MSU"], hour: 21, minute: 0, tv: ["FS1"], heat: 39 },
    { id: "mlb-mid", league: "MLB", away: ["Milwaukee", "MIL"], home: ["Cincinnati", "CIN"], hour: 12, minute: 40, tv: [], heat: 28 },
    { id: "mlb-unknown-tv", league: "MLB", away: ["Kansas City", "KC"], home: ["Minnesota", "MIN"], hour: 13, minute: 10, tv: ["Mystery Regional Sports"], heat: 27 },
    { id: "soccer-eve-late", league: "Soccer", competition: "Premier League", away: ["Aston Villa", "AVL"], home: ["West Ham", "WHU"], hour: 16, minute: 30, tv: ["USA"], heat: 26 },
  ];

  for (const row of around) {
    games.push(
      g({
        id: row.id,
        league: row.league,
        competition: row.competition ?? null,
        away: { name: row.away[0], abbrev: row.away[1], logo: null, record: null, teamId: row.away[2] ?? null },
        home: { name: row.home[0], abbrev: row.home[1], logo: null, record: null, teamId: row.home[2] ?? null },
        when: ctIso(day, row.hour, row.minute ?? 0),
        venue: null,
        tv: row.tv ?? [],
        heat: row.heat,
        reasons: row.reason ? [row.reason] : [],
        printReason: row.reason ?? null,
        favorite: Boolean(row.reason && /wolves|wrexham|arsenal|lions|chiefs|cardinals|blues|mizzou/i.test(row.reason)),
        favoriteLabel: row.reason && /wolves/i.test(row.reason) ? "Wolves" : null,
      }),
    );
  }

  return pickWatchGames(games, WATCH_PAGE_GAMES);
}
