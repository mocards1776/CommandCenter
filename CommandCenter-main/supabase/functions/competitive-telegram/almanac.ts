/**
 * Almanac live reads for competitive Telegram send.
 *
 * Almanac is project sdixnhobyzxfimubxspi — not Command Center.
 * No INSERT trigger on competitive_buys. Almanac POSTs one send per
 * finished load batch: { action: "send", race_slug, buy_ids }.
 *
 * Secrets:
 *   ALMANAC_SUPABASE_URL                 (or THOMPSON_ALMANAC_SUPABASE_URL)
 *   ALMANAC_SUPABASE_SERVICE_ROLE_KEY    (or ALMANAC_SERVICE_ROLE_KEY)
 *
 * If those are unset, the send payload may include `just_in` and `buyers`
 * (or `totals`) so Almanac can still fire the card.
 */
import {
  displayMedia,
  type Affiliation,
  type BuyerRow,
  type JustInBuy,
} from "./card.ts";

export const ALMANAC_DEFAULT_URL = "https://sdixnhobyzxfimubxspi.supabase.co";
export const MAX_JUST_IN_TILES = 2;
/** Light isolate guard — Almanac load batches are small; reject absurd payloads. */
export const MAX_BUY_IDS = 200;

export type EnvGet = { get(name: string): string | undefined };

export type AlmanacBuyRow = {
  id: string;
  race_slug: string;
  spend: number;
  grp: number;
  media: string;
  station: string;
  market: string;
  sponsor: string;
  affiliation: string;
  sponsorType: string;
  color?: string;
  flightStart: string;
};

export type AlmanacClient = {
  fetchBuysByIds(ids: string[]): Promise<AlmanacBuyRow[]>;
  fetchRaceBuys(raceSlug: string): Promise<AlmanacBuyRow[]>;
};

export type SendPayloadTotals = {
  dem?: { spend?: number; grp?: number };
  gop?: { spend?: number; grp?: number };
};

export type CompetitiveSendBody = {
  action?: string;
  race_slug?: string;
  buy_ids?: unknown;
  just_in?: unknown;
  buyers?: unknown;
  totals?: SendPayloadTotals;
  asOf?: string;
  dryRun?: boolean;
};

export function almanacCredentials(env: EnvGet): { url: string; key: string } {
  const url = (
    env.get("ALMANAC_SUPABASE_URL") ||
    env.get("THOMPSON_ALMANAC_SUPABASE_URL") ||
    (env.get("ALMANAC_SUPABASE_SERVICE_ROLE_KEY") || env.get("ALMANAC_SERVICE_ROLE_KEY") ? ALMANAC_DEFAULT_URL : "")
  ).replace(/\/$/, "");
  const key = env.get("ALMANAC_SUPABASE_SERVICE_ROLE_KEY") || env.get("ALMANAC_SERVICE_ROLE_KEY") || "";
  return { url, key };
}

export function parseBuyIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value ?? "").trim()).filter(Boolean);
}

const SIDE_BY_AFFILIATION: Record<string, Affiliation> = {
  "betsy fogle": "dem",
  "keri ingle": "dem",
  "melanie stinnett": "gop",
  "jon patterson": "gop",
};

export function sideForAffiliation(affiliation: string): Affiliation {
  const key = affiliation.trim().toLowerCase();
  if (SIDE_BY_AFFILIATION[key]) return SIDE_BY_AFFILIATION[key]!;
  if (/\b(democrat|democratic|dem)\b/.test(key)) return "dem";
  if (/\b(republican|gop|rep)\b/.test(key)) return "gop";
  return "dem";
}

const SHORT_NAME: Record<string, string> = {
  "fogle for missouri": "Fogle",
  "betsy fogle": "Fogle",
  "friends of melanie stinnett": "Stinnett",
  "melanie stinnett": "Stinnett",
  "missouri senate campaign committee": "MSCC",
  "forward pac": "Forward",
  "legio xiii pac": "Legio",
  "will of the people pac": "WOTP",
  "senate democratic campaign committee": "SDCC",
  "patterson for missouri": "Patterson",
  "jon patterson": "Patterson",
  "missouri alliance pac": "Alliance",
  "keri ingle for mo sd8": "Ingle",
  "keri ingle": "Ingle",
};

