/** College football via ESPN — scoreboard, RUWT, hot seat, player pages. */

import { parseEspnBroadcasts, type GameBroadcast } from "./game-broadcasts";
import { formatSportsDateLong } from "./utils";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/football/college-football";
const CORE =
  "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football";

export function chicagoTodayCfb(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export function cfbTeamLogo(teamId: string | number): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
}

export function cfbHeadshot(playerId: string | number, size = 350): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/college-football/players/full/${playerId}.png&w=${size}&h=${size}`;
}

/** Programs surfaced in RUWT interest + hot seat (FBS focus). */
export const CFB_FOCUS_TEAMS: { id: number; name: string; abbrev: string }[] = [
  { id: 142, name: "Missouri", abbrev: "MIZ" },
  { id: 333, name: "Alabama", abbrev: "ALA" },
  { id: 2, name: "Auburn", abbrev: "AUB" },
  { id: 8, name: "Arkansas", abbrev: "ARK" },
  { id: 57, name: "Florida", abbrev: "FLA" },
  { id: 61, name: "Georgia", abbrev: "UGA" },
  { id: 96, name: "Kentucky", abbrev: "UK" },
  { id: 99, name: "LSU", abbrev: "LSU" },
  { id: 145, name: "Ole Miss", abbrev: "MISS" },
  { id: 201, name: "Mississippi State", abbrev: "MSST" },
  { id: 263, name: "Tennessee", abbrev: "TENN" },
  { id: 245, name: "Texas A&M", abbrev: "TAMU" },
  { id: 228, name: "Texas", abbrev: "TEX" },
  { id: 251, name: "Texas Tech", abbrev: "TTU" },
  { id: 239, name: "Baylor", abbrev: "BAY" },
  { id: 262, name: "Oklahoma", abbrev: "OU" },
  { id: 2305, name: "Kansas State", abbrev: "KSU" },
  { id: 2306, name: "Kansas", abbrev: "KU" },
  { id: 52, name: "Florida State", abbrev: "FSU" },
  { id: 153, name: "North Carolina", abbrev: "UNC" },
  { id: 150, name: "Duke", abbrev: "DUKE" },
  { id: 258, name: "Virginia", abbrev: "UVA" },
  { id: 130, name: "Michigan", abbrev: "MICH" },
  { id: 194, name: "Ohio State", abbrev: "OSU" },
  { id: 213, name: "Penn State", abbrev: "PSU" },
  { id: 77, name: "Northwestern", abbrev: "NW" },
  { id: 356, name: "Illinois", abbrev: "ILL" },
  { id: 275, name: "Wisconsin", abbrev: "WIS" },
  { id: 2294, name: "Iowa", abbrev: "IOWA" },
  { id: 164, name: "Rutgers", abbrev: "RUT" },
  { id: 87, name: "Notre Dame", abbrev: "ND" },
  { id: 2483, name: "Oregon", abbrev: "ORE" },
  { id: 254, name: "Utah", abbrev: "UTAH" },
  { id: 30, name: "USC", abbrev: "USC" },
  { id: 26, name: "UCLA", abbrev: "UCLA" },
  { id: 9, name: "Arizona State", abbrev: "ASU" },
  { id: 12, name: "Arizona", abbrev: "ARIZ" },
  { id: 25, name: "California", abbrev: "CAL" },
  { id: 38, name: "Colorado", abbrev: "COLO" },
  { id: 59, name: "Georgia Tech", abbrev: "GT" },
  { id: 183, name: "Syracuse", abbrev: "SYR" },
  { id: 221, name: "Pitt", abbrev: "PITT" },
  { id: 103, name: "Boston College", abbrev: "BC" },
  { id: 152, name: "NC State", abbrev: "NCST" },
  { id: 154, name: "Wake Forest", abbrev: "WAKE" },
  { id: 2390, name: "Miami", abbrev: "MIA" },
  { id: 97, name: "Louisville", abbrev: "LOU" },
  { id: 235, name: "Memphis", abbrev: "MEM" },
  { id: 242, name: "Boise State", abbrev: "BOIS" },
];

export type CfbScoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  score: number | null;
  record: string | null;
  logo: string | null;
  color: string;
  rank: number | null;
};

export type CfbScoreGame = {
  id: string;
  status: string;
  shortDetail: string | null;
  live: boolean;
  final: boolean;
  away: CfbScoreSide;
  home: CfbScoreSide;
  when: string | null;
  whenShort: string | null;
  venue: string | null;
  date: string | null;
  broadcasts: GameBroadcast[];
};

export type CfbScoredGame = CfbScoreGame & {
  score: number;
  reasons: string[];
};

export type CfbRuwtContext = {
  teamInterest: Record<string, number>;
  watchTeamIds?: Set<string>;
};

export type CfbCoach = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  teamLogo: string | null;
  teamColor: string;
  recordSummary: string | null;
  wins: number;
  losses: number;
  winPct: number | null;
  hotSeatScore: number;
  hotSeatRank: number;
  factors: { label: string; points: number; detail: string }[];
};

export type CfbPlayerProfile = {
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
  classYear: string | null;
  birthPlace: string | null;
  experience: string | null;
  bio: string | null;
  status: string | null;
  seasonStats: { label: string; value: string }[];
  statCategories: { name: string; stats: { label: string; value: string }[] }[];
  recentGames: { label: string; result: string; line: string }[];
  news: { headline: string; description: string; image: string | null; href: string | null }[];
};

function parseScore(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function chicagoDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

type EspnEvent = {
  id?: string;
  date?: string;
  competitions?: {
    venue?: { fullName?: string };
    status?: {
      type?: {
        state?: string;
        completed?: boolean;
        description?: string;
        detail?: string;
        shortDetail?: string;
      };
    };
    broadcasts?: { market?: string; names?: string[] }[];
    geoBroadcasts?: {
      market?: { type?: string };
      media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
    }[];
    competitors?: {
      homeAway?: string;
      score?: unknown;
      curatedRank?: { current?: number };
      records?: { type?: string; summary?: string }[];
      team?: {
        id?: string;
        displayName?: string;
        shortDisplayName?: string;
        abbreviation?: string;
        color?: string;
        logos?: { href?: string }[];
      };
    }[];
  }[];
};

type EspnCompetitor = {
  homeAway?: string;
  score?: unknown;
  curatedRank?: { current?: number };
  records?: { type?: string; summary?: string }[];
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
};

function sideFromCompetitor(c: EspnCompetitor): CfbScoreSide {
  const team = c.team ?? {};
  const abbrev = team.abbreviation ?? "—";
  const overall = (c.records ?? []).find((r) => r.type === "total")?.summary ?? null;
  const rankRaw = c.curatedRank?.current;
  return {
    teamId: Number(team.id) || 0,
    name: team.displayName ?? team.shortDisplayName ?? abbrev,
    abbrev,
    score: parseScore(c.score),
    record: overall,
    logo: team.logos?.[0]?.href ?? cfbTeamLogo(team.id ?? 0),
    color: (team.color ?? "555555").replace(/^#/, ""),
    rank: typeof rankRaw === "number" && rankRaw > 0 ? rankRaw : null,
  };
}

function mapCfbEvent(event: EspnEvent): CfbScoreGame | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;
  const awayC = comp.competitors?.find((c) => c.homeAway === "away");
  const homeC = comp.competitors?.find((c) => c.homeAway === "home");
  if (!awayC?.team?.id || !homeC?.team?.id) return null;
  const st = comp.status?.type;
  const live = st?.state === "in";
  const final = Boolean(st?.completed);
  const iso = event.date ?? null;
  const whenDate = iso ? new Date(iso) : null;
  const whenShort =
    whenDate && !Number.isNaN(whenDate.getTime())
      ? whenDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Chicago",
          timeZoneName: "short",
        })
      : null;
  return {
    id: String(event.id ?? comp.status?.type?.detail ?? Math.random()),
    status: st?.description ?? st?.detail ?? "Scheduled",
    shortDetail: st?.shortDetail ?? st?.detail ?? null,
    live,
    final,
    away: sideFromCompetitor(awayC),
    home: sideFromCompetitor(homeC),
    when: iso ? formatSportsDateLong(iso) : null,
    whenShort,
    venue: comp.venue?.fullName ?? null,
    date: chicagoDateFromIso(iso),
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
  };
}

export async function fetchCfbScoreboard(dates?: string): Promise<CfbScoreGame[]> {
  const url = dates ? `${ESPN}/scoreboard?dates=${dates}` : `${ESPN}/scoreboard`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CFB scoreboard ${res.status}`);
  const raw = (await res.json()) as { events?: EspnEvent[] };
  return (raw.events ?? []).map(mapCfbEvent).filter((g): g is CfbScoreGame => Boolean(g?.id));
}

