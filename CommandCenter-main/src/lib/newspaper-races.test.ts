/**
 * Run with: node --experimental-strip-types src/lib/newspaper-races.test.ts
 * from CommandCenter-main/. Sample races and buys are made up.
 */
import { insertBeez, sampleBeezDesk } from "./newspaper-beez.ts";
import { insertDayAhead, scheduleDateFor } from "./newspaper-day-ahead.ts";
import { daysUntilElection } from "./newspaper-election.ts";
import {
  asRaceBrief,
  asRaceBriefsDesk,
  countdownLine,
  cppLabel,
  estimateRaceHeight,
  flightLabel,
  grpLabel,
  estimatePackedHeight,
  insertRaceBriefs,
  money,
  packRacePages,
  pickBriefDate,
  printDay,
  raceLabel,
  raceNumber,
  RACES_SHEET_CAP,
  RACES_SHEET_TARGET,
  sampleRaceBriefs,
  sampleRaceBriefsOverflow,
  shiftYmd,
  sortRaceBriefs,
  spendTotals,
  stationMarket,
  type RaceBrief,
} from "./newspaper-races.ts";
import { oct6LiveRaceBriefs } from "./newspaper-races-oct6-live.ts";
import { buildEdition } from "./newspaper-sections.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(RACES_SHEET_TARGET === 1480 && RACES_SHEET_CAP === 1650, "sheet target and soft cap");
assert(shiftYmd("2026-10-06", -2) === "2026-10-04", "fallback window starts two days back");
assert(shiftYmd("2026-10-01", -2) === "2026-09-29", "window can cross a month");
assert(shiftYmd("nope", -2) === null, "bad date has no window");

assert(raceLabel("SD8") === "SD 8" && raceLabel("SD30") === "SD 30", "race labels space the number");
assert(raceLabel("sd 16") === "SD 16", "race labels fold case");
assert(raceNumber("SD8") < raceNumber("SD30"), "district 8 sorts before 30");

assert(printDay("2026-10-06") === "Oct. 6", "print day is AP month + date");
assert(flightLabel("2026-10-01", "2026-10-06") === "Oct. 1–6", "same-month flight collapses the month");
assert(flightLabel("2026-09-28", "2026-10-11") === "Sept. 28–Oct. 11", "cross-month flight keeps both months");
assert(flightLabel(null, null) === "—", "missing flight is an em dash");

assert(money(123400) === "$123,400", "money groups thousands");
assert(money(0) === "$0", "zero money");
assert(grpLabel(1276) === "1,276" && grpLabel(null) === "—", "GRPs");
assert(cppLabel(165) === "$165" && cppLabel(null) === "—", "CPP");
assert(stationMarket({
  sponsor: "X",
  side: "Support",
  station: "KYTV",
  market: "Springfield",
  amount: 1,
  grps: 1,
  cpp: 1,
  flight_start: null,
  flight_end: null,
  is_new: false,
}) === "KYTV · Springfield", "station and market share a cell");

assert(pickBriefDate(["2026-10-06", "2026-10-05"], "2026-10-06") === "2026-10-06", "edition date wins");
assert(pickBriefDate(["2026-10-05", "2026-10-04"], "2026-10-06") === "2026-10-05", "nearest of the last two days");
assert(pickBriefDate(["2026-10-03"], "2026-10-06") === null, "older than two days is ignored");
assert(pickBriefDate([], "2026-10-06") === null, "empty window is null");

const cleaned = asRaceBrief({
  race: " sd8 ",
  headline: "  Air war  ",
  bullets: [" One ", "", "Two", "Three", "Four", "Five", "Six"],
  spend: [
    { sponsor: "B", side: "Oppose", station: "KOLR", market: "Springfield", amount: "10", grps: 2, cpp: 5, is_new: true },
    { sponsor: "A", side: "Support", station: "KYTV", market: "Springfield", amount: 40, is_new: false },
    { sponsor: "", amount: 9 },
  ],
  links: [{ label: "MEC", url: "https://mec.mo.gov/" }, { label: "bad", url: "not-a-url" }],
  notes: [{ source: "MoScout", text: "  Watch the buys.  " }, { text: "" }],
});
assert(cleaned?.race === "SD8" && cleaned.headline === "Air war", "tidies race and headline");
assert(cleaned?.bullets.length === 5 && cleaned.bullets[0] === "One", "caps bullets at 5");
assert(cleaned?.spend[0]!.amount === 40 && cleaned.spend[1]!.is_new, "spend sorts by amount; keeps NEW");
assert(cleaned?.links.length === 1 && cleaned.notes.length === 1, "drops junk links and empty notes");
assert(asRaceBrief({ race: "SD8" }) === null, "no headline and no spend is dropped");
assert(asRaceBrief(null) === null, "junk brief is null");

