/**
 * Names in the copy, matched against the people the board, the wire and the
 * reader's follows already know about, so each can open his player page.
 */

export type Person = { name: string; href: string };

export type Piece = string | { text: string; person: Person };

const LETTER = "\\p{L}";

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  let last = parts[parts.length - 1] ?? "";
  if (/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(last) && parts.length > 2) last = parts[parts.length - 2] ?? "";
  return last;
}

/** One entry per name; a later duplicate never overrides the first href. */
export function uniquePeople(people: Person[]): Person[] {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of people) {
    const name = p.name?.replace(/\s+/g, " ").trim();
    if (!name || !p.href || !/\s/.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, href: p.href });
  }
  return out;
}

export type NameIndex = {
  re: RegExp | null;
  full: Map<string, Person>;
  last: Map<string, Person>;
};

export function nameIndex(people: Person[]): NameIndex {
  const full = new Map<string, Person>();
  const lastCount = new Map<string, number>();
  const lastOf = new Map<string, Person>();
  for (const p of uniquePeople(people)) {
    full.set(p.name.toLowerCase(), p);
    const s = surname(p.name);
    if (s.length < 4) continue;
    const k = s.toLowerCase();
    lastCount.set(k, (lastCount.get(k) ?? 0) + 1);
    lastOf.set(k, p);
  }
  const last = new Map<string, Person>();
  for (const [k, n] of lastCount) if (n === 1) last.set(k, lastOf.get(k)!);
  const terms = [...full.keys(), ...last.keys()].sort((a, b) => b.length - a.length).map(escape);
  const re = terms.length
    ? new RegExp(`(?<![${LETTER}'’-])(${terms.join("|")})(?:['’]s)?(?![${LETTER}-])`, "giu")
    : null;
  return { re, full, last };
}

/**
 * Splits copy into plain runs and names. A bare surname links only once the
 * full name has run earlier in the same story (`seen` carries across paragraphs).
 */
export function namePieces(text: string, index: NameIndex, seen: Set<string> = new Set()): Piece[] {
  if (!index.re || !text) return [text];
  const out: Piece[] = [];
  let at = 0;
  index.re.lastIndex = 0;
  for (let m = index.re.exec(text); m; m = index.re.exec(text)) {
    const hit = m[1]!;
    const key = hit.toLowerCase();
    let person = index.full.get(key) ?? null;
    if (person) seen.add(person.href);
    else {
      const p = index.last.get(key);
      // Surnames are capitalized in copy; "Price" the noun stays plain.
      if (p && seen.has(p.href) && /^\p{Lu}/u.test(hit)) person = p;
    }
    if (!person) continue;
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push({ text: hit, person });
    at = m.index + hit.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
