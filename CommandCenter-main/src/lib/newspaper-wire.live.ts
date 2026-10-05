/**
 * Live compose-path proof for the Times wire desk.
 * Run from CommandCenter-main/:
 *   node --experimental-strip-types src/lib/newspaper-wire.live.ts
 */
import { fileEditionStories } from "./newspaper.ts";
import {
  enrichWireStories,
  fetchNewspaperWire,
  logWireFiling,
  tallyWireGames,
  type WireGame,
} from "./newspaper-wire.ts";
import type { SportsFavorite } from "./sports.ts";

const favs: SportsFavorite[] = [
  {
    key: "mlb-stl",
    name: "St. Louis Cardinals",
    shortName: "Cardinals",
    sport: "Baseball",
    league: "MLB",
    espnPath: "baseball/mlb/teams/24",
    kind: "team",
  },
  {
    key: "nhl-stl",
    name: "St. Louis Blues",
    shortName: "Blues",
    sport: "Hockey",
    league: "NHL",
    espnPath: "hockey/nhl/teams/19",
    kind: "team",
  },
  {
    key: "nfl-det",
    name: "Detroit Lions",
    shortName: "Lions",
    sport: "Football",
    league: "NFL",
    espnPath: "football/nfl/teams/8",
    kind: "team",
  },
  {
    key: "nfl-kc",
    name: "Kansas City Chiefs",
    shortName: "Chiefs",
    sport: "Football",
    league: "NFL",
    espnPath: "football/nfl/teams/12",
    kind: "team",
  },
  {
    key: "nba-phi",
    name: "Philadelphia 76ers",
    shortName: "Sixers",
    sport: "Basketball",
    league: "NBA",
    espnPath: "basketball/nba/teams/20",
    kind: "team",
  },
  {
    key: "cfb-mizzou",
    name: "Mizzou Football",
    shortName: "Mizzou",
    sport: "Football",
    league: "NCAA",
    espnPath: "football/college-football/teams/142",
    kind: "team",
  },
];

function asCard(g: WireGame) {
  const scored = g.away.score != null && g.home.score != null;
  return {
    id: `wire-${g.id}`,
    headline: g.headline,
    when: g.startedAt,
    leaguePath: g.path,
    gameId: g.eventId,
    scoreLine: scored ? `${g.away.abbrev} ${g.away.score}  ·  ${g.home.abbrev} ${g.home.score}` : null,
    body: g.body,
  };
}

const pressId = "2026-10-05-morning";
const day = "2026-10-05";
const wire = await fetchNewspaperWire({ favs, day, pressId });
const finals = wire.games.filter((g) => g.final);
const enriched = await enrichWireStories(finals, finals.length);
const tallies = tallyWireGames(enriched);
logWireFiling(`live ${pressId}`, enriched);

const filed = fileEditionStories({
  fresh: enriched.map(asCard),
  carried: [],
  readKeys: new Set(),
  pressId,
});

const need = ["NFL", "NHL", "MLB", "NBA"] as const;
const missing: string[] = [];
for (const league of need) {
  const row = tallies.find((r) => r.league === league);
  if (!row || row.finals < 1) missing.push(`${league} finals=${row?.finals ?? 0}`);
}
const nfl = tallies.find((r) => r.league === "NFL");
if (!nfl || nfl.finals < 14) missing.push(`NFL Sunday slate finals=${nfl?.finals ?? 0} (want 14)`);

const satCfb = filed.filter((c) => c.leaguePath === "football/college-football" && c.when && Date.parse(c.when) < Date.parse("2026-10-04T05:00:00Z"));
if (!satCfb.length) missing.push("no Saturday CFB wraps filed on Monday morning");

console.log(JSON.stringify({ pressId, tallies, filed: filed.length, saturdayCfb: satCfb.length, missing }, null, 2));
if (missing.length) {
  throw new Error(`times-wire live proof failed: ${missing.join("; ")}`);
}
console.log("times-wire live proof ok");
