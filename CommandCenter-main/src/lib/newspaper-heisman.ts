/**
 * Heisman Trophy odds for the Times CFB desk.
 * Reads Kalshi's public market API (no auth) at press time.
 */

const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const CT = "America/Chicago";
const ESPN_LOGO = "https://a.espncdn.com/i/teamlogos/ncaa/500";

export type HeismanRow = {
  name: string;
  school: string;
  pct: number;
  logo: string | null;
  ticker: string;
};

export type HeismanBoard = {
  title: string;
  asOf: string;
  asOfIso: string;
  rows: HeismanRow[];
};

export type HeismanLogoHint = {
  name?: string | null;
  abbrev?: string | null;
  logo?: string | null;
};

type KalshiEvent = {
  event_ticker?: string;
  series_ticker?: string;
  title?: string;
  sub_title?: string;
};

type KalshiMarket = {
  ticker?: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  yes_bid_dollars?: string | null;
  yes_ask_dollars?: string | null;
  last_price_dollars?: string | null;
  updated_time?: string;
  custom_strike?: { Person?: string; Team?: string } | null;
};

const SCHOOL_IDS: Record<string, string> = {
  alabama: "333",
  arkansas: "8",
  auburn: "2",
  "byu": "252",
  florida: "57",
  georgia: "61",
  houston: "248",
  indiana: "84",
  "iowa": "2294",
  "kansas": "2305",
  kentucky: "96",
  "lsu": "99",
  miami: "2390",
  "miami fl": "2390",
  missouri: "142",
  "miz": "142",
  nebraska: "158",
  "notre dame": "87",
  michigan: "130",
  "ohio state": "194",
  "oklahoma": "201",
  "oklahoma state": "197",
  "ole miss": "145",
  mississippi: "145",
  "mississippi state": "344",
  "north texas": "249",
  oregon: "2483",
  pitt: "221",
  pittsburgh: "221",
  "penn state": "213",
  smu: "2567",
  tcu: "2628",
  tennessee: "2633",
  texas: "251",
  "texas a&m": "245",
  "texas tech": "2641",
  ucla: "26",
  "usc": "30",
  utah: "254",
  vanderbilt: "238",
  washington: "264",
};

