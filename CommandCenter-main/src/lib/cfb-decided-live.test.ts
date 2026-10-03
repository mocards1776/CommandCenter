/**
 * Run from CommandCenter-main/:
 *   node scripts/ruwt-score-test.mjs
 *
 * Live ranking is the sport scorer. A game that is effectively over cannot
 * sit above a one-score game that is still in doubt. These assert the scores
 * the scorers return, not a parallel copy of the weights.
 */
import { mapCfbSituation, scoreCfbRuwtGame, type CfbScoreGame } from "./cfb.ts";
import {
  CFB_DECIDED_LIVE_CAP,
  CFB_DECIDED_WIN_PCT,
  cfbEffectivelyDecided,
  cfbLeaderWinPct,
} from "./cfb-live-margin.ts";
import { scoreGameInterest, type MlbScoreGame } from "./mlb.ts";
import { scoreNflRuwtGame, type NflScoreGame } from "./nfl.ts";
import { scoreNhlRuwtGame, type NhlScoreGame } from "./nhl.ts";
import { rankRuwtSoccerGames, type SoccerScoreGame } from "./soccer.ts";

const assert = {
  equal(actual: unknown, expected: unknown, message?: string) {
    if (actual !== expected) {
      throw new Error(`${message ? `${message}: ` : ""}expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  deep(actual: readonly string[], expected: readonly string[], message?: string) {
    const a = actual.join(" · ");
    const b = expected.join(" · ");
    if (a !== b) throw new Error(message ?? `expected [${b}], got [${a}]`);
  },
  ok(cond: unknown, message = "assertion failed") {
    if (!cond) throw new Error(message);
  },
};

/** One-score NFL / NHL / CFB live floor: live 40 + one-score 28. */
const ONE_SCORE_OTHER_SPORT = 68;

assert.equal(CFB_DECIDED_WIN_PCT, 97);
assert.equal(CFB_DECIDED_LIVE_CAP, 49);
assert.equal(cfbLeaderWinPct(0.1, 99.9), 99.9);
assert.equal(cfbLeaderWinPct(null, null), null);
assert.ok(
  cfbEffectivelyDecided({ diff: 11, late: true, clockSec: 2 * 60 + 36, leaderWinPct: 99.9 }),
  "99.9% is over",
);
assert.ok(
  !cfbEffectivelyDecided({ diff: 11, late: true, clockSec: 2 * 60 + 36, leaderWinPct: 70 }),
  "a published 70% overrides the clock",
);
assert.ok(
  !cfbEffectivelyDecided({ diff: 6, late: true, clockSec: 4 * 60, leaderWinPct: 88.9 }),
  "88.9% one-score is still in doubt",
);
assert.ok(
  cfbEffectivelyDecided({ diff: 11, late: true, clockSec: 2 * 60 + 36, leaderWinPct: null }),
  "two scores and 2:36 with no win chance is over",
);
assert.ok(
  !cfbEffectivelyDecided({ diff: 6, late: true, clockSec: 4 * 60, leaderWinPct: null }),
  "one score with time left and no win chance stays in doubt",
);
assert.ok(
  !cfbEffectivelyDecided({ diff: 14, late: false, clockSec: 12 * 60, leaderWinPct: null }),
  "a two-score game in the 2nd quarter is not decided",
);
assert.ok(
  !cfbEffectivelyDecided({ diff: 24, late: true, clockSec: 60, leaderWinPct: null }),
  "three scores stay on the blowout path when win chance is missing",
);

const mapped = mapCfbSituation(
  {
    isRedZone: true,
    downDistanceText: "1st & 10",
    lastPlay: {
      text: "rush",
      probability: { homeWinPercentage: 0.001, awayWinPercentage: 0.999 },
    },
  },
  true,
);
assert.equal(mapped?.leaderWinPct, 99.9, "scoreboard last-play probability reaches the scorer");

function cfbSide(
  partial: Partial<CfbScoreGame["away"]> & { teamId: number; abbrev: string; score: number | null },
): CfbScoreGame["away"] {
  return {
    name: partial.abbrev,
    record: partial.record ?? null,
    logo: null,
    color: "002b5c",
    rank: partial.rank ?? null,
    fpiRank: partial.fpiRank ?? null,
    linescores: [],
    ...partial,
  };
}

function cfbGame(partial: Partial<CfbScoreGame> & Pick<CfbScoreGame, "id" | "away" | "home">): CfbScoreGame {
  return {
    status: partial.shortDetail ?? "Live",
    shortDetail: partial.shortDetail ?? null,
    live: partial.live ?? true,
    final: partial.final ?? false,
    when: null,
    whenShort: null,
    venue: null,
    date: null,
    broadcasts: partial.broadcasts ?? [],
    period: partial.period ?? null,
    situation: partial.situation ?? null,
    odds: partial.odds ?? null,
    ...partial,
  };
}

function sit(
  leaderWinPct: number | null,
  extra?: Partial<NonNullable<CfbScoreGame["situation"]>>,
): NonNullable<CfbScoreGame["situation"]> {
  return {
    downDistanceText: null,
    possessionText: null,
    yardLine: null,
    isRedZone: false,
    possessionTeamId: null,
    lastPlayText: null,
    homeTimeouts: null,
    awayTimeouts: null,
    leaderWinPct,
    ...extra,
  };
}

// The reported shape: two scores, 2:36 in the 4th, leader 99.9%, red zone, one top-10 team.
// Closeness + 4th quarter + red zone + closest-upset used to stack to 160 before interest.
const decidedLate = scoreCfbRuwtGame(
  cfbGame({
    id: "decided-late",
    shortDetail: "2:36 - 4th",
    period: 4,
    away: cfbSide({ teamId: 1001, abbrev: "A", score: 37, rank: 3, fpiRank: 8, record: "5-0" }),
    home: cfbSide({ teamId: 1002, abbrev: "B", score: 26, rank: null, fpiRank: 51, record: "2-1" }),
    broadcasts: [{ name: "ESPN", logo: null, market: "national" }],
    situation: sit(99.9, { isRedZone: true, downDistanceText: "1st & Goal" }),
  }),
);
assert.equal(decidedLate.score, 49, "decided late two-score caps at 49");
assert.deep(decidedLate.reasons, ["Live", "Ranked team"]);
assert.ok(!decidedLate.reasons.includes("Tight"), decidedLate.reasons.join(" · "));
assert.ok(!decidedLate.reasons.includes("Closest upset"), decidedLate.reasons.join(" · "));
assert.ok(!decidedLate.reasons.includes("4th quarter"), decidedLate.reasons.join(" · "));
assert.ok(!decidedLate.reasons.includes("Red zone"), decidedLate.reasons.join(" · "));

// Same teams, a favorite slider on both sides. The cap still holds.
const decidedFavorite = scoreCfbRuwtGame(
  cfbGame({
    id: "decided-favorite",
    shortDetail: "2:36 - 4th",
    period: 4,
    away: cfbSide({ teamId: 1001, abbrev: "A", score: 37, rank: 3, fpiRank: 8, record: "5-0" }),
    home: cfbSide({ teamId: 1002, abbrev: "B", score: 26, rank: null, fpiRank: 51, record: "2-1" }),
    broadcasts: [{ name: "ESPN", logo: null, market: "national" }],
    situation: sit(99.9, { isRedZone: true }),
  }),
  { teamInterest: { "1001": 10, "1002": 10 } },
);
assert.equal(decidedFavorite.score, 49, "a favorite nudge cannot lift a decided game");

// One score, 4:12 in the 4th, leader 61%. Still in doubt.
const oneScoreDoubt = scoreCfbRuwtGame(
  cfbGame({
    id: "one-score",
    shortDetail: "4:12 - 4th",
    period: 4,
    away: cfbSide({ teamId: 2001, abbrev: "C", score: 14, record: "3-1" }),
    home: cfbSide({ teamId: 2002, abbrev: "D", score: 20, record: "3-1" }),
    situation: sit(61.2),
  }),
);
assert.equal(oneScoreDoubt.score, 86, "one-score 4th quarter is live 40 + 28 + 18");
assert.deep(oneScoreDoubt.reasons, ["Live", "One-score game", "4th quarter"]);
assert.ok(decidedLate.score < oneScoreDoubt.score, `${decidedLate.score} should trail ${oneScoreDoubt.score}`);

// No win chance on the row: two scores and 2:36 still falls under that one-score game.
const decidedNoWp = scoreCfbRuwtGame(
  cfbGame({
    id: "decided-no-wp",
    shortDetail: "2:36 - 4th",
    period: 4,
    away: cfbSide({ teamId: 3001, abbrev: "E", score: 31 }),
    home: cfbSide({ teamId: 3002, abbrev: "F", score: 20 }),
    situation: sit(null),
  }),
);
assert.equal(decidedNoWp.score, 40, "no win chance, two scores, 2:36 is live only");
assert.deep(decidedNoWp.reasons, ["Live"]);
assert.ok(decidedNoWp.score < oneScoreDoubt.score);

// 70% with 2:36 is still a game. The clock does not override a published win chance.
const stillDoubt = scoreCfbRuwtGame(
  cfbGame({
    id: "wp-70",
    shortDetail: "2:36 - 4th",
    period: 4,
    away: cfbSide({ teamId: 3003, abbrev: "G", score: 24 }),
    home: cfbSide({ teamId: 3004, abbrev: "H", score: 13 }),
    situation: sit(70),
  }),
);
assert.equal(stillDoubt.score, 68, "70% two-score late is live 40 + tight 10 + 4th 18");
assert.deep(stillDoubt.reasons, ["Live", "Tight", "4th quarter"]);

// Game of the week, two scores, 2nd quarter, 62%. Not decided. Still beats a lesser one-score.
const gotw = scoreCfbRuwtGame(
  cfbGame({
    id: "gotw",
    shortDetail: "12:00 - 2nd",
    period: 2,
    away: cfbSide({ teamId: 99, abbrev: "LSU", score: 14, rank: 5, fpiRank: 4, record: "5-0" }),
    home: cfbSide({ teamId: 333, abbrev: "ALA", score: 28, rank: 8, fpiRank: 6, record: "4-0" }),
    broadcasts: [{ name: "ABC", logo: null, market: "national" }],
    situation: sit(62),
  }),
);
assert.equal(gotw.score, 138, "two-score game of the week still in doubt");
assert.ok(gotw.reasons.includes("Tight"), gotw.reasons.join(" · "));

const lesserOneScore = scoreCfbRuwtGame(
  cfbGame({
    id: "lesser",
    shortDetail: "12:00 - 2nd",
    period: 2,
    away: cfbSide({ teamId: 4001, abbrev: "J", score: 10, rank: 3 }),
    home: cfbSide({ teamId: 4002, abbrev: "K", score: 13 }),
    situation: sit(58, { isRedZone: true }),
  }),
);
assert.equal(lesserOneScore.score, 126, "lesser one-score is live 40 + 28 + 6 + red zone 18 + ranked 34");
assert.ok(gotw.score > lesserOneScore.score, `${gotw.score} should beat ${lesserOneScore.score}`);

const lesserOneScoreFourth = scoreCfbRuwtGame(
  cfbGame({
    id: "lesser-4th",
    shortDetail: "8:00 - 4th",
    period: 4,
    away: cfbSide({ teamId: 4001, abbrev: "J", score: 10, rank: 3 }),
    home: cfbSide({ teamId: 4002, abbrev: "K", score: 13 }),
    situation: sit(58, { isRedZone: true }),
  }),
);
assert.equal(lesserOneScoreFourth.score, 144, "4th-quarter lesser one-score adds 18");
assert.ok(gotw.score < lesserOneScoreFourth.score);

const gotwOneScore = scoreCfbRuwtGame(
  cfbGame({
    id: "gotw-one",
    shortDetail: "12:00 - 2nd",
    period: 2,
    away: cfbSide({ teamId: 99, abbrev: "LSU", score: 21, rank: 5, fpiRank: 4, record: "5-0" }),
    home: cfbSide({ teamId: 333, abbrev: "ALA", score: 14, rank: 8, fpiRank: 6, record: "4-0" }),
    broadcasts: [{ name: "ABC", logo: null, market: "national" }],
    situation: sit(60),
  }),
);
assert.equal(gotwOneScore.score, 142, "one-score version of the same game");
assert.ok(gotwOneScore.score > gotw.score);

// Same marquee, two scores, but the win chance says it is over. The ease does not apply.
const gotwDecided = scoreCfbRuwtGame(
  cfbGame({
    id: "gotw-over",
    shortDetail: "12:00 - 2nd",
    period: 2,
    away: cfbSide({ teamId: 99, abbrev: "LSU", score: 14, rank: 5, fpiRank: 4, record: "5-0" }),
    home: cfbSide({ teamId: 333, abbrev: "ALA", score: 28, rank: 8, fpiRank: 6, record: "4-0" }),
    broadcasts: [{ name: "ABC", logo: null, market: "national" }],
    situation: sit(99.9),
  }),
);
assert.equal(gotwDecided.score, 49, "a decided game of the week does not keep the two-score ease");
assert.ok(!gotwDecided.reasons.includes("Tight"), gotwDecided.reasons.join(" · "));
assert.ok(!gotwDecided.reasons.includes("Game of the week"), gotwDecided.reasons.join(" · "));
assert.ok(gotwDecided.score < oneScoreDoubt.score);
assert.ok(gotwDecided.score < lesserOneScore.score);

const unrankedBlowout = scoreCfbRuwtGame(
  cfbGame({
    id: "blowout",
    shortDetail: "8:00 - 3rd",
    period: 3,
    away: cfbSide({ teamId: 5001, abbrev: "M", score: 42 }),
    home: cfbSide({ teamId: 5002, abbrev: "N", score: 7 }),
    situation: sit(null),
  }),
);
assert.equal(unrankedBlowout.score, 20, "unranked three-score blowout is live 40 − 20");
assert.ok(unrankedBlowout.reasons.includes("Blowout"));
assert.ok(
  unrankedBlowout.score < ONE_SCORE_OTHER_SPORT,
  `${unrankedBlowout.score} should lose to a one-score game in another sport ${ONE_SCORE_OTHER_SPORT}`,
);

const rankedBlowout = scoreCfbRuwtGame(
  cfbGame({
    id: "ranked-blowout",
    shortDetail: "6:00 - 4th",
    period: 4,
    away: cfbSide({ teamId: 5003, abbrev: "P", score: 45, rank: 4 }),
    home: cfbSide({ teamId: 5004, abbrev: "Q", score: 17 }),
    situation: sit(99.9),
  }),
);
assert.equal(rankedBlowout.score, 56, "ranked 28-point lead keeps the blowout drag, live 40 − 18 + ranked 34");
assert.ok(rankedBlowout.reasons.includes("Blowout"));
assert.ok(!rankedBlowout.reasons.includes("Tight"));
assert.ok(rankedBlowout.score < ONE_SCORE_OTHER_SPORT);

const threeScoreGotw = scoreCfbRuwtGame(
  cfbGame({
    id: "gotw-three",
    shortDetail: "12:00 - 2nd",
    period: 2,
    away: cfbSide({ teamId: 99, abbrev: "LSU", score: 7, rank: 5, fpiRank: 4, record: "5-0" }),
    home: cfbSide({ teamId: 333, abbrev: "ALA", score: 31, rank: 8, fpiRank: 6, record: "4-0" }),
    broadcasts: [{ name: "ABC", logo: null, market: "national" }],
    situation: sit(60),
  }),
);
assert.equal(threeScoreGotw.score, 104, "three-score game of the week stays on the blowout path");
assert.ok(threeScoreGotw.score < lesserOneScore.score, `${threeScoreGotw.score} vs ${lesserOneScore.score}`);
assert.ok(!threeScoreGotw.reasons.includes("Game of the week"));

function nfl(partial: Partial<NflScoreGame> & Pick<NflScoreGame, "id">): NflScoreGame {
  const awayScore = partial.away?.score ?? 0;
  const homeScore = partial.home?.score ?? 0;
  return {
    status: partial.shortDetail ?? "Live",
    shortDetail: partial.shortDetail ?? null,
    live: partial.live ?? true,
    final: false,
    away: {
      teamId: 1,
      name: "Away",
      abbrev: "AWY",
      score: awayScore,
      record: null,
      logo: null,
      color: "000",
      linescores: [],
      ...partial.away,
    },
    home: {
      teamId: 2,
      name: "Home",
      abbrev: "HME",
      score: homeScore,
      record: null,
      logo: null,
      color: "000",
      linescores: [],
      ...partial.home,
    },
    when: null,
    whenShort: null,
    venue: null,
    situation: partial.situation ?? null,
    homeWinPct: partial.homeWinPct ?? null,
    date: null,
    broadcasts: [],
    ...partial,
  };
}

// NFL scoreboard often has no probability. Two scores and under three minutes in the 4th is the signal it does have.
const nflDecided = scoreNflRuwtGame(
  nfl({
    id: "nfl-over",
    shortDetail: "2:00 - 4th",
    away: { teamId: 1, name: "Away", abbrev: "AWY", score: 10, record: null, logo: null, color: "000", linescores: [] },
    home: { teamId: 2, name: "Home", abbrev: "HME", score: 20, record: null, logo: null, color: "000", linescores: [] },
    situation: {
      downDistanceText: "1st & 10",
      possessionText: null,
      yardLine: 8,
      isRedZone: true,
      possessionTeamId: "1",
      lastPlayText: null,
      homeTimeouts: 2,
      awayTimeouts: 2,
    },
    homeWinPct: null,
  }),
);
assert.equal(nflDecided.score, 40, "NFL two-score late game does not keep the red-zone bonus");
assert.deep(nflDecided.reasons, ["Live"]);

const nflOneScore = scoreNflRuwtGame(
  nfl({
    id: "nfl-one",
    shortDetail: "10:00 - 1st",
    away: { teamId: 1, name: "Away", abbrev: "AWY", score: 0, record: null, logo: null, color: "000", linescores: [] },
    home: { teamId: 2, name: "Home", abbrev: "HME", score: 3, record: null, logo: null, color: "000", linescores: [] },
    homeWinPct: 80,
  }),
);
assert.equal(nflOneScore.score, 68, "NFL one-score is live 40 + 28");
assert.deep(nflOneScore.reasons, ["Live", "One-score game"]);
assert.ok(nflDecided.score < nflOneScore.score);

const nflWpOver = scoreNflRuwtGame(
  nfl({
    id: "nfl-wp",
    shortDetail: "10:00 - 4th",
    away: { teamId: 1, name: "Away", abbrev: "AWY", score: 7, record: null, logo: null, color: "000", linescores: [] },
    home: { teamId: 2, name: "Home", abbrev: "HME", score: 14, record: null, logo: null, color: "000", linescores: [] },
    situation: {
      downDistanceText: "2nd & 5",
      possessionText: null,
      yardLine: 12,
      isRedZone: true,
      possessionTeamId: "2",
      lastPlayText: null,
      homeTimeouts: 3,
      awayTimeouts: 3,
    },
    homeWinPct: 99,
  }),
);
assert.equal(nflWpOver.score, 40, "NFL 99% does not stay Tight in the red zone");
assert.deep(nflWpOver.reasons, ["Live"]);

const nflWpDoubt = scoreNflRuwtGame(
  nfl({
    id: "nfl-doubt",
    shortDetail: "2:00 - 4th",
    away: { teamId: 1, name: "Away", abbrev: "AWY", score: 14, record: null, logo: null, color: "000", linescores: [] },
    home: { teamId: 2, name: "Home", abbrev: "HME", score: 21, record: null, logo: null, color: "000", linescores: [] },
    homeWinPct: 60,
  }),
);
assert.equal(nflWpDoubt.score, 64, "NFL 60% with two minutes left is live 40 + tight 14 + toss-up 10");
assert.ok(nflWpDoubt.reasons.includes("Tight"));
assert.ok(nflWpDoubt.reasons.includes("Toss-up"));

function nhl(id: string, away: number, home: number, shortDetail: string): NhlScoreGame {
  const side = (teamId: number, abbrev: string, score: number) => ({
    teamId,
    name: abbrev,
    abbrev,
    score,
    record: null,
    logo: null,
    color: "000",
    linescores: [],
  });
  return {
    id,
    status: shortDetail,
    shortDetail,
    live: true,
    final: false,
    away: side(1, "AWY", away),
    home: side(2, "HME", home),
    when: null,
    whenShort: null,
    venue: null,
    date: null,
    broadcasts: [],
  };
}

const nhlOne = scoreNhlRuwtGame(nhl("nhl-one", 1, 0, "12:00 - 1st"));
assert.equal(nhlOne.score, 68, "NHL one-goal is live 40 + 28");
assert.deep(nhlOne.reasons, ["Live", "One-goal game"]);

const nhlOver = scoreNhlRuwtGame(nhl("nhl-over", 1, 3, "2:10 - 3rd"));
assert.equal(nhlOver.score, 40, "NHL two-goal lead under three minutes in the 3rd is live only");
assert.deep(nhlOver.reasons, ["Live"]);
assert.ok(nhlOver.score < nhlOne.score);

const nhlEarlyTwo = scoreNhlRuwtGame(nhl("nhl-early", 0, 2, "12:00 - 1st"));
assert.equal(nhlEarlyTwo.score, 54, "an early two-goal game is still tight: live 40 + 14");
assert.ok(nhlEarlyTwo.reasons.includes("Tight"));

// Soccer scoreboard rows have no win probability. A multi-goal game never gets the one-goal bonus.
function soccer(id: string, away: string, home: string, shortDetail: string): SoccerScoreGame {
  const side = (teamId: string, score: string) => ({
    teamId,
    name: teamId,
    abbrev: teamId,
    logo: null,
    score,
    record: null,
  });
  return {
    id,
    league: "Championship",
    leagueSlug: "eng.2",
    date: null,
    status: shortDetail,
    shortDetail,
    final: false,
    live: true,
    pregame: false,
    venue: null,
    away: side("10", away),
    home: side("11", home),
    broadcasts: [],
  };
}
const soccerOne = rankRuwtSoccerGames([soccer("soc-one", "0", "1", "23'")], {}, 5)[0]!;
const soccerBlow = rankRuwtSoccerGames([soccer("soc-blow", "0", "3", "88'")], {}, 5)[0]!;
assert.equal(soccerOne.score, 63, "soccer one-goal is 20 + live 35 + 8");
assert.equal(soccerBlow.score, 55, "soccer three-goal game does not get the tight bonus");
assert.ok(soccerBlow.reasons.includes("Live") && !soccerBlow.reasons.includes("Tight score"));
assert.ok(soccerBlow.score < soccerOne.score);
assert.ok(soccerBlow.score < ONE_SCORE_OTHER_SPORT);

function mlb(partial: Partial<MlbScoreGame> & { awayScore: number; homeScore: number; inning: string; awayId?: number; officialDate?: string }): MlbScoreGame {
  const side = (teamId: number, score: number) => ({
    teamId,
    name: String(teamId),
    abbrev: String(teamId),
    score,
    hits: null,
    errors: null,
    record: null,
    probablePitcher: null,
    probablePitcherId: null,
    primaryColor: "000",
  });
  return {
    id: partial.id ?? "mlb",
    status: partial.inning,
    abstractState: "Live",
    live: true,
    final: false,
    inning: partial.inning,
    away: side(partial.awayId ?? 1, partial.awayScore),
    home: side(2, partial.homeScore),
    when: null,
    whenShort: null,
    venue: null,
    officialDate: partial.officialDate ?? "2026-09-15",
    gameDate: null,
    situation: null,
    broadcasts: [],
  };
}

const mlbBlow = scoreGameInterest(mlb({ awayScore: 8, homeScore: 0, inning: "Bot 8th" }));
assert.equal(mlbBlow.score, 44, "MLB late blowout stays live 42 − 16 + late 18");
assert.ok(mlbBlow.reasons.includes("Blowout"));
assert.ok(mlbBlow.score < ONE_SCORE_OTHER_SPORT);

const mlbOctoberBlow = scoreGameInterest(
  mlb({ awayScore: 8, homeScore: 0, inning: "Bot 8th", awayId: 138, officialDate: "2026-10-03" }),
);
assert.equal(
  mlbOctoberBlow.score,
  66,
  "October Cardinals blowout is 42 + 18 Cardinals − 16 + late 18 + playoff nudge 4",
);
assert.ok(mlbOctoberBlow.score < ONE_SCORE_OTHER_SPORT, `${mlbOctoberBlow.score} vs ${ONE_SCORE_OTHER_SPORT}`);

console.log("cfb-decided-live: ok");
console.log(
  JSON.stringify({
    decidedLate: decidedLate.score,
    oneScoreDoubt: oneScoreDoubt.score,
    gotw: gotw.score,
    lesserOneScore: lesserOneScore.score,
    lesserOneScoreFourth: lesserOneScoreFourth.score,
    gotwOneScore: gotwOneScore.score,
    gotwDecided: gotwDecided.score,
    unrankedBlowout: unrankedBlowout.score,
    rankedBlowout: rankedBlowout.score,
    threeScoreGotw: threeScoreGotw.score,
    nflDecided: nflDecided.score,
    nflOneScore: nflOneScore.score,
    nhlOver: nhlOver.score,
    nhlOne: nhlOne.score,
    soccerBlow: soccerBlow.score,
    soccerOne: soccerOne.score,
    mlbBlow: mlbBlow.score,
    mlbOctoberBlow: mlbOctoberBlow.score,
    oneScoreOtherSport: ONE_SCORE_OTHER_SPORT,
  }),
);
