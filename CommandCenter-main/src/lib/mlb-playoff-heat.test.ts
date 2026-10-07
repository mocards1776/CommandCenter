/**
 * Run with: node --experimental-strip-types src/lib/mlb-playoff-heat.test.ts
 * from CommandCenter-main/.
 *
 * Bases below are the current scoreGameInterest terms (not re-scored here):
 * pregame +4, live +42, Cardinals +18, blowout (margin >= 7) −16, late innings +18.
 * One-score NFL / NHL / CFB live floor is +40 live and +28 one-score = 68.
 * A typical other-sport pregame tops out around a Premier League game at 42
 * (soccer 20 + upcoming 12 + Premier League 10). NFL/NHL upcoming is 12.
 */
import {
  MLB_ELIM_EARLY,
  MLB_ELIM_LIVE,
  MLB_PLAYOFF_LIVE_NUDGE,
  MLB_PLAYOFF_SERIES_HEAT,
  MLB_TIE_CREDIT,
  MLB_WTA_LIVE,
  mlbBoardMonth,
  mlbCloseGameScale,
  mlbEliminationHeat,
  mlbLiveMarginHeat,
  mlbPostseasonHeat,
} from "./mlb-playoff-heat.ts";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  },
  ok(cond: unknown, message: string) {
    if (!cond) throw new Error(message);
  },
};

const PREGAME_BASE = 4;
const LIVE_BASE = 42;
const CARDINALS = 18;
const BLOWOUT = -16;
const LATE = 18;
const TYPICAL_PREGAME = 42;
const ONE_SCORE_OTHER_SPORT = 68;

const OCT = "2026-10-03";
const NOV = "2026-11-01";
const SEPT = "2026-09-28";

assert.equal(mlbPostseasonHeat({ live: false, final: false, officialDate: SEPT }), null);
assert.equal(mlbPostseasonHeat({ live: true, final: false, officialDate: SEPT }), null);
assert.equal(mlbPostseasonHeat({ live: false, final: false, officialDate: "2026-04-12" }), null);

const series = mlbPostseasonHeat({ live: false, final: false, officialDate: OCT });
assert.equal(series?.points, MLB_PLAYOFF_SERIES_HEAT);
assert.equal(series?.reason, "Playoff series");

const novFinal = mlbPostseasonHeat({ live: false, final: true, officialDate: NOV });
assert.equal(novFinal?.points, MLB_PLAYOFF_SERIES_HEAT);
assert.equal(novFinal?.reason, "Playoff series");

const live = mlbPostseasonHeat({ live: true, final: false, officialDate: OCT });
assert.equal(live?.points, MLB_PLAYOFF_LIVE_NUDGE);
assert.equal(live?.reason, "Playoffs");

// Partition treats live+final as final, so it keeps the series weight.
const both = mlbPostseasonHeat({ live: true, final: true, officialDate: OCT });
assert.equal(both?.points, MLB_PLAYOFF_SERIES_HEAT);

// Missing date uses Chicago calendar, not UTC.
assert.equal(mlbBoardMonth(null, new Date("2026-10-01T04:30:00Z")), 9);
assert.equal(mlbBoardMonth(null, new Date("2026-10-03T18:00:00Z")), 10);
assert.equal(
  mlbPostseasonHeat({ live: false, final: false }, new Date("2026-10-03T18:00:00Z"))?.points,
  MLB_PLAYOFF_SERIES_HEAT,
);
assert.equal(
  mlbPostseasonHeat({ live: false, final: false }, new Date("2026-10-01T04:30:00Z")),
  null,
);

const seriesPregame = PREGAME_BASE + MLB_PLAYOFF_SERIES_HEAT;
const cardinalsPregame = seriesPregame + CARDINALS;
const blowoutLive = LIVE_BASE + BLOWOUT + MLB_PLAYOFF_LIVE_NUDGE;
const cardinalsBlowout = blowoutLive + CARDINALS;
const cardinalsLateBlowout = cardinalsBlowout + LATE;

