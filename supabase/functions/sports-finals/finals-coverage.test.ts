/**
 * NFL + Power 4 coverage, sweep fan-out, and render-before-claim.
 *
 * Run with:
 *   node --experimental-strip-types supabase/functions/sports-finals/finals-coverage.test.ts
 */
import assert from "node:assert/strict";
import type { PushGame } from "../sports-push/live-drama.ts";
import {
  CFB_BOARD_LIMIT,
  CFB_FBS_GROUP,
  cfbFbsScoreboardUrl,
  fetchPower4Cfb,
  finalsBoardDays,
  isPower4Team,
  mergeFinalsBoards,
  power4CfbFromScoreboard,
} from "./finals-boards.ts";
import { alwaysSendsFinal, parseScope, shouldSendFinal, type WatchSnap } from "./select.ts";
import {
  deliverOnce,
  MAX_SENDS,
  parseDeliverResponse,
  planSweep,
  runDeliveries,
  type DeliverOutcome,
} from "./sweep.ts";
import { sendPreparedAlbum, sendPreparedPhoto } from "./telegram.ts";

type Team = { id: string; abbrev: string; conf: string };

const TEAMS: Record<string, Team> = {
  TAMU: { id: "245", abbrev: "TA&M", conf: "8" },
  MIZ: { id: "142", abbrev: "MIZ", conf: "8" },
  BALL: { id: "2050", abbrev: "BALL", conf: "15" },
  NU: { id: "77", abbrev: "NU", conf: "5" },
  STAN: { id: "24", abbrev: "STAN", conf: "1" },
  ND: { id: "87", abbrev: "ND", conf: "18" },
  CONN: { id: "41", abbrev: "CONN", conf: "18" },
  AKR: { id: "2006", abbrev: "AKR", conf: "15" },
  KENT: { id: "2309", abbrev: "KENT", conf: "15" },
  WSU: { id: "265", abbrev: "WSU", conf: "9" },
  BOIS: { id: "68", abbrev: "BOIS", conf: "9" },
  HAW: { id: "62", abbrev: "HAW", conf: "17" },
  ASU: { id: "9", abbrev: "ASU", conf: "4" },
};

function espnEvent(id: string, away: Team, home: Team, state = "post") {
  const competitor = (team: Team, homeAway: string, score: number) => ({
    homeAway,
    score: String(score),
    curatedRank: { current: 99 },
    team: {
      id: team.id,
      abbreviation: team.abbrev,
      shortDisplayName: team.abbrev,
      conferenceId: team.conf,
    },
  });
  return {
    id,
    date: "2026-10-10T16:00Z",
    competitions: [
      {
        id,
        status: { period: 4, type: { state, completed: state === "post", shortDetail: state === "post" ? "Final" : "Q4" } },
        competitors: [competitor(away, "away", 6), competitor(home, "home", 27)],
      },
    ],
  };
}

function pushGame(sport: string, id: string, opts: Partial<PushGame> = {}): PushGame {
  return {
    sport,
    id,
    live: false,
    final: true,
    detail: "Final",
    period: 4,
    redZone: false,
    downDistance: null,
    when: null,
    broadcasts: [],
    league: null,
    homeWinPct: null,
    awayWinPct: null,
    away: { id: `${id}a`, abbrev: "AWY", name: "Away", score: 10, logo: null },
    home: { id: `${id}h`, abbrev: "HOM", name: "Home", score: 20, logo: null },
    ...opts,
  } as PushGame;
}

// --- Power 4 board ---------------------------------------------------------

assert.equal(isPower4Team({ id: "245", conferenceId: "8" }), true, "SEC");
assert.equal(isPower4Team({ id: "77", conferenceId: 5 }), true, "Big Ten (numeric id)");
assert.equal(isPower4Team({ id: "24", conferenceId: "1" }), true, "ACC");
assert.equal(isPower4Team({ id: "9", conferenceId: "4" }), true, "Big 12");
assert.equal(isPower4Team({ id: "87", conferenceId: "18" }), true, "Notre Dame is an independent");
assert.equal(isPower4Team({ id: "41", conferenceId: "18" }), false, "UConn is not");
assert.equal(isPower4Team({ id: "265", conferenceId: "9" }), false, "Pac-12 is not Power 4");
assert.equal(isPower4Team({ id: "2050", conferenceId: "15" }), false, "MAC");
assert.equal(isPower4Team(undefined), false);

