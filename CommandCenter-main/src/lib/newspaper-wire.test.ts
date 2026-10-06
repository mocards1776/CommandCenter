/**
 * Run with: node --experimental-strip-types src/lib/newspaper-wire.test.ts
 * from CommandCenter-main/.
 */
import { tallyWireGames, deskOrder, postseasonRailGames, type WireGame } from "./newspaper-wire.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function game(partial: Partial<WireGame> & Pick<WireGame, "id" | "league">): WireGame {
  return {
    eventId: partial.id,
    path: "football/nfl",
    sportLabel: partial.league,
    round: null,
    series: null,
    postseason: false,
    preseason: false,
    final: true,
    live: false,
    statusDetail: "Final",
    startedAt: "2026-10-04T17:00:00Z",
    day: "2026-10-04",
    away: {
      id: "1",
      name: "Away",
      short: "AWY",
      abbrev: "AWY",
      logo: null,
      color: null,
      score: "20",
      winner: true,
      record: "1-0",
      seed: null,
    },
    home: {
      id: "2",
      name: "Home",
      short: "HME",
      abbrev: "HME",
      logo: null,
      color: null,
      score: "17",
      winner: false,
      record: "0-1",
      seed: null,
    },
    headline: "Away 20, Home 17",
    body: partial.body ?? null,
    dateline: null,
    photo: null,
    href: "/",
    leaders: [],
    favoriteKeys: [],
    ...partial,
  };
}

const rows = tallyWireGames([
  game({ id: "1", league: "NFL", body: "A full recap of the Sunday final. ".repeat(4) }),
  game({ id: "2", league: "NFL", body: null }),
  game({ id: "3", league: "NHL", final: false, body: null }),
]);
assert(rows.find((r) => r.league === "NFL")?.games === 2, "NFL counts both games");
assert(rows.find((r) => r.league === "NFL")?.finals === 2, "both NFL games are finals");
assert(rows.find((r) => r.league === "NFL")?.wraps === 1, "only the written NFL recap is a wrap");
assert(rows.find((r) => r.league === "NFL")?.espnWraps === 1, "a written recap counts as an ESPN wrap");
assert(rows.find((r) => r.league === "NFL")?.boxWraps === 0, "no box wrap until enrich");
assert(rows.find((r) => r.league === "NHL")?.finals === 0, "a scheduled NHL game is not a final");

const ordered = [game({ id: "pre", league: "NBA", preseason: true }), game({ id: "reg", league: "NBA" })].sort(deskOrder);
assert(ordered[0]?.id === "reg", "a regular-season final outranks a preseason box");

const nlds = game({
  id: "nlds-1",
  league: "MLB",
  path: "baseball/mlb",
  postseason: true,
  final: false,
  live: false,
  startedAt: "2026-10-06T00:08:00Z",
  day: "2026-10-05",
  statusDetail: "Scheduled",
  away: { ...game({ id: "x", league: "MLB" }).away, short: "Phillies", score: null },
  home: { ...game({ id: "x", league: "MLB" }).home, short: "Dodgers", score: null },
});
const oldFinal = game({
  id: "nlds-old",
  league: "MLB",
  path: "baseball/mlb",
  postseason: true,
  final: true,
  day: "2026-10-04",
});
const rail = postseasonRailGames([oldFinal, nlds], "2026-10-05-evening");
assert(rail[0]?.id === "nlds-1", "the rail prefers today's leftover NLDS game");
assert(!rail.some((g) => g.id === "nlds-old"), "yesterday's final does not pad the rail");

console.log("newspaper-wire ok");
