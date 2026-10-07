/**
 * Almanac live reads for competitive Telegram send.
 *
 * Almanac is project sdixnhobyzxfimubxspi — not Command Center.
 * No INSERT trigger on competitive_buys. Almanac POSTs one send per
 * finished load batch.
 *
 * Inserts (true new rows):
 *   { action: "send", race_slug, buy_ids }
 *   Just In = those rows' full spend + GRP via rowsToJustIn.
 *   A same-load patch within FRESH_INSERT_WINDOW_MS still counts as new.
 *
 * Revisions (spend/GRP increase on an existing buy):
 *   { action: "send", race_slug, buy_ids, just_in: [{ amount, grp, … }] }
 *   `just_in` must be the *delta* (increase), never the full revised totals.
 *   buy_ids stay required. planCompetitiveSend prefers parseJustInPayload
 *   and does not fetchBuysByIds for Just In when `just_in` is present.
 *   Multi-station same sponsor|market|media → one DMA tile (Almanac may
 *   send that already aggregated).
 *   buy_ids only + an edited row (updated_at > created_at + window) → 409.
 *
 * Daily recap (6:04pm CT, today's inserts, buy_ids only):
 *   { action: "send", race_slug, buy_ids, recap: true }
 *   Skips the edited-buy guard. source_label (etc.) may bump updated_at
 *   hours after insert.
 *
 * Colors on `just_in`: pass `side: "gop"` / affiliation / MSCC sponsor, or
 * an explicit red `color`. Missing color is inferred — GOP tiles must never
 * fall back to Dem blue. GOP PAC and MSCC use the red-family PAC shade.
 *
 * Secrets:
 *   ALMANAC_SUPABASE_URL                 (or THOMPSON_ALMANAC_SUPABASE_URL)
 *   ALMANAC_SUPABASE_SERVICE_ROLE_KEY    (or ALMANAC_SERVICE_ROLE_KEY)
 *
 * If those are unset, the send payload may include `just_in` and `buyers`
 * (or `totals`) so Almanac can still fire the card.
 */
import {
  DEM_CANDIDATE,
  DEM_PAC,
  GOP_CANDIDATE,
  GOP_PAC,
  displayMedia,
  type Affiliation,
  type BuyerRow,
  type JustInBuy,
} from "./card.ts";

export const ALMANAC_DEFAULT_URL = "https://sdixnhobyzxfimubxspi.supabase.co";
export const MAX_JUST_IN_TILES = 2;
/** Light isolate guard — Almanac load batches are small; reject absurd payloads. */
export const MAX_BUY_IDS = 200;
/**
 * Same-load insert window. A fresh row patched within this interval still
 * counts as new (full spend + GRP, no just_in required). Revisions hours
 * later must pass just_in; the daily recap uses `recap: true` instead.
 */
export const FRESH_INSERT_WINDOW_MS = 5 * 60 * 1000;

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
  /** Almanac competitive_buys.created_at — used to detect revisions. */
  createdAt?: string;
  /** Almanac competitive_buys.updated_at — used to detect revisions. */
  updatedAt?: string;
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
  /** On revisions: delta spend/GRP tiles. Inserts omit this and use buy_ids rows. */
  just_in?: unknown;
  /**
   * Daily recap of today's inserts. Skips the edited-buy just_in guard
   * because source_label (etc.) may bump updated_at hours after insert.
   */
  recap?: boolean;
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

export function isEditedBuy(
  row: Pick<AlmanacBuyRow, "createdAt" | "updatedAt">,
  windowMs = FRESH_INSERT_WINDOW_MS,
): boolean {
  if (!row.createdAt || !row.updatedAt) return false;
  const created = Date.parse(row.createdAt);
  const updated = Date.parse(row.updatedAt);
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return false;
  return updated - created > windowMs;
}

export function editedBuyIds(
  rows: readonly AlmanacBuyRow[],
  windowMs = FRESH_INSERT_WINDOW_MS,
): string[] {
  return rows.filter((row) => isEditedBuy(row, windowMs)).map((row) => row.id).filter(Boolean);
}

