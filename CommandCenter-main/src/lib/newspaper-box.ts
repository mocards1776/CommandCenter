/**
 * Scoreboards and box scores for the Thompson Times sport sections.
 *
 * MLB comes off one statsapi schedule call per day (linescore, decisions,
 * probables with season lines, series status, and the MLB.com recap with its
 * photo and full body), plus the per-game boxscore for the agate. Every other
 * league reads ESPN's scoreboard, which carries period lines and stat leaders.
 */

import { editionNewsDay } from "./newspaper.ts";
import { htmlToNewspaperText } from "./newspaper-copy.ts";
import { isNewspaperCfbDeskGame, newspaperEspnGet } from "./newspaper-espn.ts";
import type { GameWrapCard } from "./newspaper-sports";

const MLB_API = "https://statsapi.mlb.com/api/v1";

export type BoxSide = {
  id: string | null;
  name: string;
  short: string;
  abbrev: string;
  logo: string | null;
  color: string | null;
  score: string | null;
  hits: string | null;
  errors: string | null;
  record: string | null;
  winner: boolean;
  /** AP / ESPN curated rank, when the board carries one. */
  rank: string | null;
  /** Runs / goals / points per period, null for an unplayed frame. */
  lines: (number | null)[];
};

export type BoxPerson = {
  id: string | null;
  name: string;
  line: string | null;
  headshot: string | null;
};

export type BoxLeader = BoxPerson & { label: string; team: string | null };

export type BoxRecap = {
  headline: string;
  blurb: string | null;
  html: string | null;
  photo: string | null;
  byline: string | null;
  url: string | null;
};

export type BoxGame = {
  id: string;
  path: string;
  league: string;
  /** Edition-calendar day this game was scheduled on. */
  day: string;
  startIso: string | null;
  status: string;
  final: boolean;
  live: boolean;
  venue: string | null;
  round: string | null;
  series: string | null;
  periods: string[];
  away: BoxSide;
  home: BoxSide;
  decisions: { label: "W" | "L" | "S"; person: BoxPerson }[];
  probables: { away: BoxPerson | null; home: BoxPerson | null };
  leaders: BoxLeader[];
  /** Goals, with minute — soccer only. */
  scoring: { team: string; text: string }[];
  recap: BoxRecap | null;
  broadcasts: string[];
  gamePk: number | null;
  espnEventId: string | null;
  href: string | null;
};

export type SectionBoard = {
  /** Last night's (or last week's) finals — the scores page. */
  results: BoxGame[];
  /** Tonight and tomorrow — the schedule page. */
  slate: BoxGame[];
  /** Football: the current ESPN week only — never mixed with last week. */
  week?: BoxGame[];
  weekLabel?: string | null;
  weekNumber?: number | null;
  /** Football: last week's finals, for the days before this week's games are played. */
  prior?: BoxGame[];
  priorLabel?: string | null;
  priorWeekNumber?: number | null;
  /** Week number that belongs on the results band (may be last week). */
  resultsWeekNumber?: number | null;
  /** Week number that belongs on the upcoming slate (may be next week). */
  slateWeekNumber?: number | null;
};

export type ScoreBand = { title: string; games: BoxGame[] };

/** Saturday (or the day's midpoint) as "Sat Oct 3". */
export function weekDayStamp(games: BoxGame[]): string | null {
  const days = [...new Set(games.map((g) => g.day).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  if (!days.length) return null;
  const sat = days.find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 6);
  const pick = sat ?? days[Math.floor(days.length / 2)] ?? days[0]!;
  const raw = new Date(`${pick}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return raw.replace(/,/g, "");
}

export function footballWeekTitle(
  kind: "results" | "schedule",
  weekNum: number | null | undefined,
  games: BoxGame[],
): string {
  const week = weekNum && weekNum > 0 ? `Week ${weekNum}` : kind === "results" ? "Last week" : "This week";
  const when = weekDayStamp(games);
  if (kind === "results") return when ? `${week} results (${when})` : `${week} results`;
  return when ? `${week} schedule (${when})` : `${week} schedule`;
}

/**
 * Score / schedule bands for a sport section. College football never mixes
 * last week's finals and this week's kickoffs under one week label.
 */
export function sportScoreBands(path: string, board: SectionBoard | null, edition: string): ScoreBand[] {
  if (!board) return [];
  if (path.includes("college-football")) {
    const results = board.results.length ? board.results : (board.prior ?? []);
    const slate = (board.slate ?? []).filter((g) => !g.final && !g.live);
    const bands: ScoreBand[] = [];
    if (results.length) {
      bands.push({
        title: footballWeekTitle("results", board.resultsWeekNumber ?? board.priorWeekNumber, results),
        games: results,
      });
    }
    if (slate.length) {
      bands.push({
        title: footballWeekTitle("schedule", board.slateWeekNumber ?? board.weekNumber, slate),
        games: slate,
      });
    }
    return bands;
  }
  if (path.startsWith("football/")) {
    const day = new Date(`${editionYmd(edition)}T12:00:00Z`).getUTCDay();
    const turned = day === 4 || day === 5 || day === 6 || day === 0 || day === 1;
    if (turned && board.week?.length) {
      return [{ title: `${board.weekLabel ?? "This week"} · scores and kickoffs`, games: board.week }];
    }
    if (board.results.length) {
      return [{ title: `${board.weekLabel ?? "This week"} finals`, games: [...board.results].reverse() }];
    }
    return board.prior?.length
      ? [{ title: `${board.priorLabel ?? "Last week"} finals`, games: [...board.prior].reverse() }]
      : [];
  }
  const games = path.startsWith("soccer/") ? [...board.results].reverse() : board.results;
  return games.length ? [{ title: "Last night’s scores", games }] : [];
}

function editionYmd(edition: string): string {
  return /^(\d{4}-\d{2}-\d{2})/.exec(edition)?.[1] ?? edition;
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${editionYmd(day)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const ctl = new AbortController();
    const t = globalThis.setTimeout(() => ctl.abort(), 12_000);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctl.signal });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } finally {
      globalThis.clearTimeout(t);
    }
  } catch {
    return null;
  }
}

export function mlbHeadshotUrl(id: string | number | null | undefined, size = 120): string | null {
  if (id == null || id === "") return null;
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${size},q_auto:best/v1/people/${id}/headshot/67/current`;
}

export function mlbLogoUrl(teamId: string | number | null | undefined): string | null {
  if (teamId == null || teamId === "") return null;
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}

/** MLB.com body markup: entity tags become plain text, embeds go away. */
export function cleanStoryHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<\/?forge-entity[^>]*>/gi, "")
    .replace(/<div[^>]*class="[^"]*(?:video|embed|social)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/href="javascript:[^"]*"/gi, 'href="#"')
    .trim();
}

export function htmlToText(html: string): string {
  return htmlToNewspaperText(html);
}

/* ───────────────────────── MLB ───────────────────────── */

type MlbPersonRaw = {
  id?: number;
  fullName?: string;
  stats?: {
    type?: { displayName?: string };
    group?: { displayName?: string };
    stats?: Record<string, unknown>;
    splits?: { stat?: Record<string, unknown> }[];
  }[];
};

type MlbTeamSideRaw = {
  score?: number;
  isWinner?: boolean;
  leagueRecord?: { wins?: number; losses?: number };
  team?: { id?: number; name?: string; teamName?: string; abbreviation?: string };
  probablePitcher?: MlbPersonRaw;
};

type MlbScheduleGameRaw = {
  gamePk?: number;
  gameDate?: string;
  officialDate?: string;
  gameType?: string;
  status?: { abstractGameState?: string; detailedState?: string; startTimeTBD?: boolean };
  teams?: { away?: MlbTeamSideRaw; home?: MlbTeamSideRaw };
  venue?: { name?: string };
  linescore?: {
    currentInningOrdinal?: string;
    inningState?: string;
    scheduledInnings?: number;
    innings?: { num?: number; away?: { runs?: number }; home?: { runs?: number } }[];
    teams?: {
      away?: { runs?: number; hits?: number; errors?: number };
      home?: { runs?: number; hits?: number; errors?: number };
    };
  };
  decisions?: { winner?: MlbPersonRaw; loser?: MlbPersonRaw; save?: MlbPersonRaw };
  seriesStatus?: { result?: string; shortDescription?: string; description?: string };
  broadcasts?: { name?: string; type?: string; isNational?: boolean }[];
  content?: {
    editorial?: {
      recap?: {
        mlb?: {
          headline?: string;
          blurb?: string;
          body?: string;
          slug?: string;
          contributors?: { name?: string }[];
          image?: { cuts?: { width?: number; src?: string; aspectRatio?: string }[] };
        };
      };
    };
  };
};

