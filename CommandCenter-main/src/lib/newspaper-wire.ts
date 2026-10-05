/**
 * League-wide day boards for the Thompson Times.
 *
 * The team-by-team pipeline only ever sees games your clubs played, so October
 * baseball vanishes the moment your club is eliminated. This reads the whole
 * league's board for the edition's news days instead, and keeps ESPN's recap
 * prose, highlight still, series line, and star lines off the same payload.
 */

import { editionNewsDay, wireBoardDays } from "./newspaper.ts";
import {
  hasEspnRecap,
  leadersFromSummary,
  linesFromSummary,
  nextFromSummary,
  periodLabelsFor,
  summaryImageWidth,
  summaryVenue,
  writeBoxWrap,
  type BoxWrapLine,
  type EspnSummaryForWrap,
} from "./newspaper-box-wrap.ts";
import { formatFixtureWhen } from "./newspaper-box.ts";
import { packFromSides, type RecapGamePack, type RecapLeader, type RecapSide } from "./newspaper-recap.ts";
import { isNewspaperCfbDeskGame, isNewspaperSecGame, newspaperEspnGet } from "./newspaper-espn.ts";
import type { SportsFavorite } from "./sports.ts";

/** One game on a section's schedule page — league-wide, with pitchers when known. */
export type LeagueSlateGame = {
  id: string;
  path: string;
  day: string;
  when: string | null;
  status: string;
  final: boolean;
  live: boolean;
  venue: string | null;
  round: string | null;
  href: string | null;
  away: {
    name: string;
    abbrev: string;
    logo: string | null;
    score: string | null;
    record: string | null;
    pitcher: string | null;
  };
  home: {
    name: string;
    abbrev: string;
    logo: string | null;
    score: string | null;
    record: string | null;
    pitcher: string | null;
  };
};

export type WireSide = {
  id: string | null;
  name: string;
  short: string;
  abbrev: string;
  logo: string | null;
  color: string | null;
  score: string | null;
  winner: boolean;
  record: string | null;
  seed: string | null;
  hits?: string | null;
  errors?: string | null;
};

/** Full-league club for sport-section team walls. */
export type LeagueClub = {
  id: string;
  name: string;
  short: string;
  abbrev: string;
  logo: string | null;
  record: string;
  rank: string;
  group: string;
  favorite: boolean;
};

export type WireGame = {
  id: string;
  /** Raw ESPN event id, kept separate because some slugs contain hyphens. */
  eventId: string;
  /** ESPN site path, e.g. baseball/mlb. */
  path: string;
  league: string;
  sportLabel: string;
  /** "NLWC - Game 1" style round label when the league is in its bracket. */
  round: string | null;
  /** "ATL leads series 1-0" */
  series: string | null;
  postseason: boolean;
  /** Exhibitions: a result, but not news. */
  preseason: boolean;
  final: boolean;
  live: boolean;
  statusDetail: string;
  startedAt: string | null;
  day: string;
  away: WireSide;
  home: WireSide;
  headline: string;
  body: string | null;
  /** City ESPN filed the story from, printed at the head of the copy. */
  dateline: string | null;
  photo: string | null;
  href: string;
  leaders: RecapLeader[];
  favoriteKeys: string[];
  /** ESPN recap of 200+ characters, or a Times box wrap when that is missing. */
  wrapKind?: "espn" | "box" | null;
  lines?: BoxWrapLine[];
  next?: string | null;
  sec?: boolean;
  venue?: string | null;
  photoWidth?: number | null;
  recapGame?: RecapGamePack | null;
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  curatedRank?: { current?: number };
  linescores?: { value?: number }[];
  records?: { type?: string; summary?: string }[];
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
    logos?: { href?: string }[];
    color?: string;
  };
  hits?: number;
  errors?: number;
};

type EspnHeadline = {
  type?: string;
  description?: string;
  shortLinkText?: string;
  video?: { thumbnail?: string }[];
};

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  season?: { type?: number };
  competitions?: {
    date?: string;
    notes?: { headline?: string }[];
    series?: { summary?: string; type?: string };
    status?: { type?: { completed?: boolean; state?: string; detail?: string; description?: string } };
    competitors?: EspnCompetitor[];
    headlines?: EspnHeadline[];
    highlights?: { thumbnail?: string }[];
    leaders?: {
      shortDisplayName?: string;
      displayName?: string;
      leaders?: {
        displayValue?: string;
        athlete?: { id?: string; displayName?: string; shortName?: string; headshot?: string | { href?: string } };
      }[];
    }[];
  }[];
};