export function editedBuysRefuseError(ids: readonly string[]): string {
  return (
    `Edited buys cannot be sent as buy_ids only — Just In would post full row totals instead of the change. ` +
    `Pass the spend/GRP increase in just_in. Edited buy_ids: ${ids.join(", ")}`
  );
}

const SIDE_BY_AFFILIATION: Record<string, Affiliation> = {
  "betsy fogle": "dem",
  "keri ingle": "dem",
  "melanie stinnett": "gop",
  "jon patterson": "gop",
  "missouri senate campaign committee": "gop",
  "mscc": "gop",
  "fogle for missouri": "dem",
  "friends of melanie stinnett": "gop",
  "forward pac": "dem",
  "senate democratic campaign committee": "dem",
  "sdcc": "dem",
  "patterson for missouri": "gop",
  "missouri alliance pac": "gop",
  "keri ingle for mo sd8": "dem",
};

export function sideForAffiliation(affiliation: string): Affiliation {
  const key = affiliation.trim().toLowerCase();
  if (SIDE_BY_AFFILIATION[key]) return SIDE_BY_AFFILIATION[key]!;
  if (/\bmscc\b/.test(key)) return "gop";
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

export function isPacSponsor(row: { sponsorType?: string; sponsor?: string }): boolean {
  const type = String(row.sponsorType ?? "");
  const sponsor = String(row.sponsor ?? "");
  return /pac|committee|\bmscc\b/i.test(`${type} ${sponsor}`);
}

export function inferSide(row: { side?: string; affiliation?: string; sponsor?: string }): Affiliation {
  const explicit = String(row.side ?? "").trim().toLowerCase();
  if (explicit === "gop" || explicit === "republican" || explicit === "rep") return "gop";
  if (explicit === "dem" || explicit === "democrat" || explicit === "democratic") return "dem";
  // Check fields separately so "Melanie Stinnett" still hits the GOP map
  // (joining it with the committee name would miss and default Dem).
  if (row.affiliation?.trim()) {
    const fromAff = sideForAffiliation(row.affiliation);
    const key = row.affiliation.trim().toLowerCase();
    if (SIDE_BY_AFFILIATION[key] || /\bmscc\b/.test(key) || /\b(democrat|democratic|republican|gop)\b/.test(key)) {
      return fromAff;
    }
  }
  if (row.sponsor?.trim()) return sideForAffiliation(row.sponsor);
  return row.affiliation?.trim() ? sideForAffiliation(row.affiliation) : "dem";
}

export function colorForSponsor(row: {
  color?: string;
  sponsorType?: string;
  affiliation?: string;
  sponsor?: string;
  side?: string;
}): string {
  const explicit = typeof row.color === "string" ? row.color.trim() : "";
  if (explicit) return explicit;
  const side = inferSide(row);
  const pac = isPacSponsor(row);
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
      color: colorForSponsor({
        color: row.color,
        sponsorType: row.sponsorType,
        affiliation: row.affiliation,
        sponsor: row.sponsor,
      }),
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
    createdAt: raw.created_at != null ? String(raw.created_at) : undefined,
    updatedAt: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };
}

const BUY_SELECT = "id,race_slug,spend,grp35,media_type,flight_start,affiliation,created_at,updated_at,stations(call_sign,market),sponsors(name,default_affiliation,sponsor_type)";

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
    const sponsor = String(row.sponsor ?? "");
    const explicit = typeof row.color === "string" ? row.color.trim() : "";
    return [{
      id: row.id != null ? String(row.id) : undefined,
      sponsor,
      amount: Number(row.amount ?? row.spend ?? 0),
      market: String(row.market ?? ""),
      media: displayMedia(String(row.media ?? "TV")),
      station: String(row.station ?? ""),
      grp: Number(row.grp ?? 0),
      // Infer from side / affiliation / sponsor when Almanac omits color.
      // GOP + MSCC must never fall back to Dem blue.
      color: colorForSponsor({
        color: explicit,
        sponsor,
        affiliation: String(row.affiliation ?? ""),
        side: String(row.side ?? ""),
        sponsorType: String(row.sponsorType ?? row.sponsor_type ?? ""),
      }),
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
