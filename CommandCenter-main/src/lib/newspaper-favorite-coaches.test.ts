/**
 * Run with: node --experimental-strip-types src/lib/newspaper-favorite-coaches.test.ts
 * from CommandCenter-main/.
 */
import {
  CFB_SEASON_WINDOW,
  FAVORITE_COACHES_PRINT,
  FEATURED_COACH_TEAM_ID,
  TIMES_FAVORITE_COACHES_USER_ID,
  coachLeaguePath,
  coachPathsOf,
  editionDayOf,
  favoriteCoachesWeekday,
  isCfbSeasonDay,
  isFavoriteCoachPosition,
  isFeaturedCoachTeam,
  mapFavoriteCoachRow,
  mapFavoriteCoachRows,
  printsFavoriteCoaches,
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

console.log("newspaper-favorite-coaches ok");