function pitcherSeason(person: MlbPersonRaw | undefined): string | null {
  const block = person?.stats?.find((s) => /pitching/i.test(s.group?.displayName ?? "")) ?? person?.stats?.[0];
  const stat = (block?.stats ?? block?.splits?.[0]?.stat) as Record<string, unknown> | undefined;
  if (!stat) return null;
  const w = stat.wins ?? null;
  const l = stat.losses ?? null;
  const era = stat.era ?? null;
  const bits: string[] = [];
  if (w != null && l != null) bits.push(`${w}-${l}`);
  if (era != null) bits.push(`${era} ERA`);
  return bits.join(", ") || null;
}

function mlbPerson(person: MlbPersonRaw | undefined): BoxPerson | null {
  if (!person?.fullName) return null;
  return {
    id: person.id != null ? String(person.id) : null,
    name: person.fullName,
    line: pitcherSeason(person),
    headshot: mlbHeadshotUrl(person.id),
  };
}

function recapPhoto(cuts: { width?: number; src?: string; aspectRatio?: string }[] | undefined): string | null {
  if (!cuts?.length) return null;
  const wide = cuts.filter((c) => c.src && (!c.aspectRatio || c.aspectRatio === "16:9"));
  const pick =
    wide.find((c) => (c.width ?? 0) >= 960 && (c.width ?? 0) <= 1440) ??
    wide.find((c) => (c.width ?? 0) >= 640) ??
    wide[0] ??
    cuts[0];
  return pick?.src ?? null;
}

function mlbGame(raw: MlbScheduleGameRaw, day: string): BoxGame | null {
  const pk = raw.gamePk;
  const a = raw.teams?.away;
  const h = raw.teams?.home;
  if (!pk || !a?.team || !h?.team) return null;
  const state = raw.status?.abstractGameState ?? "";
  const final = state === "Final";
  const live = state === "Live";
  const ls = raw.linescore;
  const played = ls?.innings ?? [];
  const frames = Math.max(ls?.scheduledInnings ?? 9, played.length);
  const periods = Array.from({ length: frames }, (_, i) => String(i + 1));
  const line = (side: "away" | "home") =>
    periods.map((_, i) => {
      const inn = played.find((x) => x.num === i + 1);
      const runs = inn?.[side]?.runs;
      return typeof runs === "number" ? runs : null;
    });
  const side = (s: MlbTeamSideRaw, key: "away" | "home"): BoxSide => ({
    id: s.team?.id != null ? String(s.team.id) : null,
    name: s.team?.name ?? "—",
    short: s.team?.teamName ?? s.team?.name ?? "—",
    abbrev: s.team?.abbreviation ?? "—",
    logo: mlbLogoUrl(s.team?.id),
    color: null,
    score: s.score != null ? String(s.score) : null,
    hits: ls?.teams?.[key]?.hits != null ? String(ls.teams[key]!.hits) : null,
    errors: ls?.teams?.[key]?.errors != null ? String(ls.teams[key]!.errors) : null,
    record:
      s.leagueRecord?.wins != null ? `${s.leagueRecord.wins}-${s.leagueRecord.losses ?? 0}` : null,
    winner: Boolean(s.isWinner),
    rank: null,
    lines: line(key),
  });
  const decisions: BoxGame["decisions"] = [];
  const w = mlbPerson(raw.decisions?.winner);
  const l = mlbPerson(raw.decisions?.loser);
  const sv = mlbPerson(raw.decisions?.save);
  if (w) decisions.push({ label: "W", person: w });
  if (l) decisions.push({ label: "L", person: l });
  if (sv) decisions.push({ label: "S", person: sv });

  const r = raw.content?.editorial?.recap?.mlb;
  const recap: BoxRecap | null =
    final && r?.headline
      ? {
          headline: r.headline,
          blurb: r.blurb ? htmlToText(r.blurb).split("\n")[0] ?? null : null,
          html: r.body ? cleanStoryHtml(r.body) : null,
          photo: recapPhoto(r.image?.cuts),
          byline: r.contributors?.map((c) => c.name).filter(Boolean).join(" and ") || null,
          url: r.slug ? `https://www.mlb.com/news/${r.slug}` : null,
        }
      : null;

  const tv = [
    ...new Set(
      (raw.broadcasts ?? [])
        .filter((b) => b.type === "TV" && b.name)
        .sort((x, y) => Number(Boolean(y.isNational)) - Number(Boolean(x.isNational)))
        .map((b) => b.name!),
    ),
  ].slice(0, 3);

  const inning =
    live && ls?.currentInningOrdinal ? `${ls.inningState ?? ""} ${ls.currentInningOrdinal}`.trim() : null;

  return {
    id: `mlb-${pk}`,
    path: "baseball/mlb",
    league: "MLB",
    day: raw.officialDate || day,
    startIso: raw.status?.startTimeTBD && !final && !live ? null : raw.gameDate ?? null,
    status: inning || (raw.status?.startTimeTBD && !final && !live ? "Time TBD" : raw.status?.detailedState || "Scheduled"),
    final,
    live,
    venue: raw.venue?.name ?? null,
    round: raw.gameType && raw.gameType !== "R" ? raw.seriesStatus?.shortDescription ?? null : null,
    series: raw.gameType && raw.gameType !== "R" ? raw.seriesStatus?.result ?? null : null,
    periods,
    away: side(a, "away"),
    home: side(h, "home"),
    decisions,
    probables: { away: mlbPerson(a.probablePitcher), home: mlbPerson(h.probablePitcher) },
    leaders: [],
    scoring: [],
    recap,
    broadcasts: tv,
    gamePk: pk,
    espnEventId: null,
    href: `/sports/mlb/game/${pk}`,
  };
}

const MLB_HYDRATE = [
  "linescore",
  "decisions",
  "probablePitcher(stats(group=[pitching],type=[season]))",
  "team",
  "seriesStatus",
  "broadcasts(all)",
  "venue",
  "game(content(editorial(recap)))",
].join(",");

export async function fetchMlbBoxDay(day: string): Promise<BoxGame[]> {
  const data = await getJson<{ dates?: { date?: string; games?: MlbScheduleGameRaw[] }[] }>(
    `${MLB_API}/schedule?sportId=1&date=${day}&hydrate=${encodeURIComponent(MLB_HYDRATE)}`,
  );
  const out: BoxGame[] = [];
  for (const d of data?.dates ?? []) {
    for (const g of d.games ?? []) {
      const game = mlbGame(g, d.date ?? day);
      if (game) out.push(game);
    }
  }
  return out;
}

export type AgateBatter = {
  id: string;
  name: string;
  pos: string;
  sub: boolean;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  so: number;
  avg: string | null;
  summary: string | null;
};

export type AgatePitcher = {
  id: string;
  name: string;
  note: string | null;
  ip: string;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  era: string | null;
};

export type AgateSide = {
  batters: AgateBatter[];
  pitchers: AgatePitcher[];
  notes: { label: string; value: string }[];
};

export type MlbAgate = {
  away: AgateSide;
  home: AgateSide;
  info: { label: string; value: string }[];
};

type BoxPlayerRaw = {
  person?: { id?: number; fullName?: string; boxscoreName?: string };
  position?: { abbreviation?: string };
  battingOrder?: string;
  stats?: { batting?: Record<string, unknown>; pitching?: Record<string, unknown> };
  seasonStats?: { batting?: Record<string, unknown>; pitching?: Record<string, unknown> };
};

