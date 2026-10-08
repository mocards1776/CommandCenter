/**
 * Kalshi "Pro Baseball Champion" (World Series) board.
 *
 * Public market data, no auth. Price is the yes bid/ask midpoint when both
 * quotes sit strictly inside (0, 1) — the live book on these markets is a
 * tenth of a cent wide, and the last print can sit a tick off that. A 0 bid
 * with a 1 ask is an empty or settled book, not a price; then we use the last
 * trade if it is also inside (0, 1). Eliminated clubs are Kalshi markets that
 * are no longer `active` (result `no`). No open markets → null, so the UI hides.
 */

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const CT = "America/Chicago";
const OK_TTL_MS = 3 * 60_000;
const MISS_TTL_MS = 30_000;

export type KalshiMarket = {
  ticker?: string;
  title?: string;
  yes_sub_title?: string | null;
  no_sub_title?: string | null;
  status?: string;
  result?: string | null;
  yes_bid_dollars?: string | null;
  yes_ask_dollars?: string | null;
  last_price_dollars?: string | null;
};

export type KalshiEvent = {
  event_ticker?: string;
  series_ticker?: string;
  title?: string;
  sub_title?: string;
};

export type WsOddsTeam = {
  teamId: number;
  abbrev: string;
  pct: number;
  ticker: string;
};

export type WsOddsBoard = {
  source: "Kalshi";
  eventTicker: string;
  title: string;
  asOf: string;
  /** Clock in America/Chicago, e.g. "4:06 PM CT". */
  asOfLabel: string;
  teams: WsOddsTeam[];
};

const BY_ABBREV: Record<string, { teamId: number; abbrev: string }> = {
  LAA: { teamId: 108, abbrev: "LAA" },
  AZ: { teamId: 109, abbrev: "AZ" },
  ARI: { teamId: 109, abbrev: "AZ" },
  BAL: { teamId: 110, abbrev: "BAL" },
  BOS: { teamId: 111, abbrev: "BOS" },
  CHC: { teamId: 112, abbrev: "CHC" },
  CIN: { teamId: 113, abbrev: "CIN" },
  CLE: { teamId: 114, abbrev: "CLE" },
  COL: { teamId: 115, abbrev: "COL" },
  DET: { teamId: 116, abbrev: "DET" },
  HOU: { teamId: 117, abbrev: "HOU" },
  KC: { teamId: 118, abbrev: "KC" },
  KCR: { teamId: 118, abbrev: "KC" },
  LAD: { teamId: 119, abbrev: "LAD" },
  WSH: { teamId: 120, abbrev: "WSH" },
  WAS: { teamId: 120, abbrev: "WSH" },
  WSN: { teamId: 120, abbrev: "WSH" },
  NYM: { teamId: 121, abbrev: "NYM" },
  ATH: { teamId: 133, abbrev: "ATH" },
  OAK: { teamId: 133, abbrev: "ATH" },
  PIT: { teamId: 134, abbrev: "PIT" },
  SD: { teamId: 135, abbrev: "SD" },
  SDP: { teamId: 135, abbrev: "SD" },
  SEA: { teamId: 136, abbrev: "SEA" },
  SF: { teamId: 137, abbrev: "SF" },
  SFG: { teamId: 137, abbrev: "SF" },
  STL: { teamId: 138, abbrev: "STL" },
  TB: { teamId: 139, abbrev: "TB" },
  TBR: { teamId: 139, abbrev: "TB" },
  TEX: { teamId: 140, abbrev: "TEX" },
  TOR: { teamId: 141, abbrev: "TOR" },
  MIN: { teamId: 142, abbrev: "MIN" },
  PHI: { teamId: 143, abbrev: "PHI" },
  ATL: { teamId: 144, abbrev: "ATL" },
  CWS: { teamId: 145, abbrev: "CWS" },
  CHW: { teamId: 145, abbrev: "CWS" },
  MIA: { teamId: 146, abbrev: "MIA" },
  NYY: { teamId: 147, abbrev: "NYY" },
  MIL: { teamId: 158, abbrev: "MIL" },
};

