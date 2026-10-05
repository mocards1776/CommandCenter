/**
 * Run with: node --experimental-strip-types src/lib/newspaper-watch-scoreboard.test.ts
 * from CommandCenter-main/.
 */
import {
  chicagoDateFromIso,
  mapWatchBasketGame,
  mapWatchCfbGame,
  mapWatchNflGame,
  mapWatchNhlGame,
  mapWatchSoccerGame,
  rankWatchSoccerGames,
  scoreWatchBasket,
  starterOf,
  watchSeriesFromEspn,
  WATCH_BASKET_HEAT,
  wnbaInSeason,
  type EspnWatchEvent,
} from "./newspaper-watch-scoreboard.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const mnf: EspnWatchEvent = {
  id: "401772833",
  date: "2026-10-06T00:15:00.000Z",
  season: { type: 2 },
  competitions: [
    {
      venue: { fullName: "Caesars Superdome" },
      status: { type: { state: "pre", description: "Scheduled", shortDetail: "8:15 PM ET" } },
      broadcasts: [{ names: ["ESPN", "ABC"] }],
      geoBroadcasts: [{ media: { shortName: "ESPN" }, market: { type: "national" } }],
      competitors: [
        {
          homeAway: "away",
          records: [{ type: "total", summary: "2-2" }],
          team: { id: "1", displayName: "Atlanta Falcons", abbreviation: "ATL", logos: [{ href: "atl.png" }] },
        },
        {
          homeAway: "home",
          records: [{ type: "total", summary: "1-3" }],
          team: { id: "18", displayName: "New Orleans Saints", abbreviation: "NO" },
        },
      ],
    },
  ],
};

const nfl = mapWatchNflGame(mnf);
assert(nfl, "MNF maps");
assert(nfl!.away.abbrev === "ATL" && nfl!.home.abbrev === "NO", "ATL at NO");
assert(nfl!.date === "2026-10-05", "MNF files on the Chicago Monday");
assert(nfl!.startIso === "2026-10-06T00:15:00.000Z", "kickoff ISO is kept");
assert(nfl!.broadcasts.some((b) => /espn/i.test(b.name)), "ESPN network is kept");
assert(nfl!.status === "Scheduled" && nfl!.shortDetail === "8:15 PM ET", "status + clock");
assert(!nfl!.live && !nfl!.final, "pregame MNF is not live or final");
assert(chicagoDateFromIso("2026-10-06T00:15:00.000Z") === "2026-10-05", "00:15 UTC is Monday in Chicago");

const nhlEvent: EspnWatchEvent = {
  id: "401803201",
  date: "2026-10-05T23:00:00.000Z",
  competitions: [
    {
      venue: { fullName: "Climate Pledge Arena" },
      status: { type: { state: "pre", description: "Scheduled", shortDetail: "7:00 PM ET" } },
      broadcasts: [{ names: ["ESPN+"] }],
      series: { type: "playoff", summary: "SEA leads series 1-0", totalCompetitions: 7 },
      notes: [{ headline: "Round 1 - Game 2" }],
      competitors: [
        { homeAway: "away", team: { id: "4", displayName: "Chicago Blackhawks", abbreviation: "CHI" } },
        { homeAway: "home", team: { id: "124292", displayName: "Seattle Kraken", abbreviation: "SEA" } },
      ],
    },
  ],
};
const nhl = mapWatchNhlGame(nhlEvent);
assert(nhl?.away.abbrev === "CHI" && nhl.home.abbrev === "SEA", "NHL sides");
assert(nhl?.date === "2026-10-05", "NHL Chicago date");
assert(nhl?.seriesLine && /leads/i.test(nhl.seriesLine), "playoff series line");
assert(/Round 1/i.test(nhl!.seriesLine!), "playoff note names the round");
assert(
  watchSeriesFromEspn({ series: { type: "regular", summary: "Season series tied 1-1" }, notes: [{ headline: "Game 2" }] }) === null,
  "regular-season series stays off the page",
);
assert(
  watchSeriesFromEspn({
    series: { type: "playoff", summary: "CLE leads series 1-0", totalCompetitions: 5 },
    notes: [{ headline: "ALDS - Game 2" }],
  }) === "ALDS · CLE leads 1-0",
  "ALDS plus the lead",
);
assert(
  watchSeriesFromEspn({ series: { type: "playoff", summary: "" }, notes: [{ headline: "ALDS - Game 1" }] }) === "ALDS Game 1",
  "ALDS Game 1 when ESPN has no lead yet",
);