function scoreCfbRuwtGame(g: CfbScoreGame, ctx?: CfbRuwtContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (g.live) {
    score += 40;
    reasons.push("Live");
  }
  if (!g.final && !g.live) {
    score += 8;
    reasons.push("Upcoming");
  }
  const awayRank = g.away.rank;
  const homeRank = g.home.rank;
  if (awayRank && homeRank && awayRank <= 25 && homeRank <= 25) {
    score += 28;
    reasons.push("Ranked matchup");
  } else if ((awayRank && awayRank <= 25) || (homeRank && homeRank <= 25)) {
    score += 16;
    reasons.push("Ranked team");
  }
  for (const side of [g.away, g.home]) {
    const interest = ctx?.teamInterest[String(side.teamId)] ?? 0;
    if (interest >= 7) {
      score += interest * 3;
      reasons.push(`${side.abbrev} interest ${interest}`);
    }
    if (ctx?.watchTeamIds?.has(String(side.teamId))) {
      score += 12;
      reasons.push(`Watch ${side.abbrev}`);
    }
  }
  if (g.final && Math.abs((g.away.score ?? 0) - (g.home.score ?? 0)) <= 7) {
    score += 10;
    reasons.push("Close final");
  }
  return { score, reasons: [...new Set(reasons)] };
}