type BoxTeamRaw = {
  batters?: number[];
  pitchers?: number[];
  players?: Record<string, BoxPlayerRaw>;
  info?: { title?: string; fieldList?: { label?: string; value?: string }[] }[];
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const KEEP_INFO = new Set(["WP", "HBP", "IBB", "Balk", "Weather", "Wind", "T", "Att", "First pitch"]);

function agateSide(raw: BoxTeamRaw | undefined): AgateSide {
  const players = raw?.players ?? {};
  const batters: AgateBatter[] = [];
  for (const id of raw?.batters ?? []) {
    const p = players[`ID${id}`];
    const b = p?.stats?.batting;
    if (!p || !b || !p.battingOrder) continue;
    batters.push({
      id: String(id),
      name: p.person?.boxscoreName || p.person?.fullName || "—",
      pos: p.position?.abbreviation ?? "",
      sub: Number(p.battingOrder) % 100 !== 0,
      ab: num(b.atBats),
      r: num(b.runs),
      h: num(b.hits),
      rbi: num(b.rbi),
      bb: num(b.baseOnBalls),
      so: num(b.strikeOuts),
      avg: (p.seasonStats?.batting?.avg as string | undefined) ?? null,
      summary: (b.summary as string | undefined) ?? null,
    });
  }
  const pitchers: AgatePitcher[] = [];
  for (const id of raw?.pitchers ?? []) {
    const p = players[`ID${id}`];
    const s = p?.stats?.pitching;
    if (!p || !s) continue;
    pitchers.push({
      id: String(id),
      name: p.person?.boxscoreName || p.person?.fullName || "—",
      note: (s.note as string | undefined) ?? null,
      ip: String(s.inningsPitched ?? "0.0"),
      h: num(s.hits),
      r: num(s.runs),
      er: num(s.earnedRuns),
      bb: num(s.baseOnBalls),
      so: num(s.strikeOuts),
      era: (p.seasonStats?.pitching?.era as string | undefined) ?? null,
    });
  }
  const notes = (raw?.info ?? [])
    .filter((block) => /batting|baserunning/i.test(block.title ?? ""))
    .flatMap((block) => block.fieldList ?? [])
    .filter((f) => f.label && f.value && /^(2B|3B|HR|RBI|SB|GIDP|SF|S)$/.test(f.label))
    .map((f) => ({ label: f.label!, value: f.value!.replace(/\.$/, "") }));
  return { batters, pitchers, notes };
}

export async function fetchMlbAgate(gamePk: number | string): Promise<MlbAgate | null> {
  const data = await getJson<{
    teams?: { away?: BoxTeamRaw; home?: BoxTeamRaw };
    info?: { label?: string; value?: string }[];
  }>(`${MLB_API}/game/${gamePk}/boxscore`);
  if (!data?.teams) return null;
  return {
    away: agateSide(data.teams.away),
    home: agateSide(data.teams.home),
    info: (data.info ?? [])
      .filter((f) => f.label && f.value && KEEP_INFO.has(f.label))
      .map((f) => ({ label: f.label!, value: f.value!.replace(/\.$/, "") })),
  };
}

/* ───────────────────────── ESPN ───────────────────────── */

export type EspnAthlete = { id?: string; shortName?: string; displayName?: string; headshot?: string | { href?: string } };

type EspnLeaderGroup = {
  shortDisplayName?: string;
  displayName?: string;
  leaders?: { displayValue?: string; athlete?: EspnAthlete; team?: { id?: string } }[];
};

type EspnCompetitorRaw = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  curatedRank?: { current?: number };
  linescores?: { value?: number }[];
  records?: { type?: string; summary?: string }[];
  leaders?: EspnLeaderGroup[];
  probables?: { athlete?: EspnAthlete; statistics?: { abbreviation?: string; displayValue?: string }[] }[];
  hits?: number;
  errors?: number;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
    color?: string;
  };
};

type EspnEventRaw = {
  id?: string;
  date?: string;
  competitions?: {
    date?: string;
    venue?: { fullName?: string };
    notes?: { headline?: string }[];
    series?: { summary?: string };
    status?: {
      period?: number;
      type?: { completed?: boolean; state?: string; shortDetail?: string; detail?: string };
    };
    competitors?: EspnCompetitorRaw[];
    leaders?: EspnLeaderGroup[];
    headlines?: { shortLinkText?: string; description?: string; type?: string }[];
    broadcasts?: { names?: string[] }[];
    details?: {
      scoringPlay?: boolean;
      clock?: { displayValue?: string };
      team?: { id?: string };
      athletesInvolved?: { shortName?: string; displayName?: string }[];
      type?: { text?: string };
    }[];
  }[];
};

type EspnBoardRaw = {
  events?: EspnEventRaw[];
  week?: { number?: number };
  season?: { type?: number };
};

export function headshotOf(a: EspnAthlete | undefined): string | null {
  const h = a?.headshot;
  if (!h) return null;
  return typeof h === "string" ? h : h.href ?? null;
}

export function leagueCode(path: string): string {
  const slug = path.split("/").pop() ?? "";
  return (
    {
      mlb: "MLB",
      nfl: "NFL",
      nhl: "NHL",
      "college-football": "CFB",
      "mens-college-basketball": "CBB",
      nba: "NBA",
    } as Record<string, string>
  )[slug] ?? slug.toUpperCase();
}

export function espnGameHref(path: string, id: string): string | null {
  if (path === "football/nfl") return `/sports/nfl/game/${id}`;
  if (path === "hockey/nhl") return `/sports/nhl/game/${id}`;
  if (path === "football/college-football") return `/sports/cfb/game/${id}`;
  if (path.startsWith("soccer/")) return `/sports/soccer/game/${id}`;
  return null;
}

export function periodLabels(path: string, count: number): string[] {
  const baseball = path.startsWith("baseball/");
  const hockey = path.startsWith("hockey/");
  const soccer = path.startsWith("soccer/");
  const cbb = path === "basketball/mens-college-basketball";
  const base = soccer
    ? ["1H", "2H"]
    : hockey
      ? ["1", "2", "3"]
      : baseball
        ? ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
        : cbb
          ? ["1H", "2H"]
          : ["1", "2", "3", "4"];
  const out = [...base];
  while (out.length < count) {
    const extra = out.length - base.length + 1;
    if (baseball) out.push(String(out.length + 1));
    else if (hockey) out.push(extra === 1 ? "OT" : extra === 2 ? "SO" : `${extra - 1}OT`);
    else out.push(extra === 1 ? "OT" : `${extra}OT`);
  }
  return out.slice(0, Math.max(count, baseball && count > 0 ? count : base.length));
}

