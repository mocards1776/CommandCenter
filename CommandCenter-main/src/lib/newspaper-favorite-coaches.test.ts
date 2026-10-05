/**
 * Run with: node --experimental-strip-types src/lib/newspaper-favorite-coaches.test.ts
 * from CommandCenter-main/.
 */
import {
  CFB_SEASON_WINDOW,
  FAVORITE_COACHES_PRINT,
  FEATURED_COACH_TEAM_ID,
  TIMES_FAVORITE_COACHES_USER_ID,
  applyCoachProfile,
  cfbSeasonYear,
  coachFactLines,
  coachLeaguePath,
  coachPathsOf,
  coachStatusNote,
  editionDayOf,
  favoriteCoachesWeekday,
  formatCoachMoney,
  isCfbSeasonDay,
  isFavoriteCoachPosition,
  isFeaturedCoachTeam,
  mapFavoriteCoachRow,
  mapFavoriteCoachRows,
  parseWl,
  pickCoachHeadshot,
  printsFavoriteCoaches,
  seasonStripFromEvents,
  slateFromEvents,
  slateLine,
  yearsAtSchoolLabel,
} from "./newspaper-favorite-coaches.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(FAVORITE_COACHES_PRINT.monday === "always", "Monday is the always-print day");
assert(FAVORITE_COACHES_PRINT.sunday === "cfb-season", "Sunday follows the CFB season window");
assert(CFB_SEASON_WINDOW.startMonth === 8 && CFB_SEASON_WINDOW.endMonth === 1, "season window is Aug–Jan");
assert(TIMES_FAVORITE_COACHES_USER_ID === "0a04c242-4b3a-4cac-8441-3844c3d57da0", "desk user is Josh");
assert(FEATURED_COACH_TEAM_ID === "142", "Missouri is the featured tile");

assert(editionDayOf("2026-10-05-morning") === "2026-10-05", "press id yields its Chicago date");
assert(editionDayOf("2026-10-05-midday") === "2026-10-05", "midday shares the date");
assert(editionDayOf("2026-10-05-evening") === "2026-10-05", "evening shares the date");
assert(editionDayOf("nope") === null, "junk press id has no date");

assert(favoriteCoachesWeekday("2026-10-05") === 1, "Oct 5 2026 is Monday");
assert(favoriteCoachesWeekday("2026-10-04") === 0, "Oct 4 2026 is Sunday");
assert(favoriteCoachesWeekday("2026-10-06") === 2, "Oct 6 2026 is Tuesday");

assert(isCfbSeasonDay("2026-08-01"), "Aug 1 is in season");
assert(isCfbSeasonDay("2026-10-04"), "October Sunday is in season");
assert(isCfbSeasonDay("2026-01-20"), "Jan 20 is still in season");
assert(!isCfbSeasonDay("2026-01-21"), "Jan 21 is out of season");
assert(!isCfbSeasonDay("2026-03-01"), "March is out of season");
assert(!isCfbSeasonDay("2026-07-31"), "July is out of season");

assert(printsFavoriteCoaches("2026-10-05-morning"), "Monday morning prints");
assert(printsFavoriteCoaches("2026-10-05-midday"), "Monday midday prints");
assert(printsFavoriteCoaches("2026-10-05-evening"), "Monday evening prints");
assert(printsFavoriteCoaches("2026-10-04-morning"), "in-season Sunday morning prints");
assert(printsFavoriteCoaches("2026-10-04-evening"), "in-season Sunday evening prints");
assert(printsFavoriteCoaches("2026-01-18-morning"), "Jan 18 2026 is a Sunday still in the window");
assert(!printsFavoriteCoaches("2026-01-25-morning"), "Sunday after the CFP window is skipped");
assert(!printsFavoriteCoaches("2026-03-01-morning"), "March Sunday is skipped");
assert(!printsFavoriteCoaches("2026-10-06-morning"), "Tuesday is skipped");
assert(!printsFavoriteCoaches("2026-10-07-midday"), "Wednesday is skipped");
assert(!printsFavoriteCoaches("not-a-press"), "junk id is skipped");

