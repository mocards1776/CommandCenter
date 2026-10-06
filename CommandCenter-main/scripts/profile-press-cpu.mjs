/**
 * Isolated CPU of finalize hops against a real filed edition (morning size).
 * One Deno process per hop, including bundle eval + JSON parse/stringify.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const morningPath = "/tmp/tt-press/2026-10-05-morning.json";
const middayPath = "/tmp/tt-press/2026-10-05-midday.json";
const edition = JSON.parse(readFileSync(existsSync(morningPath) ? morningPath : middayPath, "utf8"));
const readKeys = existsSync("/tmp/tt-press/read-keys.json")
  ? JSON.parse(readFileSync("/tmp/tt-press/read-keys.json", "utf8"))
  : [];
const order = [
  "mlb-stl", "nhl-stl", "cfb-mizzou", "cfb-missouri-state", "cbb-mizzou", "cbb-missouri-state",
  "nfl-det", "nfl-kc", "nfl-dal", "nba-phi", "eng-wrexham", "eng-wolves", "eng-arsenal", "pga-tour",
];

function runHop(bag) {
  const input = {
    pressId: "2026-10-05-morning",
    day: "2026-10-05",
    order,
    hidden: [],
    bag,
    readKeys,
    carried: edition.stories,
    editor: false,
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
      { cwd: "/workspace/CommandCenter-main", env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("exit", (code) => {
      if (code !== 0) return reject(new Error(`hop failed ${code}: ${stderr.slice(-800)}`));
      resolve(JSON.parse(readFileSync("/tmp/tt-press/hop-out.json", "utf8")));
    });
  });
}

const startBag = { stage: 15, fresh: edition.stories, missouri: null };
const rows = [];
let bag = startBag;
let filed = 0;
for (let i = 0; i < 40; i++) {
  const out = await runHop(bag);
  filed += out.stories || 0;
  rows.push({
    hop: i + 1,
    stageIn: out.stageIn,
    stageOut: out.stageOut,
    done: out.done,
    stories: out.stories,
    bagBytes: out.bagBytes,
    storyBytes: out.storyBytes,
    evalCpuMs: out.evalCpuMs,
    stepCpuMs: out.stepCpuMs,
    persistCpuMs: out.persistCpuMs,
    cpuMs: out.cpuMs,
    peakRssMb: out.peakRssMb,
  });
  console.log(JSON.stringify(rows[rows.length - 1]));
  if (out.done) break;
  bag = out.bag;
}

const report = {
  edition: existsSync(morningPath) ? "2026-10-05-morning" : "2026-10-05-midday",
  fresh: edition.stories.length,
  filed,
  maxCpuMs: Math.max(...rows.map((r) => r.cpuMs)),
  rows,
};
writeFileSync("/tmp/tt-press/cpu-finalize.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
