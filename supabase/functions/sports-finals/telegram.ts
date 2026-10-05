/** sendPhoto for @FinalsAndStats_bot. The token is TELEGRAM_FINALS_BOT_TOKEN, never the heat bot. */

export async function sendTelegramPhoto(
  token: string,
  chatId: string,
  png: Uint8Array,
  caption: string,
  replyMarkup?: string | null,
): Promise<void> {
  const form = new FormData();
  form.set("chat_id", chatId);
  if (caption) form.set("caption", caption.slice(0, 1000));
  if (replyMarkup) form.set("reply_markup", replyMarkup);
  form.set("photo", new Blob([png], { type: "image/png" }), "final.png");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
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
  throw new Error(description || `Telegram sendPhoto failed (${res.status})`);
}
