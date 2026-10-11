/**
 * Run with: node --experimental-strip-types src/lib/game-more-info.test.ts
 * from CommandCenter-main/.
 */
import {
  parseGameMoreInfo,
  parseOdds,
  parseStandings,
  seriesFromSchedules,
  formFromSchedule,
  scoringFromSchedule,
  seasonStatRows,
  statLookup,
  type MoreInfoTeam,
  type RawSummary,
  type ScheduleGame,
} from "./game-more-info.ts";

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    if (actual !== expected) throw new Error(`${msg ?? "equal"}: expected ${String(expected)}, got ${String(actual)}`);
  },
  ok(v: unknown, msg?: string) {
    if (!v) throw new Error(msg ?? "ok");
  },
};
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const team = (id: string, abbrev: string, side: "home" | "away", score: number | null): MoreInfoTeam => ({
  id,
  abbrev,
  name: abbrev,
  logo: null,
  color: null,
  alternateColor: null,
  homeAway: side,
  score,
  rank: null,
  records: [],
});

test("ATS: home favorite covers", () => {
  const away = team("245", "TA&M", "away", 6);
  const home = team("142", "MIZ", "home", 27);
  const odds = parseOdds(
    {
      details: "MIZ -4.5",
      spread: -4.5,
      overUnder: 50.5,
      pointSpread: { home: { close: { line: "-4.5" }, open: { line: "-1.5" } } },
      moneyline: { away: { close: { odds: "+170" } }, home: { close: { odds: "-205" } } },
    },
    "cfb",
    away,
    home,
    true,
  )!;
  assert.equal(odds.homeLine, -4.5);
  assert.equal(odds.homeLineOpen, -1.5);
  assert.equal(odds.ats?.text, "MIZ covered −4.5 · won by 21");
  assert.equal(odds.ats?.coverId, "142");
  assert.equal(odds.total?.text, "Under 50.5 · 33 total");
  assert.equal(odds.awayMoneyline, "+170");
  assert.equal(odds.homeMoneyline, "−205");
});

test("ATS: underdog covers in a loss, and a push", () => {
  const away = team("194", "OSU", "away", 20);
  const home = team("84", "IU", "home", 17);
  const odds = parseOdds({ spread: -7 }, "cfb", away, home, true)!;
  assert.equal(odds.ats?.text, "OSU covered +7 · won by 3");
  const dog = parseOdds({ spread: 3.5 }, "cfb", team("1", "A", "away", 24), team("2", "B", "home", 21), true)!;
  assert.equal(dog.ats?.text, "B covered +3.5 · lost by 3");
  const push = parseOdds({ spread: -3 }, "nfl", team("1", "A", "away", 17), team("2", "B", "home", 20), true)!;
  assert.equal(push.ats?.coverId, null);
  assert.ok(push.ats?.text.startsWith("Push"), push.ats?.text);
});

test("no ATS result before the final", () => {
  const odds = parseOdds({ spread: -3, overUnder: 44 }, "nfl", team("1", "A", "away", 7), team("2", "B", "home", 3), false)!;
  assert.equal(odds.ats, null);
  assert.equal(odds.total, null);
  assert.equal(odds.lineLabel, "Spread");
  assert.equal(parseOdds({}, "nhl", team("1", "A", "away", 0), team("2", "B", "home", 0), false), null);
});

const game = (
  id: string,
  date: string,
  season: number,
  home: [string, string, number],
  away: [string, string, number],
): ScheduleGame => ({
  id,
  date,
  season,
  completed: true,
  neutral: false,
  venue: null,
  note: null,
  home: { id: home[0], abbrev: home[1], logo: null, score: home[2], winner: home[2] > away[2] },
  away: { id: away[0], abbrev: away[1], logo: null, score: away[2], winner: away[2] > home[2] },
});

test("series from schedules counts only the two clubs, newest first", () => {
  const games = [
    game("a", "2012-11-25T00:00Z", 2012, ["245", "TA&M", 59], ["142", "MIZ", 29]),
    game("b", "2013-11-30T00:00Z", 2013, ["142", "MIZ", 28], ["245", "TA&M", 21]),
    game("c", "2013-09-07T00:00Z", 2013, ["142", "MIZ", 38], ["99", "TOL", 23]),
    game("d", "2025-11-08T00:00Z", 2025, ["245", "TA&M", 38], ["142", "MIZ", 17]),
    game("today", "2026-10-10T00:00Z", 2026, ["142", "MIZ", 27], ["245", "TA&M", 6]),
  ];
  const s = seriesFromSchedules(games, { id: "245", abbrev: "TA&M" }, { id: "142", abbrev: "MIZ" }, "today", 2012)!;
  assert.equal(s.meetings.length, 3);
  assert.equal(s.meetings[0]!.id, "d");
  assert.equal(s.awayWins, 2);
  assert.equal(s.homeWins, 1);
  assert.equal(s.summary, "TA&M leads 2-1");
  assert.equal(s.sinceSeason, 2012);
});

