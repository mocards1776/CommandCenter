/**
 * Run with: node --experimental-strip-types src/lib/cfb-drive.test.ts
 * from CommandCenter-main/.
 */
import {
  alignCfbOpenDriveToPossession,
  homeYardLineFromDownDistance,
  homeYardLineFromSpotText,
  isTerminalFootballResult,
  liveDriveForField,
  liveHomeYardLine,
  syncCfbDriveStartToLabel,
  cfbDriveGlance,
  cfbDriveGlanceWithPlaySpots,
  cfbDriveScrimmageSpots,
  cfbDriveStatLine,
  cfbInheritedKickEnd,
  cfbTerminalKickEnd,
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

// WASH @ USC, 2026-10-03: Carrigan's punt was fair-caught at WASH 5 and the
// first snap (incomplete) was at WASH 5. The punt spot and the scrimmage are
// the same yard, so the marker stays.
const fairCatch = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "40185847832",
    team: { id: "264", abbreviation: "WASH" },
    yards: 3,
    offensivePlays: 2,
    timeElapsed: { displayValue: "0:46" },
    start: { yardLine: 95, text: "WASH 5" },
  }),
  [
    {
      type: { text: "Pass Incompletion" },
      text: "Shotgun pass incomplete short left",
      start: { yardLine: 95, possessionText: "WASH 5" },
    },
    {
      type: { text: "Rush" },
      text: "rush middle for 3 yards",
      start: { yardLine: 95, possessionText: "WASH 5" },
    },
  ],
  { yardLine: 95, text: "WASH 5" },
);
assert(
  fairCatch.startText === "WASH 5" && fairCatch.startYardLine === 95,
  "a fair catch that is snapped is the drive start",
);
assert(
  cfbDriveStatLine(cfbDriveGlance(fairCatch)) === "WASH · 2 plays · 3 yds · 0:46 · from WASH 5",
  cfbDriveStatLine(cfbDriveGlance(fairCatch)) ?? "empty fair catch line",
);

// Punt parked on the new drive. ESPN leaves start on the punt spot (WASH 5)
// after the return. The first scrimmage is WASH 28.
const puntThenSnap = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "punt-on-drive",
    team: { id: "264", abbreviation: "WASH" },
    yards: 6,
    offensivePlays: 1,
    timeElapsed: { displayValue: "0:18" },
    start: { yardLine: 95, text: "WASH 5" },
  }),
  [
    {
      type: { text: "Punt" },
      text: "punt 45 yards to the UW05",
      end: { yardLine: 95, possessionText: "WASH 5" },
    },
    {
      type: { text: "Punt Return" },
      text: "return to the UW28",
      end: { yardLine: 72, possessionText: "WASH 28" },
    },
    {
      type: { text: "Penalty" },
      text: "PENALTY false start. NO PLAY",
      start: { yardLine: 72, possessionText: "WASH 28" },
    },
    {
      type: { text: "Rush" },
      text: "rush for 6 yards",
      start: { yardLine: 72, possessionText: "WASH 28" },
    },
  ],
);
assert(
  puntThenSnap.startText === "WASH 28" && puntThenSnap.startYardLine === 72,
  "first snap replaces a punt parked on the drive",
);
assert(
  cfbDriveStatLine(cfbDriveGlance(puntThenSnap)) === "WASH · 1 play · 6 yds · 0:18 · from WASH 28",
  cfbDriveStatLine(cfbDriveGlance(puntThenSnap)) ?? "empty punt-then-snap line",
);

// The punt stayed on the previous drive. This drive's start is still the punt
// spot, and the snap is not.
const afterPunt = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "after-punt",
    team: { id: "264", abbreviation: "WASH" },
    yards: 4,
    offensivePlays: 1,
    start: { yardLine: 95, text: "WASH 5" },
  }),
  [
    {
      type: { text: "Rush" },
      text: "rush for 4 yards",
      start: { yardLine: 80, possessionText: "WASH 20" },
    },
  ],
  { yardLine: 95, text: "WASH 5" },
);
assert(
  afterPunt.startText === "WASH 20" && afterPunt.startYardLine === 80,
  "previous drive's punt spot yields to this offense's first snap",
);
assert(
  cfbDriveStatLine(cfbDriveGlance(afterPunt)) === "WASH · 1 play · 4 yds · from WASH 20",
  cfbDriveStatLine(cfbDriveGlance(afterPunt)) ?? "empty after-punt line",
);

// This drive's own punt is the other team's next spot, not a reason to move
// where this drive began.
const ownPunt = correctCfbDriveStartFromPlays(
  mapCfbDriveMeta({
    id: "own-punt",
    team: { abbreviation: "WASH" },
    yards: 12,
    offensivePlays: 3,
    displayResult: "Punt",
    start: { yardLine: 75, text: "WASH 25" },
  }),
  [
    {
      type: { text: "Rush" },
      start: { yardLine: 75, possessionText: "WASH 25" },
    },
    {
      type: { text: "Punt" },
      end: { yardLine: 20, possessionText: "USC 20" },
    },
  ],
);
assert(ownPunt.startText === "WASH 25" && ownPunt.startYardLine === 75, "a punt that ends the drive is not the start");

