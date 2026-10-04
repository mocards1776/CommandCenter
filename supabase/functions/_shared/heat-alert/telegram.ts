/**
 * Telegram sendPhoto. The bot token is passed in; this file never reads secrets
 * so the Sports preview and the unit tests can import it.
 */

export function parseChatAllowlist(raw: string | null | undefined): string[] {
  const ids: string[] = [];
  for (const part of (raw ?? "").split(/[\s,]+/)) {
    const id = part.trim();
    if (!id || ids.includes(id)) continue;
    if (/^-?\d{1,20}$/.test(id)) ids.push(id);
  }
  return ids;
}

export function resolveChatTargets(
  allowlist: readonly string[],
  requested: string | null | undefined,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!allowlist.length) {
    return { ok: false, error: "TELEGRAM_CHAT_IDS is empty. Add the chats this bot may message." };
  }
  const ask = (requested ?? "").trim();
  if (!ask) return { ok: true, ids: [...allowlist] };
  if (!allowlist.includes(ask)) {
    return { ok: false, error: "chatId is not in TELEGRAM_CHAT_IDS." };
  }
  return { ok: true, ids: [ask] };
}

export type TelegramSendResult = {
  chatId: string;
  ok: boolean;
  error?: string;
};

export async function sendTelegramPhoto(opts: {
  token: string;
  png: Uint8Array;
  caption: string;
  chatIds: readonly string[];
  filename?: string;
}): Promise<TelegramSendResult[]> {
  const token = opts.token.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const caption = opts.caption.slice(0, 1024);
  const filename = opts.filename || "heat-alert.png";
  const results: TelegramSendResult[] = [];
  for (const chatId of opts.chatIds) {
    const body = new FormData();
    body.set("chat_id", chatId);
    body.set("caption", caption);
    body.set("photo", new Blob([opts.png], { type: "image/png" }), filename);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
      if (!res.ok || payload?.ok === false) {
        results.push({
          chatId,
          ok: false,
          error: (payload?.description || `Telegram HTTP ${res.status}`).slice(0, 180),
        });
        continue;
      }
      results.push({ chatId, ok: true });
    } catch (err) {
      results.push({
        chatId,
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 180) : "Telegram request failed",
      });
    }
  }
  return results;
}
