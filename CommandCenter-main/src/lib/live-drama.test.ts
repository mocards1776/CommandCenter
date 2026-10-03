/**
 * Run with: node --experimental-strip-types src/lib/live-drama.test.ts
 * from CommandCenter-main/.
 *
 * The heat line is a one-score game in another sport (68). Series weight,
 * the Cardinals bump, and interest sliders are not inputs.
 */
import { mapEspnEvent } from "../../../supabase/functions/sports-push/boards.ts";
import {
  MLB_ONE_RUN_LINE_GAP,
  ONE_SCORE_HEAT_LINE,
  crossingAlerts,
  dramaWhy,
  favoriteFinalNote,
  favoriteStartNote,
  heatNote,
  heatReasonChips,
  liveDrama,
  type PushFavorite,
  type PushGame,
} from "../../../supabase/functions/sports-push/live-drama.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function drama(partial: Partial<Parameters<typeof liveDrama>[0]> & { sport: Parameters<typeof liveDrama>[0]["sport"] }) {
  return liveDrama({
    live: true,
    final: false,
    awayScore: 0,
    homeScore: 0,
    detail: "",
    period: null,
    redZone: false,
    downDistance: null,
    ...partial,
  });
}

const FORBIDDEN = /playoff|series|cardinals|favorite|your #1|interest/i;

assert(ONE_SCORE_HEAT_LINE === 68, "heat line is the one-score floor");
assert(MLB_ONE_RUN_LINE_GAP === 2, "one-run gap is the two points under 68");

const nflOne = drama({ sport: "nfl", awayScore: 3, homeScore: 0, detail: "12:00 - 1st", period: 1 });
assert(nflOne.score === 68 && nflOne.hot, `NFL one-score should be 68, got ${nflOne.score}`);
assert(nflOne.why === "One-score game", nflOne.why);
assert(!FORBIDDEN.test(nflOne.why), nflOne.why);

const nflOpening = drama({ sport: "nfl", awayScore: 0, homeScore: 0, detail: "15:00 - 1st", period: 1 });
assert(!nflOpening.hot && nflOpening.score === 40, `0-0 opening is not heat (${nflOpening.score})`);

const nflBlow = drama({ sport: "nfl", awayScore: 28, homeScore: 7, detail: "8:00 - 3rd", period: 3 });
assert(!nflBlow.hot, `NFL blowout should stay under the line (${nflBlow.score})`);

const nflRed = drama({
  sport: "nfl",
  awayScore: 14,
  homeScore: 7,
  detail: "6:00 - 3rd",
  period: 3,
  redZone: true,
});
assert(nflRed.hot && nflRed.why === "Red zone", `tight red zone ${nflRed.score} ${nflRed.why}`);

const nhlOne = drama({ sport: "nhl", awayScore: 1, homeScore: 0, detail: "12:04 - 1st", period: 1 });
assert(nhlOne.score === 68 && nhlOne.hot && nhlOne.why === "One-goal game", nhlOne.why);

const nhlOpen = drama({ sport: "nhl", awayScore: 0, homeScore: 0, detail: "10:00 - 1st", period: 1 });
assert(!nhlOpen.hot, "0-0 hockey is not heat");

const nhlOt = drama({ sport: "nhl", awayScore: 2, homeScore: 2, detail: "3:11 - OT", period: 4 });
assert(nhlOt.hot && nhlOt.why.includes("Overtime"), nhlOt.why);

const cfbOne = drama({ sport: "cfb", awayScore: 7, homeScore: 0, detail: "10:00 - 1st", period: 1 });
assert(cfbOne.score === 68 && cfbOne.hot && cfbOne.why === "One-score game", `${cfbOne.score} ${cfbOne.why}`);

const cfbBlow = drama({ sport: "cfb", awayScore: 42, homeScore: 7, detail: "8:00 - 3rd", period: 3 });
assert(!cfbBlow.hot && cfbBlow.score < ONE_SCORE_HEAT_LINE, `CFB blowout ${cfbBlow.score}`);

const cfbLate = drama({ sport: "cfb", awayScore: 24, homeScore: 17, detail: "0:27 - 4th", period: 4 });
assert(cfbLate.hot && cfbLate.why.includes("One-score game") && cfbLate.why.includes("Closing seconds"), cfbLate.why);

const mlbOne = drama({ sport: "mlb", awayScore: 1, homeScore: 0, detail: "Top 3rd" });
assert(mlbOne.hot && mlbOne.score === 68 && mlbOne.why === "One-run game", `${mlbOne.score} ${mlbOne.why}`);
assert(!FORBIDDEN.test(mlbOne.why), "one-run why must be drama, not Cardinals or playoffs");

const mlbOpen = drama({ sport: "mlb", awayScore: 0, homeScore: 0, detail: "Top 1st" });
assert(!mlbOpen.hot && mlbOpen.score === 42, `first pitch 0-0 is not heat (${mlbOpen.score})`);

