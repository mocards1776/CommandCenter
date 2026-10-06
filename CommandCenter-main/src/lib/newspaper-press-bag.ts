/**
 * Checkpoint bag for the scheduled Times press.
 * Desks are flushed out of this object and stored separately so finalize
 * never JSON.parse/stringify megabytes of already-filed queries.
 */

export type PressBagRecord = {
  stage: number;
  [key: string]: unknown;
};

/** Source fields that have already been written to a desk and are not needed later. */
export const DROP_AFTER_FILE_DESKS = [
  "weather",
  "watch",
  "scoutItem",
  "openers",
  "org",
  "sheets",
  "recap",
  "wraps",
] as const;

/** After stories are gathered, the source desks are gone from the bag. */
export const DROP_AFTER_GATHER = ["details", "wire", "news", "teamCards", "leagueNews", "athletic", "snaps"] as const;

/** Merge-hop cursors. Gone once stage 12 has the filed story list. */
export const DROP_AFTER_MERGE = [
  "athletic",
  "clubCopy",
  "wireGames",
  "teamCards",
  "leagueNews",
  "enriched",
  "pool",
  "mergeStep",
  "wrapCursor",
  "restCursor",
  "keptWraps",
  "leftover",
  "tagCursor",
  "leagueCursor",
] as const;

/** Keys the next stage no longer reads. Applied on every checkpoint write. */
export function deadBagKeys(stage: number): readonly string[] {
  const dead: string[] = [];
  if (stage >= 10) dead.push(...DROP_AFTER_FILE_DESKS);
  if (stage >= 11) dead.push("details", "wire", "news");
  if (stage >= 12) dead.push(...DROP_AFTER_MERGE);
  if (stage >= 14) {
    dead.push(...DROP_AFTER_BOARD_DESKS);
    dead.push(...DROP_AFTER_GATHER);
  }
  if (stage >= 15) dead.push("raw", "extracts", "extractUrls", "extractCursor", "extractFileCursor");
  if (stage >= 16) dead.push("fresh", "missouri", "cleanCursor");
  if (stage >= 18) dead.push("dedupeQueue", "dedupeGroups", "dedupeCursor", "deskCopy");
  if (stage >= 19) dead.push("filed", "storyCursor");
  return dead;
}

/** Stage + sub-step cursor so a hop can log and a 546 retry can refuse to re-run. */
export function hopSignature(bag: Record<string, unknown> | null | undefined): string {
  if (!bag) return "0";
  const stage = typeof bag.stage === "number" ? bag.stage : 0;
  const keys = [
    "leagueCursor",
    "mergeStep",
    "wrapCursor",
    "restCursor",
    "tagCursor",
    "enrichCursor",
    "extractCursor",
    "extractFileCursor",
    "cleanCursor",
    "dedupeCursor",
    "storyCursor",
    "wireCursor",
  ] as const;
  return [stage, ...keys.map((key) => (bag[key] == null ? "" : String(bag[key])))].join(":");
}

export const DROP_AFTER_BOARD_DESKS = [
  "enriched",
  "board",
  "standings",
  "leaders",
  "playoffs",
  "leagueClubs",
  "leagueSlate",
  "coaches",
  "snaps",
  "heisman",
  "paths",
  "pathKey",
  "wireCursor",
  "leagueCursor",
  "enrichCursor",
] as const;

export function dropBagKeys<T extends Record<string, unknown>>(state: T, keys: readonly string[]): T {
  for (const key of keys) delete state[key];
  return state;
}

/** Bag the scheduled worker may persist. Desks live in `flush`, never here. */
export function checkpointBag<T extends PressBagRecord>(bag: T): T {
  const skip = new Set<string>(["stage", "queries", ...deadBagKeys(bag.stage)]);
  const next = { stage: bag.stage } as T;
  for (const [key, value] of Object.entries(bag)) {
    if (skip.has(key) || value === undefined) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}