test("form and scoring from a season schedule", () => {
  const games = [
    game("1", "2026-09-05T00:00Z", 2026, ["142", "MIZ", 54], ["5", "UAPB", 14]),
    game("2", "2026-09-12T00:00Z", 2026, ["8", "KU", 21], ["142", "MIZ", 38]),
    game("3", "2026-09-26T00:00Z", 2026, ["9", "MSST", 31], ["142", "MIZ", 24]),
    game("today", "2026-10-10T00:00Z", 2026, ["142", "MIZ", 27], ["245", "TA&M", 6]),
  ];
  const f = formFromSchedule(games, "142", "MIZ", "2026-10-10T00:00Z", "today")!;
  assert.equal(f.games.length, 3);
  assert.equal(f.games[0]!.opponentAbbrev, "MSST");
  assert.equal(f.games[0]!.atVs, "@");
  assert.equal(f.games[0]!.result, "L");
  assert.equal(f.games[0]!.score, "24-31");
  const sc = scoringFromSchedule(games.slice(0, 3), "142")!;
  assert.equal(sc.pointsFor.toFixed(1), "38.7");
  assert.equal(sc.pointsAgainst.toFixed(1), "22.0");
});

test("standings keep the groups with either club and pick sport columns", () => {
  const out = parseStandings(
    {
      groups: [
        {
          header: "2026 NFC West Standings",
          standings: {
            entries: [
              { team: "San Francisco", id: "25", stats: [{ name: "overall", displayValue: "4-0" }, { name: "winPercent", displayValue: "1.000" }] },
              { team: "Seattle", id: "26", stats: [{ name: "overall", displayValue: "3-1" }, { name: "winPercent", displayValue: ".750" }] },
            ],
          },
        },
        { header: "Other", standings: { entries: [{ team: "X", id: "1", stats: [] }] } },
      ],
    },
    "nfl",
    ["25", "26"],
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.title, "NFC West Standings");
  assert.equal(out[0]!.columns.join(","), "W-L,Pct");
  assert.equal(out[0]!.rows[1]!.values.join(","), "3-1,.750");
  assert.ok(out[0]!.rows.every((r) => r.highlight));
});

test("summary parse: venue, weather, officials, leaders, injuries", () => {
  const raw: RawSummary = {
    header: {
      season: { year: 2026 },
      competitions: [
        {
          date: "2026-10-11T20:25Z",
          status: { type: { state: "in" } },
          competitors: [
            { homeAway: "home", team: { id: "26", abbreviation: "SEA", color: "002a5c", alternateColor: "69be28" }, score: "16", record: [{ type: "total", summary: "3-1" }] },
            { homeAway: "away", team: { id: "25", abbreviation: "SF" }, score: "21" },
          ],
        },
      ],
    },
    gameInfo: {
      venue: { fullName: "Lumen Field", address: { city: "Seattle", state: "WA" }, grass: false },
      weather: { temperature: 61, conditionId: "Sunny", gust: 9 },
      officials: [
        { displayName: "Brad Freeman", position: { displayName: "Back Judge" }, order: 1 },
        { displayName: "Shawn Smith", position: { displayName: "Referee" }, order: 0 },
      ],
    },
    leaders: [
      { team: { id: "25" }, leaders: [{ name: "passingYards", displayName: "Passing Yards", leaders: [{ displayValue: "8/15, 79 YDS", athlete: { id: "1", shortName: "B. Purdy" } }] }] },
      { team: { id: "26" }, leaders: [{ name: "passingYards", displayName: "Passing Yards", leaders: [{ displayValue: "12/20, 140 YDS", athlete: { id: "2", shortName: "S. Darnold" } }] }] },
    ],
    injuries: [
      {
        team: { id: "26", abbreviation: "SEA" },
        injuries: [
          { status: "Questionable", athlete: { id: "9", displayName: "Drake Thomas", position: { abbreviation: "LB" } }, details: { type: "Ankle", detail: "Not Specified" } },
          { status: "Out", athlete: { id: "8", displayName: "A Player" } },
        ],
      },
    ],
  };
  const info = parseGameMoreInfo(raw, "nfl", "401872992")!;
  assert.equal(info.state, "in");
  assert.equal(info.home.records[0]!.summary, "3-1");
  assert.equal(info.gameInfo?.weather, "61° · Sunny · gusts 9 mph");
  assert.equal(info.gameInfo?.surface, "Turf");
  assert.equal(info.gameInfo?.place, "Seattle, WA");
  assert.equal(info.gameInfo?.officials[0]!.role, "Referee");
  assert.equal(info.leaders.title, "Game leaders");
  assert.equal(info.leaders.pairs[0]!.away?.shortName, "B. Purdy");
  assert.equal(info.leaders.pairs[0]!.home?.value, "12/20, 140 YDS");
  assert.equal(info.injuries[0]!.players[0]!.status, "Out", "Out sorts first");
  assert.equal(info.injuries[0]!.players[1]!.detail, "Ankle");
  assert.equal(info.odds, null);
  assert.equal(info.series, null);
});

test("season stat rows skip stats either club lacks", () => {
  const lookup = statLookup({
    results: {
      stats: {
        categories: [
          { name: "scoring", stats: [{ name: "totalPointsPerGame", value: 35.8 }] },
          { name: "miscellaneous", stats: [{ name: "turnOverDifferential", value: 1 }] },
        ],
      },
    },
  });
  const rows = seasonStatRows("cfb", lookup, lookup, { pointsAgainst: 17.7 }, { pointsAgainst: 20 });
  assert.equal(rows.map((r) => r.label).join("|"), "Points / game|Points allowed / game|Turnover margin");
  assert.equal(rows[1]!.lowerIsBetter, true);
  assert.equal(rows[2]!.away, "+1");
});

console.log(`\n${passed} tests passed`);
