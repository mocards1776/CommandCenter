/**
 * A full, realistic edition with no network behind it.
 *
 * `/newspaper-preview.html` (dev server only) renders `NewspaperEdition` from
 * this fixture so the printed layout — column flow, page breaks, orphan and
 * widow control — can be checked in Print Preview without Todoist, Supabase
 * or ESPN in the loop. Keep it roughly as dense as a busy weekday.
 */

import type { EditionData, EditionEntry, EditionScore } from "./NewspaperEdition";

function entries(rows: (readonly [string, string?, string?])[], prefix: string): EditionEntry[] {
  return rows.map(([title, value, note], i) => ({
    id: `${prefix}-${i}`,
    title,
    value: value ?? null,
    note: note ?? null,
  }));
}

function score(
  id: string,
  away: [string, number, string],
  home: [string, number, string],
  status: string,
  detail: string | null,
): EditionScore {
  return {
    id,
    away: { abbrev: away[0], score: away[1], win: away[1] > home[1], record: away[2] },
    home: { abbrev: home[0], score: home[1], win: home[1] > away[1], record: home[2] },
    status,
    detail,
  };
}

const DISPATCH_BODY = [
  "The Missouri Senate returned to the capitol on Tuesday with a redistricting map that nobody in either caucus claims to love, and a calendar that leaves eleven working days to pass it. Leadership spent the recess counting votes in private; the count, by two members' accounts, has not moved since August.",
  "What has moved is the tone. Members who spent the spring describing the map as a technical exercise now describe it as a test of the caucus itself, and the shift in language has not gone unnoticed by the governor's office, which has stayed conspicuously quiet through three weeks of it.",
  "The committee's chair says he expects a floor vote before the end of next week. Two members of his own committee say that timeline assumes an agreement that does not exist yet, and a third would only say that the chair has been optimistic before.",
  "Outside the chamber, the politics are simpler and louder. County party organizations in the southwest have passed resolutions urging a no vote; the state organization has stayed out of it, which those county chairs read as its own answer.",
  "Democrats, for their part, have said little in public and a good deal in committee, where their questions have focused less on the lines themselves than on the process that produced them — who drew them, on whose software, and at whose direction.",
  "The answer to the first question is a consultant in Jefferson City who has not returned four calls over two weeks. The answer to the second is a commercial package used by map-drawers in a dozen states. The answer to the third is the one nobody will put a name to.",
  "That reticence is doing real work. A map with no author is a map with no one to lobby, and members who would like to trade a precinct here for a precinct there have found there is no counter to bring the trade to.",
  "Meanwhile the clock runs. If the Senate fails to act by the end of the month, the question moves to a court that has already signaled, in an unrelated filing, that it considers legislative delay a poor argument for judicial patience.",
  "Members who have been through a court-drawn map before describe it the way farmers describe hail: survivable, expensive, and nothing you would choose.",
  "The chair's own seat is not at issue under any version of the map now circulating, a fact his critics mention often and his allies say is beside the point. Both are probably right, which is the trouble with the whole exercise.",
  "A vote count taken Wednesday evening by a member who asked not to be named put the map two short in the caucus and four short on the floor. The same member put the odds of a vote next week at even money, and the odds of a vote this month at better than that.",
  "The House, which passed its version in March and has watched the Senate ever since, has scheduled no business for the last week of the month. Its leadership declined to say whether that was a courtesy or a warning.",
];

