/** ESPN soccer helpers — Premier League + Championship scoreboards for RUWT / cards. */

export function soccerTeamLogo(teamId: string | number): string {
  return `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`;
}

export type SoccerScoreSide = {
  teamId: string;
  name: string;
  abbrev: string;
  logo: string | null;
  score: string | null;
  record: string | null;
};

export type SoccerScoreGame = {
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
  away: SoccerScoreSide;
  home: SoccerScoreSide;
};

export type SoccerScoredGame = SoccerScoreGame & {
  score: number;
  reasons: string[];
};

export type SoccerTeamMeta = {
  id: string;
  name: string;
  abbrev: string;
  logo: string | null;
  leagueSlug: string;
};

/** Clubs we always surface on RUWT (Championship). */
export const RUWT_SOCCER_FOCUS: { id: string; name: string; abbrev: string; leagueSlug: string }[] =
  [
    { id: "352", name: "Wrexham", abbrev: "WXM", leagueSlug: "eng.2" },
    { id: "380", name: "Wolves", abbrev: "WOL", leagueSlug: "eng.2" },
  ];

const SOCCER_INTEREST_KEY = "ruwt-soccer-team-interest-v1";

export function loadSoccerTeamInterest(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SOCCER_INTEREST_KEY);
    if (!raw) {
      // Seed Wrexham + Wolves high so they show up immediately.
      const seeded: Record<string, number> = { "352": 10, "380": 9 };
      localStorage.setItem(SOCCER_INTEREST_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed ?? {})) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      out[String(k)] = Math.max(0, Math.min(10, Math.round(n)));
    }
    return out;
  } catch {
    return { "352": 10, "380": 9 };
  }
}

export function saveSoccerTeamInterest(map: Record<string, number>): void {
  localStorage.setItem(SOCCER_INTEREST_KEY, JSON.stringify(map));
}

export function setSoccerTeamInterestRating(
  map: Record<string, number>,
  teamId: string,
  rating: number,
): Record<string, number> {
  const next = { ...map };
  const clamped = Math.max(0, Math.min(10, Math.round(rating)));
  if (clamped <= 0) delete next[String(teamId)];
  else next[String(teamId)] = clamped;
  saveSoccerTeamInterest(next);
  return next;
}

function sideFromCompetitor(c: {
  homeAway?: string;
  score?: string | number;
  winner?: boolean;
  records?: { type?: string; summary?: string }[];
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
    logo?: string;
    logos?: { href?: string }[];
  };
}): SoccerScoreSide {
  const rec = (c.records ?? []).find((r) => r.type === "total")?.summary ?? null;
  return {
    teamId: String(c.team?.id ?? ""),
    name: c.team?.displayName ?? c.team?.shortDisplayName ?? "Team",
    abbrev: c.team?.abbreviation ?? "—",
    logo: c.team?.logo ?? c.team?.logos?.[0]?.href ?? null,
    score: c.score != null ? String(c.score) : null,
    record: rec,
  };
}

async function fetchSoccerScoreboardDay(
  leagueSlug: string,
  dateYmd?: string,
): Promise<SoccerScoreGame[]> {
  const leagueName =
    leagueSlug === "eng.1"
      ? "Premier League"
      : leagueSlug === "eng.2"
        ? "EFL Championship"
        : leagueSlug;
  const url = dateYmd
    ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/scoreboard?dates=${dateYmd}`
    : `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/scoreboard`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const board = (await res.json()) as {
    events?: {
      id?: string;
      date?: string;
      name?: string;
      shortName?: string;
      competitions?: {
        venue?: { fullName?: string };
        status?: {
          type?: {
            state?: string;
            completed?: boolean;
            description?: string;
            shortDetail?: string;
            detail?: string;
          };
        };
        competitors?: {
          homeAway?: string;
          score?: string | number;
          winner?: boolean;
          records?: { type?: string; summary?: string }[];
          team?: {
            id?: string;
            abbreviation?: string;
            displayName?: string;
            shortDisplayName?: string;
            logo?: string;
            logos?: { href?: string }[];
          };
        }[];
      }[];
    }[];
  };

  const out: SoccerScoreGame[] = [];
  for (const event of board.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const homeRaw = (comp.competitors ?? []).find((c) => c.homeAway === "home");
    const awayRaw = (comp.competitors ?? []).find((c) => c.homeAway === "away");
    if (!homeRaw || !awayRaw) continue;
    const st = comp.status?.type;
    const final = st?.state === "post" || st?.completed === true;
    const pregame = st?.state === "pre";
    const live = st?.state === "in" || (!final && !pregame);
    out.push({
      id: String(event.id ?? ""),
      league: leagueName,
      leagueSlug,
      date: event.date ? event.date.slice(0, 10) : null,
      status: st?.description ?? (final ? "Final" : live ? "Live" : "Scheduled"),
      shortDetail: st?.shortDetail ?? st?.detail ?? null,
      final,
      live,
      pregame,
      venue: comp.venue?.fullName ?? null,
      away: sideFromCompetitor(awayRaw),
      home: sideFromCompetitor(homeRaw),
    });
  }
  return out;
}

/** Today’s Premier League board + Championship games involving focus clubs. */
export async function fetchSoccerRuwtBoard(todayYmd: string): Promise<SoccerScoreGame[]> {
  const ymd = todayYmd.replace(/-/g, "");
  const [pl, champ] = await Promise.all([
    fetchSoccerScoreboardDay("eng.1", ymd).catch(() => [] as SoccerScoreGame[]),
    fetchSoccerScoreboardDay("eng.2", ymd).catch(() => [] as SoccerScoreGame[]),
  ]);
  const focus = new Set(RUWT_SOCCER_FOCUS.map((t) => t.id));
  const champFocus = champ.filter(
    (g) => focus.has(g.away.teamId) || focus.has(g.home.teamId),
  );
  const seen = new Set<string>();
  const out: SoccerScoreGame[] = [];
  for (const g of [...pl, ...champFocus]) {
    if (!g.id || seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

export async function fetchPremierLeagueTeams(): Promise<SoccerTeamMeta[]> {
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams",
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    sports?: {
      leagues?: {
        teams?: {
          team?: {
            id?: string;
            abbreviation?: string;
            displayName?: string;
            shortDisplayName?: string;
            logos?: { href?: string }[];
          };
        }[];
      }[];
    }[];
  };
  const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams
    .map((row) => {
      const t = row.team;
      if (!t?.id) return null;
      return {
        id: String(t.id),
        name: t.shortDisplayName ?? t.displayName ?? "Club",
        abbrev: t.abbreviation ?? "—",
        logo: t.logos?.[0]?.href ?? null,
        leagueSlug: "eng.1",
      } satisfies SoccerTeamMeta;
    })
    .filter((t): t is SoccerTeamMeta => Boolean(t));
}

/** Simple drama + personal interest ranking for soccer. */
export function rankRuwtSoccerGames(
  games: SoccerScoreGame[],
  interest: Record<string, number>,
  limit = 24,
): SoccerScoredGame[] {
  const focus = new Set(RUWT_SOCCER_FOCUS.map((t) => t.id));
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
    if (focus.has(g.away.teamId) || focus.has(g.home.teamId)) {
      score += 18;
      reasons.push("Followed club");
    }
    // Close scoreline bonus
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

export function chicagoTodaySoccer(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}
