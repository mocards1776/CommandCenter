/**
 * Scoreboards and box scores for the Thompson Times sport sections.
 *
 * MLB comes off one statsapi schedule call per day (linescore, decisions,
 * probables with season lines, series status, and the MLB.com recap with its
 * photo and full body), plus the per-game boxscore for the agate. Every other
 * league reads ESPN's scoreboard, which carries period lines and stat leaders.
 */

import { editionNewsDay } from "./newspaper.ts";
import type { GameWrapCard } from "./newspaper-sports";

const MLB_API = "https://statsapi.mlb.com/api/v1";
const ESPN_SITE = "https://site.web.api.espn.com/apis/site/v2/sports";

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
  /** Football: every game of the current week, finals and kickoffs together. */
  week?: BoxGame[];
  weekLabel?: string | null;
  /** Football: last week's finals, for the days before this week's games are played. */
  prior?: BoxGame[];
  priorLabel?: string | null;
};

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
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
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&ldquo;/gi, "“")
    .replace(/&rdquo;/gi, "”")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
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

type EspnAthlete = { id?: string; shortName?: string; displayName?: string; headshot?: string | { href?: string } };

type EspnLeaderGroup = {
  shortDisplayName?: string;
  displayName?: string;
  leaders?: { displayValue?: string; athlete?: EspnAthlete; team?: { id?: string } }[];
};

type EspnCompetitorRaw = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
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

function headshotOf(a: EspnAthlete | undefined): string | null {
  const h = a?.headshot;
  if (!h) return null;
  return typeof h === "string" ? h : h.href ?? null;
}

function leagueCode(path: string): string {
  const slug = path.split("/").pop() ?? "";
  return (
    {
      mlb: "MLB",
      nfl: "NFL",
      nhl: "NHL",
      "college-football": "CFB",
      "mens-college-basketball": "CBB",
    } as Record<string, string>
  )[slug] ?? slug.toUpperCase();
}

function espnGameHref(path: string, id: string): string | null {
  if (path === "football/nfl") return `/sports/nfl/game/${id}`;
  if (path === "hockey/nhl") return `/sports/nhl/game/${id}`;
  if (path === "football/college-football") return `/sports/cfb/game/${id}`;
  if (path.startsWith("soccer/")) return `/sports/soccer/game/${id}`;
  return null;
}