assert.ok(
  seriesPregame > TYPICAL_PREGAME,
  `playoff series pregame ${seriesPregame} should beat a typical pregame ${TYPICAL_PREGAME}`,
);
assert.ok(
  cardinalsPregame > seriesPregame + 10,
  `Cardinals series ${cardinalsPregame} should sit well above other series games ${seriesPregame}`,
);
assert.equal(cardinalsPregame - seriesPregame, CARDINALS);
assert.ok(
  blowoutLive < ONE_SCORE_OTHER_SPORT,
  `blowout ${blowoutLive} should lose to a one-score live game ${ONE_SCORE_OTHER_SPORT}`,
);
assert.ok(
  cardinalsBlowout < ONE_SCORE_OTHER_SPORT,
  `Cardinals blowout ${cardinalsBlowout} should lose to a one-score live game ${ONE_SCORE_OTHER_SPORT}`,
);
assert.ok(
  cardinalsLateBlowout < ONE_SCORE_OTHER_SPORT,
  `late Cardinals blowout ${cardinalsLateBlowout} should lose to a one-score live game ${ONE_SCORE_OTHER_SPORT}`,
);
assert.ok(
  MLB_PLAYOFF_LIVE_NUDGE * 8 < MLB_PLAYOFF_SERIES_HEAT,
  "live nudge must stay a small fraction of the series weight",
);
assert.ok(MLB_PLAYOFF_LIVE_NUDGE > 0, "live still gets an October nudge");

assert.ok(mlbCloseGameScale(1, false) < 0.25, "1st-inning close credit is a sliver");
assert.ok(mlbCloseGameScale(5, false) > mlbCloseGameScale(1, false), "5th grows past the 1st");
assert.ok(mlbCloseGameScale(5, false) < mlbCloseGameScale(8, false), "8th is full close credit");
assert.equal(mlbCloseGameScale(8, false), 1);
assert.equal(mlbCloseGameScale(11, true), 1);

const t1Tie = mlbLiveMarginHeat(0, 1, false);
assert.equal(t1Tie.reason, "Tied");
assert.ok(t1Tie.points < MLB_TIE_CREDIT / 4, `early tie is ${t1Tie.points}, not full ${MLB_TIE_CREDIT}`);
assert.equal(mlbLiveMarginHeat(0, 8, false).points, MLB_TIE_CREDIT);

const earlyElim = mlbEliminationHeat({
  seriesLine: "LAD leads 2-1 · Game 4 of 5",
  live: true,
  final: false,
  inning: 1,
  blowout: false,
});
const midElim = mlbEliminationHeat({
  seriesLine: "CWS leads 2-0 · Game 3 of 5",
  live: true,
  final: false,
  inning: 5,
  blowout: false,
});
assert.equal(earlyElim?.points, MLB_ELIM_EARLY);
assert.equal(midElim?.points, MLB_ELIM_LIVE);
assert.ok((midElim?.points ?? 0) > (earlyElim?.points ?? 0), "mid-game elimination outranks the 1st");
assert.equal(
  mlbEliminationHeat({
    seriesLine: "Series tied 2-2 · Game 5 of 5",
    live: true,
    final: false,
    inning: 8,
    blowout: false,
  })?.points,
  MLB_WTA_LIVE,
);
assert.ok(
  mlbEliminationHeat({
    seriesLine: "CWS leads 2-0 · Game 3 of 5",
    live: true,
    final: false,
    inning: 8,
    blowout: true,
  }) == null,
  "a blowout does not get the elimination bump",
);

console.log("mlb-playoff-heat: ok");
console.log(
  JSON.stringify({
    seriesPregame,
    cardinalsPregame,
    blowoutLive,
    cardinalsBlowout,
    cardinalsLateBlowout,
    typicalPregame: TYPICAL_PREGAME,
    oneScoreOtherSport: ONE_SCORE_OTHER_SPORT,
  }),
);
