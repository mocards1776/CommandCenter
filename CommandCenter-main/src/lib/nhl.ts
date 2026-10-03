/** NHL via ESPN site API — scoreboard, standings, teams, games, players. */

import { parseEspnBroadcasts, type GameBroadcast } from "./game-broadcasts";
import { espnBirthDate, espnBirthPlace, formatSportsDateLong } from "./utils";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/hockey/nhl";
const CORE = "https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl";

export function chicagoTodayNhl(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function chicagoDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/**
 * ESPN NHL season id is the year the season ends (2027 = 2026-27).
 * The new season opens mid-September — stay on the upcoming/current year from Sep 1.
 */
export function nhlSeasonYear(d = new Date()): number {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 8) return y + 1; // Sep–Dec → season ending next calendar year
  return y;
}

export function nhlHeadshot(playerId: string | number, size = "full"): string {
  return `https://a.espncdn.com/i/headshots/nhl/players/${size}/${playerId}.png`;
}

export function nhlTeamLogo(abbrevOrId: string): string {
  return `https://a.espncdn.com/i/teamlogos/nhl/500/${abbrevOrId.toLowerCase()}.png`;
}

/** Dark team colors vanish on navy; lift anything under `minLuminance` toward white. */
export function liftTeamColor(hex: string, minLuminance = 0.3, amount = 0.35): string {
  const raw = hex.replace(/^#/, "");
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n) || raw.length !== 6) return "#ffffff";
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.299 * ch[0]! + 0.587 * ch[1]! + 0.114 * ch[2]!) / 255;
  if (lum > minLuminance) return hex;
  return `rgb(${ch.map((c) => Math.round(c + (255 - c) * amount)).join(",")})`;
}

/** ESPN alternate colors for teams whose primary is black, grey or navy-on-navy. */
const NHL_ACCENT_OVERRIDE: Record<string, string> = {
  VGK: "#b4975a",
  BOS: "#fdb71a",
  PIT: "#fdb71a",
  UTA: "#7ab2e1",
  UTAH: "#7ab2e1",
  SEA: "#99d9d9",
};

/** Team color that reads as a bright accent (rings, bars, chips) on the navy panels. */
export function nhlAccentColor(side: { abbrev: string; color: string }): string {
  return NHL_ACCENT_OVERRIDE[side.abbrev] ?? liftTeamColor(`#${side.color}`);
}

export const NHL_TEAMS: { id: number; name: string; abbrev: string }[] = [
  { id: 25, name: "Anaheim Ducks", abbrev: "ANA" },
  { id: 1, name: "Boston Bruins", abbrev: "BOS" },
  { id: 2, name: "Buffalo Sabres", abbrev: "BUF" },
  { id: 3, name: "Calgary Flames", abbrev: "CGY" },
  { id: 7, name: "Carolina Hurricanes", abbrev: "CAR" },
  { id: 4, name: "Chicago Blackhawks", abbrev: "CHI" },
  { id: 17, name: "Colorado Avalanche", abbrev: "COL" },
  { id: 29, name: "Columbus Blue Jackets", abbrev: "CBJ" },
  { id: 9, name: "Dallas Stars", abbrev: "DAL" },
  { id: 5, name: "Detroit Red Wings", abbrev: "DET" },
  { id: 6, name: "Edmonton Oilers", abbrev: "EDM" },
  { id: 26, name: "Florida Panthers", abbrev: "FLA" },
  { id: 8, name: "Los Angeles Kings", abbrev: "LA" },
  { id: 30, name: "Minnesota Wild", abbrev: "MIN" },
  { id: 10, name: "Montreal Canadiens", abbrev: "MTL" },
  { id: 27, name: "Nashville Predators", abbrev: "NSH" },
  { id: 11, name: "New Jersey Devils", abbrev: "NJ" },
  { id: 12, name: "New York Islanders", abbrev: "NYI" },
  { id: 13, name: "New York Rangers", abbrev: "NYR" },
  { id: 14, name: "Ottawa Senators", abbrev: "OTT" },
  { id: 15, name: "Philadelphia Flyers", abbrev: "PHI" },
  { id: 16, name: "Pittsburgh Penguins", abbrev: "PIT" },
  { id: 18, name: "San Jose Sharks", abbrev: "SJ" },
  { id: 124292, name: "Seattle Kraken", abbrev: "SEA" },
  { id: 19, name: "St. Louis Blues", abbrev: "STL" },
  { id: 20, name: "Tampa Bay Lightning", abbrev: "TB" },
  { id: 21, name: "Toronto Maple Leafs", abbrev: "TOR" },
  { id: 129764, name: "Utah Mammoth", abbrev: "UTA" },
  { id: 22, name: "Vancouver Canucks", abbrev: "VAN" },
  { id: 37, name: "Vegas Golden Knights", abbrev: "VGK" },
  { id: 23, name: "Washington Capitals", abbrev: "WSH" },
  { id: 28, name: "Winnipeg Jets", abbrev: "WPG" },
];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export type NhlScoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  score: number | null;
  record: string | null;
  /** Standings points (2 per W, 1 per OTL); game detail only. */
  points?: number | null;
  logo: string | null;
  color: string;
  linescores: number[];
};

export type NhlScoreGame = {
  id: string;
  status: string;
  shortDetail: string | null;
  live: boolean;
  final: boolean;
  away: NhlScoreSide;
  home: NhlScoreSide;
  when: string | null;
  whenShort: string | null;
  venue: string | null;
  date: string | null;
  /** Kickoff as an ISO instant. */
  startIso?: string | null;
  broadcasts: GameBroadcast[];
};

export type NhlScoredGame = NhlScoreGame & {
  score: number;
  reasons: string[];
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number;
  team?: {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
    logo?: string;
  };
  records?: { type?: string; name?: string; summary?: string }[];
  linescores?: { displayValue?: string; value?: number }[];
};

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  competitions?: {
    id?: string;
    date?: string;
    venue?: { fullName?: string };
    status?: {
      type?: {
        state?: string;
        completed?: boolean;
        description?: string;
        detail?: string;
        shortDetail?: string;
        name?: string;
      };
    };
    broadcasts?: { market?: string; names?: string[] }[];
    geoBroadcasts?: {
      market?: { type?: string };
      media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
    }[];
    competitors?: EspnCompetitor[];
  }[];
};

function sideFromCompetitor(c: EspnCompetitor): NhlScoreSide {
  const team = c.team ?? {};
  const record =
    c.records?.find((r) => r.type === "total" || r.name === "overall")?.summary ??
    c.records?.[0]?.summary ??
    null;
  const linescores = (c.linescores ?? [])
    .map((l) => Number(l.displayValue ?? l.value))
    .filter((n) => Number.isFinite(n));
  const scoreRaw = c.score;
  const score =
    scoreRaw == null || scoreRaw === ""
      ? null
      : Number.isFinite(Number(scoreRaw))
        ? Number(scoreRaw)
        : null;
  return {
    teamId: Number(team.id ?? 0),
    name: team.displayName ?? "Team",
    abbrev: team.abbreviation ?? "—",
    score,
    record,
    logo: team.logos?.[0]?.href ?? team.logo ?? (team.abbreviation ? nhlTeamLogo(team.abbreviation) : null),
    color: (team.color ?? "002f87").replace(/^#/, ""),
    linescores,
  };
}

function mapScoreEvent(event: EspnEvent): NhlScoreGame | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;
  const status = comp.status?.type;
  const state = status?.state ?? "";
  const live = state === "in";
  const final = state === "post" || status?.completed === true;
  const home = (comp.competitors ?? []).find((c) => c.homeAway === "home");
  const away = (comp.competitors ?? []).find((c) => c.homeAway === "away");
  if (!home || !away) return null;
  const whenDate = event.date ? new Date(event.date) : null;
  const when =
    whenDate && !Number.isNaN(whenDate.getTime()) ? formatSportsDateLong(whenDate) : null;
  const whenShort =
    whenDate && !Number.isNaN(whenDate.getTime())
      ? whenDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : null;
  return {
    id: String(event.id ?? comp.id ?? ""),
    status: status?.description ?? status?.name ?? (live ? "Live" : final ? "Final" : "Scheduled"),
    shortDetail: status?.shortDetail ?? status?.detail ?? null,
    live,
    final,
    away: sideFromCompetitor(away),
    home: sideFromCompetitor(home),
    when: final || live ? (status?.shortDetail ?? when) : when,
    whenShort: live || final ? (status?.shortDetail ?? null) : whenShort,
    venue: comp.venue?.fullName ?? null,
    date: chicagoDateFromIso(event.date),
    startIso: event.date ?? null,
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
  };
}

export async function fetchNhlScoreboard(dates?: string): Promise<NhlScoreGame[]> {
  const url = dates ? `${ESPN}/scoreboard?dates=${dates}` : `${ESPN}/scoreboard`;
  const raw = await getJson<{ events?: EspnEvent[] }>(url);
  return (raw.events ?? []).map(mapScoreEvent).filter((g): g is NhlScoreGame => Boolean(g?.id));
}

export function pickNhlHeroGame(games: NhlScoreGame[]): NhlScoreGame | null {
  return games.find((g) => g.live) ?? games.find((g) => !g.final) ?? games[0] ?? null;
}

export type NhlRuwtContext = {
  teamInterest: Record<string, number>;
  /** Favorite player team ids — boosts matchups involving those clubs. */
  watchTeamIds?: Set<string>;
};

/**
 * NHL scoreboard rows have no win probability. A two-goal lead in the 3rd
 * with under three minutes is the same "this is over" shape as a two-score
 * college game. One-goal games stay in doubt. Three-goal games were already
 * off the tight bonus and stay on that path.
 */
const NHL_DECIDED_CLOCK_SEC = 3 * 60;
const NHL_DECIDED_LIVE_CAP = 49;

function nhlClockSeconds(detail: string): number | null {
  const m = detail.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec > 59) return null;
  return min * 60 + sec;
}

function nhlEffectivelyDecided(diff: number, detail: string): boolean {
  if (diff !== 2) return false;
  if (!/\b3rd\b/.test(detail)) return false;
  const clock = nhlClockSeconds(detail);
  return clock != null && clock <= NHL_DECIDED_CLOCK_SEC;
}

/** Drama + interest score for RUWT (parallel to NFL / soccer). */
export function scoreNhlRuwtGame(
  g: NhlScoreGame,
  ctx?: NhlRuwtContext,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const detail = `${g.shortDetail ?? ""} ${g.status ?? ""}`.toLowerCase();
  const inOt = /\bot\b|overtime|shootout|\bso\b/.test(detail);
  const liveDiff = Math.abs((g.away.score ?? 0) - (g.home.score ?? 0));
  const decided = g.live && !g.final && nhlEffectivelyDecided(liveDiff, detail);

  if (g.live) {
    score += 40;
    reasons.push("Live");
    const diff = liveDiff;
    if (!decided && diff <= 1) {
      score += 28;
      reasons.push("One-goal game");
    } else if (!decided && diff <= 2) {
      score += 14;
      reasons.push("Tight");
    }
    if (!decided && inOt) {
      score += 18;
      reasons.push("Overtime");
    } else if (!decided && /\b3rd\b/.test(detail) && diff <= 1) {
      score += 12;
      reasons.push("Late & close");
    }
  } else if (!g.final) {
    score += 12;
    reasons.push("Upcoming");
  } else {
    score += 2;
  }

  if (ctx) {
    const ai = ctx.teamInterest[String(g.away.teamId)] ?? 0;
    const hi = ctx.teamInterest[String(g.home.teamId)] ?? 0;
    const top = Math.max(ai, hi);
    if (top > 0) {
      score += Math.round(top * 4.2);
      if (top >= 9) reasons.push("Your #1 team");
      else if (top >= 7) reasons.push("High interest team");
      else if (top >= 4) reasons.push("On your board");
    }
    if (ai >= 5 && hi >= 5) {
      score += 12;
      reasons.push("Both teams ranked");
    }

    const watchTeams = ctx.watchTeamIds;
    if (watchTeams?.size) {
      const awayWatched = watchTeams.has(String(g.away.teamId));
      const homeWatched = watchTeams.has(String(g.home.teamId));
      if (awayWatched || homeWatched) {
        score += awayWatched && homeWatched ? 26 : 18;
        reasons.push(
          awayWatched && homeWatched ? "Favorite players both sides" : "Favorite player team",
        );
      }
    }
  }

  if (decided) score = Math.min(score, NHL_DECIDED_LIVE_CAP);

  const unique: string[] = [];
  for (const r of reasons) if (!unique.includes(r)) unique.push(r);
  return { score: Math.max(0, score), reasons: unique.slice(0, 5) };
}

