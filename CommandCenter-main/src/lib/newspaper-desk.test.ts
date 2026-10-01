/**
 * Run with: node --experimental-strip-types src/lib/newspaper-desk.test.ts
 * from CommandCenter-main/.
 */
import { buildMissouriDesk, combestUrl, dedupeMo, parseCombest, type MoItem } from "./newspaper-missouri.ts";
import { nameIndex, namePieces, type Person } from "./newspaper-people.ts";
import { daysUntil, espnOpener, mlbOpener, openerDate, openerMatchup } from "./newspaper-openers.ts";
import { isBoilerplateDek, outletFor, storySource } from "./newspaper-source.ts";
import { playerRef, seasonNote, storySubjects } from "./newspaper-subjects.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function mo(partial: Partial<MoItem> & Pick<MoItem, "headline" | "url">): MoItem {
  return { id: partial.url, source: "", kind: "story", photo: null, dek: null, when: null, ...partial };
}

assert(
  combestUrl("2026-10-01") ===
    "https://johncombest.com/2026/10/01/thursday-october-1-2026-missouri-political-news-headlines/",
  "Combest's daily post address",
);

const post = `
  <p><a href="https://www.stltoday.com/news/boeing-deal/">P-D: Boeing wins new Missouri tax break in late-night vote</a></p>
  <p><a href="https://archive.ph/abc">Archived version</a></p>
  <p><a href="https://missouriindependent.com/2026/10/01/food-aid/">Missouri adds new paperwork requirements to food assistance</a></p>
  <p><a href="https://podcasts.apple.com/us/podcast/x">This Week in Missouri Politics: the special session, explained</a></p>
  <p><a href="https://johncombest.com/about">About John Combest and this site</a></p>
`;
const parsed = parseCombest(post);
assert(parsed.length === 3, "archive and self links are dropped");
assert(parsed[0]!.source === "P-D" && parsed[0]!.headline.startsWith("Boeing"), "source prefix splits off");
assert(parsed[1]!.source === "Missouri Independent", "a bare link takes its outlet from the host");
assert(parsed[2]!.kind === "listen", "podcasts file under listen");

const deduped = dedupeMo([
  mo({ headline: "Missouri turns to playing cards to crack cold cases", url: "https://a.com/1", source: "Missourinet" }),
  mo({
    headline: "Cold cases: Missouri prisons get playing cards with victims' faces",
    url: "https://b.com/2",
    source: "KSDK",
    photo: "https://b.com/p.jpg",
  }),
  mo({ headline: "Senate passes the budget after a long week", url: "https://a.com/1/", source: "Repeat" }),
  mo({ headline: "Kehoe names new head of the state highway patrol", url: "https://c.com/3", source: "AP" }),
]);
assert(deduped.length === 2, "same story from two outlets, and the same URL, collapse");
assert(deduped[0]!.photo === "https://b.com/p.jpg", "the kept copy borrows the twin's photo");
assert(deduped[0]!.also?.includes("KSDK"), "the kept copy credits the other outlet");

const scout = mo({ headline: "Scout: who's next in line for the Senate", url: "https://moscout.com/x", source: "Missouri Scout" });
const desk = buildMissouriDesk({
  combest: [...parsed, { ...scout }],
  wires: [mo({ headline: "Boeing wins Missouri tax break in late night vote", url: "https://missourinet.com/b" })],
  scout,
});
assert(!desk.items.some((i) => i.url === scout.url), "the Scout runs in Section A, not twice");
assert(desk.items.filter((i) => /Boeing/.test(i.headline)).length === 1, "wire copies of Combest items drop");
assert(desk.listen.length === 1 && !desk.items.some((i) => i.kind === "listen"), "listen items keep their own rail");

const people: Person[] = [
  { name: "Patrick Mahomes", href: "/sports/nfl/player/3139477" },
  { name: "Jordan Kyrou", href: "/sports/nhl/player/4024854" },
  { name: "David Price", href: "/sports/mlb/player/1" },
];
const index = nameIndex(people);
const linked = (text: string, seen = new Set<string>()) =>
  namePieces(text, index, seen)
    .filter((p) => typeof p !== "string")
    .map((p) => (p as { text: string }).text);

assert(linked("Patrick Mahomes threw two touchdowns.").join() === "Patrick Mahomes", "full names link");
assert(linked("Mahomes threw two touchdowns.").length === 0, "a bare surname waits for the full name");
const seen = new Set<string>();
linked("Patrick Mahomes started hot.", seen);
assert(linked("Mahomes's second score sealed it.", seen).join() === "Mahomes", "surname links after the full name, possessive too");
linked("David Price pitched.", seen);
assert(linked("The price of gas rose.", seen).length === 0, "a lowercase common noun stays plain");
assert(linked("jordan kyrou scored").join() === "jordan kyrou", "full names match case-insensitively");
assert(linked("Kyroux scored").length === 0, "no partial-word matches");