export type WireLeague = {
  path: string;
  league: string;
  label: string;
  /** espn.com slug for recap links. */
  slug: string;
  /**
   * Unused by the press (the news-day window now picks the days). Kept so
   * older call sites that list leagues still type-check.
   */
  lookback: number;
  /** Internal game route builder, when the app has a page for it. */
  gameHref?: (id: string) => string;
};

const LEAGUES: WireLeague[] = [
  {
    path: "baseball/mlb",
    league: "MLB",
    label: "Baseball",
    slug: "mlb",
    lookback: 1,
    gameHref: (id) => `https://www.espn.com/mlb/game/_/gameId/${id}`,
  },
  {
    path: "hockey/nhl",
    league: "NHL",
    label: "Hockey",
    slug: "nhl",
    lookback: 1,
    gameHref: (id) => `/sports/nhl/game/${id}`,
  },
  {
    path: "football/nfl",
    league: "NFL",
    label: "Football",
    slug: "nfl",
    lookback: 1,
    gameHref: (id) => `/sports/nfl/game/${id}`,
  },
  {
    path: "football/college-football",
    league: "CFB",
    label: "College football",
    slug: "college-football",
    lookback: 1,
    gameHref: (id) => `/sports/cfb/game/${id}`,
  },
  {
    path: "basketball/nba",
    league: "NBA",
    label: "Basketball",
    slug: "nba",
    lookback: 1,
  },
  {
    path: "basketball/mens-college-basketball",
    league: "CBB",
    label: "College basketball",
    slug: "mens-college-basketball",
    lookback: 1,
  },
];

