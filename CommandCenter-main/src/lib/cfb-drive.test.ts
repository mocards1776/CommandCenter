/**
 * Run with: node --experimental-strip-types src/lib/cfb-drive.test.ts
 * from CommandCenter-main/.
 */
import {
  alignCfbOpenDriveToPossession,
  cfbDriveGlance,
  cfbDriveStatLine,
  mapCfbDriveMeta,
  rebaseCfbDriveAfterKick,
} from "./cfb-drive.ts";

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

const kickReturn = {
  lastPlay: {
    type: { text: "Kickoff" },
    scoringPlay: false,
    text: "B.Reus kickoff 65 yards to the Gators00 L.Montgomery return 31 yards to the Gators31",
    start: { team: { id: "142" } },
    end: { team: { id: "57" }, yardLine: 69, possessionText: "FLA 31" },
  },
};

const placeholder = mapCfbDriveMeta({
  id: "kick",
  team: { id: "142", abbreviation: "MIZ" },
  yards: 0,
  offensivePlays: 0,
  timeElapsed: { displayValue: "0:00" },
  start: { yardLine: 0, text: "MIZ 0" },
});
const afterReturn = rebaseCfbDriveAfterKick(placeholder, kickReturn);
assert(afterReturn.teamId === "57", "return gives the drive to the receiving team");
assert(afterReturn.teamAbbrev === "FLA", "drive abbrev follows the return spot");
assert(afterReturn.startText === "FLA 31" && afterReturn.startYardLine === 69, "start spot is the return");
assert(afterReturn.playCount === 0 && afterReturn.yards === 0, "no snap has been counted yet");
assert(
  cfbDriveStatLine(cfbDriveGlance(afterReturn)) === "FLA · 0 plays · 0 yds · 0:00 · from FLA 31",
  cfbDriveStatLine(cfbDriveGlance(afterReturn)) ?? "empty return line",
);

const started = mapCfbDriveMeta({
  id: "live",
  team: { id: "57", abbreviation: "FLA" },
  yards: 0,
  offensivePlays: 3,
  timeElapsed: { displayValue: "0:16" },
  start: { yardLine: 69, text: "FLA 31" },
});
const kept = rebaseCfbDriveAfterKick(started, kickReturn);
assert(kept.teamAbbrev === "FLA" && kept.playCount === 3 && kept.startText === "FLA 31", "a drive with snaps stays");

const puntDrive = mapCfbDriveMeta({
  id: "punt",
  team: { id: "57", abbreviation: "FLA" },
  yards: 12,
  offensivePlays: 4,
  displayResult: "Punt",
  start: { yardLine: 60, text: "FLA 40" },
});
const puntKept = rebaseCfbDriveAfterKick(puntDrive, {
  lastPlay: {
    type: { text: "Punt" },
    start: { team: { id: "57" } },
    end: { team: { id: "142" }, yardLine: 10, possessionText: "MIZ 10" },
  },
});
assert(puntKept.teamAbbrev === "FLA" && puntKept.displayResult === "Punt", "a finished punt drive stays");

const openLine = alignCfbOpenDriveToPossession(cfbDriveGlance(placeholder), {
  possessionTeamId: "57",
  homeYardLine: 69,
  away: { teamId: 57, abbrev: "FLA" },
  home: { teamId: 142, abbrev: "MIZ" },
});
assert(openLine?.teamAbbrev === "FLA", "placeholder drive follows possession");
assert(openLine?.startText === "FLA 31" && openLine.startYardLine === 69, "placeholder start is the ball");
assert(
  cfbDriveStatLine(openLine!) === "FLA · 0 plays · 0 yds · 0:00 · from FLA 31",
  cfbDriveStatLine(openLine!) ?? "empty aligned line",
);

const alreadyReceiver = alignCfbOpenDriveToPossession(
  cfbDriveGlance(
    mapCfbDriveMeta({
      id: "recv",
      team: { id: "57", abbreviation: "FLA" },
      yards: 0,
      offensivePlays: 0,
      timeElapsed: { displayValue: "0:00" },
      start: { yardLine: 0, text: "MIZ 0" },
    }),
  ),
  {
    possessionTeamId: "142",
    homeYardLine: 69,
    away: { teamId: 57, abbrev: "FLA" },
    home: { teamId: 142, abbrev: "MIZ" },
  },
);
assert(
  alreadyReceiver?.teamAbbrev === "FLA" && alreadyReceiver.startText === "MIZ 0",
  "a drive already given to the receiver is not pulled back to a stale kicking-team flag",
);

const realDrive = alignCfbOpenDriveToPossession(cfbDriveGlance(started), {
  possessionTeamId: "142",
  homeYardLine: 69,
  away: { teamId: 57, abbrev: "FLA" },
  home: { teamId: 142, abbrev: "MIZ" },
});
assert(
  realDrive?.teamAbbrev === "FLA" && realDrive.playCount === 3,
  "a drive that has snapped does not follow a stale flag",
);

console.log("cfb-drive.test.ts ok");