const JUST_IN_NAME: Record<string, string> = {
  "fogle for missouri": "Betsy Fogle",
  "friends of melanie stinnett": "Melanie Stinnett",
  "missouri senate campaign committee": "MSCC",
  "forward pac": "Forward PAC",
  "legio xiii pac": "Legio XIII",
  "will of the people pac": "Will of the People",
  "senate democratic campaign committee": "SDCC",
  "patterson for missouri": "Jon Patterson",
  "missouri alliance pac": "Alliance",
  "keri ingle for mo sd8": "Keri Ingle",
};

export function shortSponsorName(name: string): string {
  return SHORT_NAME[name.trim().toLowerCase()] ?? name.replace(/\s+for Missouri$/i, "").replace(/^Friends of\s+/i, "");
}

export function justInSponsorName(name: string): string {
  return JUST_IN_NAME[name.trim().toLowerCase()] ?? shortSponsorName(name);
}

const DEM_CANDIDATE = "#0A84FF";
const DEM_PAC = "#64D2FF";
const GOP_CANDIDATE = "#FF3B30";
const GOP_PAC = "#5E5CE6";

export function colorForSponsor(row: { color?: string; sponsorType: string; affiliation: string }): string {
  if (row.color) return row.color;
  const side = sideForAffiliation(row.affiliation);
  const pac = /pac|committee/i.test(row.sponsorType);
  if (side === "gop") return pac ? GOP_PAC : GOP_CANDIDATE;
  return pac ? DEM_PAC : DEM_CANDIDATE;
}

export function rowsToBuyers(rows: readonly AlmanacBuyRow[]): BuyerRow[] {
  const buckets = new Map<string, BuyerRow>();
  for (const row of rows) {
    const name = shortSponsorName(row.sponsor);
    const side = sideForAffiliation(row.affiliation);
    const existing = buckets.get(name);
    if (existing) {
      existing.spend += row.spend;
      existing.grp += row.grp;
      continue;
    }
    buckets.set(name, {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      spend: row.spend,
      grp: row.grp,
      cpp: row.grp > 0 ? row.spend / row.grp : 0,
      color: colorForSponsor(row),
      side,
    });
  }
  return [...buckets.values()].sort((a, b) => b.spend - a.spend);
}

export function rowsToJustIn(rows: readonly AlmanacBuyRow[], maxTiles = MAX_JUST_IN_TILES): JustInBuy[] {
  const groups = new Map<string, JustInBuy>();
  const stationsByKey = new Map<string, Set<string>>();
  for (const row of rows) {
    const media = displayMedia(row.media);
    const key = `${justInSponsorName(row.sponsor)}|${row.market}|${media}`;
    const stations = stationsByKey.get(key) ?? new Set<string>();
    if (row.station) stations.add(row.station);
    stationsByKey.set(key, stations);
    const existing = groups.get(key);
    if (existing) {
      existing.amount += row.spend;
      existing.grp += row.grp;
      continue;
    }
    groups.set(key, {
      id: row.id,
      sponsor: justInSponsorName(row.sponsor),
      amount: row.spend,
      market: row.market,
      media,
      station: row.station,
      grp: row.grp,
      color: colorForSponsor(row),
      flightStart: row.flightStart,
    });
  }
  for (const [key, buy] of groups) {
    const stations = stationsByKey.get(key);
    if (stations && stations.size > 1) {
      buy.station = `${buy.market} DMA`;
    }
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount).slice(0, maxTiles);
}

