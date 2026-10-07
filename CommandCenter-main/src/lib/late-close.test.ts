/**
 * Run with: node --experimental-strip-types src/lib/late-close.test.ts
 * from CommandCenter-main/.
 *
 * Heat alerts fire only when a game is over the heat line and close-and-late.
 * The score line itself stays put: a one-goal first period is still hot
 * for finals / the heat number, and the gate decides the push cross.
 */
import { mapEspnEvent } from "../../../supabase/functions/sports-push/boards.ts";
import {
  clockWindow,
  heatCrossHot,
  isLateAndClose,
  type LateCloseGame,
} from "../../../supabase/functions/sports-push/late-close.ts";
import {
  crossingAlerts,
  heatReasonChips,
  liveDrama,
  type PushGame,
} from "../../../supabase/functions/sports-push/live-drama.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function game(partial: LateCloseGame): LateCloseGame {
  return partial;
}

assert(!isLateAndClose("nhl", game({ awayScore: 0, homeScore: 1, detail: "1:58 - 1st", period: 1 })), "NHL 1-goal in the 1st");
assert(!isLateAndClose("nhl", game({ awayScore: 1, homeScore: 0, detail: "11:50 - 1st", period: 1 })), "NHL 1-goal in the 1st, other clock");
assert(!isLateAndClose("nhl", game({ awayScore: 1, homeScore: 2, detail: "8:02 - 2nd", period: 2 })), "NHL 1-goal in the 2nd");
assert(isLateAndClose("nhl", game({ awayScore: 1, homeScore: 2, detail: "1:58 - 3rd", period: 3 })), "NHL 1-goal in the 3rd");
assert(isLateAndClose("nhl", game({ awayScore: 2, homeScore: 2, detail: "3:11 - OT", period: 4 })), "NHL tied in OT");
assert(isLateAndClose("nhl", game({ awayScore: 3, homeScore: 2, detail: "Shootout", period: 5 })), "NHL 1-goal in the shootout");
assert(!isLateAndClose("nhl", game({ awayScore: 3, homeScore: 1, detail: "4:10 - 3rd", period: 3 })), "NHL 2-goal in the 3rd");
assert(!isLateAndClose("nhl", game({ awayScore: 1, homeScore: 0, detail: "Live", period: null })), "NHL unknown period");
assert(
  !isLateAndClose("nhl", game({ awayScore: 1, homeScore: 2, shortDetail: "8:02 - 1st", period: null })),
  "NHL 1st only in shortDetail is not late",
);
assert(
  clockWindow("nhl", game({ awayScore: 1, homeScore: 2, shortDetail: "8:02 - 1st", period: null })) === "early",
  "NHL shortDetail 1st is an early window",
);
assert(
  isLateAndClose("nhl", game({ awayScore: 4, homeScore: 3, detail: "11:58 - 3rd", period: null })),
  "NHL 3rd only in the detail is late",
);
assert(
  !isLateAndClose("nhl", game({ awayScore: 1, homeScore: 0, detail: "12:00", period: null })),
  "NHL clock without a period does not alert",
);

assert(!isLateAndClose("nfl", game({ awayScore: 7, homeScore: 0, detail: "8:00 - 2nd", period: 2 })), "NFL one-score in the 2nd");
assert(isLateAndClose("nfl", game({ awayScore: 17, homeScore: 24, detail: "2:10 - 4th", period: 4 })), "NFL one-score in the 4th");
assert(
  isLateAndClose("nfl", game({ awayScore: 20, homeScore: 28, detail: "9:00 - 4th", period: 4 })),
  "NFL margin of 8 in the 4th",
);
assert(!isLateAndClose("nfl", game({ awayScore: 14, homeScore: 23, detail: "9:00 - 4th", period: 4 })), "NFL margin of 9 in the 4th");
assert(
  !isLateAndClose("nfl", game({ awayScore: 17, homeScore: 24, detail: "2:10 - 4th", period: 4, homeWinPct: 99 })),
  "NFL decided 4th at 99%",
);
assert(
  isLateAndClose("nfl", game({ awayScore: 17, homeScore: 24, detail: "2:10 - 4th", period: 4, homeWinPct: 96 })),
  "NFL 96% in the 4th is still a game",
);
assert(isLateAndClose("nfl", game({ awayScore: 21, homeScore: 21, detail: "5:00 - OT", period: 5 })), "NFL tied in OT");
assert(!isLateAndClose("nfl", game({ awayScore: 7, homeScore: 0, detail: "Live", period: null })), "NFL unknown quarter");

assert(!isLateAndClose("cfb", game({ awayScore: 7, homeScore: 0, detail: "10:00 - 2nd", period: 2 })), "CFB one-score in the 2nd");
assert(isLateAndClose("cfb", game({ awayScore: 24, homeScore: 17, detail: "0:27 - 4th", period: 4 })), "CFB one-score in the 4th");
assert(
  !isLateAndClose("cfb", game({ awayScore: 24, homeScore: 17, detail: "9:31 - 4th", period: 4, homeWinPct: 99 })),
  "CFB decided 4th at 99%",
);
assert(
  !isLateAndClose("cfb", game({ awayScore: 24, homeScore: 31, detail: "9:31 - 4th", period: 4, homeWinPct: 0.99 })),
  "CFB 0.99 rate is the same 99% line",
);
assert(!isLateAndClose("cfb", game({ awayScore: 7, homeScore: 0, detail: "", period: null })), "CFB unknown quarter");

