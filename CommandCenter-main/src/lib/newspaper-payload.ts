/**
 * Stage a filed edition so A1 can print before the heaviest desks arrive.
 *
 * Wrap bodies and league-news dumps are megabytes and wait. The scoreboard
 * is also large, but A1's lead is last night's favorite result — it lives
 * on tt-board, so the front asks for that desk on the first paint.
 */

import type { PrintedQuery } from "./newspaper-issue.ts";

/** Desk names that wait until after first paint, or until a folio / reader needs them. */
export const HEAVY_DESK_NAMES = ["tt-wrap-bodies", "tt-board", "tt-league-news"] as const;

export type HeavyDeskName = (typeof HEAVY_DESK_NAMES)[number];

const HEAVY = new Set<string>(HEAVY_DESK_NAMES);

/** Columns for the first edition request: the paper, not the desks. */
export const ISSUE_SHELL_COLUMNS = "version, status, stories, printed_at";

/** Columns for the follow-up desk request. Stories are already on screen. */
export const ISSUE_QUERY_COLUMNS = "version, status, queries";

export function queryDeskName(query: { key: unknown[] }): string | null {
  const name = query.key[1];
  return typeof name === "string" ? name : null;
}

export function isHeavyDesk(name: string | null | undefined): name is HeavyDeskName {
  return typeof name === "string" && HEAVY.has(name);
}

export function splitQueries(queries: PrintedQuery[]): { light: PrintedQuery[]; heavy: PrintedQuery[] } {
  const light: PrintedQuery[] = [];
  const heavy: PrintedQuery[] = [];
  for (const query of queries) {
    if (isHeavyDesk(queryDeskName(query))) heavy.push(query);
    else light.push(query);
  }
  return { light, heavy };
}

export function mergeQueries(base: PrintedQuery[], extra: PrintedQuery[]): PrintedQuery[] {
  const byKey = new Map<string, PrintedQuery>();
  for (const query of base) byKey.set(JSON.stringify(query.key), query);
  for (const query of extra) byKey.set(JSON.stringify(query.key), query);
  return [...byKey.values()];
}

/** A1, sport fronts, and recap folios need the raw board for the lead and boxes. */
export function heavyDesksForPage(page: { kind: string } | null | undefined): HeavyDeskName[] {
  if (!page) return [];
  switch (page.kind) {
    case "favorites-front":
    case "sport-front":
    case "sport-inside":
    case "favorites-inside":
    case "favorites-continue":
      return ["tt-board"];
    default:
      return [];
  }
}

/** The full-story reader wants wrap bodies (and the board when a recap has a box). */
export function heavyDesksForReader(): HeavyDeskName[] {
  return ["tt-wrap-bodies", "tt-board"];
}

export function pickQueriesNamed(queries: PrintedQuery[], names: readonly string[]): PrintedQuery[] {
  const want = new Set(names);
  return queries.filter((query) => {
    const name = queryDeskName(query);
    return name != null && want.has(name);
  });
}
