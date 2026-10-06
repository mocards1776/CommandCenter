import { mergeShortNewspaperParas, splitNewspaperSentences } from "../../../supabase/functions/_shared/newspaper-paras.ts";

const NAV_MARKERS = ["my quiz activity", "my favorites", "add sports/teams", "home quizzes"];

/**
 * A site menu or team index saved as the article. Yardbarker files
 * "Home Quizzes My Quiz Activity…" in place of the story.
 */
export function isNavSoup(text: string | null | undefined): boolean {
  const raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (raw.length < 80) return false;
  const lower = raw.toLowerCase();
  if (NAV_MARKERS.some((marker) => lower.includes(marker))) return true;
  const words = raw.split(" ").length;
  const endings = (raw.match(/[.!?](?=\s|$)/g) ?? []).length;
  const commas = (raw.match(/,/g) ?? []).length;
  return words >= 50 && endings === 0 && commas < 2;
}

const KILLED_HOSTS = ["yardbarker.com", "viralsportsnews.com", "yb.com"];

/** Hosts whose pages come back as a menu. They do not run. */
export function killedSource(url: string | null | undefined): boolean {
  if (!url) return false;
  const raw = url.trim().toLowerCase();
  let host = raw;
  try {
    host = new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    /* a bare host or a feed id */
  }
  return KILLED_HOSTS.some((killed) => host === killed || host.endsWith(`.${killed}`) || raw.includes(killed));
}

const JUNK_CUT =
  /\b(?:more must-reads|related stories|receive daily headlines|kicker:\s*headline|sign up today|recaptcha|all rights reserved|you may also like|recommended for you)\b/i;

/** Decode HTML entities once. `&amp;amp;` stays `&amp;` after one pass. */
export function decodeNewspaperEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0*39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&[lr]squo;/gi, "’")
    .replace(/&[lr]dquo;/gi, "”")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—");
}

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

