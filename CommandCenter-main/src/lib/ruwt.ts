/** Are You Watching This — interest rankings and scoring context. */

import type { MlbScoreGame, MlbGameInterest, MlbScoredGame } from "./mlb";
import { scoreGameInterest as baseScoreGameInterest } from "./mlb";
import {
  rankCfbRuwtGames,
  type CfbScoreGame,
  type CfbScoredGame,
} from "./cfb";
import {
  rankNflRuwtGames,
  type NflRuwtContext,
  type NflScoreGame,
  type NflScoredGame,
} from "./nfl";

const STORAGE_KEY = "ruwt-team-interest-v1";
const NFL_STORAGE_KEY = "ruwt-nfl-team-interest-v1";
const CFB_STORAGE_KEY = "ruwt-cfb-team-interest-v1";

export type RuwtTeamInterest = Record<string, number>; // teamId → 0–10

export type RuwtScoreContext = {
  /** Per-team interest 0–10 (10 = must-watch franchise). */
  teamInterest: RuwtTeamInterest;
  /** Favorite / tagged player ids. */
  watchPlayerIds: Set<number>;
  /** Optional short labels for watch players (for ranking reasons). */
  watchPlayerNames?: Map<number, string>;
  /** Favorite manager person ids. */
  watchManagerIds: Set<number>;
  /** Manager → current team id. */
  managerTeamById?: Map<number, number>;
  /** Playoff make-% by team id (0–100). */
  playoffOddsByTeam?: Record<number, number>;
};

function loadInterestMap(key: string): RuwtTeamInterest {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RuwtTeamInterest;
    const out: RuwtTeamInterest = {};
    for (const [k, v] of Object.entries(parsed ?? {})) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      out[String(k)] = Math.max(0, Math.min(10, Math.round(n)));
    }
    return out;
  } catch {
    return {};
  }
}

export function loadTeamInterest(): RuwtTeamInterest {
  return loadInterestMap(STORAGE_KEY);
}

export function saveTeamInterest(map: RuwtTeamInterest): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function setTeamInterestRating(
  map: RuwtTeamInterest,
  teamId: number,
  rating: number,
): RuwtTeamInterest {
  const next = { ...map };
  const clamped = Math.max(0, Math.min(10, Math.round(rating)));
  if (clamped <= 0) delete next[String(teamId)];
  else next[String(teamId)] = clamped;
  saveTeamInterest(next);
  return next;
}

export function loadNflTeamInterest(): RuwtTeamInterest {
  return loadInterestMap(NFL_STORAGE_KEY);
}

export function saveNflTeamInterest(map: RuwtTeamInterest): void {
  localStorage.setItem(NFL_STORAGE_KEY, JSON.stringify(map));
}

export function setNflTeamInterestRating(
  map: RuwtTeamInterest,
  teamId: number,
  rating: number,
): RuwtTeamInterest {
  const next = { ...map };
  const clamped = Math.max(0, Math.min(10, Math.round(rating)));
  if (clamped <= 0) delete next[String(teamId)];
  else next[String(teamId)] = clamped;
  saveNflTeamInterest(next);
  return next;
}

export function loadCfbTeamInterest(): RuwtTeamInterest {
  return loadInterestMap(CFB_STORAGE_KEY);
}

export function saveCfbTeamInterest(map: RuwtTeamInterest): void {
  localStorage.setItem(CFB_STORAGE_KEY, JSON.stringify(map));
}

export function setCfbTeamInterestRating(
  map: RuwtTeamInterest,
  teamId: number,
  rating: number,
): RuwtTeamInterest {
  const next = { ...map };
  const clamped = Math.max(0, Math.min(10, Math.round(rating)));
  if (clamped <= 0) delete next[String(teamId)];
  else next[String(teamId)] = clamped;
  saveCfbTeamInterest(next);
  return next;
}

export function rankRuwtCfbGames(
  games: CfbScoreGame[],
  interest: RuwtTeamInterest,
  limit = 24,
  opts?: { watchTeamIds?: Set<string> },
): CfbScoredGame[] {
  return rankCfbRuwtGames(
    games,
    { teamInterest: interest, watchTeamIds: opts?.watchTeamIds },
    limit,
  );
}

export function rankRuwtNflGames(
  games: NflScoreGame[],
  interest: RuwtTeamInterest,
  limit = 20,
  opts?: { watchPlayerIds?: Set<string>; watchTeamIds?: Set<string> },
): NflScoredGame[] {
  const ctx: NflRuwtContext = {
    teamInterest: interest,
    watchPlayerIds: opts?.watchPlayerIds ?? new Set(),
    watchTeamIds: opts?.watchTeamIds ?? new Set(),
  };
  return rankNflRuwtGames(games, ctx, limit);
}