export function rankNhlRuwtGames(
  games: NhlScoreGame[],
  ctx?: NhlRuwtContext,
  limit = 20,
): NhlScoredGame[] {
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreNhlRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

export type NhlStandingRow = {
  teamId: string;
  name: string;
  abbrev: string;
  logo: string | null;
  record: string;
  points: string;
  diff: string;
  gp: string;
};

export type NhlStandingGroup = {
  name: string;
  seasonLabel: string | null;
  rows: NhlStandingRow[];
};

type StandingsPayload = {
  seasons?: { year?: number; displayName?: string }[];
  children?: {
    name?: string;
    standings?: {
      entries?: {
        team?: {
          id?: string;
          displayName?: string;
          abbreviation?: string;
          logos?: { href?: string }[];
        };
        stats?: { name?: string; displayValue?: string }[];
      }[];
    };
  }[];
};

function mapStandings(raw: StandingsPayload, seasonLabel: string | null): NhlStandingGroup[] {
  return (raw.children ?? []).map((child) => ({
    name: child.name ?? "Conference",
    seasonLabel,
    rows: (child.standings?.entries ?? []).map((e) => {
      const stat = (n: string) => e.stats?.find((s) => s.name === n)?.displayValue ?? "";
      const wins = stat("wins") || "0";
      const losses = stat("losses") || "0";
      const otl = stat("otLosses") || stat("overtimeLosses") || "0";
      const team = e.team ?? {};
      return {
        teamId: String(team.id ?? ""),
        name: team.displayName ?? "Team",
        abbrev: team.abbreviation ?? "—",
        logo: team.logos?.[0]?.href ?? (team.abbreviation ? nhlTeamLogo(team.abbreviation) : null),
        record: `${wins}-${losses}-${otl}`,
        points: stat("points") || "0",
        diff: stat("pointDifferential") || stat("differential") || "0",
        gp: stat("gamesPlayed") || "0",
      };
    }),
  }));
}

export async function fetchNhlStandings(): Promise<NhlStandingGroup[]> {
  const season = nhlSeasonYear();
  const current = await getJson<StandingsPayload>(
    `https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings?season=${season}`,
  );
  const label =
    current.seasons?.find((s) => s.year === season)?.displayName ??
    current.seasons?.[0]?.displayName ??
    `${season - 1}-${String(season).slice(2)}`;
  return mapStandings(current, label);
}

export type NhlScoringLeader = {
  id: string;
  name: string;
  goals: string;
  assists: string;
  points: string;
  seasonLabel: string | null;
};

export async function fetchNhlScoringLeaders(limit = 10): Promise<NhlScoringLeader[]> {
  const season = nhlSeasonYear();
  const url =
    `${ESPN_WEB}/statistics/byathlete?region=us&lang=en&contentorigin=espn` +
    `&isqualified=false&page=1&limit=${limit}&sort=offensive.points%3Adesc&season=${season}&seasontype=2`;
  const raw = await getJson<{
    requestedSeason?: { displayName?: string };
    athletes?: {
      athlete?: { id?: string; displayName?: string };
      categories?: { name?: string; totals?: string[] }[];
    }[];
  }>(url).catch(() => null);
  const rows: NhlScoringLeader[] = [];
  for (const row of raw?.athletes ?? []) {
    const id = row.athlete?.id;
    if (!id) continue;
    const off = row.categories?.find((c) => c.name === "offensive");
    const totals = off?.totals ?? [];
    rows.push({
      id: String(id),
      name: row.athlete?.displayName ?? "Player",
      goals: totals[0] ?? "—",
      assists: totals[1] ?? "—",
      points: totals[2] ?? "0",
      seasonLabel: raw?.requestedSeason?.displayName ?? `${season - 1}-${String(season).slice(2)}`,
    });
  }
  // Early-season boards may be all zeroes — still show the 2026-27 slate, not last year.
  return rows.slice(0, limit);
}

export type NhlBoxRow = {
  id: string;
  name: string;
  jersey: string | null;
  /** ESPN abbreviation: C / LW / RW / D / G. */
  position: string | null;
  toiSec: number;
  stats: { label: string; value: string }[];
};

export type NhlBoxGroup = {
  teamAbbrev: string;
  teamId: string;
  name: string;
  rows: NhlBoxRow[];
};

export type NhlScoringPlay = {
  id: string;
  text: string;
  period: string | null;
  periodNumber: number | null;
  /** Elapsed time in period, e.g. "5:12" (same basis as NHL `timeInPeriod`). */
  clock: string | null;
  awayScore: number | null;
  homeScore: number | null;
  teamId: string | null;
  strength: string | null;
  athletes: { id: string; name: string; role: string }[];
};

export type NhlGameLeader = {
  category: string;
  teamAbbrev: string;
  id: string;
  name: string;
  value: string;
};

export type NhlRecentPlay = {
  id: string;
  text: string;
  type: string;
  period: string | null;
  clock: string | null;
  teamId: string | null;
  scoringPlay: boolean;
  awayScore: number | null;
  homeScore: number | null;
  athlete: { id: string; name: string; headshot: string | null } | null;
};

/**
 * Whole-game packages, as opposed to single plays:
 *  - "espn-final": ESPN summary video tagged `tracking.coverageType: "Final Game Highlight"`
 *    (or, untagged, headlined like "X vs. Y: Game Highlights" / recap / condensed).
 *  - "nhl-recap" / "nhl-condensed": NHL right-rail `gameVideo.threeMinRecap` / `condensedGame`.
 */
export type NhlWrapKind = "espn-final" | "nhl-recap" | "nhl-condensed";

/** Playable clip shape shared by ESPN summary videos and NHL Brightcove goal clips. */
export type NhlGameVideo = {
  id: string;
  headline: string;
  description: string | null;
  thumb: string | null;
  mp4: string | null;
  href: string | null;
  durationSec: number | null;
  source: "nhl" | "espn";
  wrap?: NhlWrapKind | null;
};

export type NhlIcePlayer = {
  id: string;
  name: string;
  lastName: string;
  jersey: string | null;
  /** ESPN abbreviation: C / LW / RW / D / G (others possible). */
  position: string | null;
  headshot: string | null;
};

/**
 * Who is on the ice, for the Ice Tracker-style rink. Neither ESPN nor NHL
 * publish live player (x, y), so the rink places these players by position.
 *  - "live": ESPN summary `onIce` (current skaters + goalie per team).
 *  - "lineup": no `onIce` — top-TOI C/LW/RW, two D and the goalie from the box score.
 *  - "goalies": pregame — projected starters only.
 */
export type NhlIceState = {
  source: "live" | "lineup" | "goalies";
  away: NhlIcePlayer[];
  home: NhlIcePlayer[];
  /** Period the snapshot belongs to (latest play), null pregame. */
  period: number | null;
  /** Home team shoots at the right-hand net this period (from shot coordinates). */
  homeAttacksRight: boolean;
  /** Latest located play — ESPN feet from center ice, x ∈ ±100, y ∈ ±42.5. */
  lastEvent: { x: number; y: number; type: string; teamId: string | null } | null;
};

export type NhlGameDetail = NhlScoreGame & {
  teamStats: { label: string; away: string; home: string }[];
  ice: NhlIceState | null;
  boxGroups: NhlBoxGroup[];
  scoringPlays: NhlScoringPlay[];
  /** Newest first, faceoffs/stoppages dropped. */
  recentPlays: NhlRecentPlay[];
  videos: NhlGameVideo[];
  leaders: NhlGameLeader[];
  article: { headline: string; description: string | null; storyHtml: string | null } | null;
  oddsLine: string | null;
  lastFive: {
    teamId: number;
    teamAbbrev: string;
    results: { label: string; result: string; score: string | null }[];
  }[];
  venueDetail: string | null;
  goalieStarters: {
    away: { id: string; name: string } | null;
    home: { id: string; name: string } | null;
  };
};

function sanitizeNhlStoryHtml(html: string | null | undefined): string | null {
  if (!html?.trim()) return null;
  return html
    .replace(/<\/?hl(\d)>/gi, (_, n: string) => {
      const level = Math.min(5, Math.max(2, Number(n) || 2));
      return _.startsWith("</") ? `</h${level}>` : `<h${level}>`;
    })
    .replace(/<\/?photo[^>]*>/gi, "")
    .replace(/<\/?image[^>]*>/gi, "")
    .trim();
}

const SKATER_COLS = ["G", "A", "+/-", "S", "SOG", "TOI", "PIM", "HT", "BS"];
const GOALIE_COLS = ["SV", "SV%", "GA", "SA", "TOI", "ESSV", "PPSV", "SHSV"];

function pickCols(
  labels: string[],
  values: string[],
  want: string[],
): { label: string; value: string }[] {
  return want
    .map((label) => {
      const i = labels.indexOf(label);
      if (i < 0) return null;
      return { label, value: values[i] ?? "—" };
    })
    .filter((x): x is { label: string; value: string } => Boolean(x));
}

function statNum(stats: { label: string; value: string }[], label: string): number {
  const raw = stats.find((s) => s.label === label)?.value ?? "";
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const RECENT_PLAY_LIMIT = 12;
const RECENT_PLAY_SKIP = /^(face ?off|stoppage|end of game)$/i;

type NhlEspnVideoRaw = {
  id?: string | number;
  headline?: string;
  title?: string;
  description?: string;
  caption?: string;
  duration?: number;
  thumbnail?: string;
  images?: { url?: string }[];
  posterImages?: { default?: { href?: string }; full?: { href?: string } };
  links?: {
    web?: { href?: string };
    source?: { href?: string; HD?: { href?: string } };
    mobile?: { source?: { href?: string } };
  };
  tracking?: { coverageType?: string };
};

const ESPN_WRAP_COVERAGE = /final game highlight|game highlights?|condensed|recap/i;
const ESPN_SINGLE_COVERAGE = /oneplay|interview|press ?conference|analysis/i;
const ESPN_WRAP_HEADLINE =
  /\b(?:game|full|extended|condensed)\s+highlights?\b|\bhighlights?\s*$|:\s*highlights?\b|\brecap\b|\bcondensed game\b/i;

function espnWrapKind(raw: NhlEspnVideoRaw, headline: string): NhlWrapKind | null {
  const coverage = raw.tracking?.coverageType ?? "";
  if (ESPN_WRAP_COVERAGE.test(coverage)) return "espn-final";
  if (ESPN_SINGLE_COVERAGE.test(coverage)) return null;
  return ESPN_WRAP_HEADLINE.test(headline) ? "espn-final" : null;
}

function mapNhlEspnVideo(raw: NhlEspnVideoRaw): NhlGameVideo | null {
  const id = raw.id != null ? String(raw.id) : "";
  const headline = (raw.headline || raw.title || "").trim();
  if (!id || !headline) return null;
  const mp4 =
    [raw.links?.mobile?.source?.href, raw.links?.source?.HD?.href, raw.links?.source?.href].find(
      (href): href is string => Boolean(href && /\.mp4(\?|$)/i.test(href)),
    ) ?? null;
  const descriptionRaw = (raw.description || raw.caption || "").trim() || null;
  const description =
    descriptionRaw &&
    descriptionRaw.replace(/\s+/g, " ").toLowerCase() !== headline.replace(/\s+/g, " ").toLowerCase()
      ? descriptionRaw
      : null;
  return {
    id: `espn-${id}`,
    headline,
    description,
    thumb:
      raw.posterImages?.full?.href ??
      raw.posterImages?.default?.href ??
      raw.thumbnail ??
      raw.images?.[0]?.url ??
      null,
    mp4,
    href: raw.links?.web?.href ?? `https://www.espn.com/video/clip?id=${id}`,
    durationSec: typeof raw.duration === "number" ? raw.duration : null,
    source: "espn",
    wrap: espnWrapKind(raw, headline),
  };
}

type NhlSummaryAthlete = {
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
    lastName?: string;
    jersey?: string;
    position?: { abbreviation?: string };
    headshot?: { href?: string };
  };
  stats?: string[];
  starter?: boolean;
};

type NhlSummaryPlay = {
  type?: { text?: string; abbreviation?: string };
  period?: { number?: number };
  team?: { id?: string };
  coordinate?: { x?: number; y?: number };
};

function toIcePlayer(a: NhlSummaryAthlete["athlete"], fallbackPos: string | null): NhlIcePlayer | null {
  const id = a?.id ? String(a.id) : "";
  if (!id) return null;
  const name = a?.displayName ?? "Player";
  return {
    id,
    name,
    lastName: a?.lastName || name.split(" ").slice(1).join(" ") || name,
    jersey: a?.jersey ?? null,
    position: a?.position?.abbreviation ?? fallbackPos,
    headshot: a?.headshot?.href ?? nhlHeadshot(id),
  };
}

function toiSeconds(toi: string | undefined): number {
  const [m, s] = (toi ?? "").split(":").map(Number);
  return Number.isFinite(m) && Number.isFinite(s) ? m! * 60 + s! : 0;
}

/**
 * Teams switch ends every period (OT plays like the 2nd), so every shot on
 * goal from beyond a blue line votes on which end home attacks in odd periods.
 */
function inferHomeAttacksRight(plays: NhlSummaryPlay[], homeTeamId: string, period: number): boolean {
  let vote = 0;
  for (const p of plays) {
    const kind = p.type?.abbreviation ?? "";
    const x = p.coordinate?.x;
    const num = p.period?.number;
    if ((kind !== "shot-on-goal" && kind !== "goal") || typeof x !== "number" || Math.abs(x) <= 25) continue;
    if (!p.team?.id || typeof num !== "number" || num > 4) continue;
    const homeShot = String(p.team.id) === homeTeamId ? 1 : -1;
    const parity = num % 2 === 1 ? 1 : -1;
    vote += Math.sign(x) * homeShot * parity;
  }
  const oddRight = vote >= 0;
  return period % 2 === 1 || period > 4 ? oddRight : !oddRight;
}

function buildNhlIceState(input: {
  onIce: { teamId?: string; entries?: { athleteid?: string }[] }[] | undefined;
  players: { team?: { id?: string }; statistics?: { name?: string; labels?: string[]; athletes?: NhlSummaryAthlete[] }[] }[];
  plays: NhlSummaryPlay[];
  awayTeamId: string;
  homeTeamId: string;
  starters: { away: { id: string; name: string } | null; home: { id: string; name: string } | null };
}): NhlIceState | null {
  const roster = new Map<string, NhlIcePlayer>();
  const lineups = new Map<string, NhlIcePlayer[]>();
  for (const side of input.players) {
    const teamId = String(side.team?.id ?? "");
    const ranked: { p: NhlIcePlayer; toi: number; group: string }[] = [];
    for (const group of side.statistics ?? []) {
      const name = (group.name ?? "").toLowerCase();
      const fallbackPos = name === "goalies" ? "G" : name === "defenses" ? "D" : null;
      const toiAt = (group.labels ?? []).indexOf("TOI");
      for (const a of group.athletes ?? []) {
        const p = toIcePlayer(a.athlete, fallbackPos);
        if (!p) continue;
        roster.set(p.id, p);
        ranked.push({ p, toi: toiAt >= 0 ? toiSeconds(a.stats?.[toiAt]) : 0, group: name });
      }
    }
    ranked.sort((a, b) => b.toi - a.toi);
    const pick: NhlIcePlayer[] = [];
    for (const pos of ["C", "LW", "RW"]) {
      const hit = ranked.find((r) => r.group === "forwards" && r.p.position === pos && !pick.includes(r.p));
      if (hit) pick.push(hit.p);
    }
    pick.push(...ranked.filter((r) => r.group === "defenses").slice(0, 2).map((r) => r.p));
    const goalie = ranked.find((r) => r.group === "goalies");
    if (goalie) pick.push(goalie.p);
    if (pick.length) lineups.set(teamId, pick);
  }

  const located = input.plays.filter(
    (p) => typeof p.coordinate?.x === "number" && typeof p.coordinate?.y === "number",
  );
  const latest = located[located.length - 1];
  const period = latest?.period?.number ?? input.plays[input.plays.length - 1]?.period?.number ?? null;
  const homeAttacksRight = inferHomeAttacksRight(input.plays, input.homeTeamId, period ?? 1);
  const lastEvent = latest
    ? {
        x: latest.coordinate!.x!,
        y: latest.coordinate!.y!,
        type: latest.type?.text ?? "",
        teamId: latest.team?.id ? String(latest.team.id) : null,
      }
    : null;

  const live = new Map<string, NhlIcePlayer[]>();
  for (const block of input.onIce ?? []) {
    const list = (block.entries ?? [])
      .map((e) => roster.get(String(e.athleteid ?? "")))
      .filter((p): p is NhlIcePlayer => Boolean(p));
    if (list.length) live.set(String(block.teamId ?? ""), list);
  }
  if (live.has(input.awayTeamId) && live.has(input.homeTeamId)) {
    return {
      source: "live",
      away: live.get(input.awayTeamId)!,
      home: live.get(input.homeTeamId)!,
      period,
      homeAttacksRight,
      lastEvent,
    };
  }
  if (lineups.has(input.awayTeamId) || lineups.has(input.homeTeamId)) {
    return {
      source: "lineup",
      away: lineups.get(input.awayTeamId) ?? [],
      home: lineups.get(input.homeTeamId) ?? [],
      period,
      homeAttacksRight,
      lastEvent,
    };
  }
  const starter = (s: { id: string; name: string } | null): NhlIcePlayer[] =>
    s
      ? [
          {
            id: s.id,
            name: s.name,
            lastName: s.name.split(" ").slice(1).join(" ") || s.name,
            jersey: null,
            position: "G",
            headshot: nhlHeadshot(s.id),
          },
        ]
      : [];
  if (!input.starters.away && !input.starters.home) return null;
  return {
    source: "goalies",
    away: starter(input.starters.away),
    home: starter(input.starters.home),
    period: null,
    homeAttacksRight: true,
    lastEvent: null,
  };
}

type NhlSummaryRecord = { type?: string; summary?: string; displayValue?: string };

/** Standings points from a W-L-OTL line, for when no source states them outright. */
export function nhlPointsFromRecord(record: string | null | undefined): number | null {
  const m = /^(\d+)-(\d+)-(\d+)/.exec(record?.trim() ?? "");
  return m ? Number(m[1]) * 2 + Number(m[3]) : null;
}

/** ESPN header totals read "0-1-0, 0 PTS"; standings entries carry `points`. */
function summaryPoints(
  competitor: { record?: NhlSummaryRecord[]; records?: NhlSummaryRecord[] } | undefined,
  standings: Map<string, number>,
  teamId: number,
  record: string | null,
): number | null {
  const list = competitor?.record ?? competitor?.records ?? [];
  const total = list.find((r) => r.type === "total") ?? list[0];
  const stated = /(\d+)\s*PTS/i.exec(total?.displayValue ?? "");
  if (stated) return Number(stated[1]);
  return standings.get(String(teamId)) ?? nhlPointsFromRecord(record);
}

/** Header competitors carry `record` (singular); summary `standings` is the fallback. */
function summaryRecord(
  competitor: { record?: NhlSummaryRecord[]; records?: NhlSummaryRecord[] } | undefined,
  standings: Map<string, string>,
  teamId: number,
): string | null {
  const list = competitor?.record ?? competitor?.records ?? [];
  return (
    list.find((r) => r.type === "total")?.summary ??
    list[0]?.summary ??
    standings.get(String(teamId)) ??
    null
  );
}

export async function fetchNhlGameDetail(eventId: string): Promise<NhlGameDetail> {
  const raw = await getJson<{
    header?: { competitions?: EspnEvent["competitions"]; id?: string };
    onIce?: { teamId?: string; entries?: { athleteid?: string }[] }[];
    standings?: {
      groups?: {
        standings?: {
          entries?: { id?: string; stats?: { name?: string; displayValue?: string }[] }[];
        };
      }[];
    };
    boxscore?: {
      teams?: {
        homeAway?: string;
        team?: { abbreviation?: string; id?: string };
        statistics?: { name?: string; displayValue?: string; label?: string }[];
      }[];
      players?: {
        team?: { id?: string; abbreviation?: string };
        statistics?: {
          name?: string;
          labels?: string[];
          athletes?: NhlSummaryAthlete[];
        }[];
      }[];
    };
    plays?: {
      id?: string;
      text?: string;
      type?: { text?: string; abbreviation?: string };
      coordinate?: { x?: number; y?: number };
      scoringPlay?: boolean;
      awayScore?: number;
      homeScore?: number;
      period?: { number?: number; displayValue?: string };
      clock?: { displayValue?: string };
      team?: { id?: string };
      strength?: { text?: string; abbreviation?: string };
      participants?: {
        type?: string;
        athlete?: { id?: string; displayName?: string; headshot?: { href?: string } };
      }[];
    }[];
    videos?: NhlEspnVideoRaw[];
    leaders?: {
      team?: { abbreviation?: string };
      leaders?: {
        displayName?: string;
        leaders?: {
          displayValue?: string;
          athlete?: { id?: string; displayName?: string };
        }[];
      }[];
    }[];
    article?: { headline?: string; description?: string; story?: string };
    pickcenter?: { details?: string; overUnder?: number; spread?: number }[];
    odds?: { details?: string; overUnder?: number }[];
    lastFiveGames?: {
      team?: { id?: string; abbreviation?: string };
      events?: {
        opponent?: { abbreviation?: string; displayName?: string };
        result?: string;
        score?: string;
      }[];
    }[];
    gameInfo?: {
      venue?: { fullName?: string; address?: { city?: string; state?: string } };
    };
    broadcasts?: {
      market?: { type?: string } | string;
      media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
      isNational?: boolean;
    }[];
    goalies?: {
      away?: { athlete?: { id?: string; displayName?: string }; starter?: boolean }[];
      home?: { athlete?: { id?: string; displayName?: string }; starter?: boolean }[];
      team?: { homeAway?: string };
    };
  }>(`${ESPN}/summary?event=${encodeURIComponent(eventId)}`);

  const headerEvent: EspnEvent = {
    id: eventId,
    date: raw.header?.competitions?.[0]?.date,
    competitions: raw.header?.competitions,
  };
  let base = mapScoreEvent(headerEvent);
  if (!base) throw new Error("NHL game missing competitors");

  const standingRecords = new Map<string, string>();
  const standingPoints = new Map<string, number>();
  for (const group of raw.standings?.groups ?? []) {
    for (const e of group.standings?.entries ?? []) {
      if (!e.id) continue;
      const stat = (n: string) => e.stats?.find((s) => s.name === n)?.displayValue ?? "0";
      standingRecords.set(String(e.id), `${stat("wins")}-${stat("losses")}-${stat("otLosses")}`);
      const pts = Number(e.stats?.find((s) => s.name === "points")?.displayValue);
      if (Number.isFinite(pts)) standingPoints.set(String(e.id), pts);
    }
  }
  const headerCompetitors = (raw.header?.competitions?.[0]?.competitors ?? []) as (EspnCompetitor & {
    record?: NhlSummaryRecord[];
  })[];
  const withRecord = (side: NhlScoreSide, homeAway: string): NhlScoreSide => {
    const competitor = headerCompetitors.find((c) => c.homeAway === homeAway);
    const record = side.record ?? summaryRecord(competitor, standingRecords, side.teamId);
    return {
      ...side,
      record,
      points: summaryPoints(competitor, standingPoints, side.teamId, record),
    };
  };
  base = { ...base, away: withRecord(base.away, "away"), home: withRecord(base.home, "home") };

  // Prefer scoreboard broadcasts; fall back to summary broadcast list.
  if (!base.broadcasts.length && raw.broadcasts?.length) {
    const named = raw.broadcasts.map((b) => {
      const market =
        typeof b.market === "string"
          ? b.market
          : b.market?.type ?? (b.isNational ? "national" : null);
      const name = b.media?.shortName ?? b.media?.name ?? "";
      return { market: market ?? undefined, names: name ? [name] : [] };
    });
    base = {
      ...base,
      broadcasts: parseEspnBroadcasts(
        raw.broadcasts.map((b) => ({
          market: typeof b.market === "object" ? b.market : { type: b.isNational ? "National" : undefined },
          media: b.media,
        })),
        named,
      ),
    };
  }

  const awayTeam = raw.boxscore?.teams?.find((t) => t.homeAway === "away");
  const homeTeam = raw.boxscore?.teams?.find((t) => t.homeAway === "home");
  const awayMap = new Map(
    (awayTeam?.statistics ?? []).map((s) => [s.name ?? s.label ?? "", s.displayValue ?? "—"]),
  );
  const homeMap = new Map(
    (homeTeam?.statistics ?? []).map((s) => [s.name ?? s.label ?? "", s.displayValue ?? "—"]),
  );
  const teamStatKeys: { name: string; label: string }[] = [
    { name: "shotsTotal", label: "Shots" },
    { name: "powerPlayGoals", label: "PP goals" },
    { name: "powerPlayOpportunities", label: "PP chances" },
    { name: "faceoffPercent", label: "Faceoff %" },
    { name: "hits", label: "Hits" },
    { name: "blockedShots", label: "Blocks" },
    { name: "takeaways", label: "Takeaways" },
    { name: "giveaways", label: "Giveaways" },
    { name: "penaltyMinutes", label: "PIM" },
  ];
  const teamStats = teamStatKeys
    .filter((k) => awayMap.has(k.name) || homeMap.has(k.name))
    .map((k) => ({
      label: k.label,
      away: awayMap.get(k.name) ?? "—",
      home: homeMap.get(k.name) ?? "—",
    }));

  const boxGroups: NhlBoxGroup[] = [];
  for (const side of raw.boxscore?.players ?? []) {
    const abbrev = side.team?.abbreviation ?? "—";
    const teamId = String(side.team?.id ?? "");
    for (const group of side.statistics ?? []) {
      const name = (group.name ?? "").toLowerCase();
      if (name !== "forwards" && name !== "defenses" && name !== "goalies") continue;
      const labels = group.labels ?? [];
      const want = name === "goalies" ? GOALIE_COLS : SKATER_COLS;
      const toiAt = labels.indexOf("TOI");
      const fallbackPos = name === "goalies" ? "G" : name === "defenses" ? "D" : null;
      const rows = (group.athletes ?? [])
        .map((a): NhlBoxRow | null => {
          const id = String(a.athlete?.id ?? "");
          if (!id) return null;
          return {
            id,
            name: a.athlete?.displayName ?? "Player",
            jersey: a.athlete?.jersey ?? null,
            position: a.athlete?.position?.abbreviation ?? fallbackPos,
            toiSec: toiAt >= 0 ? toiSeconds(a.stats?.[toiAt]) : 0,
            stats: pickCols(labels, a.stats ?? [], want),
          };
        })
        .filter((r): r is NhlBoxRow => Boolean(r));
      if (name !== "goalies") {
        rows.sort(
          (a, b) =>
            statNum(b.stats, "G") +
            statNum(b.stats, "A") -
            (statNum(a.stats, "G") + statNum(a.stats, "A")) ||
            statNum(b.stats, "G") - statNum(a.stats, "G"),
        );
      }
      if (rows.length) {
        boxGroups.push({
          teamAbbrev: abbrev,
          teamId,
          name: name === "defenses" ? "Defense" : name === "goalies" ? "Goalies" : "Forwards",
          rows,
        });
      }
    }
  }

  const scoringPlays: NhlScoringPlay[] = (raw.plays ?? [])
    .filter((p) => p.scoringPlay)
    .map((p) => ({
      id: String(p.id ?? Math.random()),
      text: (p.text ?? "").replace(/\s+/g, " ").trim(),
      period: p.period?.displayValue ?? null,
      periodNumber: typeof p.period?.number === "number" ? p.period.number : null,
      clock: p.clock?.displayValue ?? null,
      awayScore: typeof p.awayScore === "number" ? p.awayScore : null,
      homeScore: typeof p.homeScore === "number" ? p.homeScore : null,
      teamId: p.team?.id ?? null,
      strength: p.strength?.text && !/even/i.test(p.strength.text) ? p.strength.text : null,
      athletes: (p.participants ?? [])
        .map((part) => ({
          id: String(part.athlete?.id ?? ""),
          name: part.athlete?.displayName ?? "",
          role: part.type ?? "",
        }))
        .filter((a) => a.id && a.name),
    }));

  const recentPlays: NhlRecentPlay[] = [];
  const allPlays = raw.plays ?? [];
  for (let i = allPlays.length - 1; i >= 0 && recentPlays.length < RECENT_PLAY_LIMIT; i--) {
    const p = allPlays[i]!;
    const type = p.type?.text ?? "";
    const text = (p.text ?? "").replace(/\s+/g, " ").trim();
    if (!text || RECENT_PLAY_SKIP.test(type)) continue;
    const lead = p.participants?.[0]?.athlete;
    recentPlays.push({
      id: String(p.id ?? `${i}`),
      text,
      type,
      period: p.period?.displayValue ?? null,
      clock: p.clock?.displayValue ?? null,
      teamId: p.team?.id ?? null,
      scoringPlay: Boolean(p.scoringPlay),
      awayScore: typeof p.awayScore === "number" ? p.awayScore : null,
      homeScore: typeof p.homeScore === "number" ? p.homeScore : null,
      athlete: lead?.id
        ? {
            id: String(lead.id),
            name: lead.displayName ?? "",
            headshot: lead.headshot?.href ?? nhlHeadshot(lead.id),
          }
        : null,
    });
  }

  const videos: NhlGameVideo[] = [];
  const seenVideo = new Set<string>();
  for (const rawVid of raw.videos ?? []) {
    const mapped = mapNhlEspnVideo(rawVid);
    if (!mapped || seenVideo.has(mapped.id)) continue;
    seenVideo.add(mapped.id);
    videos.push(mapped);
  }

  const leaders: NhlGameLeader[] = [];
  for (const block of raw.leaders ?? []) {
    const abbrev = block.team?.abbreviation ?? "";
    for (const cat of block.leaders ?? []) {
      if (!/goals|assists|points|saves/i.test(cat.displayName ?? "")) continue;
      const top = cat.leaders?.[0];
      if (!top?.athlete?.id) continue;
      leaders.push({
        category: cat.displayName ?? "Stat",
        teamAbbrev: abbrev,
        id: String(top.athlete.id),
        name: top.athlete.displayName ?? "Player",
        value: top.displayValue ?? "—",
      });
    }
  }

  const pick = raw.pickcenter?.[0] ?? raw.odds?.[0];
  const oddsLine = pick?.details
    ? `${pick.details}${pick.overUnder != null ? ` · O/U ${pick.overUnder}` : ""}`
    : null;

  const lastFive = (raw.lastFiveGames ?? []).map((side) => ({
    teamId: Number(side.team?.id) || 0,
    teamAbbrev: side.team?.abbreviation ?? "—",
    results: (side.events ?? []).slice(0, 5).map((e) => ({
      label: e.opponent?.abbreviation ?? e.opponent?.displayName ?? "Opp",
      result: e.result ?? "—",
      score: e.score ?? null,
    })),
  }));

  const venueBits = [
    raw.gameInfo?.venue?.fullName || base.venue,
    raw.gameInfo?.venue?.address
      ? [raw.gameInfo.venue.address.city, raw.gameInfo.venue.address.state].filter(Boolean).join(", ")
      : null,
  ].filter(Boolean);

  const pickStarter = (
    list: { athlete?: { id?: string; displayName?: string }; starter?: boolean }[] | undefined,
  ) => {
    const starter = list?.find((g) => g.starter) ?? list?.[0];
    if (!starter?.athlete?.id) return null;
    return { id: String(starter.athlete.id), name: starter.athlete.displayName ?? "Goalie" };
  };
  const goaliesRaw = raw.goalies;
  let awayGoalie = pickStarter(goaliesRaw?.away);
  let homeGoalie = pickStarter(goaliesRaw?.home);
  // Some payloads nest by team.homeAway instead of away/home keys.
  if (!awayGoalie || !homeGoalie) {
    const asList = Array.isArray(goaliesRaw) ? goaliesRaw : [];
    for (const block of asList as {
      team?: { homeAway?: string };
      athletes?: { athlete?: { id?: string; displayName?: string }; starter?: boolean }[];
    }[]) {
      const starter = pickStarter(block.athletes);
      if (!starter) continue;
      if (block.team?.homeAway === "away") awayGoalie = awayGoalie ?? starter;
      if (block.team?.homeAway === "home") homeGoalie = homeGoalie ?? starter;
    }
  }

  const ice = buildNhlIceState({
    onIce: raw.onIce,
    players: raw.boxscore?.players ?? [],
    plays: raw.plays ?? [],
    awayTeamId: String(base.away.teamId),
    homeTeamId: String(base.home.teamId),
    starters: { away: awayGoalie, home: homeGoalie },
  });

  return {
    ...base,
    teamStats,
    ice,
    boxGroups,
    scoringPlays,
    recentPlays,
    videos,
    leaders,
    article: raw.article?.headline
      ? {
          headline: raw.article.headline,
          description: raw.article.description ?? null,
          storyHtml: sanitizeNhlStoryHtml(raw.article.story),
        }
      : null,
    oddsLine,
    lastFive,
    venueDetail: venueBits.length ? venueBits.join(" · ") : null,
    goalieStarters: { away: awayGoalie, home: homeGoalie },
  };
}

// ---------------------------------------------------------------------------
// NHL gamecenter (api-web.nhle.com) + Brightcove goal clips
// ---------------------------------------------------------------------------

export type NhlGoalClip = NhlGameVideo & {
  source: "nhl";
  periodNumber: number;
  periodLabel: string;
  /** "05:12" elapsed in period. */
  timeInPeriod: string;
  teamAbbrev: string;
  scorer: string;
  scorerLastName: string;
  scorerHeadshot: string | null;
  /** "PPG" / "SHG" / "EN" / "PS" — null at even strength. */
  tag: string | null;
  awayScore: number | null;
  homeScore: number | null;
};

export type NhlSideSituation = {
  abbrev: string;
  strength: number | null;
  /** NHL descriptors such as "PP" or "EN". */
  descriptors: string[];
};

export type NhlGameSituation = {
  away: NhlSideSituation;
  home: NhlSideSituation;
  timeRemaining: string | null;
  powerPlayAbbrev: string | null;
};

export type NhlGamecenter = {
  nhlGameId: number;
  nhlUrl: string;
  situation: NhlGameSituation | null;
  goals: NhlGoalClip[];
  /** Finished games only: NHL recap and condensed game, best first. */
  wraps: NhlGameVideo[];
  /** Official Three Stars; empty until the NHL posts them (usually right after the horn). */
  threeStars: NhlThreeStar[];
};

/**
 * api-web.nhle.com sends no CORS headers, so browsers go through the same-origin
 * `/api/nhl` Vercel function (`api/nhl.ts`; Vite dev serves the same route).
 * The direct call only helps outside the browser (tests, SSR, future CORS).
 */
export async function nhlWebJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`/api/nhl?path=${encodeURIComponent(path)}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok && /json/i.test(res.headers.get("content-type") ?? "")) {
      return (await res.json()) as T;
    }
  } catch {
    /* fall through to direct */
  }
  return getJson<T>(`https://api-web.nhle.com/${path}`);
}

