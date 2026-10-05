import assert from "node:assert/strict";
import { activateTelegramWebApp, isTelegramWebView } from "./telegram-webapp.ts";

assert.equal(isTelegramWebView(), false, "node tests are not a Telegram WebView");

const calls: string[] = [];
const ok = activateTelegramWebApp({
  ready: () => calls.push("ready"),
  expand: () => calls.push("expand"),
  disableVerticalSwipes: () => calls.push("noswipe"),
  setHeaderColor: (color) => calls.push(`header:${color}`),
  setBackgroundColor: (color) => calls.push(`bg:${color}`),
});
assert.equal(ok, true);
assert.deepEqual(calls, ["ready", "expand", "noswipe", "header:#081228", "bg:#081228"]);
