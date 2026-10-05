/**
 * Telegram inline keyboards for sports photos.
 *
 * Heat (sports-telegram) and finals (sports-finals) share this shape so both
 * bots send the same two URL buttons instead of a caption markdown link.
 */

export const DEFAULT_COMMAND_CENTER_ORIGIN = "https://command-center-flax-gamma.vercel.app";

export type TelegramUrlButton = {
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

export function telegramInlineKeyboard(buttons: readonly TelegramUrlButton[]): string | null {
  const row = buttons.filter((button) => button.text && /^https:\/\//i.test(button.url));
  if (!row.length) return null;
  return JSON.stringify({
    inline_keyboard: [row.map((button) => ({ text: button.text, url: button.url }))],
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
  const buttons: TelegramUrlButton[] = [];
  if (game) buttons.push({ text: "Open game", url: game });
  if (ruwt) buttons.push({ text: "RUWT board", url: ruwt });
  else if (home) buttons.push({ text: "Sports home", url: home });
  return telegramInlineKeyboard(buttons);
}