assert(!isLateAndClose("mlb", game({ awayScore: 1, homeScore: 0, detail: "Top 4th", period: 4 })), "MLB 1-run in the 4th");
assert(!isLateAndClose("mlb", game({ awayScore: 0, homeScore: 0, detail: "Top 1st", period: 1 })), "MLB 0-0 in the 1st is not late");
assert(isLateAndClose("mlb", game({ awayScore: 2, homeScore: 1, detail: "Bot 8th", period: 8 })), "MLB 1-run in the 8th");
assert(isLateAndClose("mlb", game({ awayScore: 4, homeScore: 2, detail: "Top 7th", period: 7 })), "MLB 2-run in the 7th");
assert(!isLateAndClose("mlb", game({ awayScore: 5, homeScore: 2, detail: "Bot 8th", period: 8 })), "MLB 3-run in the 8th");
assert(isLateAndClose("mlb", game({ awayScore: 4, homeScore: 4, detail: "Top 11th", period: 11 })), "MLB extras");
assert(!isLateAndClose("mlb", game({ awayScore: 1, homeScore: 0, detail: "In Progress", period: null })), "MLB unknown inning");

assert(!isLateAndClose("soccer", game({ awayScore: 1, homeScore: 0, detail: "30'" })), "soccer 1-0 at 30'");
assert(isLateAndClose("soccer", game({ awayScore: 1, homeScore: 0, detail: "78'" })), "soccer 1-0 at 78'");
assert(isLateAndClose("soccer", game({ awayScore: 1, homeScore: 1, detail: "70'" })), "soccer tied at 70'");
assert(!isLateAndClose("soccer", game({ awayScore: 1, homeScore: 0, detail: "69'" })), "soccer 1-0 at 69'");
assert(!isLateAndClose("soccer", game({ awayScore: 2, homeScore: 0, detail: "78'" })), "soccer 2-0 at 78'");
assert(isLateAndClose("soccer", game({ awayScore: 1, homeScore: 0, detail: "90'+4'" })), "soccer stoppage after 90");
assert(!isLateAndClose("soccer", game({ awayScore: 1, homeScore: 0, detail: "45'+2'" })), "soccer first-half stoppage");
assert(isLateAndClose("soccer", game({ awayScore: 1, homeScore: 1, detail: "ET 105'" })), "soccer extra time");
assert(!isLateAndClose("soccer", game({ awayScore: 1, homeScore: 0, detail: "Live" })), "soccer unknown clock");

const earlyNhl = game({ awayScore: 0, homeScore: 1, detail: "1:58 - 1st", period: 1 });
const lateNhl = game({ awayScore: 0, homeScore: 1, detail: "1:58 - 3rd", period: 3 });
const cleared = heatCrossHot({
  overLine: true,
  lateAndClose: isLateAndClose("nhl", earlyNhl),
  window: clockWindow("nhl", earlyNhl),
  prevHot: true,
  scoresKnown: true,
});
assert(!cleared, "a false early-hot flag clears; a 1st-period one-goal is not late");
assert(
  crossingAlerts({ phase: "live", hot: true }, { phase: "live", hot: cleared }).length === 0,
  "clearing a false early-hot flag does not ping",
);
const earlyFresh = heatCrossHot({
  overLine: true,
  lateAndClose: false,
  window: "early",
  prevHot: false,
  scoresKnown: true,
});
assert(!earlyFresh, "an early one-goal game over the heat line is not hot");
assert(
  crossingAlerts({ phase: "live", hot: false }, { phase: "live", hot: earlyFresh }).length === 0,
  "early one-goal does not raise a heat alert",
);
const crossed = heatCrossHot({
  overLine: true,
  lateAndClose: isLateAndClose("nhl", lateNhl),
  window: clockWindow("nhl", lateNhl),
  prevHot: false,
  scoresKnown: true,
});
assert(crossed, "a new close-and-late game becomes hot");
assert(
  crossingAlerts({ phase: "live", hot: false }, { phase: "live", hot: crossed }).join() === "heat",
  "crossing into hot under the gate is the heat alert",
);
const stillHot = heatCrossHot({
  overLine: true,
  lateAndClose: true,
  window: "late",
  prevHot: true,
  scoresKnown: true,
});
assert(
  crossingAlerts({ phase: "live", hot: true }, { phase: "live", hot: stillHot }).length === 0,
  "a game already hot in the 3rd does not ping again",
);
const becameLate = heatCrossHot({
  overLine: true,
  lateAndClose: isLateAndClose("nhl", lateNhl),
  window: clockWindow("nhl", lateNhl),
  prevHot: cleared,
  scoresKnown: true,
});
assert(becameLate, "after the early flag clears, a 3rd-period one-goal is hot");
assert(
  crossingAlerts({ phase: "live", hot: cleared }, { phase: "live", hot: becameLate }).join() === "heat",
  "the rising edge fires only when the game is newly late-and-close",
);
const dropped = heatCrossHot({
  overLine: false,
  lateAndClose: false,
  window: "late",
  prevHot: true,
  scoresKnown: true,
});
assert(!dropped, "falling under the line drops hot");
const cameBack = heatCrossHot({
  overLine: true,
  lateAndClose: true,
  window: "late",
  prevHot: false,
  scoresKnown: true,
});
assert(
  crossingAlerts({ phase: "live", hot: dropped }, { phase: "live", hot: cameBack }).join() === "heat",
  "dropping out and coming back pings",
);
assert(
  !heatCrossHot({
    overLine: true,
    lateAndClose: false,
    window: "unknown",
    prevHot: false,
    scoresKnown: true,
  }),
  "unknown clock does not alert",
);
assert(
  heatCrossHot({
    overLine: true,
    lateAndClose: false,
    window: "unknown",
    prevHot: true,
    scoresKnown: true,
  }),
  "unknown period holds a previous hot flag so a blip does not flap",
);
assert(
  heatCrossHot({
    overLine: false,
    lateAndClose: false,
    window: "late",
    prevHot: true,
    scoresKnown: false,
  }),
  "a missing score does not drop a hot game",
);

