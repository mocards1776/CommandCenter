/**
 * Game-detail adapters for moment alerts.
 * Reads the same sports boxscore / ESPN summaries the pages already poll.
 * Does not import the MLB 2D PBP panel.
 */

import { mlbHeadshot, mlbTeamLogo, type MlbBoxscore } from "./mlb";
import { nhlHeadshot, type NhlGameDetail } from "./nhl";
import { nflHeadshot, nflTeamLogo, type NflGameDetail } from "./nfl";
import type { CfbGameDetail } from "./cfb";
import {
  shortMomentName,
  type GameMomentSnapshot,
  type GameMomentTeam,
  type ScoringPlaySnap,
} from "./game-moments";

/** MLB game-detail boxscore — same feed as the live matchup header. */
export function toMlbBoxMomentSnapshot(box: MlbBoxscore): GameMomentSnapshot {
  const batters = [...box.away.batters, ...box.home.batters];
  const homeRuns = batters.reduce((n, b) => n + (b.hr ?? 0), 0);
  const rbi = batters.reduce((n, b) => n + (b.rbi ?? 0), 0);
  const sit = box.situation?.batter ?? box.situation?.batterCard ?? null;
  const batter = sit
    ? {
        id: String(sit.id),
        name: sit.name,
        shortName: shortMomentName(sit.name),
        headshot: mlbHeadshot(sit.id),
      }
    : null;
  return {
    sport: "mlb",
    gameId: String(box.gamePk),
    live: box.live,
    away: {
      id: String(box.away.teamId),
      abbrev: box.away.abbrev,
      name: box.away.name,
      logo: box.away.teamId ? mlbTeamLogo(box.away.teamId) : null,
      color: box.away.primaryColor || null,
      score: box.away.runs,
    },
    home: {
      id: String(box.home.teamId),
      abbrev: box.home.abbrev,
      name: box.home.name,
      logo: box.home.teamId ? mlbTeamLogo(box.home.teamId) : null,
      color: box.home.primaryColor || null,
      score: box.home.runs,
    },
    periodLabel: box.inning,
    scoringPlays: [],
    recentScoring: [],
    signals: { homeRuns, rbi, batter },
  };
}

export function toNhlMomentSnapshot(g: NhlGameDetail): GameMomentSnapshot {
  const away: GameMomentTeam & { score: number } = {
    id: String(g.away.teamId),
    abbrev: g.away.abbrev,
    name: g.away.name,
    logo: g.away.logo,
    color: g.away.color,
    score: g.away.score ?? 0,
  };
  const home: GameMomentTeam & { score: number } = {
    id: String(g.home.teamId),
    abbrev: g.home.abbrev,
    name: g.home.name,
    logo: g.home.logo,
    color: g.home.color,
    score: g.home.score ?? 0,
  };
  const scoringPlays: ScoringPlaySnap[] = g.scoringPlays.map((p) => {
    const scorer = p.athletes.find((a) => /scorer|goal/i.test(a.role)) ?? p.athletes[0] ?? null;
    return {
      id: p.id,
      text: p.text,
      clock: p.clock,
      period: p.period ?? p.periodNumber,
      teamId: p.teamId,
      teamAbbrev:
        p.teamId === String(g.away.teamId)
          ? g.away.abbrev
          : p.teamId === String(g.home.teamId)
            ? g.home.abbrev
            : null,
      awayScore: p.awayScore,
      homeScore: p.homeScore,
      strength: p.strength,
      tags: p.strength ? [p.strength] : [],
      eventType: "goal",
      rbi: null,
      player: scorer
        ? {
            id: scorer.id,
            name: scorer.name,
            shortName: shortMomentName(scorer.name),
            headshot: scorer.id ? nhlHeadshot(scorer.id) : null,
          }
        : null,
    };
  });
  const recentScoring: ScoringPlaySnap[] = g.recentPlays
    .filter((p) => p.scoringPlay)
    .map((p) => ({
      id: p.id,
      text: p.text,
      clock: p.clock,
      period: p.period,
      teamId: p.teamId,
      teamAbbrev: null,
      awayScore: p.awayScore,
      homeScore: p.homeScore,
      strength: null,
      tags: [],
      eventType: "goal",
      rbi: null,
      player: p.athlete
        ? {
            id: p.athlete.id,
            name: p.athlete.name,
            shortName: shortMomentName(p.athlete.name),
            headshot: p.athlete.headshot ?? (p.athlete.id ? nhlHeadshot(p.athlete.id) : null),
          }
        : null,
    }));
  return {
    sport: "nhl",
    gameId: g.id,
    live: g.live,
    away,
    home,
    periodLabel: g.shortDetail,
    scoringPlays,
    recentScoring,
  };
}

