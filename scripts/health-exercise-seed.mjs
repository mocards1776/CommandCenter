#!/usr/bin/env node
/**
 * Print an idempotent SQL import for data/health/exercise_log.csv.
 * Columns: Exercise, Date, Repetitions, Weight (lb), Weight (kg),
 * Duration (seconds), Duration (formatted), Note, Label.
 *
 *   node scripts/health-exercise-seed.mjs
 *   node scripts/health-exercise-seed.mjs path/to/exercise_log.csv
 *
 * Each CSV row is one set: sets = 1, reps = Repetitions. The Date cell has no
 * zone and is read as America/Chicago wall clock. Weight (kg) is ignored; the
 * lb column is the source of truth. Rows insert for every profile and skip
 * on conflict (user_id, date, time, exercise), so a re-run adds nothing.
 * Rows that repeat a key inside the file are collapsed (first one wins) and
 * counted on stderr.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.argv[2] ?? "data/health/exercise_log.csv");
if (!existsSync(file)) {
  console.error(`No exercise CSV at ${file}`);
  process.exit(1);
}

const lines = readFileSync(file, "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .filter((l) => l.trim());
const header = split(lines[0] ?? "").map(normalize);
const at = (name) => header.findIndex((h) => h === name || h.startsWith(`${name} `));
const exIdx = at("exercise");
const dateIdx = at("date");
const repsIdx = at("repetitions");
const lbIdx = header.findIndex((h) => h === "weight lb");
const secIdx = header.findIndex((h) => h === "duration seconds");
const noteIdx = at("note");
if (exIdx < 0 || dateIdx < 0 || lbIdx < 0) {
  console.error("CSV needs Exercise, Date, and Weight (lb) columns");
  process.exit(1);
}

const seen = new Set();
const values = [];
let skippedBlank = 0;
let skippedDupes = 0;
for (const line of lines.slice(1)) {
  const cells = split(line);
  const exercise = (cells[exIdx] ?? "").trim();
  const stamp = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec((cells[dateIdx] ?? "").trim());
  if (!exercise || !stamp) {
    skippedBlank++;
    continue;
  }
  const day = stamp[1];
  const time = `${stamp[2]}:${stamp[3] ?? "00"}`;
  const key = `${day}|${time}|${exercise}`;
  if (seen.has(key)) {
    skippedDupes++;
    continue;
  }
  seen.add(key);
  const reps = num(cells[repsIdx]);
  const lb = num(cells[lbIdx]);
  const seconds = secIdx >= 0 ? num(cells[secIdx]) : null;
  const note = noteIdx >= 0 ? (cells[noteIdx] ?? "").trim() : "";
  values.push(
    `(date '${day}', time '${time}', ${sqlText(exercise)}, 1, ${sqlInt(reps)}, ${sqlNum(lb)}, ${seconds == null ? "null::numeric" : sqlNum(Math.round((seconds / 60) * 100) / 100)}, ${note ? sqlText(note) : "null::text"})`,
  );
}

console.error(`${values.length} rows to import, ${skippedDupes} repeated keys, ${skippedBlank} unreadable rows`);
if (!values.length) process.exit(0);

console.log(`-- ${values.length} exercise sets from ${file}`);
console.log(`insert into public.health_exercise_log (user_id, date, time, exercise, sets, reps, weight_lb, duration_min, note)
select p.id, v.date, v.time, v.exercise, v.sets, v.reps, v.weight_lb, v.duration_min, v.note
from public.profiles p
cross join (
  values
    ${values.join(",\n    ")}
) as v(date, time, exercise, sets, reps, weight_lb, duration_min, note)
on conflict (user_id, date, time, exercise) do nothing;`);

function normalize(cell) {
  return cell.trim().toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}
function num(raw) {
  const text = (raw ?? "").trim();
  if (!text || text === "-") return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
function sqlNum(n) {
  return n == null ? "null::numeric" : String(n);
}
function sqlInt(n) {
  return n == null ? "null::int" : String(Math.round(n));
}
function sqlText(s) {
  return `'${s.replace(/'/g, "''")}'`;
}
function split(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
