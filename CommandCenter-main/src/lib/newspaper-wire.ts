/**
 * League-wide day boards for the Thompson Times.
 *
 * The team-by-team pipeline only ever sees games your clubs played, so October
 * baseball vanishes the moment your club is eliminated. This reads the whole
 * league's board for the edition's news days instead, and keeps ESPN's recap
 * prose, highlight still, series line, and star lines off the same payload.
 */

import { editionNewsDay } from "./newspaper";
import type { SportsFavorite } from "./sports";

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports";

export type WireSide = {
  id: string | null;
  name: string;
  short: string;
  abbrev: string;
  logo: string | null;
  score: string | null;
  winner: boolean;
  record: string | null;
  seed: string | null;
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
  leaders: { name: string; line: string; href: string | null }[];
  favoriteKeys: string[];
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  curatedRank?: { current?: number };
  records?: { type?: string; summary?: string }[];
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
    logos?: { href?: string }[];
  };
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
      leaders?: {
        displayValue?: string;
        athlete?: { id?: string; displayName?: string; shortName?: string };
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
   * How many days back from the edition's news day to scan. One day is the
   * night the paper covers. A later edition does not reprint the weekend.
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
    score: c?.score ?? null,
    winner: Boolean(c?.winner),
    record: overall?.summary ?? null,
    seed: rank && rank > 0 && rank < 99 ? `No. ${rank}` : null,
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
  return null;
}

async function fetchBoard(league: WireLeague, day: string): Promise<EspnEvent[]> {
  const url = `${ESPN_SITE}/${league.path}/scoreboard?dates=${yyyymmdd(day)}&limit=300`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${league.path} board ${res.status}`);
  const data = (await res.json()) as { events?: EspnEvent[] };
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

  const leaders = (comp.leaders ?? [])
    .flatMap((group) => group.leaders ?? [])
    .filter((l) => l.athlete?.displayName && l.displayValue)
    .slice(0, 5)
    .map((l) => ({
      name: l.athlete!.shortName || l.athlete!.displayName!,
      line: l.displayValue!,
      href: playerHrefFor(league, l.athlete?.id),
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
  };
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

function daysBack(from: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(shiftIso(from, -i));
  return out;
}

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Pull the edition's boards: its own date plus each league's lookback window, so
 * late finals and the night this edition covers. Older slates stay in yesterday's paper.
 */
export async function fetchNewspaperWire(opts: {
  favs: SportsFavorite[];
  day: string;
}): Promise<NewspaperWire> {
  const leagues = wireLeaguesForFavorites(opts.favs);
  const byId = new Map<string, WireGame>();
  const postseason = new Set<string>();

  await Promise.all(
    leagues.flatMap((league) =>
      [opts.day, ...daysBack(editionNewsDay(opts.day), league.lookback)].map(async (day) => {
        try {
          const events = await fetchBoard(league, day);
          for (const ev of events) {
            const game = toWireGame(ev, league, day, opts.favs);
            if (!game) continue;
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
      }),
    ),
  );

  return {
    games: [...byId.values()].sort(deskOrder),
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

/** Fill in full ESPN recap prose for the games that will actually run as stories. */
export async function enrichWireStories(
  games: WireGame[],
  limit: number,
): Promise<WireGame[]> {
  const targets = games.filter((g) => g.final).slice(0, limit);
  const wanted = new Set(targets.map((g) => g.id));

  const filled = new Map<string, { body: string; dateline: string | null; photo: string | null }>();
  await Promise.all(
    targets.map(async (g) => {
      try {
        const res = await fetch(`${ESPN_SITE}/${g.path}/summary?event=${g.eventId}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const sum = (await res.json()) as {
          article?: { story?: string; headline?: string; images?: { url?: string }[] };
        };
        const story = stripStoryHtml(sum.article?.story ?? "");
        if (story.length < 200) return;
        const { dateline, body } = splitDateline(story);
        filled.set(g.id, {
          body,
          dateline,
          photo: g.photo ?? sum.article?.images?.[0]?.url ?? null,
        });
      } catch {
        /* keep the short wire body */
      }
    }),
  );

  return games
    .map((g) => {
      if (!wanted.has(g.id)) return g;
      const hit = filled.get(g.id);
      if (!hit) return g;
      return { ...g, body: hit.body, dateline: hit.dateline, photo: hit.photo };
    })
    .sort(deskOrder);
}
