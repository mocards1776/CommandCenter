import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TodoistPriority } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Dates ────────────────────────────────────────────────────────────────
// Everything is anchored to Central time. Using UTC here is what made tasks
// flip to "tomorrow" at 6-7pm local in the old build.

const TZ = "America/Chicago";

/** Today as YYYY-MM-DD in Central time. en-CA gives ISO ordering. */
export function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function toDateStr(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Day of week 0-6 (Sun-Sat) in Central time. */
export function todayDow(): number {
  const s = new Date().toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(s);
}

export function isOverdue(due?: string | null): boolean {
  return !!due && due.slice(0, 10) < todayStr();
}

export function isToday(due?: string | null): boolean {
  return !!due && due.slice(0, 10) === todayStr();
}

/** Human due label: "Today", "Tomorrow", "3d overdue", or a short date. */
export function dueLabel(due?: string | null): string | null {
  if (!due) return null;
  const d = due.slice(0, 10);
  const today = todayStr();
  if (d === today) return "Today";

  const days = Math.round((Date.parse(d) - Date.parse(today)) / 86_400_000);
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days <= 7) return `${days}d`;
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Habits ───────────────────────────────────────────────────────────────

/** Is a habit scheduled for today, given its frequency? */
export function isDueToday(frequency: string, customDays?: number[] | null): boolean {
  const dow = todayDow();
  switch (frequency) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekends":
      return dow === 0 || dow === 6;
    case "custom":
      return (customDays ?? []).includes(dow);
    case "weekly":
      return true; // any day of the week counts
    default:
      return true;
  }
}

/**
 * Consecutive-day streak ending today or yesterday. Counting from yesterday
 * means a habit you haven't done *yet* today still shows its streak instead of
 * dropping to zero and looking broken.
 */
export function streakFrom(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates.map((d) => d.slice(0, 10)));

  const dayMs = 86_400_000;
  const todayMs = Date.parse(todayStr());
  let cursor = set.has(todayStr()) ? todayMs : todayMs - dayMs;

  let streak = 0;
  while (set.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak++;
    cursor -= dayMs;
  }
  return streak;
}

// ─── Display ──────────────────────────────────────────────────────────────

/** Todoist priority is inverted: 4 = urgent, 1 = none. */
export function priorityColor(p: TodoistPriority): string {
  return { 4: "var(--color-clay)", 3: "var(--color-gold)", 2: "var(--color-sky)", 1: "transparent" }[p];
}

export function priorityLabel(p: TodoistPriority): string {
  return { 4: "Urgent", 3: "High", 2: "Medium", 1: "Normal" }[p];
}

export function battingAvg(avg: number): string {
  if (!avg || avg <= 0) return ".000";
  return avg.toFixed(3).replace(/^0/, "");
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