const first = liveDrama({
  sport: "nhl",
  live: true,
  final: false,
  awayScore: 0,
  homeScore: 1,
  detail: "1:58 - 1st",
  period: 1,
});
assert(first.score >= 68 && first.hot, "the heat line itself still marks a one-goal first period");
assert(!isLateAndClose("nhl", earlyNhl), "the alert gate does not");

const mlbFirstTie = liveDrama({
  sport: "mlb",
  live: true,
  final: false,
  awayScore: 0,
  homeScore: 0,
  detail: "Top 1st",
  period: 1,
});
assert(mlbFirstTie.score < 68 && !mlbFirstTie.hot, `early MLB tie is ${mlbFirstTie.score}, under the heat line`);
assert(
  !heatCrossHot({
    overLine: mlbFirstTie.hot,
    lateAndClose: isLateAndClose("mlb", game({ awayScore: 0, homeScore: 0, detail: "Top 1st", period: 1 })),
    window: clockWindow("mlb", game({ awayScore: 0, homeScore: 0, detail: "Top 1st", period: 1 })),
    prevHot: false,
    scoresKnown: true,
  }),
  "early MLB tie does not raise a heat alert",
);

const card: PushGame = {
  sport: "nhl",
  id: "401",
  live: true,
  final: false,
  detail: "1:58 - 3rd",
  period: 3,
  redZone: false,
  downDistance: null,
  when: null,
  away: { id: "4", abbrev: "PHI", name: "Flyers", score: 0, logo: null },
  home: { id: "20", abbrev: "TB", name: "Lightning", score: 1, logo: null },
};
const chips = heatReasonChips(card, {
  score: 80,
  hot: true,
  why: "One-goal game · Late & close",
  reasons: ["Live", "One-goal game", "Late & close"],
});
assert(chips.join(" · ") === "One-goal game · 3rd period", chips.join(" · "));

const earlyCard: PushGame = { ...card, detail: "1:58 - 1st", period: 1 };
const earlyChips = heatReasonChips(earlyCard, {
  score: 68,
  hot: true,
  why: "One-goal game",
  reasons: ["Live", "One-goal game"],
});
assert(earlyChips.join(" · ") === "One-goal game", earlyChips.join(" · "));

const soccerCard: PushGame = {
  ...card,
  sport: "soccer",
  detail: "78'",
  period: 2,
  away: { ...card.away, score: 1 },
  home: { ...card.home, score: 0 },
};
const soccerChips = heatReasonChips(soccerCard, {
  score: 68,
  hot: true,
  why: "One-goal game",
  reasons: ["Live", "One-goal game"],
});
assert(soccerChips.join(" · ") === "One-goal game · Late", soccerChips.join(" · "));

const mapped = mapEspnEvent("nfl", {
  id: "99",
  competitions: [
    {
      status: { period: 4, type: { state: "in", shortDetail: "2:10 - 4th" } },
      situation: { lastPlay: { probability: { homeWinPercentage: 0.99, awayWinPercentage: 0.01 } } },
      competitors: [
        { homeAway: "away", score: "17", team: { id: "12", abbreviation: "KC", shortDisplayName: "Chiefs" } },
        { homeAway: "home", score: "24", team: { id: "8", abbreviation: "DET", shortDisplayName: "Lions" } },
      ],
    },
  ],
});
assert(mapped?.homeWinPct === 99, `scoreboard win chance ${mapped?.homeWinPct}`);
assert(mapped != null && !isLateAndClose("nfl", mapped), "a 99% scoreboard row is not an alert");

console.log("late-close: ok");