const accented = nameIndex([{ name: "Jesús  Báez", href: "/sports/mlb/player/800305" }]);
const baez = namePieces("Jesus Baez homered twice for Springfield.", accented);
assert(typeof baez[0] === "object" && baez[0].person.href.endsWith("800305"), "copy without accents still links");
assert(
  typeof namePieces("Jesús Báez homered.", accented)[0] === "object",
  "copy with the league's accents links too",
);

// ESPN parks a date-only game at midnight Eastern.
const now = Date.parse("2026-10-01T17:00:00Z");
const cbb = espnOpener(
  "cbb-mizzou",
  "basketball/mens-college-basketball",
  "142",
  [
    {
      date: "2026-11-06T05:00Z",
      competitions: [
        {
          timeValid: false,
          competitors: [
            { homeAway: "home", team: { id: "139", shortDisplayName: "Saint Louis" } },
            { homeAway: "away", team: { id: "142", shortDisplayName: "Missouri" } },
          ],
        },
      ],
    },
    {
      date: "2026-11-03T05:00Z",
      competitions: [
        {
          timeValid: false,
          venue: { fullName: "Mizzou Arena" },
          competitors: [
            { homeAway: "home", team: { id: "142", shortDisplayName: "Missouri" } },
            { homeAway: "away", team: { id: "325", shortDisplayName: "Cleveland St" } },
          ],
        },
      ],
    },
  ],
  now,
);
assert(cbb?.opponentShort === "Cleveland St" && cbb.home, "the earliest game is the opener");
assert(cbb?.slate.length === 2 && cbb.slate[1]!.opponentShort === "Saint Louis", "the slate follows in date order");
assert(cbb && openerDate(cbb) === "Tue, Nov 3", "an untimed game keeps its Eastern calendar day");
assert(cbb && daysUntil(cbb.iso, now, cbb.timeValid) === 33, "33 days from Oct 1 to Nov 3");
assert(cbb && openerMatchup(cbb.slate[1]!) === "at Saint Louis", "road games read 'at'");
assert(
  espnOpener("x", "basketball/nba", "20", [{ date: "2026-09-01T23:00Z", competitions: [] }], now) === null,
  "no opener once the season has started",
);

const cards = mlbOpener(
  "mlb-stl",
  138,
  [
    {
      gameDate: "2027-03-25T20:10:00Z",
      status: { startTimeTBD: true },
      venue: { name: "Great American Ball Park" },
      teams: { away: { team: { id: 138, name: "St. Louis Cardinals" } }, home: { team: { id: 113, name: "Cincinnati Reds", teamName: "Reds" } } },
    },
  ],
  now,
);
assert(cards?.opponentShort === "Reds" && !cards.home && !cards.timeValid, "Opening Day at Cincinnati, time TBD");
assert(cards?.opponentLogo === "https://www.mlbstatic.com/team-logos/113.svg", "MLB opponent logos come from mlbstatic");

assert(outletFor("https://www.stltoday.com/sports/x") === "St. Louis Post-Dispatch", "stltoday is the Post-Dispatch");
assert(storySource({ wrapHref: "https://cardswire.usatoday.com/a" }) === "Cardinals Wire", "Cardinals Wire by host");
assert(
  storySource({ wrapHref: "https://www.espn.com/a", body: "… The Associated Press contributed to this report." }) ===
    "The Associated Press",
  "ESPN's AP copy credits the AP",
);
assert(storySource({ wrapHref: "https://rss.app/feeds/x" }) === null, "a feed proxy is no publisher");
assert(isBoilerplateDek("Your best source for quality St. Louis Cardinals news"), "site taglines are not deks");
assert(!isBoilerplateDek("Mikolas threw seven scoreless innings."), "real deks survive");

assert(playerRef("/sports/mlb/player/802139")?.path === "baseball/mlb", "MLB player route");
assert(playerRef("/sports/cfb/player/5197065")?.path === "football/college-football", "CFB player route");
assert(playerRef("/sports/nba/team/phi") === null, "no file for a team page");
assert(seasonNote("2026 regular season stats:", 2026) === null, "this season needs no note");
assert(seasonNote("2025 Regular Season Stats", 2026) === "2025", "last season's line says so");
const subjectIdx = nameIndex([
  { name: "JJ Wetherholt", href: "/sports/mlb/player/802139" },
  { name: "Nolan Gorman", href: "/sports/mlb/player/669357" },
  { name: "Alec Burleson", href: "/sports/mlb/player/676475" },
]);
const subjects = storySubjects(
  {
    headline: "Wetherholt makes his case for second base",
    body: "Nolan Gorman and Alec Burleson watched. Burleson said JJ Wetherholt was ready. Burleson agreed again.",
  },
  subjectIdx,
);
assert(subjects[0]?.name === "JJ Wetherholt", "the headline's player leads the story's subjects");
assert(subjects.length === 3, "every named player is a subject");

console.log("newspaper-desk ok");
