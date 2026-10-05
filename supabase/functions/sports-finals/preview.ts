/**
 * Evening RUWT preview: rank tonight's not-started games, draw one PNG,
 * send via @FinalsAndStats_bot. Idempotent once per America/Chicago day.
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { previewReplyMarkup } from "../_shared/telegram-markup.ts";
import { fetchLogoDataUri } from "./card.ts";
import { rasterizeSvg } from "./png.ts";
import { fetchPreviewBoards, hydratePreviewStarters, rankPreviewBoards } from "./preview-boards.ts";
import {
  chicagoYmd,
  PREVIEW_LIMIT,
  previewCaption,
  previewClaimKey,
  previewDateLabel,
  selectEveningPreview,
  sortPreviewForDisplay,
  type PreviewGame,
} from "./preview-slate.ts";
import { previewCardModel, renderPreviewSvg } from "./preview-svg.ts";
import { sendTelegramPhoto } from "./telegram.ts";

export type PreviewBuild = {
  chicagoDate: string;
  claimKey: string;
  games: PreviewGame[];
  display: PreviewGame[];
  skipped: "empty" | null;
};

export async function buildEveningPreview(now = new Date()): Promise<PreviewBuild> {
  const chicagoDate = chicagoYmd(now);
  const ranked = rankPreviewBoards(await fetchPreviewBoards(now));
  const games = selectEveningPreview(ranked, now, PREVIEW_LIMIT);
  await hydratePreviewStarters(games);
  return {
    chicagoDate,
    claimKey: previewClaimKey(chicagoDate),
    games,
    display: sortPreviewForDisplay(games),
    skipped: games.length ? null : "empty",
  };
}

export async function hydratePreviewLogos(games: PreviewGame[]): Promise<void> {
  const urls = [...new Set(games.flatMap((g) => [g.away.logo, g.home.logo]).filter((u): u is string => Boolean(u)))];
  const fetched = await Promise.all(urls.map((url) => fetchLogoDataUri(url)));
  const byUrl = new Map(urls.map((url, i) => [url, fetched[i] ?? null]));
  for (const game of games) {
    game.away.logoData = game.away.logo ? byUrl.get(game.away.logo) ?? null : null;
    game.home.logoData = game.home.logo ? byUrl.get(game.home.logo) ?? null : null;
  }
}

export async function renderEveningPreviewPng(display: PreviewGame[], chicagoDate: string): Promise<Uint8Array> {
  await hydratePreviewLogos(display);
  return rasterizeSvg(renderPreviewSvg(previewCardModel(display, previewDateLabel(chicagoDate))));
}

type Claim = "ok" | "dup" | "error";

export async function claimPreview(db: SupabaseClient, chicagoDate: string): Promise<Claim> {
  const { error } = await db.from("sports_finals_preview_sent").insert({
    chicago_date: chicagoDate,
    game_keys: [],
  });
  if (!error) return "ok";
  if (String(error.code) === "23505" || /duplicate/i.test(error.message)) return "dup";
  console.error("preview claim", error.message);
  return "error";
}

export async function releasePreview(db: SupabaseClient, chicagoDate: string): Promise<void> {
  await db.from("sports_finals_preview_sent").delete().eq("chicago_date", chicagoDate);
}

export async function markPreviewSent(
  db: SupabaseClient,
  chicagoDate: string,
  gameKeys: string[],
  bytes: number,
): Promise<void> {
  await db
    .from("sports_finals_preview_sent")
    .update({ game_keys: gameKeys, bytes, sent_at: new Date().toISOString() })
    .eq("chicago_date", chicagoDate);
}

export async function deliverPreview(
  display: PreviewGame[],
  chicagoDate: string,
  chats: string[],
  token: string,
  origin: string,
): Promise<{ caption: string; bytes: number }> {
  const png = await renderEveningPreviewPng(display, chicagoDate);
  const caption = previewCaption(display, chicagoDate);
  const replyMarkup = previewReplyMarkup(origin);
  for (const chatId of chats) {
    await sendTelegramPhoto(token, chatId, png, caption, replyMarkup);
  }
  return { caption, bytes: png.byteLength };
}

export function previewJsonMeta(build: PreviewBuild): Record<string, unknown> {
  return {
    chicagoDate: build.chicagoDate,
    claimKey: build.claimKey,
    count: build.games.length,
    skipped: build.skipped,
    games: build.display.map((g) => ({
      id: g.id,
      sport: g.sport,
      matchup: `${g.away.abbrev} @ ${g.home.abbrev}`,
      startIso: g.startIso,
      clock: g.startIso,
      network: g.network,
      why: g.why,
      records: `${g.away.record ?? "—"} / ${g.home.record ?? "—"}`,
      starters: [g.probableAway, g.probableHome].filter(Boolean).join(" / ") || null,
      odds: g.oddsLine,
      heat: g.heat,
    })),
  };
}
