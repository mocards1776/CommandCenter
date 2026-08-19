/** TV / stream networks shown on RUWT cards. */

export type GameBroadcast = {
  name: string;
  logo: string | null;
  /** national | home | away | local | null */
  market: string | null;
};

/** Well-known network wordmarks when ESPN omits `media.logo`. */
const NETWORK_LOGOS: { test: RegExp; logo: string }[] = [
  {
    test: /^mlb\.?tv$/i,
    logo: "https://a.espncdn.com/guid/0db644c3-9f87-37e7-9884-858c2ed45218/logos/default.png",
  },
  {
    test: /^espn(\s*unlmtd|\s*unlimited|\+)?$/i,
    logo: "https://a.espncdn.com/guid/54bf758e-5371-31f9-bb3d-8059d58f785c/logos/default.png",
  },
  {
    test: /^espn2$/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/espn2.png",
  },
  {
    test: /^(fox|fs1|fox\s*sports)$/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/foxsports.png",
  },
  {
    test: /^tbs$/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/tbs.png",
  },
  {
    test: /^tnt$/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/tnt.png",
  },
  {
    test: /^nbc$/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/nbc.png",
  },
  {
    test: /^abc$/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/abc.png",
  },
  {
    test: /^cbs$/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/cbs.png",
  },
  {
    test: /^peacock$/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/peacock.png",
  },
  {
    test: /amazon|prime\s*video/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/amazonprime.png",
  },
  {
    test: /apple\s*tv/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/appletv.png",
  },
  {
    test: /^usa(\s*net(work)?)?$/i,
    logo: "https://a.espncdn.com/i/espn/networks_logo/bg/usa.png",
  },
];

export function networkLogoFor(name: string, espnLogo?: string | null): string | null {
  if (espnLogo && /^https?:\/\//i.test(espnLogo)) return espnLogo;
  const n = name.trim();
  for (const row of NETWORK_LOGOS) {
    if (row.test.test(n)) return row.logo;
  }
  return null;
}

type EspnGeoBroadcast = {
  type?: { shortName?: string };
  market?: { type?: string };
  media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
};

type EspnNamedBroadcast = {
  market?: string;
  names?: string[];
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
    out.push({ name: label, logo: networkLogoFor(label, logo), market });
  };

  for (const g of geo ?? []) {
    const name = g.media?.shortName || g.media?.name;
    if (!name) continue;
    push(
      name,
      g.media?.logo || g.media?.darkLogo || null,
      g.market?.type?.toLowerCase() ?? null,
    );
  }

  for (const b of named ?? []) {
    for (const name of b.names ?? []) {
      push(name, null, b.market?.toLowerCase() ?? null);
    }
  }

  // National / streaming first (MLB.TV, ESPN, …), then locals.
  const rank = (m: string | null) =>
    m === "national" ? 0 : m === "home" || m === "away" ? 2 : 1;
  out.sort((a, b) => rank(a.market) - rank(b.market) || a.name.localeCompare(b.name));
  return out.slice(0, 4);
}
