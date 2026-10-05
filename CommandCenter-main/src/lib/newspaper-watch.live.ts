/**
 * Live proof that the watch desk sees today's ESPN slate through newspaperEspnGet.
 * Avoids Sports App modules (extensionless / Vite aliases) so Node can run it.
 *
 * Run from CommandCenter-main/:
 *   node --experimental-strip-types src/lib/newspaper-watch.live.ts
 *   node --experimental-strip-types src/lib/newspaper-watch.live.ts 2026-10-05
 */
import { newspaperEspnGet } from "./newspaper-espn.ts";
import {
  composeWatchPage,
  pickWatchGames,
  printNetworks,
  WATCH_PAGE_GAMES,
  type WatchGame,
} from "./newspaper-watch-page.ts";
import {
  fetchWatchCfbBoard,
  fetchWatchNbaBoard,
  fetchWatchNflBoard,
  fetchWatchNhlBoard,
  fetchWatchSoccerBoard,
  fetchWatchWnbaBoard,
  rankWatchSoccerGames,
  scoreWatchBasket,
  wnbaInSeason,
} from "./newspaper-watch-scoreboard.ts";

const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv ?? [];
const day = argv[2] || new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const ymd = day.replace(/-/g, "");
const onDay = <G extends { date?: string | null }>(games: G[]) => games.filter((g) => !g.date || g.date === day);

type Side = { name: string; abbrev: string; record: string | null; logo?: string | null; teamId?: number | string };
type Row = {
  id: string;
  live: boolean;
  final: boolean;
  venue: string | null;
  broadcasts: { name: string }[];
  startIso?: string | null;
  shortDetail?: string | null;
  status?: string;
  away: Side;
  home: Side;
  score: number;
  reasons: string[];
  preseason?: boolean;
};

function toWatch(g: Row, league: WatchGame["league"], competition: string | null = null): WatchGame & { final?: boolean } {
  return {
    id: `${league.toLowerCase()}-${g.id}`,
    league,
    competition,
    away: { name: g.away.name, abbrev: g.away.abbrev, logo: g.away.logo ?? null, record: g.away.record, teamId: g.away.teamId != null ? String(g.away.teamId) : null },
    home: { name: g.home.name, abbrev: g.home.abbrev, logo: g.home.logo ?? null, record: g.home.record, teamId: g.home.teamId != null ? String(g.home.teamId) : null },
    when: g.startIso ?? null,
    status: g.shortDetail ?? g.status ?? null,
    live: g.live,
    venue: g.venue,
    tv: printNetworks(g.broadcasts.map((b) => b.name)).map((n) => n.name),
    heat: g.score,
    reasons: g.reasons.slice(0, 3),
    preseason: g.preseason,
    final: g.final,
  };
}

async function fetchMlb(dayYmd: string): Promise<(WatchGame & { final?: boolean })[]> {
  try {
    const raw = (await newspaperEspnGet(`baseball/mlb/scoreboard?dates=${dayYmd}&limit=300`)) as {
      events?: {
        id?: string;
        date?: string;
        competitions?: {
          venue?: { fullName?: string };
          status?: { type?: { state?: string; completed?: boolean; shortDetail?: string; description?: string } };
          broadcasts?: { names?: string[] }[];
          competitors?: {
            homeAway?: string;
            team?: { id?: string; displayName?: string; abbreviation?: string };
            records?: { type?: string; summary?: string }[];
          }[];
        }[];
      }[];
    };
    const out: (WatchGame & { final?: boolean })[] = [];
    for (const ev of raw.events ?? []) {
      const comp = ev.competitions?.[0];
      const away = (comp?.competitors ?? []).find((c) => c.homeAway === "away");
      const home = (comp?.competitors ?? []).find((c) => c.homeAway === "home");
      if (!away?.team || !home?.team) continue;
      const st = comp?.status?.type;
      const final = Boolean(st?.completed || st?.state === "post");
      out.push(
        toWatch(
          {
            id: String(ev.id ?? ""),
            live: st?.state === "in",
            final,
            venue: comp?.venue?.fullName ?? null,
            broadcasts: (comp?.broadcasts ?? []).flatMap((b) => (b.names ?? []).map((name) => ({ name }))),
            startIso: ev.date ?? null,
            shortDetail: st?.shortDetail ?? st?.description,
            status: st?.description,
            away: {
              name: away.team.displayName ?? "Away",
              abbrev: away.team.abbreviation ?? "—",
              record: away.records?.find((r) => r.type === "total")?.summary ?? null,
              teamId: away.team.id,
            },
            home: {
              name: home.team.displayName ?? "Home",
              abbrev: home.team.abbreviation ?? "—",
              record: home.records?.find((r) => r.type === "total")?.summary ?? null,
              teamId: home.team.id,
            },
            score: 70,
            reasons: ["Playoffs"],
          },
          "MLB",
        ),
      );
    }
    return out;
  } catch (err) {
    console.warn("watch desk MLB scoreboard failed", err);
    return [];
  }
}