/** ESPN uses two-letter codes where NHL uses three. Everything else already agrees. */
const NHL_TO_ESPN_ABBREV: Record<string, string> = { LAK: "LA", NJD: "NJ", SJS: "SJ", TBL: "TB" };

export function canonNhlAbbrev(abbrev: string | null | undefined): string {
  const up = (abbrev ?? "").toUpperCase();
  return NHL_TO_ESPN_ABBREV[up] ?? up;
}

type NhlScheduleJson = {
  gameWeek?: {
    games?: {
      id?: number;
      startTimeUTC?: string;
      awayTeam?: { abbrev?: string };
      homeTeam?: { abbrev?: string };
    }[];
  }[];
};

const nhlGameIdCache = new Map<string, Promise<number | null>>();

/**
 * ESPN event id → NHL game id. ESPN's summary carries no NHL id, so match on
 * matchup + puck drop: `/v1/schedule/{date}` returns a 7-day week starting at
 * `date`; we ask from the day before ESPN's start (Eastern) so late UTC starts
 * and date-line edges still land in the window, then take the game with the same
 * away/home abbrevs whose `startTimeUTC` is closest (within 36h) to ESPN's.
 */
export function resolveNhlGameId(
  game: Pick<NhlScoreGame, "id" | "startIso" | "away" | "home">,
): Promise<number | null> {
  const cached = nhlGameIdCache.get(game.id);
  if (cached) return cached;
  const startMs = Date.parse(game.startIso ?? "");
  if (!Number.isFinite(startMs)) return Promise.resolve(null);
  const from = new Date(startMs - 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const away = canonNhlAbbrev(game.away.abbrev);
  const home = canonNhlAbbrev(game.home.abbrev);
  const job = nhlWebJson<NhlScheduleJson>(`v1/schedule/${from}`)
    .then((raw) => {
      let best: { id: number; gap: number } | null = null;
      for (const day of raw.gameWeek ?? []) {
        for (const g of day.games ?? []) {
          if (!g.id) continue;
          if (canonNhlAbbrev(g.awayTeam?.abbrev) !== away) continue;
          if (canonNhlAbbrev(g.homeTeam?.abbrev) !== home) continue;
          const gap = Math.abs(Date.parse(g.startTimeUTC ?? "") - startMs);
          if (!Number.isFinite(gap) || gap > 36 * 3_600_000) continue;
          if (!best || gap < best.gap) best = { id: g.id, gap };
        }
      }
      return best?.id ?? null;
    })
    .catch(() => null);
  nhlGameIdCache.set(game.id, job);
  void job.then((id) => {
    if (id == null) nhlGameIdCache.delete(game.id);
  });
  return job;
}

/**
 * NHL.com plays clips through Brightcove (account 6415718365001, player
 * `default_default`). The Playback API needs that player's public policy key in
 * the Accept header. We seed with the key verified from
 * players.brightcove.net/6415718365001/default_default/config.json and, if
 * Brightcove ever rejects it (rotation), re-read `video_cloud.policy_key` from
 * that same small, CORS-open config once per session and retry.
 */
const NHL_BC_ACCOUNT = "6415718365001";
const NHL_BC_CONFIG = `https://players.brightcove.net/${NHL_BC_ACCOUNT}/default_default/config.json`;
let nhlBcPolicyKey =
  "BCpkADawqM3l37Vq8trLJ95vVwxubXYZXYglAopEZXQTHTWX3YdalyF9xmkuknxjBgiMYwt8VZ_OZ1jAjYxz_yzuNh_cjC3uOaMspVTD-hZfNUHtNnBnhVD0Gmsih8TBF8QlQFXiCQM3W_u4ydJ1qK2Rx8ZutCUg3PHb7Q";
let nhlBcKeyRefresh: Promise<string | null> | null = null;

function refreshNhlBcPolicyKey(): Promise<string | null> {
  nhlBcKeyRefresh ??= getJson<{ video_cloud?: { policy_key?: string } }>(NHL_BC_CONFIG)
    .then((cfg) => {
      const key = cfg.video_cloud?.policy_key ?? null;
      if (key) nhlBcPolicyKey = key;
      return key;
    })
    .catch(() => null);
  return nhlBcKeyRefresh;
}

type BrightcoveVideo = {
  name?: string;
  description?: string;
  duration?: number;
  poster?: string;
  thumbnail?: string;
  sources?: { container?: string; src?: string; width?: number; avg_bitrate?: number }[];
};

type ResolvedBrightcove = {
  name: string | null;
  description: string | null;
  mp4: string | null;
  poster: string | null;
  durationSec: number | null;
};

const nhlBcCache = new Map<string, Promise<ResolvedBrightcove | null>>();

async function loadBrightcove(videoId: string): Promise<ResolvedBrightcove | null> {
  const url = `https://edge.api.brightcove.com/playback/v1/accounts/${NHL_BC_ACCOUNT}/videos/${videoId}`;
  const call = (key: string) => fetch(url, { headers: { Accept: `application/json;pk=${key}` } });
  const usedKey = nhlBcPolicyKey;
  let res = await call(usedKey);
  if (res.status === 401 || res.status === 403) {
    const fresh = await refreshNhlBcPolicyKey();
    if (fresh && fresh !== usedKey) res = await call(fresh);
  }
  if (!res.ok) return null;
  const v = (await res.json()) as BrightcoveVideo;
  // Progressive MP4 plays in a bare <video> everywhere; HLS/DASH would need a player lib.
  const mp4 =
    (v.sources ?? [])
      .filter((s) => s.container === "MP4" && s.src?.startsWith("https://"))
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0) || (b.avg_bitrate ?? 0) - (a.avg_bitrate ?? 0))[0]
      ?.src ?? null;
  return {
    name: v.name?.trim() || null,
    description: v.description?.trim() || null,
    mp4,
    poster: v.poster ?? v.thumbnail ?? null,
    durationSec: typeof v.duration === "number" ? Math.round(v.duration / 1000) : null,
  };
}

