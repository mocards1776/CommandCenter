/** ESPN soccer helpers — Premier League + Championship scoreboards for RUWT / cards. */

import { supabase } from "@/lib/supabase";
import { parseEspnBroadcasts } from "@/lib/game-broadcasts";
import type { GameBroadcast } from "@/lib/game-broadcasts";

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
  /** Chicago calendar date YYYY-MM-DD when kickoff is known. */
  date: string | null;
  status: string;
  shortDetail: string | null;
  final: boolean;
  live: boolean;
  pregame: boolean;
  venue: string | null;
  away: SoccerScoreSide;
  home: SoccerScoreSide;
  broadcasts: GameBroadcast[];
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

export type SoccerPromotionOdd = {
  teamId: string;
  name: string;
  percent: number;
  american: string;
  projectedPlace: number | null;
  source: string;
  url: string | null;
};

export type SoccerClubForm = {
  pts: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  rank: number | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  zone: "auto" | "playoff" | "mid" | "relegation" | null;
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

function leagueDisplayName(leagueSlug: string): string {
  if (leagueSlug === "eng.1") return "Premier League";
  if (leagueSlug === "eng.2") return "EFL Championship";
  return leagueSlug;
}

function parseScoreboardPayload(
  board: {
    events?: {
      id?: string;
      date?: string;
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
        broadcasts?: { market?: string; names?: string[] }[];
        geoBroadcasts?: {
          market?: { type?: string };
          media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
        }[];
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
  },
  leagueSlug: string,
): SoccerScoreGame[] {
  const leagueName = leagueDisplayName(leagueSlug);
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
    const chicagoDate = event.date
      ? new Date(event.date).toLocaleDateString("en-CA", { timeZone: "America/Chicago" })
      : null;
    out.push({
      id: String(event.id ?? ""),
      league: leagueName,
      leagueSlug,
      date: chicagoDate,
      status: st?.description ?? (final ? "Final" : live ? "Live" : "Scheduled"),
      shortDetail: st?.shortDetail ?? st?.detail ?? null,
      final,
      live,
      pregame,
      venue: comp.venue?.fullName ?? null,
      away: sideFromCompetitor(awayRaw),
      home: sideFromCompetitor(homeRaw),
      broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
    });
  }
  return out;
}

/** Resilient ESPN site fetch — mirrors sports.ts espnGet (direct → web host → edge). */
async function soccerEspnGet(path: string): Promise<unknown> {
  const clean = path.replace(/^\/+/, "");
  const headers = { Accept: "application/json" };
  const hosts = [
    "https://site.api.espn.com/apis/site/v2/sports",
    "https://site.web.api.espn.com/apis/site/v2/sports",
  ];
  for (const host of hosts) {
    try {
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), 12_000);
      const res = await fetch(`${host}/${clean}`, {
        signal: ctl.signal,
        headers,
      }).finally(() => window.clearTimeout(t));
      if (res.ok) return await res.json();
    } catch {
      /* try next */
    }
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

async function fetchSoccerScoreboardDay(
  leagueSlug: string,
  dateYmd?: string,
): Promise<SoccerScoreGame[]> {
  const path = dateYmd
    ? `soccer/${leagueSlug}/scoreboard?dates=${dateYmd}`
    : `soccer/${leagueSlug}/scoreboard`;
  try {
    const board = (await soccerEspnGet(path)) as Parameters<typeof parseScoreboardPayload>[0];
    return parseScoreboardPayload(board, leagueSlug);
  } catch {
    return [];
  }
}

/** Today’s boards only — RUWT is a same-day watch list, not a fixture calendar. */
export async function fetchSoccerRuwtBoard(todayYmd: string): Promise<SoccerScoreGame[]> {
  const ymd = todayYmd.replace(/-/g, "");
  const chicagoYmd = /^\d{4}-\d{2}-\d{2}$/.test(todayYmd)
    ? todayYmd
    : `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

  const [plToday, champToday] = await Promise.all([
    fetchSoccerScoreboardDay("eng.1", ymd).catch(() => [] as SoccerScoreGame[]),
    fetchSoccerScoreboardDay("eng.2", ymd).catch(() => [] as SoccerScoreGame[]),
  ]);

  const focus = new Set(RUWT_SOCCER_FOCUS.map((t) => t.id));
  const champFocus = champToday.filter(
    (g) => focus.has(g.away.teamId) || focus.has(g.home.teamId),
  );

  const seen = new Set<string>();
  const out: SoccerScoreGame[] = [];
  for (const g of [...plToday, ...champFocus.length ? champFocus : champToday]) {
    if (!g.id || seen.has(g.id)) continue;
    // Require an explicit Chicago calendar match — undated / next-fixture spill is not RUWT.
    if (g.date !== chicagoYmd) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

export async function fetchPremierLeagueTeams(): Promise<SoccerTeamMeta[]> {
  try {
    const data = (await soccerEspnGet("soccer/eng.1/teams")) as {
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
  } catch {
    return [];
  }
}

/** Championship promotion odds (Polymarket when live, else ESPN projection). */
export async function fetchChampionshipPromotionOdds(): Promise<SoccerPromotionOdd[]> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const body = { action: "championshipPromotionOdds" };

  const mapItems = (data: unknown): SoccerPromotionOdd[] => {
    const root = data as { items?: SoccerPromotionOdd[] } | null;
    return Array.isArray(root?.items) ? root!.items! : [];
  };

  if (base && key) {
    try {
      const ctl = new AbortController();
      const timer = window.setTimeout(() => ctl.abort(), 20_000);
      try {
        const res = await fetch(`${base}/functions/v1/sports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        if (res.ok) {
          const items = mapItems(await res.json());
          if (items.length) return items;
        }
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const { data } = await supabase.functions.invoke("sports", { body });
    const items = mapItems(data);
    if (items.length) return items;
  } catch {
    /* fall through to client ESPN projection */
  }

  return fetchEspnProjectedPromotionOdds();
}