const [mlb, nfl, nhl, cfb, soccer, nba, wnba] = await Promise.all([
  fetchMlb(ymd),
  fetchWatchNflBoard(ymd).then(onDay),
  fetchWatchNhlBoard(ymd).then(onDay),
  fetchWatchCfbBoard(ymd).then(onDay),
  fetchWatchSoccerBoard(day),
  fetchWatchNbaBoard(ymd).then(onDay),
  wnbaInSeason(day) ? fetchWatchWnbaBoard(ymd).then(onDay) : Promise.resolve([]),
]);

const games = pickWatchGames(
  [
    ...mlb,
    ...nfl.map((g) => toWatch({ ...g, score: 40, reasons: ["Upcoming"] }, "NFL")),
    ...nhl.map((g) => toWatch({ ...g, score: 35, reasons: ["Upcoming"] }, "NHL")),
    ...cfb.map((g) => toWatch({ ...g, score: 30, reasons: g.away.rank && g.home.rank ? ["Ranked matchup"] : [] }, "CFB")),
    ...rankWatchSoccerGames(soccer, {}).map((g) => toWatch(g, "Soccer", g.league)),
    ...nba.map((g) => {
      const { score, reasons } = scoreWatchBasket(g);
      return toWatch({ ...g, score, reasons }, "NBA");
    }),
    ...wnba.map((g) => {
      const { score, reasons } = scoreWatchBasket(g);
      return toWatch({ ...g, score, reasons }, "WNBA");
    }),
  ],
  WATCH_PAGE_GAMES,
);

const page = composeWatchPage(games);
const matchup = (g: WatchGame) => `${g.away.abbrev}@${g.home.abbrev}`;
const nflMnf = games.filter(
  (g) =>
    g.league === "NFL" &&
    ((g.away.abbrev === "ATL" && g.home.abbrev === "NO") || (g.away.abbrev === "NO" && g.home.abbrev === "ATL")),
);
const nhlGames = games.filter((g) => g.league === "NHL");
const nbaGames = games.filter((g) => g.league === "NBA");

const missing: string[] = [];
if (!nflMnf.length) missing.push("missing ATL@NO (MNF)");
if (nhlGames.length < 4) missing.push(`NHL games=${nhlGames.length} (want 4)`);
if (nbaGames.length < 1) missing.push("missing NBA games");
if (games.length > WATCH_PAGE_GAMES) missing.push(`cap broken: ${games.length} > ${WATCH_PAGE_GAMES}`);

const report = {
  day,
  fetched: {
    MLB: mlb.length,
    NFL: nfl.length,
    NHL: nhl.length,
    CFB: cfb.length,
    Soccer: soccer.length,
    NBA: nba.length,
    WNBA: wnba.length,
  },
  printed: games.length,
  blocks: page.blocks.map((b) => ({ id: b.id, listings: b.listings.length })),
  nflMnf: nflMnf.map(matchup),
  nhl: nhlGames.map(matchup),
  nba: nbaGames.map((g) => `${matchup(g)}${g.preseason ? " (preseason)" : ""}`),
  slate: games.map((g) => `${g.league} ${matchup(g)} heat=${g.heat} tv=${g.tv.join("/") || "—"}`),
  missing,
};

console.log(JSON.stringify(report, null, 2));
if (missing.length) {
  throw new Error(`watch desk live proof failed: ${missing.join("; ")}`);
}
console.log("times-watch live proof ok");
