/**
 * Local Deno press: every hop of pressStep against real 2026-10-05-evening inputs.
 * Does not write to Supabase.
 *
 *   deno run --allow-read --allow-net --allow-env --allow-sys --allow-write \
 *     scripts/run-newspaper-press-local.mjs
 */
import { pressStep, deskFavorites, checkpointBag } from "file:///workspace/CommandCenter-main/supabase/functions/newspaper-press/compose.bundle.js";
import { readFileSync, writeFileSync } from "node:fs";

const EDGE_LIMIT_MB = 150;
const pressId = "2026-10-05-evening";
const day = "2026-10-05";
const order = [
  "mlb-stl", "nhl-stl", "cfb-mizzou", "cfb-missouri-state", "cbb-mizzou", "cbb-missouri-state",
  "nfl-det", "nfl-kc", "nfl-dal", "nba-phi", "eng-wrexham", "eng-wolves", "eng-arsenal", "pga-tour",
];

const midday = JSON.parse(readFileSync("/tmp/tt-press/2026-10-05-midday.json", "utf8"));
const readKeys = JSON.parse(readFileSync("/tmp/tt-press/read-keys.json", "utf8"));
const favs = deskFavorites(order, []);
const layout = { order, hidden: [], pinnedPlayers: [] };
const carried = midday.stories;
const carriedMissouri =
  midday.queries.find((q) => q.key[1] === "tt-missouri")?.data?.items ?? [];

function rss() {
  return Math.round((Deno.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

const rows = [];
let bag = null;
let hop = 0;
const queries = [];
const t0 = Date.now();

for (;;) {
  hop += 1;
  const stageIn = typeof bag?.stage === "number" ? bag.stage : 0;
  const before = rss();
  let peak = before;
  const timer = setInterval(() => {
    peak = Math.max(peak, rss());
  }, 25);
  const started = Date.now();
  const step = await pressStep(
    {
      pressId,
      day,
      favs,
      layout,
      userId: null,
      readKeys,
      carried: stageIn >= 15 ? carried : [],
      carriedMissouri: stageIn === 8 ? carriedMissouri : [],
    },
    bag,
  );
  clearInterval(timer);
  peak = Math.max(peak, rss());
  if (step.flush?.length) queries.push(...step.flush);
  const slim = step.done ? null : checkpointBag(step.bag);
  const row = {
    hop,
    stageIn,
    stageOut: step.done ? "done" : step.bag.stage,
    done: step.done,
    flush: step.flush?.length ?? 0,
    queries: queries.length,
    bagBytes: slim ? JSON.stringify(slim).length : 0,
    stories: step.done ? step.issue.stories.length : 0,
    rssMb: rss(),
    peakRssMb: peak,
    ms: Date.now() - started,
  };
  rows.push(row);
  console.log(JSON.stringify(row));
  if (step.done) {
    const report = {
      pressId,
      edgeLimitMb: EDGE_LIMIT_MB,
      totalMs: Date.now() - t0,
      stories: step.issue.stories.length,
      queries: queries.length,
      maxPeakRssMb: Math.max(...rows.map((r) => r.peakRssMb)),
      rows,
    };
    writeFileSync("/tmp/tt-press/memory-live.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    break;
  }
  bag = slim;
}
