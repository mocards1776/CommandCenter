/**
 * Run with: node --experimental-strip-types src/lib/game-moments.test.ts
 * from CommandCenter-main/.
 */
import {
  buildMomentFromPlay,
  classifyFootballScore,
  classifyMlbPlay,
  classifyMlbScoreJump,
  classifyNhlGoal,
  demoMoment,
  diffGameMoments,
  latestMoment,
  mlbPlayLooksLikeScore,
  momentAccent,
  momentDurationMs,
  momentIntensity,
  type GameMomentSnapshot,
  type ScoringPlaySnap,
} from "./game-moments.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) {
      throw new Error(`${msg ?? "assert.equal"}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  ok(cond: unknown, message: string) {
    if (!cond) throw new Error(message);
  },
};

assert.equal(classifyMlbPlay({ eventType: "home_run", event: "Home Run" }), "home_run");
assert.equal(classifyMlbPlay({ eventType: "single", rbi: 1 }), "run");
assert.equal(classifyMlbPlay({ eventType: "field_out", description: "fly out" }), "score_change");
assert.ok(mlbPlayLooksLikeScore("Jonny DeLuca scores."), "scores in copy");
assert.equal(classifyNhlGoal("Power Play", "Point goal").kind, "goal");
assert.equal(classifyNhlGoal("PP", "x").headline, "POWER PLAY GOAL");
assert.equal(classifyNhlGoal("SH", "x").headline, "SHORTHANDED GOAL");
assert.equal(classifyNhlGoal("EN", "empty net").headline, "EMPTY NET GOAL");
assert.equal(classifyFootballScore("Josh Allen 6 yd rush for a touchdown", ["TD"]), "touchdown");
assert.equal(classifyFootballScore("41 yd field goal", ["FG"]), "field_goal");
assert.equal(classifyFootballScore("safety in the end zone"), "safety");
assert.equal(momentIntensity("goal"), "high");
assert.equal(momentIntensity("run"), "medium");
assert.ok(momentDurationMs("touchdown") > momentDurationMs("field_goal"), "TD holds longer");
assert.equal(momentAccent("goal"), "#8ec9e6");

function team(id: string, abbrev: string, score: number) {
  return { id, abbrev, name: abbrev, logo: null, color: "002868", score };
}

function snap(partial: Partial<GameMomentSnapshot> & Pick<GameMomentSnapshot, "sport" | "gameId">): GameMomentSnapshot {
  return {
    live: true,
    away: team("1", "AWY", 0),
    home: team("2", "HME", 0),
    periodLabel: "Live",
    scoringPlays: [],
    recentScoring: [],
    ...partial,
  };
}

const goalPlay: ScoringPlaySnap = {
  id: "g1",
  text: "Brayden Point slap shot.",
  clock: "12:41",
  period: "2nd",
  teamId: "1",
  teamAbbrev: "AWY",
  awayScore: 1,
  homeScore: 0,
  strength: "Power Play",
  tags: ["PP"],
  eventType: "goal",
  rbi: null,
  player: { id: "9", name: "Brayden Point", shortName: "B. POINT", headshot: null },
};

const before = snap({ sport: "nhl", gameId: "401", away: team("1", "AWY", 0), home: team("2", "HME", 0) });
const afterGoal = snap({
  sport: "nhl",
  gameId: "401",
  away: team("1", "AWY", 1),
  home: team("2", "HME", 0),
  scoringPlays: [goalPlay],
});

assert.equal(diffGameMoments(null, afterGoal).length, 0, "first snapshot is a seed, not a celebration");
const nhl = diffGameMoments(before, afterGoal);
assert.equal(nhl.length, 1, "new NHL goal fires once");
assert.equal(nhl[0]!.kind, "goal");
assert.equal(nhl[0]!.headline, "POWER PLAY GOAL");
assert.equal(nhl[0]!.subhead, "B. POINT");
assert.equal(nhl[0]!.score?.away, 1);

const sameAgain = diffGameMoments(afterGoal, afterGoal);
assert.equal(sameAgain.length, 0, "no replay on identical poll");

const mlbBefore = snap({ sport: "mlb", gameId: "849", away: team("147", "NYY", 0), home: team("139", "TB", 0) });
const hrPlay: ScoringPlaySnap = {
  id: "ab-12",
  text: "Richardson Palacios homers on a fly ball.  Jonny DeLuca scores.",
  clock: null,
  period: "BOT 4TH",
  teamId: "139",
  teamAbbrev: "TB",
  awayScore: 0,
  homeScore: 2,
  strength: null,
  tags: [],
  eventType: "home_run",
  rbi: 2,
  player: { id: "1", name: "Richardson Palacios", shortName: "R. PALACIOS", headshot: null },
};
const mlbAfter = snap({
  sport: "mlb",
  gameId: "849",
  away: team("147", "NYY", 0),
  home: team("139", "TB", 2),
  scoringPlays: [hrPlay],
});
const hr = diffGameMoments(mlbBefore, mlbAfter);
assert.equal(hr[0]!.kind, "home_run");
assert.equal(hr[0]!.headline, "2-RUN HOME RUN");

const mlbRunOnly = snap({
  sport: "mlb",
  gameId: "849",
  away: team("147", "NYY", 0),
  home: team("139", "TB", 1),
  signals: { homeRuns: 0, rbi: 1, batter: null },
});
const runFallback = diffGameMoments(mlbBefore, mlbRunOnly);
assert.equal(runFallback[0]!.kind, "run", "score delta without a play still fires a run");
assert.equal(runFallback[0]!.headline, "RUN SCORED");

const mlbHrJump = snap({
  sport: "mlb",
  gameId: "849",
  away: team("147", "NYY", 0),
  home: team("139", "TB", 2),
  signals: { homeRuns: 1, rbi: 2, batter: { id: "1", name: "Richardson Palacios", shortName: "R. PALACIOS", headshot: null } },
});
assert.equal(classifyMlbScoreJump(mlbHrJump, mlbBefore), "home_run");
const hrFromBox = diffGameMoments(mlbBefore, mlbHrJump);
assert.equal(hrFromBox[0]!.kind, "home_run", "boxscore HR count jump classifies a homer");
assert.equal(hrFromBox[0]!.headline, "2-RUN HOME RUN");

const tdPlay: ScoringPlaySnap = {
  id: "p88",
  text: "Josh Allen 6 yd rush for a touchdown",
  clock: "4:21",
  period: 3,
  teamId: "12",
  teamAbbrev: "BUF",
  awayScore: 14,
  homeScore: 21,
  strength: null,
  tags: ["TD"],
  eventType: null,
  rbi: null,
  player: { id: "3918298", name: "Josh Allen", shortName: "J. ALLEN", headshot: null },
};
const nflBefore = snap({ sport: "nfl", gameId: "n1", away: team("10", "KC", 14), home: team("12", "BUF", 14) });
const nflAfter = snap({
  sport: "nfl",
  gameId: "n1",
  away: team("10", "KC", 14),
  home: team("12", "BUF", 21),
  recentScoring: [tdPlay],
});
const td = diffGameMoments(nflBefore, nflAfter);
assert.equal(td[0]!.kind, "touchdown");
assert.equal(td[0]!.headline, "TOUCHDOWN");

const switchGame = diffGameMoments(before, snap({ sport: "nhl", gameId: "999" }));
assert.equal(switchGame.length, 0, "different game id is not a moment");

const built = buildMomentFromPlay(afterGoal, goalPlay);
assert.equal(built.id, "nhl:401:g1");
assert.equal(latestMoment(afterGoal)?.id, built.id);
assert.equal(demoMoment("goal").kind, "goal");
assert.equal(demoMoment("touchdown").sport, "nfl");

console.log("game-moments: ok");