function periodLabels(path: string, count: number): string[] {
  const base = path.startsWith("soccer/") ? ["1H", "2H"] : path.startsWith("hockey/") ? ["1", "2", "3"] : path.startsWith("basketball/") ? ["1H", "2H"] : ["1", "2", "3", "4"];
  const out = [...base];
  while (out.length < count) {
    const extra = out.length - base.length + 1;
    out.push(path.startsWith("hockey/") ? (extra === 1 ? "OT" : "SO") : extra === 1 ? "OT" : `${extra}OT`);
  }
  return out.slice(0, Math.max(count, base.length));
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
    const stats = (p.statistics ?? [])
      .filter((s) => /^(W|L|ERA)$/i.test(s.abbreviation ?? ""))
      .map((s) => `${s.displayValue} ${s.abbreviation}`)
      .join(", ");
    return {
      id: p.athlete.id ?? null,
      name: p.athlete.displayName || p.athlete.shortName || "",
      line: stats || null,
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
  // College football's default board is the Top 25 slate; a limit opens all of FBS.
  const limit = path === "football/college-football" ? "" : "limit=200";
  return getJson<EspnBoardRaw>(`${ESPN_SITE}/${path}/scoreboard?${limit}${query}`);
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

/** Full ESPN game story for a recap headline, when the board only sent the blurb. */
export async function fetchEspnRecapStory(
  path: string,
  eventId: string,
): Promise<{ html: string; photo: string | null; byline: string | null } | null> {
  const data = await getJson<{
    article?: { story?: string; images?: { url?: string }[]; byline?: string };
  }>(`${ESPN_SITE}/${path}/summary?event=${eventId}`);
  const story = data?.article?.story;
  if (!story || story.length < 200) return null;
  return {
    html: cleanStoryHtml(story),
    photo: data?.article?.images?.[0]?.url ?? null,
    byline: data?.article?.byline ?? null,
  };
}

function faceOff(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(":00 ", " ");
}

export function gameClock(game: BoxGame): string {
  if (game.final) return /final/i.test(game.status) ? game.status : "Final";
  if (game.live) return game.status;
  if (/postponed|delayed|suspended|canceled/i.test(game.status)) return game.status;
  return faceOff(game.startIso) || game.status;
}

/** A finished game's recap, set as a story card so it runs like any other article. */
export function boxStoryCard(game: BoxGame): GameWrapCard | null {
  const recap = game.recap;
  if (!recap) return null;
  const winner = game.away.winner ? game.away : game.home.winner ? game.home : null;
  const body = recap.html ? htmlToText(recap.html) : null;
  return {
    id: `box-${game.id}`,
    favoriteKey: "",
    teamName: winner?.short ?? game.home.short,
    teamHref: game.href ?? "/",
    sportLabel: game.league,
    leaguePath: game.path,
    headline: recap.headline,
    dek: recap.blurb,
    body,
    scoreLine: `${game.away.abbrev} ${game.away.score ?? ""} · ${game.home.abbrev} ${game.home.score ?? ""}`,
    when: game.startIso,
    won: null,
    gameHref: game.href,
    wrapHref: recap.url,
    feedUrl: null,
    gameId: game.espnEventId ?? (game.gamePk != null ? String(game.gamePk) : null),
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    photo: recap.photo,
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
];

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

/** Division / conference / league tables, sorted the way the league prints them. */
export async function fetchSectionStandings(path: string): Promise<StandGroup[]> {
  const data = await getJson<StandNodeRaw>(
    `https://site.web.api.espn.com/apis/v2/sports/${path}/standings?level=3`,
  );
  if (!data) return [];
  const spec = STAND_SPECS.find((s) => s.test(path))?.spec ?? COLLEGE_SPEC;
  const groups: { name: string; entries: StandEntryRaw[] }[] = [];
  standGroups(data, groups);
  return groups.map((group) => {
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
  });
}

function uniqueGames(games: BoxGame[]): BoxGame[] {
  const seen = new Set<string>();
  return games.filter((g) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
}

const byStart = (a: BoxGame, b: BoxGame) => String(a.startIso ?? "").localeCompare(String(b.startIso ?? ""));
const byDayThenStart = (a: BoxGame, b: BoxGame) => a.day.localeCompare(b.day) || byStart(a, b);

/**
 * Results and slate for one sport section. Daily leagues read last night,
 * today and tomorrow; football reads this week and, when this week has no
 * finals yet, last week.
 */
export async function fetchSectionBoard(path: string, edition: string): Promise<SectionBoard> {
  const newsDay = editionNewsDay(edition);
  const tomorrow = shiftDay(edition, 1);
  if (path === "baseball/mlb") {
    const [last, today, next, after] = await Promise.all([
      fetchMlbBoxDay(newsDay),
      fetchMlbBoxDay(edition),
      fetchMlbBoxDay(tomorrow),
      fetchMlbBoxDay(shiftDay(edition, 2)),
    ]);
    return {
      results: [...last.filter((g) => g.final), ...today.filter((g) => g.final || g.live)].sort(byStart),
      slate: uniqueGames([...today.filter((g) => !g.final), ...next, ...after]).sort(byDayThenStart),
    };
  }
  if (path.startsWith("football/")) {
    const current = await espnBoard(path, "");
    const games = boardGames(path, current, edition);
    const results = games.filter((g) => g.final || g.live);
    const week = current?.week?.number;
    const prev =
      week && week > 1 ? await espnBoard(path, `&week=${week - 1}&seasontype=${current?.season?.type ?? 2}`) : null;
    const prior = prev ? boardGames(path, prev, newsDay).filter((g) => g.final) : [];
    return {
      results: uniqueGames(results).sort(byStart),
      slate: games.filter((g) => !g.final).sort(byStart),
      week: uniqueGames(games).sort(byStart),
      weekLabel: week ? `Week ${week}` : null,
      prior: uniqueGames(prior).sort(byStart),
      priorLabel: week && week > 1 ? `Week ${week - 1}` : null,
    };
  }
  const ymd = (d: string) => d.replace(/-/g, "");
  if (path.startsWith("soccer/")) {
    // Clubs play twice a week at most; a single night is usually empty.
    // ESPN's soccer board ignores date ranges, so walk back a day at a time;
    // the undated board already shows the next matchday.
    const days = Array.from({ length: 14 }, (_, i) => shiftDay(edition, -i));
    const [ahead, ...back] = await Promise.all([
      espnBoard(path, ""),
      ...days.map((d) => espnBoard(path, `&dates=${ymd(d)}`)),
    ]);
    const past = uniqueGames(back.flatMap((board, i) => boardGames(path, board, days[i]!)));
    const first = boardGames(path, ahead, edition).filter((g) => !g.final && !g.live);
    // The undated board stops at the matchday's first date; read the rest of the round.
    const firstDay = first.map((g) => g.startIso ?? "").filter(Boolean).sort()[0];
    const restDays = firstDay
      ? [1, 2, 3].map((n) => shiftDay(espnDayOf(firstDay, edition), n))
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
    espnBoard(path, `&dates=${ymd(edition)}`),
    espnBoard(path, `&dates=${ymd(tomorrow)}`),
  ]);
  const todays = boardGames(path, today, edition);
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
