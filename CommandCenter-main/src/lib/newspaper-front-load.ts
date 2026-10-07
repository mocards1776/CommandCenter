/**
 * Paint A1 from the front of a filed edition, then keep reading.
 * A morning file is ~325 stories / ~4MB with desks. The front slots are
 * near the start of `stories` (editorFront 0–2). The rest of the folio
 * fills in after that prefix is on screen.
 */

/** How many A1 slots the editor stamps (lead, second, third). */
export const FRONT_SLOTS = 3;
/**
 * If the lead is stamped but a later slot is missing, paint once this many
 * stories have been read so a short file still opens.
 */
export const FRONT_STORY_SCAN = 48;
/** Paint whatever is in hand once the scan passes this, stamps or not. */
export const FRONT_STORY_CAP = 64;

export type StreamedShell = {
  version: number;
  status: string;
  stories: unknown[];
  printedAt?: string;
};

function editorSlot(story: unknown): number | null {
  if (!story || typeof story !== "object") return null;
  const n = (story as { editorFront?: unknown }).editorFront;
  return typeof n === "number" && n >= 0 && n < FRONT_SLOTS ? n : null;
}

/** Index (1-based) where A1 can paint, or null if this file still needs more copy. */
function readyAt(stories: readonly unknown[]): number | null {
  const slots = new Set<number>();
  for (let i = 0; i < stories.length; i++) {
    const slot = editorSlot(stories[i]);
    if (slot != null) slots.add(slot);
    const count = i + 1;
    if (
      slots.size >= FRONT_SLOTS ||
      (count >= FRONT_STORY_SCAN && slots.has(0)) ||
      count >= FRONT_STORY_CAP
    ) {
      return count;
    }
  }
  return null;
}

/** The stories in hand are exactly an A1 prefix — not a longer folio. */
export function frontPrefixReady(stories: readonly unknown[]): boolean {
  const at = readyAt(stories);
  return at != null && at === stories.length;
}

/** How many leading stories A1 needs before the rest of the folio can wait. */
export function frontPrefixLength(stories: readonly unknown[]): number {
  return readyAt(stories) ?? stories.length;
}

/** Let the browser paint the prefix before the rest of the file is parsed. */
export function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      return;
    }
    setTimeout(resolve, 0);
  });
}

/**
 * End index (exclusive) of one JSON value, or -1 if `text` ends mid-value.
 * `start` may sit on whitespace.
 */
export function scanJsonValue(text: string, start: number): number {
  let i = start;
  while (i < text.length && /\s/.test(text[i]!)) i++;
  if (i >= text.length) return -1;
  const c = text[i]!;
  if (c === '"') {
    for (i++; i < text.length; i++) {
      if (text[i] === "\\") {
        i++;
        continue;
      }
      if (text[i] === '"') return i + 1;
    }
    return -1;
  }
  if (c === "{" || c === "[") {
    let depth = 0;
    let inStr = false;
    for (; i < text.length; i++) {
      const ch = text[i]!;
      if (inStr) {
        if (ch === "\\") {
          i++;
          continue;
        }
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    return -1;
  }
  const m = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
  if (!m) return -1;
  return i + m[0].length;
}

/**
 * Read a PostgREST object body (`version, status, stories, printed_at`)
 * from text chunks. Calls `onFront` with the A1 prefix once, then yields
 * so that paint can happen before the rest of the array is parsed.
 * Returns null if the row is not a ready issue or the body is cut off.
 */
export async function consumeIssueShellStream(
  chunks: AsyncIterable<string>,
  onFront?: (stories: unknown[]) => void | Promise<void>,
): Promise<StreamedShell | null> {
  let buf = "";
  let phase: "seek" | "stories" | "tail" = "seek";
  // Closures assign `phase`; read it through a function so the loop does not
  // keep the initial "seek" narrowing.
  const readPhase = () => phase;
  let cursor = 0;
  let version = NaN;
  let status = "";
  const stories: unknown[] = [];
  let emitted = false;
  let failed = false;
  let tail = "";

  const emitFront = async () => {
    if (emitted || !onFront || !frontPrefixReady(stories)) return;
    emitted = true;
    await onFront(stories.slice());
    await yieldToPaint();
  };

  const pump = async () => {
    if (phase === "seek") {
      const keyAt = buf.indexOf('"stories"');
      if (keyAt < 0) return;
      const bracket = buf.indexOf("[", keyAt);
      if (bracket < 0) return;
      const head = buf.slice(0, bracket);
      const statusMatch = /"status"\s*:\s*"([^"]*)"/.exec(head);
      const versionMatch = /"version"\s*:\s*(-?\d+)/.exec(head);
      if (!statusMatch || !versionMatch) return;
      status = statusMatch[1] ?? "";
      version = Number(versionMatch[1]);
      if (status !== "ready" || version !== 1) {
        phase = "tail";
        return;
      }
      phase = "stories";
      cursor = bracket + 1;
    }
    if (phase === "stories") {
      while (cursor < buf.length) {
        while (cursor < buf.length && /[\s,]/.test(buf[cursor]!)) cursor++;
        if (cursor >= buf.length) break;
        if (buf[cursor] === "]") {
          phase = "tail";
          tail = buf.slice(cursor + 1);
          cursor = buf.length;
          break;
        }
        const end = scanJsonValue(buf, cursor);
        if (end < 0) break;
        try {
          stories.push(JSON.parse(buf.slice(cursor, end)));
        } catch {
          failed = true;
          phase = "tail";
          return;
        }
        cursor = end;
        await emitFront();
        if (phase !== "stories") return;
      }
    }
  };

  for await (const chunk of chunks) {
    if (readPhase() === "tail" && status !== "ready") break;
    if (readPhase() === "tail") tail += chunk;
    else {
      buf += chunk;
      await pump();
    }
    if (readPhase() === "tail" && status !== "ready") return null;
  }
  if (failed || readPhase() !== "tail" || status !== "ready" || version !== 1) return null;
  const printed = /"printed_at"\s*:\s*"([^"]*)"/.exec(tail);
  const printedAt = printed?.[1] || undefined;
  return { version, status, stories, ...(printedAt ? { printedAt } : {}) };
}
