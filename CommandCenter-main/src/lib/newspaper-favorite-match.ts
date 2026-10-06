/** League + identity matching for Times favorites. No sports.ts import. */

export type FavoriteIdentity = {
  key: string;
  name: string;
  shortName: string;
  espnPath: string;
  kind: "team" | "tour";
  mlbTeamId?: number;
};

export type FavoriteMatchCard = {
  favoriteKey?: string | null;
  teamName?: string | null;
  headline?: string | null;
  dek?: string | null;
  sportLabel?: string | null;
  leaguePath?: string | null;
  recapGame?: {
    away?: { id?: string | null; abbrev?: string | null; name?: string | null; short?: string | null };
    home?: { id?: string | null; abbrev?: string | null; name?: string | null; short?: string | null };
  } | null;
};

const WEAK_TOKENS = new Set([
  "the", "and", "st.", "st", "fc", "afc", "club", "city", "united", "state",
  "states", "football", "basketball", "baseball", "hockey", "soccer", "tour",
  "louis", "kansas", "detroit", "missouri",
]);

export function strongNames(fav: FavoriteIdentity): string[] {
  const names = [fav.shortName, fav.name]
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  if (fav.key === "mlb-stl") names.push("cardinals", "st. louis cardinals", "stl");
  if (fav.key === "nfl-kc") names.push("chiefs", "kansas city chiefs", "kc");
  if (fav.key === "nfl-det") names.push("lions", "detroit lions");
  if (fav.key === "cfb-mizzou" || fav.key === "cbb-mizzou") {
    names.push("mizzou", "missouri tigers");
  }
  if (fav.key === "cfb-missouri-state" || fav.key === "cbb-missouri-state") {
    names.push("missouri state");
  }
  if (fav.key === "eng-wolves") names.push("wolves", "wolverhampton", "wolverhampton wanderers");
  if (fav.key === "eng-wrexham") names.push("wrexham");
  if (fav.key === "eng-arsenal") names.push("arsenal");
  if (fav.key === "nhl-stl") names.push("blues", "st. louis blues");
  if (fav.key === "nfl-dal") names.push("cowboys", "dallas cowboys");
  if (fav.key === "nba-phi") names.push("76ers", "sixers", "philadelphia 76ers");
  return [...new Set(names)].filter((n) => n.length >= 3 && !WEAK_TOKENS.has(n));
}

export function clubMentionNames(fav: FavoriteIdentity): string[] {
  return strongNames(fav).filter((name) => name.length >= 4);
}

const AMBIGUOUS_NICK = /^(cardinals|lions|bears|blues|wolves|arsenal)$/i;

