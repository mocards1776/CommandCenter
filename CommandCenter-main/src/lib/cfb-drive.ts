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
  /**
   * Scrimmage snap spots on this drive only, yards from the home end zone.
   * Kickoffs, punts, and dead-ball flags are omitted. Empty when the drive
   * has not snapped.
   */
  playSpots?: number[];
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
    playSpots: drive.playSpots,
  };
}

/**
 * Yard line of each scrimmage snap on this drive, in order.
 * The spot is where the play started. A goal-line placeholder (0 or 100)
 * falls through to the end spot when that one is on the field.
 * Kicks, punts, PATs, timeouts, and "NO PLAY" flags are not plotted.
 */
export function cfbDriveScrimmageSpots(plays: CfbDrivePlaySpot[] | null | undefined): number[] {
  const spots: number[] = [];
  for (const play of plays ?? []) {
    if (isAdministrativeDrivePlay(play)) continue;
    const start = finiteNumber(play.start?.yardLine);
    const end = finiteNumber(play.end?.yardLine);
    const yard = start != null && start > 0 && start < 100 ? start : end;
    if (yard == null || yard <= 0 || yard >= 100) continue;
    spots.push(yard);
  }
  return spots;
}

/** Glance plus the current drive's snap spots. Previous drives are not included. */
export function cfbDriveGlanceWithPlaySpots(
  drive: CfbDriveMeta,
  plays: CfbDrivePlaySpot[] | null | undefined,
): CfbDriveGlance {
  return { ...cfbDriveGlance(drive), playSpots: cfbDriveScrimmageSpots(plays) };
}

/** ESPN's kickoff placeholder starts at a goal line ("MIZ 0", yardLine 0 or 100), not a snap spot. */
export function cfbDriveStartIsKickOrigin(drive: CfbDriveGlance): boolean {
  const yard = drive.startYardLine;
  if (yard === 0 || yard === 100) return true;
  return cfbDriveStartTextIsPlaceholder(drive.startText);
}

export function cfbDriveStartTextIsPlaceholder(text: string | null | undefined): boolean {
  return Boolean(text && /\s0$/.test(text.trim()));
}

/**
 * One play inside an ESPN drive, only the fields that locate the snap.
 * Kickoffs and dead-ball "NO PLAY" flags are not the offense's start.
 */
export type CfbDrivePlaySpot = {
  text?: string | null;
  type?: { text?: string | null } | null;
  start?: {
    yardLine?: number | null;
    possessionText?: string | null;
  } | null;
  end?: {
    yardLine?: number | null;
    possessionText?: string | null;
  } | null;
};

function isKickOrPuntPlay(play: CfbDrivePlaySpot): boolean {
  return /kickoff|\bpunt\b/i.test(play.type?.text ?? "");
}

function isAdministrativeDrivePlay(play: CfbDrivePlaySpot): boolean {
  const typeText = play.type?.text ?? "";
  if (/kickoff|\bpunt\b|end period|timeout|two-minute|coin toss/i.test(typeText)) return true;
  // PAT and two-point tries are the previous score, not the next drive's snap.
  if (/extra point|two[- ]point|\bpat\b/i.test(typeText)) return true;
  // Unsportsmanlike / dead-ball flags move the ball before a snap. They are
  // not the drive start; the next snap (or the live ball) is. A "NO PLAY"
  // still carries a spot, so the possession text does not make it a snap.
  if (/penalty/i.test(typeText) && /no play/i.test(play.text ?? "")) return true;
  return false;
}

/** Own or opponent 25 — the spot ESPN seeds before a kickoff is returned or snapped. */
export function cfbDriveStartIsTouchbackSpot(drive: CfbDriveGlance): boolean {
  const yard = drive.startYardLine;
  if (yard === 25 || yard === 75) return true;
  return Boolean(drive.startText && /\s25$/.test(drive.startText.trim()));
}

function playSpot(
  side: { yardLine?: number | null; possessionText?: string | null } | null | undefined,
): { yardLine: number | null; text: string | null } | null {
  if (!side) return null;
  const yard = finiteNumber(side.yardLine);
  const text = side.possessionText?.trim() || null;
  const yardReal = yard != null && yard > 0 && yard < 100;
  const textReal = Boolean(text && !cfbDriveStartTextIsPlaceholder(text));
  if (!yardReal && !textReal) return null;
  return { yardLine: yardReal ? yard : null, text: textReal ? text : null };
}

export type CfbSpot = { yardLine: number | null; text: string | null };

function spotsMatch(drive: CfbDriveGlance, spot: CfbSpot): boolean {
  if (spot.yardLine != null && drive.startYardLine === spot.yardLine) return true;
  return Boolean(spot.text && drive.startText === spot.text);
}

/**
 * Kick or punt that ends this drive (nothing from scrimmage after it).
 * An opening kickoff that this offense then snaps is not the next drive's spot.
 */
