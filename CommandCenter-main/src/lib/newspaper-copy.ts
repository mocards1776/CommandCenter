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
