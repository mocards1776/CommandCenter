import type { QueryClient } from "@tanstack/react-query";
import {
  fetchMlbBoxscore,
  fetchMlbGamePreview,
  parseEspnGameIdFromUrl,
  resolveMlbGamePkFromEspnEvent,
} from "./mlb";
import { parseMlbGameArticleLink, type RssFeedItem } from "./rss";

/** True when the item opens the sports game reader (not a text extract). */
export function isDispatchGameItem(
  item: Pick<RssFeedItem, "link">,
  feedUrl?: string,
): boolean {
  if (parseMlbGameArticleLink(item.link) != null) return true;
  if (
    feedUrl === "synthetic:cardinals-wraps" ||
    feedUrl === "synthetic:mlb-wraps" ||
    feedUrl === "synthetic:nfl-wraps" ||
    feedUrl === "synthetic:soccer-clubs-wraps" ||
    feedUrl === "synthetic:epl-wraps"
  ) {
    return true;
  }
  if (/espn\.com\/(?:mlb|nfl)\/(?:recap|preview|game)/i.test(item.link)) return true;
  if (/espn\.com\/soccer\/(?:match|preview|report|recap)/i.test(item.link)) return true;
  return false;
}

async function warmMlbGamePk(qc: QueryClient, gamePk: number): Promise<void> {
  const pk = String(gamePk);
  await Promise.all([
    qc.prefetchQuery({
      queryKey: ["mlb-boxscore-v4", pk],
      queryFn: () => fetchMlbBoxscore(gamePk),
      staleTime: 30_000,
    }),
    qc.prefetchQuery({
      queryKey: ["mlb-game-preview-stats", pk],
      queryFn: () => fetchMlbGamePreview(gamePk),
      staleTime: 120_000,
    }),
  ]);
}

/**
 * Warm MLB box score + preview stats for Dispatch game rows so arrow-key
 * navigation hits the React Query cache instead of cold API chains.
 */
export async function prefetchDispatchGameData(
  qc: QueryClient,
  item: Pick<RssFeedItem, "link">,
  feedUrl?: string,
): Promise<void> {
  if (!isDispatchGameItem(item, feedUrl)) return;

  const directPk = parseMlbGameArticleLink(item.link);
  if (directPk != null) {
    await warmMlbGamePk(qc, directPk);
    return;
  }

  const eventId = parseEspnGameIdFromUrl(item.link);
  if (!eventId || !/espn\.com\/mlb\//i.test(item.link)) return;

  let gamePk = qc.getQueryData<number | null>(["mlb-gamepk-from-espn", eventId]);
  if (gamePk === undefined) {
    gamePk = await qc.fetchQuery({
      queryKey: ["mlb-gamepk-from-espn", eventId],
      queryFn: () => resolveMlbGamePkFromEspnEvent(eventId),
      staleTime: 300_000,
    });
  }
  if (gamePk == null) return;
  await warmMlbGamePk(qc, gamePk);
}