const stale = asRaceBriefsDesk(
  [
    { brief_date: "2026-10-05", race: "SD8", headline: "Held over", spend: [{ sponsor: "A", amount: 1 }] },
    { brief_date: "2026-10-05", race: "SD30", headline: "Also held", spend: [{ sponsor: "B", amount: 2 }] },
    { brief_date: "2026-10-03", race: "SD16", headline: "Too old", spend: [{ sponsor: "C", amount: 3 }] },
  ],
  "2026-10-06",
);
assert(stale?.briefDate === "2026-10-05" && stale.stale, "fallback desk is marked stale");
assert(stale?.races.map((r) => r.race).join() === "SD8,SD30", "keeps only the fallback morning");
assert(asRaceBriefsDesk([], "2026-10-06") === null, "no rows, no desk");

const sample = sampleRaceBriefs("2026-10-06");
assert(sample.races.length === 2, "sample is two races");
assert(sample.races[0]!.race === "SD8" && sample.races[1]!.race === "SD30", "sample prints 8 before 30");
assert(
  sample.races.every((r) => r.spend.length === 6 && r.bullets.length === 3 && r.notes.length === 2),
  "sample has 6 spends, 3 bullets, 2 notes",
);
assert(!/sample/i.test(JSON.stringify(sample)), "sample payload never says SAMPLE");
assert(sortRaceBriefs(sample.races)[0]!.race === "SD8", "numeric order");
assert(spendTotals(sample.races[0]!.spend).some((t) => t.side === "Support" && t.amount > 0), "side totals");

const packed = packRacePages(sample.races);
assert(packed.length === 1 && packed[0]!.length === 2, "two typical races fit one sheet");
assert(
  packed[0]!.reduce((n, r) => n + estimateRaceHeight(r), 118) < RACES_SHEET_CAP - 160,
  "packed height stays under the soft cap",
);
assert(estimatePackedHeight(sample.races) <= RACES_SHEET_CAP, "sample pair stays under ~1650");
const overflow = packRacePages(sampleRaceBriefsOverflow("2026-10-06").races);
assert(overflow.length >= 2, "a third race continues on a second folio");
assert(overflow.every((page) => page.length >= 1), "no empty continued page");

const live = oct6LiveRaceBriefs("2026-10-06");
assert(live.races[0]!.race === "SD8" && live.races[0]!.spend.length === 11 && live.races[0]!.bullets.length === 3, "Oct 6 SD8 is 11 spends / 3 bullets");
assert(live.races[1]!.race === "SD30" && live.races[1]!.spend.length === 17 && live.races[1]!.bullets.length === 3, "Oct 6 SD30 is 17 spends / 3 bullets");
assert(estimatePackedHeight(live.races) > RACES_SHEET_CAP, "both Oct 6 races together exceed the 1650 soft cap");
const livePacked = packRacePages(live.races);
assert(livePacked.length === 2 && livePacked[0]!.length === 1 && livePacked[1]!.length === 1, "Oct 6 book splits to one race per folio");
assert(livePacked[0]![0]!.race === "SD8" && livePacked[1]![0]!.race === "SD30", "SD 8 then SD 30");
assert(estimatePackedHeight(livePacked[0]!) <= RACES_SHEET_CAP, "SD 8 folio hugs under the cap");
assert(estimatePackedHeight(livePacked[1]!, true) <= RACES_SHEET_CAP, "SD 30 folio hugs under the cap");

function briefWithSpend(race: string, n: number): RaceBrief {
  return {
    race,
    headline: `${race} air war with a long headline that wraps past seventy characters easily`,
    bullets: ["One", "Two", "Three"],
    spend: Array.from({ length: n }, (_, i) => ({
      sponsor: `PAC ${i + 1}`,
      side: i % 2 ? "Oppose" : "Support",
      station: "KYTV",
      market: "Springfield",
      amount: 1000 * (n - i),
      grps: 10,
      cpp: 75,
      flight_start: "2026-10-01",
      flight_end: "2026-10-10",
      is_new: false,
    })),
    links: [{ label: "MEC", url: "https://mec.mo.gov/" }],
    notes: [{ source: "Note", text: "A note.", url: null }],
    source: null,
    updated_at: null,
  };
}
assert(packRacePages([briefWithSpend("SD8", 4), briefWithSpend("SD30", 4)]).length === 1, "two short races share a page under 1650");

assert(countdownLine("2026-10-06")?.startsWith(`${daysUntilElection("2026-10-06")} days`), "countdown uses edition dateline");
assert(countdownLine("2026-11-03")?.includes("Election Day"), "Election Day copy");
assert(countdownLine("2026-11-04") === null, "after Election Day the line hides");

