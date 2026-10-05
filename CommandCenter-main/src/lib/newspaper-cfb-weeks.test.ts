/**
 * Run with: node --experimental-strip-types src/lib/newspaper-cfb-weeks.test.ts
 * from CommandCenter-main/.
 */
import {
  cfbNetworkLabel,
  footballWeekTitle,
  sortCfbDeskGames,
  sportScoreBands,
  weekDayStamp,
  type BoxGame,
  type BoxSide,
  type SectionBoard,
} from "./newspaper-box.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function side(abbrev: string): BoxSide {
  return {
    id: abbrev,
    name: abbrev,
    short: abbrev,
    abbrev,
    logo: null,
    color: null,
    score: null,
    hits: null,
    errors: null,
    record: null,
    winner: false,
    rank: null,
    lines: [],
  };
}

function game(partial: Partial<BoxGame> & Pick<BoxGame, "id" | "day" | "final">): BoxGame {
  return {
    path: "football/college-football",
    league: "CFB",
    startIso: `${partial.day}T16:00:00Z`,
    status: partial.final ? "Final" : "11:00 AM",
    live: false,
    venue: null,
    round: null,
    series: null,
    periods: [],
    away: side("IU"),
    home: side("NEB"),
    decisions: [],
    probables: { away: null, home: null },
    leaders: [],
    scoring: [],
    recap: null,
    broadcasts: [],
    gamePk: null,
    espnEventId: partial.id,
    href: null,
    ...partial,
  };
}

const week6 = [
  game({ id: "w6a", day: "2026-10-03", final: true, away: { ...side("MIZ"), score: "45" }, home: { ...side("FLA"), score: "17" } }),
  game({ id: "w6b", day: "2026-10-03", final: true }),
];
const week7 = [
  game({ id: "w7a", day: "2026-10-10", final: false }),
  game({ id: "w7b", day: "2026-10-10", final: false }),
];

assert(weekDayStamp(week6) === "Sat Oct 3", "Saturday stamp for last week");
assert(weekDayStamp(week7) === "Sat Oct 10", "Saturday stamp for this week");
assert(
  footballWeekTitle("results", 6, week6) === "Week 6 results (Sat Oct 3)",
  "results title carries the week and the Saturday",
);
assert(
  footballWeekTitle("schedule", 7, week7) === "Week 7 schedule (Sat Oct 10)",
  "schedule title carries the next Saturday",
);

const board: SectionBoard = {
  results: week6,
  slate: week7,
  week: week7,
  weekLabel: "Week 7",
  weekNumber: 7,
  prior: week6,
  priorLabel: "Week 6",
  priorWeekNumber: 6,
  resultsWeekNumber: 6,
  slateWeekNumber: 7,
};

const bands = sportScoreBands("football/college-football", board, "2026-10-05");
assert(bands.length === 2, "CFB prints two bands");
assert(bands[0]?.title === "Week 6 results (Sat Oct 3)", "first band is last week's results");
assert(bands[1]?.title === "Week 7 schedule (Sat Oct 10)", "second band is this week's slate");
assert(
  !bands[0]!.games.some((g) => !g.final) && !bands[1]!.games.some((g) => g.final),
  "the two bands never share finals and kickoffs",
);

const mixed = sportScoreBands(
  "football/college-football",
  { ...board, week: [...week6, ...week7] },
  "2026-10-05",
);
assert(
  mixed[0]!.games.every((g) => g.final) && mixed[1]!.games.every((g) => !g.final),
  "even if week is mixed, the printed bands stay split",
);

const scattered = [
  game({ id: "sat-late", day: "2026-10-10", final: false, startIso: "2026-10-10T23:30:00Z" }),
  game({ id: "fri-late", day: "2026-10-09", final: false, startIso: "2026-10-10T02:15:00Z" }),
  game({ id: "sat-noon", day: "2026-10-10", final: false, startIso: "2026-10-10T16:00:00Z" }),
  game({ id: "fri-early", day: "2026-10-09", final: false, startIso: "2026-10-10T01:00:00Z" }),
];
const chrono = sortCfbDeskGames(scattered).map((g) => g.id);
assert(
  chrono.join(",") === "fri-early,fri-late,sat-noon,sat-late",
  `CFB slate is kickoff order, got ${chrono.join(",")}`,
);

const noTv = game({
  id: "husky",
  day: "2026-10-09",
  final: false,
  venue: "Husky Stadium",
  broadcasts: [],
});
assert(cfbNetworkLabel(noTv) === "", "unknown TV stays blank instead of the venue");
assert(
  cfbNetworkLabel({ ...noTv, broadcasts: ["ABC"] }) === "ABC",
  "known TV still prints the network",
);

console.log("newspaper-cfb-weeks ok");
