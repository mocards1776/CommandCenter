/**
 * Batter's-box helpers for the live pitch zone (catcher's view).
 * Pure functions, no React. Handedness codes come from StatsAPI
 * `matchup.batSide.code` / `matchup.pitchHand.code`, which give the side the
 * batter is actually hitting from in this plate appearance (switch hitters
 * included). A season-level "S" is unknown here and is ignored.
 */

export type Hand = "L" | "R";

/** "R" / "L" / "RHP" / "Left" → "R" | "L"; switch ("S"), blanks and junk → null. */
export function normalizeHand(code: string | null | undefined): Hand | null {
  const c = String(code ?? "").trim().toUpperCase();
  if (c === "R" || c === "RHP" || c === "RIGHT") return "R";
  if (c === "L" || c === "LHP" || c === "LEFT") return "L";
  return null;
}

/**
 * Which plot margin holds the batter in a catcher's-view zone:
 * a right-handed batter stands on the third-base side → left; a lefty → right.
 */
export function batterBoxSide(batSide: string | null | undefined): "left" | "right" | null {
  const h = normalizeHand(batSide);
  if (h === "R") return "left";
  if (h === "L") return "right";
  return null;
}

/** Same-side (RHP vs RHB) vs opposite-side matchup; null when either hand is unknown. */
export function matchupSide(
  batSide: string | null | undefined,
  pitchHand: string | null | undefined,
): "same side" | "opposite side" | null {
  const b = normalizeHand(batSide);
  const p = normalizeHand(pitchHand);
  if (!b || !p) return null;
  return b === p ? "same side" : "opposite side";
}

/** "Teoscar Hernández" → "T. Hernández"; single names pass through. */
export function shortPlayerName(name: string | null | undefined): string | null {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]![0]}. ${parts.slice(1).join(" ")}`;
}
