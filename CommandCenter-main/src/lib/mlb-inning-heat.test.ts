/**
 * Run from CommandCenter-main/:
 *   node scripts/ruwt-score-test.mjs
 *
 * Screenshot board, 2026-10-07:
 *   LAD–ATL 0–0 Top 1st, Game 4 of 5 (ATL can be eliminated) ranked #1 at Heat 90
 *   CLE–CWS 5–2 Top 5th, Game 3 of 5 (CLE can be eliminated) ranked #2 at Heat 70
 * An early tie must not get full late-game tie credit. CLE–CWS should rank above.
 */
import { scoreGameInterest, type MlbScoreGame } from "./mlb.ts";
import { rankRuwtGames, scoreRuwtGame } from "./ruwt.ts";

const assert = {
  equal(actual: unknown, expected: unknown, message?: string) {
    if (actual !== expected) {
      throw new Error(`${message ? `${message}: ` : ""}expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  ok(cond: unknown, message = "assertion failed") {
    if (!cond) throw new Error(message);
  },
};

const LAD = 119;
const ATL = 144;
const CLE = 114;
const CWS = 145;
const OCT = "2026-10-07";

function mlb(partial: {
  id: string;
  awayId: number;
  homeId: number;
  awayScore: number;
  homeScore: number;
  awayRecord?: string;
  homeRecord?: string;
  inning: string;
  seriesLine: string;
}): MlbScoreGame {
  const side = (teamId: number, score: number, record: string | null) => ({
    teamId,
    name: String(teamId),
    abbrev: String(teamId),
    score,
    hits: null,
    errors: null,
    record,
    probablePitcher: null,
    probablePitcherId: null,
    primaryColor: "000",
  });
  return {
    id: partial.id,
    status: partial.inning,
    abstractState: "Live",
    live: true,
    final: false,
    inning: partial.inning,
    away: side(partial.awayId, partial.awayScore, partial.awayRecord ?? null),
    home: side(partial.homeId, partial.homeScore, partial.homeRecord ?? null),
    when: null,
    whenShort: null,
    venue: null,
    officialDate: OCT,
    gameDate: null,
    situation: null,
    broadcasts: [],
    seriesLine: partial.seriesLine,
  };
}

const ladAtl = mlb({
  id: "lad-atl",
  awayId: LAD,
  homeId: ATL,
  awayScore: 0,
  homeScore: 0,
  awayRecord: "2-1",
  homeRecord: "1-2",
  inning: "Top 1st",
  seriesLine: "LAD leads 2-1 · Game 4 of 5",
});
const cleCws = mlb({
  id: "cle-cws",
  awayId: CLE,
  homeId: CWS,
  awayScore: 5,
  homeScore: 2,
  awayRecord: "0-2",
  homeRecord: "2-0",
  inning: "Top 5th",
  seriesLine: "CWS leads 2-0 · Game 3 of 5",
});
const lateTie = mlb({
  id: "late-tie",
  awayId: LAD,
  homeId: ATL,
  awayScore: 3,
  homeScore: 3,
  awayRecord: "2-1",
  homeRecord: "1-2",
  inning: "Top 8th",
  seriesLine: "LAD leads 2-1 · Game 4 of 5",
});
const lateBlow = mlb({
  id: "late-blow",
  awayId: CLE,
  homeId: CWS,
  awayScore: 6,
  homeScore: 0,
  awayRecord: "0-2",
  homeRecord: "2-0",
  inning: "Bot 8th",
  seriesLine: "CWS leads 2-0 · Game 3 of 5",
});

const BEFORE_LAD = 90;
const BEFORE_CLE = 70;
const BEFORE_LATE_TIE = 108;

const ladBase = scoreGameInterest(ladAtl);
const cleBase = scoreGameInterest(cleCws);
const lateBase = scoreGameInterest(lateTie);
const blowBase = scoreGameInterest(lateBlow);

assert.equal(ladBase.score, 60, "LAD–ATL T1 0–0 elim is live 42 + early tie 4 + playoffs 4 + elim 10");
assert.equal(cleBase.score, 72, "CLE–CWS T5 5–2 elim is live 42 + tight 4 + playoffs 4 + elim 22");
assert.equal(lateBase.score, 114, "T8 tie elim is live 42 + tie 28 + late 18 + playoffs 4 + elim 22");
assert.equal(blowBase.score, 48, "T8 6-run blowout is live 42 − 16 + late 18 + playoffs 4");
assert.ok(cleBase.score > ladBase.score, "a 3-run 5th elimination game outranks a 0–0 1st");
assert.ok(lateBase.score > cleBase.score, "a late tie ranks above the 5th-inning 3-run game");
assert.ok(blowBase.score < ladBase.score, "a late 6-run blowout falls below the early elimination game");
assert.ok(ladBase.reasons.includes("Tied"), "early tie keeps the Tied chip");
assert.ok(ladBase.reasons.includes("Elimination"));
assert.ok(cleBase.reasons.includes("Tight"));
assert.ok(cleBase.reasons.includes("Elimination"));
assert.ok(lateBase.reasons.includes("Tied") && lateBase.reasons.includes("Late innings"));
assert.ok(blowBase.reasons.includes("Blowout"));
assert.ok(!blowBase.reasons.includes("Elimination"), "blowouts do not get Elimination");

const race = { [LAD]: 40, [ATL]: 35, [CLE]: 38, [CWS]: 30 };
const ctx = {
  teamInterest: {},
  watchPlayerIds: new Set<number>(),
  watchManagerIds: new Set<number>(),
  playoffOddsByTeam: race,
};

const ladRuwt = scoreRuwtGame(ladAtl, ctx);
const cleRuwt = scoreRuwtGame(cleCws, ctx);
const lateRuwt = scoreRuwtGame(lateTie, ctx);
const blowRuwt = scoreRuwtGame(lateBlow, ctx);

assert.equal(ladRuwt.score, 76, "screenshot LAD–ATL after: 60 + playoff race 16");
assert.equal(cleRuwt.score, 88, "screenshot CLE–CWS after: 72 + playoff race 16");
assert.equal(lateRuwt.score, 130, "T8 tie after: 114 + playoff race 16");
assert.equal(blowRuwt.score, 64, "late blowout after: 48 + playoff race 16");
assert.ok(ladRuwt.reasons.includes("Playoff race") && ladRuwt.reasons.includes("Tied"));
assert.ok(cleRuwt.reasons.includes("Playoff race") && cleRuwt.reasons.includes("Tight"));
assert.ok(cleRuwt.score > ladRuwt.score, "CLE–CWS ranks above the 0–0 1st on the screenshot board");
assert.ok(lateRuwt.score > cleRuwt.score, "T8 tied elimination ranks highest");
assert.ok(blowRuwt.score < cleRuwt.score, "late blowout stays below the live elimination games");

const ranked = rankRuwtGames([ladAtl, cleCws, lateTie, lateBlow], ctx, 4);
assert.equal(ranked[0]?.id, "late-tie", `hottest is the late tie, got ${ranked[0]?.id}`);
assert.equal(ranked[1]?.id, "cle-cws", `CLE–CWS is second, got ${ranked[1]?.id}`);
assert.equal(ranked[2]?.id, "lad-atl", `LAD–ATL is third, got ${ranked[2]?.id}`);
assert.equal(ranked[3]?.id, "late-blow");

assert.ok(BEFORE_LAD > BEFORE_CLE, "before: the 0–0 1st outranked the 5–2 5th");
assert.ok(ladRuwt.score < BEFORE_LAD, `LAD–ATL dropped from ${BEFORE_LAD} to ${ladRuwt.score}`);
assert.ok(cleRuwt.score > BEFORE_CLE, `CLE–CWS rose from ${BEFORE_CLE} to ${cleRuwt.score}`);
assert.ok(lateRuwt.score > BEFORE_LATE_TIE, `late tie rose from ${BEFORE_LATE_TIE} to ${lateRuwt.score}`);

console.log("mlb-inning-heat: ok");
console.log(
  JSON.stringify({
    before: { ladAtl: BEFORE_LAD, cleCws: BEFORE_CLE, lateTie: BEFORE_LATE_TIE },
    after: { ladAtl: ladRuwt.score, cleCws: cleRuwt.score, lateTie: lateRuwt.score, lateBlow: blowRuwt.score },
    base: { ladAtl: ladBase.score, cleCws: cleBase.score, lateTie: lateBase.score, lateBlow: blowBase.score },
  }),
);
