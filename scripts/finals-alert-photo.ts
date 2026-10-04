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
import { tablesFromStandings } from "../supabase/functions/sports-finals/standings.ts";
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
          date: "2026-10-02T00:15Z",
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
    pickcenter: [
      {
        details: "PIT -2.5",
        spread: 2.5,
        overUnder: 38.5,
        provider: { name: "DraftKings" },
        awayTeamOdds: { favorite: true, moneyLine: -148 },
        homeTeamOdds: { favorite: false, moneyLine: 124 },
        pointSpread: {
          away: { close: { line: "-2.5" } },
          home: { close: { line: "+2.5" } },
        },
      },
    ],
    winprobability: [
      { homeWinPercentage: 0.42, tiePercentage: 0, playId: "a" },
      { homeWinPercentage: 0.78, tiePercentage: 0, playId: "b" },
      { homeWinPercentage: 1, tiePercentage: 0, playId: "c" },
    ],
  });
}

export function bluesBruinsFixture(): FinalCard {
  const card = cardFromSummary("nhl", "401812345", {
    header: {
      competitions: [
        {
          status: { type: { state: "post", completed: true, shortDetail: "Final" } },
          date: "2026-10-03T00:00Z",
          venue: { fullName: "Enterprise Center" },
          competitors: [
            {
              homeAway: "away",
              score: "2",
              record: [{ type: "total", summary: "2-1-0" }],
              linescores: [{ value: 0 }, { value: 1 }, { value: 1 }],
              team: { id: "1", abbreviation: "BOS", displayName: "Boston Bruins", color: "000000", alternateColor: "ffb81c" },
            },
            {
              homeAway: "home",
              score: "3",
              record: [{ type: "total", summary: "2-0-1" }],
              linescores: [{ value: 1 }, { value: 1 }, { value: 1 }],
              team: { id: "19", abbreviation: "STL", displayName: "St. Louis Blues", color: "002f87", alternateColor: "ffb81c" },
            },
          ],
        },
      ],
    },
    article: { headline: "Blues take a 3-2 decision from the Bruins" },
    boxscore: {
      teams: [
        { team: { abbreviation: "BOS" }, statistics: [{ label: "Shots", displayValue: "28" }, { label: "Hits", displayValue: "22" }] },
        { team: { abbreviation: "STL" }, statistics: [{ label: "Shots", displayValue: "31" }, { label: "Hits", displayValue: "18" }] },
      ],
      players: [
        {
          team: { abbreviation: "STL" },
          statistics: [
            {
              name: "skaters",
              labels: ["G", "A", "P"],
              athletes: [{ athlete: { displayName: "Robert Thomas" }, stats: ["1", "1", "2"] }],
            },
          ],
        },
      ],
    },
  });
  card.standings = tablesFromStandings(
    "nhl",
    {
      children: [
        {
          name: "Atlantic Division",
          standings: {
            entries: [
              { team: { id: "6", abbreviation: "FLA" }, stats: [{ name: "wins", displayValue: "3" }, { name: "losses", displayValue: "0" }, { name: "otLosses", displayValue: "0" }, { name: "points", displayValue: "6" }] },
              { team: { id: "1", abbreviation: "BOS" }, stats: [{ name: "wins", displayValue: "2" }, { name: "losses", displayValue: "1" }, { name: "otLosses", displayValue: "0" }, { name: "points", displayValue: "4" }] },
            ],
          },
        },
        {
          name: "Central Division",
          standings: {
            entries: [
              { team: { id: "19", abbreviation: "STL" }, stats: [{ name: "wins", displayValue: "2" }, { name: "losses", displayValue: "0" }, { name: "otLosses", displayValue: "1" }, { name: "points", displayValue: "5" }] },
              { team: { id: "21", abbreviation: "COL" }, stats: [{ name: "wins", displayValue: "2" }, { name: "losses", displayValue: "1" }, { name: "otLosses", displayValue: "0" }, { name: "points", displayValue: "4" }] },
            ],
          },
        },
      ],
    },
    card.away,
    card.home,
  );
  return card;
}