export function rankCfbRuwtGames(
  games: CfbScoreGame[],
  ctx?: CfbRuwtContext,
  limit = 24,
): CfbScoredGame[] {
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreCfbRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

async function fetchCoreJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchTeamCoachAndRecord(
  teamId: number,
  season: number,
): Promise<{
  coachId: string;
  coachName: string;
  wins: number;
  losses: number;
  recordSummary: string | null;
  teamName: string;
  teamAbbrev: string;
  teamColor: string;
  teamLogo: string | null;
} | null> {
  const team = await fetchCoreJson<{
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
    record?: { $ref?: string };
    coaches?: { $ref?: string };
  }>(`${CORE}/seasons/${season}/teams/${teamId}?lang=en&region=us`);
  if (!team) return null;

  let wins = 0;
  let losses = 0;
  let recordSummary: string | null = null;
  const recordRef = team.record?.$ref;
  if (recordRef) {
    const rec = await fetchCoreJson<{
      items?: { stats?: { name?: string; value?: number }[]; summary?: string }[];
    }>(recordRef);
    const total = rec?.items?.find((i) => i.summary?.includes("-")) ?? rec?.items?.[0];
    recordSummary = total?.summary ?? null;
    for (const s of total?.stats ?? []) {
      if (s.name === "wins") wins = Number(s.value) || 0;
      if (s.name === "losses") losses = Number(s.value) || 0;
    }
  }

  const coachesRef = team.coaches?.$ref;
  if (!coachesRef) return null;
  const coachList = await fetchCoreJson<{ items?: { $ref?: string }[] }>(coachesRef);
  const coachRef = coachList?.items?.[0]?.$ref;
  if (!coachRef) return null;
  const coach = await fetchCoreJson<{ id?: string; firstName?: string; lastName?: string }>(
    coachRef,
  );
  if (!coach?.id) return null;
  const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ").trim();
  if (!coachName) return null;

  return {
    coachId: String(coach.id),
    coachName,
    wins,
    losses,
    recordSummary,
    teamName: team.displayName ?? "Team",
    teamAbbrev: team.abbreviation ?? "—",
    teamColor: (team.color ?? "333333").replace(/^#/, ""),
    teamLogo: team.logos?.[0]?.href ?? cfbTeamLogo(teamId),
  };
}

/** CFB hot seat — record-driven heat for FBS focus programs (no Kalshi CFB market yet). */
export async function fetchCfbCoaches(): Promise<CfbCoach[]> {
  const season = new Date().getFullYear();
  const queue = CFB_FOCUS_TEAMS.map((t) => t.id);
  const rows: Omit<CfbCoach, "hotSeatRank">[] = [];

  await Promise.all(
    queue.map(async (teamId) => {
      const pack = await fetchTeamCoachAndRecord(teamId, season);
      if (!pack) return;
      const games = pack.wins + pack.losses;
      const winPct = games > 0 ? pack.wins / games : null;
      const factors: CfbCoach["factors"] = [];
      let score = 15;
      if (winPct != null) {
        if (winPct < 0.35) {
          score += 22;
          factors.push({ label: "Record", points: 22, detail: `Win % ${(winPct * 100).toFixed(0)}` });
        } else if (winPct < 0.5) {
          score += 12;
          factors.push({ label: "Record", points: 12, detail: `Win % ${(winPct * 100).toFixed(0)}` });
        } else if (winPct >= 0.75) {
          score -= 8;
          factors.push({ label: "Record", points: -8, detail: `Win % ${(winPct * 100).toFixed(0)}` });
        }
      }
      if (pack.losses >= 4 && games > 0) {
        score += Math.min(12, pack.losses * 2);
        factors.push({
          label: "Losses",
          points: Math.min(12, pack.losses * 2),
          detail: `${pack.losses} losses`,
        });
      }
      rows.push({
        id: pack.coachId,
        name: pack.coachName,
        teamId: String(teamId),
        teamName: pack.teamName,
        teamAbbrev: pack.teamAbbrev,
        teamLogo: pack.teamLogo,
        teamColor: pack.teamColor,
        recordSummary: pack.recordSummary,
        wins: pack.wins,
        losses: pack.losses,
        winPct,
        hotSeatScore: Math.round(score * 10) / 10,
        factors,
      });
    }),
  );

  rows.sort((a, b) => b.hotSeatScore - a.hotSeatScore);
  return rows.map((r, i) => ({ ...r, hotSeatRank: i + 1 }));
}

export async function fetchCfbPlayerProfile(playerId: string): Promise<CfbPlayerProfile> {
  const id = String(playerId);
  const [athleteRes, overviewRes] = await Promise.all([
    fetch(`${ESPN_WEB}/athletes/${id}`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN_WEB}/athletes/${id}/overview`, { headers: { Accept: "application/json" } }),
  ]);
  if (!athleteRes.ok) throw new Error(`CFB player ${athleteRes.status}`);
  const raw = (await athleteRes.json()) as { athlete?: Record<string, unknown> };
  const overview = overviewRes.ok ? ((await overviewRes.json()) as Record<string, unknown>) : {};
  const a = { ...(raw.athlete ?? {}) } as Record<string, unknown>;
  const team = (a.team ?? {}) as {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
  const position = (a.position ?? {}) as { abbreviation?: string; displayName?: string };
  const classYear =
    (a.displayExperience as string | undefined) ||
    (a.experience as { displayValue?: string } | undefined)?.displayValue ||
    null;
  const birthPlace =
    (a.displayBirthPlace as string | undefined)?.trim() ||
    (() => {
      const bp = a.birthPlace as { city?: string; state?: string; country?: string } | undefined;
      return bp ? [bp.city, bp.state?.trim(), bp.country].filter(Boolean).join(", ") : null;
    })();

  const statistics = overview.statistics as
    | {
        labels?: string[];
        categories?: { name?: string; displayName?: string; count?: number }[];
        splits?: { stats?: string[] }[];
      }
    | undefined;
  const labels = statistics?.labels ?? [];
  const values = statistics?.splits?.[0]?.stats ?? [];
  const catsMeta = statistics?.categories ?? [];
  let offset = 0;
  const statCategories: CfbPlayerProfile["statCategories"] = [];
  for (const cat of catsMeta) {
    const count = cat.count ?? 0;
    statCategories.push({
      name: cat.displayName ?? cat.name ?? "Stats",
      stats: labels.slice(offset, offset + count).map((label, i) => ({
        label,
        value: values[offset + i] ?? "—",
      })),
    });
    offset += count;
  }

  const summaryStats = (
    (a.statsSummary as { statistics?: { shortDisplayName?: string; displayValue?: string }[] })
      ?.statistics ?? []
  ).map((s) => ({ label: s.shortDisplayName ?? "Stat", value: s.displayValue ?? "—" }));

  const gameLog = overview.gameLog as
    | {
        events?: {
          week?: number;
          opponent?: { displayName?: string; abbreviation?: string };
          stats?: string[];
        }[];
      }
    | undefined;

  const newsRaw = overview.news as
    | { headline?: string; description?: string; images?: { url?: string }[]; links?: { href?: string }[] }[]
    | undefined;

  return {
    id,
    name: String(a.displayName ?? a.fullName ?? "Player"),
    number: a.jersey != null ? String(a.jersey) : null,
    position: position.abbreviation ?? null,
    positionName: position.displayName ?? null,
    teamId: team.id ?? null,
    teamName: team.displayName ?? null,
    teamAbbrev: team.abbreviation ?? null,
    teamColor: (team.color ?? "d9515c").replace(/^#/, ""),
    teamLogo: team.logos?.[0]?.href ?? (team.id ? cfbTeamLogo(team.id) : null),
    headshot: cfbHeadshot(id),
    height: (a.displayHeight as string | undefined) ?? null,
    weight: a.displayWeight != null ? String(a.displayWeight) : null,
    age: typeof a.age === "number" ? a.age : null,
    classYear,
    birthPlace,
    experience: classYear,
    bio:
      (typeof a.bio === "string" && a.bio.trim()) ||
      (typeof overview.description === "string" && overview.description.trim()) ||
      null,
    status:
      (a.injuries as { status?: string }[] | undefined)?.[0]?.status ||
      (a.status as { name?: string } | undefined)?.name ||
      null,
    seasonStats: summaryStats.length ? summaryStats : (statCategories[0]?.stats.slice(0, 8) ?? []),
    statCategories,
    recentGames: (gameLog?.events ?? []).slice(0, 6).map((ev) => ({
      label: ev.week != null ? `Week ${ev.week}` : "Game",
      result: ev.opponent?.abbreviation ?? ev.opponent?.displayName ?? "—",
      line: (ev.stats ?? []).slice(0, 4).join(" · ") || "—",
    })),
    news: (newsRaw ?? []).slice(0, 6).map((n) => ({
      headline: n.headline ?? "",
      description: n.description ?? "",
      image: n.images?.[0]?.url ?? null,
      href: n.links?.[0]?.href ?? null,
    })),
  };
}