const FAVORITE_CONFLICTS: Record<string, RegExp> = {
  "mlb-stl": /\barizona\b|\bari\b|\bnfl\b|\bgiants['’]?\s+36-24\b/i,
  "nhl-stl": /\bchelsea\b|\bst\.?\s*louis city\b/i,
  "nfl-det": /\bnittany\b|\bpenn\s*state\b|\bcolumbia lions\b/i,
  "eng-wolves": /\btimberwolves?\b|\bminnesota\b|\bnba\b/i,
  "eng-arsenal": /\barsenal\s+(?:shirt|jacket|fc\s+women)\b/i,
  "cfb-missouri-state": /\bchicago\b|\bcal(?:ifornia)?\b|\bbaylor\b|\bpackers\b/i,
  "cbb-missouri-state": /\bchicago\b|\bcal(?:ifornia)?\b|\bbaylor\b/i,
};

const KNOWN_ESPN_TEAM_ID: Record<string, string> = {
  "mlb-stl": "24",
  "nhl-stl": "19",
  "cfb-mizzou": "142",
  "cbb-mizzou": "142",
  "cfb-missouri-state": "2623",
  "cbb-missouri-state": "2623",
  "nfl-det": "8",
  "nfl-kc": "12",
  "nfl-dal": "6",
  "nba-phi": "20",
  "eng-wrexham": "352",
  "eng-wolves": "380",
  "eng-arsenal": "359",
};

function favoriteEspnTeamId(fav: FavoriteIdentity): string | null {
  const id = fav.espnPath.split("/").pop();
  if (id && /^\d+$/.test(id) && id !== "0") return id;
  return KNOWN_ESPN_TEAM_ID[fav.key] ?? null;
}

function favoriteAbbrevs(fav: FavoriteIdentity): string[] {
  if (fav.key === "mlb-stl" || fav.key === "nhl-stl") return ["stl"];
  if (fav.key === "nfl-kc") return ["kc"];
  if (fav.key === "nfl-det") return ["det"];
  if (fav.key === "nfl-dal") return ["dal"];
  if (fav.key === "nba-phi") return ["phi"];
  if (fav.key === "eng-wolves") return ["wol"];
  if (fav.key === "eng-wrexham") return ["wrx"];
  if (fav.key === "eng-arsenal") return ["ars"];
  if (fav.key === "cfb-mizzou" || fav.key === "cbb-mizzou") return ["miz"];
  if (fav.key === "cfb-missouri-state" || fav.key === "cbb-missouri-state") return ["most"];
  return [];
}

export function cardLeaguePathOf(card: Pick<FavoriteMatchCard, "leaguePath" | "sportLabel">): string | null {
  if (card.leaguePath) return card.leaguePath.toLowerCase();
  const s = (card.sportLabel ?? "").trim().toLowerCase();
  if (s === "nfl" || s === "football") return "football/nfl";
  if (s === "mlb" || s === "baseball") return "baseball/mlb";
  if (s === "nhl" || s === "hockey") return "hockey/nhl";
  if (s === "nba" || s === "basketball") return "basketball/nba";
  if (s === "cfb" || s === "college football") return "football/college-football";
  if (s === "cbb" || s === "college basketball" || s === "ncaam") return "basketball/mens-college-basketball";
  if (s === "epl" || s === "premier league") return "soccer/eng.1";
  if (s === "efl" || s === "championship") return "soccer/eng.2";
  return null;
}

export function favoriteKeyFitsPath(
  key: string | null | undefined,
  leaguePath: string | null | undefined,
  sportLabel?: string | null,
): boolean {
  if (!key) return false;
  const path = (leaguePath || cardLeaguePathOf({ leaguePath: null, sportLabel }) || "").toLowerCase();
  if (!path) return true;
  const prefix = key.split("-")[0];
  switch (prefix) {
    case "mlb":
      return path === "baseball/mlb";
    case "nfl":
      return path === "football/nfl";
    case "nhl":
      return path === "hockey/nhl";
    case "nba":
      return path === "basketball/nba";
    case "cfb":
      return path === "football/college-football";
    case "cbb":
      return path === "basketball/mens-college-basketball";
    case "eng":
      return path.startsWith("soccer/");
    default:
      return true;
  }
}

function collectCardTeamIds(card: FavoriteMatchCard): string[] {
  const ids: string[] = [];
  for (const side of [card.recapGame?.away, card.recapGame?.home]) {
    if (side?.id) ids.push(String(side.id));
  }
  return ids;
}

function collectCardAbbrevs(card: FavoriteMatchCard): string[] {
  const out: string[] = [];
  for (const side of [card.recapGame?.away, card.recapGame?.home]) {
    if (side?.abbrev) out.push(side.abbrev.toLowerCase());
  }
  return out;
}

export function hayHasName(hay: string, name: string): boolean {
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
  return re.test(hay);
}

export function storyMatchesFavorite(card: FavoriteMatchCard, fav: FavoriteIdentity): boolean {
  if (fav.kind !== "team") return false;
  const path = cardLeaguePathOf(card);
  if (path && !favoriteKeyFitsPath(fav.key, path, card.sportLabel)) return false;

  const favId = favoriteEspnTeamId(fav);
  const ids = collectCardTeamIds(card);
  if (favId && ids.includes(favId)) return true;
  if (fav.mlbTeamId && ids.includes(String(fav.mlbTeamId))) return true;

  const abbrevs = favoriteAbbrevs(fav);
  const cardAbbrevs = collectCardAbbrevs(card);
  if (abbrevs.some((a) => cardAbbrevs.includes(a))) return true;

  const hay = `${card.headline ?? ""} ${card.dek ?? ""} ${card.teamName ?? ""}`.toLowerCase();
  const conflict = FAVORITE_CONFLICTS[fav.key];
  if (conflict?.test(hay)) return false;

  const official = (fav.name || "").trim().toLowerCase();
  if (official.length >= 6 && hayHasName(hay, official)) return true;
  if (
    (fav.key === "cfb-mizzou" || fav.key === "cbb-mizzou") &&
    /\bmissouri\b(?!\s+state)/i.test(hay)
  ) {
    return true;
  }

  if (abbrevs.some((a) => hayHasName(hay, a))) {
    if (!path || favoriteKeyFitsPath(fav.key, path, card.sportLabel)) return true;
  }

  const names = strongNames(fav);
  const nickHit = names.some((n) => hayHasName(hay, n));
  if (!nickHit) return false;
  if (path && favoriteKeyFitsPath(fav.key, path, card.sportLabel)) {
    const nick = (fav.shortName || "").trim().toLowerCase();
    if (AMBIGUOUS_NICK.test(nick) && hayHasName(hay, nick) && !hayHasName(hay, official) && !abbrevs.some((a) => hayHasName(hay, a))) {
      if (fav.key === "mlb-stl" || fav.key === "nhl-stl") return hayHasName(hay, "st. louis") || hayHasName(hay, "stl");
      if (fav.key === "nfl-det") return hayHasName(hay, "detroit") || hayHasName(hay, "det");
      if (fav.key === "eng-wolves") return hayHasName(hay, "wolverhampton") || hayHasName(hay, "wol");
    }
    return true;
  }
  const long = names.filter((n) => n.length >= 8 && !AMBIGUOUS_NICK.test(n));
  return hayHasName(hay, official) || long.some((n) => hayHasName(hay, n));
}
