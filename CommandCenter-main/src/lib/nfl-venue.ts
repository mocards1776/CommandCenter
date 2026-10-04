/** ESPN league shield. Midfield mark for an overseas NFL game. */
export const NFL_SHIELD_LOGO = "https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png";

export type NflVenueFlags = {
  /** ESPN `neutralSite`. The Super Bowl is neutral and still domestic. */
  neutralSite?: boolean | null;
  venue?: string | null;
  venueCity?: string | null;
  venueCountry?: string | null;
  /** ESPN competition note, e.g. "NFL London Games". */
  venueNote?: string | null;
};

const DOMESTIC_COUNTRY = /^(usa|u\.s\.a\.|us|u\.s\.|united states|united states of america)$/i;

/**
 * Feed copy ESPN attaches to the international series.
 * "London Games", "Germany Game", "Brazil Game", "Mexico Game", and the
 * generic International Series / Global Games labels.
 */
const INTERNATIONAL_NOTE =
  /\b(london games?|germany games?|brazil games?|mexico games?|international series|nfl international|global games|overseas)\b/i;

/**
 * Fallback when the feed omits country and the series note.
 * Stadium and city names used for NFL games outside the United States.
 */
const OVERSEAS_VENUE =
  /\b(london|wembley|tottenham|munich|frankfurt|berlin|allianz arena|deutsche bank park|s[aã]o paulo|corinthians|rio de janeiro|mexico city|ciudad de m[eé]xico|estadio azteca|dublin|toronto|melbourne|sydney)\b/i;

/**
 * Overseas NFL game. Feed flags win, in order:
 * 1. competition note ("NFL London Games", "Germany Game", …)
 * 2. venue country other than the USA
 * `neutralSite` alone does not count — a domestic neutral site stays on the
 * home club. If both feed flags are missing, the venue or city name is the
 * documented fallback.
 */
export function nflGameIsInternational(game: NflVenueFlags): boolean {
  if (game.venueNote && INTERNATIONAL_NOTE.test(game.venueNote)) return true;
  const country = game.venueCountry?.trim() ?? "";
  if (country && !DOMESTIC_COUNTRY.test(country)) return true;
  const where = `${game.venue ?? ""} ${game.venueCity ?? ""}`;
  return OVERSEAS_VENUE.test(where);
}

/**
 * Shield when the game is overseas. Undefined at home, so the field keeps
 * the designated home club at midfield.
 */
export function nflInternationalMidfieldLogo(game: NflVenueFlags): string | undefined {
  return nflGameIsInternational(game) ? NFL_SHIELD_LOGO : undefined;
}
