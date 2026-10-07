/**
 * Competitive graphic for @ThompsonCompetitive_bot.
 *
 * sendPhoto is the path Josh wants (same as sports-finals). Telegram
 * recompresses photos; a high-quality JPEG we encode from the fitTo-900
 * raster survives that better than a PNG. Never use Times browser screenshots.
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
          return { bytes: jpeg, mime: "image/jpeg", filename: "competitive.jpg", quality };
        }
      } catch {
        break;
      }
    }
  }
  if (png.byteLength > 0 && png.byteLength <= TELEGRAM_PHOTO_MAX_BYTES) {
    return { bytes: png, mime: "image/png", filename: "competitive.png", quality: null };
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

export function parseChatIds(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}