assert(
  cfbTerminalKickEnd([
    { type: { text: "Kickoff" }, end: { yardLine: 75, possessionText: "WASH 25" } },
    { type: { text: "Rush" }, start: { yardLine: 75, possessionText: "WASH 25" } },
  ]) == null,
  "an opening kickoff is not the next drive's spot",
);
assert(
  cfbTerminalKickEnd([
    { type: { text: "Rush" }, start: { yardLine: 50, possessionText: "50" } },
    { type: { text: "Punt" }, end: { yardLine: 95, possessionText: "WASH 5" } },
  ])?.text === "WASH 5",
  "a punt with no snap after it is the inherited spot",
);
assert(
  cfbInheritedKickEnd(
    [
      {
        id: "usc-punt",
        plays: [{ type: { text: "Punt" }, end: { yardLine: 95, possessionText: "WASH 5" } }],
      },
    ],
    "wash",
  )?.text === "WASH 5",
  "the drive before this one supplies the punt spot",
);

// IND @ WSH, London, 2026-10-04: the stat line said "from WSH 46" while a
// yardLine of 50 would start the capsule on the midfield logo. The label wins.
const wsh46 = syncCfbDriveStartToLabel(
  {
    teamAbbrev: "IND",
    playCount: 6,
    yards: 33,
    timeOfPossession: "3:17",
    startYardLine: 50,
    startText: "WSH 46",
    displayResult: null,
    description: null,
  },
  "WSH",
  "IND",
);
assert(wsh46?.startText === "WSH 46" && wsh46.startYardLine === 46, "WSH 46 text pulls a midfield yard line back to 46");
assert(
  homeYardLineFromSpotText("IND 32", "WSH", "IND") === 68,
  "an away spot is measured from the home end zone",
);
assert(
  syncCfbDriveStartToLabel(
    { ...wsh46!, startYardLine: 46, startText: "WSH 46" },
    "WSH",
    "IND",
  )?.startYardLine === 46,
  "a label that already matches the yard line is left alone",
);
assert(homeYardLineFromSpotText("50", "WSH", "IND") === 50, "a bare 50 is midfield");
assert(
  syncCfbDriveStartToLabel(
    { ...wsh46!, startText: "WSH 0", startYardLine: 25 },
    "WSH",
    "IND",
  )?.startYardLine === 25,
  "a kickoff placeholder label does not move the yard line",
);

const drivePlays = [
  { type: { text: "Kickoff" }, start: { yardLine: 35 }, end: { yardLine: 70, possessionText: "ALA 30" } },
  { type: { text: "Rush" }, start: { yardLine: 70, possessionText: "ALA 30" }, end: { yardLine: 75 } },
  { type: { text: "Pass" }, start: { yardLine: 75, possessionText: "ALA 25" }, end: { yardLine: 80 } },
  { type: { text: "Penalty" }, text: "False start, NO PLAY", start: { yardLine: 80 } },
  { type: { text: "Timeout" }, start: { yardLine: 80 } },
  { type: { text: "Rush" }, start: { yardLine: 0 }, end: { yardLine: 82, possessionText: "ALA 18" } },
  { type: { text: "Extra Point" }, start: { yardLine: 97 } },
];
assert(
  cfbDriveScrimmageSpots(drivePlays).join(",") === "70,75,82",
  `scrimmage spots are snap yards, not kicks or flags: ${cfbDriveScrimmageSpots(drivePlays).join(",")}`,
);
const glanced = cfbDriveGlanceWithPlaySpots(
  mapCfbDriveMeta({
    id: "d1",
    team: { abbreviation: "ALA" },
    offensivePlays: 3,
    yards: 12,
    start: { yardLine: 70, text: "ALA 30" },
  }),
  drivePlays,
);
assert(glanced.playSpots?.join(",") === "70,75,82", "glance carries only this drive's snaps");
assert(
  cfbDriveGlance({ ...glanced, id: "d1", teamId: null, result: null }).playSpots?.join(",") === "70,75,82",
  "glance copy keeps the snap spots",
);
assert(cfbDriveScrimmageSpots([]).length === 0, "a drive with no snaps has no dots");

assert(isTerminalFootballResult("Punt") === true, "punt is terminal");
assert(isTerminalFootballResult(null) === false, "open drive is not terminal");
assert(homeYardLineFromDownDistance("1st & 10 at LV 15", "LV", "KC") === 15, "LV 15 is home 15");
assert(homeYardLineFromDownDistance("1ST & 10 AT KC 42", "LV", "KC") === 58, "KC 42 is home 58");

const stalePunt = cfbDriveGlance(
  mapCfbDriveMeta({
    id: "kc-punt",
    team: { id: "12", abbreviation: "KC" },
    offensivePlays: 3,
    yards: 3,
    timeElapsed: { displayValue: "0:58" },
    displayResult: "Punt",
    start: { yardLine: 58, text: "KC 42" },
  }),
);
assert(
  liveDriveForField(stalePunt, {
    possessionTeamId: "13",
    homeYardLine: 15,
    away: { teamId: "12", abbrev: "KC" },
    home: { teamId: "13", abbrev: "LV" },
  }) === null,
  "a completed punt does not keep the capsule after the next possession",
);
assert(
  liveHomeYardLine({
    situationYardLine: 25,
    downDistanceText: "1st & 10 at LV 15",
    homeAbbrev: "LV",
    awayAbbrev: "KC",
  }) === 15,
  "down-and-distance text wins when the numeric yard disagrees",
);

console.log("cfb-drive.test.ts ok");
