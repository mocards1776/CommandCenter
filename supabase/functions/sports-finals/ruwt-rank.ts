/**
 * Deno port of RUWT Today's Top scorers.
 *
 * Source of truth (do not rewrite weights):
 *   CommandCenter-main/src/lib/mlb-playoff-heat.ts  mlbPostseasonHeat
 *   CommandCenter-main/src/lib/mlb.ts               scoreGameInterest
 *   CommandCenter-main/src/lib/ruwt.ts              scoreRuwtGame / rankRuwtGames
 *   CommandCenter-main/src/lib/nfl.ts               scoreNflRuwtGame / rankNflRuwtGames
 *   CommandCenter-main/src/lib/nhl.ts               scoreNhlRuwtGame / rankNhlRuwtGames
 *   CommandCenter-main/src/lib/soccer.ts            rankRuwtSoccerGames
 *   CommandCenter-main/src/lib/cfb.ts               scoreCfbRuwtGame / rankCfbRuwtGames
 *   CommandCenter-main/src/lib/cfb-live-margin.ts   decided / GOTW helpers
 *
 * sports-finals cannot import src/lib (browser + Times-owned fetchers). This
 * file is a mechanical port of those rank calls. If a weight changes in the
 * app, copy it here — do not invent a new heat formula and do not use
 * sports_push_game_state.drama_score.
 */

export const MLB_PLAYOFF_SERIES_HEAT = 54;
export const MLB_PLAYOFF_LIVE_NUDGE = 4;
const CARDINALS_TEAM_ID = 138;

export const CFB_SEC_INTEREST_FLOOR = 4;
export const CFB_POWER5_INTEREST_FLOOR = 2;
export const CFB_GOTW_TWO_SCORE_CREDIT = 24;
export const CFB_DECIDED_WIN_PCT = 97;
export const CFB_DECIDED_CLOCK_SEC = 3 * 60;
export const CFB_DECIDED_LIVE_CAP = 49;
export const CFB_SITUATION_FPI_LINE = 40;

const NFL_DECIDED_WIN_PCT = 97;
const NFL_DECIDED_CLOCK_SEC = 3 * 60;
const NFL_DECIDED_LIVE_CAP = 49;
const NHL_DECIDED_CLOCK_SEC = 3 * 60;
const NHL_DECIDED_LIVE_CAP = 49;

export const CFB_SEC_TEAM_IDS = new Set([
  "333", "8", "2", "57", "61", "96", "99", "145", "344", "142", "201", "2579", "2633", "251",
  "245", "238",
]);

export const CFB_POWER5_TEAM_IDS = new Set<string>([
  "2390", "258", "52", "153", "154", "24", "25", "97", "103", "150", "183", "221",
  "228", "259", "2567", "59", "152",
  "38", "2305", "2116", "254", "9", "12", "66", "197", "239", "248", "252", "277",
  "2132", "2306", "2641", "2628",
  "30", "356", "127", "135", "2509", "26", "77", "84", "120", "130", "158", "194",
  "213", "264", "275", "2294", "2483", "164",
  ...Array.from(CFB_SEC_TEAM_IDS),
  "87",
]);

export const RUWT_SOCCER_FOCUS = [
  { id: "352", name: "Wrexham", abbrev: "WXM", leagueSlug: "eng.2" },
  { id: "380", name: "Wolves", abbrev: "WOL", leagueSlug: "eng.2" },
];

export type RuwtTeamInterest = Record<string, number>;

export type MlbScoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  score: number | null;
  record: string | null;
  probablePitcher: string | null;
  probablePitcherId: number | null;
};

export type MlbScoreGame = {
  id: string;
  live: boolean;
  final: boolean;
  inning: string | null;
  officialDate?: string | null;
  away: MlbScoreSide;
  home: MlbScoreSide;
  situation?: { batter?: { id?: number }; pitcher?: { id?: number } } | null;
};

export type NflScoreSide = {
  teamId: string | number;
  abbrev: string;
  score: number | null;
};

export type NflScoreGame = {
  id: string;
  live: boolean;
  final: boolean;
  shortDetail?: string | null;
  status?: string | null;
  homeWinPct?: number | null;
  away: NflScoreSide;
  home: NflScoreSide;
  situation?: { isRedZone?: boolean; downDistanceText?: string | null } | null;
};

export type NhlScoreSide = {
  teamId: string | number;
  abbrev: string;
  score: number | null;
};

export type NhlScoreGame = {
  id: string;
  live: boolean;
  final: boolean;
  shortDetail?: string | null;
  status?: string | null;
  away: NhlScoreSide;
  home: NhlScoreSide;
};

export type SoccerScoreSide = {
  teamId: string;
  abbrev: string;
  score: string | null;
};

