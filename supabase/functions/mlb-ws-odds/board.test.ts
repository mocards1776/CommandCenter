/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/mlb-ws-odds/board.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boardFromMarkets,
  clearWsBoardCache,
  formatAsOfLabel,
  impliedYes,
  teamFromMarket,
  type KalshiMarket,
} from "./board.ts";

const when = new Date("2026-10-08T21:06:00Z");

function market(partial: KalshiMarket): KalshiMarket {
  return {
    status: "active",
    result: "",
    yes_bid_dollars: "0.1000",
    yes_ask_dollars: "0.1200",
    last_price_dollars: "0.1100",
    ...partial,
  };
}

test("midpoint of a tight yes book, not the last print", () => {
  const p = impliedYes({
    yes_bid_dollars: "0.4350",
    yes_ask_dollars: "0.4370",
    last_price_dollars: "0.4000",
  });
  assert.equal(p, 0.436);
});

test("0/1 book is not a price; last trade is", () => {
  assert.equal(
    impliedYes({ yes_bid_dollars: "0.0000", yes_ask_dollars: "1.0000", last_price_dollars: "0.2450" }),
    0.245,
  );
  assert.equal(
    impliedYes({ yes_bid_dollars: "0.0000", yes_ask_dollars: "1.0000", last_price_dollars: "0.0000" }),
    null,
  );
});

test("ticker suffix and Kalshi short names map to MLB team ids", () => {
  assert.deepEqual(teamFromMarket({ ticker: "KXMLB-26-LAD" }), { teamId: 119, abbrev: "LAD" });
  assert.deepEqual(teamFromMarket({ ticker: "KXMLB-26-CWS", yes_sub_title: "Chicago WS" }), {
    teamId: 145,
    abbrev: "CWS",
  });
  assert.deepEqual(teamFromMarket({ ticker: "KXMLB-26-ATH", yes_sub_title: "A's" }), {
    teamId: 133,
    abbrev: "ATH",
  });
  assert.deepEqual(teamFromMarket({ ticker: "KXMLB-26-ZZZ", yes_sub_title: "Los Angeles D" }), {
    teamId: 119,
    abbrev: "LAD",
  });
  assert.equal(teamFromMarket({ ticker: "KXMLB-26-ZZZ", yes_sub_title: "Field" }), null);
});

test("settled markets drop out and the rest sort high to low", () => {
  const board = boardFromMarkets(
    "KXMLB-26",
    [
      market({ ticker: "KXMLB-26-CLE", yes_sub_title: "Cleveland", yes_bid_dollars: "0.0300", yes_ask_dollars: "0.0310" }),
      market({
        ticker: "KXMLB-26-NYY",
        status: "finalized",
        result: "no",
        yes_bid_dollars: "0.0000",
        yes_ask_dollars: "1.0000",
        last_price_dollars: "0.0030",
      }),
      market({ ticker: "KXMLB-26-LAD", yes_sub_title: "Los Angeles D", yes_bid_dollars: "0.4350", yes_ask_dollars: "0.4370" }),
      market({ ticker: "KXMLB-26-MIL", yes_bid_dollars: "0.2420", yes_ask_dollars: "0.2450" }),
    ],
    when,
  );
  assert.ok(board);
  assert.deepEqual(
    board.teams.map((t) => `${t.abbrev}:${t.pct}`),
    ["LAD:44", "MIL:24", "CLE:3"],
  );
  assert.equal(board.teams[0]?.teamId, 119);
  assert.equal(board.asOfLabel.endsWith("CT"), true);
  assert.match(board.asOfLabel, /PM CT|AM CT/);
});

test("no remaining teams is a null board", () => {
  assert.equal(
    boardFromMarkets("KXMLB-25", [
      market({ ticker: "KXMLB-25-LAD", status: "finalized", result: "yes" }),
    ]),
    null,
  );
});

test("as-of label is America/Chicago", () => {
  assert.equal(formatAsOfLabel("2026-10-08T21:06:00Z"), "4:06 PM CT");
});

test("cache clears", () => {
  clearWsBoardCache();
});