for (const press of ["2026-10-06-morning", "2026-10-06-midday", "2026-10-06-evening"]) {
  const built = buildEdition({ stories: [], clubs: [], edition: press });
  assert(insertRaceBriefs(built, null) === built, `${press}: no desk, edition untouched`);
  assert(insertRaceBriefs(built, { editionDate: scheduleDateFor(press)!, briefDate: "2026-10-06", stale: false, races: [] }) === built, `${press}: empty races skipped`);

  const watchAt = built.pages.findIndex((p) => p.kind === "favorites-watch");
  const watch = built.pages[watchAt]!;
  const withRaces = insertRaceBriefs(built, sample);
  const a = withRaces.pages.filter((p) => p.section === "A");
  const races = withRaces.pages[watchAt]!;
  const guide = withRaces.pages[watchAt + 1]!;
  assert(races.kind === "favorites-races" && races.folio === watch.folio, `${press}: races take the guide's folio`);
  assert(guide.kind === "favorites-watch" && guide.folio === `A${watch.sectionPage + 1}`, `${press}: the guide moves back one`);
  assert(a[a.length - 1]!.kind === "favorites-watch", `${press}: the guide stays last in Section A`);
  assert(a[a.length - 2]!.kind === "favorites-races", `${press}: races sit immediately before the guide when Day Ahead is off`);
  assert(a.every((p) => p.sectionCount === a.length), `${press}: Section A counts the new page`);
  assert(a.map((p) => p.folio).join() === a.map((_, i) => `A${i + 1}`).join(), `${press}: Section A folios run in order`);
  assert(withRaces.pages[0]!.folio === "A1" && withRaces.pages[1]!.folio === "A2", `${press}: A1 and A2 never move`);
  assert(withRaces.sections[0]!.pages === built.sections[0]!.pages + 1, `${press}: section A grows by one`);
  for (const s of withRaces.sections.slice(1)) {
    const before = built.sections.find((b) => b.code === s.code)!;
    assert(s.index === before.index + 1, `${press}: ${s.code} shifts by one`);
    assert(withRaces.pages[s.index]!.folio === `${s.code}1`, `${press}: ${s.code} still opens on ${s.code}1`);
  }

  const withDay = insertDayAhead(built, {
    date: scheduleDateFor(press)!,
    events: [{ start: "09:00", end: "10:00", all_day: false, title: "Sample", kind: "work", location: null }],
    upcoming: [],
  });
  const both = insertBeez(insertDayAhead(insertRaceBriefs(built, sample), {
    date: scheduleDateFor(press)!,
    events: [{ start: "09:00", end: "10:00", all_day: false, title: "Sample", kind: "work", location: null }],
    upcoming: [],
  }), sampleBeezDesk());
  const kinds = both.pages.filter((p) => p.section === "A").map((p) => p.kind);
  assert(kinds.at(-1) === "favorites-watch", `${press}: guide still last`);
  assert(kinds.at(-2) === "favorites-beez", `${press}: Beez still immediately before the guide`);
  assert(kinds.at(-3) === "favorites-day", `${press}: Day Ahead stays ahead of Beez`);
  assert(kinds.at(-4) === "favorites-races", `${press}: races sit immediately before The Day Ahead`);
  const secA = both.pages.filter((p) => p.section === "A");
  assert(
    secA.map((p) => p.folio).join() === secA.map((_, i) => `A${i + 1}`).join(),
    `${press}: folios stay consecutive with races, day, and Beez`,
  );

  const dayOnly = insertRaceBriefs(withDay, null);
  assert(dayOnly.pages.map((p) => p.kind).join() === withDay.pages.map((p) => p.kind).join(), `${press}: empty races leaves Day Ahead where it was`);
  assert(dayOnly.pages.find((p) => p.kind === "favorites-day")?.folio === withDay.pages.find((p) => p.kind === "favorites-day")?.folio, `${press}: Day Ahead folio unchanged without races`);
}

const twoPages = insertRaceBriefs(
  buildEdition({ stories: [], clubs: [], edition: "2026-10-06-morning" }),
  sampleRaceBriefsOverflow("2026-10-06"),
);
const racePages = twoPages.pages.filter((p) => p.kind === "favorites-races");
assert(racePages.length >= 2, "overflow files a second races folio");
assert(racePages[0] && !racePages[0].continued && racePages[1]?.continued, "second folio is marked continued");
assert(racePages.every((p) => p.races.length >= 1), "each continued folio carries at least one race");

console.log("newspaper-races ok");