const mlbLateBlow = drama({ sport: "mlb", awayScore: 8, homeScore: 0, detail: "Bot 8th" });
assert(
  !mlbLateBlow.hot && mlbLateBlow.score === 44,
  `late blowout without Cardinals or series weight is ${mlbLateBlow.score}, want 44`,
);
assert(!mlbLateBlow.reasons.some((r) => FORBIDDEN.test(r)), mlbLateBlow.reasons.join(","));

const mlbExtras = drama({ sport: "mlb", awayScore: 4, homeScore: 4, detail: "Top 11th" });
assert(mlbExtras.hot && mlbExtras.why === "Tied · Extras", mlbExtras.why);

const soccerOne = drama({ sport: "soccer", awayScore: 1, homeScore: 0, detail: "23'" });
assert(soccerOne.hot && soccerOne.score === 68 && soccerOne.why === "One-goal game", `${soccerOne.score} ${soccerOne.why}`);

const soccerOpen = drama({ sport: "soccer", awayScore: 0, homeScore: 0, detail: "12'" });
assert(!soccerOpen.hot, "early 0-0 soccer is not heat");

const pregame = drama({ sport: "nfl", live: false, awayScore: 0, homeScore: 0, detail: "8:20 PM" });
assert(!pregame.hot && pregame.score === 0, "Today's Top / pregame is not a heat alert");

assert(crossingAlerts(null, { phase: "live", hot: true }).length === 0, "first sight is a baseline");
assert(
  crossingAlerts({ phase: "live", hot: false }, { phase: "live", hot: true }).join() === "heat",
  "rising edge is heat",
);
assert(
  crossingAlerts({ phase: "live", hot: true }, { phase: "live", hot: true }).length === 0,
  "staying hot does not re-fire",
);
assert(
  crossingAlerts({ phase: "pregame", hot: false }, { phase: "live", hot: false }).join() === "favorite-start",
  "tip-off is not heat",
);
assert(
  crossingAlerts({ phase: "live", hot: true }, { phase: "final", hot: false }).join() === "favorite-final",
  "final is its own channel",
);

assert(dramaWhy(["Live", "Playoffs", "Cardinals", "One-run game"]) === "One-run game", "why ignores non-drama reasons");

const game: PushGame = {
  sport: "mlb",
  id: "746189",
  live: true,
  final: false,
  detail: "Top 8th",
  period: 8,
  redZone: false,
  downDistance: null,
  when: "7:15 PM",
  away: { id: "16", abbrev: "CHC", name: "Cubs", score: 3, logo: "https://example.com/chc.png" },
  home: { id: "24", abbrev: "STL", name: "Cardinals", score: 4, logo: "https://example.com/stl.png" },
};
const heat = heatNote(game, drama({ sport: "mlb", awayScore: 3, homeScore: 4, detail: "Top 8th" }));
assert(heat.title === "Cubs 3, Cardinals 4", heat.title);
assert(heat.body.startsWith("Top 8th\n"), heat.body);
assert(heat.body.includes("One-run game · Late innings"), heat.body);
assert(!/playoff|favorite|interest|\bheat\b/i.test(`${heat.title}\n${heat.body}`), heat.body);
assert(heat.icon === "https://example.com/stl.png", "icon is the team in front");
assert(heat.image === heat.icon, "expanded image uses the same team logo");
assert(heat.silent === false && heat.renotify === false, "one game does not buzz twice");
assert(heat.url === "/sports/mlb/game/746189?solo=1", heat.url);

const stripped = heatReasonChips(game, {
  score: 90,
  hot: true,
  why: "One-run game",
  reasons: ["Live", "Your #1 team", "Playoffs", "Cardinals", "Heat 90", "One-run game"],
});
assert(stripped.join(" · ") === "One-run game", stripped.join(" · "));

const cfb: PushGame = {
  sport: "cfb",
  id: "401",
  live: true,
  final: false,
  detail: "0:27 - 4th",
  period: 4,
  redZone: false,
  downDistance: null,
  when: "2:30 PM",
  broadcasts: ["ABC", "ESPN+"],
  away: { id: "99", abbrev: "LSU", name: "LSU", score: 24, logo: "https://example.com/lsu.png", rank: 11 },
  home: { id: "333", abbrev: "ALA", name: "Alabama", score: 17, logo: "https://example.com/ala.png", rank: 6 },
};
const cfbHeat = heatNote(cfb, drama({ sport: "cfb", awayScore: 24, homeScore: 17, detail: "0:27 - 4th", period: 4 }));
assert(cfbHeat.title === "LSU 24, Alabama 17", cfbHeat.title);
assert(cfbHeat.body.startsWith("0:27 - 4th · ABC · ESPN+\n"), cfbHeat.body);
assert(!cfbHeat.body.split("\n").slice(1).some((line) => line.trim() === "ABC"), cfbHeat.body);
assert(
  cfbHeat.body.includes("One-score game") &&
    cfbHeat.body.includes("Ranked matchup") &&
    cfbHeat.body.includes("National TV") &&
    cfbHeat.body.includes("ABC"),
  cfbHeat.body,
);
assert(!/\bheat\b|interest/i.test(`${cfbHeat.title}\n${cfbHeat.body}`), cfbHeat.body);
assert(cfbHeat.image === "https://example.com/lsu.png", "image is the team in front");

