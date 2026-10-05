/**
 * Render one real-game heat-alert PNG without signing into the Sports app.
 *
 *   cd scripts && npm install
 *   node --experimental-strip-types heat-alert-photo.ts --sport nfl
 *   node --experimental-strip-types heat-alert-photo.ts --fixture kc-lv --out ../artifacts/heat-alert-nfl-kc-lv.png
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_IDS=123 \
 *     node --experimental-strip-types heat-alert-photo.ts --sport nfl --send --reason "One-score game"
 *
 * `--reason` is the RUWT why-it-fired line. Links go on inline keyboard buttons.
 * The token is read from the environment. It is never written into the repo.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
  FONT_BOLD,
  FONT_CONDENSED_BOLD,
  FONT_REGULAR,
  FONT_SEMIBOLD,
  RESVG_WASM,
} from "../supabase/functions/_shared/heat-alert/assets.ts";
import { decodeBase64 } from "../supabase/functions/_shared/heat-alert/binary.ts";
import { heatAlertCaption } from "../supabase/functions/_shared/heat-alert/copy.ts";
import { loadHeatAlertCard } from "../supabase/functions/_shared/heat-alert/fetch-game.ts";
import { embedLogos } from "../supabase/functions/_shared/heat-alert/logos.ts";
import { heatAlertFonts, heatAlertResvgOptions } from "../supabase/functions/_shared/heat-alert/raster-options.ts";
import { renderHeatAlertSvg } from "../supabase/functions/_shared/heat-alert/svg.ts";
import { parseChatAllowlist, resolveChatTargets, sendTelegramPhoto } from "../supabase/functions/_shared/heat-alert/telegram.ts";
import { alertReplyMarkup } from "../supabase/functions/_shared/telegram-markup.ts";
import type { HeatAlertCard } from "../supabase/functions/_shared/heat-alert/types.ts";

/** Screenshot moment: KC @ LV, 3rd 3:35, 1st & 10 at LV 15 after a KC punt. */
function kcLvFixture(): HeatAlertCard {
  return {
    sport: "nfl",
    gameId: "401872976",
    live: true,
    final: false,
    detail: "3:35 - 3rd",
    when: null,
    away: {
      id: "12",
      abbrev: "KC",
      name: "Chiefs",
      score: 10,
      record: "3-0",
      linescores: [7, 3, 0, null],
      color: "#e31837",
      alternateColor: "#ffb81c",
      logoHref: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
    },
    home: {
      id: "13",
      abbrev: "LV",
      name: "Raiders",
      score: 13,
      record: "3-0",
      linescores: [7, 6, 0, null],
      color: "#000000",
      alternateColor: "#a5acaf",
      logoHref: "https://a.espncdn.com/i/teamlogos/nfl/500/lv.png",
    },
    venue: "Allegiant Stadium",
    date: "2026-10-04T20:05:00Z",
    periodLabels: ["Q1", "Q2", "Q3", "Q4"],
    football: {
      downDistanceText: "1st & 10 at LV 15",
      yardLine: 15,
      possessionTeamId: "13",
      lastPlayText: "Official Timeout at 03:35.",
      driveStartYardLine: 15,
      playYardLines: [15],
      redZone: true,
    },
    ice: null,
    diamond: null,
    winProbability: [
      { playId: "1", homeWinPct: 47.2, tiePct: 0, elapsedSec: 0, period: 1 },
      { playId: "2", homeWinPct: 52.8, tiePct: 0, elapsedSec: 540, period: 1 },
      { playId: "3", homeWinPct: 58.4, tiePct: 0, elapsedSec: 900, period: 2 },
      { playId: "4", homeWinPct: 61.1, tiePct: 0, elapsedSec: 1480, period: 2 },
      { playId: "5", homeWinPct: 55.6, tiePct: 0, elapsedSec: 1800, period: 3 },
      { playId: "6", homeWinPct: 57.9, tiePct: 0, elapsedSec: 2485, period: 3 },
    ],
    stats: [
      { label: "Yards", away: "301", home: "254", awayLeads: true, homeLeads: false, awayShare: 54.2 },
      { label: "Passing", away: "141", home: "211", awayLeads: false, homeLeads: true, awayShare: 40.1 },
      { label: "Rushing", away: "160", home: "43", awayLeads: true, homeLeads: false, awayShare: 78.8 },
      { label: "1st Downs", away: "13", home: "17", awayLeads: false, homeLeads: true, awayShare: 43.3 },
      { label: "3rd Down", away: "4/10", home: "3/9", awayLeads: true, homeLeads: false, awayShare: 54.5 },
      { label: "Turnovers", away: "0", home: "0", awayLeads: false, homeLeads: false, awayShare: 50 },
      { label: "Possession", away: "20:21", home: "24:39", awayLeads: false, homeLeads: true, awayShare: 45.2 },
    ],
    gamePath: "/sports/nfl/game/401872976?solo=1",
  };
}

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

const sport = arg("sport");
const gameId = arg("game") || arg("gameId");
const reason = arg("reason");
const origin = process.env.SPORTS_PUSH_ORIGIN || process.env.HEAT_ALERT_ORIGIN || "https://command-center-flax-gamma.vercel.app";
const outPath = path.resolve(arg("out") || path.join("..", "artifacts", "heat-alert-sample.png"));

const fixture = arg("fixture");
const card = fixture === "kc-lv" || fixture === ""
  ? kcLvFixture()
  : await loadHeatAlertCard({ sport, gameId });
const withLogos = await embedLogos(card);
const svg = renderHeatAlertSvg(withLogos);
const caption = heatAlertCaption(reason);
const replyMarkup = alertReplyMarkup(origin, card.gamePath);

await initWasm(decodeBase64(RESVG_WASM));
const fonts = heatAlertFonts({
  regular: decodeBase64(FONT_REGULAR),
  semibold: decodeBase64(FONT_SEMIBOLD),
  bold: decodeBase64(FONT_BOLD),
  condensedBold: decodeBase64(FONT_CONDENSED_BOLD),
});
const resvg = new Resvg(svg, heatAlertResvgOptions(fonts));
const png = resvg.render().asPng();
resvg.free();

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, png);
await writeFile(outPath.replace(/\.png$/i, ".svg"), svg);

console.log(
  JSON.stringify(
    {
      sport: card.sport,
      gameId: card.gameId,
      detail: card.detail,
      away: `${card.away.abbrev} ${card.away.score ?? "–"}`,
      home: `${card.home.abbrev} ${card.home.score ?? "–"}`,
      situation: card.football?.downDistanceText ?? card.detail,
      caption,
      png: outPath,
      bytes: png.byteLength,
    },
    null,
    2,
  ),
);

if (has("send")) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    process.exit(1);
  }
  const targets = resolveChatTargets(
    parseChatAllowlist(process.env.TELEGRAM_CHAT_IDS ?? process.env.TELEGRAM_CHAT_ID),
    arg("chat"),
  );
  if (!targets.ok) {
    console.error(targets.error);
    process.exit(1);
  }
  const chats = await sendTelegramPhoto({ token, png, caption, chatIds: targets.ids, replyMarkup });
  console.log(JSON.stringify({ chats }, null, 2));
  if (!chats.some((row) => row.ok)) process.exit(1);
}
