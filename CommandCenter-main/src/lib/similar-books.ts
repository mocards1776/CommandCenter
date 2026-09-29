import type { Suggestion } from "@/lib/books";

/**
 * Signals used to find books like this one. Tags and the blurb's genre
 * ("legal thriller") matter; the title does not — catalog title search
 * only ever finds the same book.
 */
export type SimilarSource = {
  title: string;
  authors?: string | null;
  tags?: string[] | null;
  subjects?: string[] | null;
  description?: string | null;
};

const GENERIC = new Set([
  "fiction",
  "nonfiction",
  "non fiction",
  "novel",
  "novels",
  "literature",
  "general",
  "english",
  "american fiction",
  "english fiction",
  "fiction in english",
  "juvenile fiction",
  "juvenile literature",
  "large type books",
  "accessible book",
  "protected daisy",
  "ebook",
  "audiobook",
  "audio",
  "hardcover",
  "paperback",
  "digital",
  "physical",
  "kindle",
  "owned",
  "favorite",
  "favourites",
  "to read",
  "currently reading",
  "dnf",
  "did not finish",
  "read",
  "reading",
  "book",
  "books",
  "magazine",
  "series",
  "standalone",
]);

/** Longer phrases first so "legal thriller" wins over "thriller". */
const GENRE_PHRASES = [
  "legal thriller",
  "courtroom drama",
  "courtroom thriller",
  "legal fiction",
  "legal stories",
  "spy thriller",
  "spy novel",
  "political thriller",
  "psychological thriller",
  "domestic thriller",
  "techno thriller",
  "true crime",
  "science fiction",
  "historical fiction",
  "literary fiction",
  "magical realism",
  "graphic novel",
  "short stories",
  "young adult",
  "self help",
  "personal finance",
  "biography",
  "autobiography",
  "memoir",
  "fantasy",
  "horror",
  "romance",
  "mystery",
  "thriller",
  "western",
  "poetry",
];

const JUNK_TITLE =
  /\b(summary|study guide|cliff\s?notes|cliffsnotes|sparknotes|workbook|critical analysis|omnibus|boxed set)\b|\(adaptation\)|^novels\b/i;

