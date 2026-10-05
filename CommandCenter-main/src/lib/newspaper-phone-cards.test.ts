/**
 * Run with: node --experimental-strip-types src/lib/newspaper-phone-cards.test.ts
 * from CommandCenter-main/.
 */
import {
  isPhoneCardKind,
  phoneCardDate,
  phoneCardEditionLabel,
  sampleDaySchedule,
  sampleWatchGames,
} from "./newspaper-phone-cards.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(isPhoneCardKind("front") && isPhoneCardKind("weather") && isPhoneCardKind("day") && isPhoneCardKind("watch"), "known cards");
assert(!isPhoneCardKind("a1") && !isPhoneCardKind(""), "unknown cards are rejected");
assert(phoneCardDate("2026-10-05-evening") === "2026-10-05", "issue id yields its Central date");
assert(phoneCardDate("nonsense") === new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }), "bad id falls back to today");
assert(phoneCardEditionLabel("2026-10-05-morning") === "Morning Edition", "morning label");
assert(phoneCardEditionLabel("2026-10-05-midday") === "Midday Edition", "midday label");
assert(phoneCardEditionLabel("2026-10-05-evening") === "Evening Edition", "evening label");
assert(phoneCardEditionLabel("") === "Edition", "missing issue is a generic edition");

const day = sampleDaySchedule("2026-10-05");
assert(day.date === "2026-10-05" && day.events.length >= 4, "sample day has events");
assert(day.events.some((e) => e.kind === "work") && day.events.some((e) => e.kind === "family"), "sample mixes work and family");
assert((day.upcoming ?? []).length === 5 && day.upcoming?.[0]?.date === "2026-10-06", "sample Coming Up is the next five days");

const watch = sampleWatchGames();
assert(watch.length >= 3 && watch[0]!.heat >= watch[1]!.heat, "sample watch is hottest first");
assert(watch.every((g) => g.away.abbrev && g.home.abbrev), "sample games have both clubs");

console.log("newspaper-phone-cards ok");
