/** Helpers for the Thompson Times print edition. */

import { todayStr } from "./utils";

const TZ = "America/Chicago";

/** Edition label: weekday + long date in Central time. */
export function editionDateLabel(day = todayStr()): string {
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
export function editionDateline(day = todayStr()): string {
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
export function editionIssue(day = todayStr()): { volume: number; issue: number } {
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

/** Fit article copy onto a letter column page without mid-word cuts. */
export function clipArticleBody(
  body: string,
  maxWords: number,
): { text: string; truncated: boolean } {
  const words = body.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return { text: body.trim(), truncated: false };
  let text = words.slice(0, maxWords).join(" ");
  text = text.replace(/[,:;–—-]\s*$/, "");
  if (!/[.!?]"?$/.test(text)) text += "…";
  return { text, truncated: true };
}

const SMALL_NUMBERS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** Spell out small counts so the lede reads as copy, not as a stat line. */
export function countWord(n: number): string {
  return n >= 0 && n < SMALL_NUMBERS.length ? SMALL_NUMBERS[n]! : String(n);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type LedeFacts = {
  place: string;
  weather: { tempF: number; summary: string; highF: number | null; lowF: number | null } | null;
  dueToday: number;
  overdue: number;
  nextUp: string | null;
  events: number;
  firstEvent: { when: string; title: string } | null;
  habitsDone: number;
  habitsTotal: number;
  teamsInSeason: number;
  finals: number;
  pagesToday: number;
  pagesGoal: number | null;
};

/**
 * Turn the day's Command Center numbers into two paragraphs of running copy.
 * The front page needs prose to read like a paper; every fact here already
 * appears in a box further down, so nothing new is fetched for it.
 */
export function editionLede(f: LedeFacts): string[] {
  const first: string[] = [];

  if (f.weather) {
    const range =
      f.weather.highF != null && f.weather.lowF != null
        ? `, headed for ${f.weather.highF}° before falling back to ${f.weather.lowF}°`
        : "";
    first.push(
      `${f.place} woke to ${f.weather.tempF}° and ${f.weather.summary.toLowerCase()}${range}.`,
    );
  } else {
    first.push(`${f.place} opens the day with the weather desk still out.`);
  }

  const dated = f.dueToday + f.overdue;
  if (dated) {
    const late = f.overdue
      ? `, ${countWord(f.overdue)} of them already past due`
      : ", none of them late";
    first.push(
      `${sentenceCase(countWord(dated))} ${plural(dated, "item")} ${plural(dated, "carries", "carry")} a date${late}.`,
    );
  } else {
    first.push("Nothing on the desk carries a date, which is its own kind of news.");
  }

  if (f.nextUp) first.push(`The morning opens on ${f.nextUp}.`);

  const second: string[] = [];

  if (f.events && f.firstEvent) {
    second.push(
      `The day book holds ${countWord(f.events)} ${plural(f.events, "appointment")}, beginning with ${f.firstEvent.title} at ${f.firstEvent.when}.`,
    );
  } else if (f.events) {
    second.push(`The day book holds ${countWord(f.events)} ${plural(f.events, "appointment")}.`);
  } else {
    second.push("The day book is clear.");
  }

  if (f.habitsTotal) {
    second.push(
      `${sentenceCase(countWord(f.habitsDone))} of ${countWord(f.habitsTotal)} standing ${plural(f.habitsTotal, "habit")} ${plural(f.habitsDone, "is", "are")} already struck off.`,
    );
  }

  if (f.pagesToday) {
    const goal = f.pagesGoal ? ` against a goal of ${f.pagesGoal}` : "";
    second.push(`${f.pagesToday} pages read${goal}.`);
  }

  if (f.finals) {
    second.push(
      `${sentenceCase(countWord(f.finals))} ${plural(f.finals, "final")} landed overnight; ${countWord(f.teamsInSeason)} clubs remain in season on the sports page.`,
    );
  } else if (f.teamsInSeason) {
    second.push(
      `${sentenceCase(countWord(f.teamsInSeason))} ${plural(f.teamsInSeason, "club")} ${plural(f.teamsInSeason, "is", "are")} in season on the sports page.`,
    );
  }

  return [first.join(" "), second.join(" ")].filter((p) => p.trim().length > 0);
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
