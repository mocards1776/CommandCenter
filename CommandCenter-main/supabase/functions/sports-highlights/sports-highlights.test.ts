/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/sports-highlights/sports-highlights.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { alertReplyMarkup, gameReplyMarkup } from "../_shared/telegram-markup.ts";
import {
  DEFAULT_HIGHLIGHTS_CHAT_ID,
  DEFAULT_LOOKBACK_HOURS,
  highlightCaption,
  highlightId,
  lookbackHours,
  nhlGamePath,
  parseChatIds,
  parseClockSeconds,
  parseTeamFilter,
  pickRailWrap,
  teamMatchesFilter,
  wrapCaption,
  wrapHighlightId,
  acceptScoringHighlight,
  type GameSides,
} from "./select.ts";
import { noticeMethod } from "./telegram.ts";
import {
  gameInLookback,
  isWatchableState,
  mapClubGame,
  sortClips,
  type ClubGame,
  type GoalClip,
} from "./nhl-clips.ts";

test("chat allowlist defaults to Josh's DM", () => {
  assert.deepEqual(parseChatIds(undefined), [DEFAULT_HIGHLIGHTS_CHAT_ID]);
  assert.deepEqual(parseChatIds("857547432, 99"), ["857547432"]);
  assert.deepEqual(parseChatIds("857547432,123456789"), ["857547432", "123456789"]);
});

test("team filter defaults to Blues and accepts STL or 19", () => {
  const unset = parseTeamFilter(undefined);
  assert.deepEqual(unset.nhlAbbrevs, ["STL"]);
  assert.ok(unset.espnAbbrevs.includes("STL"));
  const byId = parseTeamFilter("19");
  assert.deepEqual(byId.nhlAbbrevs, ["STL"]);
  assert.ok(byId.ids.includes("19"));
  const mixed = parseTeamFilter("nhl:STL, 19");
  assert.deepEqual(mixed.nhlAbbrevs, ["STL"]);
  assert.ok(teamMatchesFilter(unset, { abbrev: "STL", teamId: 19 }));
  assert.ok(!teamMatchesFilter(unset, { abbrev: "DAL", teamId: 25 }));
  assert.ok(teamMatchesFilter(parseTeamFilter("SJ"), { abbrev: "SJS" }));
});

const STL_AT_DAL: GameSides = {
  awayAbbrev: "STL",
  homeAbbrev: "DAL",
  awayId: "19",
  homeId: "25",
};

