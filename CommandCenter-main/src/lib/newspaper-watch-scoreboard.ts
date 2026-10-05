/**
 * Times-local ESPN scoreboards for the watch desk.
 *
 * Mirrors the Sports App mappers (Chicago date, networks, status, sides)
 * but loads through newspaperEspnGet so the press survives the same
 * Akamai/CORS walls as the wire and slate. Sports App fetchers are left alone.
 */
import { parseEspnBroadcasts, type GameBroadcast } from "./game-broadcasts.ts";
import { newspaperEspnGet } from "./newspaper-espn.ts";
import { seriesLineFromEspn } from "./playoff-series.ts";
import type { CfbScoreGame, CfbScoreSide } from "./cfb.ts";
import type { NflScoreGame, NflScoreSide } from "./nfl.ts";
import type { NhlScoreGame, NhlScoreSide } from "./nhl.ts";

/** Same Championship clubs the Sports App RUWT board always surfaces. */
const SOCCER_FOCUS_IDS = new Set(["352", "380"]);

export type WatchSoccerSide = {
  teamId: string;
  name: string;
  abbrev: string;
  logo: string | null;
  score: string | null;
  record: string | null;
  short: string | null;
  color: string | null;
};

export type WatchSoccerGame = {
  id: string;
  league: string;
  leagueSlug: string;
  date: string | null;
  status: string;
  shortDetail: string | null;
  final: boolean;
  live: boolean;
  pregame: boolean;
  venue: string | null;
  startIso?: string | null;
  away: WatchSoccerSide;
  home: WatchSoccerSide;
  broadcasts: GameBroadcast[];
};

export function chicagoDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/** WNBA regular season and playoffs typically run May–October. */
export function wnbaInSeason(day: string): boolean {
  const month = Number(day.slice(5, 7));
  return Number.isFinite(month) && month >= 5 && month <= 10;
}

export type WatchBasketSide = {
  teamId: number;
  name: string;
  abbrev: string;
  record: string | null;
  logo: string | null;
  short: string | null;
  color: string | null;
  score: number | null;
};

export type WatchBasketGame = {
  id: string;
  date: string | null;
  startIso: string | null;
  status: string;
  shortDetail: string | null;
  live: boolean;
  final: boolean;
  venue: string | null;
  broadcasts: GameBroadcast[];
  seriesLine: string | null;
  preseason: boolean;
  postseason: boolean;
  line?: string | null;
  away: WatchBasketSide;
  home: WatchBasketSide;
};

/** Pregame heat only — preseason stays the lowest tier on the printed page. */
export const WATCH_BASKET_HEAT = {
  preseason: 5,
  regular: 14,
  postseason: 22,
} as const;

export type EspnWatchCompetitor = {
  homeAway?: string;
  score?: unknown;
  curatedRank?: { current?: number };
  records?: { type?: string; name?: string; summary?: string; displayValue?: string }[];
  probables?: {
    athlete?: { displayName?: string; shortName?: string };
    statistics?: { abbreviation?: string; displayValue?: string }[];
  }[];
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    color?: string;
    logo?: string;
    logos?: { href?: string }[];
  };
};

export type EspnWatchEvent = {
  id?: string;
  date?: string;
  season?: { type?: number };
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
      period?: number;
    };
    broadcasts?: { market?: string; names?: string[] }[];
    geoBroadcasts?: {
      market?: { type?: string } | string;
      media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
      names?: string[];
    }[];
    competitors?: EspnWatchCompetitor[];
    series?: { type?: string | null; summary?: string | null; totalCompetitions?: number | null };
    notes?: { headline?: string | null }[];
    odds?: {
      details?: string;
      spread?: number;
      overUnder?: number;
      provider?: { name?: string; displayName?: string };
      awayTeamOdds?: { favorite?: boolean; team?: { id?: string } };
      homeTeamOdds?: { favorite?: boolean; team?: { id?: string } };
    }[];
  }[];
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
};

