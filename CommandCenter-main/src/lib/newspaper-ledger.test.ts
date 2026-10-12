/**
 * Run with: npx tsx src/lib/newspaper-ledger.test.ts
 * from CommandCenter-main/. Clubs and games are made up.
 */
import { buildClubLedger, gameDate, resultLine, shiftDate, shortStanding } from "./newspaper-ledger.ts";
import type { TeamInfobox } from "./newspaper-sports.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function club(key: string, over: Partial<TeamInfobox["detail"] & object>, state: TeamInfobox["seasonState"] = "active"): TeamInfobox {
  return {
    fav: { key, kind: "team", name: key, shortName: key.toUpperCase(), league: "NHL", sport: "Hockey", color: "002f87" } as TeamInfobox["fav"],
    snap: { key, name: key, shortName: key, abbreviation: key, logo: null, color: null, record: null, standing: null, nextGame: null, lastGame: null },
    detail: {
      key,
      name: key,
      shortName: key,
      abbrev: null,
      logo: null,
      color: null,
      record: "1-2-1",
      standing: "7th in Central Division",
      playoffOdds: null,
      wildCardOdds: null,
      soccerPromotion: null,
      manager: null,
      generalManager: null,
      division: [],
      upcoming: [],
      recent: [],
      roster: [],
      hittingLeaders: [],
      pitchingLeaders: [],
      teamHitting: [],
      teamPitching: [],
      playerTables: [],
      teamFacts: [],
      source: "espn",
      ...over,
    } as TeamInfobox["detail"],
    href: `/sports/${key}`,
    seasonState: state,
    form: [],
    odds: null,
    teamStats: [],
    recentLines: [],
  };
}

const g = (label: string, when: string | null, extra: Record<string, unknown> = {}) => ({
  id: `${label}-${when}`,
  when,
  startIso: null,
  label,
  detail: null,
  status: "Scheduled",
  won: null,
  live: false,
  ...extra,
});

// Dates printed on the schedule read against the edition.
assert(gameDate(g("vs CBJ", "Sat, Oct 10, 6:00 PM"), "2026-10-09")?.date === "2026-10-10", "weekday, month, day, hour");
assert(gameDate(g("vs CBJ", "Sat, Oct 10, 6:00 PM"), "2026-10-09")?.time === "6:00 PM", "the hour");
assert(gameDate(g("@ ARK", "Sat, Oct 31"), "2026-10-09")?.time === null, "no hour yet");
assert(gameDate(g("@ X", "Sat, Jan 3, 1:00 PM"), "2026-12-30")?.date === "2027-01-03", "new year ahead");
assert(gameDate(g("@ X", "Tue, Dec 30, 1:00 PM"), "2027-01-02")?.date === "2026-12-30", "old year behind");
assert(gameDate(g("@ X", null, { startIso: "2026-10-13T23:30Z" }), "2026-10-09")?.date === "2026-10-13", "ISO fallback");
assert(gameDate(g("@ X", null), "2026-10-09") === null, "nothing to read");
assert(shiftDate("2026-10-30", 3) === "2026-11-02", "month roll");

assert(shortStanding("7th in Central Division") === "7th · Central", "division dropped");
assert(shortStanding("4th in National League Central") === "4th · NL Central", "league abbreviated");
assert(shortStanding("14th in English League Championship") === "14th · Championship", "soccer tier");
assert(shortStanding(null) === null, "no standing");

assert(resultLine({ detail: "4–0", won: true }) === "W 4–0", "win");
assert(resultLine({ detail: "1–1", won: false }) === "D 1–1", "draw reads D");
assert(resultLine({ detail: "2–3", won: false }) === "L 2–3", "loss");

const blues = club("nhl-stl", {
  upcoming: [g("vs CBJ", "Sat, Oct 10, 6:00 PM"), g("@ OTT", "Tue, Oct 13, 6:30 PM"), g("@ MIN", "Thu, Oct 15, 7:00 PM"), g("vs X", "Sat, Oct 17, 7:00 PM")],
  recent: [
    g("vs SJ", "Thu, Oct 8, 7:00 PM", { won: false, detail: "2–3", status: "Loss" }),
    g("@ CHI", "Tue, Oct 6, 7:00 PM", { won: false, detail: "2–4", status: "Loss" }),
    g("@ DAL", "Fri, Oct 2, 8:00 PM", { won: true, detail: "4–0", status: "Win" }),
  ],
});
const cards = club("mlb-stl", { record: "77-85", standing: "4th in National League Central" }, "complete");
const idle = club("nfl-kc", { upcoming: [g("vs LAC", "Sun, Oct 18, 3:25 PM")], standing: "1st in AFC West" });
const today = club("cfb-mu", {
  recent: [g("vs FLA", "Fri, Oct 9, 11:00 AM", { won: true, detail: "45–17", status: "Final" })],
});

const ledger = buildClubLedger([blues, cards, idle, today], "2026-10-09");
assert(ledger.days.length === 7 && ledger.days[0]!.weekday === "Today" && ledger.days[1]!.weekday === "Sat", "seven days from today");
assert(ledger.rows.map((r) => r.key).join() === "nhl-stl,cfb-mu,mlb-stl,nfl-kc", "clubs with games lead, idle clubs close");
const b = ledger.rows[0];
const m = ledger.rows[1];
const c = ledger.rows[2];
const k = ledger.rows[3];
assert(b!.cells[1]?.label === "vs CBJ" && b!.cells[1]?.when === "6:00 PM", "Saturday's game in Saturday's cell");
assert(b!.cells[4]?.label === "@ OTT" && b!.cells[6]?.label === "@ MIN", "the rest of the week");
assert(b!.cells[0] === null && b!.cells[2] === null, "idle days blank");
assert(b!.form.length === 3 && b!.form[0]!.won === true && b!.form[2]!.won === false, "form oldest to newest");
assert(b!.next === "", "a club with games this week needs no next line");
assert(b!.standing === "7th · Central", "standing shortened");
assert(c!.next === "Season complete" && c!.cells.every((x) => x === null), "closed season");
assert(c!.record === "77-85", "record from detail");
assert(k!.next === "Oct 18 · vs LAC", "the next game past the week");
assert(m!.cells[0]?.when === "W 45–17" && m!.cells[0]?.done, "today's result in today's cell");

console.log("newspaper-ledger: ok");
