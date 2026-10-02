/**
 * News articles for the Thompson Times.
 *
 * The sports section runs stories about the clubs you follow — a recap if they
 * played last night, otherwise the piece that actually names them. A league
 * odds roundup that merely lists every team is not a story about your club.
 */

import { favoriteDeskWeight, withinEditionHours } from "./newspaper";
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

/**
 * How clearly an article is about this club.
 * 10 for being tagged as the club, +40 if the headline names it, +10 if the
 * dek does, +25 if it is the only team tagged. A preview loses 15. Anything
 * under 20 is a weak tag — a roundup that lists the club — and stays out.
 */
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

function articleInEdition(article: NewsArticle, pressId: string): boolean {
  return withinEditionHours(article.published, pressId);
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

function toCard(
  fav: SportsFavorite,
  article: NewsArticle,
  body: string,
  listRank?: number,
): GameWrapCard | null {
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
    listRank,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Club articles from the 18 hours before this press.
 */
export async function fetchTeamArticles(
  favs: SportsFavorite[],
  edition: string,
): Promise<GameWrapCard[]> {
  const picked: { fav: SportsFavorite; article: NewsArticle; listRank: number }[] = [];
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
        // ESPN's own order is the popularity signal. The score of 20 still decides
        // whether the piece is actually about the club.
        const mine = about
          .map((article, listRank) => ({ article, listRank }))
          .filter(
            ({ article }) =>
              articleInEdition(article, edition) && favoriteArticleScore(fav, article) >= 20,
          )
          .sort(
            (a, b) =>
              favoriteArticleScore(fav, b.article) - favoriteArticleScore(fav, a.article) ||
              a.listRank - b.listRank,
          )
          .slice(0, 6);
        for (const { article, listRank } of mine) {
          const id = String(article.id ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          picked.push({ fav, article, listRank });
        }
      } catch {
        /* one club's news feed shouldn't kill the edition */
      }
    }),
  );

  picked.sort(
    (a, b) => favoriteDeskWeight(b.fav.key) - favoriteDeskWeight(a.fav.key) || a.listRank - b.listRank,
  );
  const withBody = await Promise.all(
    picked.slice(0, 24).map(async ({ fav, article, listRank }) => {
      const fallback = wireCopy(article.description ?? "");
      const body = await articleBody(String(article.id), fallback);
      return toCard(fav, article, body, listRank);
    }),
  );
  const rest = picked
    .slice(24)
    .map(({ fav, article, listRank }) => toCard(fav, article, article.description ?? "", listRank));
  return [...withBody, ...rest].filter((card): card is GameWrapCard => card != null);
}

function leagueLabel(path: string): string {
  const slug = path.split("/").pop() ?? "League";
  return slug.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toLeagueCard(
  path: string,
  article: NewsArticle,
  body: string,
  listRank?: number,
): GameWrapCard | null {
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
    listRank,
  };
}

/**
 * League wire for each sport section. Same window as the front: this edition only.
 */
export async function fetchLeagueArticles(
  paths: string[],
  edition: string,
): Promise<GameWrapCard[]> {
  const unique = [...new Set(paths.filter(Boolean))];
  const seen = new Set<string>();
  const byPath = new Map<string, { article: NewsArticle; listRank: number }[]>();

  await mapLimit(unique, 2, async (path) => {
      try {
        const data = (await espnGet(`${path}/news?limit=50`)) as { articles?: NewsArticle[] };
        const pool = data.articles ?? [];
        // Keep ESPN's list order. That order is the only popularity signal we have.
        const ranked = pool.filter((article) => articleInEdition(article, edition)).slice(0, 16);
        const rows: { article: NewsArticle; listRank: number }[] = [];
        ranked.forEach((article, listRank) => {
          const id = String(article.id ?? "");
          if (!id || seen.has(id)) return;
          seen.add(id);
          rows.push({ article, listRank });
        });
        byPath.set(path, rows);
      } catch {
        /* one league's wire shouldn't kill the edition */
      }
  });

  const picked = unique.flatMap((path) =>
    (byPath.get(path) ?? []).map((row) => ({ path, article: row.article, listRank: row.listRank })),
  );
  const withBody = await mapLimit(picked.slice(0, 24), 3, async ({ path, article, listRank }) => {
      const fallback = wireCopy(article.description ?? "");
      const body = await articleBody(String(article.id), fallback);
      return toLeagueCard(path, article, body, listRank);
  });
  const rest = picked
    .slice(24)
    .map(({ path, article, listRank }) => toLeagueCard(path, article, article.description ?? "", listRank));
  return [...withBody, ...rest].filter((card): card is GameWrapCard => card != null);
}