test("only Blues scoring highlightClips pass", () => {
  const blues = parseTeamFilter("STL");
  const good = acceptScoringHighlight(blues, STL_AT_DAL, {
    teamAbbrev: "STL",
    eventOwnerTeamId: 19,
    scorerTeamId: 19,
    goalModifier: "none",
    situationCode: "1551",
    isHome: false,
    highlightClip: 6406147120112,
  });
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.teamAbbrev, "STL");
    assert.equal(good.teamId, "19");
    assert.equal(good.clipId, "6406147120112");
  }

  const opponent = acceptScoringHighlight(blues, STL_AT_DAL, {
    teamAbbrev: "DAL",
    eventOwnerTeamId: 25,
    scorerTeamId: 25,
    goalModifier: "none",
    situationCode: "1551",
    isHome: true,
    highlightClip: 111,
  });
  assert.deepEqual(opponent, { ok: false, reason: "not-scoring-team" });

  const emptyNet = acceptScoringHighlight(blues, STL_AT_DAL, {
    teamAbbrev: "STL",
    eventOwnerTeamId: 19,
    scorerTeamId: 19,
    goalModifier: "empty-net",
    situationCode: "1560",
    isHome: false,
    highlightClip: 6406151827112,
  });
  assert.deepEqual(emptyNet, { ok: false, reason: "empty-net" });

  const pulledNet = acceptScoringHighlight(blues, STL_AT_DAL, {
    teamAbbrev: "STL",
    eventOwnerTeamId: 19,
    goalModifier: "none",
    situationCode: "1560",
    isHome: false,
    highlightClip: 222,
  });
  assert.deepEqual(pulledNet, { ok: false, reason: "empty-net" });

  const ownGoal = acceptScoringHighlight(blues, STL_AT_DAL, {
    teamAbbrev: "STL",
    eventOwnerTeamId: 19,
    scorerTeamId: 25,
    goalModifier: "none",
    situationCode: "1551",
    isHome: false,
    highlightClip: 333,
  });
  assert.deepEqual(ownGoal, { ok: false, reason: "own-goal" });

  const ownerOnly = acceptScoringHighlight(blues, STL_AT_DAL, {
    eventOwnerTeamId: 19,
    scorerTeamId: 19,
    goalModifier: "none",
    situationCode: "1551",
    highlightClip: 777,
  });
  assert.equal(ownerOnly.ok, true);
  if (ownerOnly.ok) assert.equal(ownerOnly.teamAbbrev, "STL");

  const mismatch = acceptScoringHighlight(blues, STL_AT_DAL, {
    teamAbbrev: "STL",
    eventOwnerTeamId: 25,
    scorerTeamId: 25,
    goalModifier: "none",
    situationCode: "1551",
    highlightClip: 444,
  });
  assert.deepEqual(mismatch, { ok: false, reason: "owner-mismatch" });

  const discreteOnly = acceptScoringHighlight(blues, STL_AT_DAL, {
    teamAbbrev: "STL",
    eventOwnerTeamId: 19,
    goalModifier: "none",
    situationCode: "1551",
    highlightClip: null,
  });
  assert.deepEqual(discreteOnly, { ok: false, reason: "no-highlight" });

  const unattributed = acceptScoringHighlight(blues, STL_AT_DAL, {
    goalModifier: "none",
    situationCode: "1551",
    highlightClip: 555,
  });
  assert.deepEqual(unattributed, { ok: false, reason: "unknown-team" });
});

test("caption stays short and names the opponent", () => {
  assert.equal(
    highlightCaption({ teamAbbrev: "STL", teamName: "Blues", scorer: "Mason McTavish", opponentAbbrev: "DAL" }),
    "Blues score — Mason McTavish vs DAL",
  );
  assert.equal(
    highlightCaption({ teamAbbrev: "STL", scorer: "Pius Suter", opponentAbbrev: "SJS" }),
    "Blues score — Pius Suter vs SJ",
  );
});

test("clip ids and game paths are stable", () => {
  assert.equal(highlightId(6406147120112), "nhl-6406147120112");
  assert.equal(nhlGamePath("401891782"), "/sports/nhl/game/401891782?solo=1");
  assert.equal(nhlGamePath(""), null);
  const share = "https://nhl.com/video/stl-dal-mctavish-scores-goal-6406147120112";
  const markup = gameReplyMarkup(
    "https://command-center-flax-gamma.vercel.app",
    nhlGamePath("401891782"),
    share,
  );
  assert.ok(markup?.includes("web_app"));
  assert.ok(markup?.includes("/sports/nhl/game/401891782?solo=1"));
  assert.ok(markup?.includes(share));
  assert.ok(markup?.includes("Watch clip"));
  assert.ok(!markup?.includes("RUWT"));
});

