/**
 * Full press, one fresh Deno isolate per hop (mirrors the edge worker).
 */
import { spawn } from "node:child_process";
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
const carriedMissouri = midday.queries.find((q) => q.key[1] === "tt-missouri")?.data?.items ?? [];

function runHop(bag) {
  const input = {
    pressId,
    day,
    order,
    hidden: [],
    bag,
    readKeys,
    carried: midday.stories,
    carriedMissouri,
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
const t0 = Date.now();
for (;;) {
  hop += 1;
  const out = await runHop(bag);
  desks += out.flush;
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
  };
  rows.push(row);
  console.log("HOP", JSON.stringify(row));
  if (out.done) {
    const report = {
      pressId,
      edgeLimitMb: EDGE_LIMIT_MB,
      totalMs: Date.now() - t0,
      hops: hop,
      stories: out.stories,
      desks,
      maxPeakRssMb: Math.max(...rows.map((r) => r.peakRssMb)),
      finalizePeakRssMb: rows[rows.length - 1]?.peakRssMb,
      rows,
    };
    writeFileSync("/tmp/tt-press/memory-live-isolates.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    break;
  }
  bag = out.bag;
}