function resolveBrightcove(videoId: string): Promise<ResolvedBrightcove | null> {
  const cached = nhlBcCache.get(videoId);
  if (cached) return cached;
  const job = loadBrightcove(videoId).catch(() => null);
  nhlBcCache.set(videoId, job);
  void job.then((r) => {
    if (!r?.mp4) nhlBcCache.delete(videoId);
  });
  return job;
}

type NhlLandingGoal = {
  eventId?: number;
  highlightClip?: number;
  discreteClip?: number;
  highlightClipSharingUrl?: string;
  firstName?: { default?: string };
  lastName?: { default?: string };
  name?: { default?: string };
  teamAbbrev?: { default?: string };
  headshot?: string;
  strength?: string;
  goalModifier?: string;
  awayScore?: number;
  homeScore?: number;
  timeInPeriod?: string;
  assists?: { name?: { default?: string } }[];
};

type NhlLandingSide = { abbrev?: string; strength?: number; situationDescriptions?: string[] };

type NhlLandingJson = {
  id?: number;
  gameState?: string;
  situation?: {
    awayTeam?: NhlLandingSide;
    homeTeam?: NhlLandingSide;
    timeRemaining?: string;
  };
  summary?: {
    scoring?: {
      periodDescriptor?: { number?: number; periodType?: string };
      goals?: NhlLandingGoal[];
    }[];
    threeStars?: NhlLandingStar[];
  };
};

