/** A club's first regular-season game, for clubs whose season hasn't started. */

export type OpenerGame = {
  iso: string;
  /** False when the league has a date but no first pitch / tip time yet. */
  timeValid: boolean;
  home: boolean;
  opponent: string;
  opponentShort: string;
  opponentLogo: string | null;
  venue: string | null;
};

export type Opener = OpenerGame & {
  key: string;
  /** "Opening Day", "Season opener", "Opening Night". */
  billing: string;
  /** The opener and the games right behind it. */
  slate: OpenerGame[];
};

const ESPN_WEB = "https://site.web.api.espn.com/apis/site/v2/sports";
const MLB = "https://statsapi.mlb.com/api/v1";
const SLATE = 10;

type EspnTeam = {
  id?: string;
  displayName?: string;
  shortDisplayName?: string;
  location?: string;
  logo?: string;
  logos?: { href?: string }[];
};
type EspnEvent = {
  date?: string;
  timeValid?: boolean;
  competitions?: {
    timeValid?: boolean;
    venue?: { fullName?: string };
    status?: { type?: { state?: string } };
    competitors?: { homeAway?: string; team?: EspnTeam }[];
  }[];
};

function billingFor(path: string): string {
  if (path.startsWith("baseball/")) return "Opening Day";
  if (path.startsWith("basketball/")) return "Opening Night";
  if (path.startsWith("hockey/")) return "Opening Night";
  return "Season opener";
}

function espnGame(event: EspnEvent, teamId: string): OpenerGame | null {
  const comp = event.competitions?.[0];
  const mine = comp?.competitors?.find((c) => String(c.team?.id) === String(teamId));
  const opp = comp?.competitors?.find((c) => String(c.team?.id) !== String(teamId));
  if (!event.date || !mine || !opp) return null;
  const t = opp.team ?? {};
  return {
    iso: event.date,
    timeValid: comp?.timeValid ?? event.timeValid ?? true,
    home: mine.homeAway === "home",
    opponent: t.displayName ?? t.shortDisplayName ?? "TBD",
    opponentShort: t.shortDisplayName ?? t.location ?? t.displayName ?? "TBD",
    opponentLogo: t.logos?.[0]?.href ?? t.logo ?? null,
    venue: comp?.venue?.fullName ?? null,
  };
}

/** The first event on a regular-season schedule, when it's still ahead. */
export function espnOpener(key: string, path: string, teamId: string, events: EspnEvent[], now = Date.now()): Opener | null {
  const sorted = [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!sorted[0]?.date || new Date(sorted[0].date).getTime() < now - 6 * 3_600_000) return null;
  const slate = sorted
    .slice(0, SLATE)
    .map((e) => espnGame(e, teamId))
    .filter((g): g is OpenerGame => Boolean(g));
  const first = slate[0];
  if (!first) return null;
  return { ...first, key, billing: billingFor(path), slate };
}

type MlbGame = {
  gameDate?: string;
  status?: { startTimeTBD?: boolean };
  venue?: { name?: string };
  teams?: {
    away?: { team?: { id?: number; name?: string; teamName?: string } };
    home?: { team?: { id?: number; name?: string; teamName?: string } };
  };
};

function mlbGame(game: MlbGame, mlbTeamId: number): OpenerGame {
  const home = game.teams?.home?.team?.id === mlbTeamId;
  const opp = (home ? game.teams?.away : game.teams?.home)?.team;
  return {
    iso: game.gameDate ?? "",
    timeValid: !game.status?.startTimeTBD,
    home,
    opponent: opp?.name ?? "TBD",
    opponentShort: opp?.teamName ?? opp?.name ?? "TBD",
    opponentLogo: opp?.id ? `https://www.mlbstatic.com/team-logos/${opp.id}.svg` : null,
    venue: game.venue?.name ?? null,
  };
}

export function mlbOpener(key: string, mlbTeamId: number, games: MlbGame[], now = Date.now()): Opener | null {
  const ahead = [...games]
    .filter((g) => g.gameDate && new Date(g.gameDate).getTime() > now - 6 * 3_600_000)
    .sort((a, b) => String(a.gameDate).localeCompare(String(b.gameDate)));
  if (!ahead[0]) return null;
  const slate = ahead.slice(0, SLATE).map((g) => mlbGame(g, mlbTeamId));
  return { ...slate[0]!, key, billing: "Opening Day", slate };
}

/**
 * Leagues park a date-only game at midnight Eastern, which reads as the night
 * before in Central — so untimed games keep their Eastern calendar day.
 */
function zoneFor(timeValid: boolean): string {
  return timeValid ? "America/Chicago" : "America/New_York";
}

/** Whole days from now to the opener's calendar date, in Central time. */
export function daysUntil(iso: string, now = Date.now(), timeValid = true): number {
  const day = (t: number, zone: string) => {
    const s = new Date(t).toLocaleDateString("en-CA", { timeZone: zone });
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return Math.round(day(new Date(iso).getTime(), zoneFor(timeValid)) - day(now, "America/Chicago"));
}

export function openerDay(o: Pick<OpenerGame, "iso" | "timeValid">): string {
  return new Date(o.iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: zoneFor(o.timeValid),
  });
}

export function openerTime(o: Pick<OpenerGame, "iso" | "timeValid">): string {
  if (!o.timeValid) return "TBA";
  return `${new Date(o.iso)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
    .replace(":00 ", " ")} CT`;
}

export function openerDate(o: Pick<OpenerGame, "iso" | "timeValid">): string {
  return o.timeValid ? `${openerDay(o)} · ${openerTime(o)}` : openerDay(o);
}

export function openerMatchup(o: Pick<OpenerGame, "home" | "opponentShort">): string {
  return `${o.home ? "vs" : "at"} ${o.opponentShort}`;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function fetchOpener(fav: {
  key: string;
  espnPath: string;
  mlbTeamId?: number;
}): Promise<Opener | null> {
  if (fav.mlbTeamId) {
    const year = new Date().getFullYear();
    for (const season of [year, year + 1]) {
      const data = (await getJson(
        `${MLB}/schedule?sportId=1&teamId=${fav.mlbTeamId}&season=${season}&gameType=R`,
      ).catch(() => null)) as { dates?: { games?: MlbGame[] }[] } | null;
      const games = (data?.dates ?? []).flatMap((d) => d.games ?? []);
      // An opener only exists before a club's first game of that season.
      const first = games.map((g) => g.gameDate ?? "").sort()[0];
      if (!first || new Date(first).getTime() < Date.now()) continue;
      return mlbOpener(fav.key, fav.mlbTeamId, games);
    }
    return null;
  }
  const m = /^(.+)\/teams\/([^/]+)$/.exec(fav.espnPath);
  if (!m) return null;
  const [, path, teamId] = m as unknown as [string, string, string];
  const data = (await getJson(`${ESPN_WEB}/${path}/teams/${teamId}/schedule?seasontype=2`).catch(() => null)) as {
    events?: EspnEvent[];
  } | null;
  return espnOpener(fav.key, path, teamId, data?.events ?? []);
}
