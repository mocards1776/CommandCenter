/**
 * Run with: node --experimental-strip-types src/lib/newspaper-box-wrap.test.ts
 * from CommandCenter-main/.
 */
import {
  hasEspnRecap,
  leadersFromSummary,
  lineHighlight,
  periodPhrase,
  wrapBriefSentences,
  writeBoxWrap,
  type BoxWrapGame,
} from "./newspaper-box-wrap.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(periodPhrase("basketball/nba", "3") === "the third quarter", "NBA period reads as a quarter");
assert(periodPhrase("hockey/nhl", "2") === "the second period", "NHL period");
assert(periodPhrase("baseball/mlb", "6") === "the sixth", "MLB inning");
assert(periodPhrase("football/nfl", "OT") === "overtime", "OT");

const nba: BoxWrapGame = {
  league: "NBA",
  path: "basketball/nba",
  preseason: true,
  statusDetail: "Final",
  away: { name: "Utah Jazz", short: "Jazz", abbrev: "UTAH", score: "98", winner: false, record: "0-2" },
  home: { name: "Denver Nuggets", short: "Nuggets", abbrev: "DEN", score: "124", winner: true, record: "2-0" },
  leaders: [
    { name: "N. Jokic", line: "18 PTS, 8 REB, 6 AST" },
    { name: "J. Murray", line: "16 PTS" },
  ],
  lines: [
    { period: "1", away: 22, home: 28 },
    { period: "2", away: 28, home: 30 },
    { period: "3", away: 22, home: 36 },
    { period: "4", away: 26, home: 30 },
  ],
};

const wrap = writeBoxWrap(nba);
assert(wrap.wrapKind === "box", "missing ESPN recap becomes a box wrap");
assert(/Denver Nuggets beat Utah Jazz 124-98 in preseason play/.test(wrap.body), wrap.body);
assert(/outscored Utah Jazz 36-22 in the third quarter/.test(wrap.body), `line: ${wrap.body}`);
assert(/N\. Jokic/.test(wrap.body) && /18 PTS/.test(wrap.body), "leaders");
assert(/Denver Nuggets is 2-0/.test(wrap.body), "records");
assert(!/Times box wrap/.test(wrap.body), "the label lives on the page, not in the prose");

const highlight = lineHighlight(nba);
assert(highlight?.includes("third quarter"), highlight ?? "missing highlight");

assert(!hasEspnRecap("short blurb"), "under 200 is not an ESPN recap");
assert(hasEspnRecap("x".repeat(200)), "200 characters is enough");

const long = "One. Two. Three. Four. Five. Six.";
assert(wrapBriefSentences(long, 4) === "One. Two. Three. Four.", wrapBriefSentences(long, 4));

const nfl: BoxWrapGame = {
  league: "NFL",
  path: "football/nfl",
  statusDetail: "Final/OT",
  away: { name: "Kansas City Chiefs", short: "Chiefs", abbrev: "KC", score: "30", winner: true, record: "2-2" },
  home: { name: "Las Vegas Raiders", short: "Raiders", abbrev: "LV", score: "27", winner: false, record: "1-3" },
  leaders: [{ name: "P. Mahomes", line: "285 YDS, 2 TD" }],
  lines: [
    { period: "1", away: 7, home: 3 },
    { period: "2", away: 3, home: 14 },
    { period: "3", away: 6, home: 7 },
    { period: "4", away: 7, home: 3 },
    { period: "OT", away: 7, home: 0 },
  ],
};
const kc = writeBoxWrap(nfl);
assert(/in overtime/.test(kc.body), kc.body);
assert(/P\. Mahomes/.test(kc.body), kc.body);

const stamped = leadersFromSummary({
  leaders: [
    {
      shortDisplayName: "PASS",
      leaders: [
        {
          displayValue: "31/52, 365 YDS",
          team: { abbreviation: "LV" },
          athlete: { id: "14880", shortName: "K. Cousins" },
        },
      ],
    },
  ],
});
assert(stamped[0]?.team === "LV", "the leader row stamps the player's club, not the category");

console.log("newspaper-box-wrap ok");