type NhlLandingStar = {
  star?: number;
  playerId?: number;
  teamAbbrev?: string;
  headshot?: string;
  name?: { default?: string };
  sweaterNo?: number;
  position?: string;
  goals?: number;
  assists?: number;
  points?: number;
  goalsAgainstAverage?: number;
  savePctg?: number;
};

/** One of the official NHL Three Stars of the Game (gamecenter landing `summary.threeStars`). */
export type NhlThreeStar = {
  star: 1 | 2 | 3;
  nhlPlayerId: number;
  /** As posted by the NHL, e.g. "J. Hofer". */
  name: string;
  /** ESPN-style abbreviation so it lines up with ESPN sides and box groups. */
  teamAbbrev: string;
  headshot: string | null;
  sweaterNo: string | null;
  /** NHL code: C / L / R / D / G. */
  position: string | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  goalsAgainstAverage: number | null;
  savePctg: number | null;
};

function mapThreeStars(raw: NhlLandingStar[] | undefined): NhlThreeStar[] {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return (raw ?? [])
    .filter((s) => s.playerId && (s.star === 1 || s.star === 2 || s.star === 3))
    .map((s) => ({
      star: s.star as 1 | 2 | 3,
      nhlPlayerId: s.playerId!,
      name: s.name?.default?.trim() || "Player",
      teamAbbrev: canonNhlAbbrev(s.teamAbbrev),
      headshot: s.headshot ?? null,
      sweaterNo: s.sweaterNo != null ? String(s.sweaterNo) : null,
      position: s.position ?? null,
      goals: num(s.goals),
      assists: num(s.assists),
      points: num(s.points),
      goalsAgainstAverage: num(s.goalsAgainstAverage),
      savePctg: num(s.savePctg),
    }))
    .sort((a, b) => a.star - b.star);
}

/**
 * Three Stars carry NHL ids; the app's player pages are keyed by ESPN id. Match
 * the ESPN box-score row on team + sweater number, falling back to last name.
 */
export function matchStarToBoxRow(star: NhlThreeStar, groups: NhlBoxGroup[]): NhlBoxRow | null {
  const rows = groups
    .filter((g) => canonNhlAbbrev(g.teamAbbrev) === star.teamAbbrev)
    .flatMap((g) => g.rows);
  if (star.sweaterNo) {
    const byNumber = rows.find((r) => r.jersey === star.sweaterNo);
    if (byNumber) return byNumber;
  }
  const last = star.name.split(/[\s.]+/).filter(Boolean).pop()?.toLowerCase();
  if (!last) return null;
  return rows.find((r) => r.name.toLowerCase().split(/\s+/).pop() === last) ?? null;
}

/** Just the Three Stars for an ESPN game — no clip resolution. Empty until the NHL posts them. */
export async function fetchNhlThreeStars(
  game: Pick<NhlScoreGame, "id" | "startIso" | "away" | "home">,
): Promise<NhlThreeStar[]> {
  const nhlGameId = await resolveNhlGameId(game);
  if (nhlGameId == null) return [];
  const landing = await nhlWebJson<NhlLandingJson>(`v1/gamecenter/${nhlGameId}/landing`).catch(
    () => null,
  );
  return mapThreeStars(landing?.summary?.threeStars);
}

function nhlPeriodLabel(num: number, type: string | undefined): string {
  if (type === "SO") return "SO";
  if (type === "OT" || num > 3) return num > 4 ? `${num - 3}OT` : "OT";
  return ["1st", "2nd", "3rd"][num - 1] ?? `P${num}`;
}

function goalTag(g: NhlLandingGoal): string | null {
  if (g.goalModifier === "empty-net") return "EN";
  if (g.goalModifier === "penalty-shot") return "PS";
  if (g.strength === "pp") return "PPG";
  if (g.strength === "sh") return "SHG";
  return null;
}

function mapSituation(raw: NhlLandingJson["situation"]): NhlGameSituation | null {
  if (!raw?.awayTeam || !raw.homeTeam) return null;
  const side = (s: NhlLandingSide): NhlSideSituation => ({
    abbrev: canonNhlAbbrev(s.abbrev),
    strength: typeof s.strength === "number" ? s.strength : null,
    descriptors: s.situationDescriptions ?? [],
  });
  const away = side(raw.awayTeam);
  const home = side(raw.homeTeam);
  const powerPlayAbbrev = away.descriptors.includes("PP")
    ? away.abbrev
    : home.descriptors.includes("PP")
      ? home.abbrev
      : null;
  return { away, home, timeRemaining: raw.timeRemaining ?? null, powerPlayAbbrev };
}

/** NHL landing for an ESPN game: live strength situation + Brightcove goal clips. */
export async function fetchNhlGamecenter(
  game: Pick<NhlScoreGame, "id" | "startIso" | "away" | "home">,
): Promise<NhlGamecenter | null> {
  const nhlGameId = await resolveNhlGameId(game);
  if (nhlGameId == null) return null;
  const landing = await nhlWebJson<NhlLandingJson>(`v1/gamecenter/${nhlGameId}/landing`);

  const pending: Promise<NhlGoalClip | null>[] = [];
  for (const period of landing.summary?.scoring ?? []) {
    const num = period.periodDescriptor?.number ?? 0;
    const periodLabel = nhlPeriodLabel(num, period.periodDescriptor?.periodType);
    for (const g of period.goals ?? []) {
      const clipId = g.highlightClip ?? g.discreteClip;
      if (!clipId) continue;
      pending.push(
        resolveBrightcove(String(clipId)).then((bc): NhlGoalClip | null => {
          if (!bc?.mp4) return null;
          const scorer =
            [g.firstName?.default, g.lastName?.default].filter(Boolean).join(" ") ||
            g.name?.default ||
            "Goal";
          const team = canonNhlAbbrev(g.teamAbbrev?.default);
          const tag = goalTag(g);
          const assists = (g.assists ?? []).map((a) => a.name?.default).filter(Boolean);
          const description = [
            `${team} · ${periodLabel} ${g.timeInPeriod ?? ""}`.trim(),
            tag,
            assists.length ? `Assists: ${assists.join(", ")}` : "Unassisted",
          ]
            .filter(Boolean)
            .join(" · ");
          return {
            id: `nhl-${clipId}`,
            headline: bc.name ?? `${scorer} goal`,
            description,
            thumb: bc.poster,
            mp4: bc.mp4,
            href: g.highlightClipSharingUrl ?? null,
            durationSec: bc.durationSec,
            source: "nhl",
            periodNumber: num,
            periodLabel,
            timeInPeriod: g.timeInPeriod ?? "",
            teamAbbrev: team,
            scorer,
            scorerLastName: g.lastName?.default ?? scorer.split(" ").pop() ?? scorer,
            scorerHeadshot: g.headshot ?? null,
            tag,
            awayScore: typeof g.awayScore === "number" ? g.awayScore : null,
            homeScore: typeof g.homeScore === "number" ? g.homeScore : null,
          };
        }),
      );
    }
  }
  const finished = landing.gameState === "OFF" || landing.gameState === "FINAL";
  const [resolvedGoals, wraps] = await Promise.all([
    Promise.all(pending),
    finished ? fetchNhlWrapVideos(nhlGameId) : Promise.resolve([]),
  ]);
  const goals = resolvedGoals.filter((g): g is NhlGoalClip => Boolean(g));

  return {
    nhlGameId,
    nhlUrl: `https://www.nhl.com/gamecenter/${nhlGameId}`,
    situation: mapSituation(landing.situation),
    goals,
    wraps,
    threeStars: mapThreeStars(landing.summary?.threeStars),
  };
}

type NhlRightRailJson = {
  gameVideo?: { threeMinRecap?: number; condensedGame?: number };
};

const NHL_WRAP_LABEL: Record<"nhl-recap" | "nhl-condensed", string> = {
  "nhl-recap": "Recap",
  "nhl-condensed": "Condensed game",
};

/** NHL posts these on the right rail a little after the horn; empty until then. */
async function fetchNhlWrapVideos(nhlGameId: number): Promise<NhlGameVideo[]> {
  const rail = await nhlWebJson<NhlRightRailJson>(`v1/gamecenter/${nhlGameId}/right-rail`).catch(
    () => null,
  );
  const wanted: [keyof typeof NHL_WRAP_LABEL, number | undefined][] = [
    ["nhl-recap", rail?.gameVideo?.threeMinRecap],
    ["nhl-condensed", rail?.gameVideo?.condensedGame],
  ];
  const resolved = await Promise.all(
    wanted.map(async ([kind, clipId]): Promise<NhlGameVideo | null> => {
      if (!clipId) return null;
      const bc = await resolveBrightcove(String(clipId));
      if (!bc?.mp4) return null;
      // Brightcove names these "BOS at WPG | Recap"; the description spells out team names.
      const title = (bc.description ?? bc.name ?? NHL_WRAP_LABEL[kind]).replace(/\s*\|\s*/g, " · ");
      return {
        id: `nhl-${clipId}`,
        headline: title,
        description: null,
        thumb: bc.poster,
        mp4: bc.mp4,
        href: null,
        durationSec: bc.durationSec,
        source: "nhl",
        wrap: kind,
      };
    }),
  );
  return resolved.filter((v): v is NhlGameVideo => Boolean(v));
}

const WRAP_RANK: Record<NhlWrapKind, number> = { "espn-final": 0, "nhl-recap": 1, "nhl-condensed": 2 };

/**
 * Whole-game packages, best first: ESPN's own "Final Game Highlight" (what
 * Gamecast leads with), then NHL's recap, then the longer condensed game. Within
 * one kind the longer package wins — it is the fuller game story.
 */
export function rankNhlWrapVideos(videos: NhlGameVideo[]): NhlGameVideo[] {
  return videos
    .filter((v) => v.wrap && v.mp4)
    .sort(
      (a, b) =>
        WRAP_RANK[a.wrap!] - WRAP_RANK[b.wrap!] || (b.durationSec ?? 0) - (a.durationSec ?? 0),
    );
}

