/** Helpers for the Thompson Times sports edition. */

const TZ = "America/Chicago";

/**
 * Three editions a day, Central time: the morning paper at 6, the midday paper
 * at noon, the evening paper at 5. Before 6 a.m. you still hold last night's.
 */
export const PRESS_HOURS = [
  { hour: 6, slot: "morning", label: "Morning Edition" },
  { hour: 12, slot: "midday", label: "Midday Edition" },
  { hour: 17, slot: "evening", label: "Evening Edition" },
] as const;

export type PressSlot = (typeof PRESS_HOURS)[number]["slot"];

export type PressEdition = {
  /** Stable for the whole press run, e.g. "2026-10-01-midday". */
  id: string;
  /** Dateline. Rolls with the morning paper, not at midnight. */
  day: string;
  slot: PressSlot;
  label: string;
  /** When the next edition is set, for the ear. */
  next: string;
};

/** The morning press is what starts a new dateline. */
export const EDITION_HOUR = PRESS_HOURS[0].hour;

/** Wall-clock hour (0-23) in Central time. hourCycle avoids Safari ignoring hour12:false. */
function centralHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hh = Number(parts.find((part) => part.type === "hour")?.value);
  if (!Number.isFinite(hh)) return 0;
  return hh % 24;
}

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Which edition is on the stand. Central calendar date, except between midnight
 * and the morning press you're still reading the previous day's paper.
 */
export function editionDay(now = new Date()): string {
  return pressEdition(now).day;
}

/** The edition currently on the stand, and which press run it came off. */
export function pressEdition(now = new Date()): PressEdition {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const hour = centralHour(now);
  const slot = [...PRESS_HOURS].reverse().find((p) => hour >= p.hour) ?? null;
  if (!slot) {
    const day = shiftDay(today, -1);
    const evening = PRESS_HOURS[PRESS_HOURS.length - 1]!;
    return { id: `${day}-${evening.slot}`, day, slot: evening.slot, label: evening.label, next: "6 a.m." };
  }
  const next = PRESS_HOURS.find((p) => p.hour > slot.hour);
  return {
    id: `${today}-${slot.slot}`,
    day: today,
    slot: slot.slot,
    label: slot.label,
    next: next ? (next.hour === 12 ? "noon" : "5 p.m.") : "6 a.m.",
  };
}

/** Milliseconds until the next press (6 a.m., noon, or 5 p.m. Central). */
export function msUntilNextPress(now = new Date()): number {
  const id = pressEdition(now).id;
  const step = 60_000;
  for (let t = now.getTime() + step; t < now.getTime() + 20 * 3_600_000; t += step) {
    if (pressEdition(new Date(t)).id !== id) return t - now.getTime();
  }
  return 6 * 3_600_000;
}

/** The night of games an edition covers: the day before its dateline. */
export function editionNewsDay(day = editionDay()): string {
  return shiftDay(day, -1);
}

/** Calendar day of an instant in Central time. Display strings are not dates. */
export function instantDay(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** How far back an edition reaches. Older than this only returns if it was never read. */
export const EDITION_HOURS = 18;

/** An unread story may return once, in the next edition, and then it is gone. */
export const HOLDOVER_HOURS = 36;

export function isDeskPress(pressId: string): boolean {
  return pressId.endsWith("-midday") || pressId.endsWith("-evening");
}

/** The press before this one. Morning carries the previous evening. */
export function previousPressId(pressId: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})-(morning|midday|evening)$/.exec(pressId);
  if (!match) return null;
  const day = match[1]!;
  const slot = match[2];
  if (slot === "midday") return `${day}-morning`;
  if (slot === "evening") return `${day}-midday`;
  return `${shiftDay(day, -1)}-evening`;
}

const PRESS_ID = /^(\d{4}-\d{2}-\d{2})-(morning|midday|evening)$/;

/** A filed issue id, or null if the string is not a press run. */
export function parsePressId(id: string): PressEdition | null {
  const match = PRESS_ID.exec(id);
  if (!match) return null;
  const day = match[1]!;
  const slot = match[2] as PressSlot;
  const spec = PRESS_HOURS.find((p) => p.slot === slot);
  if (!spec) return null;
  const next = PRESS_HOURS.find((p) => p.hour > spec.hour);
  return {
    id,
    day,
    slot,
    label: spec.label,
    next: next ? (next.hour === 12 ? "noon" : "5 p.m.") : "6 a.m.",
  };
}