export function normalizeTopic(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericTopic(topic: string): boolean {
  const n = normalizeTopic(topic);
  if (!n || n.length < 3) return true;
  return GENERIC.has(n);
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** Drop a broader genre when a more specific one is already present. */
function preferSpecific(phrases: string[]): string[] {
  return phrases.filter((p) => !phrases.some((other) => other !== p && other.includes(p)));
}

function textHasPhrase(text: string, phrase: string): boolean {
  const parts = phrase.split(" ").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const last = parts.pop();
  if (!last) return false;
  const body = [...parts, `${last}s?`].join("\\s+");
  return new RegExp(`(?:^|\\s)${body}(?:\\s|$)`).test(text);
}

/**
 * Up to two topics that describe what this book is like.
 * User tags win, then a genre named in the blurb, then catalog subjects.
 */
export function similarTopics(book: SimilarSource): string[] {
  const tags = unique(
    (book.tags ?? []).map(normalizeTopic).filter((t) => t && !isGenericTopic(t)),
  );
  if (tags.length) return tags.slice(0, 2);

  const text = normalizeTopic(book.description ?? "");
  if (text) {
    const found: string[] = [];
    for (const phrase of GENRE_PHRASES) {
      if (textHasPhrase(text, phrase)) found.push(phrase);
    }
    const specific = preferSpecific(found);
    if (specific.length) return specific.slice(0, 2);
  }

  const subjects = unique(
    (book.subjects ?? [])
      .map(normalizeTopic)
      .filter((t) => t && !isGenericTopic(t) && t.length <= 40),
  );
  return subjects.slice(0, 2);
}

export function similarTitleKey(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[:\u2014\u2013]|\s-\s/)[0]
    .replace(/\(.*?\)/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/^(the|a|an) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

const COMMON_FIRST = new Set([
  "john",
  "jon",
  "james",
  "david",
  "michael",
  "robert",
  "mary",
  "scott",
  "bill",
  "william",
  "chris",
  "mike",
  "steve",
  "mark",
  "paul",
]);

function authorTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Same work even when catalogs flip "Jon Cowan" to "Cowan, Jon". */
export function sameWork(
  title: string,
  author: string,
  otherTitle: string,
  otherAuthor: string,
): boolean {
  if (!title || !otherTitle) return false;
  if (similarTitleKey(title) !== similarTitleKey(otherTitle)) return false;
  const a = authorTokens(author);
  const b = authorTokens(otherAuthor);
  if (a.length === 0 || b.length === 0) return true;
  if (a.join(" ") === b.join(" ")) return true;
  return a.some((t) => t.length > 3 && !COMMON_FIRST.has(t) && b.includes(t));
}

export function bookMatchesTopics(book: SimilarSource, topics: string[]): boolean {
  if (!topics.length) return false;
  const foldedTopics = topics.map(foldTopic);
  const hay = [
    ...(book.tags ?? []),
    ...(book.subjects ?? []),
    ...similarTopics({ ...book, tags: [], subjects: book.subjects }),
    ...similarTopics({ ...book, tags: [], subjects: [] }),
  ].map(foldTopic);
  return foldedTopics.some((topic) => hay.some((h) => h === topic || h.includes(topic)));
}

function foldTopic(raw: string): string {
  return normalizeTopic(raw)
    .split(" ")
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
    .join(" ");
}

function labelTopic(topic: string): string {
  return topic.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

type OlDoc = Record<string, unknown>;

function mapDoc(doc: OlDoc, topic: string): Suggestion | null {
  const rawTitle = String(doc.title ?? "").trim();
  const subtitle = String(doc.subtitle ?? "").trim();
  if (!rawTitle || JUNK_TITLE.test(rawTitle) || JUNK_TITLE.test(subtitle)) return null;
  let title = rawTitle;
  if (subtitle) {
    const tNorm = normalizeTopic(rawTitle);
    const sNorm = normalizeTopic(subtitle);
    if (sNorm && !tNorm.includes(sNorm) && !sNorm.includes(tNorm)) title = `${rawTitle}: ${subtitle}`;
  }
  const author = Array.isArray(doc.author_name)
    ? (doc.author_name as string[]).slice(0, 3).join(", ")
    : "";
  const year = doc.first_publish_year ? String(doc.first_publish_year) : "";
  const cover =
    typeof doc.cover_i === "number"
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : null;
  const subjects = Array.isArray(doc.subject) ? (doc.subject as unknown[]).map((s) => String(s)) : [];
  const matched = subjects.find((s) => foldTopic(s).includes(foldTopic(topic))) ?? "";
  const isbnRaw = Array.isArray(doc.isbn)
    ? String(
        (doc.isbn as string[]).find((x) => String(x).replace(/[^0-9Xx]/g, "").length === 13) ??
          (doc.isbn as string[])[0] ??
          "",
      ).replace(/[^0-9Xx]/g, "")
    : "";
  const isbn = isbnRaw.length === 10 || isbnRaw.length === 13 ? isbnRaw : null;
  const pages =
    typeof doc.number_of_pages_median === "number" && doc.number_of_pages_median > 0
      ? Math.round(doc.number_of_pages_median)
      : null;
  return {
    title,
    subtitle: subtitle || null,
    author,
    year,
    reason:
      matched && normalizeTopic(matched).length <= 40
        ? labelTopic(normalizeTopic(matched))
        : labelTopic(topic),
    cover_url: cover,
    isbn,
    page_count: pages,
  };
}

function docLanguages(doc: OlDoc): string[] {
  if (Array.isArray(doc.language)) return doc.language.map((l) => String(l));
  if (doc.language) return [String(doc.language)];
  return [];
}

/** OL lists translations first (`jpn` then `eng`). English if any code is eng. */
function isEnglishDoc(doc: OlDoc): boolean {
  const langs = docLanguages(doc);
  return langs.length === 0 || langs.includes("eng");
}

/**
 * Prefer a subject that *is* the topic ("legal thrillers") over a passing
 * mention, and sink romances that only borrowed the label.
 */
function topicRank(doc: OlDoc, topic: string): number {
  const subjects = Array.isArray(doc.subject) ? doc.subject.map((s) => foldTopic(String(s))) : [];
  const t = foldTopic(topic);
  let score = 1;
  if (subjects.some((s) => s === t || s === `${t} fiction`)) score = 0;
  if (subjects.some((s) => /\bromance\b|\bromantic\b/.test(s))) score += 3;
  if (!isEnglishDoc(doc)) score += 2;
  return score;
}

async function fetchOlDocs(url: string, signal: AbortSignal): Promise<OlDoc[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      if (signal.aborted) break;
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
    }
    try {
      const res = await fetch(url, { signal });
      if (res.ok) return ((await res.json())?.docs ?? []) as OlDoc[];
    } catch {
      if (signal.aborted) break;
    }
  }
  return null;
}

/**
 * Other books in the same vein. Subject search, not a title search —
 * "Proof" by Jon Cowan should surface legal thrillers, not more editions of Proof.
 */
export async function searchSimilarBooks(opts: {
  topics: string[];
  title: string;
  author: string;
}): Promise<Suggestion[]> {
  const topics = unique(opts.topics.map(normalizeTopic).filter((t) => t && !isGenericTopic(t))).slice(0, 2);
  if (!topics.length) return [];

  const fields =
    "title,subtitle,author_name,first_publish_year,cover_i,subject,isbn,number_of_pages_median,language";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);

  let answered = 0;
  const buckets: { doc: OlDoc; topic: string }[][] = [];

  try {
    const responses = await Promise.all(
      topics.map(async (topic) => {
        const q = `subject:"${topic}"`;
        const docs = await fetchOlDocs(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=16&fields=${fields}`,
          ctl.signal,
        );
        return { topic, docs };
      }),
    );

    for (const { topic, docs } of responses) {
      if (!docs) continue;
      answered++;
      const ranked = docs
        .map((doc, index) => ({ doc, index, score: topicRank(doc, topic) }))
        .sort((a, b) => a.score - b.score || a.index - b.index);
      buckets.push(ranked.map(({ doc }) => ({ doc, topic })));
    }
  } finally {
    clearTimeout(timer);
  }

  if (answered === 0) {
    throw new Error("Free catalogs did not answer. Check your connection and try again.");
  }

  const hits: Suggestion[] = [];
  const seen = new Set<string>();
  const max = Math.max(...buckets.map((b) => b.length), 0);
  for (let i = 0; i < max; i++) {
    for (const bucket of buckets) {
      const row = bucket[i];
      if (!row) continue;
      const suggestion = mapDoc(row.doc, row.topic);
      if (!suggestion) continue;
      if (sameWork(opts.title, opts.author, suggestion.title, suggestion.author)) continue;
      const key = `${similarTitleKey(suggestion.title)}|${authorTokens(suggestion.author)[0] ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(suggestion);
      if (hits.length >= 12) return hits;
    }
  }
  return hits;
}

/** Prompt for the AI fallback when a genre search comes back empty. */
export function similarAiQuery(opts: {
  title: string;
  author: string;
  topics: string[];
}): string {
  const who = opts.author ? ` by ${opts.author}` : "";
  const vein = opts.topics.length ? ` It is ${opts.topics.join(" / ")}.` : "";
  return `Books similar to "${opts.title}"${who}.${vein} Same genre and tone. Do not include this same book.`;
}