test("wraps use the Mini App game page and never sendVideo", () => {
  const both = pickRailWrap({
    threeMinRecap: 6406155298112,
    condensedGame: 6406151843112,
  });
  assert.deepEqual(both, { kind: "nhl-recap", clipId: "6406155298112" });
  assert.deepEqual(pickRailWrap({ condensedGame: 6406151843112 }), {
    kind: "nhl-condensed",
    clipId: "6406151843112",
  });
  assert.equal(pickRailWrap({}), null);
  assert.equal(pickRailWrap(null), null);
  assert.equal(wrapHighlightId("nhl-recap", "6406155298112"), "nhl-recap-6406155298112");
  assert.equal(wrapHighlightId("nhl-condensed", 6406151843112), "nhl-condensed-6406151843112");
  assert.equal(
    wrapCaption({ teamAbbrev: "STL", teamName: "Blues", opponentAbbrev: "DAL", kind: "nhl-recap" }),
    "Blues wrap vs DAL",
  );
  assert.equal(
    wrapCaption({ teamAbbrev: "STL", opponentAbbrev: "SJS", kind: "nhl-condensed" }),
    "Blues condensed wrap vs SJ",
  );
  const path = nhlGamePath("401891782");
  const markup = alertReplyMarkup("https://command-center-flax-gamma.vercel.app", path);
  const parsed = JSON.parse(markup ?? "{}") as {
    inline_keyboard?: { text?: string; web_app?: { url?: string }; url?: string }[][];
  };
  const row = parsed.inline_keyboard?.[0] ?? [];
  assert.deepEqual(row.map((button) => button.text), ["Open game", "RUWT board"]);
  assert.ok(row.every((button) => button.web_app?.url?.includes("?solo=1")));
  assert.ok(row[0]?.web_app?.url?.includes("/sports/nhl/game/401891782?solo=1"));
  assert.ok(row.every((button) => button.url == null));
  assert.equal(noticeMethod("https://cf-images.example/poster.jpg"), "sendPhoto");
  assert.equal(noticeMethod(null), "sendMessage");
  assert.equal(noticeMethod("http://cf-images.example/poster.jpg"), "sendMessage");
  assert.notEqual(noticeMethod("https://cf-images.example/poster.jpg"), "sendVideo");
});

test("lookback includes live games and recent starts", () => {
  assert.equal(lookbackHours(""), DEFAULT_LOOKBACK_HOURS);
  assert.equal(lookbackHours("48"), 48);
  assert.ok(isWatchableState("OFF"));
  assert.ok(isWatchableState("LIVE"));
  assert.ok(!isWatchableState("FUT"));
  const now = new Date("2026-10-05T18:00:00Z");
  const recent: ClubGame = {
    nhlGameId: "2026020020",
    gameDate: "2026-10-02",
    startIso: "2026-10-03T01:00:00Z",
    state: "OFF",
    live: false,
    finished: true,
    awayAbbrev: "STL",
    homeAbbrev: "DAL",
    awayName: "Blues",
    homeName: "Stars",
    awayId: "19",
    homeId: "25",
  };
  assert.equal(gameInLookback(recent, now, 72), true);
  assert.equal(gameInLookback(recent, now, 24), false);
  assert.equal(gameInLookback({ ...recent, live: true, state: "LIVE" }, now, 1), true);
});

test("club-schedule rows map and clips sort in period order", () => {
  const game = mapClubGame({
    id: 2026020020,
    gameDate: "2026-10-02",
    startTimeUTC: "2026-10-03T01:00:00Z",
    gameState: "OFF",
    awayTeam: { id: 19, abbrev: "STL", commonName: { default: "Blues" } },
    homeTeam: { id: 25, abbrev: "DAL", commonName: { default: "Stars" } },
  });
  assert.equal(game?.awayAbbrev, "STL");
  assert.equal(game?.homeName, "Stars");
  const clip = (period: number, clock: string, id: string): GoalClip => ({
    highlightId: `nhl-${id}`,
    clipId: id,
    nhlGameId: "2026020020",
    espnEventId: "401891782",
    teamAbbrev: "STL",
    opponentAbbrev: "DAL",
    scorer: "Player",
    caption: "Blues score — Player vs DAL",
    mp4: "https://example.com/a.mp4",
    poster: null,
    durationSec: 40,
    width: 1280,
    height: 720,
    periodNumber: period,
    timeInPeriod: clock,
    sharingUrl: null,
  });
  const ordered = sortClips([clip(3, "17:52", "c"), clip(1, "01:34", "a"), clip(2, "13:05", "b")]);
  assert.deepEqual(ordered.map((c) => c.clipId), ["a", "b", "c"]);
  assert.equal(parseClockSeconds("01:34"), 94);
});

