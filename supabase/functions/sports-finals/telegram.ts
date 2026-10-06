/**
 * Finals graphic for @FinalsAndStats_bot.
 *
 * sendPhoto JPEG-compresses (and often downscales) the PNG, which blurs MLB
 * box-score type on a phone. sendDocument keeps the original file so Telegram
 * does not recompress it. Caption and reply_markup still work. Token is
 * TELEGRAM_FINALS_BOT_TOKEN, never the heat bot.
 */
export const TELEGRAM_GRAPHIC_METHOD = "sendDocument";

export async function sendTelegramPhoto(
  token: string,
  chatId: string,
  png: Uint8Array,
  caption: string,
  replyMarkup?: string | null,
): Promise<void> {
  const form = new FormData();
  form.set("chat_id", chatId);
  if (caption) form.set("caption", caption.slice(0, 1024));
  if (replyMarkup) form.set("reply_markup", replyMarkup);
  form.set("document", new Blob([png], { type: "image/png" }), "final.png");
  const res = await fetch(`https://api.telegram.org/bot${token}/${TELEGRAM_GRAPHIC_METHOD}`, {
    method: "POST",
    body: form,
  });
  let description = "";
  try {
    const body = (await res.json()) as { ok?: boolean; description?: string };
    if (res.ok && body.ok !== false) return;
    description = body.description ?? "";
  } catch {
    description = "";
  }
  throw new Error(description || `Telegram ${TELEGRAM_GRAPHIC_METHOD} failed (${res.status})`);
}