/** Leagues the reader follows, plus the soccer competitions their clubs play in. */
export function wireLeaguesForFavorites(favs: SportsFavorite[]): WireLeague[] {
  const out: WireLeague[] = [];
  const seen = new Set<string>();
  const add = (l: WireLeague) => {
    if (seen.has(l.path)) return;
    seen.add(l.path);
    out.push(l);
  };
  for (const fav of favs) {
    if (fav.kind !== "team") continue;
    const match = LEAGUES.find((l) => fav.espnPath.startsWith(`${l.path}/`));
    if (match) {
      add(match);
      continue;
    }
    const league = fav.espnPath.match(/^soccer\/([^/]+)\//)?.[1];
    if (league) {
      add({
        path: `soccer/${league}`,
        league: fav.league || "Soccer",
        label: "Soccer",
        slug: "soccer",
        lookback: 1,
        gameHref: (id) => `/sports/soccer/game/${id}`,
      });
    }
  }
  return out;
}

function yyyymmdd(iso: string): string {
  return iso.replace(/-/g, "");
}

function side(c: EspnCompetitor | undefined): WireSide {
  const overall = c?.records?.find((r) => r.type === "total") ?? c?.records?.[0];
  const rank = c?.curatedRank?.current;
  return {
    id: c?.team?.id ? String(c.team.id) : null,
    name: c?.team?.displayName ?? "—",
    short: c?.team?.shortDisplayName ?? c?.team?.displayName ?? "—",
    abbrev: (c?.team?.abbreviation ?? "—").toUpperCase(),
    logo: c?.team?.logo ?? c?.team?.logos?.[0]?.href ?? null,
    color: c?.team?.color ? `#${c.team.color}` : null,
    score: c?.score ?? null,
    winner: Boolean(c?.winner),
    record: overall?.summary ?? null,
    seed: rank && rank > 0 && rank < 99 ? `No. ${rank}` : null,
    hits: c?.hits != null ? String(c.hits) : null,
    errors: c?.errors != null ? String(c.errors) : null,
  };
}

function logoFromTeam(team: {
  logo?: string;
  logos?: { href?: string; rel?: string[] }[];
} | undefined): string | null {
  if (!team) return null;
  if (team.logo) return team.logo;
  const logos = team.logos ?? [];
  const full = logos.find((l) => l.rel?.includes("full"));
  return (full ?? logos[0])?.href ?? null;
}

function recordFromStats(
  path: string,
  stats: { name?: string; displayValue?: string }[] | undefined,
): string {
  const stat = (n: string) => stats?.find((s) => s.name === n)?.displayValue ?? "";
  if (/soccer\//i.test(path)) {
    const w = stat("wins") || "0";
    const d = stat("ties") || "0";
    const l = stat("losses") || "0";
    const pts = stat("points");
    return pts ? `${w}-${d}-${l} · ${pts} pts` : `${w}-${d}-${l}`;
  }
  if (/hockey\/nhl/i.test(path)) {
    return `${stat("wins") || "0"}-${stat("losses") || "0"}-${stat("otLosses") || stat("overtimeLosses") || "0"}`;
  }
  return stat("overall") || `${stat("wins") || "0"}-${stat("losses") || "0"}`;
}

/** Every club in a league — not just the ones the reader follows. */
export async function fetchLeagueClubs(path: string): Promise<LeagueClub[]> {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/v2/sports/${path}/standings`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      children?: {
        name?: string;
        standings?: {
          entries?: {
            team?: {
              id?: string;
              displayName?: string;
              shortDisplayName?: string;
              abbreviation?: string;
              logo?: string;
              logos?: { href?: string; rel?: string[] }[];
            };
            stats?: { name?: string; displayValue?: string }[];
          }[];
        };
      }[];
      standings?: {
        entries?: {
          team?: {
            id?: string;
            displayName?: string;
            shortDisplayName?: string;
            abbreviation?: string;
            logo?: string;
            logos?: { href?: string; rel?: string[] }[];
          };
          stats?: { name?: string; displayValue?: string }[];
        }[];
      };
    };
    const out: LeagueClub[] = [];
    const seen = new Set<string>();
    const push = (
      group: string,
      entries: {
        team?: {
          id?: string;
          displayName?: string;
          shortDisplayName?: string;
          abbreviation?: string;
          logo?: string;
          logos?: { href?: string; rel?: string[] }[];
        };
        stats?: { name?: string; displayValue?: string }[];
      }[],
    ) => {
      for (const e of entries) {
        const id = e.team?.id ? String(e.team.id) : "";
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const rank =
          e.stats?.find((s) => s.name === "rank")?.displayValue ||
          e.stats?.find((s) => s.name === "playoffSeed")?.displayValue ||
          String(out.length + 1);
        out.push({
          id,
          name: e.team?.displayName ?? "—",
          short: e.team?.shortDisplayName ?? e.team?.displayName ?? "—",
          abbrev: (e.team?.abbreviation ?? "—").toUpperCase(),
          logo: logoFromTeam(e.team),
          record: recordFromStats(path, e.stats),
          rank,
          group,
          favorite: false,
        });
      }
    };
    for (const child of data.children ?? []) {
      push(child.name ?? "", child.standings?.entries ?? []);
    }
    if (!out.length) push("", data.standings?.entries ?? []);
    return out;
  } catch {
    return [];
  }
}

export function markFavoriteClubs(
  clubs: LeagueClub[],
  favs: SportsFavorite[],
  path: string,
): LeagueClub[] {
  const ids = new Set(
    favs
      .filter((f) => f.kind === "team" && f.espnPath.startsWith(`${path}/`))
      .map((f) => f.espnPath.split("/").pop() ?? ""),
  );
  return clubs.map((c) => ({ ...c, favorite: ids.has(c.id) }));
}

export function espnTeamLogo(path: string, teamId: string | null | undefined): string | null {
  if (!teamId) return null;
  if (/baseball\/mlb/i.test(path)) {
    return `https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${teamId}.png`;
  }
  if (/football\/nfl/i.test(path)) {
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${teamId}.png`;
  }
  if (/college-football/i.test(path)) {
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
  }
  if (/hockey\/nhl/i.test(path)) {
    return `https://a.espncdn.com/i/teamlogos/nhl/500/${teamId}.png`;
  }
  if (/mens-college-basketball/i.test(path)) {
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
  }
  if (/basketball\/nba/i.test(path)) {
    return `https://a.espncdn.com/i/teamlogos/nba/500/${teamId}.png`;
  }
  if (/soccer\//i.test(path)) {
    return `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`;
  }
  return `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`;
}

/** ESPN prefixes recap descriptions with an em dash datelineless stub. */
function cleanBody(text: string | undefined): string | null {
  const t = (text ?? "").replace(/^\s*—\s*/, "").replace(/\s+/g, " ").trim();
  return t.length >= 60 ? t : null;
}

