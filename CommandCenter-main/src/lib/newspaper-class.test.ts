/**
 * Run with: node --experimental-strip-types src/lib/newspaper-class.test.ts
 */
import { asClassNewsletter, classBoxFor } from "./newspaper-class.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const row = asClassNewsletter({
  week_of: "2026-10-06",
  teacher: "Mrs. Butler",
  learning: [
    { subject: "Reading", text: "The moral of Big Al." },
    { subject: "Lunch", text: "Pizza day" },
  ],
  reminders: ["Water bottle and morning snack daily.", "Classroom Fridge photos welcome."],
  upcoming: [
    { date: "2026-10-16", text: "Museum" },
    { date: "2026-10-20", text: "Conferences" },
    { date: "2026-10-27", text: "Red Ribbon Week" },
    { date: "2026-10-30", text: "Fall Party" },
  ],
});

const thursday = classBoxFor(row, "2026-10-08", ["Pizza day"]);
assert(thursday?.teacher === "Mrs. Butler", "Thursday of the school week prints the box");
assert(thursday?.learning.length === 1 && thursday.learning[0]?.subject === "Reading", "a daily special already on the timetable is left out");
assert(thursday?.reminders === "Water bottle and morning snack daily. · Classroom Fridge photos welcome.", "reminders share one line");
assert(thursday?.upcoming.map((item) => item.date).join() === "2026-10-16,2026-10-20", "only upcoming dates inside 14 days, and at most three");
assert(classBoxFor(row, "2026-10-05")?.teacher === "Mrs. Butler", "Monday of that week prints");
assert(classBoxFor(row, "2026-10-09")?.teacher === "Mrs. Butler", "Friday still prints");
assert(classBoxFor(row, "2026-10-10") === null, "Saturday is outside the box");
assert(classBoxFor(row, "2026-10-13") === null, "the next week waits for its own row");
assert(asClassNewsletter(null) === null, "a missing row is null");

console.log("newspaper-class ok");
