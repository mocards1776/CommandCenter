export function hexColor(raw: string | null | undefined, fallback = "888888"): string {
  const h = (raw ?? "").replace(/^#/, "").trim();
  if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  return `#${fallback}`;
}

/** Team color that still reads on the navy card. Dark navy/black marks get lifted. */
export function onDark(hex: string): string {
  const n = hex.replace("#", "");
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  if (![r, g, b].every((c) => Number.isFinite(c))) return "#f4f1e9";
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  if (y >= 140) return hex;
  const max = Math.max(r, g, b, 1);
  const scale = Math.max(1, 196 / max);
  const byte = (c: number) => Math.min(255, Math.round(c * scale)).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}