const espnOnly = heatNote(
  { ...cfb, broadcasts: ["ESPN"], away: { ...cfb.away, rank: null }, home: { ...cfb.home, rank: 99 } },
  drama({ sport: "cfb", awayScore: 24, homeScore: 17, detail: "0:27 - 4th", period: 4 }),
);
assert(!espnOnly.body.includes("National TV"), espnOnly.body);
assert(!espnOnly.body.includes("Ranked"), espnOnly.body);

const cw = heatNote(
  { ...cfb, detail: "15:00 - 3rd", broadcasts: ["CW"] },
  drama({ sport: "cfb", awayScore: 24, homeScore: 17, detail: "15:00 - 3rd", period: 3 }),
);
assert(cw.body.startsWith("15:00 - 3rd · CW\n"), cw.body);
assert(!cw.body.split("\n").slice(1).includes("CW"), cw.body);

const fav: PushFavorite = { key: "mlb-stl", sport: "mlb", teamId: "24", shortName: "Cardinals" };
const start = favoriteStartNote(
  { ...game, live: true, away: { ...game.away, score: 0 }, home: { ...game.home, score: 0 }, detail: "Top 1st" },
  fav,
);
assert(start.title === "Cardinals · first pitch", start.title);
assert(start.body === "Cubs at Cardinals\n7:15 PM", start.body);
assert(start.reason === "favorite-start", start.reason);
assert(!/one-run|ranked matchup|national tv/i.test(start.body), "start copy stays off the heat line");
const fin = favoriteFinalNote({ ...game, live: false, final: true, detail: "Final" }, fav);
assert(fin.title === "Cardinals final" && fin.body === "Cubs 3, Cardinals 4", `${fin.title} ${fin.body}`);
assert(fin.icon === "https://example.com/stl.png", "final icon is the favorite");
const trailing = favoriteFinalNote(
  {
    ...game,
    live: false,
    final: true,
    detail: "Final",
    away: { ...game.away, score: 9 },
    home: { ...game.home, score: 1 },
  },
  fav,
);
assert(trailing.icon === "https://example.com/stl.png", "final keeps the favorite logo when they trail");
assert(trailing.body === "Cubs 9, Cardinals 1", trailing.body);

const mapped = mapEspnEvent("nfl", {
  id: "401547403",
  date: "2026-10-04T17:00:00Z",
  competitions: [
    {
      status: { period: 1, type: { state: "in", shortDetail: "12:04 - 1st" } },
      competitors: [
        { homeAway: "away", score: "3", team: { id: "12", abbreviation: "KC", shortDisplayName: "Chiefs", logo: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png" } },
        { homeAway: "home", score: "0", team: { id: "8", abbreviation: "DET", shortDisplayName: "Lions", logo: "https://a.espncdn.com/i/teamlogos/nfl/500/det.png" } },
      ],
      situation: { isRedZone: false },
    },
  ],
});
assert(mapped?.live && mapped.away.score === 3 && mapped.home.name === "Lions", "ESPN live row maps");
assert(mapped?.when === "12:00 PM", `Chicago kickoff label, got ${mapped?.when}`);
assert(mapped?.away.rank == null && (mapped?.broadcasts ?? []).length === 0, "missing rank and TV stay empty");

const cfbRow = mapEspnEvent("cfb", {
  id: "401",
  competitions: [
    {
      status: { period: 4, type: { state: "in", shortDetail: "0:27 - 4th" } },
      geoBroadcasts: [{ media: { shortName: "ABC" }, names: ["ABC"] }],
      broadcasts: [{ names: ["ABC"] }],
      competitors: [
        {
          homeAway: "away",
          score: "24",
          curatedRank: { current: 11 },
          team: { id: "99", abbreviation: "LSU", shortDisplayName: "LSU", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/99.png" },
        },
        {
          homeAway: "home",
          score: "17",
          curatedRank: { current: 99 },
          team: { id: "333", abbreviation: "ALA", shortDisplayName: "Alabama" },
        },
      ],
    },
  ],
});
assert(cfbRow?.away.rank === 11 && cfbRow.home.rank == null, `ranks ${cfbRow?.away.rank}/${cfbRow?.home.rank}`);
assert(
  cfbRow?.broadcasts?.join() === "ABC",
  `broadcasts ${cfbRow?.broadcasts?.join() ?? ""}`,
);
assert(cfbRow?.away.logo?.includes("espncdn.com"), "logo stays on the ESPN team mark");

const pre = mapEspnEvent("mlb", {
  id: "1",
  date: "2026-10-03T23:15:00Z",
  competitions: [
    {
      status: { type: { state: "pre", shortDetail: "10/3 - 6:15 PM CDT" } },
      competitors: [
        { homeAway: "away", team: { id: "16", abbreviation: "CHC", shortDisplayName: "Cubs" } },
        { homeAway: "home", team: { id: "24", abbreviation: "STL", shortDisplayName: "Cardinals" } },
      ],
    },
  ],
});
assert(pre && !pre.live && !pre.final && pre.away.id === "16", "pregame stays off the heat path");

console.log("live-drama: ok");