function espnGame(path: string, ev: EspnEventRaw, day: string): BoxGame | null {
  const comp = ev.competitions?.[0];
  const awayC = comp?.competitors?.find((c) => c.homeAway === "away");
  const homeC = comp?.competitors?.find((c) => c.homeAway === "home");
  if (!ev.id || !awayC?.team || !homeC?.team) return null;
  const st = comp?.status?.type;
  const final = Boolean(st?.completed);
  const live = !final && st?.state === "in";
  const count = Math.max(awayC.linescores?.length ?? 0, homeC.linescores?.length ?? 0);
  const periods = periodLabels(path, count);
  const side = (c: EspnCompetitorRaw): BoxSide => ({
    id: c.team?.id ?? null,
    name: c.team?.displayName ?? "—",
    short: c.team?.shortDisplayName ?? c.team?.displayName ?? "—",
    abbrev: c.team?.abbreviation ?? "—",
    logo: c.team?.logo ?? null,
    color: c.team?.color ? `#${c.team.color}` : null,
    score: c.score ?? null,
    hits: c.hits != null ? String(c.hits) : null,
    errors: c.errors != null ? String(c.errors) : null,
    record: c.records?.find((r) => r.type === "total")?.summary ?? c.records?.[0]?.summary ?? null,
    winner: Boolean(c.winner),
    rank: (() => {
      const n = c.curatedRank?.current;
      return n && n > 0 && n < 99 ? String(n) : null;
    })(),
    lines: periods.map((_, i) => {
      const v = c.linescores?.[i]?.value;
      return typeof v === "number" ? v : null;
    }),
  });
  const abbrevById = new Map(
    [awayC, homeC].map((c) => [c.team?.id ?? "", c.team?.abbreviation ?? ""] as const),
  );
  const groups: EspnLeaderGroup[] = [
    ...(comp?.leaders ?? []),
    ...(awayC.leaders ?? []),
    ...(homeC.leaders ?? []),
  ];
  const leaders: BoxLeader[] = [];
  for (const g of groups) {
    const top = g.leaders?.[0];
    if (!top?.athlete) continue;
    const name = top.athlete.shortName || top.athlete.displayName || "";
    if (leaders.some((l) => l.name === name && l.label === g.shortDisplayName)) continue;
    leaders.push({
      label: g.shortDisplayName || g.displayName || "",
      id: top.athlete.id ?? null,
      name,
      line: top.displayValue ?? null,
      headshot: headshotOf(top.athlete),
      team: abbrevById.get(top.team?.id ?? "") || null,
    });
  }
  const probable = (c: EspnCompetitorRaw): BoxPerson | null => {
    const p = c.probables?.[0];
    if (!p?.athlete) return null;
    const stat = (abbr: string) =>
      (p.statistics ?? []).find((s) => (s.abbreviation ?? "").toUpperCase() === abbr)?.displayValue;
    const w = stat("W");
    const l = stat("L");
    const era = stat("ERA");
    const bits: string[] = [];
    if (w != null && l != null) bits.push(`${w}-${l}`);
    else if (w != null) bits.push(`${w} W`);
    if (era) bits.push(`${era} ERA`);
    return {
      id: p.athlete.id ?? null,
      name: p.athlete.displayName || p.athlete.shortName || "",
      line: bits.join(", ") || null,
      headshot: headshotOf(p.athlete),
    };
  };
  const head = comp?.headlines?.[0];
  const scoring = (comp?.details ?? [])
    .filter((d) => d.scoringPlay)
    .map((d) => ({
      team: abbrevById.get(d.team?.id ?? "") || "",
      text: `${d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || "Goal"} ${d.clock?.displayValue ?? ""}`.trim(),
    }));
  return {
    id: `${path}-${ev.id}`,
    path,
    league: leagueCode(path),
    day,
    startIso: comp?.date || ev.date || null,
    status: st?.shortDetail || st?.detail || (final ? "Final" : "Scheduled"),
    final,
    live,
    venue: comp?.venue?.fullName ?? null,
    round: comp?.notes?.find((n) => n.headline)?.headline ?? null,
    series: comp?.series?.summary ?? null,
    periods,
    away: side(awayC),
    home: side(homeC),
    decisions: [],
    probables: { away: probable(awayC), home: probable(homeC) },
    leaders: leaders.slice(0, 6),
    scoring,
    recap:
      final && head?.shortLinkText
        ? { headline: head.shortLinkText, blurb: head.description ?? null, html: null, photo: null, byline: null, url: null }
        : null,
    broadcasts: [...new Set((comp?.broadcasts ?? []).flatMap((b) => b.names ?? []))].slice(0, 3),
    gamePk: null,
    espnEventId: ev.id,
    href: espnGameHref(path, ev.id),
  };
}

async function espnBoard(path: string, query: string): Promise<EspnBoardRaw | null> {
  const limit = path === "football/college-football" ? "limit=300" : "limit=200";
  const extra = query.startsWith("&") ? query.slice(1) : query;
  const qs = [limit, extra].filter(Boolean).join("&");
  try {
    return (await newspaperEspnGet(qs ? `${path}/scoreboard?${qs}` : `${path}/scoreboard`)) as EspnBoardRaw;
  } catch {
    return null;
  }
}

function espnDayOf(iso: string | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function boardGames(path: string, board: EspnBoardRaw | null, fallbackDay: string): BoxGame[] {
  return (board?.events ?? [])
    .map((ev) => espnGame(path, ev, espnDayOf(ev.competitions?.[0]?.date || ev.date, fallbackDay)))
    .filter((g): g is BoxGame => g != null);
}

const summaries = new Map<string, { at: number; data: Promise<unknown> }>();

/**
 * ESPN's per-game summary (story, box score, scoring plays). The reader asks
 * for the story and the box at once, so one request serves both for a minute.
 */
export function fetchEspnSummary<T = unknown>(path: string, eventId: string): Promise<T | null> {
  const key = `${path}/summary?event=${eventId}`;
  const hit = summaries.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.data as Promise<T | null>;
  const data = newspaperEspnGet(key)
    .then((raw) => raw as T)
    .catch(() => null);
  summaries.set(key, { at: Date.now(), data });
  return data;
}

/** Full ESPN game story for a recap headline, when the board only sent the blurb. */
export async function fetchEspnRecapStory(
  path: string,
  eventId: string,
): Promise<{ html: string; photo: string | null; photoWidth: number | null; byline: string | null } | null> {
  const data = await fetchEspnSummary<{
    article?: { story?: string; images?: { url?: string; width?: number }[]; byline?: string };
  }>(path, eventId);
  const story = data?.article?.story;
  if (!story || story.length < 200) return null;
  const image = data?.article?.images?.[0];
  return {
    html: cleanStoryHtml(story),
    photo: image?.url ?? null,
    photoWidth: typeof image?.width === "number" ? image.width : null,
    byline: data?.article?.byline ?? null,
  };
}

const CT = "America/Chicago";

/** ESPN shortDetail like "10/10 - 12:00 PM EDT" — never print this on a Times clock. */
export function looksLikeEspnZoneClock(status: string | null | undefined): boolean {
  if (!status) return false;
  return (
    /\b(?:EDT|EST|CDT|CST|MDT|MST|PDT|PST)\b/.test(status) ||
    /\d{1,2}\/\d{1,2}\s*[-–]\s*\d/.test(status)
  );
}

function clockInCentral(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    timeZone: CT,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "Sat 11:00 AM" in Central time — weekday + clock, no zone, no wrapping date. */
export function formatKickoffLine(iso: string | null): string {
  const time = clockInCentral(iso);
  if (!time || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: CT });
  return `${weekday} ${time}`;
}

export function formatPaperDay(d: Date): string {
  return d
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Chicago",
    })
    .replace(",", "");
}

