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
