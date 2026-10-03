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
