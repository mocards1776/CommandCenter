/** TV / stream networks shown on RUWT cards. */

export type GameBroadcast = {
  name: string;
  logo: string | null;
  /** national | home | away | local | null */
  market: string | null;
};

const MLB_LEAGUE_LOGO =
  "https://www.mlbstatic.com/team-logos/league-on-dark/1.svg";
const PRIME_VIDEO_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg";
const ESPN_LOGO =
  "https://a.espncdn.com/guid/54bf758e-5371-31f9-bb3d-8059d58f785c/logos/default.png";
const ESPN_PRIMARY =
  "https://a.espncdn.com/guid/335fd2d2-97b9-336b-81ee-573eb6bdcffc/logos/default.png";

const teamLogo = (teamId: number) =>
  `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`;

/**
 * Curated logos when ESPN omits `media.logo` or ships a blank asset.
 * Prefer MLB static SVGs (readable on dark chips) over dead espncdn paths.
 */
const NETWORK_LOGOS: { test: RegExp; logo: string }[] = [
  // ESPN's MLB.TV PNG is an opaque rectangle that becomes a blank white chip
  // under brightness/invert — use the clean MLB league mark instead.
  { test: /^mlb\.?tv$/i, logo: MLB_LEAGUE_LOGO },
  { test: /^espn(\s*unlmtd|\s*unlimited|\+)?$/i, logo: ESPN_LOGO },
  { test: /^espn2$/i, logo: ESPN_PRIMARY },
  { test: /^(fox|fs1|fox\s*sports)$/i, logo: MLB_LEAGUE_LOGO },
  { test: /^tbs$/i, logo: MLB_LEAGUE_LOGO },
  { test: /^tnt$/i, logo: MLB_LEAGUE_LOGO },
  { test: /^nbc$/i, logo: MLB_LEAGUE_LOGO },
  { test: /^abc$/i, logo: MLB_LEAGUE_LOGO },
  { test: /^cbs$/i, logo: MLB_LEAGUE_LOGO },
  { test: /^peacock$/i, logo: MLB_LEAGUE_LOGO },
  { test: /amazon|prime\s*video/i, logo: PRIME_VIDEO_LOGO },
  { test: /apple\s*tv/i, logo: MLB_LEAGUE_LOGO },
  { test: /^usa(\s*net(work)?)?$/i, logo: MLB_LEAGUE_LOGO },
  // Local affiliates / RSNs
  { test: /^king\s*5$/i, logo: teamLogo(136) }, // Seattle NBC → Mariners
  { test: /^wpix$/i, logo: teamLogo(121) },
  { test: /^yes$/i, logo: teamLogo(147) },
  { test: /^nesn$/i, logo: teamLogo(111) },
  { test: /^sn[yl]$/i, logo: teamLogo(121) },
  { test: /^marquee(\s*sports(\s*net(work)?)?)?$/i, logo: teamLogo(112) },
  { test: /^chsn$/i, logo: teamLogo(145) },
  { test: /^sportsnet\s*(la|la\.?)?$/i, logo: teamLogo(119) },
  { test: /^nbc\s*sports\s*(ba|bay\s*area)$/i, logo: teamLogo(137) },
  { test: /^nbc\s*sports\s*(ca|california)$/i, logo: teamLogo(133) },
  { test: /^nbc\s*sports\s*(phil|philadelphia)$/i, logo: teamLogo(143) },
  { test: /^space\s*city(\s*home(\s*network)?)?$/i, logo: teamLogo(117) },
  { test: /^fan[dD]uel\s*sports(\s*network)?(\s*\w+)?$/i, logo: MLB_LEAGUE_LOGO },
  { test: /^bally\s*sports/i, logo: MLB_LEAGUE_LOGO },
  { test: /^root\s*sports/i, logo: teamLogo(136) },
  { test: /^sportsnet$/i, logo: teamLogo(141) },
  { test: /^tva$/i, logo: teamLogo(141) },
];