/** Kalshi yes-subtitles and club names → ticker abbrev. */
const BY_NAME: Record<string, string> = {
  "los angeles d": "LAD",
  "los angeles dodgers": "LAD",
  dodgers: "LAD",
  "los angeles a": "LAA",
  "los angeles angels": "LAA",
  angels: "LAA",
  "chicago ws": "CWS",
  "chicago white sox": "CWS",
  "white sox": "CWS",
  "chicago c": "CHC",
  "chicago cubs": "CHC",
  cubs: "CHC",
  "new york y": "NYY",
  "new york yankees": "NYY",
  yankees: "NYY",
  "new york m": "NYM",
  "new york mets": "NYM",
  mets: "NYM",
  "a's": "ATH",
  athletics: "ATH",
  oakland: "ATH",
  "tampa bay": "TB",
  "tampa bay rays": "TB",
  rays: "TB",
  "st louis": "STL",
  "st louis cardinals": "STL",
  cardinals: "STL",
  houston: "HOU",
  "houston astros": "HOU",
  astros: "HOU",
  milwaukee: "MIL",
  "milwaukee brewers": "MIL",
  brewers: "MIL",
  minnesota: "MIN",
  "minnesota twins": "MIN",
  twins: "MIN",
  pittsburgh: "PIT",
  "pittsburgh pirates": "PIT",
  pirates: "PIT",
  cleveland: "CLE",
  "cleveland guardians": "CLE",
  guardians: "CLE",
  "kansas city": "KC",
  "kansas city royals": "KC",
  royals: "KC",
  washington: "WSH",
  "washington nationals": "WSH",
  nationals: "WSH",
  "san francisco": "SF",
  "san francisco giants": "SF",
  giants: "SF",
  cincinnati: "CIN",
  "cincinnati reds": "CIN",
  reds: "CIN",
  colorado: "COL",
  "colorado rockies": "COL",
  rockies: "COL",
  texas: "TEX",
  "texas rangers": "TEX",
  rangers: "TEX",
  philadelphia: "PHI",
  "philadelphia phillies": "PHI",
  phillies: "PHI",
  seattle: "SEA",
  "seattle mariners": "SEA",
  mariners: "SEA",
  baltimore: "BAL",
  "baltimore orioles": "BAL",
  orioles: "BAL",
  miami: "MIA",
  "miami marlins": "MIA",
  marlins: "MIA",
  detroit: "DET",
  "detroit tigers": "DET",
  tigers: "DET",
  toronto: "TOR",
  "toronto blue jays": "TOR",
  "blue jays": "TOR",
  boston: "BOS",
  "boston red sox": "BOS",
  "red sox": "BOS",
  atlanta: "ATL",
  "atlanta braves": "ATL",
  braves: "ATL",
  arizona: "AZ",
  "arizona diamondbacks": "AZ",
  diamondbacks: "AZ",
  dbacks: "AZ",
  "d-backs": "AZ",
  "san diego": "SD",
  "san diego padres": "SD",
  padres: "SD",
};

function dollar(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Yes probability in (0, 1), or null when the book has no usable price. */
export function impliedYes(m: {
  yes_bid_dollars?: string | null;
  yes_ask_dollars?: string | null;
  last_price_dollars?: string | null;
}): number | null {
  const bid = dollar(m.yes_bid_dollars);
  const ask = dollar(m.yes_ask_dollars);
  if (bid != null && ask != null && bid > 0 && ask < 1 && ask >= bid) {
    return (bid + ask) / 2;
  }
  const last = dollar(m.last_price_dollars);
  if (last != null && last > 0 && last < 1) return last;
  return null;
}

export function formatAsOfLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "CT";
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: CT,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `${time} CT`;
}

