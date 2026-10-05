/**
 * Which finals fire a Telegram photo.
 *
 * Default scope is favorites and RUWT. A game is RUWT-relevant when it was
 * hot on the live-drama line while it was in progress (ever_hot). The first
 * time a game is seen, nothing fires — that sample is the baseline, so a
 * deploy does not photo every final already on the board.
 *
 * Empty TELEGRAM_FINALS_SPORTS watches nfl, cfb, mlb, and nhl. The claim
 * gate is still favorites+ruwt, not every game on those boards.
 */

export type FinalsScope = {
  favorites: boolean;
  ruwt: boolean;
  all: boolean;
};

export type FavoriteToken = {
  sport: string;
  /** Team id or abbreviation, compared case-insensitively. */
  token: string;
};

export type SideId = {
  id: string;
  abbrev: string;
};

export type WatchSnap = {
  phase: "pregame" | "live" | "final";
  everHot: boolean;
};

const SPORTS = new Set(["nfl", "cfb", "mlb", "nhl"]);

/** Empty TELEGRAM_FINALS_SPORTS must still watch every league we can photo. */
export const DEFAULT_FINALS_SPORTS = ["nfl", "cfb", "mlb", "nhl"];

/** Josh's DM. Override with TELEGRAM_FINALS_CHAT_IDS. */
export const DEFAULT_FINALS_CHAT_ID = "857547432";

export function parseScope(raw: string | undefined | null): FinalsScope {
  const text = raw == null || raw.trim() === "" ? "favorites,ruwt" : raw.toLowerCase();
  const parts = text.split(/[,\s]+/).filter(Boolean);
  if (parts.includes("all")) return { favorites: false, ruwt: false, all: true };
  return {
    favorites: parts.includes("favorites"),
    ruwt: parts.includes("ruwt") || parts.includes("heat"),
    all: false,
  };
}

export function parseSports(raw: string | undefined | null): string[] {
  if (raw == null || raw.trim() === "") return [...DEFAULT_FINALS_SPORTS];
  const out: string[] = [];
  for (const part of raw.split(/[,\s]+/)) {
    const sport = part.trim().toLowerCase();
    if (!SPORTS.has(sport) || out.includes(sport)) continue;
    out.push(sport);
  }
  return out.length ? out : [...DEFAULT_FINALS_SPORTS];
}

export function parseFavoriteTokens(raw: string | undefined | null): FavoriteToken[] {
  if (!raw) return [];
  const out: FavoriteToken[] = [];
  for (const part of raw.split(/[,\s]+/)) {
    const match = /^([a-z0-9]+):([A-Za-z0-9.-]+)$/.exec(part.trim());
    if (!match) continue;
    const sport = match[1].toLowerCase();
    if (!SPORTS.has(sport)) continue;
    out.push({ sport, token: match[2].toLowerCase() });
  }
  return out;
}

export function parseChatIds(raw: string | undefined | null): string[] {
  if (raw == null || raw.trim() === "") return [DEFAULT_FINALS_CHAT_ID];
  const ids: string[] = [];
  for (const part of raw.split(/[,\s]+/)) {
    const id = part.trim();
    if (!/^-?\d{5,20}$/.test(id) || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

export function teamMatches(sport: string, side: SideId, favorites: FavoriteToken[]): boolean {
  const id = side.id.toLowerCase();
  const abbrev = side.abbrev.toLowerCase();
  return favorites.some((fav) => fav.sport === sport && (fav.token === id || fav.token === abbrev));
}

export function shouldSendFinal(opts: {
  scope: FinalsScope;
  favorites: FavoriteToken[];
  sport: string;
  away: SideId;
  home: SideId;
  prev: WatchSnap | null;
  nextPhase: WatchSnap["phase"];
  everHot: boolean;
  alreadySent: boolean;
}): boolean {
  if (opts.alreadySent) return false;
  if (!opts.prev) return false;
  if (opts.prev.phase === "final" || opts.nextPhase !== "final") return false;
  if (opts.scope.all) return true;
  const favorite =
    opts.scope.favorites &&
    (teamMatches(opts.sport, opts.away, opts.favorites) ||
      teamMatches(opts.sport, opts.home, opts.favorites));
  const ruwt = opts.scope.ruwt && opts.everHot;
  return favorite || ruwt;
}
