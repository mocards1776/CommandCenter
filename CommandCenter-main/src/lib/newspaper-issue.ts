/**
 * A printed edition is a document: the stories and the desks, saved together
 * so opening the Times shows that issue instead of setting it again.
 */

export const ISSUE_VERSION = 1;

export type PrintedQuery = {
  key: unknown[];
  data: unknown;
};

export type PrintedIssue = {
  version: number;
  id: string;
  stories: unknown[];
  queries: PrintedQuery[];
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
): PrintedIssue | null {
  if (version !== ISSUE_VERSION) return null;
  if (!Array.isArray(stories) || !Array.isArray(queries)) return null;
  return {
    version: ISSUE_VERSION,
    id,
    stories,
    queries: queries.filter(isQuery),
  };
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
    if (!row || typeof row !== "object") return null;
    const issue = row as PrintedIssue;
    return asPrintedIssue(id, issue.version, issue.stories, issue.queries);
  } catch {
    return null;
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
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      for (const key of keys.result) {
        if (key !== slim.id) store.delete(key);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