export function squashSchool(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[.’']/g, "")
    .replace(/[()]/g, " ")
    .replace(/\./g, "")
    .replace(/\bst\b/g, "state")
    .replace(/\s+/g, " ")
    .trim();
}

export function schoolFromSubtitle(subtitle: string | null | undefined): string {
  if (!subtitle) return "";
  const parts = subtitle.split("::").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function kalshiDollar(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Yes bid/ask midpoint, else last price, as 0–1. */
export function impliedYesProb(m: {
  yes_bid_dollars?: string | null;
  yes_ask_dollars?: string | null;
  last_price_dollars?: string | null;
}): number | null {
  const bid = kalshiDollar(m.yes_bid_dollars);
  const ask = kalshiDollar(m.yes_ask_dollars);
  const last = kalshiDollar(m.last_price_dollars);
  if (bid != null && ask != null && (bid > 0 || ask > 0)) return (bid + ask) / 2;
  const pick = (last && last > 0 ? last : null) ?? (ask && ask > 0 ? ask : null) ?? (bid && bid > 0 ? bid : null);
  return pick;
}

export function formatHeismanAsOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Kalshi odds";
  const time = d.toLocaleTimeString("en-US", {
    timeZone: CT,
    hour: "numeric",
    minute: "2-digit",
  });
  return `Kalshi odds as of ${time} CT`;
}

function logoFromId(id: string): string {
  return `${ESPN_LOGO}/${id}.png`;
}

export function matchHeismanLogo(school: string, hints: HeismanLogoHint[] = []): string | null {
  const key = squashSchool(school);
  if (!key) return null;
  for (const hint of hints) {
    const logo = hint.logo;
    if (!logo) continue;
    const names = [hint.name, hint.abbrev].filter(Boolean).map((n) => squashSchool(String(n)));
    if (names.some((n) => n && (n === key || n.includes(key) || key.includes(n)))) return logo;
  }
  const id = SCHOOL_IDS[key] ?? SCHOOL_IDS[key.replace(/\s+fl$/, "")] ?? null;
  return id ? logoFromId(id) : null;
}

export function attachHeismanLogos(board: HeismanBoard, hints: HeismanLogoHint[]): HeismanBoard {
  return {
    ...board,
    rows: board.rows.map((row) => ({
      ...row,
      logo: row.logo ?? matchHeismanLogo(row.school, hints),
    })),
  };
}

function kalshiUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  // The press bundle polyfills `window` onto globalThis. A real browser
  // has `document`; Deno/Node press talks to Kalshi directly.
  if (typeof document !== "undefined") {
    return `/api/kalshi?path=${encodeURIComponent(clean)}`;
  }
  return `${KALSHI}/${clean}`;
}

async function kalshiGet<T>(path: string, ms = 6_000): Promise<T | null> {
  try {
    const ctl = new AbortController();
    const t = globalThis.setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(kalshiUrl(path), {
        headers: { Accept: "application/json" },
        signal: ctl.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } finally {
      globalThis.clearTimeout(t);
    }
  } catch {
    return null;
  }
}

function isHeismanTitle(text: string): boolean {
  return /heisman/i.test(text);
}

async function findHeismanEvent(): Promise<KalshiEvent | null> {
  const direct = await kalshiGet<{ events?: KalshiEvent[] }>(
    "/events?series_ticker=KXHEISMAN&status=open&limit=10",
  );
  const fromSeries = (direct?.events ?? []).filter((e) =>
    isHeismanTitle(`${e.title ?? ""} ${e.series_ticker ?? ""}`),
  );
  if (fromSeries.length) return fromSeries.sort((a, b) => (b.event_ticker ?? "").localeCompare(a.event_ticker ?? ""))[0] ?? null;

  const scan = await kalshiGet<{ events?: KalshiEvent[] }>("/events?status=open&limit=200");
  const hit = (scan?.events ?? []).find((e) => isHeismanTitle(`${e.title ?? ""} ${e.series_ticker ?? ""} ${e.event_ticker ?? ""}`));
  return hit ?? null;
}

function rowFromMarket(m: KalshiMarket): HeismanRow | null {
  const name = (m.yes_sub_title || m.custom_strike?.Person || m.no_sub_title || "").trim();
  if (!name || /any other|field|tie|co-?winner/i.test(name)) return null;
  const p = impliedYesProb(m);
  if (p == null || p <= 0) return null;
  const school = schoolFromSubtitle(m.subtitle) || m.custom_strike?.Team || "";
  return {
    name,
    school,
    pct: Math.max(1, Math.round(p * 100)),
    logo: matchHeismanLogo(school),
    ticker: m.ticker ?? name,
  };
}

/** Press-time Heisman board. Null when Kalshi is down or has no market. */
export async function fetchHeismanOdds(): Promise<HeismanBoard | null> {
  const event = await findHeismanEvent();
  const ticker = event?.event_ticker;
  if (!ticker) return null;
  const data = await kalshiGet<{ markets?: KalshiMarket[] }>(
    `/markets?event_ticker=${encodeURIComponent(ticker)}&status=open&limit=200`,
  );
  const markets = data?.markets ?? [];
  const rows = markets
    .map(rowFromMarket)
    .filter((r): r is HeismanRow => r != null)
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name))
    .slice(0, 10);
  if (!rows.length) return null;
  const asOfIso =
    markets.map((m) => m.updated_time ?? "").filter(Boolean).sort().at(-1) || new Date().toISOString();
  return {
    title: event?.title?.trim() || "Heisman Trophy",
    asOf: formatHeismanAsOf(asOfIso),
    asOfIso,
    rows,
  };
}
