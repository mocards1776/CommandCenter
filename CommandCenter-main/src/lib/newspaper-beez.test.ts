/**
 * Run with: node --experimental-strip-types src/lib/newspaper-beez.test.ts
 * from CommandCenter-main/. Sample clubs and scores are made up.
 */
import { buildEdition } from "./newspaper-sections.ts";
import { insertDayAhead, scheduleDateFor } from "./newspaper-day-ahead.ts";
import {
  asBeezDesk,
  buildBeezHeadline,
  clockOrTba,
  creditLine,
  hockeyRecord,
  insertBeez,
  namesMatch,
  printDate,
  sampleBeezDesk,
  sourceLabel,
  wpctLabel,
  type BeezDesk,
} from "./newspaper-beez.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function desk(partial: Partial<BeezDesk> = {}): BeezDesk {
  return {
    season: "Sample Rec Fall 2026",
    division: "Tin League",
    team: {
      name: "Beez",
      rink: "Sample Ice House",
      gp: 4,
      w: 0,
      l: 4,
      t: 0,
      otl: 0,
      sol: 0,
      pts: 0,
      gf: 3,
      ga: 18,
      rank: 8,
      of: 8,
      streak: "L4",
    },
    standings: [],
    skaters: [],
    goalies: [],
    last_game: {
      date: "2026-10-03",
      time: "8:00 PM",
      game_no: 4,
      stage: "Regular Season",
      home: "Beez",
      away: "Icebox",
      home_score: 0,
      away_score: 4,
      rink: "Sample Ice House",
      periods: { home: [0, 0, 0], away: [1, 2, 1] },
      shots: { home: 14, away: 28 },
      pim: { home: 6, away: 8 },
      referee: "A. Official",
      url: "https://example.com/box",
    },
    results: [],
    upcoming: [],
    source: "sportninja",
    updated_at: "2026-10-05T12:02:00Z",
    ...partial,
  };
}

assert(hockeyRecord({ w: 0, l: 4, t: 0, otl: 0, sol: 0 }) === "0-4", "plain W-L");
assert(hockeyRecord({ w: 1, l: 2, t: 1, otl: 0, sol: 0 }) === "1-2-1", "ties append");
assert(hockeyRecord({ w: 2, l: 1, t: 0, otl: 1, sol: 0 }) === "2-1-1", "OTL appends after L");
assert(namesMatch("The Beez", "Beez") && namesMatch("beez", "River Beez"), "club names fold");
assert(clockOrTba(null) === "TBA" && clockOrTba("") === "TBA", "missing clock is TBA");
assert(clockOrTba("8:00 PM") === "8 p.m." && clockOrTba("7:30 am") === "7:30 a.m.", "clock reprints in paper style");
assert(printDate("2026-10-11") === "Sun., Oct. 11", "print date");
assert(sourceLabel("sportninja") === "SportNinja" && sourceLabel("League Desk") === "League Desk", "source label");
assert(wpctLabel(0.75) === ".750" && wpctLabel(null) === "—", "winning pct");
assert(creditLine(desk()).includes("Source: SportNinja"), "credit names the source");
assert(creditLine(desk()).includes("CT"), "credit stamps Central time");

const shutout = buildBeezHeadline(desk());
assert(shutout.headline === "Icebox blanks Beez 4–0; Beez fall to 0-4", "shutout loss + record");
assert(shutout.kicker === "Sample Rec Fall 2026 · Tin League", "kicker from season and division");
assert(shutout.dek.includes("Tin League") && shutout.dek.includes("No. 8 of 8"), "dek stays on filed facts");

const win = buildBeezHeadline(
  desk({
    team: { ...desk().team, w: 1, l: 3, pts: 2, rank: 6, streak: "W1" },
    last_game: { ...desk().last_game!, home: "Harbor Club", away: "Beez", home_score: 2, away_score: 3 },
  }),
);
assert(win.headline === "Beez edge Harbor Club 3–2; Beez pick up win No. 1, now 1-3", "first win, one-goal");

const roadWin = buildBeezHeadline(
  desk({
    team: { ...desk().team, w: 2, l: 3, pts: 4, rank: 5, streak: "W2" },
    last_game: { ...desk().last_game!, home: "Northside", away: "Beez", home_score: 1, away_score: 4 },
  }),
);
assert(roadWin.headline === "Beez top Northside 4–1; Beez improve to 2-3", "later win uses improve");

const closeLoss = buildBeezHeadline(
  desk({
    team: { ...desk().team, w: 1, l: 4, pts: 2 },
    last_game: { ...desk().last_game!, home: "Beez", away: "Maple Rec", home_score: 2, away_score: 3 },
  }),
);
assert(closeLoss.headline === "Maple Rec edges Beez 3–2; Beez fall to 1-4", "one-goal loss");

const draw = buildBeezHeadline(
  desk({
    team: { ...desk().team, w: 1, l: 2, t: 1, pts: 3 },
    last_game: { ...desk().last_game!, home: "Beez", away: "Icebox", home_score: 2, away_score: 2 },
  }),
);
assert(draw.headline === "Beez and Icebox skate to a 2–2 draw; Beez sit 1-2-1", "tie");

