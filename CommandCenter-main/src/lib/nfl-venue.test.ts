/**
 * Run with: node --experimental-strip-types src/lib/nfl-venue.test.ts
 * from CommandCenter-main/.
 */
import {
  NFL_SHIELD_LOGO,
  nflGameIsInternational,
  nflInternationalMidfieldLogo,
} from "./nfl-venue.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(
  nflGameIsInternational({
    neutralSite: true,
    venue: "Tottenham Hotspur Stadium",
    venueCity: "London",
    venueCountry: "England",
    venueNote: "NFL London Games",
  }),
  "London series note is international",
);
assert(
  nflInternationalMidfieldLogo({
    venueCountry: "England",
    venueNote: "NFL London Games",
  }) === NFL_SHIELD_LOGO,
  "London midfield is the NFL shield",
);

assert(
  nflGameIsInternational({
    neutralSite: true,
    venue: "Allianz Arena",
    venueCity: "Munich",
    venueCountry: "Germany",
    venueNote: "NFL Germany Game",
  }),
  "Germany series is international",
);
assert(
  nflGameIsInternational({
    venue: "Arena Corinthians",
    venueCity: "Sao Paulo",
    venueCountry: "Brazil",
  }),
  "Brazil country flag is international",
);
assert(
  nflGameIsInternational({
    venue: "Estadio Azteca",
    venueCity: "Mexico City",
    venueCountry: "Mexico",
  }),
  "Mexico country flag is international",
);

assert(
  !nflGameIsInternational({
    neutralSite: false,
    venue: "Highmark Stadium",
    venueCity: "Orchard Park",
    venueCountry: "USA",
  }),
  "a domestic stadium stays on the home club",
);
assert(
  nflInternationalMidfieldLogo({
    venue: "Highmark Stadium",
    venueCountry: "USA",
  }) === undefined,
  "domestic midfield is left to the home logo",
);

// Super Bowl is neutral and still in the United States.
assert(
  !nflGameIsInternational({
    neutralSite: true,
    venue: "Caesars Superdome",
    venueCity: "New Orleans",
    venueCountry: "USA",
    venueNote: "Super Bowl",
  }),
  "a domestic neutral site is not an international game",
);

// Feed omitted country and the series note. The venue name is the fallback.
assert(
  nflGameIsInternational({
    venue: "Wembley Stadium",
    venueCity: "London",
  }),
  "London in the venue name is the documented fallback",
);
assert(
  !nflGameIsInternational({
    neutralSite: true,
    venue: "Allegiant Stadium",
    venueCity: "Las Vegas",
  }),
  "a neutral domestic venue without a country is not overseas",
);

console.log("nfl-venue.test.ts ok");