export function cfbTerminalKickEnd(
  plays: CfbDrivePlaySpot[] | null | undefined,
): CfbSpot | null {
  const list = plays ?? [];
  let lastKick = -1;
  for (let i = 0; i < list.length; i++) {
    if (isKickOrPuntPlay(list[i]!)) lastKick = i;
  }
  if (lastKick < 0) return null;
  const laterSnap = list.slice(lastKick + 1).some((play) => !isAdministrativeDrivePlay(play));
  if (laterSnap) return null;
  return playSpot(list[lastKick]?.end);
}

/**
 * Spot the previous drive's punt or kickoff left for this one.
 * `driveId` is the drive being spotted. When that id is already in `previous`,
 * the kick is the drive before it — not this drive's own punt.
 */
export function cfbInheritedKickEnd(
  previous: { id?: string; plays?: CfbDrivePlaySpot[] | null }[] | null | undefined,
  driveId: string | null,
): CfbSpot | null {
  const prev = previous ?? [];
  const idx = driveId ? prev.findIndex((drive) => String(drive.id ?? "") === driveId) : -1;
  if (idx > 0) return cfbTerminalKickEnd(prev[idx - 1]?.plays);
  if (idx === 0) return null;
  if (!prev.length) return null;
  const last = prev[prev.length - 1]!;
  if (driveId && String(last.id ?? "") === driveId) {
    return prev.length > 1 ? cfbTerminalKickEnd(prev[prev.length - 2]?.plays) : null;
  }
  return cfbTerminalKickEnd(last.plays);
}

/** Kick and punt ends that happen before this drive's first scrimmage. */
function preSnapKickSpots(plays: CfbDrivePlaySpot[]): CfbSpot[] {
  const snapIdx = plays.findIndex((play) => !isAdministrativeDrivePlay(play));
  if (snapIdx < 0) return [];
  const spots: CfbSpot[] = [];
  for (const play of plays.slice(0, snapIdx)) {
    if (!isKickOrPuntPlay(play)) continue;
    const spot = playSpot(play.end);
    if (spot) spots.push(spot);
  }
  return spots;
}

function withSpot(drive: CfbDriveMeta, spot: CfbSpot): CfbDriveMeta {
  return {
    ...drive,
    startYardLine: spot.yardLine ?? drive.startYardLine,
    startText: spot.text ?? (spot.yardLine != null ? null : drive.startText),
  };
}

/**
 * ESPN often leaves `drive.start` on a kickoff placeholder after the return
 * and the first snaps. Goal-line placeholders are "UAB 0" / yardLine 0 (or
 * the kicking team's "SC 0"). After a score, ESPN also seeds the next drive
 * at the touchback 25 ("BOIS 25") before the kickoff or the first snap of
 * that drive exists. Checked live on 2026-10-03 summaries and the 2026-10-03
 * USU at Boise State game: a 0-play drive still said "from BOIS 25" while the
 * ball was on the goal line after a two-point try.
 *
 * A punt can do the same thing with a real-looking yard. The next drive's
 * `start` (or a punt parked on that drive) stays where the other team kicked
 * the ball, after the return or the first snap has already moved. WASH @ USC
 * on 2026-10-03 fair-caught at WASH 5 and snapped there — that spot is the
 * scrimmage. A return that leaves `start` on the punt spot is not.
 *
 * The first scrimmage replaces a placeholder or a kick/punt end. A 25 that
 * no kickoff has confirmed and no snap has reached is dropped, so the card
 * does not invent a start. A drive ESPN already spotted at a real yard that
 * is not a kick or punt end is left alone.
 */
export function correctCfbDriveStartFromPlays(
  drive: CfbDriveMeta,
  plays: CfbDrivePlaySpot[] | null | undefined,
  previousKickEnd?: CfbSpot | null,
): CfbDriveMeta {
  const list = plays ?? [];
  const snap = list.find((play) => !isAdministrativeDrivePlay(play));
  const snapSpot = playSpot(snap?.start);
  const placeholder = cfbDriveStartIsKickOrigin(drive) || cfbDriveStartIsTouchbackSpot(drive);
  const kickSpots = preSnapKickSpots(list);
  if (previousKickEnd && (previousKickEnd.yardLine != null || previousKickEnd.text)) {
    kickSpots.push(previousKickEnd);
  }
  const startIsKickEnd = kickSpots.some((spot) => spotsMatch(drive, spot));

  if (snapSpot && (placeholder || startIsKickEnd)) {
    // Touchback or fair catch: the snap really is the spot ESPN stored.
    if (!cfbDriveStartIsKickOrigin(drive) && spotsMatch(drive, snapSpot)) return drive;
    return withSpot(drive, snapSpot);
  }
  if (snapSpot || !cfbDriveStartIsTouchbackSpot(drive)) return drive;

  const kick = [...list].reverse().find(isKickOrPuntPlay);
  const kickSpot = playSpot(kick?.end);
  if (kickSpot) {
    if (spotsMatch(drive, kickSpot)) return drive;
    return withSpot(drive, kickSpot);
  }
  return { ...drive, startYardLine: null, startText: null };
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
 * Home-end-zone yard line implied by a spot label.
 * "WSH 46" with home WSH is 46. "IND 32" with away IND is 68. A bare "50" is midfield.
 * The number on a spot is 1–50. A trailing 0 is the kickoff placeholder, not a snap.
 */
export function homeYardLineFromSpotText(
  text: string | null | undefined,
  homeAbbrev: string,
  awayAbbrev: string,
): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed === "50") return 50;
  const match = trimmed.match(/^([A-Za-z]{2,5})\s+(\d{1,2})$/);
  if (!match) return null;
  const abbrev = match[1]!.toUpperCase();
  const yards = Number(match[2]);
  if (!Number.isFinite(yards) || yards <= 0 || yards > 50) return null;
  if (yards === 50) return 50;
  const home = homeAbbrev.trim().toUpperCase();
  const away = awayAbbrev.trim().toUpperCase();
  if (abbrev === home) return yards;
  if (abbrev === away) return 100 - yards;
  return null;
}