const fromResults = buildBeezHeadline(
  desk({
    last_game: null,
    results: [{ date: "2026-10-02", opponent: "Harbor Club", home_away: "away", beez: 0, opp: 5, result: "L", rink: null, url: null }],
  }),
);
assert(fromResults.headline === "Harbor Club blanks Beez 5–0; Beez fall to 0-4", "results row fills in when no box");

const noGames = buildBeezHeadline(
  desk({
    team: { ...desk().team, gp: 0, w: 0, l: 0, pts: 0, rank: null, of: null, streak: null, gf: 0, ga: 0 },
    last_game: null,
    results: [],
  }),
);
assert(noGames.headline === "Beez await the first puck drop", "empty season");

const recordOnly = buildBeezHeadline(desk({ last_game: null, results: [] }));
assert(recordOnly.headline === "Beez sit 0-4 in Tin League", "record without a box");

const cleaned = asBeezDesk({
  season: "  Sample Rec  ",
  team: { name: "  Beez  ", gp: "4", w: 0 },
  standings: [{ team: "Icebox", gp: 4, pts: 8 }, { team: "" }, "junk"],
  skaters: [{ name: "Pat Harbor", number: 76, g: 1, a: 1, is_josh: true }, { name: "" }],
  last_game: null,
  results: [{ opponent: "Maple Rec", home_away: "home", beez: 1, opp: 3, result: "L" }],
  upcoming: [{ opponent: "Harbor Club", date: "2026-10-11", time: null }],
  source: "sportninja",
});
assert(cleaned?.team.name === "Beez" && cleaned.team.gp === 4, "team fields tidy");
assert(cleaned?.standings.length === 1 && cleaned.skaters[0]!.is_josh && cleaned.skaters[0]!.p === 2, "drops empty rows; points from g+a");
assert(cleaned?.upcoming[0]!.time === null, "keeps a missing upcoming time");
assert(asBeezDesk(null) === null && asBeezDesk("nope") === null, "junk payload is null");

assert(sampleBeezDesk().skaters.some((s) => s.is_josh), "sample desk flags the made-up Josh row");
assert(!/josh/i.test(sampleBeezDesk().skaters.find((s) => s.is_josh)!.name), "sample does not use a real name");

for (const press of ["2026-10-05-morning", "2026-10-05-midday", "2026-10-05-evening"]) {
  const built = buildEdition({ stories: [], clubs: [], edition: press });
  assert(insertBeez(built, null) === built, `${press}: no row, edition untouched`);

  const watchAt = built.pages.findIndex((p) => p.kind === "favorites-watch");
  const watch = built.pages[watchAt]!;
  const withBeez = insertBeez(built, desk());
  const a = withBeez.pages.filter((p) => p.section === "A");
  const beez = withBeez.pages[watchAt]!;
  const guide = withBeez.pages[watchAt + 1]!;
  assert(beez.kind === "favorites-beez" && beez.folio === watch.folio, `${press}: Beez takes the guide's folio`);
  assert(guide.kind === "favorites-watch" && guide.folio === `A${watch.sectionPage + 1}`, `${press}: the guide moves back one`);
  assert(a[a.length - 1]!.kind === "favorites-watch", `${press}: the guide stays last in Section A`);
  assert(a[a.length - 2]!.kind === "favorites-beez", `${press}: Beez sits immediately before the guide`);
  assert(a.every((p) => p.sectionCount === a.length), `${press}: Section A counts the new page`);
  assert(a.map((p) => p.folio).join() === a.map((_, i) => `A${i + 1}`).join(), `${press}: Section A folios run in order`);
  assert(withBeez.pages[0]!.folio === "A1" && withBeez.pages[1]!.folio === "A2", `${press}: A1 and A2 never move`);
  assert(withBeez.sections[0]!.pages === built.sections[0]!.pages + 1, `${press}: section A grows by one`);
  for (const s of withBeez.sections.slice(1)) {
    const before = built.sections.find((b) => b.code === s.code)!;
    assert(s.index === before.index + 1, `${press}: ${s.code} shifts by one`);
    assert(withBeez.pages[s.index]!.folio === `${s.code}1`, `${press}: ${s.code} still opens on ${s.code}1`);
  }
  assert(withBeez.pages.length === built.pages.length + 1, `${press}: exactly one page added`);

  const withDay = insertDayAhead(built, {
    date: scheduleDateFor(press)!,
    events: [{ start: "09:00", end: "10:00", all_day: false, title: "Sample", kind: "work", location: null }],
    upcoming: [],
  });
  const both = insertBeez(withDay, desk());
  const secA = both.pages.filter((p) => p.section === "A");
  const kinds = secA.map((p) => p.kind);
  assert(kinds.at(-1) === "favorites-watch", `${press}: guide still last with both companions`);
  assert(kinds.at(-2) === "favorites-beez", `${press}: Beez still immediately before the guide`);
  assert(kinds.at(-3) === "favorites-day", `${press}: Day Ahead stays where it was, ahead of Beez`);
  assert(
    secA.map((p) => p.folio).join() === secA.map((_, i) => `A${i + 1}`).join(),
    `${press}: folios stay consecutive with both pages`,
  );
  assert(
    secA.filter((p) => p.kind === "favorites-day" || p.kind === "favorites-beez" || p.kind === "favorites-watch").length === 3,
    `${press}: day, Beez, and guide each appear once`,
  );
}

console.log("newspaper-beez ok");