function playerHrefFor(league: WireLeague, id: string | undefined): string | null {
  if (!id) return null;
  if (league.slug === "mlb") return `/sports/mlb/player/${id}`;
  if (league.slug === "nhl") return `/sports/nhl/player/${id}`;
  if (league.slug === "nfl") return `/sports/nfl/player/${id}`;
  if (league.slug === "college-football") return `/sports/cfb/player/${id}`;
  if (league.slug === "nba") return `https://www.espn.com/nba/player/_/id/${id}`;
  return null;
}

async function fetchBoard(league: WireLeague, day: string): Promise<EspnEvent[]> {
  const data = (await newspaperEspnGet(
    `${league.path}/scoreboard?dates=${yyyymmdd(day)}&limit=300`,
  )) as { events?: EspnEvent[] };
  return data.events ?? [];
}

function favoriteKeysFor(
  favs: SportsFavorite[],
  league: WireLeague,
  awayId: string | undefined,
  homeId: string | undefined,
): string[] {
  const ids = new Set([awayId, homeId].filter(Boolean) as string[]);
  return favs
    .filter((f) => f.kind === "team" && f.espnPath.startsWith(`${league.path}/`))
    .filter((f) => ids.has(f.espnPath.split("/").pop() ?? ""))
    .map((f) => f.key);
}

function toWireGame(
  ev: EspnEvent,
  league: WireLeague,
  day: string,
  favs: SportsFavorite[],
): WireGame | null {
  const id = String(ev.id ?? "");
  const comp = ev.competitions?.[0];
  if (!id || !comp) return null;
  const awayC = comp.competitors?.find((c) => c.homeAway === "away");
  const homeC = comp.competitors?.find((c) => c.homeAway === "home");
  if (!awayC?.team?.id || !homeC?.team?.id) return null;

  const st = comp.status?.type;
  const final = Boolean(st?.completed);
  const live = !final && st?.state === "in";
  const away = side(awayC);
  const home = side(homeC);

  const recap = (comp.headlines ?? []).find((h) => /recap/i.test(h.type ?? "")) ?? comp.headlines?.[0];
  const body = cleanBody(recap?.description);
  const photo = recap?.video?.[0]?.thumbnail ?? comp.highlights?.[0]?.thumbnail ?? null;

  const scoreHead =
    away.score != null && home.score != null
      ? `${away.short} ${away.score}, ${home.short} ${home.score}`
      : `${away.short} at ${home.short}`;
  const headline = recap?.shortLinkText?.trim() || (final ? scoreHead : `${away.short} at ${home.short}`);

  const leaders: RecapLeader[] = (comp.leaders ?? []).flatMap((group) => {
    const top = group.leaders?.[0];
    if (!top?.athlete?.displayName && !top?.athlete?.shortName) return [];
    if (!top.displayValue) return [];
    const shot = top.athlete.headshot;
    return [
      {
        name: top.athlete.shortName || top.athlete.displayName!,
        line: top.displayValue,
        href: playerHrefFor(league, top.athlete.id),
        label: group.shortDisplayName || group.displayName || "Star",
        headshot: typeof shot === "string" ? shot : shot?.href ?? null,
        team: null,
        id: top.athlete.id ?? null,
      },
    ];
  });

  const lineCount = Math.max(awayC.linescores?.length ?? 0, homeC.linescores?.length ?? 0);
  const labels = periodLabelsFor(league.path, lineCount);
  const lines = labels.map((period, i) => ({
    period,
    away: typeof awayC.linescores?.[i]?.value === "number" ? awayC.linescores[i]!.value! : null,
    home: typeof homeC.linescores?.[i]?.value === "number" ? homeC.linescores[i]!.value! : null,
  }));

  return {
    id: `${league.slug}-${id}`,
    eventId: id,
    path: league.path,
    league: league.league,
    sportLabel: league.league,
    round: comp.notes?.find((n) => n.headline)?.headline?.trim() ?? null,
    series: comp.series?.summary?.trim() ?? null,
    postseason: ev.season?.type === 3,
    preseason: ev.season?.type === 1,
    final,
    live,
    statusDetail: st?.detail ?? st?.description ?? (final ? "Final" : "Scheduled"),
    startedAt: comp.date ?? ev.date ?? null,
    day,
    away,
    home,
    headline,
    body,
    dateline: null,
    photo,
    href: league.gameHref?.(id) ?? `https://www.espn.com/${league.slug}/game/_/gameId/${id}`,
    leaders,
    favoriteKeys: favoriteKeysFor(favs, league, awayC.team.id, homeC.team.id),
    wrapKind: hasEspnRecap(body) ? "espn" : null,
    lines,
    next: null,
    sec: isNewspaperSecGame(league.path, awayC.team.id, homeC.team.id),
    venue: null,
    photoWidth: null,
    recapGame: recapPackFromWire({
      path: league.path,
      league: league.league,
      venue: null,
      status: st?.detail ?? st?.description ?? (final ? "Final" : "Scheduled"),
      final,
      live,
      lines,
      away,
      home,
      leaders,
    }),
  };
}