function americanFromProb(p: number): string {
  const clamped = Math.min(0.98, Math.max(0.02, p));
  if (clamped >= 0.5) return String(Math.round((-100 * clamped) / (1 - clamped)));
  return `+${Math.round((100 * (1 - clamped)) / clamped)}`;
}

function promotionProbFromPlace(place: number): number {
  if (place <= 1) return 0.92;
  if (place === 2) return 0.86;
  if (place === 3) return 0.48;
  if (place === 4) return 0.38;
  if (place === 5) return 0.32;
  if (place === 6) return 0.28;
  if (place <= 8) return 0.14;
  if (place <= 10) return 0.08;
  if (place <= 14) return 0.04;
  return 0.015;
}

/** Client fallback — ESPN Championship projected finishes → promotion odds. */
async function fetchEspnProjectedPromotionOdds(): Promise<SoccerPromotionOdd[]> {
  try {
    const storyIds: number[] = [];
    try {
      const newsRes = await fetch(
        "https://now.core.api.espn.com/v1/sports/news?limit=50&league=eng.2",
        { headers: { Accept: "application/json" } },
      );
      if (newsRes.ok) {
        const news = (await newsRes.json()) as {
          headlines?: { id?: number; headline?: string }[];
        };
        for (const h of news.headlines ?? []) {
          if (
            h.id &&
            /predict|projected finish|guide to new season|every club/i.test(h.headline ?? "")
          ) {
            storyIds.push(h.id);
          }
        }
      }
    } catch {
      /* known id below */
    }
    // Stable season-preview story used when the league feed rotates it out.
    if (!storyIds.includes(49583537)) storyIds.push(49583537);

    for (const id of storyIds) {
      const storyRes = await fetch(`https://now.core.api.espn.com/v1/sports/news/${id}`, {
        headers: { Accept: "application/json" },
      });
      if (!storyRes.ok) continue;
      const storyPayload = (await storyRes.json()) as {
        headlines?: { story?: string; links?: { web?: { href?: string } } }[];
      };
      const story = (storyPayload.headlines?.[0]?.story ?? "").replace(/<[^>]+>/g, " ");
      if (!/Wrexham|Wolves/i.test(story)) continue;
      const url = storyPayload.headlines?.[0]?.links?.web?.href ?? null;
      const targets: { teamId: string; name: string; re: RegExp }[] = [
        { teamId: "352", name: "Wrexham", re: /Wrexham\s*[—–-]+\s*(\d+)(?:st|nd|rd|th)?/i },
        { teamId: "380", name: "Wolves", re: /Wolves\s*[—–-]+\s*(\d+)(?:st|nd|rd|th)?/i },
      ];
      const out: SoccerPromotionOdd[] = [];
      for (const t of targets) {
        const m = story.match(t.re);
        if (!m) continue;
        const place = Number(m[1]);
        if (!Number.isFinite(place)) continue;
        const p = promotionProbFromPlace(place);
        out.push({
          teamId: t.teamId,
          name: t.name,
          percent: Math.round(p * 1000) / 10,
          american: americanFromProb(p),
          projectedPlace: place,
          source: "ESPN projection",
          url,
        });
      }
      if (out.length) return out;
    }
    return [];
  } catch {
    return [];
  }
}

export function championshipZone(rank: number | null): SoccerClubForm["zone"] {
  if (rank == null || !Number.isFinite(rank)) return null;
  if (rank <= 2) return "auto";
  if (rank <= 6) return "playoff";
  if (rank >= 22) return "relegation";
  return "mid";
}

export function zoneLabel(zone: SoccerClubForm["zone"]): string {
  if (zone === "auto") return "Auto-promotion";
  if (zone === "playoff") return "Playoff places";
  if (zone === "relegation") return "Relegation zone";
  if (zone === "mid") return "Mid-table";
  return "";
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
