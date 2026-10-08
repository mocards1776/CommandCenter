import assert from "node:assert/strict";
import { test } from "node:test";
import { diamondPeopleSize, diamondTextLayout, renderHeatAlertSvg } from "./svg.ts";
import type { HeatAlertCard } from "./types.ts";

const card: HeatAlertCard = {
  sport: "mlb",
  gameId: "401800003",
  live: true,
  final: false,
  detail: "Top 2nd",
  when: null,
  away: { id: "5", abbrev: "CLE", name: "Guardians", score: 0, record: "0-2", linescores: [0, null], color: "#00385d", alternateColor: "#e31937", logoHref: null },
  home: { id: "4", abbrev: "CWS", name: "White Sox", score: 1, record: "2-0", linescores: [1], color: "#27251f", alternateColor: "#c4ced4", logoHref: null },
  venue: "Rate Field",
  date: "2026-10-07T21:08:00Z",
  periodLabels: ["1", "2"],
  football: null,
  ice: null,
  diamond: { balls: 0, strikes: 0, outs: 0, onFirst: false, onSecond: false, onThird: false, batter: "N. Lowe", pitcher: "S. Newcomb" },
  homeWinPct: 61.2,
  winProbability: [],
  stats: [{ label: "Hits", away: "1", home: "3", awayLeads: false, homeLeads: true, awayShare: 25 }],
  gamePath: "/sports/mlb/game/401800003?solo=1",
};

function row(svg: string, label: string): { y: number; size: number } {
  const m = svg.match(new RegExp(`<text x="[\\d.]+" y="([\\d.]+)"[^>]*font-size="(\\d+)"[^>]*>${label}</text>`));
  assert.ok(m, `missing text ${label}`);
  return { y: Number(m[1]), size: Number(m[2]) };
}

// Next line's cap top (~0.72em above its baseline) must clear the previous line's descender (~0.25em).
function clears(upper: { y: number; size: number }, lower: { y: number; size: number }): number {
  return lower.y - lower.size * 0.72 - (upper.y + upper.size * 0.25);
}

test("MLB diamond panel: outs line never overlaps the batter line (0/1/2 outs)", () => {
  for (const outs of [0, 1, 2]) {
    const svg = renderHeatAlertSvg({ ...card, diamond: { ...card.diamond!, outs } });
    const outsRow = row(svg, outs === 1 ? "1 out" : `${outs} outs`);
    const batter = row(svg, "Batter N. Lowe");
    const pitcher = row(svg, "Pitcher S. Newcomb");
    assert.ok(clears(outsRow, batter) >= 8, `outs/batter gap at ${outs} outs`);
    assert.ok(clears(batter, pitcher) >= 8, "batter/pitcher gap");
  }
});

test("MLB diamond panel: stack fits inside the shortest panel", () => {
  for (const panelH of [188, 210]) {
    const rows = diamondTextLayout(0, panelH);
    assert.ok(rows.count - 48 * 0.72 >= 12, `count clears the panel top at ${panelH}`);
    assert.ok(rows.people[1] + 18 * 0.25 <= panelH - 12, `pitcher clears the panel bottom at ${panelH}`);
  }
});

test("MLB diamond panel: long names shrink before they clip", () => {
  assert.equal(diamondPeopleSize("Batter N. Lowe", 448), 18);
  const long = "Christopher Morel-Hernandez Jr.";
  const svg = renderHeatAlertSvg({ ...card, diamond: { ...card.diamond!, batter: long } });
  assert.match(svg, new RegExp(`>Batter ${long}</text>`), "full long name is kept");
  const xl = "Bartholomew Christopher Fitzgerald-Montgomery III";
  const svgXl = renderHeatAlertSvg({ ...card, diamond: { ...card.diamond!, outs: 2, batter: xl } });
  const r = row(svgXl, `Batter ${xl}`);
  assert.ok(r.size < 18 && r.size >= 14, "very long name steps down but stays readable");
  assert.ok(clears(row(svgXl, "2 outs"), r) >= 8, "smaller batter line still clears the outs line");
});