const cfbEvent: EspnWatchEvent = {
  id: "401752001",
  date: "2026-10-03T19:30:00.000Z",
  competitions: [
    {
      status: { type: { state: "pre", description: "Scheduled", shortDetail: "3:30 PM ET" } },
      broadcasts: [{ names: ["ABC"] }],
      odds: [{ details: "ALA -7.5", spread: -7.5, homeTeamOdds: { favorite: true, team: { id: "333" } } }],
      competitors: [
        {
          homeAway: "away",
          curatedRank: { current: 21 },
          team: { id: "142", displayName: "Missouri Tigers", abbreviation: "MIZ" },
        },
        {
          homeAway: "home",
          curatedRank: { current: 8 },
          team: { id: "333", displayName: "Alabama Crimson Tide", abbreviation: "ALA" },
        },
      ],
    },
  ],
};
const cfb = mapWatchCfbGame(cfbEvent);
assert(cfb?.away.rank === 21 && cfb.home.rank === 8, "AP ranks from curatedRank");
assert(cfb?.odds?.favoriteTeamId === 333, "spread favorite is Alabama");
assert(mapWatchCfbGame({ ...cfbEvent, competitions: [{ ...cfbEvent.competitions![0]!, competitors: [
  { homeAway: "away", curatedRank: { current: 99 }, team: { id: "1", displayName: "Unranked", abbreviation: "X" } },
  { homeAway: "home", curatedRank: { current: 99 }, team: { id: "2", displayName: "Also", abbreviation: "Y" } },
] }] })?.away.rank == null, "ESPN 99 is not a Top-25 rank");

const soccer = mapWatchSoccerGame(
  {
    id: "70001",
    date: "2026-10-05T16:00:00.000Z",
    competitions: [
      {
        status: { type: { state: "pre", description: "Scheduled", shortDetail: "12:00 PM ET" } },
        competitors: [
          { homeAway: "away", team: { id: "359", displayName: "Arsenal", abbreviation: "ARS" } },
          { homeAway: "home", team: { id: "364", displayName: "Liverpool", abbreviation: "LIV" } },
        ],
      },
    ],
  },
  "eng.1",
);
assert(soccer?.league === "Premier League" && soccer.leagueSlug === "eng.1", "PL label");
assert(soccer?.pregame && soccer.date === "2026-10-05", "soccer Chicago date + pregame");
const soccerRanked = rankWatchSoccerGames([soccer!], { "359": 10 });
assert(soccerRanked[0]!.score > 20 && soccerRanked[0]!.reasons.includes("Premier League"), "PL + desk interest ranks");

const nbaPre: EspnWatchEvent = {
  id: "401810001",
  date: "2026-10-05T23:00:00.000Z",
  season: { type: 1 },
  competitions: [
    {
      venue: { fullName: "Ball Arena" },
      status: { type: { state: "pre", description: "Scheduled", shortDetail: "7:00 PM ET" } },
      broadcasts: [{ names: ["NBA TV"] }],
      competitors: [
        { homeAway: "away", team: { id: "26", displayName: "Utah Jazz", abbreviation: "UTAH" } },
        { homeAway: "home", team: { id: "7", displayName: "Denver Nuggets", abbreviation: "DEN" } },
      ],
    },
  ],
};
const nba = mapWatchBasketGame(nbaPre, "nba");
assert(nba?.preseason && !nba.postseason, "season type 1 is preseason");
assert(nba?.away.abbrev === "UTAH" && nba.home.abbrev === "DEN", "NBA sides");
assert(nba?.broadcasts.some((b) => /nba\s*tv/i.test(b.name)), "NBA TV");
assert(scoreWatchBasket(nba!).score === WATCH_BASKET_HEAT.preseason, "preseason heat is the floor");
assert(scoreWatchBasket(nba!, { "7": 10 }).score === WATCH_BASKET_HEAT.preseason, "desk interest does not lift preseason");
assert(scoreWatchBasket({ ...nba!, preseason: false, postseason: false }).score === WATCH_BASKET_HEAT.regular, "regular NBA is still low-tier");
assert(scoreWatchBasket({ ...nba!, preseason: false, postseason: true }).score === WATCH_BASKET_HEAT.postseason, "playoff NBA is a bit warmer");