function collapseInline(text: string): string {
  return text.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Join `532. 8` / `21. 5%` when the dot belongs to a number. Leave
 * `ended. 5 players` alone. `above. 500` becomes a batting average.
 */
export function joinBrokenDecimals(text: string): string {
  let out = text.replace(/(\d)\.\s+(\d)/g, "$1.$2");
  out = out.replace(/\b(above|below|under|over|from|to|than)\.\s+(\d{3})\b/gi, "$1 .$2");
  return out;
}

/**
 * ESPN often files the tagged club as `images[0].name` ("Dallas Cowboys").
 * That is not a caption of the picture.
 */
export function isTeamNameCaption(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (/[.!?,:;]/.test(t)) return false;
  const words = t.split(" ");
  if (words.length > 4) return false;
  return /^(the\s+)?[A-Za-z.]+(?:\s+[A-Za-z.]+){0,3}$/.test(t);
}

/** Source caption only. A tagged team name is not the picture's subject. */
export function newsImageCaption(
  images: { caption?: string; name?: string; alt?: string }[] | undefined,
): string | null {
  const raw = (images?.[0]?.caption ?? "").trim();
  if (!raw) return null;
  const cap = tidy(raw);
  if (!cap || isTeamNameCaption(cap)) return null;
  return cap;
}

/** Getty stock slugs that ride along on otherwise usable art. */
export function stripGettyCredit(text: string): string {
  return text
    .replace(/\s*\((?:Getty(?:\s+Images)?|getty images)\)/gi, "")
    .replace(/^\s*(?:Getty(?:\s+Images)?)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const BOILERPLATE_LINE =
  /^(?:-{3,}|_{3,}|\*{3,}|sign up for\b|subscribe:|jump to:|posted in\b|share this:|to read this\b|click here\b|download the app\b|follow us on\b|read more\b|advertisement\b|related stories\b|you may also like\b|watch:|terms of use\b|privacy policy\b|privacy notice\b|cookie (?:policy|settings)\b)/i;

const BOILERPLATE_GETTY = /^\(?getty(?:\s+images)?\)?\.?$/i;

const GAMBLING_LINE =
  /\b(?:1-800-gambler|1-800-522-4700|1-800-next-step|1-800-9-with-it|1-800-betsoff|gambling problem|gambling helpline|responsible gaming|draftkings|fanduel|betmgm|caesars sportsbook|if you or someone you know has a gambling|must be 21(?:\+| years)|gamblinghelp|visitgambling|ncpgambling|rg-help)\b/i;

const LEGAL_LINE =
  /\b(?:terms of use|privacy policy|privacy notice|cookie policy|all rights reserved|©\s*\d{4}|copyright\s*©|void where prohibited)\b/i;

const RELATED_LINE =
  /^(?:watch:|read more\b|related(?: stories| links)?:|more from\b|also on espn\b|click for (?:full )?story\b)/i;

const VIDEO_STAMP = /\b\d{1,2}:\d{2}\b/;

/** Conservative web-chrome lines that should never print. */
export function isBoilerplateLine(line: string): boolean {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (BOILERPLATE_GETTY.test(t)) return true;
  if (BOILERPLATE_LINE.test(t)) return true;
  if (GAMBLING_LINE.test(t)) return true;
  if (LEGAL_LINE.test(t) && t.length < 280) return true;
  if (RELATED_LINE.test(t)) return true;
  if (/^sign up for\b/i.test(t) && /\balerts?\b/i.test(t)) return true;
  if (isCaptionOnlyLine(t)) return true;
  if (isVideoTitleLine(t)) return true;
  return false;
}

/** A photo credit or team-name stand-in, not a graf. */
export function isCaptionOnlyLine(line: string): boolean {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (isTeamNameCaption(t)) return true;
  if (/^(?:photo|image|courtesy|ap photo|getty)\b/i.test(t) && t.length < 80) return true;
  if (/:\s*(?:game |full )?highlights\s*$/i.test(t) && t.length < 140) return true;
  return false;
}

/** One ESPN video-rail title, often with a duration stamp. */
export function isVideoTitleLine(line: string): boolean {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (/^watch:/i.test(t)) return true;
  if (VIDEO_STAMP.test(t) && t.length < 160 && !/[.!]/.test(t.replace(VIDEO_STAMP, ""))) return true;
  if (/^(?:did|is|are|can|will|why|how|what)\b.+\?$/i.test(t) && t.length < 140) return true;
  return false;
}

/**
 * Repeated video titles, duration stamps, and "Watch:" rails jammed into
 * one blob — the usual ESPN story-page scrape.
 */
export function isVideoTitleSoup(text: string): boolean {
  const raw = text.replace(/\s+/g, " ").trim();
  if (raw.length < 40) return false;
  if (/\bwatch:\b/i.test(raw) && VIDEO_STAMP.test(raw)) return true;
  if (/(.{18,90})\s+\1/i.test(raw) && VIDEO_STAMP.test(raw)) return true;
  if (/(.{18,90})\s+\1/i.test(raw) && /\b(?:film room|must-see|highlights?)\b/i.test(raw)) return true;
  const questions = (raw.match(/\?/g) ?? []).length;
  const sentences = (raw.match(/[.!](?=\s|$)/g) ?? []).length;
  if (questions >= 2 && sentences < 2 && VIDEO_STAMP.test(raw)) return true;
  const stamps = raw.match(/\b\d{1,2}:\d{2}\b/g)?.length ?? 0;
  return stamps >= 2 && raw.length < 900;
}

export function isGamblingDisclaimer(text: string): boolean {
  return GAMBLING_LINE.test(text);
}

/** Enough real prose to set as a story, not a caption or a chrome dump. */
export const PRINTABLE_STORY_MIN = 160;

export function isPrintableStoryBody(text: string | null | undefined): boolean {
  const cleaned = sanitizeArticleBody(text);
  if (cleaned.length < PRINTABLE_STORY_MIN) return false;
  if (isNavSoup(cleaned) || isVideoTitleSoup(cleaned)) return false;
  const sentences = cleaned.match(/[.!?]["')\]]?(?:\s|$)/g)?.length ?? 0;
  return sentences >= 2;
}

export function stripBoilerplateCopy(text: string): string {
  return text
    .split(/\n{2,}|\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => !isBoilerplateLine(line))
    .join("\n\n")
    .trim();
}

const INLINE_JUNK_CUT =
  /\b(?:terms of use|privacy policy|privacy notice|cookie policy|all rights reserved|©\s*\d{4}|1-800-gambler|gambling problem|responsible gaming|must be 21(?:\+| years)|visitgambling|ncpgambling|watch:\s*)/i;

/**
 * Extracted article text a desk can set: chrome, video rails, legal, and
 * gambling disclaimers dropped. Empty when what remains is not a story.
 */
export function sanitizeArticleBody(text: string | null | undefined): string {
  let raw = text ?? "";
  if (!raw.trim()) return "";
  if (looksLikeHtml(raw)) raw = htmlToNewspaperText(raw);
  else raw = decodeNewspaperEntities(raw);
  raw = stripBoilerplateCopy(raw);
  raw = raw
    .replace(/\bWatch:\s*[^.!?\n]{0,160}/gi, " ")
    .replace(/\bRead more\b[:\s][^.!?\n]{0,160}/gi, " ")
    .replace(/\b(?:Terms of Use|Privacy Policy|Cookie Policy)\b/gi, " ");
  const paras = raw
    .split(/\n{2,}/)
    .map((p) => tidy(p.replace(/\s+/g, " ")))
    .filter((p) => p && !isBoilerplateLine(p) && !isGamblingDisclaimer(p));
  let out = paras.join("\n\n").trim();
  const cut = out.search(INLINE_JUNK_CUT);
  if (cut >= 40) out = out.slice(0, cut).trim();
  else if (cut >= 0 && cut < 40) out = "";
  out = collapseInline(out);
  if (!out || isNavSoup(out) || isVideoTitleSoup(out)) return "";
  return out;
}

export function isSubheadBlock(html: string): boolean {
  const t = html.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/^<(h[1-6])\b/i.test(t)) return true;
  if (/^<p\b[^>]*>\s*<(?:strong|b)\b/i.test(t) && /<\/(?:strong|b)>\s*<\/p>$/i.test(t)) {
    const inner = t.replace(/^<p\b[^>]*>/i, "").replace(/<\/p>$/i, "");
    return !/<(?:p|div|h[1-6]|ul|ol|li)\b/i.test(inner.replace(/<\/?(?:strong|b|em|i|span|a)\b[^>]*>/gi, ""));
  }
  return false;
}

/**
 * Article HTML → newspaper text. h2/h3 and strong-only paragraphs stay on
 * their own line so a subhead is not glued onto the next graf.
 */
export function htmlToNewspaperText(html: string): string {
  if (!html.trim()) return "";
  let raw = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n");
  const blocks: string[] = [];
  const re = /<(p|h[1-6]|li|blockquote|div)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let match: RegExpExecArray | null;
  let last = 0;
  while ((match = re.exec(raw))) {
    const before = raw.slice(last, match.index);
    if (before.replace(/<[^>]+>/g, " ").trim()) {
      blocks.push(before);
    }
    blocks.push(match[0]!);
    last = match.index + match[0]!.length;
  }
  if (last < raw.length) blocks.push(raw.slice(last));
  const paras = (blocks.length ? blocks : [raw])
    .map((block) => {
      const text = decodeNewspaperEntities(block.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      return text;
    })
    .filter(Boolean);
  return paras.join("\n\n").trim();
}

/** Wire copy arrives with link residue: "Raiders ." and "Chiefs ,". */
export function tidy(text: string): string {
  return joinBrokenDecimals(
    decodeNewspaperEntities(stripGettyCredit(text))
      .replace(/\s+([,;:!?])/g, "$1")
      .replace(/\s+\.(?!\d)/g, ".")
      .replace(/(\w)\s+([’'])/g, "$1$2")
      .replace(/([‘'])\s+(\w)/g, "$1$2")
      .replace(/(["“])\s+/g, "$1")
      .replace(/\s+(["”])/g, "$1")
      .replace(/([,;:.!?])(["“])(?=\S)/g, "$1 $2")
      .replace(/\s*(?:--|—|–)[\s—–-]+/g, " — ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")"),
  )
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Cut a blurb at the last full sentence. Abbreviations (No., St., Mr.)
 * are not sentence ends. Incomplete tails are dropped.
 */
export function truncateAtSentence(text: string, max = 260): string {
  const raw = tidy(text).replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= max) {
    if (/[.!?…]["'”’)]*$/.test(raw)) return raw;
    const parts = splitNewspaperSentences(raw);
    if (parts.length >= 2) {
      const complete = parts.slice(0, -1).join(" ");
      if (complete.length >= Math.min(40, max / 3)) return complete;
    }
    return raw;
  }
  const parts = splitNewspaperSentences(raw);
  let out = "";
  for (const s of parts) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max) break;
    out = next;
  }
  if (out && /[.!?…]["'”’)]*$/.test(out)) return out;
  // Never cut mid-sentence. If the first sentence is longer than max, keep it whole.
  const first = parts[0] ?? "";
  if (first && /[.!?…]["'”’)]*$/.test(first)) return first;
  return out;
}

/** Drop the last sentence. Empty when only one remains — leftover is a line of space. */
export function dropLastSentence(text: string): string {
  const parts = splitNewspaperSentences(tidy(text).replace(/\s+/g, " ").trim());
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join(" ");
}

/** A module spliced into the story: Athletic's reporter poll, ESPN's link rail. */
function stripModules(text: string): string {
  return collapseInline(
    text
      .replace(
        /\bWE ASKED OUR REPORTERS\b.{0,1400}?(?=\s(?:Now|The|But|If|Asked|He|She|They|In|When|After|Before|It|That|This|So)\b)/i,
        " ",
      )
      .replace(/\bKey links:\s*.+$/i, " "),
  );
}

const BYLINE =
  /^(?:By\s+)?([A-Z][A-Za-z.'’-]{1,24}(?:\s+[A-Z][A-Za-z.'’-]{1,24}){0,3})\s*\|\s*(?:St\.?\s*Louis\s+)?(?:Post-Dispatch|Post Dispatch|The Athletic|ESPN|Associated Press|Semissourian)\b\s*/;

/** "Matthew DeFranks | Post-Dispatch" belongs on the credit line, not in the lede. */
export function liftByline(text: string): { author: string | null; text: string } {
  const match = BYLINE.exec(text);
  if (!match?.[1]) return { author: null, text };
  return { author: match[1], text: text.slice(match[0].length).trim() };
}

/** A team-index dumped in front of the first sentence. */
function stripLeadingMenu(text: string): string {
  const end = text.search(/[.!?](?=\s|$)/);
  if (end < 120) return text;
  const lead = text.slice(0, end);
  const words = lead.split(" ").filter(Boolean);
  const commas = (lead.match(/,/g) ?? []).length;
  if (words.length >= 30 && commas < 2) return text.slice(end + 1).trim();
  return text;
}

function prepareCopy(text: string | null | undefined): string {
  return sanitizeArticleBody(text);
}

/**
 * Copy a desk can set: junk tails cut, a leading menu dropped, the author
 * lifted out, and a menu or an empty shell rejected.
 */
export function cleanStoryCopy(text: string | null | undefined): { author: string | null; text: string } {
  let raw = prepareCopy(text);
  if (!raw) return { author: null, text: "" };
  const keepBreaks = raw.includes("\n\n");
  const line = raw.replace(/\s+/g, " ").trim();
  const cut = line.search(JUNK_CUT);
  let working = cut >= 0 ? line.slice(0, cut).trim() : line;
  working = stripModules(working);
  working = stripLeadingMenu(working);
  const lifted = liftByline(working);
  working = lifted.text;
  if (!working || isNavSoup(working)) return { author: lifted.author, text: "" };
  if (keepBreaks && cut < 0) {
    const paras = raw
      .split(/\n{2,}/)
      .map((p) => tidy(p))
      .filter((p) => p && !isBoilerplateLine(p) && !JUNK_CUT.test(p));
    working = paras.join("\n\n") || working;
    const again = liftByline(working.replace(/\s+/g, " ").trim());
    if (again.author) {
      working = working.replace(BYLINE, "").trim();
      return { author: again.author, text: collapseInline(working) };
    }
  }
  return { author: lifted.author, text: collapseInline(working) };
}

const PERIPHERAL =
  /\b(?:youth|on-field experience|treated to|sign up today|photo gallery|submitted by|fan experience)\b/i;

/**
 * A fan feature that never names the club in the headline. The dek mentioning
 * a player is not enough to lead a club page.
 */
export function isPeripheralClubStory(card: {
  headline: string;
  dek?: string | null;
  teamName?: string | null;
}): boolean {
  if (!PERIPHERAL.test(`${card.headline} ${card.dek ?? ""}`)) return false;
  const head = card.headline.toLowerCase();
  const tokens = (card.teamName ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
  return !tokens.some((word) => head.includes(word));
}

/** Article text, or nothing when the wire filed a menu. */
export function readableCopy(text: string | null | undefined): string {
  return cleanStoryCopy(text).text;
}

/**
 * Real paragraphs where the wire has them; otherwise group sentences into
 * paragraphs of a few hundred characters so an indent never lands mid-sentence.
 * Never splits after abbreviations / initials; stubs under ~25 characters merge.
 */
export function proseParas(text: string, max = 60): string[] {
  const raw = text.trim();
  if (!raw) return [];
  const blocks = raw
    .split(/\n{2,}/)
    .map((p) => tidy(p.replace(/[^\S\n]+/g, " ")))
    .filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    if (block.length <= 520) {
      out.push(block);
      continue;
    }
    const sentences = splitNewspaperSentences(block);
    let buf = "";
    for (const s of sentences) {
      if (buf && buf.length + s.length > 440) {
        out.push(buf);
        buf = "";
      }
      buf = buf ? `${buf} ${s}` : s;
    }
    if (buf) out.push(buf);
  }
  return mergeShortNewspaperParas(out).slice(0, max);
}