assert(isFavoriteCoachPosition("Coach"), "Coach is a coach");
assert(isFavoriteCoachPosition("coach"), "coach is a coach");
assert(isFavoriteCoachPosition("COACH"), "COACH is a coach");
assert(isFavoriteCoachPosition("  Coach  "), "padded Coach is a coach");
assert(!isFavoriteCoachPosition("QB"), "QB is not a coach");
assert(!isFavoriteCoachPosition(null), "null is not a coach");
assert(!isFavoriteCoachPosition(""), "empty is not a coach");

assert(coachLeaguePath("CFB", "football") === "football/college-football", "CFB maps to college football");
assert(coachLeaguePath("cbb", "basketball") === "basketball/mens-college-basketball", "CBB maps to college hoops");
assert(coachLeaguePath(null, "basketball") === "basketball/mens-college-basketball", "sport fills a missing league");
assert(coachLeaguePath("ncaaf", null) === "football/college-football", "ncaaf is CFB");
assert(coachLeaguePath("unknown", "golf") === null, "unknown league is dropped");

assert(isFeaturedCoachTeam("142", "Auburn Tigers") === true, "Missouri team id is featured even if the name is stale");
assert(isFeaturedCoachTeam("2", "Missouri Tigers"), "Missouri in the name is featured");
assert(isFeaturedCoachTeam("2623", "Missouri State") === false, "Missouri State is not Mizzou");
assert(isFeaturedCoachTeam("30", "USC Trojans") === false, "USC is not featured");

const drinkwitz = mapFavoriteCoachRow({
  player_id: "4409388",
  player_name: "Eliah Drinkwitz",
  team_name: "Missouri Tigers",
  team_id: "142",
  sport: "football",
  league: "CFB",
  position: "Coach",
});
assert(drinkwitz?.coachId === "4409388", "row maps player_id");
assert(drinkwitz?.name === "Eliah Drinkwitz", "row maps player_name");
assert(drinkwitz?.teamId === "142", "row maps team_id");
assert(drinkwitz?.teamName === "Missouri Tigers", "row maps team_name");
assert(drinkwitz?.leaguePath === "football/college-football", "CFB row files in CFB");
assert(drinkwitz?.featured === true, "Missouri coach is the featured tile");

const camel = mapFavoriteCoachRow({
  playerId: "5120149",
  playerName: "Alex Golesh",
  teamName: "Auburn Tigers",
  teamId: "2",
  sport: "football",
  league: "CFB",
  position: "coach",
});
assert(camel?.coachId === "5120149" && camel.leaguePath === "football/college-football", "camelCase FavoritePlayer maps");
assert(camel?.featured === false, "Auburn is not the featured tile");

const hoop = mapFavoriteCoachRow({
  player_id: "99",
  player_name: "Future Coach",
  team_name: "Missouri Tigers",
  team_id: "142",
  sport: "basketball",
  league: "CBB",
  position: "Coach",
});
assert(hoop?.leaguePath === "basketball/mens-college-basketball", "a basketball coach files in CBB");

assert(mapFavoriteCoachRow({ player_id: "1", player_name: "A QB", position: "QB", league: "CFB" }) === null, "players are not coaches");
assert(mapFavoriteCoachRow({ player_id: "", player_name: "No Id", position: "Coach", league: "CFB" }) === null, "missing id drops");
assert(mapFavoriteCoachRow({ player_id: "1", player_name: "", position: "Coach", league: "CFB" }) === null, "missing name drops");

