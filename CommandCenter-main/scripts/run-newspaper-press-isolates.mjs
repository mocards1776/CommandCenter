/**
 * Full press, one fresh Deno isolate per hop (mirrors the edge worker).
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const EDGE_LIMIT_MB = 150;
const EDGE_CPU_MS = 2000;
const TARGET_CPU_MS = 1200;
const pressId = "2026-10-05-evening";
const day = "2026-10-05";
const order = [
  "mlb-stl", "nhl-stl", "cfb-mizzou", "cfb-missouri-state", "cbb-mizzou", "cbb-missouri-state",
  "nfl-det", "nfl-kc", "nfl-dal", "nba-phi", "eng-wrexham", "eng-wolves", "eng-arsenal", "pga-tour",
];
const morningPath = "/tmp/tt-press/2026-10-05-morning.json";
const middayPath = "/tmp/tt-press/2026-10-05-midday.json";
const prior = JSON.parse(readFileSync(existsSync(morningPath) ? morningPath : middayPath, "utf8"));
const readKeys = JSON.parse(readFileSync("/tmp/tt-press/read-keys.json", "utf8"));
const carriedMissouri = prior.queries.find((q) => q.key[1] === "tt-missouri")?.data?.items ?? [];

function runHop(bag) {
  const input = {
    pressId,
    day,
    order,
    hidden: [],
    bag,
    readKeys,
    carried: prior.stories,
    carriedMissouri,
    skipEditor: false,
  };
  writeFileSync("/tmp/tt-press/hop-in.json", JSON.stringify(input));
  return new Promise((resolve, reject) => {
    const child = spawn(
      "/home/ubuntu/.deno/bin/deno",
      [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-net",
        "--allow-env",
        "--allow-sys",
        "scripts/press-hop-worker.mjs",
        "/tmp/tt-press/hop-in.json",
        "/tmp/tt-press/hop-out.json",
      ],
      {
        cwd: "/workspace/CommandCenter-main",
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.stdout.on("data", (d) => {
      process.stdout.write(d);
    });
    child.on("exit", (code) => {
      if (code !== 0) return reject(new Error(`hop failed ${code}: ${stderr.slice(-800)}`));
      resolve(JSON.parse(readFileSync("/tmp/tt-press/hop-out.json", "utf8")));
    });
  });
}

const rows = [];
let bag = null;
let hop = 0;
let desks = 0;
let filedStories = 0;
const t0 = Date.now();
for (;;) {
  hop += 1;
  const out = await runHop(bag);
  desks += out.flush;
  if (out.stageIn === 18 || out.stageOut === 18 || out.stageOut === 19) filedStories += out.stories;
  const row = {
    hop,
    stageIn: out.stageIn,
    stageOut: out.stageOut,
    done: out.done,
    flush: out.flush,
    desks,
    bagBytes: out.bagBytes,
    flushBytes: out.flushBytes,
    stories: out.stories,
    baselineRssMb: out.baselineRssMb,
    peakRssMb: out.peakRssMb,
    rssMb: out.rssMb,
    ms: out.ms,
    evalCpuMs: out.evalCpuMs,
    stepCpuMs: out.stepCpuMs,
    persistCpuMs: out.persistCpuMs,
    cpuMs: out.cpuMs,
  };
  rows.push(row);
  console.log("HOP", JSON.stringify(row));
  if (out.done) {
    const report = {
      pressId,
      edgeLimitMb: EDGE_LIMIT_MB,
      edgeCpuMs: EDGE_CPU_MS,
      targetCpuMs: TARGET_CPU_MS,
      carriedStories: prior.stories?.length ?? 0,
      totalMs: Date.now() - t0,
      hops: hop,
      stories: filedStories || out.stories,
      desks,
      maxPeakRssMb: Math.max(...rows.map((r) => r.peakRssMb)),
      maxCpuMs: Math.max(...rows.map((r) => r.cpuMs)),
      finalizeCpuMs: rows.filter((r) => r.stageIn >= 15).map((r) => r.cpuMs),
      stage10CpuMs: rows.filter((r) => r.stageIn === 10).map((r) => r.cpuMs),
      rows,
    };
    writeFileSync("/tmp/tt-press/cpu-live-isolates.json", JSON.stringify(report, null, 2));
    writeFileSync("/tmp/tt-press/memory-live-isolates.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
    break;
  }
  bag = out.bag;
}
