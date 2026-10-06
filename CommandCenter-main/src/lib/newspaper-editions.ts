/**
 * Last-24-hours edition stand: which filed issues the Times may reopen,
 * how `?edition=` resolves, and the printed picker / folio copy.
 */
import { parsePressId, pressInstant, type PressSlot } from "./newspaper.ts";

export const EDITION_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export type FiledIssueMeta = {
  id: string;
  printedAt: string;
};

const SLOT_WORD: Record<PressSlot, string> = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
};

/** Instant the edition was published: `printed_at` when valid, else the press clock. */
export function issuePublishedAt(issue: { id: string; printedAt?: string | null }, fallback = 0): number {
  if (issue.printedAt) {
    const t = Date.parse(issue.printedAt);
    if (Number.isFinite(t)) return t;
  }
  return pressInstant(issue.id)?.getTime() ?? fallback;
}

export function isIssueWithinLookback(
  issue: { id: string; printedAt?: string | null },
  now = Date.now(),
  windowMs = EDITION_LOOKBACK_MS,
): boolean {
  if (!parsePressId(issue.id)) return false;
  const published = issuePublishedAt(issue, NaN);
  if (!Number.isFinite(published)) return false;
  return published <= now && now - published <= windowMs;
}

/** Ready issues from the last 24 hours, newest first. Older rows are dropped. */
export function filterRecentFiledIssues(
  rows: FiledIssueMeta[],
  now = Date.now(),
  windowMs = EDITION_LOOKBACK_MS,
): FiledIssueMeta[] {
  const seen = new Set<string>();
  return rows
    .filter((row) => isIssueWithinLookback(row, now, windowMs))
    .sort((a, b) => {
      const byTime = issuePublishedAt(b) - issuePublishedAt(a);
      if (byTime !== 0) return byTime;
      return b.id.localeCompare(a.id);
    })
    .filter((row) => {
      const parsed = parsePressId(row.id);
      const key = parsed ? `${parsed.day}-${parsed.slot}` : row.id;
      if (seen.has(key) || seen.has(row.id)) return false;
      seen.add(key);
      seen.add(row.id);
      return true;
    });
}

/**
 * `?edition=` is honored only when that id is in the last-24h stand.
 * Otherwise the newest filed issue wins. An empty stand has no selection.
 */
export function resolveEditionParam(
  requested: string | null | undefined,
  recent: FiledIssueMeta[],
): string | null {
  if (!recent.length) return null;
  if (requested && recent.some((row) => row.id === requested)) return requested;
  return recent[0]!.id;
}

export function editionSlotWord(id: string): string {
  const parsed = parsePressId(id);
  return parsed ? SLOT_WORD[parsed.slot] : id;
}

/** Picker label: "Morning", or "Sun. Evening · Oct 4" when a prior day is on the stand. */
export function editionPickerLabel(id: string, recent: FiledIssueMeta[]): string {
  const parsed = parsePressId(id);
  if (!parsed) return id;
  const word = SLOT_WORD[parsed.slot];
  const days = new Set(recent.map((row) => parsePressId(row.id)?.day).filter(Boolean));
  if (days.size <= 1) return word;
  const latestDay = parsePressId(recent[0]?.id ?? "")?.day;
  if (parsed.day === latestDay) return word;
  return `${weekdayShort(parsed.day)}. ${word} · ${monthDay(parsed.day)}`;
}

/**
 * Masthead folio for the edition on the page — one slot, that issue's date.
 * Never concatenates the 24-hour stand (Midday · Morning · Mon. Evening · Oct 5).
 */
export function editionFolioLine(id: string): string {
  const parsed = parsePressId(id);
  if (!parsed) return id;
  return `${SLOT_WORD[parsed.slot].toUpperCase()} · ${monthDay(parsed.day).toUpperCase()}`;
}

/**
 * One button per edition slot. Local + remote reprints of the same
 * morning / midday / evening were painting
 * EVENING · EVENING · MIDDAY · MIDDAY · MORNING.
 */
export function uniqueEditionStand(recent: FiledIssueMeta[], now = Date.now()): FiledIssueMeta[] {
  const filtered = filterRecentFiledIssues(recent, now);
  const seen = new Set<string>();
  return filtered.filter((row) => {
    const parsed = parsePressId(row.id);
    const slot = parsed?.slot ?? editionPickerLabel(row.id, filtered).toLowerCase();
    const label = editionPickerLabel(row.id, filtered).toLowerCase();
    if (seen.has(slot) || seen.has(label)) return false;
    seen.add(slot);
    seen.add(label);
    return true;
  });
}

export function backEditionNote(id: string, printedAt?: string | null): string {
  const parsed = parsePressId(id);
  const label = parsed?.label ?? "edition";
  return `You are reading the ${label}, printed ${formatPrintedClock(printedAt, id)}`;
}

export function formatPrintedClock(printedAt?: string | null, id?: string): string {
  const fromIso = printedAt ? new Date(printedAt) : null;
  const d = fromIso && !Number.isNaN(fromIso.getTime()) ? fromIso : id ? pressInstant(id) : null;
  if (!d) return "earlier";
  const raw = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return raw.replace(/\s/g, " ").replace(/\s*AM$/i, " a.m.").replace(/\s*PM$/i, " p.m.");
}

function weekdayShort(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).format(d);
}

function monthDay(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
  }).format(d);
}
