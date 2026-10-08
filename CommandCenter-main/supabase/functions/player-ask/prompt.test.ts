/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/player-ask/prompt.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isAskOwner, OWNER_EMAIL, OWNER_USER_ID } from "./owner.ts";
import { buildUserPrompt, citationsFrom, responseText, sanitizeContext, sanitizeQuestion } from "./prompt.ts";

test("owner gate accepts only Josh's auth user", () => {
  assert.equal(isAskOwner({ id: OWNER_USER_ID, email: OWNER_EMAIL }), true);
  assert.equal(isAskOwner({ id: OWNER_USER_ID, email: "Josh@ThompsonCommunications.net" }), true);
  assert.equal(isAskOwner({ id: OWNER_USER_ID, email: "other@example.com" }), false);
  assert.equal(isAskOwner({ id: "someone-else", email: OWNER_EMAIL }), false);
  assert.equal(isAskOwner({ id: OWNER_USER_ID, email: null }), false);
  assert.equal(isAskOwner(null), false);
});

test("context and question are clipped before they reach the model", () => {
  const ctx = sanitizeContext({
    name: "  Nolan   Gorman ",
    team: "St. Louis Cardinals",
    position: "3B",
    bio: "x".repeat(4000),
    seasonLabel: "2026",
    seasonStats: [
      { label: "HR", value: "22" },
      { label: "", value: "1" },
      ...Array.from({ length: 30 }, (_, i) => ({ label: `S${i}`, value: String(i) })),
    ],
    recentGames: [" vs CIN ", "", "y".repeat(400)],
  });
  assert.equal(ctx.name, "Nolan Gorman");
  assert.equal(ctx.bio.length, 3500);
  assert.equal(ctx.seasonStats[0]?.value, "22");
  assert.equal(ctx.seasonStats.length, 24);
  assert.equal(ctx.recentGames.length, 2);
  assert.equal(ctx.recentGames[1]?.length, 240);
  assert.equal(sanitizeQuestion("  is he   hurt?  "), "is he hurt?");
});

test("prompt carries the app packet and the question", () => {
  const prompt = buildUserPrompt(
    "Is he day to day?",
    sanitizeContext({
      name: "Nolan Gorman",
      team: "Cardinals",
      position: "3B",
      bio: "Left-handed hitter.",
      seasonLabel: "2026",
      seasonStats: [{ label: "HR", value: "22" }],
      recentGames: ["Oct 7 at MIL · 1-4"],
    }),
  );
  assert.match(prompt, /Nolan Gorman/);
  assert.match(prompt, /Left-handed hitter/);
  assert.match(prompt, /HR 22/);
  assert.match(prompt, /Oct 7 at MIL/);
  assert.match(prompt, /Is he day to day\?/);
});

test("citations come from the response list and annotations", () => {
  const sources = citationsFrom({
    citations: ["https://www.mlb.com/news/a", { url: "https://www.espn.com/mlb/story", title: "ESPN" }],
    output: [
      {
        content: [
          {
            annotations: [
              { url: "https://www.mlb.com/news/a", title: "dup" },
              { url: "https://www.rotowire.com/baseball/player.php", title: "RotoWire" },
            ],
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    sources.map((s) => s.url),
    [
      "https://www.mlb.com/news/a",
      "https://www.espn.com/mlb/story",
      "https://www.rotowire.com/baseball/player.php",
    ],
  );
  assert.equal(sources[1]?.title, "ESPN");
});

test("response text prefers output_text", () => {
  assert.equal(responseText({ output_text: " Day to day. " }), "Day to day.");
  assert.equal(
    responseText({ output: [{ content: [{ text: "Not sure." }] }] }),
    "Not sure.",
  );
});
