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

/**
 * How long after an edition goes ready the text alert waits for the image runner.
 * Matches the workflow's 12-minute job timeout, so a late Chromium install still
 * wins the ledger before text fires. GitHub's `schedule:` cron is not trusted.
 */
export const IMAGE_WAIT_MS = 12 * 60_000;

export const SHOTS_WORKFLOW_REPO = "mocards1776/CommandCenter";
export const SHOTS_WORKFLOW_FILE = "times-telegram-shots.yml";
export const SHOTS_WORKFLOW_REF = "main";

export function shotsDispatchUrl(): string {
  return `https://api.github.com/repos/${SHOTS_WORKFLOW_REPO}/actions/workflows/${SHOTS_WORKFLOW_FILE}/dispatches`;
}

export function shotsDispatchBody(issueId: string): { ref: string; inputs: { issue_id: string } } {
  return { ref: SHOTS_WORKFLOW_REF, inputs: { issue_id: issueId } };
}

/** GitHub returns 204 on queue; 422 when that workflow is already running. */
export function shotsDispatchAccepted(status: number, body = ""): boolean {
  if (status === 204 || status === 200) return true;
  return status === 422 && /already|running|limit/i.test(body);
}

export function kickedIssueFromDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const id = (detail as { kicked_issue?: unknown }).kicked_issue;
  return typeof id === "string" && id ? id : null;
}

export type ImageAlertDecision = "skip" | "send_text" | "wait" | "kick";

/**
 * One edition, one alert: images if the runner was kicked for this issue and is
 * still inside the wait window; text if that fails or times out. `kick` means
 * try workflow_dispatch; the caller sends text immediately when that fails so
 * Josh is never left without an alert.
 */
export function imageAlertDecision(input: {
  alreadyFinished: boolean;
  alreadyClaimed: boolean;
  printedAgeMs: number;
  kickedIssue: string | null;
  issueId: string;
}): ImageAlertDecision {
  if (input.alreadyFinished) return "skip";
  if (input.alreadyClaimed) return "send_text";
  if (input.printedAgeMs >= IMAGE_WAIT_MS) return "send_text";
  if (input.kickedIssue === input.issueId) return "wait";
  return "kick";
}
