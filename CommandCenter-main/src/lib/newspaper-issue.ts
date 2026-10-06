/**
 * A printed edition is a document: the stories and the desks, saved together
 * so opening the Times shows that issue instead of setting it again.
 *
 * Cached files are per signed-in user. Sign-out clears that user's copies.
 */

import { isIssueWithinLookback } from "./newspaper-editions.ts";

export const ISSUE_VERSION = 1;
export const CACHE_USER_KEY = "tt-cache-user";

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
const DB_VERSION = 2;
const STORE = "issues";

function isQuery(value: unknown): value is PrintedQuery {
  if (!value || typeof value !== "object") return false;
  const row = value as { key?: unknown; data?: unknown };
  return Array.isArray(row.key);
}

/**
 * Ready issues store an array. While printing, the press may stash flushed
 * desks at `queries.desks` so finalize never reloads them.
 */
export function asFiledQueries(raw: unknown): PrintedQuery[] {
  if (Array.isArray(raw)) return raw.filter(isQuery);
  if (raw && typeof raw === "object") {
    const desks = (raw as { desks?: unknown }).desks;
    if (Array.isArray(desks)) return desks.filter(isQuery);
  }
  return [];
}

function stripArticleHtml(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) stripArticleHtml(item);
    return;
  }
  const rec = value as Record<string, unknown>;
  if ("contentHtml" in rec) delete rec.contentHtml;
  for (const child of Object.values(rec)) stripArticleHtml(child);
}

/** Slim one desk without cloning the rest of the edition. */
export function slimPrintedQuery(query: PrintedQuery): PrintedQuery {
  const packed = JSON.stringify(query);
  if (packed.length < 8_000) return query;
  const cloned = JSON.parse(packed) as PrintedQuery;
  stripArticleHtml(cloned.data);
  return cloned;
}

/** Drop a stored row that is not this generation of the press file. */
/** A headless proof can plant the filed edition on `window` when RLS blocks anon. */
export function asProofIssue(raw: unknown, id: string): PrintedIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as {
    id?: unknown;
    version?: unknown;
    status?: unknown;
    stories?: unknown;
    queries?: unknown;
    printedAt?: unknown;
    printed_at?: unknown;
  };
  const issueId = typeof row.id === "string" ? row.id : id;
  if (issueId !== id) return null;
  if (row.status != null && row.status !== "ready") return null;
  const printedAt =
    typeof row.printedAt === "string"
      ? row.printedAt
      : typeof row.printed_at === "string"
        ? row.printed_at
        : undefined;
  return asPrintedIssue(id, row.version ?? ISSUE_VERSION, row.stories, row.queries ?? [], { printedAt });
}

export function peekProofIssue(id: string): PrintedIssue | null {
  const raw = (globalThis as { __TT_PROOF_ISSUE__?: unknown }).__TT_PROOF_ISSUE__;
  return asProofIssue(raw, id);
}

export function asPrintedIssue(
  id: string,
  version: unknown,
  stories: unknown,
  queries: unknown,
  extra?: { printedAt?: unknown; companions?: unknown },
): PrintedIssue | null {
  if (version !== ISSUE_VERSION) return null;
  if (!Array.isArray(stories)) return null;
  const filed =
    Array.isArray(queries) || (queries && typeof queries === "object" && Array.isArray((queries as { desks?: unknown }).desks));
  if (!filed) return null;
  const issue: PrintedIssue = {
    version: ISSUE_VERSION,
    id,
    stories,
    queries: asFiledQueries(queries),
  };
  if (typeof extra?.printedAt === "string" && extra.printedAt) issue.printedAt = extra.printedAt;
  if (extra?.companions && typeof extra.companions === "object") {
    issue.companions = extra.companions as IssueCompanions;
  }
  return issue;
}