export type SoccerScoreGame = {
  id: string;
  live: boolean;
  final: boolean;
  pregame: boolean;
  leagueSlug: string;
  away: SoccerScoreSide;
  home: SoccerScoreSide;
};

export type CfbScoreSide = {
  teamId: number;
  abbrev: string;
  score: number | null;
  record: string | null;
  rank: number | null;
  fpiRank: number | null;
};

export type CfbGameOdds = {
  details: string | null;
  spread: number | null;
  favoriteTeamId: number | null;
};

export type CfbScoreGame = {
  id: string;
  live: boolean;
  final: boolean;
  status?: string | null;
  shortDetail?: string | null;
  period: number | null;
  broadcasts: { name: string }[];
  away: CfbScoreSide;
  home: CfbScoreSide;
  situation?: {
    isRedZone?: boolean;
    downDistanceText?: string | null;
    leaderWinPct?: number | null;
  } | null;
  barLeaderWinPct?: number | null;
  odds: CfbGameOdds | null;
};

export type RuwtScoreContext = {
  teamInterest: RuwtTeamInterest;
  watchPlayerIds: Set<number>;
  watchPlayerNames?: Map<number, string>;
  watchManagerIds: Set<number>;
  managerTeamById?: Map<number, number>;
  playoffOddsByTeam?: Record<number, number>;
};

export type NflRuwtContext = {
  teamInterest: RuwtTeamInterest;
  watchPlayerIds: Set<string>;
  watchTeamIds?: Set<string>;
};

export type NhlRuwtContext = {
  teamInterest: RuwtTeamInterest;
  watchTeamIds?: Set<string>;
};

export type CfbRuwtContext = {
  teamInterest: RuwtTeamInterest;
  watchTeamIds?: Set<string>;
};

