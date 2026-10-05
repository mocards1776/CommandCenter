/**
 * A printed edition is a document: the stories and the desks, saved together
 * so opening the Times shows that issue instead of setting it again.
 */

import { isIssueWithinLookback } from "./newspaper-editions.ts";

export const ISSUE_VERSION = 1;

export type PrintedQuery = {
  key: unknown[];
  data: unknown;
};

export type IssueCompanions = {
  dayAhead?: unknown;
  national?: unknown;
  beez?: unknown;
};

export type PrintedIssue = {
  version: number;
  id: string;
  stories: unknown[];
  queries: PrintedQuery[];
  printedAt?: string;
  companions?: IssueCompanions;
};

const DB_NAME = "thompson-times";
const STORE = "issues";

function isQuery(value: unknown): value is PrintedQuery {
  if (!value || typeof value !== "object") return false;
  const row = value as { key?: unknown; data?: unknown };
  return Array.isArray(row.key);
}

/** Drop a stored row that is not this generation of the press file. */
export function asPrintedIssue(
  id: string,
  version: unknown,
  stories: unknown,
  queries: unknown,
  extra?: { printedAt?: unknown; companions?: unknown },
): PrintedIssue | null {
  if (version !== ISSUE_VERSION) return null;
  if (!Array.isArray(stories) || !Array.isArray(queries)) return null;
  const issue: PrintedIssue = {
    version: ISSUE_VERSION,
    id,
    stories,
    queries: queries.filter(isQuery),
  };
  if (typeof extra?.printedAt === "string" && extra.printedAt) issue.printedAt = extra.printedAt;
  if (extra?.companions && typeof extra.companions === "object") {
    issue.companions = extra.companions as IssueCompanions;
  }
  return issue;
}

/** Article HTML is what makes a press file huge. Copy is already on the story. */
export function slimIssue(issue: PrintedIssue, maxChars = 4_000_000): PrintedIssue {
  const cloned = JSON.parse(JSON.stringify(issue)) as PrintedIssue;
  let packed = JSON.stringify(cloned);
  if (packed.length <= maxChars) return cloned;
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    const rec = value as Record<string, unknown>;
    if ("contentHtml" in rec) delete rec.contentHtml;
    for (const child of Object.values(rec)) walk(child);
  };
  walk(cloned.queries);
  packed = JSON.stringify(cloned);
  if (packed.length <= maxChars) return cloned;
  cloned.queries = cloned.queries.filter((q) => {
    const head = q.key[1];
    return head !== "rss-article-v3";
  });
  return cloned;
}

/** Keep the issue being written plus any other cached issues still inside 24 hours. */
export function retainCachedIssues<T extends { id: string; printedAt?: string }>(
  rows: T[],
  keepId: string,
  now = Date.now(),
): T[] {
  return rows.filter((row) => row.id === keepId || isIssueWithinLookback(row, now));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function rowAsIssue(id: string, row: unknown): PrintedIssue | null {
  if (!row || typeof row !== "object") return null;
  const issue = row as PrintedIssue;
  return asPrintedIssue(id, issue.version, issue.stories, issue.queries, {
    printedAt: issue.printedAt,
    companions: issue.companions,
  });
}

export async function readLocalIssue(id: string): Promise<PrintedIssue | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const row = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    const issue = rowAsIssue(id, row);
    return issue && isIssueWithinLookback(issue) ? issue : null;
  } catch {
    return null;
  }
}

/** Every locally cached issue that is still a valid press file. */
export async function listLocalIssues(): Promise<PrintedIssue[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as unknown[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const raw = row as PrintedIssue;
      const issue = rowAsIssue(raw.id, raw);
      return issue ? [issue] : [];
    });
  } catch {
    return [];
  }
}

export async function writeLocalIssue(issue: PrintedIssue): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const slim = slimIssue(issue);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put(slim, slim.id);
    const all = store.getAll();
    all.onsuccess = () => {
      const kept = new Set(retainCachedIssues((all.result as PrintedIssue[]) ?? [], slim.id).map((row) => row.id));
      for (const row of (all.result as PrintedIssue[]) ?? []) {
        if (row?.id && !kept.has(row.id)) store.delete(row.id);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