{
  const games = power4CfbFromScoreboard({
    events: [
      espnEvent("401856716", TEAMS.TAMU, TEAMS.MIZ),
      espnEvent("401858482", TEAMS.BALL, TEAMS.NU),
      espnEvent("401858257", TEAMS.STAN, TEAMS.ND),
      espnEvent("401856808", TEAMS.HAW, TEAMS.ASU),
      espnEvent("900000001", TEAMS.AKR, TEAMS.KENT),
      espnEvent("900000002", TEAMS.WSU, TEAMS.BOIS),
      espnEvent("900000003", TEAMS.CONN, TEAMS.AKR),
    ],
  });
  assert.deepEqual(
    games.map((g) => g.id),
    ["401856716", "401858482", "401858257", "401856808"],
    "SEC game, P4 vs MAC, Notre Dame, and P4 vs MWC stay; G5-only and Pac-12 games drop",
  );
  assert.equal(games[0]!.sport, "cfb");
  assert.equal(games[0]!.final, true);
  assert.equal(games[0]!.home.score, 27);
}
assert.deepEqual(power4CfbFromScoreboard(null), []);

{
  const url = new URL(cfbFbsScoreboardUrl("20261010"));
  assert.equal(url.pathname.endsWith("/football/college-football/scoreboard"), true);
  assert.equal(url.searchParams.get("dates"), "20261010");
  assert.equal(url.searchParams.get("groups"), CFB_FBS_GROUP);
  assert.equal(CFB_FBS_GROUP, "80");
  assert.equal(Number(url.searchParams.get("limit")), CFB_BOARD_LIMIT);
  assert.ok(CFB_BOARD_LIMIT >= 100);
}

// Sunday 1:30am CT still loads Saturday, so late Saturday finals are seen.
assert.deepEqual(finalsBoardDays(new Date("2026-10-11T06:30:00Z")), ["20261011", "20261010"]);
assert.deepEqual(finalsBoardDays(new Date("2026-10-10T22:00:00Z")), ["20261010", "20261009"]);