assert(wnbaInSeason("2026-10-05"), "early October is WNBA season");
assert(wnbaInSeason("2026-05-15"), "May is WNBA season");
assert(!wnbaInSeason("2026-01-12"), "January is not WNBA season");

assert(mapWatchNflGame({ id: "x" }) == null, "an event without competitors is dropped");

const pitched: EspnWatchEvent = {
  ...mnf,
  competitions: [
    {
      ...mnf.competitions![0]!,
      odds: [{ details: "ATL -3.5", spread: -3.5 }],
      competitors: [
        {
          ...mnf.competitions![0]!.competitors![0]!,
          team: {
            ...mnf.competitions![0]!.competitors![0]!.team,
            shortDisplayName: "Falcons",
            color: "a71930",
          },
        },
        {
          ...mnf.competitions![0]!.competitors![1]!,
          team: {
            ...mnf.competitions![0]!.competitors![1]!.team,
            shortDisplayName: "Saints",
            color: "d3bc8d",
          },
          probables: [{ athlete: { shortName: "S. Rattler" } }],
        },
      ],
    },
  ],
};
const nflBits = mapWatchNflGame(pitched) as ReturnType<typeof mapWatchNflGame> & { line?: string | null };
assert((nflBits!.away as { short?: string }).short === "Falcons", "ESPN short name is kept");
assert(nflBits!.away.color === "a71930", "team color is kept");
assert((nflBits!.home as { starter?: string }).starter === "S. Rattler", "probable from ESPN");
assert(nflBits!.line === "ATL -3.5", "spread line is kept");

const nhlBits = mapWatchNhlGame({
  ...nhlEvent,
  competitions: [
    {
      ...nhlEvent.competitions![0]!,
      competitors: [
        {
          ...nhlEvent.competitions![0]!.competitors![0]!,
          team: { ...nhlEvent.competitions![0]!.competitors![0]!.team, shortDisplayName: "Blackhawks", color: "ce1126" },
          probables: [{ athlete: { displayName: "Spencer Knight" }, statistics: [{ abbreviation: "GAA", displayValue: "2.10" }] }],
        },
        nhlEvent.competitions![0]!.competitors![1]!,
      ],
    },
  ],
});
assert((nhlBits!.away as { short?: string }).short === "Blackhawks", "NHL short name");
assert((nhlBits!.away as { starter?: string }).starter === "Spencer Knight", "NHL starting goalie");
assert((nhlBits!.away as { starterLine?: string }).starterLine === "2.10 GAA", "NHL goalie line");

const arms = starterOf({
  probables: [
    {
      athlete: { id: "608331", displayName: "Max Fried", headshot: { href: "https://example.com/fried.png" } },
      statistics: [
        { abbreviation: "W", displayValue: "14" },
        { abbreviation: "L", displayValue: "6" },
        { abbreviation: "ERA", displayValue: "1.95" },
      ],
    },
  ],
});
assert(arms?.name === "Max Fried" && arms.line === "14-6 · 1.95 ERA", "pitcher record and ERA");
assert(arms?.id === "608331" && arms.headshot?.includes("fried"), "pitcher headshot + id");
assert(
  starterOf({
    probables: [
      {
        athlete: { displayName: "Andrei Vasilevskiy" },
        statistics: [
          { abbreviation: "W", displayValue: "18" },
          { abbreviation: "L", displayValue: "10" },
          { abbreviation: "SV%", displayValue: ".911" },
        ],
      },
    ],
  })?.line === "18-10 · .911 SV%",
  "goalie save percentage",
);

console.log("newspaper-watch-scoreboard ok");
