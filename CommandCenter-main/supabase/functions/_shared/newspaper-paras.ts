/**
 * Newspaper paragraph / sentence splits. Used by Thompson Times copy and
 * the national-news desk so "Sen." / "U.S." never become their own grafs.
 */

const MIN_PARA = 25;

/** Titles, wires, months, AP states — period is not a sentence end. */
const ABBREVS = new Set([
  "u.s",
  "u.k",
  "u.n",
  "d.c",
  "sen",
  "rep",
  "gov",
  "gen",
  "lt",
  "col",
  "dr",
  "mr",
  "mrs",
  "ms",
  "st",
  "jr",
  "sr",
  "inc",
  "co",
  "corp",
  "no",
  "vs",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sept",
  "sep",
  "oct",
  "nov",
  "dec",
  "ala",
  "ariz",
  "ark",
  "calif",
  "colo",
  "conn",
  "del",
  "fla",
  "ga",
  "ill",
  "ind",
  "kan",
  "ky",
  "la",
  "md",
  "mass",
  "mich",
  "minn",
  "miss",
  "mo",
  "mont",
  "neb",
  "nev",
  "okla",
  "ore",
  "pa",
  "tenn",
  "tex",
  "va",
  "wash",
  "wis",
  "wyo",
]);

/** The period at `i` is an abbreviation / initial, not a sentence end. */
export function isAbbreviationPeriod(text: string, i: number): boolean {
  if (text[i] !== ".") return false;
  let start = i;
  while (start > 0 && /[A-Za-z.]/.test(text[start - 1]!)) start--;
  const token = text.slice(start, i).replace(/^\.+|\.+$/g, "");
  if (!token) return false;
  if (ABBREVS.has(token.toLowerCase())) return true;
  if (/^[A-Z]$/.test(token)) return true;
  if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(token)) return true;
  return false;
}

/** Split on real sentence ends. Abbreviations and initials stay attached. */
export function splitNewspaperSentences(text: string): string[] {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const parts: string[] = [];
  let start = 0;
  const re = /[.!?]["'”’)\]]*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const end = match.index + match[0].length;
    const after = raw.slice(end);
    const space = after.match(/^\s+/)?.[0] ?? "";
    const next = after.slice(space.length);
    if (!next || !/^["“‘'(]*[A-Z0-9]/.test(next)) continue;
    if (isAbbreviationPeriod(raw, match.index)) continue;
    const sentence = raw.slice(start, end).trim();
    if (sentence) parts.push(sentence);
    start = end + space.length;
  }
  const tail = raw.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.length ? parts : [raw];
}

/** A stub shorter than `min` joins the next graf; a trailing stub joins the last. */
export function mergeShortNewspaperParas(paras: readonly string[], min = MIN_PARA): string[] {
  const out: string[] = [];
  for (const raw of paras) {
    const para = raw.replace(/\s+/g, " ").trim();
    if (!para) continue;
    if (out.length && out[out.length - 1]!.length < min) {
      out[out.length - 1] = `${out[out.length - 1]} ${para}`;
    } else {
      out.push(para);
    }
  }
  if (out.length >= 2 && out[out.length - 1]!.length < min) {
    const last = out.pop()!;
    out[out.length - 1] = `${out[out.length - 1]} ${last}`;
  }
  return out;
}

/**
 * Printable newspaper paragraphs from a Grok array or a single summary.
 * Always runs the short-graf merge so a leftover "U.S." never stands alone.
 */
export function newspaperParas(input: string | readonly string[], max = 60): string[] {
  const blocks =
    typeof input === "string"
      ? input.trim()
        ? input
            .split(/\n{2,}/)
            .map((p) => p.replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .flatMap((block) => splitNewspaperSentences(block))
        : []
      : input.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  return mergeShortNewspaperParas(blocks).slice(0, max);
}