export function mlbBoardMonth(
  officialDate: string | null | undefined,
  now = new Date(),
): number | null {
  const iso =
    officialDate && /^\d{4}-\d{2}-\d{2}$/.test(officialDate)
      ? officialDate
      : now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const month = Number(iso.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

export function mlbPostseasonHeat(
  game: { live: boolean; final: boolean; officialDate?: string | null },
  now = new Date(),
): { points: number; reason: string } | null {
  const month = mlbBoardMonth(game.officialDate, now);
  if (month !== 10 && month !== 11) return null;
  if (game.live && !game.final) {
    return { points: MLB_PLAYOFF_LIVE_NUDGE, reason: "Playoffs" };
  }
  return { points: MLB_PLAYOFF_SERIES_HEAT, reason: "Playoff series" };
}

function teamInGame(g: MlbScoreGame, teamId: number): boolean {
  return g.away.teamId === teamId || g.home.teamId === teamId;
}

export function scoreGameInterest(g: MlbScoreGame): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const away = g.away.score;
  const home = g.home.score;
  const hasScore = away != null && home != null;
  const diff = hasScore ? Math.abs(away - home) : null;
  const total = hasScore ? away + home : null;

  if (g.live) {
    score += 42;
    reasons.push("Live now");
  } else if (g.final) {
    score += 8;
  } else {
    score += 4;
  }

  if (teamInGame(g, CARDINALS_TEAM_ID)) {
    score += 18;
    reasons.push("Cardinals");
  }

  if (diff != null) {
    if (diff === 0) {
      score += 28;
      reasons.push("Tied");
    } else if (diff === 1) {
      score += 24;
      reasons.push("One-run game");
    } else if (diff === 2) {
      score += 14;
      reasons.push("Within two");
    } else if (diff <= 3) {
      score += 8;
      reasons.push("Tight");
    } else if (diff >= 7) {
      score -= 16;
      reasons.push("Blowout");
    } else if (diff >= 5) {
      score -= 8;
    }
  }

  const inn = (g.inning ?? "").toLowerCase();
  if (/extra|10th|11th|12th|13th|14th|15th/.test(inn)) {
    score += 32;
    reasons.push("Extras");
  } else if (
    /\b(7th|8th|9th)\b/.test(inn) ||
    /mid\s*7|top\s*7|bot\s*7|end\s*7|mid\s*8|top\s*8|bot\s*8|end\s*8|mid\s*9|top\s*9|bot\s*9|end\s*9/.test(inn)
  ) {
    score += 18;
    reasons.push("Late innings");
  }

  if (total != null && total >= 12) {
    score += 12;
    reasons.push("Slugfest");
  } else if (total != null && total >= 9) {
    score += 6;
    reasons.push("High scoring");
  }

  const parseRecord = (r: string | null): number | null => {
    if (!r) return null;
    const m = r.match(/^(\d+)-(\d+)/);
    if (!m) return null;
    const w = Number(m[1]);
    const l = Number(m[2]);
    if (!Number.isFinite(w) || !Number.isFinite(l) || w + l === 0) return null;
    return w / (w + l);
  };
  const aw = parseRecord(g.away.record);
  const hw = parseRecord(g.home.record);
  if (aw != null && hw != null && aw >= 0.55 && hw >= 0.55) {
    score += 10;
    reasons.push("Contenders");
  }

  if (g.final && diff === 1) {
    score += 10;
    if (!reasons.includes("One-run game")) reasons.push("One-run final");
  }

  const postseason = mlbPostseasonHeat(g);
  if (postseason) {
    score += postseason.points;
    reasons.push(postseason.reason);
  }

  return { score: Math.max(0, score), reasons: reasons.slice(0, 4) };
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

export function scoreRuwtGame(g: MlbScoreGame, ctx?: RuwtScoreContext): { score: number; reasons: string[] } {
  const base = scoreGameInterest(g);
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

export function rankRuwtGames<T extends MlbScoreGame>(
  games: T[],
  ctx?: RuwtScoreContext,
  limit = 16,
): (T & { score: number; reasons: string[] })[] {
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

function nflClockSeconds(detail: string): number | null {
  const m = detail.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec > 59) return null;
  return min * 60 + sec;
}

function nflEffectivelyDecided(diff: number, detail: string, homeWinPct: number | null): boolean {
  if (diff > 16) return false;
  if (homeWinPct != null && Number.isFinite(homeWinPct)) {
    return homeWinPct >= NFL_DECIDED_WIN_PCT || homeWinPct <= 100 - NFL_DECIDED_WIN_PCT;
  }
  if (diff < 9) return false;
  const fourth = /\b4th\b/.test(detail) || /\bot\b|overtime/.test(detail);
  if (!fourth) return false;
  const clock = nflClockSeconds(detail);
  return clock != null && clock <= NFL_DECIDED_CLOCK_SEC;
}

export function scoreNflRuwtGame(g: NflScoreGame, ctx?: NflRuwtContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const detail = `${g.shortDetail ?? ""} ${g.status ?? ""}`.toLowerCase();
  const liveDiff = Math.abs((g.away.score ?? 0) - (g.home.score ?? 0));
  const decided = g.live && !g.final && nflEffectivelyDecided(liveDiff, detail, g.homeWinPct ?? null);

  if (g.live) {
    score += 40;
    reasons.push("Live");
    const diff = liveDiff;
    if (!decided && diff <= 3) {
      score += 28;
      reasons.push("One-score game");
    } else if (!decided && diff <= 8) {
      score += 14;
      reasons.push("Tight");
    }
    if (!decided && g.situation?.isRedZone) {
      score += 18;
      reasons.push("Red zone");
    }
    const late = /\b(3rd|4th)\b/.test(detail) || /\bot\b|overtime/.test(detail);
    if (!decided && g.situation?.downDistanceText?.startsWith("4th") && late) {
      score += 12;
      reasons.push("4th down");
    }
    if (!decided && g.homeWinPct != null && g.homeWinPct >= 35 && g.homeWinPct <= 65) {
      score += 10;
      reasons.push("Toss-up");
    }
  } else if (!g.final) {
    score += 12;
    reasons.push("Upcoming");
  } else {
    score += 2;
  }

  if (ctx) {
    const ai = ctx.teamInterest[String(g.away.teamId)] ?? 0;
    const hi = ctx.teamInterest[String(g.home.teamId)] ?? 0;
    const top = Math.max(ai, hi);
    if (top > 0) {
      score += Math.round(top * 4.2);
      if (top >= 9) reasons.push("Your #1 team");
      else if (top >= 7) reasons.push("High interest team");
      else if (top >= 4) reasons.push("On your board");
    }
    if (ai >= 5 && hi >= 5) {
      score += 12;
      reasons.push("Both teams ranked");
    }

    const watchTeams = ctx.watchTeamIds;
    if (watchTeams?.size) {
      const awayWatched = watchTeams.has(String(g.away.teamId));
      const homeWatched = watchTeams.has(String(g.home.teamId));
      if (awayWatched || homeWatched) {
        score += awayWatched && homeWatched ? 26 : 18;
        reasons.push(
          awayWatched && homeWatched ? "Favorite players both sides" : "Favorite player team",
        );
      }
    }
    if (ctx.watchPlayerIds.size) {
      void ctx.watchPlayerIds;
    }
  }

  if (decided) score = Math.min(score, NFL_DECIDED_LIVE_CAP);

  const unique: string[] = [];
  for (const r of reasons) if (!unique.includes(r)) unique.push(r);
  return { score: Math.max(0, score), reasons: unique.slice(0, 5) };
}

export function rankRuwtNflGames<T extends NflScoreGame>(
  games: T[],
  interest: RuwtTeamInterest,
  limit = 20,
  opts?: { watchPlayerIds?: Set<string>; watchTeamIds?: Set<string> },
): (T & { score: number; reasons: string[] })[] {
  const ctx: NflRuwtContext = {
    teamInterest: interest,
    watchPlayerIds: opts?.watchPlayerIds ?? new Set(),
    watchTeamIds: opts?.watchTeamIds ?? new Set(),
  };
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreNflRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

function nhlClockSeconds(detail: string): number | null {
  const m = detail.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec > 59) return null;
  return min * 60 + sec;
}

function nhlEffectivelyDecided(diff: number, detail: string): boolean {
  if (diff !== 2) return false;
  if (!/\b3rd\b/.test(detail)) return false;
  const clock = nhlClockSeconds(detail);
  return clock != null && clock <= NHL_DECIDED_CLOCK_SEC;
}

export function scoreNhlRuwtGame(g: NhlScoreGame, ctx?: NhlRuwtContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const detail = `${g.shortDetail ?? ""} ${g.status ?? ""}`.toLowerCase();
  const inOt = /\bot\b|overtime|shootout|\bso\b/.test(detail);
  const liveDiff = Math.abs((g.away.score ?? 0) - (g.home.score ?? 0));
  const decided = g.live && !g.final && nhlEffectivelyDecided(liveDiff, detail);

  if (g.live) {
    score += 40;
    reasons.push("Live");
    const diff = liveDiff;
    if (!decided && diff <= 1) {
      score += 28;
      reasons.push("One-goal game");
    } else if (!decided && diff <= 2) {
      score += 14;
      reasons.push("Tight");
    }
    if (!decided && inOt) {
      score += 18;
      reasons.push("Overtime");
    } else if (!decided && /\b3rd\b/.test(detail) && diff <= 1) {
      score += 12;
      reasons.push("Late & close");
    }
  } else if (!g.final) {
    score += 12;
    reasons.push("Upcoming");
  } else {
    score += 2;
  }

  if (ctx) {
    const ai = ctx.teamInterest[String(g.away.teamId)] ?? 0;
    const hi = ctx.teamInterest[String(g.home.teamId)] ?? 0;
    const top = Math.max(ai, hi);
    if (top > 0) {
      score += Math.round(top * 4.2);
      if (top >= 9) reasons.push("Your #1 team");
      else if (top >= 7) reasons.push("High interest team");
      else if (top >= 4) reasons.push("On your board");
    }
    if (ai >= 5 && hi >= 5) {
      score += 12;
      reasons.push("Both teams ranked");
    }

    const watchTeams = ctx.watchTeamIds;
    if (watchTeams?.size) {
      const awayWatched = watchTeams.has(String(g.away.teamId));
      const homeWatched = watchTeams.has(String(g.home.teamId));
      if (awayWatched || homeWatched) {
        score += awayWatched && homeWatched ? 26 : 18;
        reasons.push(
          awayWatched && homeWatched ? "Favorite players both sides" : "Favorite player team",
        );
      }
    }
  }

  if (decided) score = Math.min(score, NHL_DECIDED_LIVE_CAP);

  const unique: string[] = [];
  for (const r of reasons) if (!unique.includes(r)) unique.push(r);
  return { score: Math.max(0, score), reasons: unique.slice(0, 5) };
}

export function rankRuwtNhlGames<T extends NhlScoreGame>(
  games: T[],
  interest: RuwtTeamInterest,
  limit = 20,
  opts?: { watchTeamIds?: Set<string> },
): (T & { score: number; reasons: string[] })[] {
  const ctx: NhlRuwtContext = {
    teamInterest: interest,
    watchTeamIds: opts?.watchTeamIds ?? new Set(),
  };
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreNhlRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

export function rankRuwtSoccerGames<T extends SoccerScoreGame>(
  games: T[],
  interest: RuwtTeamInterest,
  limit = 24,
): (T & { score: number; reasons: string[] })[] {
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

export function cfbInterestFloorForTeam(teamId: string | number): number {
  const key = String(teamId);
  if (CFB_SEC_TEAM_IDS.has(key)) return CFB_SEC_INTEREST_FLOOR;
  if (CFB_POWER5_TEAM_IDS.has(key)) return CFB_POWER5_INTEREST_FLOOR;
  return 0;
}

export function applyCfbInterestFloors(map: RuwtTeamInterest): RuwtTeamInterest {
  const next = { ...map };
  let changed = false;
  for (const id of CFB_POWER5_TEAM_IDS) {
    const floor = cfbInterestFloorForTeam(id);
    const cur = next[id] ?? 0;
    if (cur < floor) {
      next[id] = floor;
      changed = true;
    }
  }
  return changed ? next : map;
}

function parseRuwtClockSeconds(detail: string): number | null {
  const m = detail.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec > 59) return null;
  return min * 60 + sec;
}

export function cfbRecordLosses(record: string | null | undefined): number | null {
  if (record == null) return null;
  const match = record.trim().match(/^(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  const losses = Number(match[2]);
  return Number.isFinite(losses) ? losses : null;
}

export function cfbUndefeatedOrEquivalentStakes(
  awayRecord: string | null | undefined,
  homeRecord: string | null | undefined,
): boolean {
  const away = cfbRecordLosses(awayRecord);
  const home = cfbRecordLosses(homeRecord);
  if (away == null || home == null) return false;
  return away <= 1 && home <= 1;
}

export function cfbIsGameOfTheWeekMatchup(input: {
  bothRanked: boolean;
  bothSec: boolean;
  bothTopFpi: boolean;
  nationalMarquee: boolean;
  awayRecord: string | null;
  homeRecord: string | null;
}): boolean {
  return (
    input.bothRanked &&
    input.bothSec &&
    input.bothTopFpi &&
    input.nationalMarquee &&
    cfbUndefeatedOrEquivalentStakes(input.awayRecord, input.homeRecord)
  );
}

export function cfbTwoScoreBucketPoints(diff: number): number {
  if (diff <= 14) return 10;
  return -3;
}

export function cfbGotwTwoScoreEase(diff: number, gameOfTheWeek: boolean): number {
  if (!gameOfTheWeek || diff <= 8 || diff > 16) return 0;
  return CFB_GOTW_TWO_SCORE_CREDIT - cfbTwoScoreBucketPoints(diff);
}

export function cfbLiveQuarter(input: {
  period: number | null | undefined;
  detail: string;
  inOt: boolean;
}): 1 | 2 | 3 | 4 | 5 | null {
  if (input.inOt) return 5;
  const period = input.period ?? null;
  if (period === 1 || period === 2 || period === 3 || period === 4) return period;
  if (period != null && period >= 5) return 5;
  if (/\b4th\b/.test(input.detail)) return 4;
  if (/\b3rd\b/.test(input.detail)) return 3;
  if (/\b2nd\b/.test(input.detail)) return 2;
  if (/\b1st\b/.test(input.detail)) return 1;
  return null;
}

export function cfbSituationExtrasCount(input: {
  quarter: 1 | 2 | 3 | 4 | 5 | null;
  ranked: boolean;
  bestFpi: number | null;
  nationalMarquee: boolean;
}): boolean {
  if (input.quarter !== 1 && input.quarter !== 2) return true;
  if (input.ranked || input.nationalMarquee) return true;
  if (input.bestFpi != null && input.bestFpi <= CFB_SITUATION_FPI_LINE) return true;
  return false;
}

export function cfbRankingWinPct(
  barLeaderPct: number | null | undefined,
  lastPlayLeaderPct: number | null | undefined,
): number | null {
  if (typeof barLeaderPct === "number" && Number.isFinite(barLeaderPct)) return barLeaderPct;
  if (typeof lastPlayLeaderPct === "number" && Number.isFinite(lastPlayLeaderPct)) {
    return lastPlayLeaderPct;
  }
  return null;
}

export function cfbEffectivelyDecided(input: {
  diff: number | null;
  late: boolean;
  clockSec: number | null;
  leaderWinPct: number | null;
}): boolean {
  const wp = input.leaderWinPct;
  if (wp != null && Number.isFinite(wp)) return wp >= CFB_DECIDED_WIN_PCT;
  if (input.diff == null || input.diff < 9 || input.diff > 16) return false;
  if (!input.late) return false;
  if (input.clockSec == null || input.clockSec > CFB_DECIDED_CLOCK_SEC) return false;
  return true;
}

export function scoreCfbRuwtGame(g: CfbScoreGame, ctx?: CfbRuwtContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const diff =
    g.away.score != null && g.home.score != null
      ? Math.abs(g.away.score - g.home.score)
      : null;
  const detail = `${g.shortDetail ?? ""} ${g.status ?? ""}`.toLowerCase();
  const period = g.period;
  const inOt = (period != null && period >= 5) || /\bot\b|overtime/.test(detail);
  const lateGame = inOt || period === 4 || /\b4th\b/.test(detail);
  const clockSec = parseRuwtClockSeconds(detail) ?? (/end of 4th|end 4th/.test(detail) ? 0 : null);
  const decided =
    g.live &&
    !g.final &&
    diff != null &&
    diff <= 16 &&
    cfbEffectivelyDecided({
      diff,
      late: lateGame,
      clockSec,
      leaderWinPct: cfbRankingWinPct(g.barLeaderWinPct, g.situation?.leaderWinPct),
    });

  const nets = g.broadcasts.map((b) => b.name.toUpperCase());
  const bigFour = nets.some((n) => /\b(ABC|CBS|NBC|FOX)\b/.test(n));
  const cableNational = nets.some((n) => /\b(TNT|TBS|USA|PEACOCK|NETFLIX)\b/.test(n));
  const rankedLive = Boolean(
    (g.away.rank && g.away.rank <= 25) || (g.home.rank && g.home.rank <= 25),
  );
  const fpiRanks = [g.away.fpiRank, g.home.fpiRank].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  const situationExtras = cfbSituationExtrasCount({
    quarter: cfbLiveQuarter({ period, detail, inOt }),
    ranked: rankedLive,
    bestFpi: fpiRanks.length ? Math.min(...fpiRanks) : null,
    nationalMarquee: bigFour,
  });
  const extra = (points: number) => {
    if (situationExtras) score += points;
  };

  if (g.live) {
    score += 40;
    reasons.push("Live");
    if (diff != null) {
      if (!decided && diff <= 8) {
        score += 28;
        reasons.push("One-score game");
        if (diff <= 3) {
          extra(6);
          reasons.push("Within a kick");
        }
      } else if (!decided && diff <= 14) {
        score += 10;
        reasons.push("Tight");
      } else if (diff >= 28) {
        score -= rankedLive ? 18 : 20;
        reasons.push("Blowout");
      } else if (diff >= 21) {
        score -= rankedLive ? 10 : 14;
        reasons.push("Blowout");
      } else if (!decided) {
        score -= rankedLive ? 3 : 8;
      }
    }
    if (!decided && inOt) {
      score += 32;
      reasons.push("Overtime");
    } else if (!decided && (diff == null || diff <= 14 || (rankedLive && diff <= 21))) {
      if (period === 4 || /\b4th\b/.test(detail)) {
        score += diff != null && diff > 14 ? 10 : 18;
        reasons.push("4th quarter");
      } else if (period === 3 || /\b3rd\b/.test(detail)) {
        score += diff != null && diff > 14 ? 4 : 8;
        reasons.push("3rd quarter");
      }
    }
    if (!decided && diff != null && diff <= 8 && (inOt || period === 4 || /\b4th\b/.test(detail))) {
      const clockSecs = parseRuwtClockSeconds(detail);
      if (clockSecs != null && clockSecs <= 120) {
        if (clockSecs <= 30) {
          score += 22;
          reasons.push("Closing seconds");
        } else if (clockSecs <= 60) {
          score += 16;
          reasons.push("Final minute");
        } else {
          score += 10;
          reasons.push("Two-minute drill");
        }
      }
    }
    if (!decided && g.situation?.isRedZone && (diff == null || diff <= 14)) {
      extra(18);
      reasons.push("Red zone");
    }
    if (
      !decided &&
      g.situation?.downDistanceText?.startsWith("4th") &&
      (diff == null || diff <= 14) &&
      (period === 4 || period === 3 || /\b4th\b/.test(detail) || /\b3rd\b/.test(detail) || inOt)
    ) {
      score += 12;
      reasons.push("4th down");
    }
  } else if (!g.final) {
    score += 8;
    reasons.push("Upcoming");
  } else {
    score += 2;
  }

  const awayRank = g.away.rank;
  const homeRank = g.home.rank;
  const awayFpi = g.away.fpiRank;
  const homeFpi = g.home.fpiRank;
  const bothRanked = Boolean(awayRank && homeRank && awayRank <= 25 && homeRank <= 25);
  const oneRanked = Boolean((awayRank && awayRank <= 25) || (homeRank && homeRank <= 25));
  if (bothRanked) {
    const best = Math.min(awayRank!, homeRank!);
    const bump = best <= 10 ? 40 : best <= 15 ? 36 : 32;
    score += bump;
    reasons.push("Ranked matchup");
  } else if (oneRanked) {
    const rankedSide = awayRank && awayRank <= 25 ? awayRank : homeRank!;
    const bump = rankedSide <= 10 ? 34 : rankedSide <= 15 ? 30 : 26;
    score += bump;
    reasons.push("Ranked team");
    const otherFpi = awayRank ? homeFpi : awayFpi;
    if (otherFpi != null && otherFpi <= 25) {
      score += 10;
      reasons.push("Quality foe");
    }
  } else if (awayFpi != null && homeFpi != null) {
    const bestFpi = Math.min(awayFpi, homeFpi);
    const worstFpi = Math.max(awayFpi, homeFpi);
    if (worstFpi <= 40) {
      score += bestFpi <= 25 ? 20 : 16;
      reasons.push("FPI quality");
    } else if (bestFpi <= 25 && worstFpi <= 55) {
      score += 12;
      reasons.push("FPI quality");
    }
  }

  const bothTopFpi = awayFpi != null && homeFpi != null && awayFpi <= 25 && homeFpi <= 25;
  if (bothTopFpi) {
    score += 12;
    reasons.push("Top FPI clash");
  } else if (
    awayFpi != null &&
    homeFpi != null &&
    Math.min(awayFpi, homeFpi) <= 25 &&
    Math.max(awayFpi, homeFpi) <= 40
  ) {
    score += 8;
    reasons.push("Quality slate");
  }

  const odds = g.odds;
  const spread = odds?.spread ?? null;
  const absSpread = spread != null ? Math.abs(spread) : null;
  const avgFpi = awayFpi != null && homeFpi != null ? (awayFpi + homeFpi) / 2 : null;
  const lineQuality =
    bothRanked || oneRanked || (avgFpi != null && avgFpi <= 50)
      ? 1
      : avgFpi != null && avgFpi <= 80
        ? 0.55
        : 0.35;
  if (absSpread != null) {
    if (absSpread <= 3) {
      const pts = Math.round(18 * lineQuality);
      score += pts;
      reasons.push(odds?.details ? `Pick'em (${odds.details})` : "Pick'em line");
    } else if (absSpread <= 7) {
      const pts = Math.round(12 * Math.max(lineQuality, 0.5));
      score += pts;
      reasons.push(odds?.details ? `Close line (${odds.details})` : "Close line");
    } else if (absSpread <= 10.5) {
      score += bothRanked || oneRanked ? 10 : 6;
      reasons.push("Competitive line");
    } else if (absSpread >= 28) {
      score -= 14;
      reasons.push("Heavy chalk");
    } else if (absSpread >= 17) {
      score -= 8;
      reasons.push("Lopsided line");
    }
  }

  const favId = odds?.favoriteTeamId ?? null;
  if (favId != null && awayFpi != null && homeFpi != null) {
    const favFpi = favId === g.away.teamId ? awayFpi : favId === g.home.teamId ? homeFpi : null;
    const dogFpi = favId === g.away.teamId ? homeFpi : favId === g.home.teamId ? awayFpi : null;
    if (favFpi != null && dogFpi != null && favFpi > dogFpi + 2) {
      score += 10;
      reasons.push("Market vs FPI");
    }
  }

  const dogSide =
    favId != null
      ? favId === g.away.teamId
        ? g.home
        : favId === g.home.teamId
          ? g.away
          : null
      : null;
  const favSide =
    favId != null
      ? favId === g.away.teamId
        ? g.away
        : favId === g.home.teamId
          ? g.home
          : null
      : null;

  if (!g.live && !g.final && favSide && dogSide && absSpread != null && absSpread >= 2.5) {
    const dogRanked = dogSide.rank != null && dogSide.rank <= 25;
    const favRanked = favSide.rank != null && favSide.rank <= 25;
    const dogTopFpi = dogSide.fpiRank != null && dogSide.fpiRank <= 25;
    const fpiGap =
      favSide.fpiRank != null && dogSide.fpiRank != null
        ? Math.abs(favSide.fpiRank - dogSide.fpiRank)
        : null;
    if (dogRanked) {
      score += 18;
      reasons.push("Ranked underdog");
    } else if (favRanked && dogTopFpi) {
      score += 14;
      reasons.push("Upset spot");
    } else if (favRanked && dogSide.fpiRank != null && dogSide.fpiRank <= 40 && absSpread >= 7) {
      score += 10;
      reasons.push("Upset spot");
    } else if (fpiGap != null && fpiGap <= 8 && absSpread >= 7) {
      score += 10;
      reasons.push("Upset spot");
    }
  }

  if (!decided && g.live && g.away.score != null && g.home.score != null) {
    const fpiGap = awayFpi != null && homeFpi != null ? Math.abs(awayFpi - homeFpi) : null;
    let chalkId = favId;
    if (chalkId == null && awayFpi != null && homeFpi != null && fpiGap != null && fpiGap >= 12) {
      chalkId = awayFpi < homeFpi ? g.away.teamId : g.home.teamId;
    }
    if (chalkId != null) {
      const chalkScore =
        chalkId === g.away.teamId
          ? g.away.score
          : chalkId === g.home.teamId
            ? g.home.score
            : null;
      const dogScore =
        chalkId === g.away.teamId
          ? g.home.score
          : chalkId === g.home.teamId
            ? g.away.score
            : null;
      if (chalkScore != null && dogScore != null && dogScore > chalkScore) {
        const gap = fpiGap ?? (absSpread != null ? absSpread * 4 : 20);
        const base = gap >= 50 ? 36 : gap >= 30 ? 30 : gap >= 18 ? 26 : 22;
        const earlyBonus =
          gap >= 25 && (period === 1 || period === 2 || /\b1st\b|\b2nd\b/.test(detail)) ? 6 : 0;
        extra(base + earlyBonus);
        reasons.push(gap >= 25 ? "Upset brewing" : "Upset watch");
      } else if (chalkScore != null && dogScore != null && chalkScore > dogScore) {
        const favMargin = chalkScore - dogScore;
        const gap = fpiGap ?? (absSpread != null ? absSpread * 4 : null);
        const lateClose = favMargin <= 8 && (inOt || period === 4 || /\b4th\b/.test(detail));
        if (gap != null && gap >= 30 && lateClose) {
          extra(gap >= 50 ? 14 : 10);
          reasons.push("Upset alive");
        } else if (
          gap != null &&
          gap >= 40 &&
          favMargin <= 21 &&
          ((chalkId === g.away.teamId && g.away.rank != null && g.away.rank <= 25) ||
            (chalkId === g.home.teamId && g.home.rank != null && g.home.rank <= 25) ||
            gap >= 55)
        ) {
          const closeness = 21 - favMargin;
          const gapBonus = gap >= 70 ? 8 : gap >= 55 ? 5 : 3;
          extra(14 + Math.round(closeness * 0.7) + gapBonus);
          reasons.push(favMargin <= 14 ? "Closest upset" : "Upset watch");
        } else if (
          absSpread != null &&
          absSpread >= 3 &&
          favId != null &&
          favMargin < absSpread - 0.5 &&
          favMargin <= 10
        ) {
          extra(8);
          reasons.push("Against the number");
        }
      }
    }
  }

  if (bigFour) {
    score += 8;
    reasons.push("National TV");
    const secOnField =
      CFB_SEC_TEAM_IDS.has(String(g.away.teamId)) || CFB_SEC_TEAM_IDS.has(String(g.home.teamId));
    const qualityLive =
      bothRanked ||
      oneRanked ||
      secOnField ||
      (avgFpi != null && avgFpi <= 45) ||
      (awayFpi != null && homeFpi != null && Math.max(awayFpi, homeFpi) <= 40);
    if (g.live && qualityLive) {
      score += 14;
      reasons.push("Marquee");
    }
  } else if (cableNational) {
    score += 6;
    reasons.push("National TV");
  } else if (nets.some((n) => /ESPN|ESPN2|FOX SPORTS|FS1/.test(n))) {
    score += 4;
  }

  if (!decided && g.live && !g.final && diff != null) {
    const bothSec =
      CFB_SEC_TEAM_IDS.has(String(g.away.teamId)) && CFB_SEC_TEAM_IDS.has(String(g.home.teamId));
    const ease = cfbGotwTwoScoreEase(
      diff,
      cfbIsGameOfTheWeekMatchup({
        bothRanked,
        bothSec,
        bothTopFpi,
        nationalMarquee: bigFour,
        awayRecord: g.away.record,
        homeRecord: g.home.record,
      }),
    );
    if (ease > 0) {
      score += ease;
      reasons.push("Game of the week");
    }
  }

  for (const side of [g.away, g.home]) {
    const interest = ctx?.teamInterest[String(side.teamId)] ?? 0;
    if (interest >= 2) {
      score += interest * 3;
      reasons.push(`${side.abbrev} interest ${interest}`);
    }
    if (ctx?.watchTeamIds?.has(String(side.teamId))) {
      score += 12;
      reasons.push(`Watch ${side.abbrev}`);
    }
  }

  if (g.final && diff != null && diff <= 7) {
    score += 10;
    reasons.push("Close final");
  }

  if (decided) score = Math.min(score, CFB_DECIDED_LIVE_CAP);

  return { score: Math.max(0, score), reasons: [...new Set(reasons)].slice(0, 6) };
}

export function rankRuwtCfbGames<T extends CfbScoreGame>(
  games: T[],
  interest: RuwtTeamInterest,
  limit = 24,
  opts?: { watchTeamIds?: Set<string> },
): (T & { score: number; reasons: string[] })[] {
  const ctx: CfbRuwtContext = {
    teamInterest: applyCfbInterestFloors(interest),
    watchTeamIds: opts?.watchTeamIds,
  };
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreCfbRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}
