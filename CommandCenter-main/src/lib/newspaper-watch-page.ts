/**
 * Printed viewing guide for the Times: tiers, Central-time slots,
 * short network names, and the sample slates. Fetching lives in newspaper-watch.ts.
 *
 * The stored press contract is still a flat WatchGame[]. New fields are optional
 * so older issues render; the client builds the layout from whatever is there.
 */

export type WatchLeague = "MLB" | "NFL" | "NHL" | "CFB" | "Soccer" | "NBA" | "WNBA";

export type WatchSide = {
  name: string;
  abbrev: string;
  logo: string | null;
  record: string | null;
  /** AP rank, college football only. */
  rank?: number | null;
  /** ESPN / MLB team id — used to match the Times desk at press time. */
  teamId?: string | null;
  /** Short display name (White Sox). Client derives one if the press omitted it. */
  short?: string | null;
  /** Team brand hex, with or without #. */
  color?: string | null;
  /** Live / final score when the page is viewed after first pitch. */
  score?: number | null;
  /** Probable pitcher (MLB) or starting goalie (NHL). */
  starter?: string | null;
  starterLine?: string | null;
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
  /** ESPN season type 1. NBA/WNBA exhibitions always print in the lowest tier. */
  preseason?: boolean;
  /** Playoff series line (Tied 1-1, CLE leads 2-0). */
  series?: string | null;
  /** ESPN betting line, e.g. CLE -1.5. */
  line?: string | null;
  /** True when the stored game is over. Optional so older issues still render. */
  final?: boolean;
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

export type WatchDensity = "light" | "full" | "dense";

export type WatchSlot = {
  clock: string;
  listings: WatchListing[];
};

export type WatchPageModel = {
  feature: WatchListing | null;
  slots: WatchSlot[];
  density: WatchDensity;
  /** @deprecated Kickoff slots replaced the coarse day-parts. Kept empty for old callers. */
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
  { test: /prime\s*video|^amazon|^\s*prime\s*$/i, name: "Prime Video", streaming: true },
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
  { test: /^nba\s*tv$|^nbatv$/i, name: "NBA TV" },
  { test: /^nba\s*(league\s*)?pass$/i, name: "NBA Pass", streaming: true },
  { test: /^wnba\s*(league\s*)?pass$/i, name: "WNBA Pass", streaming: true },
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

/** ESPN team ids collide across leagues (NBA 20 = 76ers, NHL 20 = Lightning). */
export function watchDeskKey(league: string, teamId: string): string {
  const lg = /^soccer$/i.test(league) ? "soccer" : league.toLowerCase();
  return `${lg}:${teamId}`;
}

export function timesTeamInterest(favs: WatchFavorite[]): {
  mlb: Record<string, number>;
  nfl: Record<string, number>;
  nhl: Record<string, number>;
  cfb: Record<string, number>;
  soccer: Record<string, number>;
  nba: Record<string, number>;
  wnba: Record<string, number>;
  ids: Set<string>;
  byId: Map<string, WatchFavorite>;
} {
  const mlb: Record<string, number> = {};
  const nfl: Record<string, number> = {};
  const nhl: Record<string, number> = {};
  const cfb: Record<string, number> = {};
  const soccer: Record<string, number> = {};
  const nba: Record<string, number> = {};
  const wnba: Record<string, number> = {};
  const ids = new Set<string>();
  const byId = new Map<string, WatchFavorite>();
  const bump = (map: Record<string, number>, id: string | null | undefined, fav: WatchFavorite, league: string) => {
    if (!id) return;
    map[id] = TIMES_INTEREST;
    ids.add(id);
    byId.set(watchDeskKey(league, id), fav);
  };
  for (const fav of favs) {
    const path = fav.espnPath ?? "";
    const espnId = espnTeamIdFromPath(path);
    if (fav.mlbTeamId != null || /baseball\/mlb/i.test(path) || fav.league === "MLB") {
      bump(mlb, fav.mlbTeamId != null ? String(fav.mlbTeamId) : espnId, fav, "MLB");
    } else if (/football\/nfl/i.test(path) || fav.league === "NFL") {
      bump(nfl, espnId, fav, "NFL");
    } else if (/hockey\/nhl/i.test(path) || fav.league === "NHL") {
      bump(nhl, espnId, fav, "NHL");
    } else if (/college-football/i.test(path)) {
      bump(cfb, espnId, fav, "CFB");
    } else if (/basketball\/wnba/i.test(path) || fav.league === "WNBA") {
      bump(wnba, espnId, fav, "WNBA");
    } else if (/basketball\/nba/i.test(path) || fav.league === "NBA") {
      bump(nba, espnId, fav, "NBA");
    } else if (/\/soccer\//i.test(path) || fav.sport === "Soccer") {
      bump(soccer, espnId, fav, "Soccer");
    }
  }
  return { mlb, nfl, nhl, cfb, soccer, nba, wnba, ids, byId };
}

export const WATCH_LEAGUE_LABEL: Record<WatchLeague, string> = {
  MLB: "MLB",
  NFL: "NFL",
  NHL: "NHL",
  CFB: "CFB",
  Soccer: "Soccer",
  NBA: "NBA",
  WNBA: "WNBA",
};

export const WATCH_LEAGUE_COLOR: Record<WatchLeague, string> = {
  MLB: "#002d72",
  NFL: "#013369",
  NHL: "#111111",
  CFB: "#7a1f1f",
  Soccer: "#1b6b3a",
  NBA: "#c8102e",
  WNBA: "#fa4616",
};

export function watchLeagueLabel(game: Pick<WatchGame, "league" | "competition">): string {
  if (game.league === "Soccer") return game.competition || WATCH_LEAGUE_LABEL.Soccer;
  return WATCH_LEAGUE_LABEL[game.league];
}

export function watchLeagueColor(league: WatchLeague): string {
  return WATCH_LEAGUE_COLOR[league];
}

const TWO_WORD_NICK = /^(red sox|white sox|blue jays|blue jackets|maple leafs|golden knights|trail blazers|timberwolves|76ers)$/i;

/** City-or-nickname line used on every card so leagues don't mix full names and abbrevs. */
export function watchTeamShort(side: WatchSide): string {
  const given = side.short?.trim();
  if (given) return given;
  const name = (side.name ?? "").trim();
  if (!name) return side.abbrev || "—";
  const parts = name.split(/\s+/);
  if (parts.length <= 2) return name;
  const lastTwo = parts.slice(-2).join(" ");
  if (TWO_WORD_NICK.test(lastTwo)) return lastTwo;
  return parts[parts.length - 1] ?? name;
}

export function watchHex(color: string | null | undefined): string | null {
  const c = (color ?? "").replace(/^#/, "").trim();
  return /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : null;
}

/** Ink that reads on a team-color panel — gold and yellow clubs take black. */
export function watchInkOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return "#ffffff";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.36 ? "#14161b" : "#ffffff";
}

export function watchTeamColor(side: WatchSide, league: WatchLeague): string {
  return watchHex(side.color) ?? watchLeagueColor(league);
}

export function watchTint(color: string | null | undefined): { ["--tt-team"]: string; ["--tt-on"]: string } | undefined {
  const hex = watchHex(color);
  if (!hex) return undefined;
  return { ["--tt-team"]: hex, ["--tt-on"]: watchInkOn(hex) };
}

const ESPN_LOGO: Record<WatchLeague, string> = {
  MLB: "mlb",
  NFL: "nfl",
  NHL: "nhl",
  CFB: "ncaa",
  Soccer: "soccer",
  NBA: "nba",
  WNBA: "wnba",
};

/** Prefer the stored mark; otherwise a CDN crest from team id or abbreviation. */
export function watchLogo(side: WatchSide, league: WatchLeague): string | null {
  if (side.logo) return side.logo;
  if (league === "MLB" && side.teamId) return `https://www.mlbstatic.com/team-logos/${side.teamId}.svg`;
  const sport = ESPN_LOGO[league];
  if (league === "CFB" && side.teamId) return `https://a.espncdn.com/i/teamlogos/${sport}/500/${side.teamId}.png`;
  const key = side.abbrev?.toLowerCase();
  if (key && key !== "—") return `https://a.espncdn.com/i/teamlogos/${sport}/500/${key}.png`;
  if (side.teamId) return `https://a.espncdn.com/i/teamlogos/${sport}/500/${side.teamId}.png`;
  return null;
}

export function watchIsFinal(game: Pick<WatchGame, "final" | "status">): boolean {
  if (game.final) return true;
  return Boolean(game.status && /final/i.test(game.status));
}

export type WatchClockKind = "pre" | "live" | "final";

export function watchClockState(game: WatchGame): { kind: WatchClockKind; label: string } {
  if (watchIsFinal(game)) return { kind: "final", label: "Final" };
  if (game.live) return { kind: "live", label: game.status?.trim() || "Live" };
  return { kind: "pre", label: printClock(game.when) };
}

const GENERIC_PLAYOFF = /^(playoff series|playoffs)$/i;
const SERIES_TAG =
  /\b(ALDS|NLDS|ALCS|NLCS|World Series|Wild Card(?: Series)?|Stanley Cup|NBA Finals|WNBA Finals|First Round|Conference Finals?|Round \d+)\b/i;

function normalizeSeriesTag(tag: string): string {
  const key = tag.toLowerCase();
  const known: Record<string, string> = {
    alds: "ALDS",
    nlds: "NLDS",
    alcs: "ALCS",
    nlcs: "NLCS",
    "world series": "World Series",
    "wild card": "Wild Card",
    "wild card series": "Wild Card",
    "stanley cup": "Stanley Cup",
    "nba finals": "NBA Finals",
    "wnba finals": "WNBA Finals",
    "first round": "First Round",
  };
  return known[key] ?? tag;
}

/** ALDS · CLE leads 1-0 — never a bare "Playoff series" when ESPN named the round. */
export function watchSeriesDisplay(game: Pick<WatchGame, "series" | "reasons" | "printReason" | "preseason">): string | null {
  if (game.preseason) return null;
  const series = game.series?.trim() || null;
  if (series && GENERIC_PLAYOFF.test(series)) return null;
  const blob = [game.series, game.printReason, ...(game.reasons ?? [])].filter(Boolean).join(" · ");
  const tagMatch = blob.match(SERIES_TAG);
  const tag = tagMatch?.[0] ? normalizeSeriesTag(tagMatch[0]) : null;
  if (series && tag && !new RegExp(`\\b${tag.replace(/\s+/g, "\\s+")}\\b`, "i").test(series)) {
    const lead = series.replace(/\s+series\s+/i, " ").replace(/\s+/g, " ").trim();
    return `${tag} · ${lead}`;
  }
  if (series) return series.replace(/\s+series\s+/i, " ").replace(/\s+/g, " ").trim();
  if (tag) {
    const gameN = blob.match(/game\s*(\d+)/i);
    return gameN ? `${tag} Game ${gameN[1]}` : tag;
  }
  return null;
}

/** Desk stamp: league + team id only. City names never match a favorite. */
export function watchFavoriteLabel(game: WatchGame, byId: Map<string, WatchFavorite>): string | null {
  const hits = [game.away.teamId, game.home.teamId]
    .filter((id): id is string => Boolean(id))
    .map((id) => byId.get(watchDeskKey(game.league, id)))
    .filter((f): f is WatchFavorite => Boolean(f));
  if (!hits.length) return null;
  if (hits.length > 1) return "Favorite team";
  const name = (hits[0]!.shortName ?? hits[0]!.name ?? "Favorite team").replace(/\s+(FB|BB)$/i, "");
  return name || "Favorite team";
}

/** One printed why-watch line. Never an empty stub — every card gets context. */
export function watchContext(game: WatchGame): string {
  if (game.preseason) return game.printReason && /preseason/i.test(game.printReason) ? game.printReason : "Preseason";
  const printed = printReason(game);
  if (printed) return printed;
  const series = watchSeriesDisplay(game);
  if (series) return series;
  if (game.competition) return game.competition;
  return watchLeagueLabel(game);
}

export function watchLinesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[·—–−-]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  if (!a?.trim() || !b?.trim()) return false;
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}

/** Hero copy: series once in the meta row; a different why-watch underneath, or nothing. */
export function watchFeatureCopy(game: WatchGame): { series: string | null; why: string | null } {
  const series = watchSeriesDisplay(game) ?? game.series?.trim() ?? null;
  const why = watchContext(game);
  if (why && series && watchLinesMatch(why, series)) return { series, why: null };
  return { series, why: why || null };
}

export function watchStarters(game: WatchGame): string | null {
  const away = game.away.starter?.trim();
  const home = game.home.starter?.trim();
  if (!away && !home) return null;
  const bit = (name: string | undefined, line: string | null | undefined) => {
    if (!name) return "TBD";
    return line ? `${name} (${line})` : name;
  };
  if (game.league === "MLB") return `${bit(away, game.away.starterLine)} vs ${bit(home, game.home.starterLine)}`;
  if (game.league === "NHL") return `${bit(away, game.away.starterLine)} vs ${bit(home, game.home.starterLine)}`;
  return `${bit(away, game.away.starterLine)} vs ${bit(home, game.home.starterLine)}`;
}

export function watchDensityOf(count: number): WatchDensity {
  if (count <= 14) return "light";
  if (count <= 24) return "full";
  return "dense";
}

/** Dense Saturdays bucket 7:15 with 7:00 so the grid does not sprout a header per kickoff. */
export function watchSlotBucket(clock: string, density: WatchDensity): string {
  if (density !== "dense") return clock;
  const m = clock.match(/^(\d+)(?::\d{2})?\s*(AM|PM)$/i);
  if (!m) return clock;
  return `${m[1]} ${m[2]!.toUpperCase()}`;
}

/** NBA/WNBA exhibitions never take a must-watch or worth-it slot. */
export function isWatchPreseasonLowTier(game: WatchGame): boolean {
  return Boolean(game.preseason && (game.league === "NBA" || game.league === "WNBA"));
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
    if (!mapped) continue;
    const key = mapped.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
    if (out.length === 2) break;
  }
  return out;
}

