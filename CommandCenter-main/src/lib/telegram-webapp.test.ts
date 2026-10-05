/**
 * Run with: node --experimental-strip-types src/lib/telegram-webapp.test.ts
 * from CommandCenter-main/.
 */
import { activateTelegramWebApp, isTelegramWebView } from "./telegram-webapp.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(!isTelegramWebView(), "node tests are not a Telegram WebView");

const calls: string[] = [];
const ok = activateTelegramWebApp({
  ready: () => calls.push("ready"),
  expand: () => calls.push("expand"),
  disableVerticalSwipes: () => calls.push("noswipe"),
  setHeaderColor: (color) => calls.push(`header:${color}`),
  setBackgroundColor: (color) => calls.push(`bg:${color}`),
});
assert(ok, "activateTelegramWebApp should succeed with a stub");
assert(
  calls.join(",") === "ready,expand,noswipe,header:#081228,bg:#081228",
  `unexpected Telegram.WebApp calls: ${calls.join(",")}`,
);