const mapped = mapFavoriteCoachRows([
  {
    player_id: "145698",
    player_name: "Lincoln Riley",
    team_name: "USC Trojans",
    team_id: "30",
    sport: "football",
    league: "CFB",
    position: "Coach",
  },
  {
    player_id: "1",
    player_name: "Brady",
    team_name: "Patriots",
    team_id: "17",
    sport: "football",
    league: "NFL",
    position: "QB",
  },
  {
    player_id: "4409388",
    player_name: "Eliah Drinkwitz",
    team_name: "Missouri Tigers",
    team_id: "142",
    sport: "football",
    league: "CFB",
    position: "Coach",
  },
  {
    playerId: "4409388",
    playerName: "Eliah Drinkwitz",
    teamName: "Missouri Tigers",
    teamId: "142",
    sport: "football",
    league: "CFB",
    position: "Coach",
  },
]);
assert(mapped.length === 2, "QB dropped and duplicate Drinkwitz collapsed");
assert(mapped[0]?.name === "Eliah Drinkwitz", "featured Missouri tile leads");
assert(mapped[1]?.name === "Lincoln Riley", "the rest follow by name");
assert(
  coachPathsOf(mapped).join() === "football/college-football",
  "coach paths are the distinct league paths",
);

assert(cfbSeasonYear("2026-10-05") === 2026, "October is the 2026 CFB season");
assert(cfbSeasonYear("2026-01-10") === 2025, "January is still the prior CFB season");
assert(parseWl("4-1")?.wins === 4 && parseWl("4-1")?.losses === 1, "season W-L parses");
assert(yearsAtSchoolLabel(2020, 2026) === "7th season", "Drinkwitz is in year 7");
assert(yearsAtSchoolLabel(2026, 2026) === "1st season", "Golesh is a first-year coach");
assert(formatCoachMoney(10750000) === "$10.75M", "salary formats in millions");
assert(formatCoachMoney(6750000) === "$6.75M", "6.75M keeps two decimals");
assert(formatCoachMoney(10000000) === "$10M", "ten million keeps the ten");
assert(formatCoachMoney(10100000) === "$10.1M", "10.1M drops the trailing zero");
assert(coachStatusNote([{ headline: "Vols hold serve in Knoxville" }], "Alex Golesh") === null, "ordinary hed is not a status note");
assert(
  coachStatusNote([{ headline: "Drinkwitz signs a six-year extension at Missouri" }], "Eliah Drinkwitz") ===
    "Drinkwitz signs a six-year extension at Missouri",
  "status note stays grounded in a sourced headline",
);

const enriched = applyCoachProfile(
  {
    coachId: "4409388",
    name: "Eliah Drinkwitz",
    leaguePath: "football/college-football",
    league: "CFB",
    teamId: "142",
    teamName: "Missouri",
    teamAbbrev: "MIZ",
    teamLogo: null,
    teamColor: null,
    headshot: null,
    featured: true,
    seasonYear: 2026,
    record: "4-1",
    conferenceRecord: "1-1",
    standing: null,
    rank: 14,
    pointsForAvg: "37.6",
    pointsAgainstAvg: "20",
    lastGame: null,
    nextGame: null,
    seasonStrip: [],
    slate: [],
    headlines: [],
    schoolRecord: null,
    yearsAtSchool: null,
    careerRecord: null,
    bowlRecord: null,
    playoffRecord: null,
    vsRanked: "1-1",
    titles: null,
    nflRecord: null,
    salary: null,
    contractEnd: null,
    buyout: null,
    sourceLabel: null,
    sourceUrl: null,
    statusNote: null,
  },
  {
    coach_id: "4409388",
    hire_year: 2020,
    school_wins: 46,
    school_losses: 29,
    career_wins: 58,
    career_losses: 30,
    bowl_wins: 2,
    bowl_losses: 3,
    titles_note: "1 Sun Belt (2019)",
    salary_annual: 10750000,
    salary_note: "avg",
    contract_end_year: 2031,
    source_url: "https://mutigers.com/",
    source_label: "Mizzou Athletics, Nov 2025",
  },
  2026,
  "1–1",
);
assert(enriched.schoolRecord === "50–30", "school record adds the live season");
assert(enriched.careerRecord === "62–31", "career record adds the live season");
assert(enriched.yearsAtSchool === "7th season", "years at school from hire year");
assert(enriched.bowlRecord === "2–3", "bowl record is cited, not invented");
assert(enriched.salary === "$10.75M avg", "annual salary keeps its note");
assert(enriched.contractEnd === "thru 2031", "contract end year prints");
assert(enriched.sourceLabel === "Mizzou Athletics, Nov 2025", "salary source line is cited");
assert(applyCoachProfile(enriched, null, 2026, null).salary === null, "missing profile omits salary");
assert(
  coachFactLines(enriched).join("|") ===
    "At school 50–30 · 7th season|Career 62–31|Bowls 2–3|vs ranked 1–1|1 Sun Belt (2019)|$10.75M avg · thru 2031",
  "fact lines skip empty fields and keep the cited salary",
);
assert(
  coachFactLines(applyCoachProfile(enriched, null, 2026, "1–1")).join("|") === "vs ranked 1–1",
  "no profile means only live facts",
);