export function buyersFromTotals(totals: SendPayloadTotals | undefined): BuyerRow[] {
  if (!totals) return [];
  const rows: BuyerRow[] = [];
  if (totals.dem) {
    rows.push({
      id: "dem",
      name: "Dem",
      spend: Number(totals.dem.spend ?? 0),
      grp: Number(totals.dem.grp ?? 0),
      cpp: 0,
      color: DEM_CANDIDATE,
      side: "dem",
    });
  }
  if (totals.gop) {
    rows.push({
      id: "gop",
      name: "GOP",
      spend: Number(totals.gop.spend ?? 0),
      grp: Number(totals.gop.grp ?? 0),
      cpp: 0,
      color: GOP_CANDIDATE,
      side: "gop",
    });
  }
  return rows;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function embed(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return asRecord(value[0]) ?? {};
  return asRecord(value) ?? {};
}

export function mapRestBuy(raw: Record<string, unknown>, raceSlug: string): AlmanacBuyRow {
  const station = embed(raw.stations);
  const sponsor = embed(raw.sponsors);
  return {
    id: String(raw.id ?? ""),
    race_slug: String(raw.race_slug ?? raceSlug),
    spend: Number(raw.spend ?? 0),
    grp: Number(raw.grp35 ?? raw.grp ?? 0),
    media: String(raw.media_type ?? raw.media ?? "broadcast"),
    station: String(station.call_sign ?? raw.station ?? ""),
    market: String(station.market ?? raw.market ?? ""),
    sponsor: String(sponsor.name ?? raw.sponsor ?? ""),
    affiliation: String(raw.affiliation ?? sponsor.default_affiliation ?? ""),
    sponsorType: String(sponsor.sponsor_type ?? raw.sponsor_type ?? ""),
    color: typeof raw.color === "string" ? raw.color : undefined,
    flightStart: String(raw.flight_start ?? raw.flightStart ?? ""),
  };
}

const BUY_SELECT = "id,race_slug,spend,grp35,media_type,flight_start,affiliation,stations(call_sign,market),sponsors(name,default_affiliation,sponsor_type)";

export function restAlmanacClient(url: string, key: string, fetchFn: typeof fetch = fetch): AlmanacClient {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };

  async function get(path: string): Promise<AlmanacBuyRow[]> {
    const res = await fetchFn(`${url}${path}`, { headers });
    if (!res.ok) throw new Error(`Almanac ${res.status} ${path}`);
    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => mapRestBuy(row, String(row.race_slug ?? "")));
  }

  return {
    async fetchBuysByIds(ids: string[]) {
      if (!ids.length) return [];
      const filter = ids.map((id) => `"${id}"`).join(",");
      return get(`/rest/v1/competitive_buys?id=in.(${filter})&select=${BUY_SELECT}`);
    },
    async fetchRaceBuys(raceSlug: string) {
      return get(`/rest/v1/competitive_buys?race_slug=eq.${encodeURIComponent(raceSlug)}&select=${BUY_SELECT}`);
    },
  };
}

export function parseJustInPayload(raw: unknown): JustInBuy[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    return [{
      id: row.id != null ? String(row.id) : undefined,
      sponsor: String(row.sponsor ?? ""),
      amount: Number(row.amount ?? row.spend ?? 0),
      market: String(row.market ?? ""),
      media: displayMedia(String(row.media ?? "TV")),
      station: String(row.station ?? ""),
      grp: Number(row.grp ?? 0),
      color: String(row.color ?? DEM_CANDIDATE),
      flightStart: row.flightStart != null ? String(row.flightStart) : undefined,
    }];
  }).filter((row) => row.sponsor && row.amount > 0);
}

export function parseBuyersPayload(raw: unknown): BuyerRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const side: Affiliation = String(row.side ?? "") === "gop" ? "gop" : "dem";
    return [{
      id: String(row.id ?? row.name ?? side),
      name: String(row.name ?? ""),
      spend: Number(row.spend ?? 0),
      grp: Number(row.grp ?? 0),
      cpp: Number(row.cpp ?? 0),
      color: String(row.color ?? (side === "gop" ? GOP_CANDIDATE : DEM_CANDIDATE)),
      side,
    }];
  }).filter((row) => row.name);
}