/** "05:12" and "5:12" compare equal. */
export function nhlClockKey(periodNumber: number | null, clock: string | null): string | null {
  if (periodNumber == null || !clock) return null;
  const [m, s] = clock.split(":");
  if (m == null || s == null) return null;
  return `${periodNumber}-${Number(m)}:${s.padStart(2, "0")}`;
}

const GOAL_HEADLINE = /\b(goal|scores?|nets?|ppg|shg|tall(?:y|ies)|buries|snipes?|finishes|lights the lamp)\b/i;

/** Drop ESPN clips that are obviously the same goal as an NHL Brightcove clip. */
export function dedupeNhlEspnVideos(videos: NhlGameVideo[], goals: NhlGoalClip[]): NhlGameVideo[] {
  if (!goals.length) return videos;
  const lastNames = goals.map((g) => g.scorerLastName.toLowerCase()).filter((n) => n.length > 1);
  return videos.filter((v) => {
    if (v.wrap) return true;
    const h = v.headline.toLowerCase();
    if (!GOAL_HEADLINE.test(h)) return true;
    return !lastNames.some((n) => h.includes(n));
  });
}

export type NhlStatLine = { label: string; value: string };
export type NhlStatCategory = { name: string; stats: NhlStatLine[] };
export type NhlSeasonSplit = { season: string; categories: NhlStatCategory[] };
export type NhlGameLogRow = {
  eventId: string | null;
  date: string | null;
  opponent: string;
  atVs: string | null;
  result: string;
  stats: NhlStatLine[];
};
export type NhlPlayerNews = {
  headline: string;
  description: string;
  image: string | null;
  href: string | null;
};
export type NhlTeamStop = {
  teamId: string | null;
  teamName: string;
  teamLogo: string | null;
  seasons: string | null;
};

export type NhlPlayerProfile = {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
  positionName: string | null;
  teamId: string | null;
  teamName: string | null;
  teamAbbrev: string | null;
  teamColor: string | null;
  teamLogo: string | null;
  headshot: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  dob: string | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  birthPlace: string | null;
  shoots: string | null;
  experience: string | null;
  experienceYears: number | null;
  draft: string | null;
  status: string | null;
  seasonLabel: string | null;
  seasonStats: NhlStatLine[];
  seasonSplits: NhlSeasonSplit[];
  careerRows: { season: string; teamId: string | null; teamName: string | null; stats: NhlStatLine[] }[];
  careerLabels: string[];
  gameLog: NhlGameLogRow[];
  gameLogLabels: string[];
  teamHistory: NhlTeamStop[];
  news: NhlPlayerNews[];
};

type CareerStatsPayload = {
  teams?: Record<
    string,
    { id?: string; displayName?: string; abbreviation?: string; logos?: { href?: string }[] }
  >;
  categories?: {
    displayName?: string;
    labels?: string[];
    totals?: string[];
    statistics?: {
      teamId?: string;
      season?: { displayName?: string; year?: number };
      stats?: string[];
    }[];
  }[];
};

function linesFrom(labels: string[], values: string[]): NhlStatLine[] {
  return labels.map((label, i) => ({ label, value: values[i] ?? "—" }));
}

function athleteIdFromRef(ref: string | undefined): string | null {
  const m = /athletes\/(\d+)/.exec(ref ?? "");
  return m?.[1] ?? null;
}

