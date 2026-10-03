/**
 * Today's boards for the push sweep. ESPN scoreboard only — the same feeds
 * the sports app already ranks. Parsing stays here so the heat hook does not
 * import the browser scorers.
 */
import { type PushGame, type PushSide } from "./live-drama.ts";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

type RawTeam = {
  id?: string | number;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  logo?: string;
};

type RawCompetitor = {
  homeAway?: string;
  score?: string | number;
  curatedRank?: { current?: number };
  team?: RawTeam;
};

type RawBroadcast = {
  names?: string[];
  media?: { shortName?: string; name?: string };
};

type RawStatus = {
  period?: number;
  type?: {
    state?: string;
    completed?: boolean;
    shortDetail?: string;
    detail?: string;
  };
};

type RawEvent = {
  id?: string | number;
  date?: string;
  status?: RawStatus;
  competitions?: {
    id?: string | number;
    date?: string;
    status?: RawStatus;
    competitors?: RawCompetitor[];
    geoBroadcasts?: RawBroadcast[];
    broadcasts?: RawBroadcast[];
    situation?: {
      isRedZone?: boolean;
      downDistanceText?: string;
    };
  }[];
};

const BOARDS: { sport: string; path: string; dated: boolean; league?: string }[] = [
  { sport: "mlb", path: "baseball/mlb", dated: true },
  { sport: "nhl", path: "hockey/nhl", dated: true },
  { sport: "soccer", path: "soccer/eng.1", dated: true, league: "Premier League" },
  { sport: "soccer", path: "soccer/eng.2", dated: true },
  { sport: "nfl", path: "football/nfl", dated: false },
  { sport: "cfb", path: "football/college-football", dated: false },
  { sport: "nba", path: "basketball/nba", dated: false },
  { sport: "cbb", path: "basketball/mens-college-basketball", dated: false },
];

export function chicagoYmd(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }).replace(/-/g, "");
}

function chicagoTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Official Top 25 only — ESPN marks unranked teams as curatedRank 99. */
function pollRank(raw: number | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 1 || raw > 25) return null;
  return raw;
}

function broadcastNames(rows: RawBroadcast[] | undefined): string[] {
  const out: string[] = [];
  const push = (name: string | undefined) => {
    const label = (name ?? "").replace(/\s+/g, " ").trim();
    if (!label || label.length > 40) return;
    if (out.some((have) => have.toLowerCase() === label.toLowerCase())) return;
    out.push(label);
  };
  for (const row of rows ?? []) {
    push(row.media?.shortName || row.media?.name);
    for (const name of row.names ?? []) push(name);
  }
  return out.slice(0, 4);
}

function side(raw: RawCompetitor | undefined): PushSide | null {
  const team = raw?.team;
  const id = team?.id != null ? String(team.id) : "";
  if (!id) return null;
  const scoreNum = raw?.score == null || raw.score === "" ? null : Number(raw.score);
  return {
    id,
    abbrev: team?.abbreviation || "—",
    name: team?.shortDisplayName || team?.displayName || team?.abbreviation || "Team",
    score: scoreNum != null && Number.isFinite(scoreNum) ? scoreNum : null,
    logo: team?.logo && /^https?:/i.test(team.logo) ? team.logo : null,
    rank: pollRank(raw?.curatedRank?.current),
  };
}

export function mapEspnEvent(sport: string, event: RawEvent, league?: string | null): PushGame | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;
  const status = comp.status?.type ?? event.status?.type;
  const state = status?.state ?? "";
  const away = side((comp.competitors ?? []).find((c) => c.homeAway === "away"));
  const home = side((comp.competitors ?? []).find((c) => c.homeAway === "home"));
  const id = String(event.id ?? comp.id ?? "");
  if (!id || !away || !home) return null;
  const live = state === "in";
  const final = state === "post" || status?.completed === true;
  const detail = (status?.shortDetail || status?.detail || "").trim();
  return {
    sport,
    id,
    live,
    final,
    detail,
    period: typeof comp.status?.period === "number" ? comp.status.period : null,
    redZone: Boolean(comp.situation?.isRedZone),
    downDistance: comp.situation?.downDistanceText ?? null,
    when: chicagoTime(event.date || comp.date),
    broadcasts: broadcastNames([...(comp.geoBroadcasts ?? []), ...(comp.broadcasts ?? [])]),
    league: league ?? null,
    away,
    home,
  };
}

export async function fetchPushBoards(now = new Date()): Promise<PushGame[]> {
  const ymd = chicagoYmd(now);
  const boards = await Promise.all(
    BOARDS.map(async (board) => {
      const url = `${ESPN}/${board.path}/scoreboard${board.dated ? `?dates=${ymd}` : ""}`;
      try {
        const res = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "CommandCenterSportsPush" },
        });
        if (!res.ok) return [] as PushGame[];
        const raw = (await res.json()) as { events?: RawEvent[] };
        return (raw.events ?? [])
          .map((event) => mapEspnEvent(board.sport, event, board.league ?? null))
          .filter((g): g is PushGame => g != null);
      } catch {
        return [] as PushGame[];
      }
    }),
  );
  const seen = new Set<string>();
  const out: PushGame[] = [];
  for (const game of boards.flat()) {
    const key = `${game.sport}:${game.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(game);
  }
  return out;
}
