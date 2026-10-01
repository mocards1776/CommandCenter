/**
 * News articles for the Thompson Times.
 *
 * The sports section runs stories about the clubs you follow — a recap if they
 * played last night, otherwise the piece that actually names them. A league
 * odds roundup that merely lists every team is not a story about your club.
 */

import { editionCovers, editionCoversRecent, editionCoversResult, isResultCopy } from "./newspaper";
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
  if (teams.length > 3) return false;
  const tagged = teams.some((cat) => String(cat.teamId ?? "") === teamId);
  if (!tagged) return false;
  const names = clubMentionNames(fav);
  const head = (article.headline ?? "").toLowerCase();
  // Headline must name the club whenever more than one team is tagged.
  if (names.some((name) => head.includes(name))) return true;
  if (teams.length !== 1) return false;
  const hay = `${head} ${(article.description ?? "").toLowerCase()}`;
  return names.some((name) => hay.includes(name));
}

/** Higher = more clearly about this favorite club. */
export function favoriteArticleScore(fav: SportsFavorite, article: NewsArticle): number {
  if (!mentionsClub(fav, article)) return 0;
  const names = clubMentionNames(fav);
  const head = (article.headline ?? "").toLowerCase();
  const dek = (article.description ?? "").toLowerCase();
  const teams = (article.categories ?? []).filter((cat) => cat.type === "team");
  let score = 10;
  if (names.some((n) => head.includes(n))) score += 40;
  if (names.some((n) => dek.includes(n))) score += 10;
  if (teams.length === 1) score += 25;
  else if (teams.length === 2) score += 8;
  if (/\bpreview\b/i.test(head) || /\bpreview\b/i.test(article.type ?? "")) score -= 15;
  return score;
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

/** Short lookback so section pages stay fresh. */
function articleInSection(article: NewsArticle, edition: string): boolean {
  return editionCoversRecent(article.published, edition, 2);
}

/** AP copy leads with a bare em dash when the dateline is stripped, and ends on a link plug. */
function wireCopy(text: string): string {
  return text
    .replace(/^\s*[—–-]+\s*/, "")
    .replace(/^([A-Z][A-Z .,'-]+?)\s*--\s*[—–]\s*/, "$1 -- ")
    .replace(/\s*-{3,}\s*See AP'?s[\s\S]*$/i, "")
    .replace(/\s*_{3,}\s*AP [\s\S]*$/, "")
    .trim();
}

async function articleBody(id: string, fallback: string): Promise<string> {
  try {
    const res = await fetch(`https://content.core.api.espn.com/v1/sports/news/${id}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { headlines?: { story?: string; description?: string }[] };
    const story = wireCopy(stripHtml(data.headlines?.[0]?.story ?? ""));
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
  const dek = wireCopy(article.description ?? "") || null;
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
 * Club articles for the Times. Prefer edition-day copy, then reach back a few
 * days so section insides and recap pages stay full.
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
        const data = (await espnGet(`${path}/news?team=${teamId}&limit=40`)) as {
          articles?: NewsArticle[];
        };
        const about = (data.articles ?? []).filter((article) => mentionsClub(fav, article));
        const fresh = about.filter((article) => articleInSection(article, edition));
        // A club between games (or just out of season) still gets its latest pieces.
        const pool = fresh.length
          ? fresh
          : about.filter((article) => editionCoversRecent(article.published, edition, 7)).slice(0, 3);
        const mine = pool
          .sort((a, b) => favoriteArticleScore(fav, b) - favoriteArticleScore(fav, a))
          .slice(0, 6);
        for (const article of mine) {
          const id = String(article.id ?? "");
          if (!id || seen.has(id)) continue;
          // Drop weak matches (tagged but barely about the club).
          if (favoriteArticleScore(fav, article) < 20) continue;
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
    picked.slice(0, 24).map(async ({ fav, article }) => {
      const fallback = wireCopy(article.description ?? "");
      const body = await articleBody(String(article.id), fallback);
      return toCard(fav, article, body);
    }),
  );
  const rest = picked.slice(24).map(({ fav, article }) => toCard(fav, article, article.description ?? ""));
  return [...withBody, ...rest].filter((card): card is GameWrapCard => card != null);
}

function leagueLabel(path: string): string {
  const slug = path.split("/").pop() ?? "League";
  return slug.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toLeagueCard(path: string, article: NewsArticle, body: string): GameWrapCard | null {
  const headline = article.headline?.trim() ?? "";
  const id = String(article.id ?? "");
  if (!headline || !id) return null;
  const teamCat = (article.categories ?? []).find((cat) => cat.type === "team" && cat.description);
  const teamName = teamCat?.description?.trim() || leagueLabel(path);
  const href = article.links?.web?.href ?? null;
  const dek = wireCopy(article.description ?? "") || null;
  return {
    id: `league-${id}`,
    favoriteKey: "",
    teamName,
    teamHref: href || "/",
    sportLabel: leagueLabel(path),
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
    caption: teamName,
    followed: false,
    status: article.type ?? null,
  };
}

/**
 * League wire for each sport section — fills NFL1/MLB1/etc. even when your
 * clubs are quiet. Uses a multi-day window so recap pages stay stocked.
 */
export async function fetchLeagueArticles(
  paths: string[],
  edition: string,
): Promise<GameWrapCard[]> {
  const unique = [...new Set(paths.filter(Boolean))];
  const picked: { path: string; article: NewsArticle }[] = [];
  const seen = new Set<string>();

  await Promise.all(
    unique.map(async (path) => {
      try {
        const data = (await espnGet(`${path}/news?limit=50`)) as { articles?: NewsArticle[] };
        const pool = data.articles ?? [];
        // Prefer true edition-day copy, then fill from the recent window.
        const ranked = [
          ...pool.filter((article) => articleInEdition(article, edition)),
          ...pool.filter(
            (article) => !articleInEdition(article, edition) && articleInSection(article, edition),
          ),
        ].slice(0, 24);
        for (const article of ranked) {
          const id = String(article.id ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          picked.push({ path, article });
        }
      } catch {
        /* one league's wire shouldn't kill the edition */
      }
    }),
  );

  picked.sort((a, b) => String(b.article.published ?? "").localeCompare(String(a.article.published ?? "")));
  const withBody = await Promise.all(
    picked.slice(0, 40).map(async ({ path, article }) => {
      const fallback = wireCopy(article.description ?? "");
      const body = await articleBody(String(article.id), fallback);
      return toLeagueCard(path, article, body);
    }),
  );
  const rest = picked
    .slice(40)
    .map(({ path, article }) => toLeagueCard(path, article, article.description ?? ""));
  return [...withBody, ...rest].filter((card): card is GameWrapCard => card != null);
}
