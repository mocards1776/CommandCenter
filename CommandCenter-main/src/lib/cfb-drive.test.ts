/**
 * Run with: node --experimental-strip-types src/lib/cfb-drive.test.ts
 * from CommandCenter-main/.
 */
import { cfbDriveGlance, cfbDriveStatLine, mapCfbDriveMeta } from "./cfb-drive.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const drive = mapCfbDriveMeta({
  id: "40185670729",
  description: "9 plays, 20 yards, 3:07",
  team: { id: "344", abbreviation: "MSST" },
  yards: 20,
  offensivePlays: 9,
  timeElapsed: { displayValue: "3:07" },
  start: { yardLine: 25, text: "MSST 25" },
});

assert(drive.playCount === 9, "play count is ESPN offensivePlays");
assert(drive.yards === 20, "yards");
assert(drive.timeOfPossession === "3:07", "time of possession");
assert(drive.startYardLine === 25, "start yard line");
assert(drive.startText === "MSST 25", "start spot");
assert(
  cfbDriveStatLine(cfbDriveGlance(drive)) === "MSST · 9 plays · 20 yds · 3:07 · from MSST 25",
  cfbDriveStatLine(cfbDriveGlance(drive)) ?? "empty",
);

const one = mapCfbDriveMeta({
  id: "1",
  team: { abbreviation: "ALA" },
  yards: 1,
  offensivePlays: 1,
  timeElapsed: { displayValue: "0:09" },
  displayResult: "Touchdown",
  start: { yardLine: 75, text: "ALA 25" },
});
assert(
  cfbDriveStatLine(cfbDriveGlance(one)) === "ALA · 1 play · 1 yd · 0:09 · Touchdown · from ALA 25",
  cfbDriveStatLine(cfbDriveGlance(one)) ?? "empty",
);

const missing = mapCfbDriveMeta({ id: "2", description: "4 plays, -1 yard, 1:12" });
assert(missing.playCount === null && missing.yards === null, "missing counts stay null");
assert(
  cfbDriveStatLine(cfbDriveGlance(missing)) === "4 plays, -1 yard, 1:12",
  "description is the fallback when ESPN omits the parts",
);

console.log("cfb-drive.test.ts ok");