test("live NHL landing still returns Blues MP4s", { timeout: 30_000 }, async () => {
  const { fetchGoalClipsForGame, loadBrightcoveMp4, resolveEspnEventId } = await import("./nhl-clips.ts");
  const game = mapClubGame({
    id: 2026020020,
    gameDate: "2026-10-02",
    startTimeUTC: "2026-10-03T01:00:00Z",
    gameState: "OFF",
    awayTeam: { id: 19, abbrev: "STL", commonName: { default: "Blues" } },
    homeTeam: { id: 25, abbrev: "DAL", commonName: { default: "Stars" } },
  });
  assert.ok(game);
  const espnId = await resolveEspnEventId(game!);
  assert.equal(espnId, "401891782");
  const clips = await fetchGoalClipsForGame(game!, parseTeamFilter("STL"), espnId);
  assert.ok(clips.length >= 2, `expected Blues goals, got ${clips.length}`);
  assert.ok(clips.every((c) => c.teamAbbrev === "STL"));
  assert.ok(clips.every((c) => /^https:\/\/.+\.mp4(\?|$)/i.test(c.mp4)));
  assert.equal(clips[0]!.caption, "Blues score — Mason McTavish vs DAL");
  assert.ok(!clips.some((c) => c.clipId === "6406151827112" || c.clipId === "6406155078112"));
  assert.ok(!clips.some((c) => /snuggerud|suter/i.test(c.scorer)));
  const head = await fetch(clips[0]!.mp4, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
  assert.ok(head.ok, `mp4 HEAD ${head.status}`);
  const bc = await loadBrightcoveMp4(clips[0]!.clipId);
  assert.ok(bc?.mp4);
});

test("a game still in progress has no wrap", async () => {
  const { fetchWrapForGame } = await import("./nhl-clips.ts");
  const game = mapClubGame({
    id: 2026020020,
    gameDate: "2026-10-02",
    startTimeUTC: "2026-10-03T01:00:00Z",
    gameState: "LIVE",
    awayTeam: { id: 19, abbrev: "STL", commonName: { default: "Blues" } },
    homeTeam: { id: 25, abbrev: "DAL", commonName: { default: "Stars" } },
  });
  assert.equal(game?.finished, false);
  assert.equal(await fetchWrapForGame(game!, parseTeamFilter("STL"), "401891782"), null);
});

test("live NHL right-rail wrap is a Mini App notice, not an MP4", { timeout: 30_000 }, async () => {
  const { fetchWrapForGame } = await import("./nhl-clips.ts");
  const game = mapClubGame({
    id: 2026020020,
    gameDate: "2026-10-02",
    startTimeUTC: "2026-10-03T01:00:00Z",
    gameState: "OFF",
    awayTeam: { id: 19, abbrev: "STL", commonName: { default: "Blues" } },
    homeTeam: { id: 25, abbrev: "DAL", commonName: { default: "Stars" } },
  });
  assert.ok(game);
  const wrap = await fetchWrapForGame(game!, parseTeamFilter("STL"), "401891782");
  assert.ok(wrap);
  assert.equal(wrap!.kind, "nhl-recap");
  assert.equal(wrap!.clipId, "6406155298112");
  assert.equal(wrap!.highlightId, "nhl-recap-6406155298112");
  assert.equal(wrap!.caption, "Blues wrap vs DAL");
  assert.equal(wrap!.teamAbbrev, "STL");
  assert.equal(wrap!.gamePath, "/sports/nhl/game/401891782?solo=1");
  assert.equal(wrap!.sharingUrl, null);
  assert.equal("mp4" in wrap!, false);
  assert.ok(noticeMethod(wrap!.poster) === "sendPhoto" || noticeMethod(wrap!.poster) === "sendMessage");
  if (wrap!.poster) assert.match(wrap!.poster, /^https:\/\//);
  const markup = JSON.parse(
    alertReplyMarkup("https://command-center-flax-gamma.vercel.app", wrap!.gamePath) ?? "{}",
  ) as { inline_keyboard?: { web_app?: { url?: string }; url?: string }[][] };
  const row = markup.inline_keyboard?.[0] ?? [];
  assert.ok(row[0]?.web_app?.url?.endsWith("/sports/nhl/game/401891782?solo=1"));
  assert.ok(row.every((button) => button.url == null));
});