const strip = seasonStripFromEvents(
  [
    {
      id: "1",
      competitions: [
        {
          status: { type: { completed: true } },
          competitors: [
            { homeAway: "home", winner: true, team: { id: "142", abbreviation: "MIZ" } },
            { homeAway: "away", winner: false, team: { id: "57", abbreviation: "FLA" } },
          ],
        },
      ],
    },
    {
      id: "2",
      competitions: [
        {
          status: { type: { completed: false } },
          competitors: [
            { homeAway: "home", team: { id: "142", abbreviation: "MIZ" } },
            { homeAway: "away", team: { id: "245", abbreviation: "TA&M" } },
          ],
        },
      ],
    },
    {
      id: "3",
      competitions: [
        {
          status: { type: { completed: true } },
          competitors: [
            { homeAway: "away", winner: false, team: { id: "142", abbreviation: "MIZ" } },
            { homeAway: "home", winner: true, curatedRank: { current: 4 }, team: { id: "333", abbreviation: "ALA" } },
          ],
        },
      ],
    },
  ],
  "142",
);
assert(strip.length === 2, "upcoming games stay off the season strip");
assert(strip[0]?.result === "W" && strip[0]?.opponent === "FLA", "first chip is the Florida win");
assert(strip[1]?.result === "L" && strip[1]?.opponentRank === 4, "Alabama loss keeps the AP rank");