function recapSideFromWire(side: WireSide, lines: (number | null)[]): RecapSide {
  return {
    id: side.id,
    name: side.name,
    short: side.short,
    abbrev: side.abbrev,
    logo: side.logo,
    color: side.color,
    score: side.score,
    record: side.record,
    winner: side.winner,
    hits: side.hits ?? null,
    errors: side.errors ?? null,
    lines,
  };
}

function recapPackFromWire(opts: {
  path: string;
  league: string;
  venue: string | null;
  status: string;
  final: boolean;
  live: boolean;
  lines: BoxWrapLine[];
  away: WireSide;
  home: WireSide;
  leaders: RecapLeader[];
}): RecapGamePack {
  return packFromSides({
    path: opts.path,
    league: opts.league,
    venue: opts.venue,
    status: opts.status,
    final: opts.final,
    live: opts.live,
    periods: opts.lines.map((l) => l.period),
    away: recapSideFromWire(opts.away, opts.lines.map((l) => l.away)),
    home: recapSideFromWire(opts.home, opts.lines.map((l) => l.home)),
    leaders: opts.leaders,
  });
}

/**
 * Rank the wire the way a desk would: your clubs first, then the bracket, then
 * finished games over games still to come, then whichever has the most copy to
 * set. Re-run it after enrichment so a filled-out story can claim the lead.
 *
 * Exhibitions drop behind even tonight's slate: a preseason box with no recap
 * attached is a result nobody needs to read about.
 */
export function deskOrder(a: WireGame, b: WireGame): number {
  const score = (g: WireGame) =>
    (g.favoriteKeys.length ? 4000 : 0) +
    (g.postseason ? 2000 : 0) +
    (g.final ? 1000 : g.live ? 600 : 300) +
    (g.photo ? 120 : 0) +
    Math.min(400, Math.floor((g.body?.length ?? 0) / 10)) -
    (g.preseason ? 2500 : 0);
  const diff = score(b) - score(a);
  if (diff) return diff;
  return String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? ""));
}

export type NewspaperWire = {
  games: WireGame[];
  /** Leagues currently in their postseason, by league label. */
  postseasonLeagues: string[];
};

export type WireLeagueTally = {
  league: string;
  games: number;
  finals: number;
  wraps: number;
  espnWraps: number;
  boxWraps: number;
};

export function tallyWireGames(games: WireGame[]): WireLeagueTally[] {
  const by = new Map<string, WireLeagueTally>();
  for (const g of games) {
    const row = by.get(g.league) ?? {
      league: g.league,
      games: 0,
      finals: 0,
      wraps: 0,
      espnWraps: 0,
      boxWraps: 0,
    };
    row.games += 1;
    if (g.final) row.finals += 1;
    if (g.final && (g.body?.length ?? 0) >= 60) {
      row.wraps += 1;
      if (g.wrapKind === "box") row.boxWraps += 1;
      else row.espnWraps += 1;
    }
    by.set(g.league, row);
  }
  return [...by.values()].sort((a, b) => a.league.localeCompare(b.league));
}

/** How many games the desk pulled, and how many of those have wrap copy. */
export function logWireFiling(label: string, games: WireGame[]): WireLeagueTally[] {
  const rows = tallyWireGames(games);
  const line = rows.map((r) => `${r.league} games=${r.games} finals=${r.finals} wraps=${r.wraps}`).join(" · ");
  console.info(`[times-wire] ${label}${line ? ` ${line}` : " (empty)"}`);
  return rows;
}