export const PREVIEW_EDITION: EditionData = {
  volume: 2026,
  issue: 253,
  dateLabel: "Thursday, September 10, 2026",
  dateline: "THU, SEP 10, 2026",
  place: "Marshfield, Mo.",
  lede: [
    "Marshfield woke to 62° and partly cloudy, headed for 81° before falling back to 58°. Eleven items carry a date, three of them already past due. The morning opens on Call the county assessor about the Evans Road parcel.",
    "The day book holds four appointments, beginning with Standup at 9:00 AM. Three of five standing habits are already struck off. 38 pages read against a goal of 40. Six finals landed overnight; nine clubs remain in season on the sports page.",
  ],
  lead: {
    kicker: "The desk",
    hed: "Call the county assessor about the Evans Road parcel",
    dek: "11 due · 3 overdue · 3/5 habits · 4 on calendar · 9 in-season",
  },
  weather: {
    glyph: "⛅",
    tempF: 62,
    summary: "Partly cloudy",
    days: [
      { key: "d1", label: "Thu", glyph: "⛅", high: 81, low: 58 },
      { key: "d2", label: "Fri", glyph: "🌧", high: 74, low: 61 },
      { key: "d3", label: "Sat", glyph: "☀", high: 79, low: 55 },
      { key: "d4", label: "Sun", glyph: "🌤", high: 83, low: 60 },
    ],
  },
  scoreboard: {
    figure: ".412",
    figureLabel: "Batting average",
    stats: [
      { key: "hits", label: "Hits", value: "7" },
      { key: "ab", label: "At bats", value: "17" },
      { key: "k", label: "K", value: "3" },
      { key: "deck", label: "On deck", value: "5" },
      { key: "streak", label: "Streak", value: "12d" },
      { key: "done", label: "Closed", value: "6" },
    ],
  },
  dayBook: {
    today: [
      { id: "e1", when: "9:00 AM", title: "Standup" },
      { id: "e2", when: "11:30 AM", title: "Title company — Evans Road closing docs" },
      { id: "e3", when: "2:00 PM", title: "Insurance walkthrough at Buena Vista" },
      { id: "e4", when: "6:15 PM", title: "Dinner with the Fyans" },
    ],
    tomorrow: [
      { id: "t1", when: "8:00 AM", title: "Contractor bid review" },
      { id: "t2", when: "1:00 PM", title: "Quarterly numbers" },
    ],
    empty: "Nothing scheduled.",
  },
  agenda: {
    entries: [
      { id: "a1", when: "P1", title: "Call the county assessor about the Evans Road parcel", value: "2d overdue", late: true },
      { id: "a2", when: "P1", title: "Send the signed insurance rider back to Farm Bureau", value: "1d overdue", late: true },
      { id: "a3", when: "P2", title: "Reconcile the Buena Vista escrow statement", value: "Yesterday", late: true },
      { id: "a4", when: "P1", title: "Pull the survey for the north fence line", value: "Today" },
      { id: "a5", when: "P2", title: "Draft the tenant letter for October", value: "Today" },
      { id: "a6", when: "P2", title: "Order replacement filters for the upstairs unit", value: "Today" },
      { id: "a7", when: "P3", title: "Book the fall chimney inspection", value: "Today" },
      { id: "a8", when: "P3", title: "Move the reading log into the new sheet", value: "Today" },
      { id: "a9", when: "P4", title: "Return the library holds", value: "Today" },
      { id: "a10", when: "P4", title: "Sharpen the mower blades before the last cut", value: "Today" },
    ],
    note: "8 due · 3 late",
    empty: "Nothing carries a date today.",
  },
  habits: {
    entries: [
      { id: "h1", mark: "■", title: "Read 40 pages", value: "12d", done: true },
      { id: "h2", mark: "■", title: "Walk three miles", value: "31d", done: true },
      { id: "h3", mark: "■", title: "Write the day's note", value: "9d", done: true },
      { id: "h4", mark: "□", title: "Strength work", value: "4d" },
      { id: "h5", mark: "□", title: "Inbox to zero" },
    ],
    note: "3 of 5",
    empty: "No habits on the books.",
  },
  teams: {
    entries: entries(
      [
        ["Cardinals", "83-72 · MLB", "Last W · beat CHC 6-3"],
        ["Chiefs", "2-0 · NFL", "Next · at LAC · Sun 3:25"],
        ["Mizzou", "3-0 · SEC", "Last W · beat VAN 38-17"],
        ["Blues", "0-0 · NHL", "Next · vs MIN · Oct 9"],
        ["Arsenal", "4-1-0 · EPL", "Last W · beat TOT 2-1"],
        ["Sporting KC", "12-11-8 · MLS", "Next · at HOU · Sat 7:30"],
        ["Nuggets", "0-0 · NBA", "Next · vs OKC · Oct 21"],
        ["Springfield Cards", "71-66 · AA", "Last L · fell to NWA 4-2"],
        ["Missouri State", "2-1 · CUSA", "Next · vs UTEP · Sat 6:00"],
      ],
      "team",
    ),
    note: "nine in season",
    empty: "Every club is out of season.",
  },
  upcoming: {
    entries: entries(
      [
        ["Cardinals · vs MIL", "Today 6:45", "Busch Stadium · Mikolas vs Peralta"],
        ["Sporting KC · at HOU", "Sat 7:30", "Shell Energy Stadium"],
        ["Mizzou · vs UMass", "Sat 11:00", "Faurot Field"],
        ["Chiefs · at LAC", "Sun 3:25", "SoFi Stadium"],
        ["Arsenal · vs Everton", "Sun 9:00", "Emirates Stadium"],
        ["Cardinals · vs MIL", "Sun 1:15", "Busch Stadium"],
        ["Blues · vs Wild", "Oct 9", "Enterprise Center"],
        ["Nuggets · vs Thunder", "Oct 21", "Ball Arena"],
      ],
      "up",
    ),
    note: "Next up",
    empty: "Nothing on the schedule.",
  },
  boards: [
    {
      key: "mlb",
      label: "Baseball",
      note: "MLB",
      games: [
        score("m1", ["MIL", 3, "88-67"], ["STL", 6, "83-72"], "Final", "Busch Stadium"),
        score("m2", ["CHC", 2, "80-75"], ["PIT", 5, "70-85"], "Final", "PNC Park"),
        score("m3", ["LAD", 7, "92-63"], ["SF", 4, "78-77"], "Final", "Oracle Park"),
        score("m4", ["NYY", 1, "89-66"], ["BOS", 2, "81-74"], "Final", "Fenway Park"),
        score("m5", ["ATL", 0, "85-70"], ["PHI", 0, "90-65"], "7:05 PM", "Gray vs Wheeler"),
        score("m6", ["SD", 0, "84-71"], ["ARI", 0, "79-76"], "8:40 PM", "Chase Field"),
      ],
      empty: "No games on the card.",
    },
    {
      key: "nfl",
      label: "Pro football",
      note: "NFL",
      games: [
        score("n1", ["KC", 27, "2-0"], ["CIN", 24, "1-1"], "Final", "Paycor Stadium"),
        score("n2", ["BUF", 31, "2-0"], ["MIA", 10, "0-2"], "Final", "Hard Rock Stadium"),
        score("n3", ["SF", 0, "1-1"], ["SEA", 0, "1-1"], "Sun 3:05", "Lumen Field"),
      ],
      empty: "No games on the card.",
    },
    {
      key: "cfb",
      label: "College football",
      note: "FBS",
      games: [
        score("c1", ["VAN", 17, "1-2"], ["MIZ", 38, "3-0"], "Final", "Faurot Field"),
        score("c2", ["ALA", 24, "2-1"], ["UGA", 27, "3-0"], "Final", "Sanford Stadium"),
        score("c3", ["OSU", 41, "3-0"], ["IND", 7, "2-1"], "Final", "Memorial Stadium"),
      ],
      empty: "No games on the card.",
    },
    {
      key: "soccer",
      label: "Soccer",
      note: "Worldwide",
      games: [
        score("s1", ["TOT", 1, "2-1-2"], ["ARS", 2, "4-1-0"], "FT", "Premier League"),
        score("s2", ["RMA", 3, "5-0-0"], ["ATM", 1, "3-1-1"], "FT", "LaLiga"),
      ],
      empty: "No matches on the card.",
    },
  ],
  finals: {
    note: "Sep 9",
    groups: [
      {
        key: "mlb",
        label: "Baseball",
        games: [
          score("f1", ["MIL", 3, ""], ["STL", 6, ""], "Final", "Contreras 2 HR"),
          score("f2", ["NWA", 4, ""], ["SPR", 2, ""], "Final", "Texas League"),
        ],
      },
      {
        key: "soccer",
        label: "Soccer",
        games: [score("f3", ["TOT", 1, ""], ["ARS", 2, ""], "Final", "North London derby")],
      },
    ],
    empty: "No favorite-team finals overnight.",
  },
  players: {
    entries: entries(
      [
        ["Willson Contreras · C", "MLB STL", "AVG .262 · HR 21 · RBI 74 · OPS .810 — Yday vs MIL: 2-4, 2 HR, 4 RBI"],
        ["Masyn Winn · SS", "MLB STL", "AVG .271 · HR 15 · RBI 58 · SB 11 — Yday vs MIL: 1-4, RBI"],
        ["Sonny Gray · SP", "MLB STL", "ERA 3.42 · W 13 · SO 191 · IP 176.1 · WHIP 1.09"],
        ["Patrick Mahomes · QB", "NFL KC", "CMP 44 · YDS 561 · TD 5 · INT 1 · RTG 108.4"],
        ["Travis Kelce · TE", "NFL KC", "REC 12 · YDS 141 · TD 2"],
        ["Brady Cook · QB", "CFB MIZ", "CMP 61 · YDS 812 · TD 8 · INT 1"],
        ["Luther Burden III · WR", "CFB MIZ", "REC 24 · YDS 331 · TD 4"],
        ["Bukayo Saka · RW", "EPL ARS", "G 4 · A 3 · SHOTS 17 — Yday vs TOT: 1 goal"],
      ],
      "player",
    ),
    note: "Season lines",
    empty: "No season lines filed.",
  },
  standings: {
    tables: [
      {
        key: "nlc",
        title: "NL Central",
        note: "MLB",
        columns: ["#", "Team", "W-L", "GB", "PO%", "WC%"],
        rows: [
          { key: "r1", cells: ["1", "MIL", "88-67", "—", "99%", "1.0%"] },
          { key: "r2", cells: ["2", "CHC", "80-75", "8.0", "42%", "38%"] },
          { key: "r3", cells: ["3", "STL", "83-72", "5.0", "61%", "54%"], highlight: true },
          { key: "r4", cells: ["4", "CIN", "76-79", "12.0", "8.4%", "8.1%"] },
          { key: "r5", cells: ["5", "PIT", "70-85", "18.0", "0.2%", "0.2%"] },
        ],
      },
      {
        key: "nle",
        title: "NL East",
        note: "MLB",
        columns: ["#", "Team", "W-L", "GB", "PO%", "WC%"],
        rows: [
          { key: "e1", cells: ["1", "PHI", "90-65", "—", "99%", "0.5%"] },
          { key: "e2", cells: ["2", "ATL", "85-70", "5.0", "78%", "71%"] },
          { key: "e3", cells: ["3", "NYM", "82-73", "8.0", "44%", "43%"] },
          { key: "e4", cells: ["4", "WSH", "70-85", "20.0", "0.1%", "0.1%"] },
          { key: "e5", cells: ["5", "MIA", "62-93", "28.0", "—", "—"] },
        ],
      },
      {
        key: "nlw",
        title: "NL West",
        note: "MLB",
        columns: ["#", "Team", "W-L", "GB", "PO%", "WC%"],
        rows: [
          { key: "w1", cells: ["1", "LAD", "92-63", "—", "99%", "0.3%"] },
          { key: "w2", cells: ["2", "SD", "84-71", "8.0", "72%", "68%"] },
          { key: "w3", cells: ["3", "ARI", "79-76", "13.0", "18%", "18%"] },
          { key: "w4", cells: ["4", "SF", "78-77", "14.0", "12%", "12%"] },
          { key: "w5", cells: ["5", "COL", "58-97", "34.0", "—", "—"] },
        ],
      },
      {
        key: "afcw",
        title: "AFC West",
        note: "NFL",
        columns: ["#", "Team", "W-L", "GB", "PO%", "WC%"],
        rows: [
          { key: "k1", cells: ["1", "Chiefs", "2-0", "—", "—", "—"], highlight: true },
          { key: "k2", cells: ["2", "Chargers", "1-1", "1.0", "—", "—"] },
          { key: "k3", cells: ["3", "Broncos", "1-1", "1.0", "—", "—"] },
          { key: "k4", cells: ["4", "Raiders", "0-2", "2.0", "—", "—"] },
        ],
      },
      {
        key: "sec",
        title: "SEC",
        note: "CFB",
        columns: ["#", "Team", "W-L", "GB", "PO%", "WC%"],
        rows: [
          { key: "s1", cells: ["1", "Georgia", "3-0", "—", "—", "—"] },
          { key: "s2", cells: ["2", "Texas", "3-0", "—", "—", "—"] },
          { key: "s3", cells: ["3", "Missouri", "3-0", "—", "—", "—"], highlight: true },
          { key: "s4", cells: ["4", "Alabama", "2-1", "1.0", "—", "—"] },
          { key: "s5", cells: ["5", "LSU", "2-1", "1.0", "—", "—"] },
        ],
      },
      {
        key: "epl",
        title: "Premier League",
        note: "Soccer",
        columns: ["#", "Team", "W-L", "GB", "PO%", "WC%"],
        rows: [
          { key: "p1", cells: ["1", "Arsenal", "4-1-0", "13", "—", "—"], highlight: true },
          { key: "p2", cells: ["2", "Liverpool", "4-0-1", "12", "—", "—"] },
          { key: "p3", cells: ["3", "Man City", "3-1-1", "10", "—", "—"] },
          { key: "p4", cells: ["4", "Chelsea", "3-0-2", "9", "—", "—"] },
          { key: "p5", cells: ["5", "Spurs", "2-1-2", "8", "—", "—"] },
        ],
      },
    ],
    empty: "Standings unavailable.",
  },
  leaders: {
    boards: [
      {
        key: "hr",
        label: "Home runs",
        entries: entries(
          [["1. Ohtani", "LAD 51"], ["2. Judge", "NYY 48"], ["3. Schwarber", "PHI 44"], ["4. Alonso", "NYM 39"], ["5. Raleigh", "SEA 37"]],
          "hr",
        ),
      },
      {
        key: "avg",
        label: "Batting average",
        entries: entries(
          [["1. Arraez", "SD .331"], ["2. Witt", "KC .327"], ["3. Guerrero", "TOR .322"], ["4. Freeman", "LAD .318"], ["5. Betts", "LAD .311"]],
          "avg",
        ),
      },
      {
        key: "era",
        label: "Earned run average",
        entries: entries(
          [["1. Skenes", "PIT 1.96"], ["2. Sale", "ATL 2.38"], ["3. Wheeler", "PHI 2.57"], ["4. Skubal", "DET 2.61"], ["5. Gray", "STL 3.42"]],
          "era",
        ),
      },
      {
        key: "k",
        label: "Strikeouts",
        entries: entries(
          [["1. Skubal", "DET 228"], ["2. Wheeler", "PHI 219"], ["3. Gray", "STL 191"], ["4. Cease", "SD 188"], ["5. Burnes", "BAL 181"]],
          "k",
        ),
      },
      {
        key: "rbi",
        label: "Runs batted in",
        entries: entries(
          [["1. Judge", "NYY 132"], ["2. Ohtani", "LAD 119"], ["3. Alvarez", "HOU 111"], ["4. Olson", "ATL 104"], ["5. Contreras", "STL 74"]],
          "rbi",
        ),
      },
    ],
    empty: "Leaders unavailable.",
  },
  reading: {
    stats: [
      { key: "today", label: "Today", value: "38/40" },
      { key: "streak", label: "Streak", value: "12d" },
      { key: "best", label: "Best", value: "41d" },
      { key: "week", label: "Week", value: "266" },
      { key: "month", label: "Month", value: "912" },
      { key: "marks", label: "Marks", value: "148" },
    ],
    summary:
      "Finished this week: 1 books and 2 magazines. This month: 4 books and 6 magazines.",
    now: {
      entries: entries(
        [
          ["The Power Broker", "742/1246 · 60%", "Robert A. Caro"],
          ["Wind, Sand and Stars", "88/229 · 38%", "Antoine de Saint-Exupéry"],
          ["The Sportswriter", "31/375 · 8%", "Richard Ford"],
        ],
        "now",
      ),
      note: "3",
      empty: "Nothing marked currently reading.",
    },
    week: {
      entries: entries(
        [
          ["The Power Broker", "112p"],
          ["Wind, Sand and Stars", "64p"],
          ["The Sportswriter", "31p"],
          ["Harper's, September", "38p"],
          ["The Atlantic, October", "21p"],
        ],
        "wk",
      ),
      note: "7 days",
      empty: "No pages logged this week.",
    },
    yesterday: {
      entries: entries([["The Power Broker", "26p"], ["Harper's, September", "12p"]], "yd"),
      note: "38p",
    },
    onDeck: {
      entries: entries(
        [
          ["The Making of the Atomic Bomb", "Richard Rhodes"],
          ["A River Runs Through It", "Norman Maclean"],
          ["Bad Blood", "John Carreyrou"],
          ["The Path Between the Seas", "David McCullough"],
          ["Levels of the Game", "John McPhee"],
        ],
        "deck",
      ),
      note: "5",
      empty: "On-deck shelf is empty.",
    },
  },
  dispatch: {
    kicker: "Missouri Scout",
    hed: "Senate returns with a map, a deadline, and no author willing to claim either",
    meta: "Sep 10 · Dave Drebes · 1,240 words · 3 read · 5 marks",
    paragraphs: DISPATCH_BODY,
    continued: true,
    wire: entries(
      [
        ["Governor's office stays quiet on redistricting timeline", "Sep 9", "Dave Drebes"],
        ["Southwest county chairs pass no-vote resolutions", "Sep 9", "Staff"],
        ["Committee chair's seat untouched by any current draft", "Sep 8", "Dave Drebes"],
        ["House schedules no business for the last week of the month", "Sep 8", "Staff"],
        ["Consultant behind the map has not returned four calls", "Sep 6", "Dave Drebes"],
        ["Court signals impatience with legislative delay in unrelated filing", "Sep 5", "Staff"],
        ["Two members put the caucus count two short", "Sep 4", "Dave Drebes"],
        ["Farm groups line up behind the House version", "Sep 3", "Staff"],
      ],
      "wire",
    ),
    empty: "Missouri Scout wire is empty this morning.",
  },
};
