/**
 * News articles for the Thompson Times.
 *
 * The sports section runs stories about the clubs you follow — a recap if they
 * played last night, otherwise the piece that actually names them. A league
 * odds roundup that merely lists every team is not a story about your club.
 */

import { editionCovers, editionCoversResult, isResultCopy } from "./newspaper";
import {
  clubMentionNames,
  favoriteTeamHref,
  leaguePathFromEspn,
  type GameWrapCard,
} from "./newspaper-sports";
import { espnGet, type SportsFavorite } from "./sports";

type NewsCategory = {
  type?: string;
  teamId?: number | string;
  description?: string;
};

type NewsArticle = {
  id?: number | string;
  headline?: string;
  description?: string;
  published?: string;
  type?: string;
  images?: { url?: string }[];
  links?: { web?: { href?: string } };
  categories?: NewsCategory[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function mentionsClub(fav: SportsFavorite, article: NewsArticle): boolean {
  const teamId = fav.espnPath.split("/").pop() ?? "";
  const teams = (article.categories ?? []).filter((cat) => cat.type === "team");
  // A power ranking or odds card tags the whole league. That is not a club story.
  if (teams.length > 4) return false;
  const tagged = teams.some((cat) => String(cat.teamId ?? "") === teamId);
  if (!tagged) return false;
  const hay = `${article.headline ?? ""} ${article.description ?? ""}`.toLowerCase();
  return clubMentionNames(fav).some((name) => hay.includes(name));
}

function articleInEdition(article: NewsArticle, edition: string): boolean {
  const result = isResultCopy({
    headline: article.headline,
    dek: article.description,
    type: article.type,
  });
  return result
    ? editionCoversResult(article.published, edition)
    : editionCovers(article.published, edition);
}

async function articleBody(id: string, fallback: string): Promise<string> {
  try {
    const res = await fetch(`https://content.core.api.espn.com/v1/sports/news/${id}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { headlines?: { story?: string; description?: string }[] };
    const story = stripHtml(data.headlines?.[0]?.story ?? "");
    if (story.length >= 80) return story;
  } catch {
    /* the dek still runs */
  }
  return fallback;
}

function toCard(fav: SportsFavorite, article: NewsArticle, body: string): GameWrapCard | null {
  const headline = article.headline?.trim() ?? "";
  const id = String(article.id ?? "");
  if (!headline || !id) return null;
  const path = leaguePathFromEspn(fav.espnPath);
  const href = article.links?.web?.href ?? favoriteTeamHref(fav);
  const dek = (article.description ?? "").trim() || null;
  return {
    id: `news-${id}`,
    favoriteKey: fav.key,
    teamName: fav.shortName,
    teamHref: favoriteTeamHref(fav),
    sportLabel: fav.league || fav.sport,
    leaguePath: path,
    headline,
    dek,
    body: body.trim() || dek,
    scoreLine: null,
    when: article.published ?? null,
    won: null,
    gameHref: href,
    wrapHref: href,
    feedUrl: null,
    gameId: null,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
    photo: article.images?.[0]?.url ?? null,
    caption: fav.name,
    followed: true,
    status: article.type ?? null,
  };
}

/**
 * Fresh articles that name a followed club. Dated to this edition only, so a
 * Wednesday paper does not inherit the weekend.
 */
export async function fetchTeamArticles(
  favs: SportsFavorite[],
  edition: string,
): Promise<GameWrapCard[]> {
  const picked: { fav: SportsFavorite; article: NewsArticle }[] = [];
  const seen = new Set<string>();

  await Promise.all(
    favs.map(async (fav) => {
      if (fav.kind !== "team") return;
      const path = leaguePathFromEspn(fav.espnPath);
      const teamId = fav.espnPath.split("/").pop();
      if (!path || !teamId) return;
      try {
        const data = (await espnGet(`${path}/news?team=${teamId}&limit=20`)) as {
          articles?: NewsArticle[];
        };
        const mine = (data.articles ?? [])
          .filter((article) => articleInEdition(article, edition) && mentionsClub(fav, article))
          .slice(0, 3);
        for (const article of mine) {
          const id = String(article.id ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          picked.push({ fav, article });
        }
      } catch {
        /* one club's news feed shouldn't kill the edition */
      }
    }),
  );

  picked.sort((a, b) => String(b.article.published ?? "").localeCompare(String(a.article.published ?? "")));
  const withBody = await Promise.all(
    picked.slice(0, 12).map(async ({ fav, article }) => {
      const fallback = (article.description ?? "").trim();
      const body = await articleBody(String(article.id), fallback);
      return toCard(fav, article, body);
    }),
  );
  const rest = picked.slice(12).map(({ fav, article }) => toCard(fav, article, article.description ?? ""));
  return [...withBody, ...rest].filter((card): card is GameWrapCard => card != null);
}
