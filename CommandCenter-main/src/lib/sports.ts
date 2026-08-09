import { supabase } from "./supabase";

/** A favorite franchise or tour the dashboard can show. */
export type SportsFavorite = {
  key: string;
  name: string;
  shortName: string;
  sport: string;
  league: string;
  /** ESPN path under /apis/site/v2/sports/ — team id or scoreboard. */
  espnPath: string;
  kind: "team" | "tour";
  /** Hex without #, from the franchise when known. */
  color?: string;
};

export type SportsLayout = {
  /** Favorite keys in display order. */
  order: string[];
  /** Keys the user hid from the board. */
  hidden: string[];
  /** Optional player pins for later expansion. */
  pinnedPlayers: { id: string; name: string; teamKey: string }[];
};

export type TeamSnapshot = {
  key: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string | null;
  color: string | null;
  record: string | null;
  standing: string | null;
  nextGame: GameChip | null;
  lastGame: GameChip | null;
};

export type GameChip = {
  label: string;
  detail: string | null;
  when: string | null;
  won: boolean | null;
};

export type TourSnapshot = {
  key: string;
  name: string;
  eventName: string | null;
  status: string | null;
  leaders: { name: string; score: string; detail: string | null }[];
};

const LAYOUT_KEY = "sports-layout-v1";

/** Default board — your teams, front of the store. */
export const DEFAULT_FAVORITES: SportsFavorite[] = [
  {
    key: "mlb-stl",
    name: "St. Louis Cardinals",
    shortName: "Cardinals",
    sport: "Baseball",
    league: "MLB",
    espnPath: "baseball/mlb/teams/24",
    kind: "team",
    color: "be0a14",
  },
  {
    key: "nhl-stl",
    name: "St. Louis Blues",
    shortName: "Blues",
    sport: "Hockey",
    league: "NHL",
    espnPath: "hockey/nhl/teams/19",
    kind: "team",
    color: "002f87",
  },
  {
    key: "cfb-mizzou",
    name: "Mizzou Football",
    shortName: "Mizzou FB",
    sport: "Football",
    league: "NCAA",
    espnPath: "football/college-football/teams/142",
    kind: "team",
    color: "f1b82d",
  },
  {
    key: "cbb-mizzou",
    name: "Mizzou Basketball",
    shortName: "Mizzou BB",
    sport: "Basketball",
    league: "NCAA",
    espnPath: "basketball/mens-college-basketball/teams/142",
    kind: "team",
    color: "f1b82d",
  },
  {
    key: "nfl-det",
    name: "Detroit Lions",
    shortName: "Lions",
    sport: "Football",
    league: "NFL",
    espnPath: "football/nfl/teams/8",
    kind: "team",
    color: "0076b6",
  },
  {
    key: "nfl-kc",
    name: "Kansas City Chiefs",
    shortName: "Chiefs",
    sport: "Football",
    league: "NFL",
    espnPath: "football/nfl/teams/12",
    kind: "team",
    color: "e31837",
  },
  {
    key: "eng-wrexham",
    name: "Wrexham",
    shortName: "Wrexham",
    sport: "Soccer",
    league: "EFL Championship",
    espnPath: "soccer/eng.2/teams/352",
    kind: "team",
    color: "c8102e",
  },
  {
    key: "eng-wolves",
    name: "Wolverhampton",
    shortName: "Wolves",
    sport: "Soccer",
    league: "Premier League",
    espnPath: "soccer/eng.1/teams/380",
    kind: "team",
    color: "fdb913",
  },
  {
    key: "eng-arsenal",
    name: "Arsenal",
    shortName: "Arsenal",
    sport: "Soccer",
    league: "Premier League",
    espnPath: "soccer/eng.1/teams/359",
    kind: "team",
    color: "ef0107",
  },
  {
    key: "pga-tour",
    name: "PGA Tour",
    shortName: "PGA",
    sport: "Golf",
    league: "PGA Tour",
    espnPath: "golf/pga/scoreboard",
    kind: "tour",
    color: "024731",
  },
];

export function loadSportsLayout(): SportsLayout {
  const defaults: SportsLayout = {
    order: DEFAULT_FAVORITES.map((f) => f.key),
    hidden: [],
    pinnedPlayers: [],
  };
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SportsLayout>;
    const known = new Set(DEFAULT_FAVORITES.map((f) => f.key));
    const order = (parsed.order ?? defaults.order).filter((k) => known.has(k));
    for (const k of defaults.order) if (!order.includes(k)) order.push(k);
    return {
      order,
      hidden: (parsed.hidden ?? []).filter((k) => known.has(k)),
      pinnedPlayers: Array.isArray(parsed.pinnedPlayers) ? parsed.pinnedPlayers : [],
    };
  } catch {
    return defaults;
  }
}

export function saveSportsLayout(layout: SportsLayout): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

export function visibleFavorites(layout: SportsLayout): SportsFavorite[] {
  const byKey = new Map(DEFAULT_FAVORITES.map((f) => [f.key, f]));
  const hidden = new Set(layout.hidden);
  return layout.order
    .map((k) => byKey.get(k))
    .filter((f): f is SportsFavorite => f != null && !hidden.has(f.key));
}

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

/**
 * ESPN allows browser CORS (`Access-Control-Allow-Origin: *`) but blocks many
 * server/edge User-Agents with 403. Fetch from the client first; only fall
 * back to the sports edge proxy if the direct call fails.
 */