{
  const urls: string[] = [];
  const fakeFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("dates=20261009")) return new Response("boom", { status: 503 });
    return new Response(
      JSON.stringify({ events: [espnEvent("401856716", TEAMS.TAMU, TEAMS.MIZ), espnEvent("900000001", TEAMS.AKR, TEAMS.KENT)] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  const games = await fetchPower4Cfb(new Date("2026-10-10T22:00:00Z"), fakeFetch);
  assert.equal(urls.length, 2, "today and yesterday");
  assert.ok(urls.every((u) => u.includes("groups=80")));
  assert.deepEqual(games.map((g) => g.id), ["401856716"], "a failed day is skipped, not fatal");
}

{
  const throwing = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  assert.deepEqual(await fetchPower4Cfb(new Date("2026-10-10T22:00:00Z"), throwing), []);
}

{
  const ranked = pushGame("cfb", "401856717");
  const g5Ranked = pushGame("cfb", "401860901");
  const nfl = pushGame("nfl", "401872990");
  const p4Only = pushGame("cfb", "401858480");
  const merged = mergeFinalsBoards([nfl, ranked, g5Ranked], [ranked, p4Only]);
  assert.deepEqual(
    merged.games.map((g) => `${g.sport}:${g.id}`),
    ["nfl:401872990", "cfb:401856717", "cfb:401860901", "cfb:401858480"],
    "dedupes; push-board games keep their place",
  );
  assert.deepEqual([...merged.power4].sort(), ["cfb:401856717", "cfb:401858480"]);
}

// --- Selection: NFL / Power 4 always, others follow scope -------------------

{
  const power4 = new Set(["cfb:401858480"]);
  assert.equal(alwaysSendsFinal("nfl", "nfl:1", power4), true);
  assert.equal(alwaysSendsFinal("cfb", "cfb:401858480", power4), true);
  assert.equal(alwaysSendsFinal("cfb", "cfb:401860901", power4), false);
  assert.equal(alwaysSendsFinal("mlb", "mlb:1", power4), false);
  assert.equal(alwaysSendsFinal("nhl", "nhl:1", power4), false);

  const favoritesOnly = parseScope("favorites");
  const base = {
    scope: favoritesOnly,
    favorites: [],
    sport: "nfl",
    away: { id: "3", abbrev: "CHI" },
    home: { id: "9", abbrev: "GB" },
    prev: { phase: "live" as const, everHot: false },
    nextPhase: "final" as const,
    everHot: false,
    alreadySent: false,
  };
  assert.equal(shouldSendFinal(base), false, "without always, a cold non-favorite final is skipped");
  assert.equal(shouldSendFinal({ ...base, always: true }), true, "always sends regardless of scope/heat");
  assert.equal(shouldSendFinal({ ...base, always: true, prev: null }), false, "baseline still never fires");
  assert.equal(shouldSendFinal({ ...base, always: true, alreadySent: true }), false, "dedupe still wins");
  assert.equal(
    shouldSendFinal({ ...base, always: true, prev: { phase: "final", everHot: false } }),
    false,
    "already final last sweep",
  );
  assert.equal(shouldSendFinal({ ...base, always: true, nextPhase: "live" }), false, "not final yet");
}

// --- Sweep plan: Oct 11 shape — seven NFL games final in one sweep ----------

const OCT11_EARLY = ["401872990", "401872984", "401872982", "401872986", "401872987", "401872983", "401872985"];

{
  const games = [
    ...OCT11_EARLY.map((id) => pushGame("nfl", id)),
    pushGame("cfb", "401858480"),
    pushGame("cfb", "900000001"),
    pushGame("mlb", "401907994"),
    pushGame("nfl", "401872993", { final: false, live: false }),
    pushGame("nfl", "401872999"),
  ];
  const prev = new Map<string, WatchSnap>();
  for (const g of games) prev.set(`${g.sport}:${g.id}`, { phase: "live", everHot: false });
  prev.delete("nfl:401872999");
  const rows = planSweep({
    games,
    prev,
    sent: new Set(["nfl:401872987"]),
    scope: parseScope("favorites,ruwt"),
    favorites: [],
    power4Cfb: new Set(["cfb:401858480"]),
    hot: () => false,
  });
  const wanted = rows.filter((r) => r.want).map((r) => r.key);
  assert.deepEqual(
    wanted,
    [
      "nfl:401872990",
      "nfl:401872984",
      "nfl:401872982",
      "nfl:401872986",
      "nfl:401872983",
      "nfl:401872985",
      "cfb:401858480",
    ],
    "every NFL final + the Power 4 final; not the sent one, the G5/MLB cold games, the pregame, or the baseline",
  );
  assert.equal(rows.find((r) => r.key === "nfl:401872999")!.before, null);
}

// --- runDeliveries: sequential, capped, retries keep the old phase ----------

{
  const rows = planSweep({
    games: OCT11_EARLY.map((id) => pushGame("nfl", id)),
    prev: new Map(OCT11_EARLY.map((id) => [`nfl:${id}`, { phase: "live" as const, everHot: true }])),
    sent: new Set(),
    scope: parseScope("favorites,ruwt"),
    favorites: [],
    power4Cfb: new Set(),
    hot: () => false,
  });
  let inFlight = 0;
  let maxInFlight = 0;
  const calls: string[] = [];
  const outcomes: Record<string, DeliverOutcome> = {
    "401872990": { status: "retry", error: "worker limit (546)" },
    "401872982": { status: "dup" },
  };
  const report = await runDeliveries(
    rows,
    async (game) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      calls.push(game.id);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      if (game.id === "401872986") throw new Error("network");
      return outcomes[game.id] ?? { status: "sent" };
    },
    { cap: 5 },
  );
  assert.equal(maxInFlight, 1, "one deliver request at a time (each gets its own CPU budget)");
  assert.deepEqual(calls, OCT11_EARLY.slice(0, 5));
  assert.deepEqual(report.delivered, ["nfl:401872984", "nfl:401872987"]);
  assert.deepEqual(report.dup, ["nfl:401872982"]);
  assert.deepEqual(report.deferred, ["nfl:401872983", "nfl:401872985"]);
  assert.deepEqual(
    report.errors.map((e) => e.game),
    ["nfl:401872990", "nfl:401872986"],
  );
  assert.equal(report.phases.get("nfl:401872984"), "final");
  assert.equal(report.phases.get("nfl:401872982"), "final", "dup counts as handled");
  assert.equal(report.phases.get("nfl:401872990"), "live", "546 keeps live so the next sweep retries");
  assert.equal(report.phases.get("nfl:401872986"), "live", "thrown error retries too");
  assert.equal(report.phases.get("nfl:401872983"), "live", "deferred retries next sweep");
  assert.ok(MAX_SENDS > 2, "more than the old cap of 2 per sweep");
}

{
  let clock = 0;
  const rows = planSweep({
    games: OCT11_EARLY.slice(0, 3).map((id) => pushGame("nfl", id)),
    prev: new Map(OCT11_EARLY.slice(0, 3).map((id) => [`nfl:${id}`, { phase: "live" as const, everHot: false }])),
    sent: new Set(),
    scope: parseScope("favorites,ruwt"),
    favorites: [],
    power4Cfb: new Set(),
    hot: () => false,
  });
  const report = await runDeliveries(
    rows,
    async () => {
      clock += 30_000;
      return { status: "sent" };
    },
    { cap: 10, budgetMs: 40_000, now: () => clock },
  );
  assert.equal(report.delivered.length, 2, "no new deliver starts after the time budget");
  assert.equal(report.deferred.length, 1);
}

// --- parseDeliverResponse ----------------------------------------------------

assert.deepEqual(parseDeliverResponse(200, JSON.stringify({ status: "sent", game: "nfl:1" })), { status: "sent" });
assert.deepEqual(parseDeliverResponse(200, JSON.stringify({ status: "dup" })), { status: "dup" });
assert.deepEqual(parseDeliverResponse(546, '{"code":"WORKER_LIMIT"}'), { status: "retry", error: "worker limit (546)" });
assert.deepEqual(parseDeliverResponse(409, JSON.stringify({ status: "not-final" })), {
  status: "retry",
  error: "deliver 409: not-final",
});
assert.deepEqual(parseDeliverResponse(502, JSON.stringify({ status: "error", error: "Bad Request: chat not found" })), {
  status: "retry",
  error: "deliver 502: Bad Request: chat not found",
});
assert.deepEqual(parseDeliverResponse(200, "<html>"), { status: "retry", error: "deliver 200" });

// --- deliverOnce: render before claim ----------------------------------------

{
  const log: string[] = [];
  const steps = (over: Partial<Parameters<typeof deliverOnce>[0]> = {}) => ({
    alreadySent: async () => (log.push("check"), false),
    load: async () => (log.push("load"), { final: true }),
    prepare: async () => (log.push("prepare"), "jpeg"),
    claim: async () => (log.push("claim"), "ok" as const),
    send: async () => (log.push("send"), { pages: 1 }),
    release: async () => void log.push("release"),
    ...over,
  });

  assert.deepEqual(await deliverOnce(steps()), { status: "sent", value: { pages: 1 } });
  assert.deepEqual(log, ["check", "load", "prepare", "claim", "send"]);

  log.length = 0;
  await assert.rejects(
    deliverOnce(
      steps({
        prepare: async () => {
          log.push("prepare");
          throw new Error("CPU Time exceeded");
        },
      }),
    ),
  );
  assert.deepEqual(log, ["check", "load", "prepare"], "a render that dies never claims the sent row");

  log.length = 0;
  const failedSend = await deliverOnce(
    steps({
      send: async () => {
        log.push("send");
        throw new Error("Too Many Requests");
      },
    }),
  );
  assert.deepEqual(failedSend, { status: "error", error: "Too Many Requests", stage: "send" });
  assert.deepEqual(log, ["check", "load", "prepare", "claim", "send", "release"]);

  log.length = 0;
  assert.deepEqual(await deliverOnce(steps({ alreadySent: async () => (log.push("check"), true) })), { status: "dup" });
  assert.deepEqual(log, ["check"], "already sent: no render, no claim");

  log.length = 0;
  assert.deepEqual(await deliverOnce(steps({ claim: async () => (log.push("claim"), "dup" as const) })), { status: "dup" });
  assert.deepEqual(log, ["check", "load", "prepare", "claim"], "lost the claim race: nothing sent");

  log.length = 0;
  assert.deepEqual(await deliverOnce(steps({ load: async () => (log.push("load"), { final: false }) })), {
    status: "not-final",
  });
  assert.deepEqual(log, ["check", "load"]);
}

// --- Prepared Telegram sends do not re-encode --------------------------------

{
  const orig = globalThis.fetch;
  const calls: { url: string; form: FormData }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), form: init?.body as FormData });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  try {
    const photo = { bytes: new Uint8Array([255, 216, 1]), mime: "image/jpeg", filename: "final.jpg", quality: 95 };
    await sendPreparedPhoto("t", "857547432", photo, "FINAL · NFL", '{"inline_keyboard":[]}');
    const album = await sendPreparedAlbum("t", "857547432", [photo, { ...photo, filename: "p2.jpg" }], "FINAL · NFL");
    assert.equal(album.method, "sendMediaGroup");
    const single = await sendPreparedAlbum("t", "857547432", [photo], "FINAL · NFL");
    assert.equal(single.method, "sendPhoto");
  } finally {
    globalThis.fetch = orig;
  }
  assert.match(calls[0]!.url, /\/sendPhoto$/);
  assert.equal(calls[0]!.form.get("reply_markup"), '{"inline_keyboard":[]}');
  const blob = calls[0]!.form.get("photo") as Blob;
  assert.equal(blob.type, "image/jpeg");
  assert.equal(blob.size, 3, "bytes go up as prepared");
  assert.match(calls[1]!.url, /\/sendMediaGroup$/);
  assert.match(calls[2]!.url, /\/sendPhoto$/);
}

console.log("finals-coverage.test.ts ok");