function parseWinPct(record: string | null): number | null {
  if (!record) return null;
  const m = record.match(/^(\d+)-(\d+)/);
  if (!m) return null;
  const w = Number(m[1]);
  const l = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(l) || w + l === 0) return null;
  return w / (w + l);
}

/** Full RUWT score: base drama + personal interest + matchup / playoff. */
export function scoreRuwtGame(g: MlbScoreGame, ctx?: RuwtScoreContext): MlbGameInterest {
  const base = baseScoreGameInterest(g);
  if (!ctx) return base;

  let score = base.score;
  const reasons = [...base.reasons];

  const awayInterest = ctx.teamInterest[String(g.away.teamId)] ?? 0;
  const homeInterest = ctx.teamInterest[String(g.home.teamId)] ?? 0;
  const topInterest = Math.max(awayInterest, homeInterest);
  if (topInterest > 0) {
    score += Math.round(topInterest * 4.2);
    if (topInterest >= 9) reasons.push("Your #1 team");
    else if (topInterest >= 7) reasons.push("High interest team");
    else if (topInterest >= 4) reasons.push("On your board");
  }
  if (awayInterest >= 5 && homeInterest >= 5) {
    score += 12;
    reasons.push("Both teams ranked");
  }

  const pitcherIds = [g.away.probablePitcherId, g.home.probablePitcherId].filter(
    (id): id is number => id != null,
  );
  const watchedPitchers = pitcherIds.filter((id) => ctx.watchPlayerIds.has(id));
  if (watchedPitchers.length) {
    score += 28;
    const names = watchedPitchers
      .map((id) => ctx.watchPlayerNames?.get(id))
      .filter((n): n is string => Boolean(n));
    if (names.length) {
      reasons.push(names.length === 1 ? `${names[0]} watched` : `${names.join(" · ")} watched`);
    } else {
      reasons.push(watchedPitchers.length > 1 ? "Favorite pitchers" : "Favorite pitcher");
    }
  }

  if (g.live && g.situation) {
    const liveIds = [g.situation.batter?.id, g.situation.pitcher?.id].filter(
      (id): id is number => id != null,
    );
    if (liveIds.some((id) => ctx.watchPlayerIds.has(id))) {
      score += 18;
      reasons.push("Watch player live");
    }
  }

  if (ctx.managerTeamById && ctx.watchManagerIds.size) {
    for (const mid of ctx.watchManagerIds) {
      const teamId = ctx.managerTeamById.get(mid);
      if (teamId && (teamId === g.away.teamId || teamId === g.home.teamId)) {
        score += 22;
        reasons.push("Favorite manager");
        break;
      }
    }
  }

  const pregame = !g.live && !g.final;
  if (pregame) {
    if (g.away.probablePitcher && g.home.probablePitcher) {
      score += 10;
      reasons.push("Pitching set");
    }
    const aw = parseWinPct(g.away.record);
    const hw = parseWinPct(g.home.record);
    if (aw != null && hw != null) {
      const gap = Math.abs(aw - hw);
      const avg = (aw + hw) / 2;
      if (avg >= 0.52 && gap <= 0.08) {
        score += 14;
        reasons.push("Even records");
      } else if (avg >= 0.55) {
        score += 8;
        reasons.push("Strong clubs");
      } else if (gap <= 0.05) {
        score += 6;
        reasons.push("Matched records");
      }
    }
  }

  if (ctx.playoffOddsByTeam) {
    const ao = ctx.playoffOddsByTeam[g.away.teamId];
    const ho = ctx.playoffOddsByTeam[g.home.teamId];
    if (ao != null && ho != null) {
      const race =
        (ao >= 8 && ao <= 55 && ho >= 8 && ho <= 55) ||
        (Math.abs(ao - ho) <= 12 && Math.min(ao, ho) >= 15);
      if (race) {
        score += 16;
        reasons.push("Playoff race");
      } else if (Math.max(ao, ho) >= 70 && Math.min(ao, ho) >= 25) {
        score += 8;
        reasons.push("October teams");
      }
    }
  }

  const unique: string[] = [];
  for (const r of reasons) {
    if (!unique.includes(r)) unique.push(r);
  }
  return { score: Math.max(0, score), reasons: unique.slice(0, 5) };
}

export function rankRuwtGames(
  games: MlbScoreGame[],
  ctx?: RuwtScoreContext,
  limit = 16,
): MlbScoredGame[] {
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}
