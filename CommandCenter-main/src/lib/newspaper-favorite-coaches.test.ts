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
  printsFavoriteCoaches,
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
    record: "4-1",
    conferenceRecord: "1-1",
    standing: null,
    rank: 14,
    pointsForAvg: "37.6",
    pointsAgainstAvg: "20",
    lastGame: null,
    nextGame: null,
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

console.log("newspaper-favorite-coaches ok");
