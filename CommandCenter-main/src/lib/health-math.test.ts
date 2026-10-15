/**
 * Run with: node --experimental-strip-types src/lib/health-math.test.ts
 * from CommandCenter-main/.
 */
import {
  addDays,
  calorieBudget,
  chicagoDay,
  chicagoWallTimeToUtc,
  foodTotals,
  goalWeightLb,
  parseWithingsCsv,
  proteinLeft,
  smoothWeights,
} from "./health-math.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

const totals = foodTotals([
  { kcal: 200, protein_g: 4 },
  { kcal: 200, protein_g: 4 },
  { kcal: 650, protein_g: 39 },
  { kcal: 185, protein_g: 2 },
  { kcal: 80, protein_g: 5 },
  { kcal: 200, protein_g: 4 },
]);
assertEqual(totals.kcal, 1515, "oct 14 kcal");
assertEqual(totals.protein, 58, "oct 14 protein");

const under = calorieBudget(1515);
assertEqual(under.leftToHigh, 385, "kcal left to 1900");
assertEqual(under.leftToLow, 335, "kcal left to 1850");
assertEqual(under.inBand, false, "1515 is under the band");
assertEqual(under.overHigh, 0, "not over");

const inside = calorieBudget(1875);
assertEqual(inside.inBand, true, "1875 is in band");
assertEqual(inside.leftToHigh, 25, "25 left in band");

const over = calorieBudget(1920);
assertEqual(over.overHigh, 20, "20 over the ceiling");
assertEqual(over.leftToHigh, -20, "signed left goes negative");

assertEqual(proteinLeft(58), 92, "protein left");
assertEqual(proteinLeft(160), -10, "protein over");

assertEqual(goalWeightLb("2026-10-14"), 175, "anchor weight");
assertEqual(goalWeightLb("2026-10-21"), 174, "one week later");
assertEqual(goalWeightLb("2026-10-07"), 176, "one week earlier");
assertEqual(addDays("2026-10-14", 7), "2026-10-21", "add a week");

const smooth = smoothWeights(
  [
    { day: "2026-10-01", lb: 180 },
    { day: "2026-10-08", lb: 190 },
    { day: "2026-10-15", lb: 180 },
  ],
  7,
);
assert(smooth.length === 3, "smooth length");
assert(smooth[1]! < 190 && smooth[1]! > 180, "spike is pulled down");
assertEqual(smoothWeights([{ day: "2026-10-14", lb: 175 }])[0], 175, "single point stays");

const morning = chicagoWallTimeToUtc("2026-10-14", "08:49");
assertEqual(morning.toISOString(), "2026-10-14T13:49:00.000Z", "8:49am CT is 13:49Z");
assertEqual(chicagoDay(morning), "2026-10-14", "morning stays on the 14th");

const evening = chicagoWallTimeToUtc("2026-10-14", "19:51");
assertEqual(evening.toISOString(), "2026-10-15T00:51:00.000Z", "7:51pm CT crosses UTC midnight");
assertEqual(chicagoDay(evening), "2026-10-14", "evening is still the Chicago 14th");

const csv = parseWithingsCsv(
  [
    "Date,Weight lb,Fat,Bone,Muscle,Hydration",
    "2026-10-01,180.2,40.1,8.2,120.4,55",
    "10/7/2026,178.5,,,,",
  ].join("\n"),
);
assertEqual(csv.length, 2, "two weigh-ins");
assertEqual(csv[0]?.day, "2026-10-01", "iso day");
assertEqual(csv[0]?.weightLb, 180.2, "weight");
assertEqual(csv[0]?.fat, 40.1, "fat");
assertEqual(csv[1]?.day, "2026-10-07", "us day");
assertEqual(csv[1]?.muscle, null, "blank muscle");

console.log("health-math tests ok");
