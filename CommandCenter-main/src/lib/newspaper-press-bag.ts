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

/**
 * Live evening 2026-10-06 died on a 20-card extract-file slice (hop sig
 * `14:::::::20:100::::`). Skip at least that many so a retry cannot re-enter
 * the same fat transform after a 546.
 */
export const STUCK_EXTRACT_FILE_SKIP = 20;
/** After this many skip-forwards, dump the rest of extract-file and leave the stage. */
export const STUCK_HOP_SKIP_MAX = 3;

/**
 * Move the bag past a hop that already 546'd. Extract-file copies skipped
 * cards onto `fresh` so they still file (without the extract transform).
 */
export function advanceStuckBag(
  bag: Record<string, unknown> | null | undefined,
  opts?: { skipRemaining?: boolean },
): Record<string, unknown> {
  const state: Record<string, unknown> = { ...(bag ?? { stage: 0 }) };
  const stage = typeof state.stage === "number" ? state.stage : 0;
  state.stage = stage;

  if (stage === 14 && typeof state.extractFileCursor === "number") {
    const raw = Array.isArray(state.raw) ? (state.raw as unknown[]) : [];
    const from = state.extractFileCursor;
    const to = opts?.skipRemaining ? raw.length : Math.min(from + STUCK_EXTRACT_FILE_SKIP, raw.length);
    const skipped = raw.slice(from, to);
    const fresh = Array.isArray(state.fresh) ? (state.fresh as unknown[]) : [];
    state.fresh = [...fresh, ...skipped];
    if (!raw.length || to >= raw.length) {
      delete state.raw;
      delete state.extracts;
      delete state.extractUrls;
      delete state.extractCursor;
      delete state.extractFileCursor;
      state.stage = 15;
    } else {
      state.extractFileCursor = to;
    }
    return state;
  }

  if (stage === 14 && typeof state.extractCursor === "number") {
    const urls = Array.isArray(state.extractUrls) ? state.extractUrls.length : 0;
    const next = (state.extractCursor as number) + 4;
    state.extractCursor = urls ? Math.min(next, urls) : next;
    return state;
  }

  const cursorSteps: [string, number][] = [
    ["tagCursor", 20],
    ["cleanCursor", 20],
    ["dedupeCursor", 20],
    ["storyCursor", 20],
    ["enrichCursor", 2],
    ["wrapCursor", 1],
    ["restCursor", 1],
    ["leagueCursor", 1],
    ["wireCursor", 1],
  ];
  for (const [key, step] of cursorSteps) {
    if (typeof state[key] === "number") {
      state[key] = (state[key] as number) + step;
      return state;
    }
  }

  state.stage = stage + 1;
  return state;
}

/**
 * Finalize must not treat an already-array `queries` as empty desks.
 * A second concurrent done hop used to wipe filed desks to `[]`.
 */
export function mergeFinalizeQueries(queries: unknown, flush: unknown[]): unknown[] {
  if (Array.isArray(queries) && queries.length > 0) return queries;
  const desks =
    queries && typeof queries === "object" && !Array.isArray(queries) && Array.isArray((queries as { desks?: unknown }).desks)
      ? (queries as { desks: unknown[] }).desks
      : [];
  return [...desks, ...flush];
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