function footballTeam(
  side: { teamId: number; name: string; abbrev: string; score: number | null; logo: string | null; color: string },
  fallbackLogo: string | null,
): GameMomentTeam & { score: number } {
  return {
    id: String(side.teamId),
    abbrev: side.abbrev,
    name: side.name,
    logo: side.logo ?? fallbackLogo,
    color: side.color,
    score: side.score ?? 0,
  };
}

export function toNflMomentSnapshot(g: NflGameDetail): GameMomentSnapshot {
  const away = footballTeam(g.away, nflTeamLogo(g.away.abbrev));
  const home = footballTeam(g.home, nflTeamLogo(g.home.abbrev));
  const scoringPlays: ScoringPlaySnap[] = g.scoringPlays.map((p) => ({
    id: p.id,
    text: p.text,
    clock: p.clock,
    period: null,
    teamId: null,
    teamAbbrev: p.teamAbbrev,
    awayScore: null,
    homeScore: null,
    strength: null,
    tags: [],
    eventType: null,
    rbi: null,
    player: null,
  }));
  const recentScoring: ScoringPlaySnap[] = g.recentPlays
    .filter((p) => p.scoringPlay)
    .map((p) => {
      const athlete = p.athletes[0] ?? null;
      return {
        id: p.id,
        text: p.text,
        clock: p.clock,
        period: p.period,
        teamId: p.possessionTeamId,
        teamAbbrev: null,
        awayScore: null,
        homeScore: null,
        strength: null,
        tags: [],
        eventType: null,
        rbi: null,
        player: athlete
          ? {
              id: athlete.id,
              name: athlete.name,
              shortName: (athlete.shortName || shortMomentName(athlete.name)).toUpperCase(),
              headshot: athlete.id ? nflHeadshot(athlete.id) : null,
            }
          : null,
      };
    });
  return {
    sport: "nfl",
    gameId: g.id,
    live: g.live,
    away,
    home,
    periodLabel: g.shortDetail,
    scoringPlays,
    recentScoring,
  };
}

export function toCfbMomentSnapshot(g: CfbGameDetail): GameMomentSnapshot {
  const away = footballTeam(g.away, g.away.logo);
  const home = footballTeam(g.home, g.home.logo);
  const scoringPlays: ScoringPlaySnap[] = g.scoringPlays.map((p) => ({
    id: p.id,
    text: p.text,
    clock: p.clock,
    period: null,
    teamId: null,
    teamAbbrev: p.teamAbbrev,
    awayScore: null,
    homeScore: null,
    strength: null,
    tags: [],
    eventType: null,
    rbi: null,
    player: null,
  }));
  const recentScoring: ScoringPlaySnap[] = g.recentPlays
    .filter((p) => p.scoringPlay)
    .map((p) => ({
      id: p.id,
      text: p.text,
      clock: p.clock,
      period: p.period,
      teamId: p.scoringTeamId ?? p.possessionTeamId,
      teamAbbrev: null,
      awayScore: p.awayScore,
      homeScore: p.homeScore,
      strength: null,
      tags: p.tags,
      eventType: p.tone,
      rbi: null,
      player: null,
    }));
  return {
    sport: "cfb",
    gameId: g.id,
    live: g.live,
    away,
    home,
    periodLabel: g.shortDetail,
    scoringPlays,
    recentScoring,
  };
}
