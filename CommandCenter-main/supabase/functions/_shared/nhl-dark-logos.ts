/**
 * Dark-navy NHL marks shared by evening preview, finals cards, and heat-alert.
 * ESPN 500 is navy-on-navy; 500-dark is a white silhouette. Vendored PNGs
 * already include the white rim — the card does not apply a stroke filter.
 *
 * Extension: add an ESPN id / abbrev to NHL_DARK_RIM_TEAMS and drop
 * `nhl-<slug>.png` in `_shared/logos/` and `sports-finals/logos/`.
 */

export const NHL_DARK_RIM_TEAMS: Record<string, string> = {
  tb: "nhl-tb.png",
  tbl: "nhl-tb.png",
  "20": "nhl-tb.png",
  "nhl-tb": "nhl-tb.png",
  wsh: "nhl-wsh.png",
  was: "nhl-wsh.png",
  "23": "nhl-wsh.png",
  "nhl-wsh": "nhl-wsh.png",
};

export function nhlDarkRimFile(input: {
  sport?: string | null;
  abbrev?: string | null;
  teamId?: string | number | null;
  url?: string | null;
}): string | null {
  if (input.sport && !/^nhl$/i.test(input.sport)) return null;
  const tokens = [
    input.abbrev,
    input.teamId != null ? String(input.teamId) : null,
    tokenFromUrl(input.url),
  ];
  for (const token of tokens) {
    if (!token) continue;
    const file = NHL_DARK_RIM_TEAMS[token.trim().toLowerCase()];
    if (file) return file;
  }
  return null;
}

function tokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const espn = /\/i\/teamlogos\/nhl\/(?:500|500-dark)(?:\/scoreboard)?\/([a-z0-9]+)\.(?:png|svg)/i.exec(url);
  return espn?.[1]?.toLowerCase() ?? null;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x4000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
  }
  return btoa(bin);
}

function fileCandidates(file: string): URL[] {
  return [
    new URL(`./logos/${file}`, import.meta.url),
    new URL(`../sports-finals/logos/${file}`, import.meta.url),
  ];
}

export async function nhlDarkRimDataUri(file: string): Promise<string | null> {
  for (const href of fileCandidates(file)) {
    try {
      const { readFile } = await import("node:fs/promises");
      const bytes = new Uint8Array(await readFile(href));
      if (bytes.length < 32) continue;
      return `data:image/png;base64,${bytesToBase64(bytes)}`;
    } catch {
      try {
        const bytes = await Deno.readFile(href);
        return `data:image/png;base64,${bytesToBase64(bytes)}`;
      } catch {
        /* try next candidate */
      }
    }
  }
  return null;
}

export type DarkRimSide = { teamId?: string | number; abbrev?: string; logo?: string | null };

export function isNhlDarkRimSide(sport: string, side: DarkRimSide): boolean {
  return Boolean(
    nhlDarkRimFile({
      sport,
      abbrev: side.abbrev,
      teamId: side.teamId,
      url: side.logo,
    }),
  );
}

export async function applyNhlDarkRimLogos<
  T extends { sport: string; away: { logoData?: string | null } & DarkRimSide; home: { logoData?: string | null } & DarkRimSide },
>(games: T[]): Promise<void> {
  const needed = new Set<string>();
  for (const game of games) {
    for (const side of [game.away, game.home]) {
      const file = nhlDarkRimFile({
        sport: game.sport,
        abbrev: side.abbrev,
        teamId: side.teamId,
        url: side.logo,
      });
      if (file) needed.add(file);
    }
  }
  if (needed.size === 0) return;
  const dataByFile = new Map<string, string>();
  await Promise.all(
    [...needed].map(async (file) => {
      const data = await nhlDarkRimDataUri(file);
      if (data) dataByFile.set(file, data);
    }),
  );
  for (const game of games) {
    for (const side of [game.away, game.home]) {
      const file = nhlDarkRimFile({
        sport: game.sport,
        abbrev: side.abbrev,
        teamId: side.teamId,
        url: side.logo,
      });
      const data = file ? dataByFile.get(file) : null;
      if (data) side.logoData = data;
    }
  }
}
