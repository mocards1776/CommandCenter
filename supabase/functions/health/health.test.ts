/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/health/health.test.ts
 */
import {
  authorized,
  chicagoDay,
  chicagoWallTimeToUtc,
  parseIngest,
  pickHealthUserId,
  resolveIngestSecret,
  secretsMatch,
} from "./ingest.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

assert(secretsMatch("abc", "abc"), "same secret");
assert(!secretsMatch("abc", "abd"), "different secret");
assert(!secretsMatch("", "abc"), "empty secret rejected");
assert(!authorized({
  secretHeader: "nope",
  bearer: "nope",
  expectedSecret: "secret",
  serviceRoleKey: "service",
}), "bad token");
assert(authorized({
  secretHeader: "secret",
  bearer: "",
  expectedSecret: "secret",
  serviceRoleKey: "service",
}), "header secret");
assert(authorized({
  secretHeader: "",
  bearer: "service",
  expectedSecret: "secret",
  serviceRoleKey: "service",
}), "service role");
assertEqual(resolveIngestSecret("from-env", "from-table"), "from-env", "env secret wins");
assertEqual(resolveIngestSecret("  ", "from-table"), "from-table", "blank env falls back");
assertEqual(resolveIngestSecret("", null), "", "missing secret stays empty");

assertEqual(pickHealthUserId("user-1", []), "user-1", "pinned user");
assertEqual(pickHealthUserId(null, ["only"]), "only", "sole profile");
let threw = false;
try {
  pickHealthUserId(null, ["a", "b"]);
} catch {
  threw = true;
}
assert(threw, "ambiguous profiles throw");

const food = parseIngest({
  type: "food",
  date: "2026-10-14",
  time: "08:49",
  item: "crackers",
  kcal: 200,
  protein_g: 4,
  source_key: "seed-2026-10-14-0849-crackers",
});
assertEqual(food.foods.length, 1, "one food");
assertEqual(food.foods[0]?.logged_at, "2026-10-14T13:49:00.000Z", "chicago morning");
assertEqual(food.foods[0]?.log_date, "2026-10-14", "chicago day");
assertEqual(food.weights.length, 0, "no weights");

const evening = chicagoWallTimeToUtc("2026-10-14", "19:51");
assertEqual(chicagoDay(evening), "2026-10-14", "evening stays on the 14th");

const batch = parseIngest({
  foods: [{ logged_at: "2026-10-14T22:45:00-05:00", name: "burger", calories: "650", protein: 39 }],
  weights: [{ date: "2026-10-14", weight: 175, fat: null }],
});
assertEqual(batch.foods[0]?.item, "burger", "name alias");
assertEqual(batch.foods[0]?.kcal, 650, "calories alias");
assertEqual(batch.foods[0]?.log_date, "2026-10-14", "offset still chicago");
assertEqual(batch.weights[0]?.weight_lb, 175, "weight alias");
assertEqual(batch.weights[0]?.fat, null, "null fat");

let bad = false;
try {
  parseIngest({ type: "food", item: "x" });
} catch {
  bad = true;
}
assert(bad, "missing kcal rejected");

const lift = parseIngest({
  type: "exercise",
  date: "2026-10-16",
  time: "07:30",
  exercise: "Bench Press",
  sets: 3,
  reps: "10",
  weight_lb: 135,
  duration_min: 12.5,
  kcal_burned: 90,
  note: "felt strong",
});
assertEqual(lift.exercises.length, 1, "one exercise");
assertEqual(lift.foods.length, 0, "exercise adds no food");
assertEqual(lift.weights.length, 0, "exercise adds no weight");
assertEqual(lift.exercises[0]?.date, "2026-10-16", "exercise date");
assertEqual(lift.exercises[0]?.time, "07:30:00", "exercise time gets seconds");
assertEqual(lift.exercises[0]?.sets, 3, "sets");
assertEqual(lift.exercises[0]?.reps, 10, "reps from string");
assertEqual(lift.exercises[0]?.weight_lb, 135, "weight_lb");
assertEqual(lift.exercises[0]?.duration_min, 12.5, "duration_min");
assertEqual(lift.exercises[0]?.kcal_burned, 90, "kcal_burned");
assertEqual(lift.exercises[0]?.note, "felt strong", "note");

const minimal = parseIngest({ type: "exercise", date: "2026-10-16", exercise: "Push-Up", reps: 25 });
assertEqual(minimal.exercises[0]?.time, "12:00:00", "time defaults to noon like food");
assertEqual(minimal.exercises[0]?.sets, null, "sets optional");
assertEqual(minimal.exercises[0]?.weight_lb, null, "weight optional");
assertEqual(minimal.exercises[0]?.kcal_burned, null, "kcal optional");
assertEqual(minimal.exercises[0]?.note, null, "note optional");

const stamped = parseIngest({
  type: "workout",
  logged_at: "2026-10-17T01:15:30Z",
  name: "Pull-Up",
  reps: 5,
  kcal: 20,
});
assertEqual(stamped.exercises[0]?.date, "2026-10-16", "logged_at lands on the Chicago day");
assertEqual(stamped.exercises[0]?.time, "20:15:30", "logged_at lands on Chicago wall time");
assertEqual(stamped.exercises[0]?.exercise, "Pull-Up", "name alias");
assertEqual(stamped.exercises[0]?.kcal_burned, 20, "kcal alias");

const mixed = parseIngest({
  foods: [{ date: "2026-10-16", item: "crackers", kcal: 200, protein_g: 4 }],
  exercises: [
    { date: "2026-10-16", time: "06:00", exercise: "Dumbbell Curls", sets: 2, reps: 15, weight_lb: 20 },
    { date: "2026-10-16", time: "06:10", exercise: "Push-Up", reps: 25 },
  ],
});
assertEqual(mixed.foods.length, 1, "batch food unchanged");
assertEqual(mixed.exercises.length, 2, "batch exercises");

for (const [label, body] of [
  ["missing exercise", { type: "exercise", date: "2026-10-16", reps: 5 }],
  ["missing date", { type: "exercise", exercise: "Push-Up", reps: 5 }],
  ["bad date", { type: "exercise", date: "2026-02-30", exercise: "Push-Up" }],
  ["bad time", { type: "exercise", date: "2026-10-16", time: "25:00", exercise: "Push-Up" }],
  ["fractional reps", { type: "exercise", date: "2026-10-16", exercise: "Push-Up", reps: 2.5 }],
  ["negative kcal", { type: "exercise", date: "2026-10-16", exercise: "Push-Up", kcal_burned: -1 }],
  ["zero sets", { type: "exercise", date: "2026-10-16", exercise: "Push-Up", sets: 0 }],
  ["non-numeric weight", { type: "exercise", date: "2026-10-16", exercise: "Push-Up", weight_lb: "heavy" }],
  ["empty exercises array", { exercises: [] }],
  ["unknown type", { type: "run", date: "2026-10-16" }],
] as const) {
  let rejected = false;
  try {
    parseIngest(body);
  } catch {
    rejected = true;
  }
  assert(rejected, `${label} rejected`);
}

const many = Array.from({ length: 201 }, (_, i) => ({
  date: "2026-10-16",
  time: `${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`,
  exercise: "Push-Up",
}));
let capped = false;
try {
  parseIngest({ exercises: many });
} catch {
  capped = true;
}
assert(capped, "more than 200 rows rejected");

console.log("health ingest tests ok");