function keepWireGame(game: WireGame): boolean {
  if (game.league !== "CFB") return true;
  return isNewspaperCfbDeskGame({
    awayId: game.away.id,
    homeId: game.home.id,
    awayRank: game.away.seed ? Number(game.away.seed.replace(/\D/g, "")) : null,
    homeRank: game.home.seed ? Number(game.home.seed.replace(/\D/g, "")) : null,
    favorite: game.favoriteKeys.length > 0,
  });
}

/**
 * Pull the edition's boards: its own date plus each league's lookback window, so
 * late finals and the night this edition covers. Older slates stay in yesterday's paper.
 */
export async function fetchNewspaperWire(opts: {
  favs: SportsFavorite[];
  day: string;
  pressId?: string;
}): Promise<NewspaperWire> {
  const leagues = wireLeaguesForFavorites(opts.favs);
  const byId = new Map<string, WireGame>();
  const postseason = new Set<string>();

  const boards = leagues.flatMap((league) =>
    wireBoardDays(opts.day, opts.pressId, league.path).map((day) => ({ league, day })),
  );
  let boardNext = 0;
  const pullBoard = async () => {
    while (boardNext < boards.length) {
      const { league, day } = boards[boardNext++]!;
      try {
        const events = await fetchBoard(league, day);
        for (const ev of events) {
          const game = toWireGame(ev, league, day, opts.favs);
          if (!game || !keepWireGame(game)) continue;
          if (game.postseason) postseason.add(game.league);
          // A later board wins only when it carries more: the same game shows
          // up on both days around midnight, and the newer copy has the recap.
          const prior = byId.get(game.id);
          if (!prior || (!prior.body && game.body) || (!prior.final && game.final)) {
            byId.set(game.id, game);
          }
        }
      } catch {
        /* one board failing shouldn't kill the edition */
      }
    }
  };
  await Promise.all([pullBoard(), pullBoard(), pullBoard()]);

  const games = [...byId.values()].sort(deskOrder);
  logWireFiling("boards", games);
  return {
    games,
    postseasonLeagues: [...postseason],
  };
}

function stripStoryHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * ESPN files copy as "ATLANTA -- — Austin Riley hit...". Split the city off so
 * the page can set it in small caps the way a wire story prints.
 */
function splitDateline(text: string): { dateline: string | null; body: string } {
  // Wire datelines are set in caps: "MIAMI GARDENS, FLA. -- — Kenneth Walker…".
  const m =
    /^([A-Z][A-Z.'’]*(?:[ -][A-Z][A-Z.'’]*){0,3}(?:,\s*[A-Z][A-Za-z.]{1,12})?)\s*(?:--+|—|–)\s*(?:[—–-]+\s*)?/.exec(
      text,
    );
  if (!m) return { dateline: null, body: text };
  return { dateline: m[1]!.trim(), body: text.slice(m[0].length).trim() };
}

function leadersWithHref(path: string, rows: ReturnType<typeof leadersFromSummary>, existing: RecapLeader[]): RecapLeader[] {
  if (existing.length) return existing;
  const league = LEAGUES.find((l) => l.path === path);
  return rows.map((l) => ({
    name: l.name,
    line: l.line,
    href: playerHrefFor(league ?? { slug: path.split("/").pop() ?? "" } as WireLeague, l.id ?? undefined),
    label: l.label || "Star",
    headshot: l.headshot ?? null,
    team: l.team ?? null,
    id: l.id ?? null,
  }));
}

function applySummaryChrome(g: WireGame, sum: EspnSummaryForWrap | null): Partial<WireGame> {
  const leaders = leadersWithHref(g.path, leadersFromSummary(sum), g.leaders);
  const lines = g.lines?.length ? g.lines : linesFromSummary(g.path, sum);
  const venue = g.venue ?? summaryVenue(sum);
  const photoWidth = g.photoWidth ?? summaryImageWidth(sum);
  const away = applySummarySide(g.away, sum, "away");
  const home = applySummarySide(g.home, sum, "home");
  return {
    leaders,
    lines,
    venue,
    photoWidth,
    away,
    home,
    recapGame: recapPackFromWire({
      path: g.path,
      league: g.league,
      venue,
      status: g.statusDetail,
      final: g.final,
      live: g.live,
      lines,
      away,
      home,
      leaders,
    }),
  };
}