export function eventsFromWatchBoard(raw: unknown): EspnWatchEvent[] {
  if (!raw || typeof raw !== "object") return [];
  const events = (raw as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  return events.filter((ev): ev is EspnWatchEvent => Boolean(ev) && typeof ev === "object");
}

function parseScore(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function overallRecord(c: EspnWatchCompetitor): string | null {
  const rows = c.records ?? [];
  const total = rows.find((r) => r.type === "total" || r.name === "overall") ?? rows[0];
  const summary = total?.summary || total?.displayValue || null;
  return summary?.trim() || null;
}

function teamShort(team: EspnWatchCompetitor["team"], fallback: string): string {
  return team?.shortDisplayName?.trim() || fallback;
}

function teamColorOf(team: EspnWatchCompetitor["team"]): string | null {
  const c = team?.color?.replace(/^#/, "").trim();
  return c && /^[0-9a-f]{6}$/i.test(c) ? c : null;
}

export function starterOf(c: EspnWatchCompetitor): { name: string; line: string | null } | null {
  const p = c.probables?.[0];
  const name = p?.athlete?.shortName || p?.athlete?.displayName || "";
  if (!name) return null;
  const stats = (p?.statistics ?? [])
    .filter((s) => /^(W|L|ERA|GAA|SV%|SVPCT)$/i.test(s.abbreviation ?? ""))
    .map((s) => `${s.displayValue} ${s.abbreviation}`)
    .join(", ");
  return { name, line: stats || null };
}

export function oddsLineOf(event: EspnWatchEvent): string | null {
  const row = event.competitions?.[0]?.odds?.[0];
  const details = row?.details?.trim();
  return details || null;
}

function cfbPollRank(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw < 1 || raw > 25) return null;
  return raw;
}

function teamLogo(sport: string, team: EspnWatchCompetitor["team"], fallbackId?: string | number): string | null {
  const href = team?.logos?.[0]?.href ?? team?.logo ?? null;
  if (href) return href;
  if (sport === "ncaa" && fallbackId) return `https://a.espncdn.com/i/teamlogos/ncaa/500/${fallbackId}.png`;
  if (sport === "soccer" && fallbackId) return `https://a.espncdn.com/i/teamlogos/soccer/500/${fallbackId}.png`;
  const abbrev = team?.abbreviation?.toLowerCase();
  if (abbrev) return `https://a.espncdn.com/i/teamlogos/${sport}/500/${abbrev}.png`;
  if (fallbackId) return `https://a.espncdn.com/i/teamlogos/${sport}/500/${fallbackId}.png`;
  return null;
}

function statusOf(event: EspnWatchEvent) {
  const comp = event.competitions?.[0];
  const status = comp?.status?.type ?? event.status?.type;
  const state = status?.state ?? "";
  const live = state === "in";
  const final = state === "post" || status?.completed === true;
  const pregame = state === "pre";
  return {
    status,
    live,
    final,
    pregame,
    description: status?.description ?? status?.name ?? (live ? "Live" : final ? "Final" : "Scheduled"),
    shortDetail: status?.shortDetail ?? status?.detail ?? null,
  };
}

function sidesOf(event: EspnWatchEvent): { away: EspnWatchCompetitor; home: EspnWatchCompetitor } | null {
  const comp = event.competitions?.[0];
  const away = (comp?.competitors ?? []).find((c) => c.homeAway === "away");
  const home = (comp?.competitors ?? []).find((c) => c.homeAway === "home");
  if (!away?.team || !home?.team) return null;
  return { away, home };
}

function nflSide(c: EspnWatchCompetitor): NflScoreSide {
  const team = c.team ?? {};
  const abbrev = team.abbreviation ?? "—";
  const starter = starterOf(c);
  const base: NflScoreSide = {
    teamId: Number(team.id) || 0,
    name: team.displayName ?? team.shortDisplayName ?? abbrev,
    abbrev,
    score: parseScore(c.score),
    record: overallRecord(c),
    logo: teamLogo("nfl", team, team.id),
    color: (team.color ?? "555555").replace(/^#/, ""),
    linescores: [],
  };
  return Object.assign(base, {
    short: teamShort(team, abbrev),
    starter: starter?.name ?? null,
    starterLine: starter?.line ?? null,
  });
}

function nhlSide(c: EspnWatchCompetitor): NhlScoreSide {
  const team = c.team ?? {};
  const abbrev = team.abbreviation ?? "—";
  const starter = starterOf(c);
  const base: NhlScoreSide = {
    teamId: Number(team.id) || 0,
    name: team.displayName ?? "Team",
    abbrev,
    score: parseScore(c.score),
    record: overallRecord(c),
    logo: teamLogo("nhl", team, abbrev),
    color: (team.color ?? "002f87").replace(/^#/, ""),
    linescores: [],
  };
  return Object.assign(base, {
    short: teamShort(team, abbrev),
    starter: starter?.name ?? null,
    starterLine: starter?.line ?? null,
  });
}

function cfbSide(c: EspnWatchCompetitor): CfbScoreSide {
  const team = c.team ?? {};
  const abbrev = team.abbreviation ?? "—";
  const teamId = Number(team.id) || 0;
  const base: CfbScoreSide = {
    teamId,
    name: team.displayName ?? team.shortDisplayName ?? abbrev,
    abbrev,
    score: parseScore(c.score),
    record: overallRecord(c),
    logo: teamLogo("ncaa", team, team.id),
    color: (team.color ?? "555555").replace(/^#/, ""),
    rank: cfbPollRank(c.curatedRank?.current),
    fpiRank: null,
    linescores: [],
  };
  return Object.assign(base, { short: teamShort(team, team.displayName ?? abbrev) });
}

function soccerSide(c: EspnWatchCompetitor): WatchSoccerSide {
  const team = c.team ?? {};
  return {
    teamId: String(team.id ?? ""),
    name: team.displayName ?? team.shortDisplayName ?? "Team",
    abbrev: team.abbreviation ?? "—",
    logo: teamLogo("soccer", team, team.id),
    score: c.score != null ? String(c.score) : null,
    record: overallRecord(c),
    short: teamShort(team, team.displayName ?? team.abbreviation ?? "Team"),
    color: teamColorOf(team),
  };
}

function basketSide(c: EspnWatchCompetitor, sport: "nba" | "wnba"): WatchBasketSide {
  const team = c.team ?? {};
  const abbrev = team.abbreviation ?? "—";
  return {
    teamId: Number(team.id) || 0,
    name: team.displayName ?? team.shortDisplayName ?? abbrev,
    abbrev,
    record: overallRecord(c),
    logo: teamLogo(sport, team, team.id),
    short: teamShort(team, abbrev),
    color: teamColorOf(team),
    score: parseScore(c.score),
  };
}

function cfbOdds(event: EspnWatchEvent, awayId: number, homeId: number): CfbScoreGame["odds"] {
  const row = event.competitions?.[0]?.odds?.[0];
  if (!row) return null;
  const spread = typeof row.spread === "number" && Number.isFinite(row.spread) ? row.spread : null;
  const overUnder =
    typeof row.overUnder === "number" && Number.isFinite(row.overUnder) ? row.overUnder : null;
  let favoriteTeamId: number | null = null;
  if (row.homeTeamOdds?.favorite && row.homeTeamOdds.team?.id) {
    favoriteTeamId = Number(row.homeTeamOdds.team.id) || null;
  } else if (row.awayTeamOdds?.favorite && row.awayTeamOdds.team?.id) {
    favoriteTeamId = Number(row.awayTeamOdds.team.id) || null;
  } else if (spread != null) {
    favoriteTeamId = spread < 0 ? homeId || null : spread > 0 ? awayId || null : null;
  }
  if (!row.details && spread == null && overUnder == null) return null;
  return {
    details: row.details ?? null,
    spread,
    overUnder,
    favoriteTeamId,
    provider: row.provider?.displayName ?? row.provider?.name ?? null,
  };
}

export function mapWatchNflGame(event: EspnWatchEvent): NflScoreGame | null {
  const comp = event.competitions?.[0];
  const pair = sidesOf(event);
  if (!comp || !pair) return null;
  const st = statusOf(event);
  const iso = event.date ?? comp.date ?? null;
  const mapped: NflScoreGame = {
    id: String(event.id ?? comp.id ?? ""),
    status: st.description,
    shortDetail: st.shortDetail,
    live: st.live,
    final: st.final,
    away: nflSide(pair.away),
    home: nflSide(pair.home),
    when: iso,
    whenShort: st.shortDetail,
    venue: comp.venue?.fullName ?? null,
    situation: null,
    homeWinPct: null,
    date: chicagoDateFromIso(iso),
    startIso: iso,
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
    seriesLine: seriesLineFromEspn(comp),
  };
  return Object.assign(mapped, { line: oddsLineOf(event) });
}

export function mapWatchNhlGame(event: EspnWatchEvent): NhlScoreGame | null {
  const comp = event.competitions?.[0];
  const pair = sidesOf(event);
  if (!comp || !pair) return null;
  const st = statusOf(event);
  const iso = event.date ?? comp.date ?? null;
  const mapped: NhlScoreGame = {
    id: String(event.id ?? comp.id ?? ""),
    status: st.description,
    shortDetail: st.shortDetail,
    live: st.live,
    final: st.final,
    away: nhlSide(pair.away),
    home: nhlSide(pair.home),
    when: iso,
    whenShort: st.shortDetail,
    venue: comp.venue?.fullName ?? null,
    date: chicagoDateFromIso(iso),
    startIso: iso,
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
    seriesLine: seriesLineFromEspn(comp),
  };
  return Object.assign(mapped, { line: oddsLineOf(event) });
}

export function mapWatchCfbGame(event: EspnWatchEvent): CfbScoreGame | null {
  const comp = event.competitions?.[0];
  const pair = sidesOf(event);
  if (!comp || !pair?.away.team?.id || !pair.home.team?.id) return null;
  const st = statusOf(event);
  const iso = event.date ?? comp.date ?? null;
  const away = cfbSide(pair.away);
  const home = cfbSide(pair.home);
  const periodRaw = comp.status?.period;
  const period =
    typeof periodRaw === "number" && Number.isFinite(periodRaw) && periodRaw > 0 ? periodRaw : null;
  return {
    id: String(event.id ?? ""),
    status: st.description,
    shortDetail: st.shortDetail,
    live: st.live,
    final: st.final,
    away,
    home,
    when: iso,
    whenShort: st.shortDetail,
    venue: comp.venue?.fullName ?? null,
    date: chicagoDateFromIso(iso),
    startIso: iso,
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
    period,
    situation: null,
    odds: cfbOdds(event, away.teamId, home.teamId),
  };
}

export function mapWatchSoccerGame(event: EspnWatchEvent, leagueSlug: string): WatchSoccerGame | null {
  const comp = event.competitions?.[0];
  const pair = sidesOf(event);
  if (!comp || !pair) return null;
  const st = statusOf(event);
  const iso = event.date ?? comp.date ?? null;
  const league = leagueSlug === "eng.1" ? "Premier League" : leagueSlug === "eng.2" ? "EFL Championship" : leagueSlug;
  return {
    id: String(event.id ?? ""),
    league,
    leagueSlug,
    date: chicagoDateFromIso(iso),
    status: st.description,
    shortDetail: st.shortDetail,
    final: st.final,
    live: st.live || (!st.final && !st.pregame),
    pregame: st.pregame,
    venue: comp.venue?.fullName ?? null,
    startIso: iso,
    away: soccerSide(pair.away),
    home: soccerSide(pair.home),
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
  };
}

export function mapWatchBasketGame(event: EspnWatchEvent, sport: "nba" | "wnba"): WatchBasketGame | null {
  const comp = event.competitions?.[0];
  const pair = sidesOf(event);
  if (!comp || !pair) return null;
  const st = statusOf(event);
  const iso = event.date ?? comp.date ?? null;
  const seasonType = event.season?.type;
  return {
    id: String(event.id ?? comp.id ?? ""),
    date: chicagoDateFromIso(iso),
    startIso: iso,
    status: st.description,
    shortDetail: st.shortDetail,
    live: st.live,
    final: st.final,
    venue: comp.venue?.fullName ?? null,
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
    seriesLine: seriesLineFromEspn(comp),
    preseason: seasonType === 1,
    postseason: seasonType === 3,
    line: oddsLineOf(event),
    away: basketSide(pair.away, sport),
    home: basketSide(pair.home, sport),
  };
}

export function scoreWatchBasket(
  g: WatchBasketGame,
  interest: Record<string, number> = {},
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score: number = WATCH_BASKET_HEAT.regular;
  if (g.preseason) {
    score = WATCH_BASKET_HEAT.preseason;
    reasons.push("Preseason");
  } else if (g.postseason) {
    score = WATCH_BASKET_HEAT.postseason;
    reasons.push("Playoffs");
  }
  if (g.seriesLine?.trim()) reasons.unshift(g.seriesLine.trim());
  const top = Math.max(interest[String(g.away.teamId)] ?? 0, interest[String(g.home.teamId)] ?? 0);
  if (top > 0 && !g.preseason) score += Math.round(top * 1.5);
  return { score, reasons: reasons.filter(Boolean).slice(0, 3) };
}

async function loadBoard(path: string, ymd: string, league: string, extra = ""): Promise<EspnWatchEvent[]> {
  const qs = [`dates=${ymd}`, "limit=300", extra].filter(Boolean).join("&");
  try {
    return eventsFromWatchBoard(await newspaperEspnGet(`${path}/scoreboard?${qs}`));
  } catch (err) {
    console.warn(`watch desk ${league} scoreboard failed`, err);
    return [];
  }
}

export async function fetchWatchNflBoard(ymd: string): Promise<NflScoreGame[]> {
  const events = await loadBoard("football/nfl", ymd, "NFL");
  return events.map(mapWatchNflGame).filter((g): g is NflScoreGame => Boolean(g?.id));
}

export async function fetchWatchNhlBoard(ymd: string): Promise<NhlScoreGame[]> {
  const events = await loadBoard("hockey/nhl", ymd, "NHL");
  return events.map(mapWatchNhlGame).filter((g): g is NhlScoreGame => Boolean(g?.id));
}

export async function fetchWatchCfbBoard(ymd: string): Promise<CfbScoreGame[]> {
  const events = await loadBoard("football/college-football", ymd, "CFB", "groups=80");
  return events.map(mapWatchCfbGame).filter((g): g is CfbScoreGame => Boolean(g?.id));
}

export function rankWatchSoccerGames(
  games: WatchSoccerGame[],
  interest: Record<string, number>,
  limit = 24,
): (WatchSoccerGame & { score: number; reasons: string[] })[] {
  const scored = games.map((g) => {
    let score = 20;
    const reasons: string[] = [];
    if (g.live) {
      score += 35;
      reasons.push("Live");
    } else if (g.pregame) {
      score += 12;
      reasons.push("Upcoming");
    } else if (g.final) {
      score += 4;
      reasons.push("Final");
    }
    if (g.leagueSlug === "eng.1") {
      score += 10;
      reasons.push("Premier League");
    }
    const awayI = interest[g.away.teamId] ?? 0;
    const homeI = interest[g.home.teamId] ?? 0;
    const top = Math.max(awayI, homeI);
    if (top > 0) {
      score += Math.round(top * 4.2);
      if (top >= 9) reasons.push("Your #1 club");
      else if (top >= 7) reasons.push("High interest club");
      else reasons.push("On your board");
    }
    if (awayI >= 5 && homeI >= 5) {
      score += 12;
      reasons.push("Both clubs ranked");
    }
    if (SOCCER_FOCUS_IDS.has(g.away.teamId) || SOCCER_FOCUS_IDS.has(g.home.teamId)) {
      score += 18;
      reasons.push("Followed club");
    }
    if (g.live || g.final) {
      const a = Number(g.away.score);
      const h = Number(g.home.score);
      if (Number.isFinite(a) && Number.isFinite(h) && Math.abs(a - h) <= 1) {
        score += 8;
        reasons.push("Tight score");
      }
    }
    return { ...g, score, reasons: [...new Set(reasons)].slice(0, 4) };
  });
  return scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}

export async function fetchWatchSoccerBoard(day: string): Promise<WatchSoccerGame[]> {
  const ymd = day.replace(/-/g, "");
  const chicagoYmd = /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? day
    : `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  const [plToday, champToday] = await Promise.all([
    loadBoard("soccer/eng.1", ymd, "Soccer").then((events) =>
      events.map((ev) => mapWatchSoccerGame(ev, "eng.1")).filter((g): g is WatchSoccerGame => Boolean(g?.id)),
    ),
    loadBoard("soccer/eng.2", ymd, "Soccer").then((events) =>
      events.map((ev) => mapWatchSoccerGame(ev, "eng.2")).filter((g): g is WatchSoccerGame => Boolean(g?.id)),
    ),
  ]);
  const champFocus = champToday.filter((g) => SOCCER_FOCUS_IDS.has(g.away.teamId) || SOCCER_FOCUS_IDS.has(g.home.teamId));
  const seen = new Set<string>();
  const out: WatchSoccerGame[] = [];
  for (const g of [...plToday, ...(champFocus.length ? champFocus : champToday)]) {
    if (!g.id || seen.has(g.id) || g.date !== chicagoYmd) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

export async function fetchWatchNbaBoard(ymd: string): Promise<WatchBasketGame[]> {
  const events = await loadBoard("basketball/nba", ymd, "NBA");
  return events.map((ev) => mapWatchBasketGame(ev, "nba")).filter((g): g is WatchBasketGame => Boolean(g?.id));
}

export async function fetchWatchWnbaBoard(ymd: string): Promise<WatchBasketGame[]> {
  const events = await loadBoard("basketball/wnba", ymd, "WNBA");
  return events.map((ev) => mapWatchBasketGame(ev, "wnba")).filter((g): g is WatchBasketGame => Boolean(g?.id));
}
