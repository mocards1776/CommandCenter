/**
 * Run with: node --experimental-strip-types src/lib/health-math.test.ts
 * from CommandCenter-main/.
 */
import {
  addDays,
  calorieBudget,
  chicagoDay,
  chicagoWallTimeToUtc,
  clockLabel,
  exerciseKcal,
  foodTotals,
  formatExerciseRow,
  netCalories,
  workoutGroups,
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

const withings = parseWithingsCsv(
  [
    'Date,"Weight (lb)","Fat mass (lb)","Bone mass (lb)","Muscle mass (lb)","Hydration (lb)",Comments',
    '"2026-04-22 07:41:27",180.1,40,7,120,90,',
    '"2026-04-22 13:19:38",179.4,39.5,7.1,121,91,',
    '"2026-08-18 09:26:36",173.8,37.3,6.8,129.6,92.8,',
  ].join("\n"),
);
assertEqual(withings.length, 2, "duplicate day collapses");
assertEqual(withings[0]?.day, "2026-04-22", "earlier day first");
assertEqual(withings[0]?.weightLb, 179.4, "later stamp wins");
assertEqual(withings[0]?.fat, 39.5, "fat mass header");
assertEqual(withings[1]?.weightLb, 173.8, "datetime day");

assertEqual(exerciseKcal([]), 0, "no workouts burn nothing");
assertEqual(exerciseKcal([{ kcal_burned: null }, { kcal_burned: 120 }, { kcal_burned: 80.5 }]), 200.5, "null kcal adds nothing");
assertEqual(netCalories(1515, 300), 1365, "food minus half of burn");
assertEqual(netCalories(1515, 0), 1515, "no exercise leaves food kcal");
assertEqual(netCalories(1515, 75), 1477.5, "half of an odd burn");
assertEqual(netCalories(0, 300), -150, "burn credit can exceed food");

assertEqual(
  formatExerciseRow({ time: "07:30:00", exercise: "Bench Press", sets: 3, reps: 10, weight_lb: 135, duration_min: null, kcal_burned: null }),
  "3×10 @ 135 lb",
  "multi-set row",
);
assertEqual(
  formatExerciseRow({ time: "07:30:00", exercise: "Bench Press", sets: 1, reps: 4, weight_lb: 170, duration_min: null, kcal_burned: null }),
  "4 @ 170 lb",
  "single weighted set",
);
assertEqual(
  formatExerciseRow({ time: "07:30:00", exercise: "Push-Up", sets: 1, reps: 25, weight_lb: 0, duration_min: null, kcal_burned: null }),
  "25",
  "bodyweight set omits weight",
);
assertEqual(
  formatExerciseRow({ time: "07:30:00", exercise: "Run", sets: null, reps: null, weight_lb: null, duration_min: 12.5, kcal_burned: 120 }),
  "12.5 min",
  "timed effort",
);

const groups = workoutGroups([
  { time: "17:34:36", exercise: "Bench Press", sets: 1, reps: 4, weight_lb: 170, duration_min: null, kcal_burned: null },
  { time: "17:35:35", exercise: "Bench Press", sets: 1, reps: 5, weight_lb: 170, duration_min: null, kcal_burned: null },
  { time: "21:35:00", exercise: "Push-Up", sets: null, reps: 20, weight_lb: 0, duration_min: null, kcal_burned: 20 },
  { time: "21:40:00", exercise: "Bench Press", sets: 2, reps: 5, weight_lb: 180, duration_min: null, kcal_burned: 30 },
]);
assertEqual(groups.length, 2, "two exercises");
assertEqual(groups[0]?.exercise, "Bench Press", "first appearance order");
assertEqual(groups[0]?.sets, 4, "sets sum, a row without sets counts one");
assertEqual(groups[0]?.kcal, 30, "group kcal only from rows that logged it");
assertEqual(groups[0]?.lines.join(" | "), "4 @ 170 lb | 5 @ 170 lb | 2×5 @ 180 lb", "set lines");
assertEqual(groups[1]?.sets, 1, "null sets counts one");
assertEqual(workoutGroups([]).length, 0, "empty day");
assertEqual(
  workoutGroups([{ time: "07:00:00", exercise: "Pull-Up", sets: 1, reps: 3, weight_lb: 0, duration_min: null, kcal_burned: null }])[0]?.kcal,
  null,
  "no kcal logged stays null",
);

assertEqual(clockLabel("17:34:36"), "5:34 PM", "afternoon");
assertEqual(clockLabel("00:05:00"), "12:05 AM", "midnight hour");
assertEqual(clockLabel("12:00:00"), "12:00 PM", "noon");
assertEqual(clockLabel("07:40"), "7:40 AM", "no seconds");

console.log("health-math tests ok");
