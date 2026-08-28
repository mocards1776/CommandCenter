import { normalizePersonName, teamPagePath } from "./mlb";
import {
  getSearchableSportsTeams,
  mlbTeamIdFromEspnId,
  type SearchableSportsTeam,
} from "./sports";

export type SportsSearchKind = "player" | "manager" | "team";

export type SportsSearchHit = {
  kind: SportsSearchKind;
  name: string;
  subtitle: string | null;
  league: string;
  path: string;
  score: number;
};

export type SportsSearchManagerRef = {
  id: string | number;
  name: string;
  teamName: string;
  league: "MLB" | "NFL" | "CFB";
  path: string;
};

type EspnSearchItem = {
  id?: string;
  displayName?: string;
  shortName?: string;
  type?: string;
  sport?: string;
  league?: string;
  label?: string;
  location?: string;
  name?: string;
  abbreviation?: string;
};

function normQuery(q: string): string {
  return q.trim().toLowerCase();
}

function scoreName(name: string, needle: string): number {
  const n = name.toLowerCase();
  if (n === needle) return 0;
  if (n.startsWith(needle)) return 1;
  if (n.includes(needle)) return 2;
  const parts = needle.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => n.includes(p))) return 3;
  return -1;
}

function dedupeHits(hits: SportsSearchHit[]): SportsSearchHit[] {
  const seen = new Set<string>();
  const out: SportsSearchHit[] = [];
  for (const h of hits.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))) {
    const key = `${h.kind}:${h.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function searchLocalTeams(needle: string, limit: number): SportsSearchHit[] {
  const hits: SportsSearchHit[] = [];
  for (const team of getSearchableSportsTeams()) {
    const scores = [
      scoreName(team.name, needle),
      scoreName(team.shortName, needle),
      ...team.keywords.map((k) => scoreName(k, needle)),
    ].filter((s) => s >= 0);
    if (scores.length === 0) continue;
    hits.push({
      kind: "team",
      name: team.name,
      subtitle: team.league,
      league: team.league,
      path: team.path,
      score: Math.min(...scores),
    });
  }
  return hits.slice(0, limit);
}

export function searchLocalSportsManagers(
  query: string,
  managers: SportsSearchManagerRef[],
  limit = 6,
): SportsSearchHit[] {
  const needle = normQuery(query);
  if (needle.length < 2) return [];
  const hits: SportsSearchHit[] = [];
  for (const m of managers) {
    const scores = [scoreName(m.name, needle), scoreName(m.teamName, needle)].filter((s) => s >= 0);
    if (scores.length === 0) continue;
    hits.push({
      kind: "manager",
      name: m.name,
      subtitle: `${m.teamName} · ${m.league}`,
      league: m.league,
      path: m.path,
      score: Math.min(...scores),
    });
  }
  return dedupeHits(hits).slice(0, limit);
}

export function searchLocalSports(
  query: string,
  managers: SportsSearchManagerRef[] = [],
  limitPerKind = 6,
): SportsSearchHit[] {
  const needle = normQuery(query);
  if (needle.length < 2) return [];
  const teams = searchLocalTeams(needle, limitPerKind);
  const mgrs = searchLocalSportsManagers(query, managers, limitPerKind);
  return dedupeHits([...teams, ...mgrs]).slice(0, limitPerKind * 3);
}

function playerPathForEspn(item: EspnSearchItem): string | null {
  if (item.type !== "player" || !item.id) return null;
  const league = (item.league ?? "").toLowerCase();
  if (league === "nfl") return `/sports/nfl/player/${item.id}`;
  if (league === "college-football") return `/sports/cfb/player/${item.id}`;
  if (league === "mlb") return null;
  if ((item.sport ?? "").toLowerCase() === "golf") return `/sports/golf/player/${item.id}`;
  return null;
}

function teamPathForEspn(item: EspnSearchItem): string | null {
  if (item.type !== "team" || !item.id) return null;
  const league = (item.league ?? "").toLowerCase();
  if (league === "nfl") return `/sports/nfl/team/${item.id}`;
  if (league === "mlb") {
    const mlbId = mlbTeamIdFromEspnId(item.id);
    if (mlbId != null) return teamPagePath(mlbId);
  }
  if (league === "college-football") return `/sports?solo=1&team=cfb-${item.id}`;
  if (league === "nhl") return `/sports?solo=1&team=nhl-${item.id}`;
  if (league.includes(".")) return `/sports?solo=1&team=${league}-${item.id}`;
  return null;
}

function leagueLabel(item: EspnSearchItem): string {
  const league = (item.league ?? "").toUpperCase();
  if (league) return league.replace("COLLEGE-FOOTBALL", "NCAA");
  return (item.sport ?? "Sports").toUpperCase();
}

async function searchEspn(query: string, signal?: AbortSignal): Promise<SportsSearchHit[]> {
  const url = new URL("https://site.api.espn.com/apis/common/v3/search");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("limit", "12");
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: EspnSearchItem[] };
  const hits: SportsSearchHit[] = [];
  for (const item of data.items ?? []) {
    if (item.type === "player") {
      const path = playerPathForEspn(item);
      if (!path) continue;
      hits.push({
        kind: "player",
        name: item.displayName ?? "Player",
        subtitle: leagueLabel(item),
        league: leagueLabel(item),
        path,
        score: 4,
      });
      continue;
    }
    if (item.type === "team") {
      const path = teamPathForEspn(item);
      if (!path) continue;
      hits.push({
        kind: "team",
        name: item.displayName ?? item.name ?? "Team",
        subtitle: leagueLabel(item),
        league: leagueLabel(item),
        path,
        score: 4,
      });
    }
  }
  return hits;
}

async function searchMlbPlayers(query: string, signal?: AbortSignal): Promise<SportsSearchHit[]> {
  const url = new URL("https://statsapi.mlb.com/api/v1/people/search");
  url.searchParams.set("names", query.trim());
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    people?: {
      id?: number;
      fullName?: string;
      isPlayer?: boolean;
      currentTeam?: { name?: string };
      primaryPosition?: { abbreviation?: string };
    }[];
  };
  const want = normalizePersonName(query);
  const people = (data.people ?? []).filter((p) => p.isPlayer !== false && p.id && p.fullName);
  const ranked = people
    .map((p) => {
      const full = p.fullName ?? "";
      const score = scoreName(normalizePersonName(full), want);
      return { p, score: score >= 0 ? score : scoreName(full.toLowerCase(), want.toLowerCase()) };
    })
    .filter((row) => row.score >= 0)
    .sort((a, b) => a.score - b.score);
  return ranked.slice(0, 8).map(({ p, score }) => ({
    kind: "player" as const,
    name: p.fullName!,
    subtitle: [p.primaryPosition?.abbreviation, p.currentTeam?.name].filter(Boolean).join(" · ") || "MLB",
    league: "MLB",
    path: `/sports/mlb/player/${p.id}`,
    score: score + 3,
  }));
}

/** Remote search — MLB players plus ESPN players/teams. */
export async function searchRemoteSports(query: string, signal?: AbortSignal): Promise<SportsSearchHit[]> {
  const needle = normQuery(query);
  if (needle.length < 2) return [];
  const [mlb, espn] = await Promise.all([
    searchMlbPlayers(query, signal).catch(() => [] as SportsSearchHit[]),
    searchEspn(query, signal).catch(() => [] as SportsSearchHit[]),
  ]);
  return dedupeHits([...mlb, ...espn]).slice(0, 18);
}

export function groupSportsSearchHits(hits: SportsSearchHit[]): {
  players: SportsSearchHit[];
  managers: SportsSearchHit[];
  teams: SportsSearchHit[];
} {
  const players: SportsSearchHit[] = [];
  const managers: SportsSearchHit[] = [];
  const teams: SportsSearchHit[] = [];
  for (const h of hits) {
    if (h.kind === "player") players.push(h);
    else if (h.kind === "manager") managers.push(h);
    else teams.push(h);
  }
  return { players, managers, teams };
}