export function printReason(game: WatchGame, favoriteLabel = game.favoriteLabel ?? null): string | null {
  if (game.printReason && !GENERIC_PLAYOFF.test(game.printReason)) return game.printReason;
  const series = watchSeriesDisplay(game);
  if (series) return series;
  const awayR = game.away.rank;
  const homeR = game.home.rank;
  if (awayR && homeR && awayR <= 10 && homeR <= 10) return "Top-10 clash";
  for (const r of game.reasons) {
    if (GENERIC_PLAYOFF.test(r)) continue;
    if (/playoff|series|october|world series|alcs|nlcs|wild card|pennant|alds|nlds/i.test(r)) return r;
  }
  for (const r of game.reasons) {
    if (/rivalry/i.test(r)) return r.length <= 28 ? r : "Rivalry";
  }
  if (favoriteLabel) return favoriteLabel;
  if (awayR && homeR) return "Ranked matchup";
  if ((awayR && awayR <= 10) || (homeR && homeR <= 10)) return "Top-10 team";
  for (const r of game.reasons) {
    if (!SKIP_REASON.test(r) && !GENERIC_PLAYOFF.test(r) && !/\binterest \d/i.test(r)) return r;
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
  const counted = ranked.filter((g) => !isWatchPreseasonLowTier(g));
  const mustN = counted.length >= 16 ? 5 : Math.min(4, counted.length);
  const worthN = Math.min(10, Math.max(0, counted.length - mustN));
  const map = new Map<string, WatchTier>();
  let i = 0;
  for (const g of ranked) {
    if (isWatchPreseasonLowTier(g)) {
      map.set(g.id, "around");
      continue;
    }
    map.set(g.id, i < mustN ? "must" : i < mustN + worthN ? "worth" : "around");
    i += 1;
  }
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

/** Heat picks the hero and the tiers; the printed grid is kickoff-time slots. */
export function composeWatchPage(games: WatchGame[]): WatchPageModel {
  if (!games.length) return { feature: null, slots: [], density: "light", blocks: [] };
  const tiers = assignWatchTiers(games);
  const featureGame = [...games].sort(byHeat)[0]!;
  const feature = toListing(featureGame, tiers.get(featureGame.id) ?? "must");
  const rest = games.filter((g) => g.id !== featureGame.id).sort(byKickoff);
  const density = watchDensityOf(games.length);
  const byClock = new Map<string, WatchListing[]>();
  for (const g of rest) {
    const listing = toListing(g, tiers.get(g.id) ?? "around");
    const bucket = watchSlotBucket(listing.clock, density);
    const list = byClock.get(bucket) ?? [];
    list.push(listing);
    byClock.set(bucket, list);
  }
  const slots: WatchSlot[] = [];
  const seen = new Set<string>();
  for (const g of rest) {
    const clock = watchSlotBucket(printClock(g.when), density);
    if (seen.has(clock)) continue;
    seen.add(clock);
    slots.push({ clock, listings: byClock.get(clock) ?? [] });
  }
  return { feature, slots, density, blocks: [] };
}

/** Today's slate, hottest first. Finals stay on the page so an evening read still shows the afternoon. */
export function pickWatchGames(
  games: (WatchGame & { final?: boolean })[],
  limit = WATCH_PAGE_GAMES,
): WatchGame[] {
  return games.sort(byHeat).slice(0, limit);
}

function ctIso(day: string, hour: number, minute = 0): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  // Build the Central instant, then emit UTC. CDT (UTC−5) covers October.
  const utc = Date.UTC(y, m - 1, d, hour + 5, minute, 0);
  return new Date(utc).toISOString();
}

function sampleGame(
  partial: Omit<WatchGame, "live" | "status" | "competition"> & {
    competition?: string | null;
    live?: boolean;
    status?: string | null;
  },
): WatchGame {
  return {
    live: false,
    status: null,
    competition: partial.competition ?? null,
    ...partial,
  };
}

const mlbMark = (id: number) => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const espnMark = (sport: string, id: string) => `https://a.espncdn.com/i/teamlogos/${sport}/500/${id}.png`;

function aroundLogo(league: WatchLeague, abbrev: string, teamId?: string): string {
  if (league === "MLB" && teamId) return mlbMark(Number(teamId));
  if (league === "CFB" && teamId) return espnMark("ncaa", teamId);
  const sport = ESPN_LOGO[league];
  return espnMark(sport, (teamId && league !== "NFL" && league !== "NHL" && league !== "NBA" && league !== "WNBA" ? teamId : abbrev).toLowerCase());
}

/**
 * Monday Oct 5, 2026: two ALDS games, MNF, four NHL openers, five NBA exhibitions.
 * Used to proof a light day at iPad width.
 */
export function sampleWatchSlateLight(day = "2026-10-05"): WatchGame[] {
  const g = sampleGame;
  return pickWatchGames(
    [
      g({
        id: "mlb-cws-cle",
        league: "MLB",
        away: {
          name: "Chicago White Sox",
          short: "White Sox",
          abbrev: "CWS",
          logo: mlbMark(145),
          record: "1-0",
          teamId: "145",
          color: "27251f",
          starter: "Garrett Crochet",
        },
        home: {
          name: "Cleveland Guardians",
          short: "Guardians",
          abbrev: "CLE",
          logo: mlbMark(114),
          record: "0-1",
          teamId: "114",
          color: "e31937",
          starter: "Gavin Williams",
        },
        when: ctIso(day, 16, 0),
        venue: "Progressive Field",
        tv: ["ESPN", "TBS"],
        heat: 94,
        reasons: ["ALDS", "Series tied 1-1"],
        series: "Series tied 1-1",
        printReason: "ALDS — series tied 1-1",
      }),
      g({
        id: "mlb-nyy-tb",
        league: "MLB",
        away: {
          name: "New York Yankees",
          short: "Yankees",
          abbrev: "NYY",
          logo: mlbMark(147),
          record: "0-1",
          teamId: "147",
          color: "0c2340",
          starter: "Max Fried",
        },
        home: {
          name: "Tampa Bay Rays",
          short: "Rays",
          abbrev: "TB",
          logo: mlbMark(139),
          record: "1-0",
          teamId: "139",
          color: "092c5c",
          starter: "Shane Baz",
        },
        when: ctIso(day, 19, 0),
        venue: "Tropicana Field",
        tv: ["TBS"],
        heat: 88,
        reasons: ["ALDS"],
        series: "TB leads 1-0",
        printReason: "ALDS — TB leads 1-0",
      }),
      g({
        id: "nfl-atl-no",
        league: "NFL",
        away: {
          name: "Atlanta Falcons",
          short: "Falcons",
          abbrev: "ATL",
          logo: espnMark("nfl", "atl"),
          record: "2-2",
          teamId: "1",
          color: "a71930",
        },
        home: {
          name: "New Orleans Saints",
          short: "Saints",
          abbrev: "NO",
          logo: espnMark("nfl", "no"),
          record: "1-3",
          teamId: "18",
          color: "d3bc8d",
        },
        when: ctIso(day, 19, 15),
        venue: "Caesars Superdome",
        tv: ["ESPN", "ABC"],
        heat: 86,
        reasons: ["Monday Night Football"],
        printReason: "Monday Night Football",
        line: "ATL -3.5",
      }),
      g({
        id: "nhl-phi-tb",
        league: "NHL",
        away: {
          name: "Philadelphia Flyers",
          short: "Flyers",
          abbrev: "PHI",
          logo: espnMark("nhl", "phi"),
          record: "0-1-0",
          teamId: "15",
          color: "f74902",
          starter: "Samuel Ersson",
        },
        home: {
          name: "Tampa Bay Lightning",
          short: "Lightning",
          abbrev: "TB",
          logo: espnMark("nhl", "tb"),
          record: "0-1-0",
          teamId: "20",
          color: "002868",
          starter: "Andrei Vasilevskiy",
        },
        when: ctIso(day, 18, 0),
        venue: "Amalie Arena",
        tv: ["ESPN+"],
        heat: 62,
        reasons: ["Opening week"],
        printReason: "Opening week",
      }),
      g({
        id: "nhl-ott-bos",
        league: "NHL",
        away: {
          name: "Ottawa Senators",
          short: "Senators",
          abbrev: "OTT",
          logo: espnMark("nhl", "ott"),
          record: "1-0-0",
          teamId: "14",
          color: "c52032",
          starter: "Linus Ullmark",
        },
        home: {
          name: "Boston Bruins",
          short: "Bruins",
          abbrev: "BOS",
          logo: espnMark("nhl", "bos"),
          record: "1-0-0",
          teamId: "1",
          color: "ffb81c",
          starter: "Jeremy Swayman",
        },
        when: ctIso(day, 18, 30),
        venue: "TD Garden",
        tv: ["ESPN+"],
        heat: 64,
        reasons: ["Opening week"],
        printReason: "Opening week",
      }),
      g({
        id: "nhl-wpg-pit",
        league: "NHL",
        away: {
          name: "Winnipeg Jets",
          short: "Jets",
          abbrev: "WPG",
          logo: espnMark("nhl", "wpg"),
          record: "0-0-0",
          teamId: "28",
          color: "041e42",
        },
        home: {
          name: "Pittsburgh Penguins",
          short: "Penguins",
          abbrev: "PIT",
          logo: espnMark("nhl", "pit"),
          record: "0-0-0",
          teamId: "16",
          color: "fcb514",
        },
        when: ctIso(day, 18, 30),
        venue: "PPG Paints Arena",
        tv: ["ESPN+"],
        heat: 58,
        reasons: ["Opening week"],
        printReason: "Opening week",
      }),
      g({
        id: "nhl-sj-dal",
        league: "NHL",
        away: {
          name: "San Jose Sharks",
          short: "Sharks",
          abbrev: "SJ",
          logo: espnMark("nhl", "sj"),
          record: "0-0-0",
          teamId: "18",
          color: "006d75",
        },
        home: {
          name: "Dallas Stars",
          short: "Stars",
          abbrev: "DAL",
          logo: espnMark("nhl", "dal"),
          record: "0-0-0",
          teamId: "9",
          color: "006847",
        },
        when: ctIso(day, 19, 0),
        venue: "American Airlines Center",
        tv: ["ESPN+"],
        heat: 52,
        reasons: ["Opening week"],
        printReason: "Opening week",
      }),
      g({
        id: "nba-mem-atl",
        league: "NBA",
        away: {
          name: "Memphis Grizzlies",
          short: "Grizzlies",
          abbrev: "MEM",
          logo: espnMark("nba", "mem"),
          record: "0-1",
          teamId: "29",
          color: "5d76a9",
        },
        home: {
          name: "Atlanta Hawks",
          short: "Hawks",
          abbrev: "ATL",
          logo: espnMark("nba", "atl"),
          record: "0-2",
          teamId: "1",
          color: "e03a3e",
        },
        when: ctIso(day, 18, 0),
        venue: "State Farm Arena",
        tv: ["NBA TV"],
        heat: 8,
        reasons: ["Preseason"],
        printReason: "Preseason",
        preseason: true,
      }),
      g({
        id: "nba-phx-det",
        league: "NBA",
        away: {
          name: "Phoenix Suns",
          short: "Suns",
          abbrev: "PHX",
          logo: espnMark("nba", "phx"),
          record: "1-1",
          teamId: "21",
          color: "e56020",
        },
        home: {
          name: "Detroit Pistons",
          short: "Pistons",
          abbrev: "DET",
          logo: espnMark("nba", "det"),
          record: "2-0",
          teamId: "8",
          color: "1d428a",
        },
        when: ctIso(day, 18, 0),
        venue: "Little Caesars Arena",
        tv: [],
        heat: 6,
        reasons: ["Preseason"],
        printReason: "Preseason",
        preseason: true,
      }),
      g({
        id: "nba-ny-phi",
        league: "NBA",
        away: {
          name: "New York Knicks",
          short: "Knicks",
          abbrev: "NY",
          logo: espnMark("nba", "ny"),
          record: "1-0",
          teamId: "18",
          color: "006bb6",
        },
        home: {
          name: "Philadelphia 76ers",
          short: "76ers",
          abbrev: "PHI",
          logo: espnMark("nba", "phi"),
          record: "0-2",
          teamId: "20",
          color: "006bb6",
        },
        when: ctIso(day, 18, 0),
        venue: "Xfinity Mobile Arena",
        tv: ["NBA TV"],
        heat: 9,
        reasons: ["Preseason"],
        printReason: "Preseason",
        favorite: true,
        favoriteLabel: "Sixers",
        preseason: true,
      }),
      g({
        id: "nba-min-mil",
        league: "NBA",
        away: {
          name: "Minnesota Timberwolves",
          short: "Timberwolves",
          abbrev: "MIN",
          logo: espnMark("nba", "min"),
          record: "0-2",
          teamId: "16",
          color: "0c2340",
        },
        home: {
          name: "Milwaukee Bucks",
          short: "Bucks",
          abbrev: "MIL",
          logo: espnMark("nba", "mil"),
          record: "1-1",
          teamId: "15",
          color: "00471b",
        },
        when: ctIso(day, 19, 0),
        venue: "Fiserv Forum",
        tv: [],
        heat: 5,
        reasons: ["Preseason"],
        printReason: "Preseason",
        preseason: true,
      }),
      g({
        id: "nba-lal-sac",
        league: "NBA",
        away: {
          name: "Los Angeles Lakers",
          short: "Lakers",
          abbrev: "LAL",
          logo: espnMark("nba", "lal"),
          record: "1-1",
          teamId: "13",
          color: "552583",
        },
        home: {
          name: "Sacramento Kings",
          short: "Kings",
          abbrev: "SAC",
          logo: espnMark("nba", "sac"),
          record: "2-1",
          teamId: "23",
          color: "5a2d81",
        },
        when: ctIso(day, 21, 0),
        venue: "Golden 1 Center",
        tv: ["NBA TV"],
        heat: 7,
        reasons: ["Preseason"],
        printReason: "Preseason",
        preseason: true,
      }),
    ],
    WATCH_PAGE_GAMES,
  );
}

/**
 * A full printed slate for tests and the watch-page preview. Heat-ordered so
 * the first row is the game of the day; composeWatchPage then sorts by clock.
 */
export function sampleWatchSlate(day = "2026-10-05"): WatchGame[] {
  const mlb = mlbMark;
  const espn = espnMark;
  const g = sampleGame;
  const games: WatchGame[] = [
    g({
      id: "mlb-stl-chc",
      league: "MLB",
      away: { name: "St. Louis Cardinals", short: "Cardinals", abbrev: "STL", logo: mlb(138), record: "83-79", teamId: "138", color: "be0a14" },
      home: { name: "Chicago Cubs", short: "Cubs", abbrev: "CHC", logo: mlb(112), record: "92-70", teamId: "112", color: "0e3386" },
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
      away: { name: "Kansas City Chiefs", short: "Chiefs", abbrev: "KC", logo: espn("nfl", "kc"), record: "4-1", teamId: "12", color: "e31837" },
      home: { name: "Buffalo Bills", short: "Bills", abbrev: "BUF", logo: espn("nfl", "buf"), record: "4-1", teamId: "2", color: "00338d" },
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
      away: { name: "Missouri", short: "Missouri", abbrev: "MIZ", logo: espn("ncaa", "142"), record: "5-1", rank: 21, teamId: "142", color: "f1b82d" },
      home: { name: "Alabama", short: "Alabama", abbrev: "BAMA", logo: espn("ncaa", "333"), record: "5-1", rank: 8, teamId: "333", color: "9e1b32" },
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
      away: { name: "Philadelphia Phillies", short: "Phillies", abbrev: "PHI", logo: mlb(143), record: "96-66", teamId: "143", color: "e81828" },
      home: { name: "Los Angeles Dodgers", short: "Dodgers", abbrev: "LAD", logo: mlb(119), record: "98-64", teamId: "119", color: "005a9c" },
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
      away: { name: "Oregon", short: "Oregon", abbrev: "ORE", logo: espn("ncaa", "2483"), record: "6-0", rank: 3, teamId: "2483", color: "154733" },
      home: { name: "Ohio State", short: "Ohio State", abbrev: "OSU", logo: espn("ncaa", "194"), record: "6-0", rank: 1, teamId: "194", color: "bb0000" },
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
      away: { name: "Detroit Lions", short: "Lions", abbrev: "DET", logo: espn("nfl", "det"), record: "4-1", teamId: "8", color: "0076b6" },
      home: { name: "Minnesota Vikings", short: "Vikings", abbrev: "MIN", logo: espn("nfl", "min"), record: "3-2", teamId: "16", color: "4f2683" },
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
      away: { name: "St. Louis Blues", short: "Blues", abbrev: "STL", logo: espn("nhl", "stl"), record: "2-1-0", teamId: "19", color: "002f87" },
      home: { name: "Dallas Stars", short: "Stars", abbrev: "DAL", logo: espn("nhl", "dal"), record: "2-1-1", teamId: "9", color: "006847" },
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
      away: { name: "Georgia", short: "Georgia", abbrev: "UGA", logo: espn("ncaa", "61"), record: "5-1", rank: 5, teamId: "61", color: "ba0c2f" },
      home: { name: "Texas", short: "Texas", abbrev: "TEX", logo: espn("ncaa", "251"), record: "5-1", rank: 7, teamId: "251", color: "bf5700" },
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
      away: { name: "Arsenal", short: "Arsenal", abbrev: "ARS", logo: espn("soccer", "359"), record: "6-1-1", teamId: "359", color: "ef0107" },
      home: { name: "Liverpool", short: "Liverpool", abbrev: "LIV", logo: espn("soccer", "364"), record: "5-2-1", teamId: "364", color: "c8102e" },
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
      away: { name: "Dallas Cowboys", short: "Cowboys", abbrev: "DAL", logo: espn("nfl", "dal"), record: "3-2", teamId: "6", color: "041e42" },
      home: { name: "New York Giants", short: "Giants", abbrev: "NYG", logo: espn("nfl", "nyg"), record: "1-4", teamId: "19", color: "0b2265" },
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
      away: { name: "Penn State", short: "Penn State", abbrev: "PSU", logo: espn("ncaa", "213"), record: "5-1", rank: 9, teamId: "213", color: "002d62" },
      home: { name: "Iowa", short: "Iowa", abbrev: "IOWA", logo: espn("ncaa", "2294"), record: "4-2", teamId: "2294", color: "ffcd00" },
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
      away: { name: "New York Yankees", short: "Yankees", abbrev: "NYY", logo: mlb(147), record: "94-68", teamId: "147", color: "0c2340" },
      home: { name: "Boston Red Sox", short: "Red Sox", abbrev: "BOS", logo: mlb(111), record: "81-81", teamId: "111", color: "bd3039" },
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
      away: { name: "Michigan", short: "Michigan", abbrev: "MICH", logo: espn("ncaa", "130"), record: "4-2", rank: 22, teamId: "130", color: "00274c" },
      home: { name: "Washington", short: "Washington", abbrev: "WASH", logo: espn("ncaa", "264"), record: "5-1", rank: 18, teamId: "264", color: "4b2e83" },
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
      away: { name: "Colorado Avalanche", short: "Avalanche", abbrev: "COL", logo: espn("nhl", "col"), record: "3-0-0", teamId: "17", color: "6f263d" },
      home: { name: "Vegas Golden Knights", short: "Golden Knights", abbrev: "VGK", logo: espn("nhl", "vgk"), record: "2-1-0", teamId: "37", color: "b4975a" },
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
      away: { name: "Wrexham", short: "Wrexham", abbrev: "WXM", logo: espn("soccer", "352"), record: "8-2-2", teamId: "352", color: "c8102e" },
      home: { name: "Leeds United", short: "Leeds", abbrev: "LEE", logo: espn("soccer", "357"), record: "7-3-2", teamId: "357", color: "ffcd00" },
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
    preseason?: boolean;
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
    { id: "nba-pre-den", league: "NBA", away: ["Denver", "DEN"], home: ["Utah", "UTA"], hour: 20, minute: 0, tv: ["NBA TV"], heat: 8, reason: "Preseason", preseason: true },
    { id: "nba-pre-phi", league: "NBA", away: ["Philadelphia", "PHI"], home: ["Boston", "BOS"], hour: 18, minute: 30, tv: ["ESPN"], heat: 5, reason: "Preseason", preseason: true },
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
        away: {
          name: row.away[0],
          short: row.away[0],
          abbrev: row.away[1],
          logo: aroundLogo(row.league, row.away[1], row.away[2]),
          record: null,
          teamId: row.away[2] ?? null,
        },
        home: {
          name: row.home[0],
          short: row.home[0],
          abbrev: row.home[1],
          logo: aroundLogo(row.league, row.home[1], row.home[2]),
          record: null,
          teamId: row.home[2] ?? null,
        },
        when: ctIso(day, row.hour, row.minute ?? 0),
        venue: null,
        tv: row.tv ?? [],
        heat: row.heat,
        reasons: row.reason ? [row.reason] : [],
        printReason: row.reason ?? null,
        favorite: Boolean(row.reason && /wolves|wrexham|arsenal|lions|chiefs|cardinals|blues|mizzou/i.test(row.reason)),
        favoriteLabel: row.reason && /wolves/i.test(row.reason) ? "Wolves" : null,
        preseason: row.preseason,
      }),
    );
  }

  return pickWatchGames(games, WATCH_PAGE_GAMES);
}
