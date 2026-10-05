/**
 * Resolve one Blues goal MP4. Send that one video only when --send is set.
 *
 * Dry-run (no Telegram, no token):
 *   node --experimental-strip-types scripts/highlights-send-one.ts
 *
 * One real DM to chat 857547432. The token stays in the environment:
 *   TELEGRAM_HIGHLIGHTS_BOT_TOKEN="…" \
 *     node --experimental-strip-types scripts/highlights-send-one.ts --send
 *
 * Optional: --clip 6406147120112 --nhl-game 2026020020
 * This script never writes sports_highlights_sent. A later cron sweep will
 * send the same clip again unless that id is already claimed.
 */
import { collectGoalClips, fetchGoalClipsForGame, loadClubGame, resolveEspnEventId } from "../supabase/functions/sports-highlights/nhl-clips.ts";
import { gameReplyMarkup } from "../supabase/functions/_shared/telegram-markup.ts";
import { nhlGamePath, parseTeamFilter } from "../supabase/functions/sports-highlights/select.ts";
import { sendTelegramVideo } from "../supabase/functions/sports-highlights/telegram.ts";

const TEST_CHAT_ID = "857547432";
const DEFAULT_ORIGIN = "https://command-center-flax-gamma.vercel.app";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  const value = process.argv[i + 1];
  return value && !value.startsWith("--") ? value : null;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

const send = flag("--send");
const clipWanted = (arg("--clip") ?? "").replace(/^nhl-/, "").replace(/\D/g, "");
const nhlGameId = (arg("--nhl-game") ?? "").replace(/\D/g, "");

const filter = parseTeamFilter("STL");
const clips = nhlGameId
  ? await (async () => {
      const game = await loadClubGame(nhlGameId);
      if (!game) throw new Error(`NHL game ${nhlGameId} not found`);
      const espnEventId = await resolveEspnEventId(game);
      return fetchGoalClipsForGame(game, filter, espnEventId);
    })()
  : await collectGoalClips(filter, 72);

const clip = clipWanted ? clips.find((row) => row.clipId === clipWanted) : clips[0];
if (!clip) {
  console.error(clipWanted ? `Clip ${clipWanted} was not in the Blues list.` : "No Blues goal MP4 in the last 72h.");
  process.exit(1);
}

const head = await fetch(clip.mp4, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
const report = {
  dryRun: !send,
  chatId: TEST_CHAT_ID,
  highlightId: clip.highlightId,
  clipId: clip.clipId,
  caption: clip.caption,
  nhlGameId: clip.nhlGameId,
  espnEventId: clip.espnEventId,
  durationSec: clip.durationSec,
  mp4: clip.mp4,
  mp4Status: head.status,
  mp4Type: head.headers.get("content-type"),
  mp4Bytes: head.headers.get("content-length"),
};

if (!send) {
  console.log(JSON.stringify(report, null, 2));
  console.log(
    "\nOne test send (does not claim the clip). Token is not printed:\n" +
      `TELEGRAM_HIGHLIGHTS_BOT_TOKEN="$TELEGRAM_HIGHLIGHTS_BOT_TOKEN" \\\n` +
      `  node --experimental-strip-types scripts/highlights-send-one.ts --send --clip ${clip.clipId} --nhl-game ${clip.nhlGameId}`,
  );
  process.exit(0);
}

const token = process.env.TELEGRAM_HIGHLIGHTS_BOT_TOKEN?.trim() ?? "";
if (!token) {
  console.error("TELEGRAM_HIGHLIGHTS_BOT_TOKEN is not set. Dry-run only; no video was sent.");
  process.exit(2);
}

const origin = (process.env.SPORTS_HIGHLIGHTS_ORIGIN || process.env.SPORTS_PUSH_ORIGIN || DEFAULT_ORIGIN).replace(
  /\/$/,
  "",
);
const results = await sendTelegramVideo({
  token,
  videoUrl: clip.mp4,
  caption: clip.caption,
  chatIds: [TEST_CHAT_ID],
  replyMarkup: gameReplyMarkup(origin, nhlGamePath(clip.espnEventId)),
  durationSec: clip.durationSec,
  width: clip.width,
  height: clip.height,
});
const ok = results.every((row) => row.ok);
console.log(JSON.stringify({ ...report, dryRun: false, telegram: results.map(({ chatId, ok: sent, error }) => ({ chatId, ok: sent, error })) }, null, 2));
if (!ok) process.exit(1);
