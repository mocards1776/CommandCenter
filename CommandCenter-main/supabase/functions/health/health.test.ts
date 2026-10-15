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

console.log("health ingest tests ok");
