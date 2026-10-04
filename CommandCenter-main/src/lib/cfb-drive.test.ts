/**
 * Run with: node --experimental-strip-types src/lib/cfb-drive.test.ts
 * from CommandCenter-main/.
 */
import {
  alignCfbOpenDriveToPossession,
  cfbDriveGlance,
  cfbDriveStatLine,
  correctCfbDriveStartFromPlays,
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

assert(
  cfbDriveStatLine(cfbDriveGlance(placeholder)) === "MIZ · 0 plays · 0 yds · 0:00",
  "a kickoff placeholder is not labeled as a drive start",
);

// Live 2026-10-03: UAB's current drive still said "UAB 0" after a 10-yard rush
// that ESPN's own snap placed at SAM 24 (yardLine 76).
const uabLag = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "401862793",
    team: { id: "5", abbreviation: "UAB" },
    yards: 10,
    offensivePlays: 1,
    start: { yardLine: 0, text: "UAB 0" },
  }),
  [
    {
      type: { text: "Rush" },
      text: "Shotgun rush right for 10 yards gain to the SAM14",
      start: { yardLine: 76, possessionText: "SAM 24" },
    },
  ],
);
assert(uabLag.teamAbbrev === "UAB", "offense on the drive stays the offense");
assert(uabLag.startText === "SAM 24" && uabLag.startYardLine === 76, "snap spot replaces UAB 0");
assert(
  cfbDriveStatLine(cfbDriveGlance(uabLag)) === "UAB · 1 play · 10 yds · from SAM 24",
  cfbDriveStatLine(cfbDriveGlance(uabLag)) ?? "empty uab line",
);

// Same window on UK @ SC: drive.start was "SC 0" while the incomplete pass
// started at UK 36.
const ukLag = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "401856709",
    team: { id: "96", abbreviation: "UK" },
    yards: 0,
    offensivePlays: 1,
    start: { yardLine: 0, text: "SC 0" },
  }),
  [
    {
      type: { text: "Pass Incompletion" },
      text: "Shotgun pass incomplete short right",
      start: { yardLine: 64, possessionText: "UK 36" },
    },
  ],
);
assert(ukLag.startText === "UK 36" && ukLag.startYardLine === 64, "SC 0 yields to the UK snap");

// FLA @ MIZ touchback, then the 12-yard completion. ESPN's drive.start was
// still "MIZ 0" while the snap and the kickoff end were FLA 25.
const flaLag = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "40185670828",
    team: { id: "57", abbreviation: "FLA" },
    yards: 12,
    offensivePlays: 1,
    timeElapsed: { displayValue: "0:10" },
    start: { yardLine: 0, text: "MIZ 0" },
  }),
  [
    {
      type: { text: "Kickoff" },
      text: "B.Reus kickoff 65 yards to the Gators00, Touchback",
      start: { yardLine: 35 },
    },
    {
      type: { text: "Pass Reception" },
      text: "A.Philo pass complete short middle to L.Harpring for 12 yards to the Gators37",
      start: { yardLine: 75, possessionText: "FLA 25" },
    },
  ],
);
assert(flaLag.startText === "FLA 25" && flaLag.startYardLine === 75, "touchback snap is FLA 25, not MIZ 0");
assert(
  cfbDriveStatLine(cfbDriveGlance(flaLag)) === "FLA · 1 play · 12 yds · 0:10 · from FLA 25",
  cfbDriveStatLine(cfbDriveGlance(flaLag)) ?? "empty fla line",
);

// A dead-ball unsportsmanlike flag is not a snap. Leave the placeholder for
// the 0-play possession align instead of pinning the marker at the flag spot.
const deadBall = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "flag",
    team: { id: "142", abbreviation: "MIZ" },
    yards: -15,
    offensivePlays: 0,
    start: { yardLine: 0, text: "MIZ 0" },
  }),
  [
    {
      type: { text: "Penalty" },
      text: "PENALTY Mizzou UNS: Unsportsmanlike Conduct 15 yards from Mizzou35 to Mizzou20. NO PLAY",
      start: { yardLine: 35 },
    },
  ],
);
assert(deadBall.startText === "MIZ 0" && deadBall.startYardLine === 0, "NO PLAY flag is not the drive start");

