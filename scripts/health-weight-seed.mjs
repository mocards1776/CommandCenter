#!/usr/bin/env node
/**
 * Print SQL upserts for data/health/withings_weight.csv.
 * Columns: Date, Weight lb, Fat, Bone, Muscle, Hydration.
 *
 *   node scripts/health-weight-seed.mjs
 *   node scripts/health-weight-seed.mjs path/to/withings_weight.csv
 *
 * The 2026-10-14 anchor (175.0 lb) is already in
 * supabase/migrations/20261015_health.sql. Rows from the CSV upsert on
 * (user_id, weighed_on) for every profile. A CSV row on 2026-10-14 does not
 * replace the 175.0 anchor — that day is skipped here.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.argv[2] ?? "data/health/withings_weight.csv");
if (!existsSync(file)) {
  console.error(`No Withings CSV at ${file}`);
  process.exit(0);
}

const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const header = split(lines[0] ?? "").map((h) => h.trim().toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " "));
const at = (name) => header.findIndex((h) => h === name || h.startsWith(`${name} `));
const dateIdx = at("date");
const weightIdx = header.findIndex((h) => h === "weight lb" || h === "weight");
const fatIdx = at("fat");
const boneIdx = at("bone");
const muscleIdx = at("muscle");
const hydrationIdx = at("hydration");
if (dateIdx < 0 || weightIdx < 0) {
  console.error("CSV needs Date and Weight lb columns");
  process.exit(1);
}

const values = [];
for (const line of lines.slice(1)) {
  const cells = split(line);
  const day = dayOf(cells[dateIdx] ?? "");
  const weight = num(cells[weightIdx]);
  if (!day || weight == null) continue;
  if (day === "2026-10-14") continue;
  values.push(
    `(date '${day}', ${sqlNum(weight)}, ${sqlNum(cell(cells, fatIdx))}, ${sqlNum(cell(cells, boneIdx))}, ${sqlNum(cell(cells, muscleIdx))}, ${sqlNum(cell(cells, hydrationIdx))})`,
  );
}

if (!values.length) {
  console.error("CSV had no weigh-ins besides the 2026-10-14 anchor");
  process.exit(0);
}

console.log(`-- ${values.length} Withings rows from ${file}`);
console.log(`insert into public.health_weights (user_id, weighed_on, weight_lb, fat, bone, muscle, hydration)
select p.id, v.weighed_on, v.weight_lb, v.fat, v.bone, v.muscle, v.hydration
from public.profiles p
cross join (
  values
    ${values.join(",\n    ")}
) as v(weighed_on, weight_lb, fat, bone, muscle, hydration)
on conflict (user_id, weighed_on) do update
  set weight_lb = excluded.weight_lb,
      fat = excluded.fat,
      bone = excluded.bone,
      muscle = excluded.muscle,
      hydration = excluded.hydration;`);

function cell(cells, idx) {
  return idx >= 0 ? cells[idx] : "";
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
function dayOf(raw) {
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
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
