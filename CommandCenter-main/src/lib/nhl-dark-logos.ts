/**
 * Dark-navy NHL marks. ESPN 500 is navy-on-navy (Lightning bolt, Capitals
 * Weagle / wordmark); 500-dark is a white silhouette, not the official art.
 * Vendored PNGs already include the white rim in the pixels — no CSS stroke.
 *
 * Extension: add an ESPN id / abbrev below and drop
 * `public/logos/nhl/nhl-<slug>.png` (same file in sports-finals/logos).
 */

export const NHL_DARK_RIM_PUBLIC = "/logos/nhl";

/** ESPN id + common abbrevs → vendored basename (without .png). */
export const NHL_DARK_RIM_TEAMS: Record<string, string> = {
  tb: "nhl-tb",
  tbl: "nhl-tb",
  "20": "nhl-tb",
  "nhl-tb": "nhl-tb",
  wsh: "nhl-wsh",
  was: "nhl-wsh",
  "23": "nhl-wsh",
  "nhl-wsh": "nhl-wsh",
};

export function nhlDarkRimId(token: string | null | undefined): string | null {
  if (!token) return null;
  return NHL_DARK_RIM_TEAMS[token.trim().toLowerCase()] ?? null;
}

/** Filename token from an ESPN NHL logo URL or our own public path. */
export function nhlDarkRimTokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const espn = /\/i\/teamlogos\/nhl\/(?:500|500-dark)(?:\/scoreboard)?\/([a-z0-9]+)\.(?:png|svg)/i.exec(url);
  if (espn?.[1]) return espn[1].toLowerCase();
  const local = /\/logos\/nhl\/(nhl-[a-z0-9]+)\.png/i.exec(url);
  return local?.[1]?.toLowerCase() ?? null;
}

export function nhlDarkRimHref(basename: string): string {
  return `${NHL_DARK_RIM_PUBLIC}/${basename}.png`;
}

/**
 * Vendored rim path for a dark-surface NHL mark, or null to keep the caller URL.
 * `sport` must be nhl when provided so MLB TB / WSH are not swapped.
 */
export function resolveNhlDarkRimHref(input: {
  url?: string | null;
  abbrev?: string | null;
  teamId?: string | number | null;
  sport?: string | null;
}): string | null {
  if (input.sport && !/^nhl$/i.test(input.sport)) return null;
  const id =
    nhlDarkRimId(input.abbrev) ??
    nhlDarkRimId(input.teamId != null ? String(input.teamId) : null) ??
    nhlDarkRimId(nhlDarkRimTokenFromUrl(input.url));
  return id ? nhlDarkRimHref(id) : null;
}

/** Prefer a rimmed asset; otherwise keep the ESPN/href fallback. */
export function nhlLogoOnDark(
  href?: string | null,
  abbrev?: string | null,
  teamId?: string | number | null,
): string | null {
  return (
    resolveNhlDarkRimHref({ url: href, abbrev, teamId }) ??
    href ??
    (abbrev ? `https://a.espncdn.com/i/teamlogos/nhl/500/${abbrev.toLowerCase()}.png` : null)
  );
}
