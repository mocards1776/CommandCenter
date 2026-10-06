/** One press hop in a fresh Deno process — same as one edge isolate. */
import { pressStep, deskFavorites, checkpointBag, slimPrintedQuery } from "file:///workspace/CommandCenter-main/supabase/functions/newspaper-press/compose.bundle.js";
import { readFileSync, writeFileSync } from "node:fs";

const input = JSON.parse(readFileSync(Deno.args[0] || "/tmp/tt-press/hop-in.json", "utf8"));
const order = input.order;
const favs = deskFavorites(order, input.hidden ?? []);
const layout = { order, hidden: input.hidden ?? [], pinnedPlayers: [] };
const stageIn = typeof input.bag?.stage === "number" ? input.bag.stage : 0;

function rss() {
  return Math.round((Deno.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

const baseline = rss();
let peak = baseline;
const timer = setInterval(() => {
  peak = Math.max(peak, rss());
}, 20);
const t0 = Date.now();
const step = await pressStep(
  {
    pressId: input.pressId,
    day: input.day,
    favs,
    layout,
    userId: input.userId ?? null,
    readKeys: input.readKeys ?? [],
    carried: stageIn >= 15 ? input.carried ?? [] : [],
    carriedMissouri: stageIn === 8 ? input.carriedMissouri ?? [] : [],
  },
  input.bag,
);
clearInterval(timer);
peak = Math.max(peak, rss());

const flush = (step.flush ?? []).map(slimPrintedQuery);
const bag = step.done ? null : checkpointBag(step.bag);
const stories = step.done ? JSON.stringify(step.issue.stories) : null;
const out = {
  done: step.done,
  stageIn,
  stageOut: step.done ? "done" : step.bag.stage,
  flush: flush.length,
  bag,
  flushRows: flush,
  stories: step.done ? step.issue.stories.length : 0,
  storyBytes: stories ? stories.length : 0,
  bagBytes: bag ? JSON.stringify(bag).length : 0,
  flushBytes: JSON.stringify(flush).length,
  baselineRssMb: baseline,
  rssMb: rss(),
  peakRssMb: peak,
  ms: Date.now() - t0,
};
writeFileSync(Deno.args[1] || "/tmp/tt-press/hop-out.json", JSON.stringify(out));
console.log(JSON.stringify({ ...out, bag: undefined, flushRows: undefined }));
