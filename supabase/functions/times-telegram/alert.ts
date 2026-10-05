// @deno-types="./front.bundle.d.ts"
import { frontStories, type FrontStory } from "./front.bundle.js";

/**
 * Shared by times-telegram (text alert) and times-telegram-shots (image alert):
 * the edition's name, A1's front, the caption, and the Read-the-paper button.
 */

export const APP_ORIGIN = "https://command-center-flax-gamma.vercel.app";
/**
 * The Times itself; /times.html is the Home Screen launcher and only redirects when standalone.
 * The paper always opens the edition currently on the stand (no per-issue URL), which is the
 * edition just alerted until the next press.
 */
export const PAPER_URL = `${APP_ORIGIN}/newspaper?solo=1`;

const SLOT_LABEL: Record<string, string> = {
  morning: "Morning Edition",
  midday: "Midday Edition",
  evening: "Evening Edition",
};

/** AP style, the way a masthead dateline reads. */
const AP_MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

export type { FrontStory };

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** "2026-10-05-morning" → "Monday Morning Edition" and "Oct. 5". */
export function editionTitle(id: string): { title: string; date: string } {
  const m = /^(\d{4}-\d{2}-\d{2})-(\w+)$/.exec(id);
  if (!m) return { title: "New Edition", date: "" };
  const d = new Date(`${m[1]}T12:00:00Z`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const date = `${AP_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return { title: `${weekday} ${SLOT_LABEL[m[2]] ?? "Edition"}`, date };
}

/** A1's lead plus up to two more front stories, as the paper sets them. */
export function frontFor(issue: { id: string; stories: unknown }): FrontStory[] {
  try {
    return frontStories(Array.isArray(issue.stories) ? issue.stories : [], issue.id);
  } catch (err) {
    console.error("times-telegram: front failed", issue.id, err instanceof Error ? err.message : String(err));
    return [];
  }
}

export function alertText(issueId: string, front: FrontStory[]): string {
  const { title, date } = editionTitle(issueId);
  const lines = [`📰 <b>Thompson Times</b>`, `<i>${escapeHtml(title)}${date ? ` · ${escapeHtml(date)}` : ""}</i>`];
  const [lead, ...rest] = front;
  if (lead) {
    lines.push("", `<b>${escapeHtml(clip(lead.headline, 200))}</b>`);
    if (rest.length) {
      lines.push("", "Also on the front:");
      for (const story of rest.slice(0, 2)) lines.push(`• ${escapeHtml(clip(story.headline, 140))}`);
    }
  } else {
    lines.push("", "The new edition is off the press.");
  }
  return lines.join("\n");
}

export function replyMarkup() {
  return { inline_keyboard: [[{ text: "Read the paper", web_app: { url: PAPER_URL } }]] };
}

/** When a runner heartbeat is fresher than this, the text alert waits for the image alert. */
export const RUNNER_FRESH_MS = 40 * 60_000;
/** How long after an edition goes ready the text alert waits for the image alert. */
export const IMAGE_WAIT_MS = 45 * 60_000;
