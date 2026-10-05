/**
 * Telegram inline keyboards for sports photos.
 *
 * Heat (sports-telegram) and finals (sports-finals) share this shape so both
 * bots send the same two Mini App buttons instead of a caption markdown link
 * or a Safari URL button. Private DMs only — web_app is not valid in
 * channels/groups. BotFather /setdomain is not required for these buttons.
 */

export const DEFAULT_COMMAND_CENTER_ORIGIN = "https://command-center-flax-gamma.vercel.app";

export type TelegramCommandCenterButton = {
  text: string;
  url: string;
};

export function commandCenterOrigin(origin: string | null | undefined): string {
  return (origin ?? "").replace(/\/$/, "") || DEFAULT_COMMAND_CENTER_ORIGIN;
}

export function ruwtBoardUrl(origin: string | null | undefined): string {
  return `${commandCenterOrigin(origin)}/sports/ruwt?solo=1`;
}

export function sportsHomeUrl(origin: string | null | undefined): string {
  return `${commandCenterOrigin(origin)}/sports?solo=1`;
}

export function gameDetailUrl(origin: string | null | undefined, path: string | null | undefined): string | null {
  const href = (path ?? "").trim();
  if (!href) return null;
  const root = commandCenterOrigin(origin);
  return `${root}${href.startsWith("/") ? href : `/${href}`}`;
}

export function telegramMiniAppButton(text: string, url: string): { text: string; web_app: { url: string } } {
  return { text, web_app: { url } };
}

/**
 * One row of Mini App buttons. Destinations stay Command Center HTTPS URLs
 * (including ?solo=1). Telegram opens them in its WebView — no url: field,
 * so clients do not treat them as external Safari links.
 */
export function telegramInlineKeyboard(buttons: readonly TelegramCommandCenterButton[]): string | null {
  const row = buttons.filter((button) => button.text && /^https:\/\//i.test(button.url));
  if (!row.length) return null;
  return JSON.stringify({
    inline_keyboard: [row.map((button) => telegramMiniAppButton(button.text, button.url))],
  });
}

/**
 * One row: Open game + RUWT board when both URLs exist.
 * If the game path is missing, RUWT board still ships alone.
 * Sports home is the fallback second button only when the RUWT URL cannot be built.
 */
export function alertReplyMarkup(
  origin: string | null | undefined,
  gamePath: string | null | undefined,
): string | null {
  const game = gameDetailUrl(origin, gamePath);
  const ruwt = ruwtBoardUrl(origin);
  const home = sportsHomeUrl(origin);
  const buttons: TelegramCommandCenterButton[] = [];
  if (game) buttons.push({ text: "Open game", url: game });
  if (ruwt) buttons.push({ text: "RUWT board", url: ruwt });
  else if (home) buttons.push({ text: "Sports home", url: home });
  return telegramInlineKeyboard(buttons);
}

/** NHL highlightClipSharingUrl, or a Brightcove page. Anything else is dropped. */
export function clipShareUrl(raw: string | null | undefined): string | null {
  const href = (raw ?? "").trim();
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const allowed =
    host === "nhl.com" ||
    host.endsWith(".nhl.com") ||
    host === "brightcove.com" ||
    host.endsWith(".brightcove.com") ||
    host === "brightcovecdn.com" ||
    host.endsWith(".brightcovecdn.com");
  return allowed ? url.toString() : null;
}

/**
 * Open game stays a Mini App button. When highlightClipSharingUrl is present,
 * Watch clip is a normal link to that NHL/Brightcove page — not another video upload.
 * No RUWT board; that pair stays on heat/finals.
 */
export function gameReplyMarkup(
  origin: string | null | undefined,
  gamePath: string | null | undefined,
  clipShare?: string | null,
): string | null {
  const row: Array<{ text: string; web_app: { url: string } } | { text: string; url: string }> = [];
  const game = gameDetailUrl(origin, gamePath);
  if (game) row.push(telegramMiniAppButton("Open game", game));
  const clip = clipShareUrl(clipShare);
  if (clip) row.push({ text: "Watch clip", url: clip });
  if (!row.length) return null;
  return JSON.stringify({ inline_keyboard: [row] });
}
