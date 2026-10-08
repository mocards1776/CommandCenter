/**
 * Truman's Class, a small box on The Day Ahead for the school week of week_of.
 * Monday through Friday only. Never a front-page item.
 */
import { shiftYmd } from "./newspaper-races.ts";

export type ClassLearning = { subject: string; text: string };
export type ClassUpcoming = { date: string; text: string };

export type ClassNewsletter = {
  weekOf: string;
  teacher: string;
  learning: ClassLearning[];
  reminders: string[];
  upcoming: ClassUpcoming[];
};

export type ClassBox = {
  teacher: string;
  learning: ClassLearning[];
  reminders: string;
  upcoming: ClassUpcoming[];
};

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function str(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

function ymd(raw: unknown): string | null {
  const value = str(raw);
  return YMD.test(value) ? value : null;
}

export function asClassNewsletter(raw: unknown): ClassNewsletter | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const weekOf = ymd(row.week_of ?? row.weekOf);
  const teacher = str(row.teacher);
  if (!weekOf || !teacher) return null;
  const learning: ClassLearning[] = [];
  if (Array.isArray(row.learning)) {
    for (const item of row.learning) {
      if (!item || typeof item !== "object") continue;
      const bit = item as Record<string, unknown>;
      const subject = str(bit.subject);
      const text = str(bit.text);
      if (!subject || !text) continue;
      learning.push({ subject, text });
    }
  }
  const reminders = Array.isArray(row.reminders) ? row.reminders.map(str).filter(Boolean) : [];
  const upcoming: ClassUpcoming[] = [];
  if (Array.isArray(row.upcoming)) {
    for (const item of row.upcoming) {
      if (!item || typeof item !== "object") continue;
      const bit = item as Record<string, unknown>;
      const date = ymd(bit.date);
      const text = str(bit.text);
      if (!date || !text) continue;
      upcoming.push({ date, text });
    }
  }
  return { weekOf, teacher, learning, reminders, upcoming };
}

function weekday(date: string): number | null {
  if (!YMD.test(date)) return null;
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function mondayOf(date: string): string | null {
  const day = weekday(date);
  if (day == null) return null;
  return shiftYmd(date, day === 0 ? -6 : 1 - day);
}

/** True on Monday–Friday of the calendar week that contains week_of. */
export function classWeekday(weekOf: string, editionDate: string): boolean {
  const monday = mondayOf(weekOf);
  const friday = monday ? shiftYmd(monday, 4) : null;
  const day = weekday(editionDate);
  if (!monday || !friday || day == null) return false;
  return editionDate >= monday && editionDate <= friday && day >= 1 && day <= 5;
}

/**
 * The box for this edition, or null outside the school week.
 * At most three upcoming dates inside 14 days. Reminders share one line.
 * Lines that repeat a daily special already on the timetable are left out.
 */
export function classBoxFor(row: ClassNewsletter | null, editionDate: string, specials: string[] = []): ClassBox | null {
  if (!row || !classWeekday(row.weekOf, editionDate)) return null;
  const skip = new Set(specials.map((title) => title.replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean));
  const learning = row.learning.filter((item) => !skip.has(item.text.toLowerCase()) && !skip.has(item.subject.toLowerCase()));
  const horizon = shiftYmd(editionDate, 14);
  const upcoming = (horizon ? row.upcoming.filter((item) => item.date >= editionDate && item.date <= horizon) : [])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  return {
    teacher: row.teacher,
    learning,
    reminders: row.reminders.join(" · "),
    upcoming,
  };
}