/** Article HTML is what makes a press file huge. Copy is already on the story. */
export function slimIssue(issue: PrintedIssue, maxChars = 4_000_000): PrintedIssue {
  const packed = JSON.stringify(issue);
  if (packed.length <= maxChars) {
    return { ...issue, stories: issue.stories, queries: issue.queries };
  }
  const queries = JSON.parse(JSON.stringify(issue.queries)) as PrintedQuery[];
  stripArticleHtml(queries);
  const next: PrintedIssue = { ...issue, queries };
  if (JSON.stringify(next).length <= maxChars) return next;
  next.queries = next.queries.filter((q) => q.key[1] !== "rss-article-v3");
  return next;
}

/** Keep the issue being written plus any other cached issues still inside 24 hours. */
export function retainCachedIssues<T extends { id: string; printedAt?: string }>(
  rows: T[],
  keepId: string,
  now = Date.now(),
): T[] {
  return rows.filter((row) => row.id === keepId || isIssueWithinLookback(row, now));
}

export function readCacheUserId(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const id = localStorage.getItem(CACHE_USER_KEY);
    return id && id.trim() ? id : null;
  } catch {
    return null;
  }
}

export function writeCacheUserId(userId: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (userId) localStorage.setItem(CACHE_USER_KEY, userId);
    else localStorage.removeItem(CACHE_USER_KEY);
  } catch {
    /* private mode */
  }
}

/** IndexedDB key: user + press id. A tab is not a valid user or press character. */
export function issueCacheKey(userId: string, id: string): string {
  return `${userId}\t${id}`;
}

export function issueCacheOwner(key: string): string | null {
  const i = key.indexOf("\t");
  return i > 0 ? key.slice(0, i) : null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      // v1 keys were bare press ids (any profile on the iPad). Drop them.
      if (event.oldVersion < 2) {
        req.transaction?.objectStore(STORE).clear();
      }
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

function resolveUser(userId?: string | null): string | null {
  return userId || readCacheUserId();
}

export async function readLocalIssue(id: string, userId?: string | null): Promise<PrintedIssue | null> {
  if (typeof indexedDB === "undefined") return null;
  const owner = resolveUser(userId);
  if (!owner) return null;
  try {
    const db = await openDb();
    const row = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(issueCacheKey(owner, id));
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

/** Every locally cached issue for this user that is still a valid press file. */
export async function listLocalIssues(userId?: string | null): Promise<PrintedIssue[]> {
  if (typeof indexedDB === "undefined") return [];
  const owner = resolveUser(userId);
  if (!owner) return [];
  try {
    const db = await openDb();
    const rows = await new Promise<{ key: IDBValidKey; value: unknown }[]>((resolve, reject) => {
      const out: { key: IDBValidKey; value: unknown }[] = [];
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(out);
        out.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.flatMap(({ key, value }) => {
      if (typeof key !== "string" || issueCacheOwner(key) !== owner) return [];
      if (!value || typeof value !== "object") return [];
      const raw = value as PrintedIssue;
      const issue = rowAsIssue(raw.id, raw);
      return issue ? [issue] : [];
    });
  } catch {
    return [];
  }
}

export async function writeLocalIssue(issue: PrintedIssue, userId?: string | null): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const owner = resolveUser(userId);
  if (!owner) return;
  const slim = slimIssue(issue);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put(slim, issueCacheKey(owner, slim.id));
    const cursor = store.openCursor();
    const mine: PrintedIssue[] = [];
    const keys: { key: IDBValidKey; id: string }[] = [];
    cursor.onsuccess = () => {
      const row = cursor.result;
      if (!row) {
        const kept = new Set(retainCachedIssues(mine, slim.id).map((item) => item.id));
        for (const item of keys) {
          if (!kept.has(item.id)) store.delete(item.key);
        }
        return;
      }
      if (typeof row.key === "string" && issueCacheOwner(row.key) === owner) {
        const value = row.value as PrintedIssue | undefined;
        if (value?.id) {
          mine.push(value);
          keys.push({ key: row.key, id: value.id });
        }
      }
      row.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Drop one user's cached editions, or every Times file when `userId` is omitted. */
export async function clearLocalIssues(userId?: string | null): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      if (!userId) {
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        return;
      }
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (typeof cursor.key === "string" && issueCacheOwner(cursor.key) === userId) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* private mode */
  }
}
