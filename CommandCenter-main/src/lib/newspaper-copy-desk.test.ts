/**
 * Run with: node --experimental-strip-types src/lib/newspaper-copy-desk.test.ts
 */
import { applyRaceCopy, applyWatchWhy, clipDek, parseTimesCopy, watchForCopy } from "./newspaper-copy-desk.ts";
import { watchContext, type WatchGame } from "./newspaper-watch-page.ts";
import type { RaceBriefsDesk } from "./newspaper-races.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const parsed = parseTimesCopy({
  races: [{ race: "sd 8", headline: "Air war", copy: "Two groups are buying. Spend is partial." }],
  watch: [{ id: "g1", why: "A division game with the series tied." }],
  deks: [
    { id: "a", dek: "One short dek under the lead." },
    { id: "b", dek: "word ".repeat(30) },
  ],
});
assert(parsed?.races[0]?.race === "SD8", "race codes fold");
assert(parsed?.watch[0]?.why.startsWith("A division"), "watch why kept");
assert(parsed?.deks.length === 1 && parsed.deks[0]!.id === "a", "a dek past about 20 words is dropped");
assert(clipDek("word ".repeat(30)) === "", "clipDek enforces the word cap");
assert(parseTimesCopy({ races: [], watch: [], deks: [] }) === null, "an empty answer files nothing");

const desk: RaceBriefsDesk = {
  editionDate: "2026-10-08",
  briefDate: "2026-10-08",
  stale: false,
  races: [
    {
      race: "SD8",
      headline: "Old",
      bullets: ["Kept if copy is missing"],
      spend: [],
      links: [],
      notes: [],
      source: null,
      updated_at: null,
    },
  ],
};
const withCopy = applyRaceCopy(desk, parsed);
assert(withCopy?.races[0]?.headline === "Air war" && withCopy.races[0]?.copy?.includes("partial"), "copy replaces the race headline");
assert(applyRaceCopy(desk, null)?.races[0]?.headline === "Old", "no copy leaves the filed headline");

const game = {
  id: "g1",
  league: "NFL",
  competition: null,
  away: { name: "Lions", abbrev: "DET" },
  home: { name: "Chiefs", abbrev: "KC" },
  when: null,
  status: null,
  live: false,
  venue: null,
  tv: [],
  heat: 80,
  reasons: [],
  printReason: "Sunday night",
  preseason: true,
} as unknown as WatchGame;
assert(watchContext(game) === "Preseason", "preseason still prints without copy");
const copied = applyWatchWhy([game], parsed)[0]!;
assert(watchContext(copied) === "A division game with the series tied.", "copy why replaces the print reason");
assert(watchForCopy([game, { ...game, id: "g2", heat: 10 }], 1)[0]!.id === "g1", "watch copy takes the hottest game");

console.log("newspaper-copy-desk ok");
