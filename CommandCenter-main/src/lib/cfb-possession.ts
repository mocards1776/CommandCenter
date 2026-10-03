/**
 * Who has the ball after an ESPN scoreboard snap.
 * A kickoff or punt leaves `situation.possession` (and often `lastPlay.team`)
 * on the kicking team until the next snap. The team that will snap next is
 * `lastPlay.end.team` when that id differs from the kicking team.
 */

export type CfbPossessionSnap = {
  possession?: string | null;
  lastPlay?: {
    text?: string | null;
    scoringPlay?: boolean | null;
    type?: { text?: string | null } | null;
    team?: { id?: string | null } | null;
    start?: { team?: { id?: string | null } | null } | null;
    end?: {
      team?: { id?: string | null } | null;
      yardLine?: number | null;
      possessionText?: string | null;
    } | null;
  } | null;
};

export type CfbKickReceipt = {
  kickingTeamId: string;
  receivingTeamId: string;
  /** Yards from the home end zone, same scale as situation.yardLine. */
  yardLine: number | null;
  /** ESPN spot after the kick, e.g. "FLA 31". */
  spot: string | null;
};

function teamId(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

export function isCfbKickoffOrPunt(typeText: string | null | undefined): boolean {
  return /kickoff|\bpunt\b/i.test(typeText ?? "");
}

function isScoringKick(play: NonNullable<CfbPossessionSnap["lastPlay"]>): boolean {
  if (play.scoringPlay) return true;
  if (/touchdown|\bsafety\b/i.test(play.type?.text ?? "")) return true;
  return /touchdown/i.test(play.text ?? "");
}

/**
 * Receiving team after a non-scoring kickoff or punt that changed hands.
 * Null for onside recoveries, scoring returns, and ordinary snaps.
 */
export function cfbKickReceipt(snap: CfbPossessionSnap | null | undefined): CfbKickReceipt | null {
  const play = snap?.lastPlay;
  if (!play || !isCfbKickoffOrPunt(play.type?.text)) return null;
  if (isScoringKick(play)) return null;
  const kickingTeamId = teamId(play.start?.team?.id);
  const receivingTeamId = teamId(play.end?.team?.id);
  if (!kickingTeamId || !receivingTeamId || kickingTeamId === receivingTeamId) return null;
  const yard = play.end?.yardLine;
  const spot = play.end?.possessionText?.trim() || null;
  return {
    kickingTeamId,
    receivingTeamId,
    yardLine: typeof yard === "number" && Number.isFinite(yard) ? yard : null,
    spot,
  };
}

/** Team id that should own the live possession football. */
export function cfbPossessionTeamId(snap: CfbPossessionSnap | null | undefined): string | null {
  const explicit = teamId(snap?.possession);
  const fallback = teamId(snap?.lastPlay?.team?.id);
  const receipt = cfbKickReceipt(snap);
  if (receipt && (!explicit || explicit === receipt.kickingTeamId)) {
    return receipt.receivingTeamId;
  }
  return explicit ?? fallback;
}

/** "FLA 31" → FLA. Null when the spot is not an abbreviation plus a yard line. */
export function abbrevFromCfbSpot(spot: string | null | undefined): string | null {
  const match = /^([A-Z][A-Z0-9&-]{1,7})\s+\d{1,2}$/.exec(spot?.trim() ?? "");
  return match?.[1] ?? null;
}
