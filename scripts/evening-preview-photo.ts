/**
 * Render the evening RUWT preview PNG (@FinalsAndStats_bot).
 *
 *   cd scripts && npm install
 *   node --experimental-strip-types evening-preview-photo.ts
 *   node --experimental-strip-types evening-preview-photo.ts --live --out ../artifacts/evening-preview-live.png
 *
 * Default uses a fixture slate so the graphic can be regenerated offline.
 * `--live` ranks tonight's ESPN / MLB boards with the same RUWT port.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { fetchLogoDataUri } from "../supabase/functions/sports-finals/card.ts";
import { fetchPreviewBoards, hydratePreviewStarters, rankPreviewBoards } from "../supabase/functions/sports-finals/preview-boards.ts";
import {
  chicagoYmd,
  decoratePreviewGame,
  PREVIEW_LIMIT,
  previewDateLabel,
  selectEveningPreview,
  sortPreviewForDisplay,
  type PreviewGame,
} from "../supabase/functions/sports-finals/preview-slate.ts";
import { previewCardModel, renderPreviewSvg } from "../supabase/functions/sports-finals/preview-svg.ts";

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) return "";
  return value;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(here, "../supabase/functions/sports-finals/vendor");

function ctIso(day: string, hour: number, minute = 0): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, hour + 5, minute, 0)).toISOString();
}

function fixtureSlate(day = "2026-10-05"): PreviewGame[] {
  const espn = (sport: string, id: string) => `https://a.espncdn.com/i/teamlogos/${sport}/500/${id}.png`;
  const g = (partial: Omit<PreviewGame, "why" | "network" | "live" | "final" | "path">): PreviewGame =>
    decoratePreviewGame({
      live: false,
      final: false,
      path: `/sports/${partial.sport}/game/${partial.id}`,
      ...partial,
    });
  return [
    g({
      id: "mlb-phi-lad",
      sport: "mlb",
      league: "MLB",
      competition: null,
      away: { teamId: "143", name: "Phillies", abbrev: "PHI", logo: espn("mlb", "22"), record: "96-66" },
      home: { teamId: "119", name: "Dodgers", abbrev: "LAD", logo: espn("mlb", "19"), record: "98-64", color: "#005a9c" },
      startIso: ctIso(day, 20, 8),
      heat: 86,
      reasons: ["Playoff series"],
      tv: ["FOX"],
      seriesLine: "Playoff Gm 3",
      probableAway: "Wheeler",
      probableHome: "Glasnow",
    }),
    g({
      id: "nfl-kc-buf",
      sport: "nfl",
      league: "NFL",
      competition: null,
      away: { teamId: "12", name: "Chiefs", abbrev: "KC", logo: espn("nfl", "12"), record: "4-1", color: "#e31837" },
      home: { teamId: "2", name: "Bills", abbrev: "BUF", logo: espn("nfl", "2"), record: "4-1" },
      startIso: ctIso(day, 19, 20),
      heat: 54,
      reasons: ["Upcoming", "Your #1 team"],
      tv: ["NBC"],
      oddsLine: "KC -2.5",
    }),
    g({
      id: "nhl-phi-tb",
      sport: "nhl",
      league: "NHL",
      competition: null,
      away: { teamId: "15", name: "Flyers", abbrev: "PHI", logo: espn("nhl", "15"), record: "1-0-0" },
      home: { teamId: "20", name: "Lightning", abbrev: "TB", logo: espn("nhl", "20"), record: "1-0-0", color: "#002868" },
      startIso: ctIso(day, 18, 0),
      heat: 62,
      reasons: ["Upcoming"],
      tv: ["ESPN+"],
      probableAway: "Ersson",
      probableHome: "Vasilevskiy",
    }),
    g({
      id: "cfb-ore-osu",
      sport: "cfb",
      league: "CFB",
      competition: null,
      away: { teamId: "2483", name: "Oregon", abbrev: "ORE", logo: espn("ncaa", "2483"), record: "6-0", rank: 3 },
      home: { teamId: "194", name: "Ohio State", abbrev: "OSU", logo: espn("ncaa", "194"), record: "6-0", rank: 1 },
      startIso: ctIso(day, 18, 30),
      heat: 80,
      reasons: ["Ranked matchup"],
      tv: ["FOX"],
      oddsLine: "OSU -3.5",
    }),
    g({
      id: "mlb-stl-chc",
      sport: "mlb",
      league: "MLB",
      competition: null,
      away: { teamId: "138", name: "Cardinals", abbrev: "STL", logo: espn("mlb", "24"), record: "83-79", color: "#be0a14" },
      home: { teamId: "112", name: "Cubs", abbrev: "CHC", logo: espn("mlb", "16"), record: "92-70" },
      startIso: ctIso(day, 19, 15),
      heat: 92,
      reasons: ["Cardinals", "Rivalry"],
      tv: ["ESPN"],
      probableAway: "Gray",
      probableHome: "Imanaga",
    }),
    g({
      id: "soccer-ars-liv",
      sport: "soccer",
      league: "Soccer",
      competition: "Premier League",
      away: { teamId: "359", name: "Arsenal", abbrev: "ARS", logo: espn("soccer", "359"), record: "6-1-1" },
      home: { teamId: "364", name: "Liverpool", abbrev: "LIV", logo: espn("soccer", "364"), record: "5-2-1" },
      startIso: ctIso(day, 21, 0),
      heat: 71,
      reasons: ["Premier League"],
      tv: ["Peacock"],
    }),
  ];
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

const outPath = path.resolve(arg("out") || path.join(here, "..", "artifacts", "evening-preview-sample.png"));
const now = new Date();
let source = "fixture";
let display = sortPreviewForDisplay(fixtureSlate());
let chicagoDate = "2026-10-05";

if (has("live")) {
  try {
    const ranked = rankPreviewBoards(await fetchPreviewBoards(now));
    const picked = selectEveningPreview(ranked, now, PREVIEW_LIMIT);
    if (picked.length) {
      await hydratePreviewStarters(picked);
      display = sortPreviewForDisplay(picked);
      chicagoDate = chicagoYmd(now);
      source = "live";
    } else {
      source = "fixture-empty-live";
    }
  } catch (err) {
    console.error("live boards failed, using fixture", err);
    source = "fixture-fallback";
  }
}

for (const game of display) {
  const [away, home] = await Promise.all([fetchLogoDataUri(game.away.logo), fetchLogoDataUri(game.home.logo)]);
  game.away.logoData = away;
  game.home.logoData = home;
}

const svg = renderPreviewSvg(previewCardModel(display, previewDateLabel(chicagoDate)));
const png = await rasterize(svg);
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, png);
await writeFile(outPath.replace(/\.png$/i, ".svg"), svg);

console.log(
  JSON.stringify(
    {
      source,
      chicagoDate,
      count: display.length,
      games: display.map((g) => `${g.away.abbrev} @ ${g.home.abbrev}`),
      png: outPath,
      bytes: png.byteLength,
    },
    null,
    2,
  ),
);