/** "Sat Oct 10 · 9:00 AM" in Central time. */
export function formatFixtureWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatPaperDay(d)} · ${time}`;
}

/** "Sat Oct 3" for a game that hasn't started; empty once it has. */
export function gameDay(game: BoxGame): string {
  if (game.final || game.live) return "";
  if (game.startIso) {
    const d = new Date(game.startIso);
    if (!Number.isNaN(d.getTime())) return formatPaperDay(d);
  }
  if (game.day && /^\d{4}-\d{2}-\d{2}$/.test(game.day)) {
    const d = new Date(`${game.day}T17:00:00Z`);
    if (!Number.isNaN(d.getTime())) return formatPaperDay(d);
  }
  return "";
}

export function gameClock(game: Pick<BoxGame, "final" | "live" | "status" | "startIso">): string {
  if (game.final) {
    if (/final/i.test(game.status) && !looksLikeEspnZoneClock(game.status)) return game.status;
    return "Final";
  }
  if (game.live) return looksLikeEspnZoneClock(game.status) ? "Live" : game.status;
  if (/postponed|delayed|suspended|canceled/i.test(game.status) && !looksLikeEspnZoneClock(game.status)) {
    return game.status;
  }
  return clockInCentral(game.startIso);
}

/** Weekday + clock for a packed slate cell — never the long "Sun Oct 11 · 12:00". */
export function slateKickoff(game: Pick<BoxGame, "final" | "live" | "startIso" | "status">): string {
  const clock = gameClock(game);
  if (game.final || game.live) return clock;
  if (!game.startIso) return clock || game.status;
  const d = new Date(game.startIso);
  if (Number.isNaN(d.getTime())) return clock || game.status;
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" });
  return clock ? `${day} ${clock}` : day;
}

/** National TV, short enough for a 3-column slate cell. */
export function shortBroadcast(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  const n = raw.toLowerCase();
  if (/prime|amazon/.test(n)) return "Prime";
  if (/peacock/.test(n)) return "Peacock";
  if (/netflix/.test(n)) return "Netflix";
  if (/nfl\s*net/.test(n) || n === "nfln") return "NFLN";
  if (/\bespn\b/.test(n)) return "ESPN";
  if (/\bcbs\b/.test(n)) return "CBS";
  if (/\bfox\b/.test(n)) return "FOX";
  if (/\bnbc\b/.test(n)) return "NBC";
  if (/\babc\b/.test(n)) return "ABC";
  return raw.replace(/\s+(video|vision|sports|network|tv).*$/i, "").slice(0, 8);
}

/**
 * A finished or live game, set as a story card. A recap leads when ESPN filed
 * one. Otherwise the card still opens, onto the box score.
 */
export function boxStoryCard(game: BoxGame): GameWrapCard | null {
  const recap = game.recap;
  const played = game.final || game.live;
  if (!recap && !played) return null;
  const winner = game.away.winner ? game.away : game.home.winner ? game.home : null;
  const body = recap?.html ? htmlToText(recap.html) : null;
  const scoreHeadline = `${game.away.short} ${game.away.score ?? ""}, ${game.home.short} ${game.home.score ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
  return {
    id: `box-${game.id}`,
    favoriteKey: "",
    teamName: winner?.short ?? game.home.short,
    teamHref: game.href ?? "/",
    sportLabel: game.league,
    leaguePath: game.path,
    headline: recap?.headline || scoreHeadline,
    dek: recap?.blurb ?? null,
    body,
    scoreLine: `${game.away.abbrev} ${game.away.score ?? ""} · ${game.home.abbrev} ${game.home.score ?? ""}`,
    when: game.startIso,
    won: null,
    gameHref: game.href,
    wrapHref: recap?.url ?? game.href,
    feedUrl: null,
    gameId: game.espnEventId ?? (game.gamePk != null ? String(game.gamePk) : null),
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    photo: recap?.photo ?? null,
    caption: `${game.away.name} at ${game.home.name}${game.venue ? `, ${game.venue}` : ""}.`,
    round: game.round,
    series: game.series,
    postseason: Boolean(game.round),
    status: game.final ? "Final" : game.status,
  };
}

/* ───────────────────────── standings ───────────────────────── */

export type StandRow = {
  id: string;
  name: string;
  abbrev: string;
  logo: string | null;
  cells: string[];
  /** 0–1 share of the possible (win pct or points pct), for the bar. */
  bar: number;
  clinch: string | null;
};

export type StandGroup = { name: string; columns: string[]; rows: StandRow[] };

type StandEntryRaw = {
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logos?: { href?: string }[];
  };
  stats?: { name?: string; type?: string; displayValue?: string; value?: number }[];
};

type StandNodeRaw = {
  name?: string;
  abbreviation?: string;
  children?: StandNodeRaw[];
  standings?: { entries?: StandEntryRaw[] };
};

type StandSpec = {
  columns: { label: string; type: string }[];
  bar: (get: (t: string) => number) => number;
  sort: (get: (t: string) => number) => number;
};

const STAND_SPECS: { test: (path: string) => boolean; spec: StandSpec }[] = [
  {
    test: (p) => p === "baseball/mlb",
    spec: {
      columns: [
        { label: "W", type: "wins" },
        { label: "L", type: "losses" },
        { label: "Pct", type: "winpercent" },
        { label: "GB", type: "gamesbehind" },
        { label: "L10", type: "lasttengames" },
        { label: "Strk", type: "streak" },
        { label: "Diff", type: "pointdifferential" },
      ],
      bar: (g) => g("winpercent"),
      sort: (g) => g("winpercent"),
    },
  },
  {
    test: (p) => p.startsWith("hockey/"),
    spec: {
      columns: [
        { label: "GP", type: "gamesplayed" },
        { label: "W", type: "wins" },
        { label: "L", type: "losses" },
        { label: "OTL", type: "otlosses" },
        { label: "Pts", type: "points" },
        { label: "GF", type: "pointsfor" },
        { label: "GA", type: "pointsagainst" },
        { label: "Strk", type: "streak" },
      ],
      bar: (g) => (g("gamesplayed") ? g("points") / (2 * g("gamesplayed")) : 0),
      sort: (g) => g("points") * 1000 - g("gamesplayed"),
    },
  },
  {
    test: (p) => p.startsWith("soccer/"),
    spec: {
      columns: [
        { label: "P", type: "gamesplayed" },
        { label: "W", type: "wins" },
        { label: "D", type: "ties" },
        { label: "L", type: "losses" },
        { label: "GF", type: "pointsfor" },
        { label: "GA", type: "pointsagainst" },
        { label: "GD", type: "pointdifferential" },
        { label: "Pts", type: "points" },
      ],
      bar: (g) => (g("gamesplayed") ? g("points") / (3 * g("gamesplayed")) : 0),
      sort: (g) => -g("rank"),
    },
  },
  {
    test: (p) => p === "football/nfl",
    spec: {
      columns: [
        { label: "W", type: "wins" },
        { label: "L", type: "losses" },
        { label: "T", type: "ties" },
        { label: "Pct", type: "winpercent" },
        { label: "PF", type: "pointsfor" },
        { label: "PA", type: "pointsagainst" },
        { label: "Diff", type: "pointdifferential" },
        { label: "Strk", type: "streak" },
      ],
      bar: (g) => g("winpercent"),
      sort: (g) => g("winpercent") * 1000 + g("pointdifferential") / 100,
    },
  },
  {
    test: (p) => /basketball\/(nba|wnba)/.test(p),
    spec: {
      columns: [
        { label: "W", type: "wins" },
        { label: "L", type: "losses" },
        { label: "Pct", type: "winpercent" },
        { label: "GB", type: "gamesbehind" },
        { label: "L10", type: "lasttengames" },
        { label: "Strk", type: "streak" },
      ],
      bar: (g) => g("winpercent"),
      sort: (g) => g("winpercent") * 1000 + g("wins"),
    },
  },
];

const NBA_PRESEASON_SPEC: StandSpec = {
  columns: [{ label: "Preseason", type: "total" }],
  bar: (g) => g("winpercent"),
  sort: (g) => g("winpercent") * 1000 + g("wins"),
};

const COLLEGE_SPEC: StandSpec = {
  columns: [
    { label: "Conf", type: "vsconf" },
    { label: "All", type: "total" },
    { label: "PF", type: "pointsfor" },
    { label: "PA", type: "pointsagainst" },
    { label: "Strk", type: "streak" },
  ],
  bar: (g) => g("leaguewinpercent"),
  sort: (g) => g("leaguewinpercent") * 1000 + g("wins"),
};

function standGroups(node: StandNodeRaw, out: { name: string; entries: StandEntryRaw[] }[]) {
  if (node.standings?.entries?.length) {
    out.push({ name: node.name ?? node.abbreviation ?? "League", entries: node.standings.entries });
  }
  for (const child of node.children ?? []) standGroups(child, out);
}

function entryDisplay(entry: StandEntryRaw, type: string): string {
  const stats = entry.stats ?? [];
  const hit = stats.find((s) => (s.type ?? s.name ?? "").toLowerCase() === type);
  return (hit?.displayValue ?? "").replace(/, \d+ PTS$/, "") || "";
}

function emptyRecord(v: string): boolean {
  return !v || v === "—" || /^0-0(?:-0)?$/.test(v);
}

/** Regular NBA spec, a one-column preseason table, or hide when nothing is in. */
export function basketballStandingsSpec(
  path: string,
  groups: { name: string; entries: StandEntryRaw[] }[],
): StandSpec | "hide" | null {
  if (!/basketball\/(nba|wnba)/.test(path)) return null;
  const rows = groups.flatMap((g) => g.entries);
  const regular = STAND_SPECS.find((s) => s.test(path))?.spec ?? null;
  if (!rows.length) return "hide";
  const totals = rows.map((e) => entryDisplay(e, "total"));
  if (!totals.every(emptyRecord)) return regular;
  const confType = rows.some((e) => !emptyRecord(entryDisplay(e, "vsconf"))) ? "vsconf" : "overall";
  const conf = rows.map((e) => entryDisplay(e, confType));
  if (conf.every(emptyRecord)) return "hide";
  return { ...NBA_PRESEASON_SPEC, columns: [{ label: "Preseason", type: confType }] };
}

