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

/** A module spliced into the story: Athletic's reporter poll, ESPN's link rail. */
function stripModules(text: string): string {
  return text
    .replace(
      /\bWE ASKED OUR REPORTERS\b.{0,1400}?(?=\s(?:Now|The|But|If|Asked|He|She|They|In|When|After|Before|It|That|This|So)\b)/i,
      " ",
    )
    .replace(/\bKey links:\s*.+$/i, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
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

/**
 * Copy a desk can set: junk tails cut, a leading menu dropped, the author
 * lifted out, and a menu or an empty shell rejected.
 */
export function cleanStoryCopy(text: string | null | undefined): { author: string | null; text: string } {
  let raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return { author: null, text: "" };
  const cut = raw.search(JUNK_CUT);
  if (cut >= 0) raw = raw.slice(0, cut).trim();
  raw = stripModules(raw);
  raw = stripLeadingMenu(raw);
  const lifted = liftByline(raw);
  raw = lifted.text;
  if (!raw || isNavSoup(raw)) return { author: lifted.author, text: "" };
  return { author: lifted.author, text: raw };
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

/** Wire copy arrives with link residue: "Raiders ." and "Chiefs ,". */
export function tidy(text: string): string {
  return text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s{2,}/g, " ")
    .trim();
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
    .map((p) => tidy(p.replace(/\s+/g, " ")))
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
