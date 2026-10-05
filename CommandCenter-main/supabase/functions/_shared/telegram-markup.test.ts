/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/_shared/telegram-markup.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alertReplyMarkup,
  gameDetailUrl,
  clipShareUrl,
  gameReplyMarkup,
  ruwtBoardUrl,
  telegramInlineKeyboard,
} from "./telegram-markup.ts";

type MiniAppButton = {
  text: string;
  url?: string;
  web_app?: { url: string };
};

function parseRow(markup: string | null): MiniAppButton[] {
  assert.ok(markup);
  const parsed = JSON.parse(markup!) as { inline_keyboard: MiniAppButton[][] };
  assert.equal(parsed.inline_keyboard.length, 1);
  return parsed.inline_keyboard[0]!;
}

test("heat and finals buttons are Mini Apps, not Safari url buttons", () => {
  const row = parseRow(
    alertReplyMarkup(
      "https://command-center-flax-gamma.vercel.app/",
      "/sports/nfl/game/1?solo=1",
    ),
  );
  assert.deepEqual(
    row.map((button) => button.text),
    ["Open game", "RUWT board"],
  );
  assert.equal(
    row[0]!.web_app?.url,
    "https://command-center-flax-gamma.vercel.app/sports/nfl/game/1?solo=1",
  );
  assert.equal(
    row[1]!.web_app?.url,
    "https://command-center-flax-gamma.vercel.app/sports/ruwt?solo=1",
  );
  for (const button of row) {
    assert.equal(button.url, undefined);
    assert.ok(button.web_app?.url?.includes("solo=1"));
  }
});

test("missing game path still ships the RUWT Mini App button", () => {
  const row = parseRow(alertReplyMarkup("https://command-center-flax-gamma.vercel.app", ""));
  assert.deepEqual(
    row.map((button) => button.text),
    ["RUWT board"],
  );
  assert.equal(row[0]!.web_app?.url, ruwtBoardUrl("https://command-center-flax-gamma.vercel.app"));
  assert.equal(row[0]!.url, undefined);
});

test("non-https destinations are dropped instead of becoming url buttons", () => {
  assert.equal(telegramInlineKeyboard([{ text: "Open game", url: "http://localhost/sports" }]), null);
  assert.equal(telegramInlineKeyboard([{ text: "", url: "https://command-center-flax-gamma.vercel.app/sports" }]), null);
});

test("game paths keep query params including solo=1", () => {
  assert.equal(
    gameDetailUrl("https://command-center-flax-gamma.vercel.app", "/sports/nhl/game/9?solo=1"),
    "https://command-center-flax-gamma.vercel.app/sports/nhl/game/9?solo=1",
  );
});

test("highlight videos ship only the Open game Mini App button", () => {
  const row = parseRow(
    gameReplyMarkup("https://command-center-flax-gamma.vercel.app", "/sports/nhl/game/401891782?solo=1"),
  );
  assert.deepEqual(
    row.map((button) => button.text),
    ["Open game"],
  );
  assert.equal(
    row[0]!.web_app?.url,
    "https://command-center-flax-gamma.vercel.app/sports/nhl/game/401891782?solo=1",
  );
  assert.equal(row[0]!.url, undefined);
  assert.equal(gameReplyMarkup("https://command-center-flax-gamma.vercel.app", ""), null);
});

test("highlight messages add a Watch clip link when the NHL share URL is present", () => {
  const share = "https://nhl.com/video/stl-dal-mctavish-scores-goal-6406147120112";
  assert.equal(clipShareUrl(share), share);
  assert.equal(clipShareUrl("http://nhl.com/video/nope"), null);
  assert.equal(clipShareUrl("https://example.com/video/nope"), null);
  const row = parseRow(
    gameReplyMarkup(
      "https://command-center-flax-gamma.vercel.app",
      "/sports/nhl/game/401891782?solo=1",
      share,
    ),
  );
  assert.deepEqual(
    row.map((button) => button.text),
    ["Open game", "Watch clip"],
  );
  assert.equal(row[0]!.url, undefined);
  assert.ok(row[0]!.web_app?.url?.includes("/sports/nhl/game/401891782?solo=1"));
  assert.equal(row[1]!.url, share);
  assert.equal(row[1]!.web_app, undefined);
  const clipOnly = parseRow(gameReplyMarkup("", null, share));
  assert.deepEqual(
    clipOnly.map((button) => button.text),
    ["Watch clip"],
  );
  assert.equal(clipOnly[0]!.url, share);
});