function squash(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.’']/g, "")
    .replace(/\./g, "")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

export function teamFromMarket(m: KalshiMarket): { teamId: number; abbrev: string } | null {
  const suffix = (m.ticker ?? "").toUpperCase().split("-").pop() ?? "";
  if (/^[A-Z]{2,4}$/.test(suffix) && BY_ABBREV[suffix]) return BY_ABBREV[suffix];
  const label = squash(m.yes_sub_title || m.no_sub_title || "");
  const abbrev = BY_NAME[label];
  return abbrev ? BY_ABBREV[abbrev] ?? null : null;
}

function stillAlive(m: KalshiMarket): boolean {
  if (m.result && m.result.trim()) return false;
  if (m.status && m.status !== "active") return false;
  return true;
}

export function boardFromMarkets(
  eventTicker: string,
  markets: KalshiMarket[],
  now = new Date(),
): WsOddsBoard | null {
  const byTeam = new Map<number, WsOddsTeam & { p: number }>();
  for (const m of markets) {
    if (!stillAlive(m)) continue;
    const p = impliedYes(m);
    if (p == null) continue;
    const team = teamFromMarket(m);
    if (!team) continue;
    const pct = Math.round(p * 100);
    if (pct <= 0 || pct > 100) continue;
    const prev = byTeam.get(team.teamId);
    if (prev && prev.p >= p) continue;
    byTeam.set(team.teamId, {
      teamId: team.teamId,
      abbrev: team.abbrev,
      pct,
      ticker: m.ticker ?? team.abbrev,
      p,
    });
  }
  const teams = [...byTeam.values()]
    .sort((a, b) => b.p - a.p || a.abbrev.localeCompare(b.abbrev))
    .map(({ p: _p, ...team }) => team);
  if (!teams.length) return null;
  const asOf = now.toISOString();
  return {
    source: "Kalshi",
    eventTicker,
    title: "World Series",
    asOf,
    asOfLabel: formatAsOfLabel(asOf),
    teams,
  };
}

function championEvent(e: KalshiEvent): boolean {
  const blob = `${e.title ?? ""} ${e.sub_title ?? ""} ${e.series_ticker ?? ""} ${e.event_ticker ?? ""}`;
  if (!/KXMLB/i.test(`${e.series_ticker ?? ""} ${e.event_ticker ?? ""}`)) return false;
  return /champion|world series/i.test(blob);
}

async function kalshiGet<T>(path: string, ms = 8_000): Promise<T | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(`${KALSHI}${path}`, {
      headers: { Accept: "application/json" },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Newest champion event that still has open team markets. Null when Kalshi is down or the board is empty. */
export async function fetchWsBoard(now = new Date()): Promise<WsOddsBoard | null> {
  const listed = await kalshiGet<{ events?: KalshiEvent[] }>("/events?series_ticker=KXMLB&limit=20");
  const tickers = (listed?.events ?? [])
    .filter(championEvent)
    .map((e) => e.event_ticker ?? "")
    .filter(Boolean)
    .sort()
    .reverse();
  if (!tickers.length) {
    const yy = now.getFullYear() % 100;
    tickers.push(`KXMLB-${yy}`, `KXMLB-${String(yy - 1).padStart(2, "0")}`);
  }
  for (const ticker of tickers) {
    const data = await kalshiGet<{ markets?: KalshiMarket[] }>(
      `/markets?event_ticker=${encodeURIComponent(ticker)}&status=open&limit=100`,
    );
    if (!data) continue;
    const board = boardFromMarkets(ticker, data.markets ?? [], now);
    if (board) return board;
  }
  return null;
}

let memory: { at: number; board: WsOddsBoard | null } | null = null;

/** A few minutes of memory cache so a slate of phones shares one Kalshi read per isolate. */
export async function fetchWsBoardCached(now = Date.now()): Promise<WsOddsBoard | null> {
  if (memory) {
    const ttl = memory.board ? OK_TTL_MS : MISS_TTL_MS;
    if (now - memory.at < ttl) return memory.board;
  }
  const board = await fetchWsBoard(new Date(now));
  memory = { at: now, board };
  return board;
}

/** Test hook. */
export function clearWsBoardCache(): void {
  memory = null;
}