/** Wall-clock press time in Central, as a real instant. A bare day is the 6 a.m. press. */
export function pressInstant(pressId: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:-(morning|midday|evening))?$/.exec(pressId);
  if (!match) return null;
  const day = match[1]!;
  const slot = match[2] ?? "morning";
  const hour = slot === "midday" ? 12 : slot === "evening" ? 17 : 6;
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  for (const offset of [5, 6, 4]) {
    const dt = new Date(Date.UTC(y, m - 1, d, hour + offset, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(dt);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const gotDay = `${get("year")}-${get("month")}-${get("day")}`;
    if (gotDay === day && Number(get("hour")) % 24 === hour) return dt;
  }
  return null;
}

/**
 * A story belongs in this edition when it was published in the 18 hours
 * before the press. A bare dateline is the 6 a.m. press of that day.
 */
export function withinEditionHours(iso: string | null | undefined, pressId: string): boolean {
  const end = pressInstant(pressId);
  if (!end || !iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const endMs = end.getTime();
  return t <= endMs && t >= endMs - EDITION_HOURS * 3_600_000;
}

/** A holdover is an unread story from the previous edition, still inside a day and a half. */
export function holdoverCovers(iso: string | null | undefined, pressId: string): boolean {
  const end = pressInstant(pressId);
  if (!end || !iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const endMs = end.getTime();
  return t <= endMs && t >= endMs - HOLDOVER_HOURS * 3_600_000;
}

/** Wire / recap / club wrap ids — one card per game, not news. */
export function isGameWrapStory(card: { id: string }): boolean {
  return /^(?:wire|recap|recent|wrap)-/.test(card.id);
}

function centralWeekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** The Saturday before `day`. On Saturday itself, the previous Saturday. */
export function previousSaturday(day: string): string {
  const wd = centralWeekday(day);
  return shiftDay(day, wd === 6 ? -7 : -(wd + 1));
}

function asPressId(pressId: string): string {
  return parsePressId(pressId) ? pressId : `${pressId}-morning`;
}

/**
 * When the game desk opens for this press. Morning papers cover every final
 * since the previous morning; Monday morning reaches back to Saturday
 * morning. College football keeps last Saturday through the next Saturday
 * morning so the week does not vanish on Tuesday.
 */
export function gameWindowStart(pressId: string, leaguePath?: string | null): Date | null {
  const parsed = parsePressId(asPressId(pressId));
  if (!parsed) return null;
  const { day, slot } = parsed;
  const wd = centralWeekday(day);
  if (leaguePath === "football/college-football") {
    if (slot !== "morning" && wd === 6) return pressInstant(`${day}-morning`);
    return pressInstant(`${previousSaturday(day)}-morning`);
  }
  if (slot === "morning" && wd === 1) return pressInstant(`${shiftDay(day, -2)}-morning`);
  if (slot === "morning") return pressInstant(`${shiftDay(day, -1)}-morning`);
  return pressInstant(`${day}-morning`);
}

/** A game wrap belongs in this edition when its kickoff is inside the news-day window. */
export function gameWrapCovers(
  iso: string | null | undefined,
  pressId: string,
  leaguePath?: string | null,
): boolean {
  const end = pressInstant(asPressId(pressId));
  const start = gameWindowStart(pressId, leaguePath);
  if (!end || !start || !iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t <= end.getTime() && t >= start.getTime();
}

/** Calendar days the wire should read for a league, inclusive of the dateline. */
export function wireBoardDays(day: string, pressId: string | undefined, leaguePath: string): string[] {
  const id = asPressId(pressId ?? `${day}-morning`);
  const start = gameWindowStart(id, leaguePath);
  const startDay = start ? start.toLocaleDateString("en-CA", { timeZone: TZ }) : editionNewsDay(day);
  const out: string[] = [];
  let cursor = startDay;
  for (let i = 0; i < 10; i++) {
    out.push(cursor);
    if (cursor >= day) break;
    cursor = shiftDay(cursor, 1);
  }
  if (!out.includes(day)) out.push(day);
  return [...new Set(out)];
}

/**
 * Whether a timestamp belongs in this edition: the 18 hours before its press.
 */
export function editionCovers(iso: string | null | undefined, edition = editionDay()): boolean {
  return withinEditionHours(iso, edition);
}

/**
 * Results use the same 18-hour press window as every other story.
 * Kept so older call sites still compile.
 */
export function editionCoversResult(iso: string | null | undefined, edition = editionDay()): boolean {
  return withinEditionHours(iso, edition);
}

/**
 * Game copy: a recap, a final with a score, or a headline that is the result.
 * A transaction, an injury note, or a preview is not.
 */
export function isResultCopy(input: {
  headline?: string | null;
  dek?: string | null;
  type?: string | null;
  status?: string | null;
  scoreLine?: string | null;
}): boolean {
  const kind = `${input.type ?? ""} ${input.status ?? ""}`.toLowerCase();
  if (/\brecap\b/.test(kind)) return true;
  if (
    input.status &&
    /final/i.test(input.status) &&
    input.scoreLine &&
    /\d/.test(input.scoreLine)
  ) {
    return true;
  }
  const hay = `${input.headline ?? ""} ${input.dek ?? ""}`.toLowerCase();
  return (
    /\bin (?:a |the )?(?:win|loss|defeat)\b/.test(hay) ||
    /\bwin (?:over|vs\.?|against)\b/.test(hay) ||
    /\b(?:beat|defeated|edged|routed|downed|topped) the\b/.test(hay) ||
    /\b(?:lifts|lifted)\b[^.]{0,48}\b(?:win|victory)\b/.test(hay) ||
    /\bposts? \d+ points\b/.test(hay) ||
    /\brecaps?\b/.test(hay) ||
    /\b\d{1,3}\s*[-–]\s*\d{1,3}\s+(?:win|loss|victory|defeat)\b/.test(hay)
  );
}

export type StoryIdentity = {
  id: string;
  headline: string;
  wrapHref?: string | null;
  gameHref?: string | null;
  gameId?: string | null;
  when?: string | null;
  holdover?: boolean;
  /** ESPN path, used to key college-football's longer weekend window. */
  leaguePath?: string | null;
};

/** Same shape `rss_reads` stores, so a story seen in the paper matches a story seen in Dispatch. */
export function canonicalReadUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") {
      u.hash = "";
      if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
      return u.toString();
    }
  } catch {
    /* keys that are not URLs */
  }
  return raw;
}

/** Every key a later edition can use to recognize this story. */
export function storyReadKeys(card: StoryIdentity): string[] {
  const keys: string[] = [`tt:id:${card.id}`];
  if (card.gameId) keys.push(`tt:game:${card.gameId}`);
  const url = card.wrapHref || (card.gameHref?.startsWith("http") ? card.gameHref : null);
  if (url) keys.push(canonicalReadUrl(url));
  const head = card.headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 72);
  if (head) keys.push(`tt:head:${head}`);
  return [...new Set(keys)];
}

