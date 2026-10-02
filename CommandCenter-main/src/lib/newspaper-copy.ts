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

/** Article text, or nothing when the wire filed a menu. */
export function readableCopy(text: string | null | undefined): string {
  const raw = (text ?? "").trim();
  return raw && !isNavSoup(raw) ? raw : "";
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
    const sentences = block.split(/(?<=[.!?]["'”’)]?)\s+(?=["“‘'(]?[A-Z0-9])/);
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
  return out.slice(0, max);
}
