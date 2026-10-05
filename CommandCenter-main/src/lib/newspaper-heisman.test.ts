/**
 * Run with: node --experimental-strip-types src/lib/newspaper-heisman.test.ts
 * from CommandCenter-main/.
 */
import {
  attachHeismanLogos,
  formatHeismanAsOf,
  impliedYesProb,
  schoolFromSubtitle,
  squashSchool,
  type HeismanBoard,
} from "./newspaper-heisman.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(squashSchool("Ohio St.") === "ohio state", "Ohio St. squashes to ohio state");
assert(squashSchool("Miami (FL)") === "miami fl", "Miami (FL) keeps the campus");
assert(schoolFromSubtitle(":: Nebraska") === "Nebraska", "school after the double colon");
assert(schoolFromSubtitle('William “Pop” Watson III:: UMass') === "UMass", "name:: school");

assert(
  impliedYesProb({ yes_bid_dollars: "0.47", yes_ask_dollars: "0.48", last_price_dollars: "0.47" }) === 0.475,
  "midpoint when both sides are posted",
);
assert(
  impliedYesProb({ yes_bid_dollars: "0.0000", yes_ask_dollars: "0.0100", last_price_dollars: "0.0100" }) === 0.005,
  "thin book still uses the midpoint",
);
assert(
  impliedYesProb({ yes_bid_dollars: null, yes_ask_dollars: null, last_price_dollars: "0.10" }) === 0.1,
  "last price when the book is empty",
);

assert(
  formatHeismanAsOf("2026-10-05T16:30:00.822061Z") === "Kalshi odds as of 11:30 AM CT",
  "credit line is Central time",
);

const board: HeismanBoard = {
  title: "Heisman Trophy Winner",
  asOf: "Kalshi odds as of 11:30 AM CT",
  asOfIso: "2026-10-05T16:30:00Z",
  rows: [
    { name: "Jeremiah Smith", school: "Ohio St.", pct: 48, logo: null, ticker: "JSMIT" },
    { name: "Trinidad Chambliss", school: "Ole Miss", pct: 6, logo: null, ticker: "TCHAM" },
  ],
};
const withLogos = attachHeismanLogos(board, [
  { name: "Ohio State", abbrev: "OSU", logo: "https://example/osu.png" },
]);
assert(withLogos.rows[0]?.logo === "https://example/osu.png", "poll hint attaches the school mark");
assert(withLogos.rows[1]?.logo?.includes("/145.png"), "Ole Miss falls back to the ESPN mark");

console.log("newspaper-heisman ok");