function applySummarySide(side: WireSide, sum: EspnSummaryForWrap | null, which: "away" | "home"): WireSide {
  const raw = sum?.header?.competitions?.[0]?.competitors?.find((c) => c.homeAway === which);
  if (!raw) return side;
  const color = side.color || (raw.team?.color ? `#${raw.team.color}` : null);
  const logo = side.logo || raw.team?.logo || raw.team?.logos?.[0]?.href || null;
  const hits = side.hits ?? (raw.hits != null ? String(raw.hits) : null);
  const errors = side.errors ?? (raw.errors != null ? String(raw.errors) : null);
  return { ...side, color, logo, hits, errors };
}

function applyBoxWrap(g: WireGame, sum: EspnSummaryForWrap | null): WireGame {
  const chrome = applySummaryChrome(g, sum);
  const leaders = chrome.leaders ?? g.leaders;
  const lines = chrome.lines ?? g.lines ?? [];
  const next = g.next ?? nextFromSummary(sum);
  const { body, wrapKind } = writeBoxWrap({
    league: g.league,
    path: g.path,
    preseason: g.preseason,
    postseason: g.postseason,
    round: g.round,
    statusDetail: g.statusDetail,
    away: chrome.away ?? g.away,
    home: chrome.home ?? g.home,
    leaders,
    lines,
    next,
  });
  return {
    ...g,
    ...chrome,
    body,
    wrapKind,
    next,
    dateline: g.dateline,
  };
}

/** Fill in ESPN recap prose, or a Times box wrap when that copy is missing. */
export async function enrichWireStories(
  games: WireGame[],
  limit: number,
): Promise<WireGame[]> {
  const targets = games.filter((g) => g.final).slice(0, limit);
  const wanted = new Set(targets.map((g) => g.id));

  const filled = new Map<string, WireGame>();
  const summaries = new Map<string, EspnSummaryForWrap | null>();
  let storyNext = 0;
  const pullStory = async () => {
    while (storyNext < targets.length) {
      const g = targets[storyNext++]!;
      try {
        const sum = (await newspaperEspnGet(`${g.path}/summary?event=${g.eventId}`)) as EspnSummaryForWrap;
        summaries.set(g.id, sum);
        const story = stripStoryHtml(sum.article?.story ?? "");
        if (!hasEspnRecap(story)) continue;
        const { dateline, body } = splitDateline(story);
        const chrome = applySummaryChrome(g, sum);
        filled.set(g.id, {
          ...g,
          ...chrome,
          body,
          dateline,
          photo: g.photo ?? sum.article?.images?.[0]?.url ?? null,
          wrapKind: "espn",
          next: nextFromSummary(sum) ?? g.next,
        });
      } catch {
        summaries.set(g.id, null);
      }
    }
  };
  await Promise.all([pullStory(), pullStory(), pullStory()]);
  const merged = games.map((g) => {
    if (!wanted.has(g.id)) return g;
    return filled.get(g.id) ?? applyBoxWrap(g, summaries.get(g.id) ?? null);
  });
  logWireFiling("summaries", merged);

  return merged.sort(deskOrder);
}

type MlbSlateSide = {
  name: string;
  abbrev: string;
  teamId?: number | null;
  score?: number | string | null;
  record: string | null;
  probablePitcher: string | null;
};

function mlbSlateSide(side: MlbSlateSide) {
  return {
    name: side.name,
    abbrev: side.abbrev,
    logo: side.teamId ? `https://www.mlbstatic.com/team-logos/${side.teamId}.svg` : null,
    score: side.score != null ? String(side.score) : null,
    record: side.record,
    pitcher: side.probablePitcher,
  };
}

function slateFromMlb(
  game: {
    id: string;
    whenShort?: string | null;
    when: string | null;
    live: boolean;
    inning?: string | null;
    status: string;
    final: boolean;
    venue: string | null;
    away: MlbSlateSide;
    home: MlbSlateSide;
  },
  day: string,
): LeagueSlateGame {
  return {
    id: `mlb-${game.id}`,
    path: "baseball/mlb",
    day,
    when: game.whenShort || game.when,
    status: game.live ? game.inning || "Live" : game.status,
    final: game.final,
    live: game.live,
    venue: game.venue,
    round: null,
    href: `/sports/mlb/game/${game.id}`,
    away: mlbSlateSide(game.away),
    home: mlbSlateSide(game.home),
  };
}

