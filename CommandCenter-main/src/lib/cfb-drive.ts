import { abbrevFromCfbSpot, cfbKickReceipt, type CfbPossessionSnap } from "./cfb-possession.ts";

/** ESPN summary drive fields used by the field graphic. */

export type EspnCfbDriveRaw = {
  id?: string;
  description?: string;
  team?: { id?: string; abbreviation?: string };
  result?: string;
  displayResult?: string;
  shortDisplayResult?: string;
  yards?: number;
  offensivePlays?: number;
  timeElapsed?: { displayValue?: string };
  start?: { yardLine?: number; text?: string };
};

/** Live drive glance. Null fields are absent from ESPN. */
export type CfbDriveGlance = {
  teamAbbrev: string | null;
  playCount: number | null;
  yards: number | null;
  timeOfPossession: string | null;
  startYardLine: number | null;
  startText: string | null;
  displayResult: string | null;
  description: string | null;
};

export type CfbDriveMeta = CfbDriveGlance & {
  id: string;
  teamId: string | null;
  result: string | null;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Map one ESPN summary drive. Play count and TOP come only from ESPN fields. */
export function mapCfbDriveMeta(d: EspnCfbDriveRaw, fallbackId = ""): CfbDriveMeta {
  const resultLabel = d.displayResult?.trim() || d.shortDisplayResult?.trim() || null;
  return {
    id: d.id != null && String(d.id) ? String(d.id) : fallbackId,
    description: d.description?.trim() || null,
    teamId: d.team?.id != null ? String(d.team.id) : null,
    teamAbbrev: d.team?.abbreviation ?? null,
    result: d.result ?? null,
    displayResult: resultLabel,
    yards: finiteNumber(d.yards),
    playCount: finiteNumber(d.offensivePlays),
    timeOfPossession: d.timeElapsed?.displayValue?.trim() || null,
    startYardLine: finiteNumber(d.start?.yardLine),
    startText: d.start?.text?.trim() || null,
  };
}

export function cfbDriveGlance(drive: CfbDriveMeta): CfbDriveGlance {
  return {
    teamAbbrev: drive.teamAbbrev,
    playCount: drive.playCount,
    yards: drive.yards,
    timeOfPossession: drive.timeOfPossession,
    startYardLine: drive.startYardLine,
    startText: drive.startText,
    displayResult: drive.displayResult,
    description: drive.description,
  };
}

/** ESPN's kickoff placeholder starts at the kicking team's 0, not a real snap spot. */
export function cfbDriveStartIsKickOrigin(drive: CfbDriveGlance): boolean {
  if (drive.startYardLine === 0) return true;
  return Boolean(drive.startText && /\s0$/.test(drive.startText.trim()));
}

function driveHasNoSnaps(drive: CfbDriveGlance): boolean {
  return drive.playCount == null || drive.playCount === 0;
}

/**
 * A 0-play drive still credited to the kicking team (or still starting at
 * "TEAM 0") becomes the receiving team's drive at the return spot.
 * Drives that already have a snap or a result stay as ESPN sent them.
 */
export function rebaseCfbDriveAfterKick(
  drive: CfbDriveMeta,
  snap: CfbPossessionSnap | null | undefined,
): CfbDriveMeta {
  const receipt = cfbKickReceipt(snap);
  if (!receipt || drive.displayResult || !driveHasNoSnaps(drive)) return drive;
  const stillKicking = drive.teamId != null && String(drive.teamId) === receipt.kickingTeamId;
  if (!stillKicking && !cfbDriveStartIsKickOrigin(drive)) return drive;
  const abbrev = abbrevFromCfbSpot(receipt.spot);
  return {
    ...drive,
    teamId: receipt.receivingTeamId,
    teamAbbrev: abbrev ?? (stillKicking ? null : drive.teamAbbrev),
    startYardLine: receipt.yardLine ?? drive.startYardLine,
    startText: receipt.spot ?? drive.startText,
  };
}

/**
 * Spot label for a yard line measured from the home end zone.
 * 69 with home MIZ / away FLA is "FLA 31". The 0 and 100 goal lines are
 * the kickoff placeholder, not a drive start.
 */
export function cfbSpotFromHomeYardLine(
  homeYardLine: number | null,
  homeAbbrev: string,
  awayAbbrev: string,
): { text: string; yardLine: number } | null {
  if (homeYardLine == null || !Number.isFinite(homeYardLine)) return null;
  const yardLine = Math.round(homeYardLine);
  if (yardLine <= 0 || yardLine >= 100) return null;
  if (yardLine <= 50) return { text: `${homeAbbrev} ${yardLine}`, yardLine };
  return { text: `${awayAbbrev} ${100 - yardLine}`, yardLine };
}

/**
 * Open kickoff placeholder ("MIZ · 0 plays · from MIZ 0") follows the team
 * that actually has the ball. A drive that has started, or that already
 * names that team at a real spot, is left alone.
 */
export function alignCfbOpenDriveToPossession(
  drive: CfbDriveGlance | null | undefined,
  args: {
    possessionTeamId: string | null;
    homeYardLine: number | null;
    away: { teamId: string | number; abbrev: string };
    home: { teamId: string | number; abbrev: string };
  },
): CfbDriveGlance | null {
  if (!drive) return null;
  if (drive.displayResult || !driveHasNoSnaps(drive) || !cfbDriveStartIsKickOrigin(drive)) {
    return drive;
  }
  const possId = args.possessionTeamId;
  if (!possId) return drive;
  const side =
    String(args.away.teamId) === String(possId)
      ? args.away
      : String(args.home.teamId) === String(possId)
        ? args.home
        : null;
  if (!side) return drive;
  const spot = cfbSpotFromHomeYardLine(args.homeYardLine, args.home.abbrev, args.away.abbrev);
  const teamMatches = drive.teamAbbrev?.toUpperCase() === side.abbrev.toUpperCase();
  if (teamMatches) {
    if (!spot || (drive.startText === spot.text && drive.startYardLine === spot.yardLine)) {
      return drive;
    }
    return { ...drive, startText: spot.text, startYardLine: spot.yardLine };
  }
  // Only a placeholder still wearing the kick-origin team ("MIZ" at "MIZ 0")
  // follows possession. A drive ESPN has already given to the receiver stays.
  const originAbbrev = abbrevFromCfbSpot(drive.startText);
  const wearsOrigin =
    !drive.teamAbbrev ||
    (originAbbrev != null && drive.teamAbbrev.toUpperCase() === originAbbrev.toUpperCase());
  if (!wearsOrigin) return drive;
  return {
    ...drive,
    teamAbbrev: side.abbrev,
    startText: spot?.text ?? drive.startText,
    startYardLine: spot?.yardLine ?? drive.startYardLine,
  };
}

/** Plays, yards, time of possession, result, and start spot — ESPN fields only. */
export function cfbDriveStatLine(drive: CfbDriveGlance): string | null {
  const bits: string[] = [];
  if (drive.teamAbbrev) bits.push(drive.teamAbbrev);
  if (drive.playCount != null) {
    bits.push(`${drive.playCount} ${drive.playCount === 1 ? "play" : "plays"}`);
  }
  if (drive.yards != null) {
    const unit = Math.abs(drive.yards) === 1 ? "yd" : "yds";
    bits.push(`${drive.yards} ${unit}`);
  }
  if (drive.timeOfPossession) bits.push(drive.timeOfPossession);
  if (drive.displayResult) bits.push(drive.displayResult);
  if (drive.startText) bits.push(`from ${drive.startText}`);
  if (bits.length) return bits.join(" · ");
  return drive.description;
}