/** Club direct-to-consumer streams → MLB team id (cap mark). */
const TEAM_STREAM_IDS: { test: RegExp; teamId: number }[] = [
  { test: /angels\.?\s*tv/i, teamId: 108 },
  { test: /d-?backs?\.?\s*tv|diamondbacks\.?\s*tv/i, teamId: 109 },
  { test: /orioles\.?\s*tv/i, teamId: 110 },
  { test: /red\s*sox\.?\s*tv/i, teamId: 111 },
  { test: /cubs\.?\s*tv/i, teamId: 112 },
  { test: /reds\.?\s*tv/i, teamId: 113 },
  { test: /guardians\.?\s*tv/i, teamId: 114 },
  { test: /rockies\.?\s*tv/i, teamId: 115 },
  { test: /tigers\.?\s*tv/i, teamId: 116 },
  { test: /astros\.?\s*tv/i, teamId: 117 },
  { test: /royals\.?\s*tv/i, teamId: 118 },
  { test: /dodgers\.?\s*tv/i, teamId: 119 },
  { test: /nationals\.?\s*tv/i, teamId: 120 },
  { test: /mets\.?\s*tv/i, teamId: 121 },
  { test: /athletics\.?\s*tv|a'?s\.?\s*tv/i, teamId: 133 },
  { test: /pirates\.?\s*tv/i, teamId: 134 },
  { test: /padres\.?\s*tv/i, teamId: 135 },
  { test: /mariners\.?\s*tv/i, teamId: 136 },
  { test: /giants\.?\s*tv/i, teamId: 137 },
  { test: /cardinals\.?\s*tv/i, teamId: 138 },
  { test: /rays\.?\s*tv/i, teamId: 139 },
  { test: /rangers\.?\s*tv/i, teamId: 140 },
  { test: /blue\s*jays\.?\s*tv|jays\.?\s*tv/i, teamId: 141 },
  { test: /twins\.?\s*tv/i, teamId: 142 },
  { test: /phillies\.?\s*tv/i, teamId: 143 },
  { test: /braves\.?\s*tv|bravesvision/i, teamId: 144 },
  { test: /white\s*sox\.?\s*tv|sox\.?\s*tv/i, teamId: 145 },
  { test: /brewers\.?\s*tv/i, teamId: 158 },
  { test: /yankees\.?\s*tv/i, teamId: 147 },
];

function isUsableEspnLogo(url: string | null | undefined): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  // ESPN's MLB.TV asset renders as a blank white chip on dark UI.
  if (/0db644c3-9f87-37e7-9884-858c2ed45218/i.test(url)) return false;
  return true;
}

export function networkLogoFor(name: string, espnLogo?: string | null): string | null {
  const n = name.trim();
  if (!n) return null;

  for (const row of NETWORK_LOGOS) {
    if (row.test.test(n)) return row.logo;
  }
  for (const row of TEAM_STREAM_IDS) {
    if (row.test.test(n)) return teamLogo(row.teamId);
  }
  // Generic club ".TV" streams — league mark so the chip still has an icon.
  if (/\.tv$/i.test(n) && !/^mlb\.?tv$/i.test(n)) return MLB_LEAGUE_LOGO;

  if (isUsableEspnLogo(espnLogo)) return espnLogo!;
  return null;
}

type EspnGeoBroadcast = {
  type?: { shortName?: string };
  market?: { type?: string } | string;
  media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
  names?: string[];
};

type EspnNamedBroadcast = {
  market?: string | { type?: string };
  names?: string[];
  media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
};

/** Prefer geoBroadcasts (logos) and fall back to names-only broadcasts. */
export function parseEspnBroadcasts(
  geo: EspnGeoBroadcast[] | undefined,
  named: EspnNamedBroadcast[] | undefined,
): GameBroadcast[] {
  const out: GameBroadcast[] = [];
  const seen = new Set<string>();

  const push = (name: string, logo: string | null, market: string | null) => {
    const label = name.trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    // Resolve curated logos first so blank ESPN assets (MLB.TV) get replaced.
    out.push({ name: label, logo: networkLogoFor(label, logo), market });
  };

  const marketOf = (m: EspnGeoBroadcast["market"] | undefined): string | null => {
    if (!m) return null;
    if (typeof m === "string") return m.toLowerCase();
    return m.type?.toLowerCase() ?? null;
  };

  const ingest = (rows: EspnGeoBroadcast[] | EspnNamedBroadcast[] | undefined) => {
    for (const g of rows ?? []) {
      const mediaName = g.media?.shortName || g.media?.name;
      if (mediaName) {
        push(
          mediaName,
          g.media?.darkLogo || g.media?.logo || null,
          marketOf(g.market),
        );
      }
      for (const name of g.names ?? []) {
        push(name, null, marketOf(g.market));
      }
    }
  };

  ingest(geo);
  ingest(named);

  // National / streaming first (MLB.TV, ESPN, …), then locals.
  const rank = (m: string | null) =>
    m === "national" ? 0 : m === "home" || m === "away" ? 2 : 1;
  out.sort((a, b) => rank(a.market) - rank(b.market) || a.name.localeCompare(b.name));
  return out.slice(0, 4);
}