/** Division / conference / league tables, sorted the way the league prints them. */
export async function fetchSectionStandings(path: string): Promise<StandGroup[]> {
  const data = await getJson<StandNodeRaw>(
    `https://site.web.api.espn.com/apis/v2/sports/${path}/standings?level=3`,
  );
  if (!data) return [];
  const groups: { name: string; entries: StandEntryRaw[] }[] = [];
  standGroups(data, groups);
  const hoop = basketballStandingsSpec(path, groups);
  if (hoop === "hide") return [];
  const spec = hoop ?? STAND_SPECS.find((s) => s.test(path))?.spec ?? COLLEGE_SPEC;
  return rankStandings(groups.map((group) => {
    const rows = group.entries.map((entry) => {
      const stats = entry.stats ?? [];
      const find = (t: string) => stats.find((s) => (s.type ?? s.name ?? "").toLowerCase() === t);
      const get = (t: string) => {
        const s = find(t);
        if (typeof s?.value === "number") return s.value;
        return Number.parseFloat(String(s?.displayValue ?? "").replace(/^\+/, "")) || 0;
      };
      const show = (t: string) => {
        const v = find(t)?.displayValue ?? "";
        return v.replace(/, \d+ PTS$/, "") || "—";
      };
      return {
        sortKey: spec.sort(get),
        row: {
          id: String(entry.team?.id ?? ""),
          name: entry.team?.shortDisplayName || entry.team?.displayName || "—",
          abbrev: (entry.team?.abbreviation ?? "—").toUpperCase(),
          logo: entry.team?.logos?.[0]?.href ?? null,
          cells: spec.columns.map((c) => show(c.type)),
          bar: Math.max(0, Math.min(1, spec.bar(get))),
          clinch: find("clincher")?.displayValue || null,
        } satisfies StandRow,
      };
    });
    rows.sort((a, b) => b.sortKey - a.sortKey);
    return {
      name: group.name.replace(/^\d{4}(-\d{2})?\s+/, ""),
      columns: spec.columns.map((c) => c.label),
      rows: rows.map((r) => r.row),
    };
  }));
}

/** SEC, then the other power conferences, then whatever ESPN sent. */
const CONF_ORDER: { test: RegExp; rank: number }[] = [
  { test: /\bsec\b|southeastern/i, rank: 0 },
  { test: /big ten/i, rank: 1 },
  { test: /big 12|big twelve/i, rank: 2 },
  { test: /\bacc\b|atlantic coast/i, rank: 3 },
];

