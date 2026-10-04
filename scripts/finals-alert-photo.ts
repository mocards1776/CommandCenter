/**
 * Render one finals-alert PNG (Telegram @FinalsAndStats_bot card).
 *
 *   cd scripts && npm install
 *   node --experimental-strip-types finals-alert-photo.ts
 *   node --experimental-strip-types finals-alert-photo.ts --game 401872964 --out ../artifacts/finals-alert-after.png
 *
 * `--fixture` skips ESPN and uses the Steelers–Browns sample in this file.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { cardFromSummary, loadFinalCard, type FinalCard } from "../supabase/functions/sports-finals/card.ts";
import { renderFinalSvg } from "../supabase/functions/sports-finals/svg.ts";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) return "";
  return value;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(here, "../supabase/functions/sports-finals/vendor");

/** PIT @ CLE 401872964 — same game as sports-finals.test.ts and Josh’s Telegram shot. */
export function steelersBrownsFixture(): FinalCard {
  return cardFromSummary("nfl", "401872964", {
    header: {
      competitions: [
        {
          status: { type: { state: "post", completed: true, shortDetail: "Final" } },
          venue: { fullName: "Huntington Bank Field" },
          competitors: [
            {
              homeAway: "away",
              score: "24",
              record: [{ type: "total", displayValue: "2-2" }],
              linescores: [
                { displayValue: "7" },
                { displayValue: "3" },
                { displayValue: "0" },
                { displayValue: "14" },
              ],
              team: {
                id: "23",
                abbreviation: "PIT",
                displayName: "Pittsburgh Steelers",
                color: "000000",
                alternateColor: "ffb612",
              },
            },
            {
              homeAway: "home",
              score: "27",
              record: [{ type: "total", summary: "3-1" }],
              linescores: [{ value: 0 }, { value: 21 }, { value: 0 }, { value: 6 }],
              team: {
                id: "5",
                abbreviation: "CLE",
                shortDisplayName: "Cleveland Browns",
                displayName: "Cleveland Browns",
                color: "311d00",
                alternateColor: "ff3c00",
              },
            },
          ],
        },
      ],
    },
    article: {
      headline:
        "Watson seals another game-winning drive: 52-yard FG and Browns beat Steelers 27-24",
    },
    boxscore: {
      teams: [
        {
          team: { abbreviation: "PIT" },
          statistics: [
            { label: "Total Yards", displayValue: "361" },
            { label: "Passing", displayValue: "269" },
            { label: "Rushing", displayValue: "92" },
            { label: "1st Downs", displayValue: "24" },
            { label: "3rd down efficiency", displayValue: "4-13" },
            { label: "Turnovers", displayValue: "2" },
          ],
        },
        {
          team: { abbreviation: "CLE" },
          statistics: [
            { label: "Total Yards", displayValue: "372" },
            { label: "Passing", displayValue: "260" },
            { label: "Rushing", displayValue: "112" },
            { label: "1st Downs", displayValue: "22" },
            { label: "3rd down efficiency", displayValue: "4-10" },
            { label: "Turnovers", displayValue: "1" },
          ],
        },
      ],
      players: [
        {
          team: { abbreviation: "PIT" },
          statistics: [
            {
              name: "passing",
              labels: ["C/ATT", "YDS", "TD", "INT"],
              athletes: [{ athlete: { displayName: "Aaron Rodgers" }, stats: ["22/40", "299", "3", "2"] }],
            },
            {
              name: "rushing",
              labels: ["CAR", "YDS", "TD", "LONG"],
              athletes: [{ athlete: { displayName: "Jaylen Warren" }, stats: ["17", "93", "0", "24"] }],
            },
            {
              name: "receiving",
              labels: ["REC", "YDS", "TD", "TGTS"],
              athletes: [{ athlete: { displayName: "DK Metcalf" }, stats: ["5", "15", "0", "9"] }],
            },
          ],
        },
        {
          team: { abbreviation: "CLE" },
          statistics: [
            {
              name: "passing",
              labels: ["C/ATT", "YDS", "TD", "INT"],
              athletes: [{ athlete: { displayName: "Deshaun Watson" }, stats: ["22/33", "268", "1", "1"] }],
            },
            {
              name: "rushing",
              labels: ["CAR", "YDS", "TD", "LONG"],
              athletes: [{ athlete: { displayName: "Quinshon Judkins" }, stats: ["17", "53", "0", "12"] }],
            },
            {
              name: "receiving",
              labels: ["REC", "YDS", "TD", "TGTS"],
              athletes: [{ athlete: { displayName: "Denzel Boston" }, stats: ["4", "69", "0", "7"] }],
            },
          ],
        },
      ],
    },
    drives: {
      previous: [
        {
          plays: [
            { id: "a", period: { number: 1 }, clock: { displayValue: "15:00" } },
            { id: "b", period: { number: 2 }, clock: { displayValue: "0:00" } },
            { id: "c", period: { number: 4 }, clock: { displayValue: "0:00" } },
          ],
        },
      ],
    },
    winprobability: [
      { homeWinPercentage: 0.42, tiePercentage: 0, playId: "a" },
      { homeWinPercentage: 0.78, tiePercentage: 0, playId: "b" },
      { homeWinPercentage: 1, tiePercentage: 0, playId: "c" },
    ],
  });
}

async function rasterize(svg: string): Promise<Uint8Array> {
  const [wasm, regular, bold] = await Promise.all([
    readFile(path.join(vendor, "resvg.wasm")),
    readFile(path.join(vendor, "Inter-400.ttf")),
    readFile(path.join(vendor, "Inter-700.ttf")),
  ]);
  await initWasm(wasm);
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [regular, bold],
      defaultFontFamily: "Inter",
      sansSerifFamily: "Inter",
    },
    textRendering: 1,
    shapeRendering: 2,
    background: "#07101d",
  });
  try {
    return resvg.render().asPng();
  } finally {
    resvg.free();
  }
}

function svgSize(svg: string): { width: number; height: number } {
  const width = Number(/width="(\d+)"/.exec(svg)?.[1] ?? 0);
  const height = Number(/height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 0);
  return { width, height };
}

const sport = arg("sport") || "nfl";
const gameId = arg("game") || arg("gameId");
const outPath = path.resolve(arg("out") || path.join(here, "..", "artifacts", "finals-alert-sample.png"));

let card: FinalCard;
let source = "fixture";
if (has("fixture") || !gameId) {
  card = steelersBrownsFixture();
} else {
  try {
    card = await loadFinalCard(sport, gameId);
    source = "espn";
  } catch (err) {
    console.error("ESPN summary failed, using fixture", err);
    card = steelersBrownsFixture();
    source = "fixture-fallback";
  }
}

const svg = renderFinalSvg(card);
const png = await rasterize(svg);
const size = svgSize(svg);

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, png);
await writeFile(outPath.replace(/\.png$/i, ".svg"), svg);

console.log(
  JSON.stringify(
    {
      source,
      sport: card.sport,
      eventId: card.eventId,
      away: `${card.away.abbrev} ${card.away.score ?? "–"}`,
      home: `${card.home.abbrev} ${card.home.score ?? "–"}`,
      stats: card.stats.length,
      leaders: card.leaders.length,
      width: size.width,
      height: size.height,
      png: outPath,
      bytes: png.byteLength,
    },
    null,
    2,
  ),
);