export async function fetchNhlPlayerProfile(playerId: string): Promise<NhlPlayerProfile> {
  const id = String(playerId);
  const [athleteRes, overviewRes, careerRes, gameLogRes, coreRes] = await Promise.all([
    getJson<{ athlete?: Record<string, unknown> }>(`${ESPN_WEB}/athletes/${id}`),
    getJson<Record<string, unknown>>(`${ESPN_WEB}/athletes/${id}/overview`).catch(
      () => ({}) as Record<string, unknown>,
    ),
    getJson<CareerStatsPayload>(`${ESPN_WEB}/athletes/${id}/stats`).catch(() => null),
    getJson<Record<string, unknown>>(`${ESPN_WEB}/athletes/${id}/gamelog`).catch(() => null),
    getJson<Record<string, unknown>>(`${CORE}/athletes/${id}?lang=en&region=us`).catch(
      () => ({}) as Record<string, unknown>,
    ),
  ]);

  const a = { ...coreRes, ...(athleteRes.athlete ?? {}) } as Record<string, unknown>;
  const experienceYears = (a.experience as { years?: number } | undefined)?.years;
  const team = (a.team ?? {}) as {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
  const position = (a.position ?? {}) as { abbreviation?: string; displayName?: string };
  const handRaw = a.hand as { displayValue?: string; abbreviation?: string } | string | undefined;
  const shoots =
    typeof handRaw === "string"
      ? handRaw
      : (handRaw?.displayValue ?? handRaw?.abbreviation ?? null);
  const statusObj = a.status as { name?: string; type?: string } | undefined;

  const statistics = overviewRes.statistics as
    | {
        displayName?: string;
        labels?: string[];
        splits?: { displayName?: string; stats?: string[] }[];
      }
    | undefined;
  const labels = statistics?.labels ?? [];
  const regular =
    statistics?.splits?.find((s) => /regular/i.test(s.displayName ?? "")) ?? statistics?.splits?.[0];
  const careerSplit = statistics?.splits?.find((s) => /career/i.test(s.displayName ?? ""));
  const seasonLabel = statistics?.displayName?.replace(/\s+General$/i, "") ?? null;
  const seasonStats = regular ? linesFrom(labels, regular.stats ?? []).slice(0, 8) : [];
  const summary = (
    (a.statsSummary as { statistics?: { abbreviation?: string; displayValue?: string }[] } | undefined)
      ?.statistics ?? []
  ).map((s) => ({ label: s.abbreviation ?? "Stat", value: s.displayValue ?? "—" }));
  const keyStats = seasonStats.length ? seasonStats : summary.slice(0, 8);

  const seasonSplits: NhlSeasonSplit[] = [];
  if (regular && labels.length) {
    seasonSplits.push({
      season: seasonLabel ?? regular.displayName ?? "Season",
      categories: [{ name: "Season", stats: linesFrom(labels, regular.stats ?? []) }],
    });
  }
  if (careerSplit && labels.length) {
    seasonSplits.push({
      season: "Career",
      categories: [{ name: "Career", stats: linesFrom(labels, careerSplit.stats ?? []) }],
    });
  }

  const careerCat = careerRes?.categories?.[0];
  const careerLabels = careerCat?.labels ?? [];
  const teamById = new Map<string, { name: string; logo: string | null }>();
  for (const t of Object.values(careerRes?.teams ?? {})) {
    if (!t.id) continue;
    teamById.set(String(t.id), {
      name: t.displayName ?? t.abbreviation ?? "Team",
      logo: t.logos?.[0]?.href ?? (t.abbreviation ? nhlTeamLogo(t.abbreviation) : null),
    });
  }
  const careerRows = (careerCat?.statistics ?? [])
    .map((row) => ({
      season: row.season?.displayName ?? String(row.season?.year ?? "—"),
      teamId: row.teamId ? String(row.teamId) : null,
      teamName: row.teamId ? (teamById.get(String(row.teamId))?.name ?? null) : null,
      stats: linesFrom(careerLabels, row.stats ?? []),
      year: row.season?.year ?? 0,
    }))
    .sort((a, b) => b.year - a.year);

  const teamHistory: NhlTeamStop[] = [];
  const chronological = [...careerRows].sort((a, b) => a.year - b.year);
  for (const row of chronological) {
    const last = teamHistory[teamHistory.length - 1];
    if (last && last.teamId === row.teamId) {
      const start = last.seasons?.split("–")[0]?.trim() ?? row.season;
      last.seasons = start === row.season ? row.season : `${start} – ${row.season}`;
    } else {
      const meta = row.teamId ? teamById.get(row.teamId) : undefined;
      teamHistory.push({
        teamId: row.teamId,
        teamName: row.teamName ?? meta?.name ?? "Team",
        teamLogo: meta?.logo ?? null,
        seasons: row.season,
      });
    }
  }
  teamHistory.reverse();

  const eventMeta = (gameLogRes?.events ?? {}) as Record<
    string,
    {
      gameDate?: string;
      atVs?: string;
      gameResult?: string;
      score?: string;
      opponent?: { abbreviation?: string; displayName?: string };
    }
  >;
  const seasonTypes =
    (gameLogRes?.seasonTypes as {
      displayName?: string;
      categories?: { events?: { eventId?: string; stats?: string[] }[] }[];
    }[]) ?? [];
  const logLabels = (gameLogRes?.labels as string[] | undefined) ?? [];
  const regularType =
    seasonTypes.find((s) => /regular/i.test(s.displayName ?? "")) ?? seasonTypes[0];
  const logEvents = (regularType?.categories ?? []).flatMap((c) => c.events ?? []);
  const gameLog: NhlGameLogRow[] = logEvents.map((ev) => {
    const meta = eventMeta[String(ev.eventId ?? "")] ?? {};
    const result = `${meta.gameResult ?? ""} ${meta.score ?? ""}`.trim() || "—";
    return {
      eventId: ev.eventId != null ? String(ev.eventId) : null,
      date: meta.gameDate ?? null,
      opponent: meta.opponent?.abbreviation ?? meta.opponent?.displayName ?? "—",
      atVs: meta.atVs ?? null,
      result,
      stats: linesFrom(logLabels, ev.stats ?? []),
    };
  });
  if (gameLog.length > 1) {
    const first = Date.parse(gameLog[0]?.date ?? "");
    const last = Date.parse(gameLog[gameLog.length - 1]?.date ?? "");
    if (Number.isFinite(first) && Number.isFinite(last) && first < last) gameLog.reverse();
  }

  const newsRaw = (overviewRes.news ?? []) as {
    headline?: string;
    description?: string;
    images?: { url?: string }[];
    links?: { web?: { href?: string } };
  }[];
  const news = (Array.isArray(newsRaw) ? newsRaw : [])
    .slice(0, 8)
    .map((n) => ({
      headline: n.headline ?? "",
      description: n.description ?? "",
      image: n.images?.[0]?.url ?? null,
      href: n.links?.web?.href ?? null,
    }))
    .filter((n) => n.headline);

  return {
    id,
    name: String(a.displayName ?? a.fullName ?? "Player"),
    number: (a.displayJersey as string | undefined)?.replace(/^#/, "") ??
      (a.jersey != null ? String(a.jersey) : null),
    position: position.abbreviation ?? null,
    positionName: position.displayName ?? null,
    teamId: team.id ?? null,
    teamName: team.displayName ?? null,
    teamAbbrev: team.abbreviation ?? null,
    teamColor: team.color ?? null,
    teamLogo: team.logos?.[0]?.href ?? (team.abbreviation ? nhlTeamLogo(team.abbreviation) : null),
    headshot: (a.headshot as { href?: string } | undefined)?.href ?? nhlHeadshot(id),
    height: (a.displayHeight as string | undefined) ?? null,
    weight: (a.displayWeight as string | undefined) ?? null,
    age: typeof a.age === "number" ? a.age : null,
    dob: (a.displayDOB as string | undefined) ?? null,
    birthDate: espnBirthDate(a.dateOfBirth, a.displayDOB),
    birthPlace: espnBirthPlace(a.birthPlace, a.displayBirthPlace),
    shoots,
    experience: (a.displayExperience as string | undefined) ?? null,
    experienceYears: typeof experienceYears === "number" ? experienceYears : null,
    draft: (a.displayDraft as string | undefined) ?? null,
    status: statusObj?.name ?? statusObj?.type ?? null,
    seasonLabel,
    seasonStats: keyStats,
    seasonSplits,
    careerRows,
    careerLabels,
    gameLog,
    gameLogLabels: logLabels,
    teamHistory,
    news,
  };
}

export type NhlRosterPlayer = {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
  group: string;
  headshot: string | null;
};

export type NhlScheduleItem = {
  id: string;
  date: string | null;
  label: string;
  detail: string | null;
  state: "pre" | "in" | "post";
  homeAway: "home" | "away" | null;
  opponent: { id: string; abbrev: string; name: string; logo: string | null } | null;
  teamScore: number | null;
  oppScore: number | null;
  /** Finished games only. OTL covers overtime and shootout losses. */
  result: "W" | "L" | "OTL" | null;
};

export type NhlTeamPage = {
  id: string;
  name: string;
  shortName: string;
  abbrev: string;
  color: string;
  logo: string | null;
  record: string | null;
  points: number | null;
  homeRecord: string | null;
  roadRecord: string | null;
  /** "W3" / "L1", from ESPN's signed streak. */
  streak: string | null;
  goalDiff: number | null;
  standing: string | null;
  seasonLabel: string | null;
  venueName: string | null;
  venueCity: string | null;
  coachName: string | null;
  /** ESPN coach id, for `/sports/nhl/coach/:coachId`. */
  coachId: string | null;
  nextEvent: { id: string; name: string; date: string | null } | null;
  statGroups: { name: string; stats: NhlStatLine[] }[];
  /** Every season team stat by ESPN abbreviation (G, GA, S, SA, SV%, SPCT, FO%, PIM, …). */
  statMap: Record<string, string>;
  playerTables: { name: string; labels: string[]; rows: { id: string; name: string; stats: string[] }[] }[];
  roster: NhlRosterPlayer[];
  schedule: NhlScheduleItem[];
};

const TEAM_STAT_KEEP: Record<string, string[]> = {
  offensive: ["Goals", "Assists", "Points", "Shots", "G", "A", "PTS", "S"],
  defensive: ["Goals Against Average", "Save Percentage", "Saves", "GAA", "SV%", "SV"],
  general: ["Games Played", "Plus/Minus Rating", "GP", "+/-"],
  penalties: ["Penalty Minutes", "PIM"],
};

export async function fetchNhlTeamPage(teamId: string): Promise<NhlTeamPage> {
  const id = String(teamId);
  const season = nhlSeasonYear();
  type RosterJson = {
    coach?: { id?: string; firstName?: string; lastName?: string }[];
    athletes?: {
      position?: string;
      items?: {
        id?: string;
        displayName?: string;
        jersey?: string;
        position?: { abbreviation?: string };
        headshot?: { href?: string };
      }[];
    }[];
  };
  type TeamStatsJson = {
    requestedSeason?: { year?: number; displayName?: string };
    results?: {
      stats?: {
        categories?: {
          name?: string;
          displayName?: string;
          stats?: { displayName?: string; displayValue?: string; abbreviation?: string }[];
        }[];
      };
    };
  };
  type LeadersJson = {
    categories?: {
      name?: string;
      abbreviation?: string;
      displayName?: string;
      leaders?: { displayValue?: string; athlete?: { $ref?: string } }[];
    }[];
  };
  const [teamRes, rosterRes, statsRes, leadersRes, scheduleRes] = await Promise.all([
    getJson<{
      team?: {
        id?: string;
        displayName?: string;
        shortDisplayName?: string;
        abbreviation?: string;
        color?: string;
        standingSummary?: string;
        logos?: { href?: string }[];
        record?: {
          items?: { summary?: string; type?: string; stats?: { name?: string; value?: number }[] }[];
        };
        franchise?: { venue?: { fullName?: string; address?: { city?: string; state?: string } } };
        nextEvent?: { id?: string; name?: string; date?: string; shortName?: string }[];
      };
    }>(`${ESPN}/teams/${id}`),
    getJson<RosterJson>(`${ESPN}/teams/${id}/roster`).catch((): RosterJson => ({ athletes: [] })),
    getJson<TeamStatsJson>(`${ESPN}/teams/${id}/statistics`).catch((): TeamStatsJson => ({})),
    getJson<LeadersJson>(`${CORE}/seasons/${season}/types/2/teams/${id}/leaders`).catch(async () =>
      getJson<LeadersJson>(`${CORE}/seasons/${season - 1}/types/2/teams/${id}/leaders`).catch(
        (): LeadersJson => ({ categories: [] }),
      ),
    ),
    getJson<{
      events?: {
        id?: string;
        date?: string;
        shortName?: string;
        name?: string;
        competitions?: {
          status?: { type?: { state?: string; shortDetail?: string; completed?: boolean } };
          competitors?: {
            score?: string | { value?: number; displayValue?: string };
            homeAway?: string;
            winner?: boolean;
            team?: {
              id?: string;
              abbreviation?: string;
              displayName?: string;
              logos?: { href?: string }[];
            };
          }[];
        }[];
      }[];
    }>(`${ESPN}/teams/${id}/schedule`).catch(() => ({ events: [] })),
  ]);

  const t = teamRes.team ?? {};
  const roster: NhlRosterPlayer[] = [];
  const names = new Map<string, string>();
  for (const group of rosterRes.athletes ?? []) {
    const groupName = group.position || "Roster";
    for (const a of group.items ?? []) {
      const pid = String(a.id ?? "");
      if (!pid) continue;
      names.set(pid, a.displayName ?? "Player");
      roster.push({
        id: pid,
        name: a.displayName ?? "Player",
        number: a.jersey ?? null,
        position: a.position?.abbreviation ?? null,
        group: groupName,
        headshot: a.headshot?.href ?? nhlHeadshot(pid),
      });
    }
  }
  const coach = rosterRes.coach?.[0];
  const coachName = coach ? [coach.firstName, coach.lastName].filter(Boolean).join(" ") || null : null;
  const venue = t.franchise?.venue;
  const venueCity = [venue?.address?.city, venue?.address?.state].filter(Boolean).join(", ") || null;
  const recordItem = (type: string) => t.record?.items?.find((r) => r.type === type);
  const totalItem = recordItem("total") ?? t.record?.items?.[0];
  const record = totalItem?.summary ?? null;
  const totalStat = (name: string) => {
    const v = totalItem?.stats?.find((s) => s.name === name)?.value;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const streakRaw = totalStat("streak");
  const streak = streakRaw ? (streakRaw > 0 ? `W${streakRaw}` : `L${-streakRaw}`) : null;

  const statGroups: NhlTeamPage["statGroups"] = [];
  const statMap: Record<string, string> = {};
  const seasonLabel = statsRes.requestedSeason?.displayName ?? null;
  for (const cat of statsRes.results?.stats?.categories ?? []) {
    for (const s of cat.stats ?? []) {
      if (s.abbreviation && s.displayValue != null && !(s.abbreviation in statMap)) {
        statMap[s.abbreviation] = s.displayValue;
      }
    }
    const keep = TEAM_STAT_KEEP[cat.name ?? ""] ?? [];
    const stats = (cat.stats ?? [])
      .filter((s) => !keep.length || keep.includes(s.displayName ?? "") || keep.includes(s.abbreviation ?? ""))
      .slice(0, 6)
      .map((s) => ({
        label: s.abbreviation || s.displayName || "Stat",
        value: s.displayValue ?? "—",
      }))
      .filter((s) => s.value && s.value !== "0:00");
    if (stats.length) statGroups.push({ name: cat.displayName ?? cat.name ?? "Stats", stats });
  }

  const byAthlete = new Map<string, { id: string; values: Record<string, string> }>();
  const fillLeaders = (payload: LeadersJson) => {
    byAthlete.clear();
    for (const cat of payload.categories ?? []) {
      const key = cat.abbreviation || cat.name || "";
      if (!key) continue;
      for (const leader of (cat.leaders ?? []).slice(0, 18)) {
        const aid = athleteIdFromRef(leader.athlete?.$ref);
        if (!aid) continue;
        const row = byAthlete.get(aid) ?? { id: aid, values: {} };
        row.values[key] = leader.displayValue ?? "—";
        byAthlete.set(aid, row);
      }
    }
  };
  fillLeaders(leadersRes);
  if (![...byAthlete.values()].some((r) => r.values.PTS && r.values.PTS !== "0")) {
    const prior = await getJson<LeadersJson>(
      `${CORE}/seasons/${season - 1}/types/2/teams/${id}/leaders`,
    ).catch(() => null);
    if (prior) fillLeaders(prior);
  }
  const missing = [...byAthlete.keys()].filter((pid) => !names.has(pid)).slice(0, 16);
  await Promise.all(
    missing.map(async (pid) => {
      try {
        const body = await getJson<{ athlete?: { displayName?: string } }>(`${ESPN_WEB}/athletes/${pid}`);
        if (body.athlete?.displayName) names.set(pid, body.athlete.displayName);
      } catch {
        /* name stays unresolved */
      }
    }),
  );

  const skaterRows = [...byAthlete.values()]
    .filter((r) => r.values.PTS || r.values.G || r.values.A)
    .sort((a, b) => Number(b.values.PTS ?? 0) - Number(a.values.PTS ?? 0))
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      name: names.get(r.id) ?? "Player",
      stats: [r.values.G ?? "—", r.values.A ?? "—", r.values.PTS ?? "—", r.values["+/-"] ?? "—", r.values.PIM ?? "—"],
    }));
  const goalieRows = [...byAthlete.values()]
    .filter((r) => r.values.GAA || r.values["SV%"] || r.values.W)
    .sort((a, b) => Number(a.values.GAA ?? 99) - Number(b.values.GAA ?? 99))
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      name: names.get(r.id) ?? "Goalie",
      stats: [r.values.W ?? "—", r.values.GAA ?? "—", r.values["SV%"] ?? "—", r.values.SO ?? "—"],
    }));
  const playerTables: NhlTeamPage["playerTables"] = [];
  if (skaterRows.length) {
    playerTables.push({ name: "Skaters", labels: ["G", "A", "PTS", "+/-", "PIM"], rows: skaterRows });
  }
  if (goalieRows.length) {
    playerTables.push({ name: "Goalies", labels: ["W", "GAA", "SV%", "SO"], rows: goalieRows });
  }

  const scoreOf = (raw: string | { value?: number; displayValue?: string } | undefined) => {
    const n = Number(typeof raw === "object" ? (raw.value ?? raw.displayValue) : raw);
    return raw != null && raw !== "" && Number.isFinite(n) ? n : null;
  };
  const schedule: NhlScheduleItem[] = (scheduleRes.events ?? []).map((ev) => {
    const comp = ev.competitions?.[0];
    const stateRaw = comp?.status?.type?.state;
    const state: NhlScheduleItem["state"] =
      stateRaw === "in" ? "in" : stateRaw === "post" || comp?.status?.type?.completed ? "post" : "pre";
    const competitors = comp?.competitors ?? [];
    const us = competitors.find((c) => String(c.team?.id ?? "") === id);
    const them = competitors.find((c) => c !== us);
    const teamScore = state === "pre" ? null : scoreOf(us?.score);
    const oppScore = state === "pre" ? null : scoreOf(them?.score);
    const detail = comp?.status?.type?.shortDetail ?? null;
    let result: NhlScheduleItem["result"] = null;
    if (state === "post" && teamScore != null && oppScore != null) {
      const won = us?.winner ?? teamScore > oppScore;
      result = won ? "W" : /OT|SO/i.test(detail ?? "") ? "OTL" : "L";
    }
    const oppAbbrev = them?.team?.abbreviation ?? "";
    return {
      id: String(ev.id ?? ""),
      date: ev.date ?? null,
      label: ev.shortName || ev.name || "Game",
      detail,
      state,
      homeAway: us?.homeAway === "home" ? "home" : us?.homeAway === "away" ? "away" : null,
      opponent: them?.team
        ? {
            id: String(them.team.id ?? ""),
            abbrev: oppAbbrev,
            name: them.team.displayName ?? oppAbbrev,
            logo: them.team.logos?.[0]?.href ?? (oppAbbrev ? nhlTeamLogo(oppAbbrev) : null),
          }
        : null,
      teamScore,
      oppScore,
      result,
    };
  });
  // ESPN's `nextEvent` lingers on a game that already went final; prefer the schedule.
  const upcoming = schedule.find((g) => g.state !== "post");
  const espnNext = t.nextEvent?.[0];
  const espnNextDone = espnNext?.id ? schedule.some((g) => g.id === String(espnNext.id) && g.state === "post") : true;
  const nextEvent: NhlTeamPage["nextEvent"] = upcoming
    ? { id: upcoming.id, name: upcoming.label, date: upcoming.date }
    : espnNext?.id && !espnNextDone
      ? { id: String(espnNext.id), name: espnNext.shortName || espnNext.name || "Next game", date: espnNext.date ?? null }
      : null;

  return {
    id,
    name: t.displayName ?? "NHL team",
    shortName: t.shortDisplayName ?? t.abbreviation ?? "NHL",
    abbrev: t.abbreviation ?? "NHL",
    color: (t.color ?? "002f87").replace(/^#/, ""),
    logo: t.logos?.[0]?.href ?? (t.abbreviation ? nhlTeamLogo(t.abbreviation) : null),
    record,
    points: totalStat("points") ?? nhlPointsFromRecord(record),
    homeRecord: recordItem("home")?.summary ?? null,
    roadRecord: recordItem("road")?.summary ?? null,
    streak,
    goalDiff: totalStat("differential"),
    standing: t.standingSummary ?? null,
    seasonLabel,
    venueName: venue?.fullName ?? null,
    venueCity,
    coachName,
    coachId: coach?.id ? String(coach.id) : null,
    nextEvent,
    statGroups,
    statMap,
    playerTables,
    roster,
    schedule,
  };
}

export type NhlCoachRecordLine = {
  games: number;
  wins: number;
  losses: number;
  /** Overtime + shootout losses (regular season); 0 in playoffs. */
  otLosses: number;
  points: number | null;
  pointPctg: number | null;
};

export type NhlCoachStint = {
  franchiseName: string;
  teamAbbrev: string;
  /** ESPN team id when the franchise is still in the league. */
  espnTeamId: number | null;
  logo: string | null;
  /** "2018-19". */
  startSeason: string;
  endSeason: string;
  current: boolean;
  regular: NhlCoachRecordLine | null;
  playoffs: NhlCoachRecordLine | null;
  jackAdams: number;
  stanleyCups: number;
  cupFinals: number;
  firstCoached: string | null;
};