export function rankStandings(groups: StandGroup[]): StandGroup[] {
  return groups
    .map((group, index) => {
      const hit = CONF_ORDER.find((row) => row.test.test(group.name));
      return { group, index, rank: hit?.rank ?? 50 };
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((row) => row.group);
}

export type CfbPollRow = {
  rank: number;
  name: string;
  abbrev: string;
  record: string | null;
  logo: string | null;
};

/** AP Top 25 via the Times ESPN client — never the Sports App fetch. */
export async function fetchCfbApPoll(): Promise<CfbPollRow[]> {
  const data = (await newspaperEspnGet("football/college-football/rankings").catch(() => null)) as {
    rankings?: {
      name?: string;
      shortName?: string;
      type?: string;
      ranks?: {
        current?: number;
        recordSummary?: string;
        team?: {
          abbreviation?: string;
          displayName?: string;
          location?: string;
          logos?: { href?: string }[];
        };
      }[];
    }[];
  } | null;
  if (!data) return [];
  const polls = data.rankings ?? [];
  const poll =
    polls.find((p) => /associated press|\bap top|\bap\b/i.test(`${p.name ?? ""} ${p.shortName ?? ""} ${p.type ?? ""}`)) ??
    polls[0];
  return (poll?.ranks ?? [])
    .filter((r): r is typeof r & { current: number } => r.current != null && r.current > 0 && r.current <= 25)
    .map((r) => ({
      rank: r.current,
      name: r.team?.displayName ?? r.team?.location ?? "—",
      abbrev: (r.team?.abbreviation ?? "—").toUpperCase(),
      record: r.recordSummary ?? null,
      logo: r.team?.logos?.[0]?.href ?? null,
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 25);
}

export function secStandingsGroup(groups: StandGroup[]): StandGroup | null {
  return groups.find((g) => /\bsec\b|southeastern/i.test(g.name)) ?? null;
}

export function ordinalPlace(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

export function shortGroupName(name: string): string {
  const n = name.replace(/^\d{4}(-\d{2})?\s+/, "").trim();
  if (/\bsec\b|southeastern/i.test(n)) return "SEC";
  if (/big ten/i.test(n)) return "Big Ten";
  if (/big 12|big twelve/i.test(n)) return "Big 12";
  if (/\bacc\b|atlantic coast/i.test(n)) return "ACC";
  if (/premier league/i.test(n)) return "Premier League";
  if (/championship/i.test(n) && /efl|english/i.test(n)) return "Championship";
  return n.replace(/\s+Conference$/i, "") || n;
}

/** Club-strip place from the same sorted table the A2 / CFB pages print. */
export function standingFromGroups(groups: StandGroup[], teamId: string): string | null {
  for (const group of groups) {
    const i = group.rows.findIndex((row) => row.id === teamId);
    if (i < 0) continue;
    return `${ordinalPlace(i + 1)} in ${shortGroupName(group.name)}`;
  }
  return null;
}

export function applyTableStandings<T extends { key: string; standing: string | null }>(
  snaps: T[],
  standingsByPath: Record<string, StandGroup[]> | null | undefined,
  favs: { key: string; espnPath: string }[],
): T[] {
  if (!standingsByPath) return snaps;
  const pathOf = new Map(favs.map((fav) => [fav.key, fav.espnPath]));
  return snaps.map((snap) => {
    const path = pathOf.get(snap.key);
    if (!path) return snap;
    const league = path.replace(/\/teams\/.*$/, "");
    const teamId = path.split("/").pop() ?? "";
    const standing = teamId ? standingFromGroups(standingsByPath[league] ?? [], teamId) : null;
    return standing ? { ...snap, standing } : snap;
  });
}

export type LeagueLeaderRow = {
  name: string;
  team: string;
  /** The category value — HR "4", AVG ".500", ERA "0.00" — never a game box line. */
  line: string;
  /** Games or innings, when the feed gives them. */
  note?: string;
  headshot: string | null;
};

export type LeagueLeaderGroup = {
  category: string;
  /** ESPN season type: 2 regular, 3 postseason. */
  seasonType?: number;
  rows: LeagueLeaderRow[];
};

const LEADER_SKIP = /kickoff|puntreturn|punts|extrapoint|returnyards|netavg|longfield|kickreturn/i;
const LEADER_FIRST = [
  "passingyards",
  "passingtouchdowns",
  "quarterbackrating",
  "rating",
  "completions",
  "passingcompletions",
  "interceptions",
  "passinginterceptions",
  "rushingyards",
  "rushingtouchdowns",
  "receivingyards",
  "receptions",
  "receivingtouchdowns",
  "sacks",
  "totaltackles",
  "defensiveinterceptions",
  "interceptionstotal",
  "fieldgoals",
  "fieldgoalsmade",
  "homeruns",
  "battingaverage",
  "rbi",
  "runs",
  "ops",
  "era",
  "strikeouts",
  "wins",
  "points",
  "goals",
  "assists",
  "rebounds",
  "avgpoints",
];

/** Fill the printed leaders page: more categories and a longer list than the old top five. */
export function leaderDeskSize(path: string): { categories: number; rows: number } {
  if (path.startsWith("football/")) return { categories: 12, rows: 10 };
  if (path === "baseball/mlb") return { categories: 12, rows: 8 };
  return { categories: 12, rows: 8 };
}

type LeaderCat = {
  name?: string;
  displayName?: string;
  abbreviation?: string;
  leaders?: {
    displayValue?: string;
    value?: number;
    athlete?: { displayName?: string; shortName?: string; fullName?: string; headshot?: { href?: string } };
    team?: { abbreviation?: string; shortDisplayName?: string };
  }[];
};

type LeadersPayload = {
  currentSeason?: { type?: { type?: number; name?: string } };
  requestedSeason?: { type?: { type?: number; name?: string } };
  leaders?: { categories?: LeaderCat[] };
};

/** ESPN's `displayValue` on league leaders is often last night's box line. The category total is `value`. */
export function isLeaderBoxLine(text: string | null | undefined): boolean {
  const s = (text ?? "").trim();
  if (!s) return false;
  if (/,/.test(s)) return true;
  if (/\bIP\b/i.test(s)) return true;
  return /\b\d+-\d+\b/.test(s) && /\b(?:HR|RBI|TB|BB|SO|K|2B|3B|H|R)\b/i.test(s);
}

function isRateCategory(name: string): boolean {
  const key = name.toLowerCase();
  if (/\bera\b|whip|avggoals/.test(key)) return true;
  return /(?:^|[^a-z])(?:avg|obp|slg|ops|pct|average|percentage)/.test(key);
}

function isEraLike(name: string): boolean {
  return /\bera\b|whip|avggoals|against/.test(name.toLowerCase());
}

export function formatLeaderStat(name: string, value: number | undefined, displayValue?: string): string {
  const shown = (displayValue ?? "").trim();
  if (shown && !isLeaderBoxLine(shown) && value == null) return shown;
  if (value == null || Number.isNaN(value)) return shown && !isLeaderBoxLine(shown) ? shown : "";
  if (isRateCategory(name)) {
    if (isEraLike(name) || /\bwhip\b/.test(name.toLowerCase())) return value.toFixed(2);
    const body = value.toFixed(3);
    return value < 1 && value >= 0 ? body.slice(1) : body;
  }
  if (Math.abs(value - Math.round(value)) < 1e-6) return String(Math.round(value));
  if (shown && !isLeaderBoxLine(shown)) return shown;
  return String(value);
}

export function leaderNoteFromBox(name: string, displayValue?: string): string | undefined {
  const shown = (displayValue ?? "").trim();
  if (!shown) return undefined;
  const ip = /\b(\d+(?:\.\d+)?)\s*IP\b/i.exec(shown);
  if (ip && /era|whip|win|save|strike|inning|pitch/i.test(name)) return `${ip[1]} IP`;
  return undefined;
}

/** Turn one ESPN leader row into the printed line (category value, optional IP note). */
export function leaderLineFromEspn(
  categoryName: string,
  row: { displayValue?: string; value?: number },
): { line: string; note?: string } {
  const line = formatLeaderStat(categoryName, row.value, row.displayValue);
  const note = leaderNoteFromBox(categoryName, row.displayValue);
  return note ? { line, note } : { line };
}

function seasonTypeOf(data: LeadersPayload | null | undefined): number | undefined {
  const raw = data?.requestedSeason?.type?.type ?? data?.currentSeason?.type?.type;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

/** League leaders (passing yards, home runs, points). ESPN's list, top of each category. */
export async function fetchLeagueLeaders(path: string, categories?: number, rows?: number): Promise<LeagueLeaderGroup[]> {
  const size = leaderDeskSize(path);
  const catCap = categories ?? size.categories;
  const rowCap = rows ?? size.rows;
  const data = (await newspaperEspnGet(`${path}/leaders?limit=${rowCap}`, { site: 3 }).catch(() => null)) as
    | LeadersPayload
    | null;
  const seasonType = seasonTypeOf(data);
  const cats = (data?.leaders?.categories ?? []).filter(
    (cat) => cat.displayName && cat.leaders?.length && !LEADER_SKIP.test(`${cat.name ?? ""} ${cat.displayName}`),
  );
  cats.sort((a, b) => {
    const ia = LEADER_FIRST.indexOf((a.name ?? "").toLowerCase());
    const ib = LEADER_FIRST.indexOf((b.name ?? "").toLowerCase());
    return (ia < 0 ? 40 : ia) - (ib < 0 ? 40 : ib);
  });
  return cats
    .slice(0, catCap)
    .map((cat) => {
      const label = `${cat.name ?? ""} ${cat.displayName ?? ""} ${cat.abbreviation ?? ""}`;
      return {
        category: cat.displayName!,
        seasonType,
        rows: (cat.leaders ?? []).slice(0, rowCap).flatMap((row) => {
          const name = row.athlete?.shortName || row.athlete?.displayName || row.athlete?.fullName || "";
          if (!name) return [];
          const printed = leaderLineFromEspn(label, row);
          if (!printed.line) return [];
          return [
            {
              name,
              team: row.team?.abbreviation || row.team?.shortDisplayName || "",
              line: printed.line,
              ...(printed.note ? { note: printed.note } : {}),
              headshot: row.athlete?.headshot?.href ?? null,
            },
          ];
        }),
      };
    })
    .filter((group) => group.rows.length > 0);
}

function eventKey(game: BoxGame): string | null {
  if (game.espnEventId) return `espn:${game.espnEventId}`;
  if (game.gamePk != null) return `mlb:${game.gamePk}`;
  return null;
}

function teamDateKey(game: BoxGame): string | null {
  const away = game.away.id;
  const home = game.home.id;
  if (!away || !home || !game.day) return null;
  const slot = game.startIso ? game.startIso.slice(0, 16) : "";
  return `${game.day}|${[away, home].sort().join("-")}|${slot}`;
}

function completeness(game: BoxGame): number {
  return (
    (game.venue ? 4 : 0) +
    (game.startIso ? 2 : 0) +
    (game.broadcasts.length ? 1 : 0) +
    (game.espnEventId || game.gamePk != null ? 2 : 0)
  );
}

/** One row per ESPN / MLB id; same teams+date+slot collapse as a fallback. */
export function dedupeBoxGames(games: BoxGame[]): BoxGame[] {
  const seenId = new Set<string>();
  const seenPair = new Set<string>();
  const out: BoxGame[] = [];
  for (const game of games) {
    const eid = eventKey(game);
    if (eid) {
      if (seenId.has(eid)) continue;
      seenId.add(eid);
    } else if (seenId.has(game.id)) {
      continue;
    }
    seenId.add(game.id);
    const pair = teamDateKey(game);
    if (pair) {
      if (seenPair.has(pair)) continue;
      seenPair.add(pair);
    }
    out.push(game);
  }
  return out;
}

/**
 * Same club in two games at the same tip is a split-squad only when the
 * venues differ. Otherwise the extra row is a stale ESPN duplicate.
 */
export function dropBogusSameSlot(games: BoxGame[]): BoxGame[] {
  const bySlot = new Map<string, BoxGame[]>();
  for (const game of games) {
    const slot = game.startIso ? game.startIso.slice(0, 16) : "";
    if (!slot) continue;
    for (const id of [game.away.id, game.home.id]) {
      if (!id) continue;
      const key = `${id}|${slot}`;
      const list = bySlot.get(key) ?? [];
      list.push(game);
      bySlot.set(key, list);
    }
  }
  const drop = new Set<string>();
  for (const group of bySlot.values()) {
    const uniq = [...new Map(group.map((g) => [g.id, g])).values()];
    if (uniq.length < 2) continue;
    const venues = new Set(uniq.map((g) => (g.venue ?? "").trim()).filter(Boolean));
    if (venues.size >= 2) continue;
    const ranked = [...uniq].sort((a, b) => completeness(b) - completeness(a));
    for (const extra of ranked.slice(1)) drop.add(extra.id);
  }
  return games.filter((g) => !drop.has(g.id));
}

function uniqueGames(games: BoxGame[]): BoxGame[] {
  return dropBogusSameSlot(dedupeBoxGames(games));
}

const byStart = (a: BoxGame, b: BoxGame) => String(a.startIso ?? "").localeCompare(String(b.startIso ?? ""));
const byDayThenStart = (a: BoxGame, b: BoxGame) => a.day.localeCompare(b.day) || byStart(a, b);

export function isCfbDeskGame(game: BoxGame): boolean {
  return isNewspaperCfbDeskGame({
    awayId: game.away.id,
    homeId: game.home.id,
    awayRank: game.away.rank ? Number(game.away.rank) : null,
    homeRank: game.home.rank ? Number(game.home.rank) : null,
  });
}

/** Kickoff order for CFB5 — Friday first, then Saturday, never by watch rating. */
export function sortCfbDeskGames(games: BoxGame[]): BoxGame[] {
  return [...games].sort((a, b) => {
    const aIso = a.startIso ?? "";
    const bIso = b.startIso ?? "";
    if (aIso && bIso && aIso !== bIso) return aIso.localeCompare(bIso);
    if (aIso && !bIso) return -1;
    if (!aIso && bIso) return 1;
    return a.id.localeCompare(b.id);
  });
}

/** TV only. Unknown network stays blank — never the venue. */
export function cfbNetworkLabel(game: BoxGame): string {
  return game.broadcasts.filter(Boolean).join(" · ");
}

/**
 * Pick the results week and the upcoming slate from already-fetched football
 * boards. ESPN's default scoreboard is a date window; callers must pass the
 * week payloads (`?week=&seasontype=`) so Sunday's games are not dropped.
 */
export function footballWeeksBoard(opts: {
  day: string;
  newsDay: string;
  week: number | null;
  thisGames: BoxGame[];
  priorGames: BoxGame[];
  nextGames: BoxGame[];
  college: boolean;
}): Omit<SectionBoard, "weekLabel" | "priorLabel"> & {
  weekLabel: string | null;
  priorLabel: string | null;
} {
  const desk = (list: BoxGame[]) =>
    uniqueGames(opts.college ? list.filter(isCfbDeskGame) : list).sort(byStart);
  const thisPlayed = opts.thisGames.filter((g) => g.final || g.live);
  const resultsSource = thisPlayed.length ? opts.thisGames : opts.priorGames;
  const resultsWeekNumber = thisPlayed.length
    ? opts.week
    : opts.week && opts.week > 1
      ? opts.week - 1
      : opts.week;
  const thisUpcoming = opts.thisGames.filter((g) => !g.final && !g.live);
  const nextUpcoming = opts.nextGames.filter((g) => !g.final && !g.live);
  // NFL: once this week has finals, the schedule page is next week (TNF–MNF).
  // CFB keeps the rest of this Saturday first, then rolls to next week.
  const slateSource = opts.college
    ? thisUpcoming.length
      ? thisUpcoming
      : nextUpcoming
    : thisPlayed.length
      ? nextUpcoming
      : thisUpcoming;
  const prior = desk(opts.priorGames.filter((g) => g.final));
  const priorWeekNumber = opts.week && opts.week > 1 ? opts.week - 1 : null;
  return {
    results: desk(resultsSource.filter((g) => g.final || g.live)),
    slate: desk(slateSource).sort(byDayThenStart),
    week: desk(resultsSource),
    weekLabel: resultsWeekNumber ? `Week ${resultsWeekNumber}` : null,
    weekNumber: resultsWeekNumber ?? null,
    prior,
    priorLabel: priorWeekNumber ? `Week ${priorWeekNumber}` : null,
    priorWeekNumber,
    resultsWeekNumber: resultsWeekNumber ?? null,
    slateWeekNumber:
      opts.college
        ? thisUpcoming.length
          ? opts.week
          : opts.week
            ? opts.week + 1
            : null
        : thisPlayed.length && opts.week
          ? opts.week + 1
          : (opts.week ?? null),
  };
}

/**
 * Results and slate for one sport section. Daily leagues read last night,
 * today and tomorrow; football reads this week and, when this week has no
 * finals yet, last week.
 */
export async function fetchSectionBoard(path: string, edition: string): Promise<SectionBoard> {
  const day = editionYmd(edition);
  const newsDay = editionNewsDay(day);
  const tomorrow = shiftDay(day, 1);
  if (path === "baseball/mlb") {
    const [last, today, next, after] = await Promise.all([
      fetchMlbBoxDay(newsDay),
      fetchMlbBoxDay(day),
      fetchMlbBoxDay(tomorrow),
      fetchMlbBoxDay(shiftDay(day, 2)),
    ]);
    let results = [...last.filter((g) => g.final), ...today.filter((g) => g.final || g.live)].sort(byStart);
    // Off days (a playoff Sunday) still need a scores rail — walk back two nights.
    if (!results.length) {
      const older = await Promise.all([shiftDay(newsDay, -1), shiftDay(newsDay, -2)].map(fetchMlbBoxDay));
      results = older.flat().filter((g) => g.final).sort(byStart);
    }
    if (!results.length) {
      const espn = await espnBoard(path, `&dates=${newsDay.replace(/-/g, "")}`);
      results = boardGames(path, espn, newsDay).filter((g) => g.final || g.live).sort(byStart);
    }
    return {
      results,
      slate: uniqueGames([...today.filter((g) => !g.final), ...next, ...after]).sort(byDayThenStart),
    };
  }
  if (path.startsWith("football/")) {
    const college = path.includes("college-football");
    const current = await espnBoard(path, "");
    const week = current?.week?.number ?? null;
    const seasonType = current?.season?.type ?? 2;
    const [thisBoard, prev, next] = await Promise.all([
      week ? espnBoard(path, `&week=${week}&seasontype=${seasonType}`) : Promise.resolve(current),
      week && week > 1 ? espnBoard(path, `&week=${week - 1}&seasontype=${seasonType}`) : Promise.resolve(null),
      week ? espnBoard(path, `&week=${week + 1}&seasontype=${seasonType}`) : Promise.resolve(null),
    ]);
    return footballWeeksBoard({
      day,
      newsDay,
      week,
      thisGames: boardGames(path, thisBoard ?? current, day),
      priorGames: prev ? boardGames(path, prev, newsDay).filter((g) => g.final) : [],
      nextGames: next ? boardGames(path, next, day) : [],
      college,
    });
  }
  const ymd = (d: string) => d.replace(/-/g, "");
  if (path.startsWith("soccer/")) {
    // Clubs play twice a week at most; a single night is usually empty.
    // ESPN's soccer board ignores date ranges, so walk back a day at a time;
    // the undated board already shows the next matchday.
    const days = Array.from({ length: 14 }, (_, i) => shiftDay(day, -i));
    const [ahead, ...back] = await Promise.all([
      espnBoard(path, ""),
      ...days.map((d) => espnBoard(path, `&dates=${ymd(d)}`)),
    ]);
    const past = uniqueGames(back.flatMap((board, i) => boardGames(path, board, days[i]!)));
    const first = boardGames(path, ahead, day).filter((g) => !g.final && !g.live);
    // The undated board stops at the matchday's first date; read the rest of the round.
    const firstDay = first.map((g) => g.startIso ?? "").filter(Boolean).sort()[0];
    const restDays = firstDay
      ? [1, 2, 3].map((n) => shiftDay(espnDayOf(firstDay, day), n))
      : [];
    const rest = await Promise.all(restDays.map((d) => espnBoard(path, `&dates=${ymd(d)}`)));
    const round = rest.flatMap((board, i) => boardGames(path, board, restDays[i]!));
    return {
      results: past.filter((g) => g.final || g.live).sort(byStart),
      slate: uniqueGames([...first, ...round].filter((g) => !g.final && !g.live)).sort(byStart),
    };
  }
  const [last, today, next] = await Promise.all([
    espnBoard(path, `&dates=${ymd(newsDay)}`),
    espnBoard(path, `&dates=${ymd(day)}`),
    espnBoard(path, `&dates=${ymd(tomorrow)}`),
  ]);
  const todays = boardGames(path, today, day);
  return {
    results: uniqueGames([
      ...boardGames(path, last, newsDay).filter((g) => g.final),
      ...todays.filter((g) => g.final || g.live),
    ]).sort(byStart),
    slate: uniqueGames([...todays.filter((g) => !g.final && !g.live), ...boardGames(path, next, tomorrow)]).sort(
      byStart,
    ),
  };
}