async function slateFromEspn(path: string, day: string): Promise<LeagueSlateGame[]> {
  const ymd = day.replace(/-/g, "");
  let data: {
    events?: {
      id?: string;
      date?: string;
      competitions?: {
        date?: string;
        venue?: { fullName?: string };
        notes?: { headline?: string }[];
        status?: { type?: { completed?: boolean; state?: string; detail?: string; shortDetail?: string } };
        competitors?: {
          homeAway?: string;
          score?: string;
          records?: { type?: string; summary?: string }[];
          team?: {
            id?: string;
            displayName?: string;
            shortDisplayName?: string;
            abbreviation?: string;
            logo?: string;
          };
          probables?: { athlete?: { displayName?: string; shortName?: string } }[];
        }[];
      }[];
    }[];
  };
  try {
    data = (await newspaperEspnGet(`${path}/scoreboard?dates=${ymd}&limit=300`)) as typeof data;
  } catch {
    return [];
  }
  const out: LeagueSlateGame[] = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    const awayC = comp?.competitors?.find((c) => c.homeAway === "away");
    const homeC = comp?.competitors?.find((c) => c.homeAway === "home");
    if (!awayC?.team || !homeC?.team) continue;
    const st = comp?.status?.type;
    const final = Boolean(st?.completed);
    const live = !final && st?.state === "in";
    const side = (c: NonNullable<typeof awayC>) => ({
      name: c.team?.displayName || c.team?.shortDisplayName || "—",
      abbrev: c.team?.abbreviation || "—",
      logo: c.team?.logo || espnTeamLogo(path, c.team?.id),
      score: c.score ?? null,
      record: c.records?.find((r) => r.type === "total")?.summary ?? null,
      pitcher: c.probables?.[0]?.athlete?.shortName || c.probables?.[0]?.athlete?.displayName || null,
    });
    const when = (() => {
      const iso = comp?.date || ev.date;
      if (!iso) return null;
      try {
        if (!path.startsWith("soccer/") || final || live) {
          return new Date(iso).toLocaleTimeString("en-US", {
            timeZone: "America/Chicago",
            hour: "numeric",
            minute: "2-digit",
          });
        }
        return formatFixtureWhen(iso) || null;
      } catch {
        return null;
      }
    })();
    out.push({
      id: `${path}-${ev.id}`,
      path,
      day,
      when: final || live ? null : when,
      status: st?.shortDetail || st?.detail || (final ? "Final" : "Scheduled"),
      final,
      live,
      venue: comp?.venue?.fullName ?? null,
      round: comp?.notes?.find((n) => n.headline)?.headline ?? null,
      href: null,
      away: side(awayC),
      home: side(homeC),
    });
  }
  return out;
}

/**
 * League-wide slate for a sport section schedule page: today's (and last night's)
 * board with probable pitchers when the feed carries them.
 */
export async function fetchLeagueSlate(path: string, edition: string): Promise<LeagueSlateGame[]> {
  const days = [...new Set([edition, editionNewsDay(edition)])];
  const seen = new Set<string>();
  const out: LeagueSlateGame[] = [];
  for (const day of days) {
    try {
      if (path === "baseball/mlb") {
        const { fetchMlbScoreboard } = await import("./mlb");
        const board = await fetchMlbScoreboard(day);
        for (const g of board) {
          const row = slateFromMlb(g, day);
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          out.push(row);
        }
      } else {
        for (const row of await slateFromEspn(path, day)) {
          if (seen.has(row.id)) continue;
          const pair = `${row.day}|${[row.away.abbrev, row.home.abbrev].sort().join("-")}|${row.when ?? ""}`;
          if (seen.has(pair)) continue;
          seen.add(row.id);
          seen.add(pair);
          out.push(row);
        }
      }
    } catch {
      /* one day missing shouldn't blank the desk */
    }
  }
  return out.sort((a, b) => {
    const rank = (g: LeagueSlateGame) => (g.live ? 0 : g.final ? 2 : 1);
    const by = rank(a) - rank(b);
    if (by) return by;
    return String(a.when ?? "").localeCompare(String(b.when ?? ""));
  });
}
