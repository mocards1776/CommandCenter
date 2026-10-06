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
export const DROP_AFTER_GATHER = ["details", "wire", "news", "teamCards", "leagueNews", "athletic"] as const;

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
] as const;

export function dropBagKeys<T extends Record<string, unknown>>(state: T, keys: readonly string[]): T {
  for (const key of keys) delete state[key];
  return state;
}

/** Bag the scheduled worker may persist. Desks live in `flush`, never here. */
export function checkpointBag<T extends PressBagRecord>(bag: T): T {
  const next = { stage: bag.stage } as T;
  for (const [key, value] of Object.entries(bag)) {
    if (key === "stage" || key === "queries" || value === undefined) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}
