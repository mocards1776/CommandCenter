/** One press hop in a fresh Deno process — same as one edge isolate. */
import { readFileSync, writeFileSync } from "node:fs";

function snap() {
  if (typeof Deno !== "undefined" && typeof Deno.cpuUsage === "function") return Deno.cpuUsage();
  return process.cpuUsage();
}
function cpuMs(from, to = snap()) {
  const user = (to.user ?? 0) - (from.user ?? 0);
  const system = (to.system ?? 0) - (from.system ?? 0);
  return Math.round(((user + system) / 1000) * 10) / 10;
}

const cpu0 = snap();
const wall0 = performance.now();
const {
  pressStep,
  deskFavorites,
  checkpointBag,
  slimPrintedQuery,
} = await import("file:///workspace/CommandCenter-main/supabase/functions/newspaper-press/compose.bundle.js");
const evalCpuMs = cpuMs(cpu0);
const evalWall = Math.round(performance.now() - wall0);

const parse0 = snap();
const input = JSON.parse(readFileSync(Deno.args[0] || "/tmp/tt-press/hop-in.json", "utf8"));
const parseCpuMs = cpuMs(parse0);
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
const stepCpu0 = snap();
const step = await pressStep(
  {
    pressId: input.pressId,
    day: input.day,
    favs,
    layout,
    userId: input.userId ?? null,
    readKeys: input.readKeys ?? [],
    carried: stageIn === 15 && !input.bag?.filed ? input.carried ?? [] : [],
    carriedMissouri: stageIn === 8 ? input.carriedMissouri ?? [] : [],
    editor: input.skipEditor
      ? undefined
      : async () => {
          throw new Error("local-editor-skip");
        },
  },
  input.bag,
);
const stepCpuMs = cpuMs(stepCpu0);
clearInterval(timer);
peak = Math.max(peak, rss());

const persistCpu0 = snap();
const flush = (step.flush ?? []).map(slimPrintedQuery);
const bag = step.done ? null : checkpointBag(step.bag);
const storyFlush = step.stories ?? [];
const storiesJson = storyFlush.length ? JSON.stringify(storyFlush) : "[]";
const bagJson = bag ? JSON.stringify(bag) : "null";
const flushJson = JSON.stringify(flush);
const persistCpuMs = cpuMs(persistCpu0);
const totalCpuMs = cpuMs(cpu0);

const out = {
  done: step.done,
  stageIn,
  stageOut: step.done ? "done" : step.bag.stage,
  flush: flush.length,
  bag,
  flushRows: flush,
  stories: storyFlush.length || (step.done ? (step.issue?.stories?.length ?? 0) : 0),
  storyBytes: storiesJson === "[]" ? 0 : storiesJson.length,
  bagBytes: bagJson === "null" ? 0 : bagJson.length,
  flushBytes: flushJson.length,
  baselineRssMb: baseline,
  rssMb: rss(),
  peakRssMb: peak,
  ms: Date.now() - t0,
  evalCpuMs,
  evalWallMs: evalWall,
  parseCpuMs,
  stepCpuMs,
  persistCpuMs,
  cpuMs: totalCpuMs,
};
writeFileSync(Deno.args[1] || "/tmp/tt-press/hop-out.json", JSON.stringify(out));
console.log(JSON.stringify({ ...out, bag: undefined, flushRows: undefined }));
