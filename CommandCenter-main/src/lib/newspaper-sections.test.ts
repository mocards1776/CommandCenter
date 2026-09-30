/**
 * Run with: node --experimental-strip-types src/lib/newspaper-sections.test.ts
 * from CommandCenter-main/.
 */
import type { GameWrapCard } from "./newspaper-sports.ts";
import type { WireGame } from "./newspaper-wire.ts";
import { buildEdition, isRecapCard, sportSectionId } from "./newspaper-sections.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function card(partial: Partial<GameWrapCard> & Pick<GameWrapCard, "id" | "headline">): GameWrapCard {
  return {
    favoriteKey: "",
    teamName: "",
    teamHref: "/",
    sportLabel: "MLB",
    leaguePath: "baseball/mlb",
    dek: null,
    body: null,
    scoreLine: null,
    when: null,
    won: null,
    gameHref: null,
    wrapHref: null,
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    ...partial,
  };
}

function game(partial: Partial<WireGame> & Pick<WireGame, "id">): WireGame {
  return {
    eventId: partial.id,
    path: "baseball/mlb",
    league: "MLB",
    sportLabel: "MLB",
    round: null,
    series: null,
    postseason: false,
    preseason: false,
    final: true,
    live: false,
    statusDetail: "Final",
    startedAt: "2026-09-29T23:00:00Z",
    day: "2026-09-29",
    away: {
      name: "Away",
      short: "Away",
      abbrev: "AWY",
      logo: null,
      score: "2",
      winner: false,
      record: "80-80",
      seed: null,
    },
    home: {
      name: "Home",
      short: "Home",
      abbrev: "HOM",
      logo: null,
      score: "4",
      winner: true,
      record: "90-70",
      seed: null,
    },
    headline: partial.id,
    body: null,
    dateline: null,
    photo: null,
    href: "/",
    leaders: [],
    favoriteKeys: [],
    ...partial,
  };
}

const cardinals = card({
  id: "wire-mlb-stl",
  gameId: "g-stl",
  headline: "Cardinals fall in ten",
  favoriteKey: "mlb-stl",
  followed: true,
  teamName: "Cardinals",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  status: "Final",
  scoreLine: "CHC 3  ·  STL 2",
  body: "A long night at Busch ended with a walk-off that was not theirs. ".repeat(4),
});

const otherFinal = card({
  id: "wire-mlb-nyy",
  gameId: "g-nyy",
  headline: "Yankees drop the nightcap",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  status: "Final",
  scoreLine: "BOS 5  ·  NYY 1",
  body: "Boston put the game away early and the bullpen never warmed. ".repeat(3),
});

const scheduled = card({
  id: "wire-mlb-lad",
  gameId: "g-lad",
  headline: "Dodgers at Padres",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  status: "7:10 PM ET",
  scoreLine: "LAD at SD",
});

const live = card({
  id: "wire-mlb-bos",
  gameId: "g-bos",
  headline: "Red Sox at Yankees",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  status: "Top 2nd",
  scoreLine: "BOS 0 · NYY 0",
});

const chiefs = card({
  id: "wire-nfl-kc",
  gameId: "g-kc",
  headline: "Chiefs hold on",
  favoriteKey: "nfl-kc",
  followed: true,
  teamName: "Chiefs",
  sportLabel: "NFL",
  leaguePath: "football/nfl",
  status: "Final",
  scoreLine: "KC 27  ·  LV 17",
  body: "Kansas City's last drive used the clock and left no time. ".repeat(3),
});

const buriedPlayoff = card({
  id: "wire-mlb-nlcs",
  gameId: "g-nlcs",
  headline: "Brewers take the series opener",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  status: "Final",
  postseason: true,
  scoreLine: "MIL 4  ·  LAD 2",
  body: "The National League series started with a complete game. ".repeat(3),
});

const wrongSport = card({
  id: "wrap-seahawks",
  gameId: "not-on-the-board",
  headline: "Seahawks roll past Cardinals",
  sportLabel: "MLB",
  leaguePath: "baseball/mlb",
  status: "Final",
  scoreLine: "SEA 31 · ARI 7",
  body: "Drew Lock threw three touchdowns and the Seahawks never trailed. ".repeat(3),
});

assert(sportSectionId("baseball/mlb").code === "MLB", "MLB code");
assert(sportSectionId("soccer/eng.1").code === "EPL", "EPL code");
assert(sportSectionId("soccer/eng.2").title === "EFL Championship", "EFL title");
assert(!isRecapCard(scheduled), "a start time is not a recap");
assert(!isRecapCard(live), "a game in progress is not a recap yet");
assert(isRecapCard(otherFinal), "a final is a recap");