const alreadyReal = correctCfbDriveStartFromPlays(started, [
  {
    type: { text: "Rush" },
    start: { yardLine: 40, possessionText: "MIZ 40" },
  },
]);
assert(
  alreadyReal.startText === "FLA 31" && alreadyReal.startYardLine === 69,
  "a drive ESPN already spotted is not rewritten from a later play",
);

// After a two-point try ESPN opens the next drive at the touchback 25 with
// no kickoff and no snap. That is not the scrimmage. Live USU @ BOIS, 2026-10-03.
const seeded25 = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "after-2pt",
    team: { id: "68", abbreviation: "BOIS" },
    yards: 0,
    offensivePlays: 0,
    timeElapsed: { displayValue: "0:00" },
    start: { yardLine: 25, text: "BOIS 25" },
  }),
  [
    {
      type: { text: "Two-Point Conversion" },
      text: "G. Brosterhous pass to E. Wood GOOD for Two-Point Conversion",
      start: { yardLine: 97, possessionText: "BOIS 3" },
    },
  ],
);
assert(seeded25.startText == null && seeded25.startYardLine == null, "unconfirmed 25 is not a drive start");
assert(
  cfbDriveStatLine(cfbDriveGlance(seeded25)) === "BOIS · 0 plays · 0 yds · 0:00",
  cfbDriveStatLine(cfbDriveGlance(seeded25)) ?? "empty seeded line",
);

// Same window with an empty play list (the conversion is only on situation.lastPlay).
const emptySeed = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "empty-25",
    team: { id: "68", abbreviation: "BOIS" },
    yards: 0,
    offensivePlays: 0,
    start: { yardLine: 25, text: "BOIS 25" },
  }),
  [],
);
assert(emptySeed.startText == null && emptySeed.startYardLine == null, "a 25 with no plays is omitted");

// Kickoff return, then the first snap is not the seeded 25.
const returned = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "return",
    team: { id: "68", abbreviation: "BOIS" },
    yards: 6,
    offensivePlays: 1,
    start: { yardLine: 25, text: "BOIS 25" },
  }),
  [
    {
      type: { text: "Kickoff" },
      text: "kickoff returned to the BOI40",
      end: { yardLine: 40, possessionText: "BOIS 40" },
    },
    {
      type: { text: "Rush" },
      text: "rush for 6 yards",
      start: { yardLine: 40, possessionText: "BOIS 40" },
    },
  ],
);
assert(returned.startText === "BOIS 40" && returned.startYardLine === 40, "first snap replaces the seeded 25");

// Touchback: the kickoff end and the snap both really are the 25.
const touchback = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "tb",
    team: { id: "68", abbreviation: "BOIS" },
    yards: 8,
    offensivePlays: 1,
    start: { yardLine: 25, text: "BOIS 25" },
  }),
  [
    {
      type: { text: "Kickoff" },
      text: "kickoff 65 yards, Touchback",
      end: { yardLine: 25, possessionText: "BOIS 25" },
    },
    {
      type: { text: "Pass Reception" },
      start: { yardLine: 25, possessionText: "BOIS 25" },
    },
  ],
);
assert(touchback.startText === "BOIS 25" && touchback.startYardLine === 25, "a confirmed touchback stays at the 25");

// Kickoff is in the drive, snap has not happened, return spot is not the 25.
const kickOnly = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "kick-only",
    team: { id: "68", abbreviation: "BOIS" },
    yards: 0,
    offensivePlays: 0,
    start: { yardLine: 25, text: "BOIS 25" },
  }),
  [
    {
      type: { text: "Kickoff" },
      text: "kickoff returned to the BOI18",
      end: { yardLine: 18, possessionText: "BOIS 18" },
    },
  ],
);
assert(kickOnly.startText === "BOIS 18" && kickOnly.startYardLine === 18, "a return spot replaces the seeded 25");

console.log("cfb-drive.test.ts ok");