export type NhlCoachProfile = {
  espnId: string;
  name: string;
  image: string | null;
  birthDate: string | null;
  age: number | null;
  birthPlace: string | null;
  college: string | null;
  team: {
    espnId: number;
    name: string;
    abbrev: string;
    color: string;
    logo: string | null;
    record: string | null;
    points: number | null;
    standing: string | null;
  } | null;
  /** Head-coaching totals across every stop (records.nhl.com). */
  career: {
    seasons: number;
    regular: NhlCoachRecordLine;
    playoffs: NhlCoachRecordLine;
    jackAdams: number;
    stanleyCups: number;
    cupFinals: number;
    firstCoached: string | null;
  } | null;
  stints: NhlCoachStint[];
  /** ESPN's own career lines ("W-L-T-OTL"), only shown when NHL records are unavailable. */
  espnRecords: { label: string; summary: string }[];
  playing: {
    totals: { gp: number; g: number; a: number; pts: number; pim: number } | null;
    seasons: { season: string; team: string; gp: number; g: number; a: number; pts: number }[];
  } | null;
  bio: string | null;
  bioUrl: string | null;
};

type NhlRecordsCoach = {
  fullName?: string;
  playerId?: number | null;
  isActive?: boolean;
  bio?: string | null;
};

type NhlRecordsFranchiseRow = {
  franchiseId?: number;
  franchiseName?: string;
  teamAbbrev?: string;
  gameTypeId?: number;
  startSeason?: number;
  endSeason?: number;
  seasons?: number;
  games?: number;
  wins?: number;
  losses?: number;
  otLosses?: number | null;
  ties?: number | null;
  points?: number | null;
  pointPctg?: number | null;
  jackAdams?: number;
  stanleyCups?: number;
  stanleyCupFinalAppearances?: number;
  firstCoachedDate?: string;
  lastCoachedDate?: string;
};

function seasonSpan(raw: number | undefined): string {
  const s = String(raw ?? "");
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(6, 8)}` : s || "—";
}

function coachLine(row: NhlRecordsFranchiseRow | undefined): NhlCoachRecordLine | null {
  if (!row || !row.games) return null;
  return {
    games: row.games,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
    otLosses: row.otLosses ?? 0,
    points: row.points ?? null,
    pointPctg: row.pointPctg ?? null,
  };
}

function sumLines(lines: (NhlCoachRecordLine | null)[], withPoints: boolean): NhlCoachRecordLine {
  const total = { games: 0, wins: 0, losses: 0, otLosses: 0, points: 0 };
  for (const l of lines) {
    if (!l) continue;
    total.games += l.games;
    total.wins += l.wins;
    total.losses += l.losses;
    total.otLosses += l.otLosses;
    total.points += l.points ?? 0;
  }
  return {
    ...total,
    points: withPoints ? total.points : null,
    pointPctg: withPoints && total.games ? total.points / (total.games * 2) : null,
  };
}

async function fetchHockeyWikipedia(name: string): Promise<{ extract: string | null; image: string | null; url: string | null }> {
  for (const title of [`${name} (ice hockey)`, name]) {
    try {
      const api = new URL("https://en.wikipedia.org/w/api.php");
      api.searchParams.set("action", "query");
      api.searchParams.set("titles", title);
      api.searchParams.set("redirects", "1");
      api.searchParams.set("prop", "pageimages|extracts");
      api.searchParams.set("exintro", "1");
      api.searchParams.set("explaintext", "1");
      api.searchParams.set("pithumbsize", "640");
      api.searchParams.set("pilicense", "any");
      api.searchParams.set("format", "json");
      api.searchParams.set("origin", "*");
      const data = await getJson<{
        query?: {
          pages?: Record<string, { missing?: string; title?: string; extract?: string; thumbnail?: { source?: string } }>;
        };
      }>(api.toString());
      const page = Object.values(data.query?.pages ?? {})[0];
      const extract = page?.extract?.trim() ?? "";
      // Same-name pages are common; only keep the one that is about hockey.
      if (!page || page.missing != null || !/hockey|\bNHL\b/i.test(extract)) continue;
      return {
        extract: extract || null,
        image: page.thumbnail?.source ?? null,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title ?? title).replace(/\s+/g, "_"))}`,
      };
    } catch {
      /* try next title */
    }
  }
  return { extract: null, image: null, url: null };
}

function ageFrom(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age;
}

/**
 * NHL head coach: ESPN core coach (identity, birth, college, ESPN career lines),
 * records.nhl.com coach + per-franchise records (career W-L-OTL, playoffs, Jack
 * Adams, Cups — via `/api/nhl`), NHL player landing for a playing career, and
 * the Wikipedia intro as the bio. `teamHint` is the ESPN team id the user came from.
 */
export async function fetchNhlCoachProfile(coachId: string, teamHint?: string | null): Promise<NhlCoachProfile> {
  type EspnCoach = {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    birthPlace?: { city?: string; state?: string; country?: string };
    college?: { $ref?: string };
    careerRecords?: { $ref?: string }[];
  };
  const espn = await getJson<EspnCoach>(`${CORE}/coaches/${encodeURIComponent(coachId)}?lang=en&region=us`);
  const name = [espn.firstName, espn.lastName].filter(Boolean).join(" ").trim();
  if (!name) throw new Error("Coach not found");
  const httpsRef = (ref: string | undefined) => (ref ? ref.replace(/^http:/, "https:") : null);

  const [recordsCoach, franchiseRows, college, espnRecords, wiki] = await Promise.all([
    nhlWebJson<{ data?: NhlRecordsCoach[] }>(`records/coach/${name}`)
      .then((r) => r.data?.[0] ?? null)
      .catch(() => null),
    nhlWebJson<{ data?: NhlRecordsFranchiseRow[] }>(`records/coach-franchise/${name}`)
      .then((r) => r.data ?? [])
      .catch((): NhlRecordsFranchiseRow[] => []),
    httpsRef(espn.college?.$ref)
      ? getJson<{ name?: string }>(httpsRef(espn.college?.$ref)!)
          .then((c) => c.name ?? null)
          .catch(() => null)
      : Promise.resolve(null),
    Promise.all(
      (espn.careerRecords ?? []).map((r) =>
        httpsRef(r.$ref)
          ? getJson<{ name?: string; summary?: string }>(httpsRef(r.$ref)!)
              .then((x) => (x.summary ? { label: x.name ?? "Record", summary: x.summary } : null))
              .catch(() => null)
          : Promise.resolve(null),
      ),
    ).then((rows) => rows.filter((r): r is { label: string; summary: string } => Boolean(r))),
    fetchHockeyWikipedia(name),
  ]);

  const byFranchise = new Map<string, NhlRecordsFranchiseRow[]>();
  for (const row of franchiseRows) {
    const key = `${row.franchiseId ?? row.franchiseName}-${row.teamAbbrev}`;
    byFranchise.set(key, [...(byFranchise.get(key) ?? []), row]);
  }
  const lastDate = (rows: NhlRecordsFranchiseRow[]) =>
    rows.map((r) => r.lastCoachedDate ?? "").sort().pop() ?? "";
  const latestKey = [...byFranchise.entries()].sort((a, b) => lastDate(b[1]).localeCompare(lastDate(a[1])))[0]?.[0];
  const recentEnough = (rows: NhlRecordsFranchiseRow[]) =>
    Date.now() - Date.parse(lastDate(rows)) < 400 * 86_400_000;

  const stints: NhlCoachStint[] = [...byFranchise.entries()]
    .map(([key, rows]) => {
      const regular = rows.find((r) => r.gameTypeId === 2);
      const playoffs = rows.find((r) => r.gameTypeId === 3);
      const abbrev = canonNhlAbbrev(regular?.teamAbbrev ?? playoffs?.teamAbbrev);
      const team = NHL_TEAMS.find((t) => canonNhlAbbrev(t.abbrev) === abbrev);
      const starts = rows.map((r) => r.startSeason ?? 0).filter(Boolean);
      const ends = rows.map((r) => r.endSeason ?? 0).filter(Boolean);
      return {
        franchiseName: regular?.franchiseName ?? playoffs?.franchiseName ?? abbrev,
        teamAbbrev: abbrev,
        espnTeamId: team?.id ?? null,
        logo: abbrev ? nhlTeamLogo(abbrev) : null,
        startSeason: seasonSpan(Math.min(...starts)),
        endSeason: seasonSpan(Math.max(...ends)),
        current: key === latestKey && recordsCoach?.isActive !== false && recentEnough(rows),
        regular: coachLine(regular),
        playoffs: coachLine(playoffs),
        jackAdams: Math.max(0, ...rows.map((r) => r.jackAdams ?? 0)),
        stanleyCups: playoffs?.stanleyCups ?? 0,
        cupFinals: playoffs?.stanleyCupFinalAppearances ?? 0,
        firstCoached: rows.map((r) => r.firstCoachedDate ?? "").filter(Boolean).sort()[0] ?? null,
      };
    })
    .sort((a, b) => b.startSeason.localeCompare(a.startSeason));

  const career: NhlCoachProfile["career"] = stints.length
    ? {
        seasons: [...byFranchise.values()].reduce(
          (n, rows) => n + (rows.find((r) => r.gameTypeId === 2)?.seasons ?? 0),
          0,
        ),
        regular: sumLines(stints.map((s) => s.regular), true),
        playoffs: sumLines(stints.map((s) => s.playoffs), false),
        jackAdams: stints.reduce((n, s) => n + s.jackAdams, 0),
        stanleyCups: stints.reduce((n, s) => n + s.stanleyCups, 0),
        cupFinals: stints.reduce((n, s) => n + s.cupFinals, 0),
        firstCoached: stints.map((s) => s.firstCoached ?? "").filter(Boolean).sort()[0] ?? null,
      }
    : null;

  const currentStint = stints.find((s) => s.current);
  const teamEspnId = teamHint && /^\d+$/.test(teamHint) ? Number(teamHint) : currentStint?.espnTeamId ?? null;
  let team: NhlCoachProfile["team"] = null;
  if (teamEspnId != null) {
    const raw = await getJson<{
      team?: {
        displayName?: string;
        abbreviation?: string;
        color?: string;
        standingSummary?: string;
        logos?: { href?: string }[];
        record?: { items?: { type?: string; summary?: string; stats?: { name?: string; value?: number }[] }[] };
      };
    }>(`${ESPN}/teams/${teamEspnId}`).catch(() => null);
    const t = raw?.team;
    if (t) {
      const total = t.record?.items?.find((r) => r.type === "total") ?? t.record?.items?.[0];
      const pts = total?.stats?.find((s) => s.name === "points")?.value;
      team = {
        espnId: teamEspnId,
        name: t.displayName ?? "NHL team",
        abbrev: t.abbreviation ?? "",
        color: (t.color ?? "002f87").replace(/^#/, ""),
        logo: t.logos?.[0]?.href ?? (t.abbreviation ? nhlTeamLogo(t.abbreviation) : null),
        record: total?.summary ?? null,
        points: typeof pts === "number" ? pts : nhlPointsFromRecord(total?.summary),
        standing: t.standingSummary ?? null,
      };
    }
  }

  let playing: NhlCoachProfile["playing"] = null;
  if (recordsCoach?.playerId) {
    type PlayerLanding = {
      careerTotals?: {
        regularSeason?: { gamesPlayed?: number; goals?: number; assists?: number; points?: number; pim?: number };
      };
      seasonTotals?: {
        season?: number;
        gameTypeId?: number;
        leagueAbbrev?: string;
        teamName?: { default?: string };
        gamesPlayed?: number;
        goals?: number;
        assists?: number;
        points?: number;
      }[];
    };
    const landing = await nhlWebJson<PlayerLanding>(`v1/player/${recordsCoach.playerId}/landing`).catch(() => null);
    const rs = landing?.careerTotals?.regularSeason;
    const seasons = (landing?.seasonTotals ?? [])
      .filter((s) => s.leagueAbbrev === "NHL" && s.gameTypeId === 2)
      .map((s) => ({
        season: seasonSpan(s.season),
        team: s.teamName?.default ?? "—",
        gp: s.gamesPlayed ?? 0,
        g: s.goals ?? 0,
        a: s.assists ?? 0,
        pts: s.points ?? 0,
      }));
    if (rs?.gamesPlayed || seasons.length) {
      playing = {
        totals: rs?.gamesPlayed
          ? { gp: rs.gamesPlayed, g: rs.goals ?? 0, a: rs.assists ?? 0, pts: rs.points ?? 0, pim: rs.pim ?? 0 }
          : null,
        seasons,
      };
    }
  }

  const birthDate = espn.dateOfBirth ? espn.dateOfBirth.slice(0, 10) : null;
  const bp = espn.birthPlace;
  return {
    espnId: coachId,
    name,
    image: wiki.image,
    birthDate,
    age: ageFrom(birthDate ? `${birthDate}T12:00:00` : null),
    birthPlace: [bp?.city, bp?.state, bp?.country].filter(Boolean).join(", ") || null,
    college,
    team,
    career,
    stints,
    espnRecords,
    playing,
    bio: recordsCoach?.bio?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || wiki.extract,
    bioUrl: wiki.url,
  };
}
