/**
 * Live proof that the watch desk sees today's ESPN slate through newspaperEspnGet.
 * Run from CommandCenter-main/:
 *   node --experimental-strip-types src/lib/newspaper-watch.live.ts
 */
import { fetchWatchList, WATCH_PAGE_GAMES, type WatchGame } from "./newspaper-watch.ts";

const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv ?? [];
const day = argv[2] || new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

const games = await fetchWatchList(day, { limit: WATCH_PAGE_GAMES });

function matchup(g: WatchGame): string {
  return `${g.away.abbrev}@${g.home.abbrev}`;
}

const byLeague = games.reduce<Record<string, string[]>>((acc, g) => {
  (acc[g.league] ??= []).push(`${matchup(g)} ${g.status ?? ""} ${g.tv.join("/")}`);
  return acc;
}, {});

const nflMnf = games.filter(
  (g) =>
    g.league === "NFL" &&
    ((g.away.abbrev === "ATL" && g.home.abbrev === "NO") ||
      (g.away.abbrev === "NO" && g.home.abbrev === "ATL")),
);
const nhl = games.filter((g) => g.league === "NHL");
const nba = games.filter((g) => g.league === "NBA");

const missing: string[] = [];
if (!nflMnf.length) missing.push("missing ATL@NO (MNF)");
if (nhl.length < 4) missing.push(`NHL games=${nhl.length} (want 4)`);
if (nba.length < 1) missing.push("missing NBA games");
if (games.length > WATCH_PAGE_GAMES) missing.push(`cap broken: ${games.length} > ${WATCH_PAGE_GAMES}`);

const report = {
  day,
  count: games.length,
  leagues: Object.fromEntries(Object.entries(byLeague).map(([k, v]) => [k, v.length])),
  nflMnf: nflMnf.map(matchup),
  nhl: nhl.map(matchup),
  nba: nba.map((g) => `${matchup(g)}${g.preseason ? " (preseason)" : ""}`),
  slate: games.map((g) => `${g.league} ${matchup(g)} heat=${g.heat} tv=${g.tv.join("/") || "—"}`),
  missing,
};

console.log(JSON.stringify(report, null, 2));
if (missing.length) {
  throw new Error(`watch desk live proof failed: ${missing.join("; ")}`);
}
console.log("times-watch live proof ok");
