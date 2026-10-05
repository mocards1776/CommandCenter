/** sendVideo for @CommandCenterHighlights_bot. Token is TELEGRAM_HIGHLIGHTS_BOT_TOKEN. */

export type TelegramSendResult = {
  chatId: string;
  ok: boolean;
  error?: string;
};

const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;

async function telegramCall(
  token: string,
  method: string,
  body: FormData,
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(45_000),
  });
  const payload = (await res.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  if (!res.ok || payload?.ok === false) {
    return { ok: false, description: payload?.description || `Telegram HTTP ${res.status}` };
  }
  return { ok: true };
}

async function downloadMp4(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "video/mp4,*/*", "User-Agent": "CommandCenterSportsHighlights" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.byteLength || buf.byteLength > MAX_DOWNLOAD_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

function fillVideoFields(
  form: FormData,
  opts: {
    chatId: string;
    caption: string;
    replyMarkup?: string | null;
    durationSec?: number | null;
    width?: number | null;
    height?: number | null;
  },
): void {
  form.set("chat_id", opts.chatId);
  form.set("supports_streaming", "true");
  if (opts.caption) form.set("caption", opts.caption.slice(0, 1024));
  if (opts.replyMarkup) form.set("reply_markup", opts.replyMarkup);
  if (opts.durationSec && opts.durationSec > 0) form.set("duration", String(opts.durationSec));
  if (opts.width && opts.width > 0) form.set("width", String(opts.width));
  if (opts.height && opts.height > 0) form.set("height", String(opts.height));
}

export async function sendTelegramVideo(opts: {
  token: string;
  videoUrl: string;
  caption: string;
  chatIds: readonly string[];
  replyMarkup?: string | null;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
}): Promise<TelegramSendResult[]> {
  const token = opts.token.trim();
  if (!token) throw new Error("TELEGRAM_HIGHLIGHTS_BOT_TOKEN is not set");
  const bytes = await downloadMp4(opts.videoUrl);
  const results: TelegramSendResult[] = [];
  for (const chatId of opts.chatIds) {
    const form = new FormData();
    fillVideoFields(form, {
      chatId,
      caption: opts.caption,
      replyMarkup: opts.replyMarkup,
      durationSec: opts.durationSec,
      width: opts.width,
      height: opts.height,
    });
    if (bytes) {
      form.set("video", new Blob([bytes], { type: "video/mp4" }), "goal.mp4");
    } else {
      form.set("video", opts.videoUrl);
    }
    try {
      let sent = await telegramCall(token, "sendVideo", form);
      if (!sent.ok && bytes) {
        const retry = new FormData();
        fillVideoFields(retry, {
          chatId,
          caption: opts.caption,
          replyMarkup: opts.replyMarkup,
          durationSec: opts.durationSec,
          width: opts.width,
          height: opts.height,
        });
        retry.set("video", opts.videoUrl);
        sent = await telegramCall(token, "sendVideo", retry);
      }
      results.push(
        sent.ok
          ? { chatId, ok: true }
          : { chatId, ok: false, error: (sent.description ?? "sendVideo failed").slice(0, 180) },
      );
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

/**
 * Text, or a photo when an https poster exists. Never sendVideo — game wraps
 * are too long to upload, and this method has no video field.
 */
export function noticeMethod(photoUrl: string | null | undefined): "sendPhoto" | "sendMessage" {
  return photoUrl && /^https:\/\//i.test(photoUrl.trim()) ? "sendPhoto" : "sendMessage";
}

function formFrom(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value) form.set(key, value);
  }
  return form;
}

export async function sendTelegramNotice(opts: {
  token: string;
  caption: string;
  chatIds: readonly string[];
  photoUrl?: string | null;
  replyMarkup?: string | null;
}): Promise<TelegramSendResult[]> {
  const token = opts.token.trim();
  if (!token) throw new Error("TELEGRAM_HIGHLIGHTS_BOT_TOKEN is not set");
  const caption = opts.caption.slice(0, 1024);
  const photo = noticeMethod(opts.photoUrl) === "sendPhoto" ? opts.photoUrl!.trim() : "";
  const markup = opts.replyMarkup ?? "";
  const results: TelegramSendResult[] = [];
  for (const chatId of opts.chatIds) {
    try {
      let sent = photo
        ? await telegramCall(
          token,
          "sendPhoto",
          formFrom({ chat_id: chatId, photo, caption, reply_markup: markup }),
        )
        : { ok: false as const, description: undefined };
      if (!sent.ok) {
        sent = await telegramCall(
          token,
          "sendMessage",
          formFrom({ chat_id: chatId, text: caption, reply_markup: markup }),
        );
      }
      results.push(
        sent.ok
          ? { chatId, ok: true }
          : { chatId, ok: false, error: (sent.description ?? "send failed").slice(0, 180) },
      );
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