/**
 * The capsule starts at `startYardLine`. The "from …" line is `startText`.
 * Those two can name different spots (text "WSH 46", yardLine 50). The words on the
 * card win, so the capsule starts on the spot the stat line prints.
 */
export function syncCfbDriveStartToLabel(
  drive: CfbDriveGlance | null | undefined,
  homeAbbrev: string,
  awayAbbrev: string,
): CfbDriveGlance | null {
  if (!drive) return null;
  const fromText = homeYardLineFromSpotText(drive.startText, homeAbbrev, awayAbbrev);
  if (fromText == null || fromText === drive.startYardLine) return drive;
  return { ...drive, startYardLine: fromText };
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

/** Punt, score, turnover, or other result that means this drive is over. */
export function isTerminalFootballResult(result: string | null | undefined): boolean {
  const text = (result ?? "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  return /punt|touchdown|field goal|interception|fumble|downs|safety|missed fg|turnover|end of (half|game|quarter)|blocked|touchback/i.test(
    text,
  );
}

/** "1st & 10 at LV 15" → home-end-zone yard line. */
export function homeYardLineFromDownDistance(
  text: string | null | undefined,
  homeAbbrev: string,
  awayAbbrev: string,
): number | null {
  if (!text) return null;
  const match = text.match(/\bat\s+([A-Za-z]{2,5})\s+(\d{1,2})\b/i);
  if (!match) return null;
  return homeYardLineFromSpotText(`${match[1]} ${match[2]}`, homeAbbrev, awayAbbrev);
}

/**
 * Live ball spot. Header text wins when ESPN's numeric yardLine disagrees
 * with "at LV 15", because the chains have to match the down-and-distance.
 */
export function liveHomeYardLine(args: {
  situationYardLine: number | null | undefined;
  downDistanceText?: string | null;
  possessionText?: string | null;
  fallbackYardLine?: number | null;
  homeAbbrev: string;
  awayAbbrev: string;
}): number | null {
  const fromDown = homeYardLineFromDownDistance(args.downDistanceText, args.homeAbbrev, args.awayAbbrev);
  const fromPoss = homeYardLineFromSpotText(args.possessionText, args.homeAbbrev, args.awayAbbrev);
  const fromText = fromDown ?? fromPoss;
  const sit = typeof args.situationYardLine === "number" && Number.isFinite(args.situationYardLine)
    ? args.situationYardLine
    : null;
  if (sit != null && fromText != null && Math.abs(sit - fromText) >= 8) return fromText;
  if (sit != null) return sit;
  return fromText ?? args.fallbackYardLine ?? null;
}

/**
 * Drive overlay for the live field. A completed punt/score still sitting in
 * `drives.current` must not keep the capsule or "from KC 42" line after the
 * situation has moved to the next possession.
 */
export function liveDriveForField(
  drive: CfbDriveGlance | null | undefined,
  args: {
    possessionTeamId: string | null;
    homeYardLine: number | null;
    away: { teamId: string | number; abbrev: string };
    home: { teamId: string | number; abbrev: string };
  },
): CfbDriveGlance | null {
  const aligned = syncCfbDriveStartToLabel(
    alignCfbOpenDriveToPossession(drive, args),
    args.home.abbrev,
    args.away.abbrev,
  );
  if (!aligned) return null;
  if (isTerminalFootballResult(aligned.displayResult)) return null;
  return aligned;
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
  if (drive.startText && !cfbDriveStartTextIsPlaceholder(drive.startText)) {
    bits.push(`from ${drive.startText}`);
  }
  if (bits.length) return bits.join(" · ");
  return drive.description;
}
