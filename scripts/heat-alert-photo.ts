/**
 * Render one real-game heat-alert PNG without signing into the Sports app.
 *
 *   cd scripts && npm install
 *   node --experimental-strip-types heat-alert-photo.ts --sport nfl
 *   node --experimental-strip-types heat-alert-photo.ts --sport nfl --game 401872965 --out ../artifacts/heat-alert-sample.png
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_IDS=123 \
 *     node --experimental-strip-types heat-alert-photo.ts --sport nfl --send --reason "One-score game"
 *
 * `--reason` is the RUWT why-it-fired line. Omit it and the caption is only the open-game link.
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
import { heatAlertCaption, openGameUrl } from "../supabase/functions/_shared/heat-alert/copy.ts";
import { loadHeatAlertCard } from "../supabase/functions/_shared/heat-alert/fetch-game.ts";
import { embedLogos } from "../supabase/functions/_shared/heat-alert/logos.ts";
import { heatAlertFonts, heatAlertResvgOptions } from "../supabase/functions/_shared/heat-alert/raster-options.ts";
import { renderHeatAlertSvg } from "../supabase/functions/_shared/heat-alert/svg.ts";
import { parseChatAllowlist, resolveChatTargets, sendTelegramPhoto } from "../supabase/functions/_shared/heat-alert/telegram.ts";

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

const card = await loadHeatAlertCard({ sport, gameId });
const withLogos = await embedLogos(card);
const svg = renderHeatAlertSvg(withLogos);
const caption = heatAlertCaption(reason, openGameUrl(origin, card.gamePath));

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
  const chats = await sendTelegramPhoto({ token, png, caption, chatIds: targets.ids });
  console.log(JSON.stringify({ chats }, null, 2));
  if (!chats.some((row) => row.ok)) process.exit(1);
}