const edition = buildEdition({
  stories: [cardinals, otherFinal, scheduled, live, chiefs, buriedPlayoff, wrongSport],
  games: [
    game({
      id: "g-stl",
      favoriteKeys: ["mlb-stl"],
      startedAt: "2026-09-29T23:10:00Z",
      leaders: [{ name: "Winn", line: "2-4", href: "/sports/mlb/player/1" }],
    }),
    game({ id: "g-nyy", startedAt: "2026-09-29T23:05:00Z" }),
    game({
      id: "g-lad",
      final: false,
      statusDetail: "7:10 PM ET",
      startedAt: "2026-09-30T00:10:00Z",
      day: "2026-09-30",
      away: {
        name: "Dodgers",
        short: "Dodgers",
        abbrev: "LAD",
        logo: null,
        score: null,
        winner: false,
        record: null,
        seed: null,
      },
      home: {
        name: "Padres",
        short: "Padres",
        abbrev: "SD",
        logo: null,
        score: null,
        winner: false,
        record: null,
        seed: null,
      },
    }),
    game({
      id: "g-kc",
      path: "football/nfl",
      league: "NFL",
      sportLabel: "NFL",
      favoriteKeys: ["nfl-kc"],
      day: "2026-09-28",
    }),
    game({ id: "g-nlcs", postseason: true, startedAt: "2026-09-29T22:00:00Z" }),
    game({
      id: "g-bos",
      final: false,
      live: true,
      statusDetail: "Top 2nd",
      startedAt: "2026-09-29T23:40:00Z",
    }),
  ],
});

const folios = edition.pages.map((p) => p.folio);
assert(folios[0] === "A1", `section A leads, got ${folios.join(",")}`);
assert(folios.includes("MLB1"), "MLB section exists");
assert(folios.includes("NFL1"), "NFL section exists");
assert(folios.indexOf("MLB1") < folios.indexOf("NFL1"), "MLB prints before NFL");
assert(!folios.some((f) => f.startsWith("A") && f !== "A1" && edition.pages.find((p) => p.folio === f)?.kind === "sport-front"), "A is only favorites");

const aFront = edition.pages[0]!;
assert(aFront.kind === "favorites-front" && aFront.sectionTitle === "Favorite Teams", "A1 is favorite teams");

const favoriteIds = new Set(Object.keys(edition.favoriteFolioByStory));
assert(favoriteIds.has("wire-mlb-stl") && favoriteIds.has("wire-nfl-kc"), "favorites are filed in A");
assert(!favoriteIds.has("wire-mlb-nyy"), "other clubs stay out of section A");
assert(
  !favoriteIds.has("wrap-seahawks"),
  "a mis-filed football clip is not a baseball recap in section A",
);

const mlb1 = edition.pages.find((p) => p.folio === "MLB1");
assert(mlb1?.kind === "sport-front", "MLB1 is the sport front");
if (mlb1?.kind === "sport-front") {
  assert(mlb1.games.length === 5, `MLB schedule has every game, got ${mlb1.games.length}`);
  const order = mlb1.games.map((g) => g.id);
  assert(
    order.indexOf("g-nlcs") < order.indexOf("g-nyy") && order.indexOf("g-nyy") < order.indexOf("g-stl"),
    `schedule is chronological, got ${order.join(",")}`,
  );
  assert(mlb1.spansDays, "a two-day board is marked");
  assert(mlb1.leaders.some((l) => l.name === "Winn"), "game leaders land in stats");
  const recapIds = mlb1.recaps.map((r) => r.card.id);
  assert(
    recapIds.includes("wire-mlb-stl") && recapIds.includes("wire-mlb-nyy") && recapIds.includes("wire-mlb-nlcs"),
    "every final is on MLB1",
  );
  assert(!recapIds.includes("wire-mlb-lad"), "the scheduled game is not a recap");
  assert(!recapIds.includes("wire-mlb-bos"), "the live game stays on the schedule");
  assert(!recapIds.includes("wrap-seahawks"), "an off-board story does not join the MLB recaps");
  assert(recapIds.indexOf("wire-mlb-nlcs") === 1, "postseason is lifted onto the board");
  assert(mlb1.recaps.every((r) => r.folio.startsWith("MLB") && r.folio !== "MLB1"), "recaps jump inside the section");
}

const mlbInside = edition.pages.filter((p) => p.kind === "sport-inside" && p.section === "MLB");
const insideIds = mlbInside.flatMap((p) =>
  p.kind === "sport-inside" ? [p.primary.id, p.secondary?.id].filter(Boolean) : [],
);
assert(
  insideIds.includes("wire-mlb-stl") && insideIds.includes("wire-mlb-nyy") && insideIds.includes("wire-mlb-nlcs"),
  "each MLB final gets a full recap",
);
assert(!insideIds.includes("wire-mlb-lad"), "scheduled game has no recap column");
assert(!insideIds.includes("wrap-seahawks"), "off-board story has no MLB column");

const nfl1 = edition.pages.find((p) => p.folio === "NFL1");
assert(nfl1?.kind === "sport-front" && nfl1.games.length === 1, "NFL keeps its own board");

const quiet = buildEdition({ stories: [], games: [] });
assert(quiet.pages.length === 1 && quiet.pages[0]?.folio === "A1", "an empty wire still opens section A");

console.log("newspaper-sections ok");
