/**
 * Finals graphic for @FinalsAndStats_bot.
 *
 * sendDocument kept the PNG but Telegram shows a file chip (`final.png`)
 * instead of an inline photo. sendPhoto is the photo path Josh wants.
 *
 * Telegram recompresses sendPhoto. A PNG upload is crushed worse than a
 * high-quality JPEG we encode ourselves at full 1080×… (no extra downscale).
 * If JPEG encode is unavailable and the PNG fits the 10MB photo cap, send PNG.
 * Token is TELEGRAM_FINALS_BOT_TOKEN, never the heat bot.
 */
export const TELEGRAM_GRAPHIC_METHOD = "sendPhoto";
/** Highest practical JPEG quality before Telegram’s own photo recompress. */
export const TELEGRAM_JPEG_QUALITY = 95;
/** Step down only for the 10MB sendPhoto cap — never shrink pixels. */
export const TELEGRAM_JPEG_QUALITY_FLOOR = 92;
export const TELEGRAM_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export type TelegramPhotoPayload = {
  bytes: Uint8Array;
  mime: string;
  filename: string;
  quality: number | null;
};

export type PngToJpeg = (png: Uint8Array, quality: number) => Uint8Array;

export function prepareTelegramPhoto(png: Uint8Array, encodeJpeg?: PngToJpeg | null): TelegramPhotoPayload {
  if (encodeJpeg) {
    for (const quality of [TELEGRAM_JPEG_QUALITY, TELEGRAM_JPEG_QUALITY_FLOOR]) {
      try {
        const jpeg = encodeJpeg(png, quality);
        if (jpeg.byteLength > 0 && jpeg.byteLength <= TELEGRAM_PHOTO_MAX_BYTES) {
          return { bytes: jpeg, mime: "image/jpeg", filename: "final.jpg", quality };
        }
      } catch {
        break;
      }
    }
  }
  if (png.byteLength > 0 && png.byteLength <= TELEGRAM_PHOTO_MAX_BYTES) {
    return { bytes: png, mime: "image/png", filename: "final.png", quality: null };
  }
  throw new Error("graphic exceeds Telegram sendPhoto 10MB limit");
}

async function loadPngToJpeg(): Promise<PngToJpeg | null> {
  try {
    const mod = await import("./telegram-jpeg.ts");
    return mod.pngToJpeg;
  } catch {
    return null;
  }
}

export async function sendTelegramPhoto(
  token: string,
  chatId: string,
  png: Uint8Array,
  caption: string,
  replyMarkup?: string | null,
  encodeJpeg?: PngToJpeg | null,
): Promise<void> {
  const encode = encodeJpeg === undefined ? await loadPngToJpeg() : encodeJpeg;
  const photo = prepareTelegramPhoto(png, encode);
  const form = new FormData();
  form.set("chat_id", chatId);
  if (caption) form.set("caption", caption.slice(0, 1024));
  if (replyMarkup) form.set("reply_markup", replyMarkup);
  form.set("photo", new Blob([photo.bytes], { type: photo.mime }), photo.filename);
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
