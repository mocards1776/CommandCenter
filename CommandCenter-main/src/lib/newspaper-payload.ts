/**
 * A filed edition is read in two parallel requests: the stories (the paper)
 * and the desks (boards, tables, bodies). Both land before the paper opens.
 */

import type { PrintedQuery } from "./newspaper-issue.ts";

export const ISSUE_SHELL_COLUMNS = "version, status, stories, printed_at";

export const ISSUE_QUERY_COLUMNS = "version, status, queries";

export function queryDeskName(query: { key: unknown[] }): string | null {
  const name = query.key[1];
  return typeof name === "string" ? name : null;
}

export function mergeQueries(base: PrintedQuery[], extra: PrintedQuery[]): PrintedQuery[] {
  const byKey = new Map<string, PrintedQuery>();
  for (const query of base) byKey.set(JSON.stringify(query.key), query);
  for (const query of extra) byKey.set(JSON.stringify(query.key), query);
  return [...byKey.values()];
}