export function storyWasRead(card: StoryIdentity, readKeys: ReadonlySet<string>): boolean {
  return storyReadKeys(card).some((key) => readKeys.has(key));
}

/**
 * Fresh copy from the last 18 hours, plus unread stories carried from the
 * previous edition. Anything already seen on screen stays out.
 */
export function fileEditionStories<T extends StoryIdentity>(opts: {
  fresh: T[];
  carried: T[];
  readKeys: ReadonlySet<string>;
  pressId: string;
}): T[] {
  const inWindow = (card: T) =>
    isGameWrapStory(card)
      ? gameWrapCovers(card.when, opts.pressId, card.leaguePath)
      : withinEditionHours(card.when, opts.pressId);
  const carryWindow = (card: T) =>
    isGameWrapStory(card)
      ? gameWrapCovers(card.when, opts.pressId, card.leaguePath)
      : holdoverCovers(card.when, opts.pressId);
  const stampOlderFinal = (card: T): T =>
    isGameWrapStory(card) && !withinEditionHours(card.when, opts.pressId)
      ? { ...withoutEditorStamps(card), holdover: true }
      : card;
  const fresh = opts.fresh
    .filter((card) => inWindow(card) && !storyWasRead(card, opts.readKeys))
    .map(stampOlderFinal);
  const seen = new Set(fresh.flatMap((card) => storyReadKeys(card)));
  const carried = opts.carried
    .filter(
      (card) =>
        carryWindow(card) &&
        !storyWasRead(card, opts.readKeys) &&
        !storyReadKeys(card).some((key) => seen.has(key)),
    )
    // The last edition's editor ranked last edition's paper.
    .map((card) => ({ ...withoutEditorStamps(card), holdover: true }));
  return [...fresh, ...carried];
}

/** A copy of the story without the AI editor's rank or spike. */
export function withoutEditorStamps<T extends object>(card: T): T {
  const copy = { ...card } as T & { editorRank?: unknown; editorFront?: unknown; editorSpiked?: unknown };
  delete copy.editorRank;
  delete copy.editorFront;
  delete copy.editorSpiked;
  return copy;
}

