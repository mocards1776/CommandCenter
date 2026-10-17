/**
 * Stored Athletic article text. Off unless ATHLETIC_FULLTEXT=on.
 * A missing table, an empty table, or a failed read leaves every card as it was.
 */
import { isPrintableStoryBody } from "./newspaper-copy.ts";
import type { GameWrapCard } from "./newspaper-sports.ts";

export type AthleticFulltextRow = { url: string; body: string };

type DenoEnv = { env?: { get?: (name: string) => string | undefined } };

function denoEnv(name: string): string | undefined {
  try {
    const deno = (globalThis as { Deno?: DenoEnv }).Deno;
    const value = deno?.env?.get?.(name);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** The press reads stored Athletic text only when this is exactly "on". */
export function athleticFulltextEnabled(): boolean {
  return denoEnv("ATHLETIC_FULLTEXT") === "on";
}

export function normalizeAthleticUrl(raw: string | null | undefined): string | null {
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  if (!/(?:theathletic\.com|nytimes\.com\/athletic\/)/i.test(raw)) return null;
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function athleticArticleUrl(card: {
  wrapHref?: string | null;
  gameHref?: string | null;
}): string | null {
  return normalizeAthleticUrl(card.wrapHref) ?? normalizeAthleticUrl(card.gameHref);
}

/**
 * Replace an Athletic card's body with stored prose when that prose is printable.
 * No matching row: the same card list comes back.
 */
export function applyAthleticFulltext<T extends GameWrapCard>(cards: T[], rows: AthleticFulltextRow[]): T[] {
  if (!rows.length || !cards.length) return cards;
  const by = new Map<string, string>();
  for (const row of rows) {
    const url = normalizeAthleticUrl(row.url);
    const body = row.body.replace(/\s+/g, " ").trim();
    if (url && isPrintableStoryBody(body)) by.set(url, body);
  }
  if (!by.size) return cards;
  let changed = false;
  const next = cards.map((card) => {
    const url = athleticArticleUrl(card);
    const body = url ? by.get(url) : undefined;
    if (!body || body === card.body) return card;
    changed = true;
    return { ...card, body };
  });
  return changed ? next : cards;
}

async function readAthleticFulltext(urls: string[]): Promise<AthleticFulltextRow[]> {
  const base = denoEnv("SUPABASE_URL");
  const key = denoEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key || !urls.length) return [];
  const list = urls.map((url) => `"${url.replace(/"/g, "")}"`).join(",");
  const res = await fetch(
    `${base}/rest/v1/times_athletic_fulltext?select=url,body&url=in.(${encodeURIComponent(list)})`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as { url?: unknown; body?: unknown };
    if (typeof item.url !== "string" || typeof item.body !== "string") return [];
    return [{ url: item.url, body: item.body }];
  });
}

/** One lookup. Flag off, no Athletic URLs, or any failure: the cards are unchanged. */
export async function withStoredAthleticText<T extends GameWrapCard>(cards: T[]): Promise<T[]> {
  if (!athleticFulltextEnabled()) return cards;
  const urls = [...new Set(cards.map(athleticArticleUrl).filter((url): url is string => Boolean(url)))];
  if (!urls.length) return cards;
  try {
    return applyAthleticFulltext(cards, await readAthleticFulltext(urls));
  } catch {
    return cards;
  }
}