async function espnGet(path: string): Promise<unknown> {
  const clean = path.replace(/^\/+/, "");
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(`${ESPN}/${clean}`, {
      signal: ctl.signal,
      headers: { Accept: "application/json" },
    }).finally(() => window.clearTimeout(t));
    if (res.ok) return await res.json();
  } catch {
    // fall through to edge proxy
  }

  const { data, error } = await supabase.functions.invoke("sports", {
    body: { path: clean },
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data;
}

function pickLogo(logos: { href?: string; rel?: string[] }[] | undefined): string | null {
  if (!Array.isArray(logos) || logos.length === 0) return null;
  const full = logos.find((l) => l.rel?.includes("full"));
  return (full ?? logos[0])?.href ?? null;
}

function fmtWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function competitionChip(
  comp: {
    competitors?: {
      homeAway?: string;
      score?: string;
      winner?: boolean;
      team?: { abbreviation?: string; displayName?: string; id?: string };
    }[];
    status?: { type?: { state?: string; completed?: boolean; shortDetail?: string; detail?: string } };
  } | null,
  myId: string,
): GameChip | null {
  if (!comp?.competitors?.length) return null;
  const mine = comp.competitors.find((c) => String(c.team?.id) === String(myId));
  const opp = comp.competitors.find((c) => String(c.team?.id) !== String(myId));
  if (!mine || !opp) return null;
  const ha = mine.homeAway === "home" ? "vs" : "@";
  const oppName = opp.team?.abbreviation || opp.team?.displayName || "OPP";
  const state = comp.status?.type?.state;
  const done = comp.status?.type?.completed || state === "post";
  if (done) {
    const ms = mine.score ?? "";
    const os = opp.score ?? "";
    return {
      label: `${ha} ${oppName}`,
      detail: `${ms}–${os}`,
      when: comp.status?.type?.shortDetail ?? null,
      won: typeof mine.winner === "boolean" ? mine.winner : null,
    };
  }
  return {
    label: `${ha} ${oppName}`,
    detail: comp.status?.type?.shortDetail ?? comp.status?.type?.detail ?? null,
    when: null,
    won: null,
  };
}

export async function fetchTeamSnapshot(fav: SportsFavorite): Promise<TeamSnapshot> {
  const teamId = fav.espnPath.split("/").pop() ?? "";
  const raw = (await espnGet(fav.espnPath)) as {
    team?: {
      id?: string;
      displayName?: string;
      shortDisplayName?: string;
      abbreviation?: string;
      color?: string;
      logos?: { href?: string; rel?: string[] }[];
      record?: { items?: { summary?: string; description?: string; type?: string }[] };
      standingSummary?: string;
      nextEvent?: {
        name?: string;
        date?: string;
        competitions?: Parameters<typeof competitionChip>[0][];
      }[];
    };
  };

  const t = raw.team ?? {};
  const records = t.record?.items ?? [];
  const overall =
    records.find((r) => r.type === "total" || /overall/i.test(r.description ?? "")) ?? records[0];

  let nextGame: GameChip | null = null;
  const next = t.nextEvent?.[0];
  if (next?.competitions?.[0]) {
    nextGame = competitionChip(next.competitions[0], teamId);
    if (nextGame) nextGame.when = fmtWhen(next.date) ?? nextGame.when;
  }

  // Recent result from schedule (last completed).
  let lastGame: GameChip | null = null;
  try {
    const sched = (await espnGet(`${fav.espnPath}/schedule`)) as {
      events?: {
        date?: string;
        competitions?: Parameters<typeof competitionChip>[0][];
      }[];
    };
    const events = [...(sched.events ?? [])].reverse();
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp?.status?.type?.completed && comp?.status?.type?.state !== "post") continue;
      lastGame = competitionChip(comp, teamId);
      if (lastGame) {
        lastGame.when = fmtWhen(ev.date) ?? lastGame.when;
        break;
      }
    }
  } catch {
    // schedule is optional
  }

  return {
    key: fav.key,
    name: t.displayName ?? fav.name,
    shortName: t.shortDisplayName ?? fav.shortName,
    abbreviation: t.abbreviation ?? "",
    logo: pickLogo(t.logos),
    color: t.color ?? fav.color ?? null,
    record: overall?.summary ?? null,
    standing: t.standingSummary ?? null,
    nextGame,
    lastGame,
  };
}

export async function fetchTourSnapshot(fav: SportsFavorite): Promise<TourSnapshot> {
  const raw = (await espnGet(fav.espnPath)) as {
    events?: {
      name?: string;
      status?: string;
      competitions?: {
        status?: { type?: { description?: string; detail?: string } };
        competitors?: {
          athlete?: { displayName?: string };
          score?: string;
          linescores?: { value?: number }[];
          status?: { type?: { description?: string } };
        }[];
      }[];
    }[];
  };

  const event = raw.events?.[0];
  const comp = event?.competitions?.[0];
  const leaders = (comp?.competitors ?? []).slice(0, 5).map((c) => ({
    name: c.athlete?.displayName ?? "—",
    score: c.score ?? "—",
    detail: c.status?.type?.description ?? null,
  }));

  return {
    key: fav.key,
    name: fav.name,
    eventName: event?.name ?? null,
    status: comp?.status?.type?.detail ?? comp?.status?.type?.description ?? event?.status ?? null,
    leaders,
  };
}

/** Seed the favorites table so the board has a durable home in Supabase. */
export async function ensureFavoriteTeamsSeeded(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("favorite_sports_teams")
    .select("id, team_name")
    .eq("user_id", userId);
  if (error) throw error;
  const have = new Set((data ?? []).map((r) => r.team_name.toLowerCase()));
  const missing = DEFAULT_FAVORITES.filter((f) => f.kind === "team" && !have.has(f.name.toLowerCase()));
  if (missing.length === 0) return;
  const { error: insErr } = await supabase.from("favorite_sports_teams").insert(
    missing.map((f) => ({
      user_id: userId,
      team_name: f.name,
      league: f.league,
      sport: f.sport,
    })),
  );
  if (insErr) throw insErr;
}