export function cubsCardinalsFixture(): FinalCard {
  const card = cardFromSummary("mlb", "401581234", {
    header: {
      competitions: [
        {
          status: { type: { state: "post", completed: true, shortDetail: "Final" } },
          date: "2026-09-28T18:15Z",
          venue: { fullName: "Busch Stadium" },
          competitors: [
            {
              homeAway: "away",
              score: "3",
              record: [{ type: "total", summary: "83-79" }],
              linescores: [{ value: 0 }, { value: 1 }, { value: 0 }, { value: 2 }],
              team: { id: "16", abbreviation: "CHC", displayName: "Chicago Cubs", color: "0e3386", alternateColor: "cc3433" },
            },
            {
              homeAway: "home",
              score: "5",
              record: [{ type: "total", summary: "78-84" }],
              linescores: [{ value: 2 }, { value: 0 }, { value: 1 }, { value: 2 }],
              team: { id: "24", abbreviation: "STL", displayName: "St. Louis Cardinals", color: "c41e3a", alternateColor: "0c2340" },
            },
          ],
        },
      ],
    },
    article: { headline: "Cardinals hold off the Cubs at Busch" },
  });
  card.standings = tablesFromStandings(
    "mlb",
    {
      children: [
        {
          name: "National League Central",
          standings: {
            entries: [
              { team: { id: "17", abbreviation: "MIL" }, stats: [{ name: "overall", displayValue: "97-65" }, { name: "gamesBehind", displayValue: "-" }] },
              { team: { id: "16", abbreviation: "CHC" }, stats: [{ name: "overall", displayValue: "83-79" }, { name: "gamesBehind", displayValue: "14" }] },
              { team: { id: "24", abbreviation: "STL" }, stats: [{ name: "overall", displayValue: "78-84" }, { name: "gamesBehind", displayValue: "19" }] },
              { team: { id: "29", abbreviation: "CIN" }, stats: [{ name: "overall", displayValue: "77-85" }, { name: "gamesBehind", displayValue: "20" }] },
              { team: { id: "23", abbreviation: "PIT" }, stats: [{ name: "overall", displayValue: "71-91" }, { name: "gamesBehind", displayValue: "26" }] },
            ],
          },
        },
      ],
    },
    card.away,
    card.home,
  );
  return card;
}

function fixtureFor(sport: string): FinalCard {
  if (sport === "nhl") return bluesBruinsFixture();
  if (sport === "mlb") return cubsCardinalsFixture();
  return attachAfcNorth(steelersBrownsFixture());
}

function attachAfcNorth(card: FinalCard): FinalCard {
  card.standings = tablesFromStandings(
    "nfl",
    {
      name: "National Football League",
      children: [
        {
          name: "AFC North",
          standings: {
            entries: [
              { team: { id: "5", abbreviation: "CLE", shortDisplayName: "Browns" }, stats: [{ name: "overall", displayValue: "3-1" }, { name: "gamesBehind", displayValue: "-" }] },
              { team: { id: "33", abbreviation: "BAL", shortDisplayName: "Ravens" }, stats: [{ name: "overall", displayValue: "2-2" }, { name: "gamesBehind", displayValue: "1" }] },
              { team: { id: "4", abbreviation: "CIN", shortDisplayName: "Bengals" }, stats: [{ name: "overall", displayValue: "2-2" }, { name: "gamesBehind", displayValue: "1" }] },
              { team: { id: "23", abbreviation: "PIT", shortDisplayName: "Steelers" }, stats: [{ name: "overall", displayValue: "2-2" }, { name: "gamesBehind", displayValue: "1" }] },
            ],
          },
        },
      ],
    },
    card.away,
    card.home,
  );
  return card;
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
  card = fixtureFor(sport);
} else {
  try {
    card = await loadFinalCard(sport, gameId);
    source = "espn";
  } catch (err) {
    console.error("ESPN summary failed, using fixture", err);
    card = fixtureFor(sport);
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
      standings: card.standings.map((table) => `${table.title} (${table.rows.length})`),
      width: size.width,
      height: size.height,
      png: outPath,
      bytes: png.byteLength,
    },
    null,
    2,
  ),
);