const slateEvents = [
  {
    id: "old-1",
    date: "2026-08-30T16:00:00Z",
    competitions: [
      {
        date: "2026-08-30T16:00:00Z",
        status: { type: { completed: true } },
        competitors: [
          { homeAway: "home", winner: true, score: "51", team: { id: "142", shortDisplayName: "Missouri" } },
          { homeAway: "away", winner: false, score: "6", team: { id: "202", shortDisplayName: "Central Arkansas" } },
        ],
      },
    ],
  },
  {
    id: "old-2",
    date: "2026-09-06T16:00:00Z",
    competitions: [
      {
        date: "2026-09-06T16:00:00Z",
        status: { type: { completed: true } },
        competitors: [
          { homeAway: "away", winner: true, score: "42", team: { id: "142", shortDisplayName: "Missouri" } },
          { homeAway: "home", winner: false, score: "10", team: { id: "249", shortDisplayName: "Kansas" } },
        ],
      },
    ],
  },
  {
    id: "last-w",
    date: "2026-09-20T16:00:00Z",
    competitions: [
      {
        date: "2026-09-20T16:00:00Z",
        status: { type: { completed: true } },
        competitors: [
          { homeAway: "home", winner: true, score: "35", team: { id: "142", shortDisplayName: "Missouri" } },
          { homeAway: "away", winner: false, score: "10", team: { id: "57", shortDisplayName: "Florida" } },
        ],
      },
    ],
  },
  {
    id: "last-l",
    date: "2026-09-27T23:30:00Z",
    competitions: [
      {
        date: "2026-09-27T23:30:00Z",
        status: { type: { completed: true } },
        competitors: [
          { homeAway: "away", winner: false, score: "10", team: { id: "142", shortDisplayName: "Missouri" } },
          { homeAway: "home", winner: true, curatedRank: { current: 4 }, score: "27", team: { id: "333", shortDisplayName: "Alabama" } },
        ],
      },
    ],
  },
  {
    id: "next-1",
    date: "2026-10-11T16:00:00Z",
    timeValid: true,
    competitions: [
      {
        date: "2026-10-11T16:00:00Z",
        broadcasts: [{ media: { shortName: "SEC Network" }, type: { shortName: "TV" } }],
        odds: [{ details: "MIZ -3.5" }],
        status: { type: { completed: false } },
        competitors: [
          { homeAway: "home", team: { id: "142", shortDisplayName: "Missouri" } },
          { homeAway: "away", curatedRank: { current: 8 }, team: { id: "245", shortDisplayName: "Texas A&M" } },
        ],
      },
    ],
  },
  {
    id: "next-2",
    date: "2026-10-18T16:00:00Z",
    competitions: [
      {
        date: "2026-10-18T16:00:00Z",
        status: { type: { completed: false } },
        competitors: [
          { homeAway: "away", team: { id: "142", shortDisplayName: "Missouri" } },
          { homeAway: "home", team: { id: "238", shortDisplayName: "Vanderbilt" } },
        ],
      },
    ],
  },
  {
    id: "next-3",
    date: "2026-10-25T16:00:00Z",
    competitions: [
      {
        date: "2026-10-25T16:00:00Z",
        status: { type: { completed: false } },
        competitors: [
          { homeAway: "home", team: { id: "142", shortDisplayName: "Missouri" } },
          { homeAway: "away", team: { id: "96", shortDisplayName: "Kentucky" } },
        ],
      },
    ],
  },
  {
    id: "next-4",
    date: "2026-11-01T16:00:00Z",
    competitions: [
      {
        date: "2026-11-01T16:00:00Z",
        status: { type: { completed: false } },
        competitors: [
          { homeAway: "away", team: { id: "142", shortDisplayName: "Missouri" } },
          { homeAway: "home", team: { id: "8", shortDisplayName: "Arkansas" } },
        ],
      },
    ],
  },
];
const slate = slateFromEvents(slateEvents, "142", { "next-2": { tv: "ESPN", line: "VAN -1.5" } });
assert(slate.length === 6, "slate keeps the last 3 results and next 3 games");
assert(slate[0]?.id === "old-2" && slate[2]?.id === "last-l", "oldest of the four finals is dropped");
assert(slate[3]?.id === "next-1" && slate[5]?.id === "next-3", "fourth upcoming game stays off the slate");
assert(slate.every((g, i, all) => i === 0 || all[i - 1]!.kind === "final" || g.kind === "upcoming"), "finals precede upcoming");
assert(slateLine(slate[2]!) === "L · 10–27 · at #4 Alabama · Sun Sep 27", "final line has result, score, rank and date");
assert(slateLine(slate[3]!).includes("vs #8 Texas A&M"), "upcoming line keeps the opponent rank");
assert(slateLine(slate[3]!).includes("SEC Network"), "upcoming TV comes from the schedule");
assert(slateLine(slate[3]!).includes("MIZ -3.5"), "upcoming line comes from the schedule");
assert(slateLine(slate[4]!).includes("ESPN") && slateLine(slate[4]!).includes("VAN -1.5"), "summary extras fill TV and line");
assert(
  pickCoachHeadshot("https://mutigers.com/eli.jpg", "https://a.espncdn.com/x.png") === "https://mutigers.com/eli.jpg",
  "cited athletics portrait wins over ESPN",
);
assert(pickCoachHeadshot("  ", "https://a.espncdn.com/x.png") === "https://a.espncdn.com/x.png", "ESPN fills only when the profile has no photo");
assert(pickCoachHeadshot(null, null) === null, "no photo is omitted");
assert(applyCoachProfile(enriched, { coach_id: "4409388", headshot_url: "https://mutigers.com/eli.jpg" }, 2026, null).headshot === "https://mutigers.com/eli.jpg", "profile headshot prints on the tile");

console.log("newspaper-favorite-coaches ok");