/** A dated wire item must fall in the press window. The day's list has no clock and stays. */
export function missouriItemInEdition(when: string | null | undefined, pressId: string): boolean {
  if (!when) return true;
  return withinEditionHours(when, pressId);
}

/** Drop Missouri items already seen. Unread items from the previous edition stay. */
export function fileMissouriItems<T extends { id: string; headline: string; url?: string | null }>(opts: {
  fresh: T[];
  carried: T[];
  readKeys: ReadonlySet<string>;
}): T[] {
  const ident = (item: T): StoryIdentity => ({
    id: item.id,
    headline: item.headline,
    wrapHref: item.url ?? null,
  });
  const fresh = opts.fresh.filter((item) => !storyWasRead(ident(item), opts.readKeys));
  const seen = new Set(fresh.flatMap((item) => storyReadKeys(ident(item))));
  const carried = opts.carried.filter(
    (item) => !storyWasRead(ident(item), opts.readKeys) && !storyReadKeys(ident(item)).some((key) => seen.has(key)),
  );
  return [...fresh, ...carried];
}

/** @deprecated The paper now goes to press three times a day. */
export function msUntilNextEdition(now = new Date()): number {
  return msUntilNextPress(now);
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** Volume numerals, the way a broadsheet prints them. */
export function romanNumeral(n: number): string {
  let rest = Math.max(0, Math.floor(n));
  let out = "";
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out || "—";
}

/** Edition label: weekday + long date in Central time. */
export function editionDateLabel(day = editionDay()): string {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Compact dateline for masthead rules. */
export function editionDateline(day = editionDay()): string {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
}

/** Volume = calendar year; issue = day-of-year in Central time. */
export function editionIssue(day = editionDay()): { volume: number; issue: number } {
  const [y, m, d] = day.split("-").map(Number);
  const start = Date.UTC(y!, 0, 0);
  const now = Date.UTC(y!, m! - 1, d!);
  const issue = Math.floor((now - start) / 86_400_000);
  return { volume: y!, issue };
}

export function battingAverageLabel(avg: number): string {
  if (!Number.isFinite(avg) || avg <= 0) return ".000";
  const s = avg.toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}

export function moneyCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${(n / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * How hard Section A should push a club. Home desk first, then Lions, Chiefs,
 * then soccer — matches the paper's real interest order.
 */
/** Clubs the reader follows for scores and tables only — the desk files no news on them. */
const NEWS_MUTED = new Set(["eng-arsenal"]);
const NEWS_MUTED_NAMES = /\barsenal\b/i;

export function isNewsMuted(card: {
  favoriteKey?: string | null;
  teamName?: string | null;
  headline?: string | null;
}): boolean {
  if (card.favoriteKey && NEWS_MUTED.has(card.favoriteKey)) return true;
  return NEWS_MUTED_NAMES.test(`${card.teamName ?? ""} ${card.headline ?? ""}`);
}

export function favoriteDeskWeight(key: string): number {
  if (key === "mlb-stl") return 100;
  if (key === "nhl-stl") return 100;
  if (key === "cfb-mizzou" || key === "cbb-mizzou") return 100;
  if (key === "nfl-det") return 70;
  if (key === "nfl-kc") return 50;
  if (key === "nfl-dal" || key === "nba-phi") return 45;
  if (key === "cfb-missouri-state" || key === "cbb-missouri-state") return 40;
  if (key === "eng-arsenal" || key === "eng-wrexham" || key === "eng-wolves") return 25;
  if (key.startsWith("eng-") || key.includes("soccer")) return 20;
  return 10;
}

/**
 * Split story copy so the front can tease and a later folio carries the rest.
 * Prefers paragraph, then sentence, then word boundaries.
 */
export function splitStoryCopy(
  text: string,
  teaserChars: number,
): { teaser: string; rest: string } {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return { teaser: "", rest: "" };
  if (raw.length <= teaserChars) return { teaser: raw, rest: "" };

  const window = raw.slice(0, teaserChars + 80);
  const para = window.lastIndexOf("\n\n");
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  const space = window.lastIndexOf(" ");
  let cut = teaserChars;
  if (para >= teaserChars * 0.45) cut = para;
  else if (sentence >= teaserChars * 0.55) cut = sentence + 1;
  else if (space >= teaserChars * 0.6) cut = space;

  const teaser = raw.slice(0, cut).trim();
  const rest = raw.slice(cut).trim();
  if (rest.length < 120) return { teaser: raw, rest: "" };
  return { teaser, rest };
}
