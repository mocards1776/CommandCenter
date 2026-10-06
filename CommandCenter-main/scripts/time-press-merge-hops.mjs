/**
 * Stage 11 + 14 pressStep hops on a morning-sized in-memory slate.
 * Run from CommandCenter-main after bundling: node scripts/time-press-merge-hops.mjs
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

globalThis.__TT_ENV = { url: "http://localhost", key: "anon" };
const bundleUrl = pathToFileURL(path.resolve("supabase/functions/newspaper-press/compose.bundle.js")).href;
const { pressStep, deskFavorites, checkpointBag, hopSignature } = await import(bundleUrl);

function card(partial) {
  return {
    favoriteKey: "",
    teamName: "",
    teamHref: "/",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
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

function bodyFor(name, n) {
  return `${name} won in a late drive. The bench emptied after a long night of football. `.repeat(n * 8);
}

function buildSlate() {
  const clubCopy = [];
  const leagueNews = [];
  const athletic = [];
  const games = [];
  let event = 401770000;
  const rows = [
    ["football/nfl", "NFL", "Chiefs", "Raiders", "KC", "LV", "nfl-kc"],
    ["football/nfl", "NFL", "Lions", "Cowboys", "DET", "DAL", "nfl-det"],
    ["football/nfl", "NFL", "Eagles", "Giants", "PHI", "NYG", ""],
    ["football/nfl", "NFL", "Packers", "Bears", "GB", "CHI", ""],
    ["football/nfl", "NFL", "Bills", "Jets", "BUF", "NYJ", ""],
    ["baseball/mlb", "MLB", "Cardinals", "Cubs", "STL", "CHC", "mlb-stl"],
    ["baseball/mlb", "MLB", "Dodgers", "Brewers", "LAD", "MIL", ""],
    ["hockey/nhl", "NHL", "Blues", "Blackhawks", "STL", "CHI", "nhl-stl"],
    ["football/college-football", "CFB", "Missouri", "Florida", "MIZ", "FLA", "cfb-mizzou"],
    ["football/college-football", "CFB", "Georgia", "Alabama", "UGA", "ALA", ""],
  ];
  for (const [leaguePath, sportLabel, away, home, awayAb, homeAb, fav] of rows) {
    event += 1;
    const gameId = String(event);
    const score = `${awayAb} 27  ·  ${homeAb} 24`;
    const headline = `${away} beat ${home}`;
    clubCopy.push(
      card({
        id: `wire-${sportLabel.toLowerCase()}-${gameId}`,
        headline,
        scoreLine: score,
        gameId,
        leaguePath,
        sportLabel,
        favoriteKey: fav,
        followed: Boolean(fav),
        teamName: fav ? away : "",
        wrapKind: "espn",
        status: "Final",
        body: bodyFor(away, 12),
        wrapHref: `https://www.espn.com/${sportLabel.toLowerCase()}/recap/_/gameId/${gameId}`,
      }),
    );
    clubCopy.push(
      card({
        id: `recap-${sportLabel.toLowerCase()}-${gameId}-box`,
        headline: `${away} ${home} box`,
        scoreLine: score,
        gameId,
        leaguePath,
        sportLabel,
        wrapKind: "box",
        status: "Final",
        body: bodyFor(home, 6),
      }),
    );
    leagueNews.push(
      card({
        id: `athletic-${sportLabel.toLowerCase()}-${gameId}`,
        headline: `What the ${away}-${home} tape said`,
        caption: "The Athletic",
        gameId,
        leaguePath,
        sportLabel,
        wrapHref: `https://www.nytimes.com/athletic/${gameId}`,
        body: bodyFor(away, 8),
      }),
    );
    games.push({
      id: gameId,
      eventId: gameId,
      path: leaguePath,
      league: sportLabel,
      sportLabel,
      final: true,
      live: false,
      statusDetail: "Final",
      startedAt: "2026-10-05T17:00:00Z",
      day: "2026-10-05",
      away: { id: null, name: away, short: away, abbrev: awayAb, score: "27", record: "4-1", winner: true, logo: null, color: null, seed: null },
      home: { id: null, name: home, short: home, abbrev: homeAb, score: "24", record: "3-2", winner: false, logo: null, color: null, seed: null },
      headline,
      body: bodyFor(away, 4),
      dateline: "KANSAS CITY",
      photo: null,
      href: `https://www.espn.com/game/_/gameId/${gameId}`,
      leaders: [],
      favoriteKeys: fav ? [fav] : [],
      wrapKind: "espn",
      round: null,
      series: null,
      postseason: false,
      preseason: false,
    });
  }
  for (let i = 0; i < 90; i++) {
    clubCopy.push(
      card({
        id: `news-unique-${i}`,
        headline: `Desk brief ${i} on the waiver wire and the trade market`,
        leaguePath: "football/nfl",
        sportLabel: "NFL",
        body: bodyFor(`brief${i}`, 3),
      }),
    );
  }
  for (let i = 0; i < 100; i++) {
    leagueNews.push(
      card({
        id: `league-nfl-${i}`,
        headline: i % 11 === 0 ? `Arsenal notebook ${i}` : `League notebook ${i} around the NFL`,
        leaguePath: "football/nfl",
        sportLabel: "NFL",
        dek: i % 7 === 0 ? "Chiefs stay in the mix" : null,
        body: bodyFor("notebook", 4),
      }),
    );
  }
  for (let i = 0; i < 20; i++) {
    athletic.push(
      card({
        id: `athletic-extra-${i}`,
        headline: `The Athletic extra ${i} on the Cardinals`,
        caption: "The Athletic",
        leaguePath: "baseball/mlb",
        sportLabel: "MLB",
        wrapHref: `https://www.nytimes.com/athletic/extra-${i}`,
        body: bodyFor("Cardinals", 7),
      }),
    );
  }
  return { clubCopy, leagueNews, athletic, games };
}

const slate = buildSlate();
const order = [
  "mlb-stl", "nhl-stl", "cfb-mizzou", "cfb-missouri-state", "cbb-mizzou", "cbb-missouri-state",
  "nfl-det", "nfl-kc", "nfl-dal", "nba-phi", "eng-wrexham", "eng-wolves", "eng-arsenal", "pga-tour",
];
const favs = deskFavorites(order, []);
const layout = { order, hidden: [], pinnedPlayers: [] };

async function runFrom(bag, untilStage) {
  const rows = [];
  let current = bag;
  for (let i = 0; i < 80; i++) {
    const started = Date.now();
    const cpu0 = process.cpuUsage();
    const step = await pressStep(
      { pressId: "2026-10-06-morning", day: "2026-10-06", favs, layout, userId: null },
      current,
    );
    const cpu = process.cpuUsage(cpu0);
    const next = step.done ? null : checkpointBag(step.bag);
    const row = {
      hop: i + 1,
      stageIn: current?.stage ?? 0,
      stageOut: step.done ? "done" : step.bag.stage,
      cursor: hopSignature(current),
      bagBytes: next ? JSON.stringify(next).length : 0,
      flush: step.flush?.length ?? 0,
      stories: step.stories?.length ?? 0,
      elapsedMs: Date.now() - started,
      cpuMs: Math.round((cpu.user + cpu.system) / 1000),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
    if (step.done) break;
    if (typeof untilStage === "number" && step.bag.stage >= untilStage) break;
    current = next;
  }
  return rows;
}

const fat = {
  stage: 11,
  leagueCursor: 99,
  paths: ["football/nfl", "baseball/mlb", "hockey/nhl", "football/college-football"],
  pathKey: "baseball/mlb|football/college-football|football/nfl|hockey/nhl",
  clubCopy: slate.clubCopy,
  leagueNews: slate.leagueNews,
  athletic: slate.athletic,
  wireGames: slate.games,
  teamCards: slate.clubCopy.filter((c) => c.wrapKind),
};
const fatJson = JSON.stringify(fat);
console.log(JSON.stringify({ fatBagBytes: fatJson.length, clubCopy: slate.clubCopy.length, leagueNews: slate.leagueNews.length }));
console.log("=== stage 11 merge hops ===");
const mergeRows = [];
let bag = JSON.parse(fatJson);
for (let i = 0; i < 80; i++) {
  const started = Date.now();
  const cpu0 = process.cpuUsage();
  const step = await pressStep(
    { pressId: "2026-10-06-morning", day: "2026-10-06", favs, layout, userId: null },
    bag,
  );
  const cpu = process.cpuUsage(cpu0);
  const next = step.done ? null : checkpointBag(step.bag);
  const row = {
    hop: i + 1,
    stageIn: bag?.stage ?? 0,
    stageOut: step.done ? "done" : step.bag.stage,
    cursor: hopSignature(bag),
    bagBytes: next ? JSON.stringify(next).length : 0,
    flush: step.flush?.length ?? 0,
    elapsedMs: Date.now() - started,
    cpuMs: Math.round((cpu.user + cpu.system) / 1000),
  };
  mergeRows.push(row);
  console.log(JSON.stringify(row));
  if (step.done || step.bag.stage >= 12) {
    bag = next;
    break;
  }
  bag = next;
}
const filed = bag?.raw ?? [];
console.log("=== stage 14 filing hops ===");
const fileRows = await runFrom(
  { stage: 14, raw: filed, extractUrls: [], extracts: {}, extractFileCursor: 0, fresh: [] },
  15,
);
const all = [...mergeRows, ...fileRows];
const report = {
  fatBagBytes: fatJson.length,
  filed: filed.length,
  maxElapsedMs: Math.max(...all.map((r) => r.elapsedMs)),
  maxCpuMs: Math.max(...all.map((r) => r.cpuMs)),
  mergeHops: mergeRows,
  fileHops: fileRows,
};
console.log(JSON.stringify(report, null, 2));
