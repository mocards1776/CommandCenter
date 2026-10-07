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
 *   Multi-station same sponsor + station group → one Just In tile.
 *   Same sponsor across Gray + Nexstar → one tile per group.
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
import { weekSliceOfFlight } from "./week.ts";

export const ALMANAC_DEFAULT_URL = "https://sdixnhobyzxfimubxspi.supabase.co";
export const MAX_JUST_IN_TILES = 4;
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
  flightEnd: string;
  /** stations.owner_group text. */
  ownerGroup?: string;
  /** station_groups.name when station_group_id is set; else owner_group. */
  stationGroup?: string;
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
  "alliance": "gop",
  "keri ingle for mo sd8": "dem",
  "will of the people pac": "dem",
  "wotp": "dem",
  "legio xiii pac": "gop",
};

export function sideForAffiliation(affiliation: string): Affiliation {
  const key = affiliation.trim().toLowerCase();
  if (SIDE_BY_AFFILIATION[key]) return SIDE_BY_AFFILIATION[key]!;
  if (/\bmscc\b/.test(key)) return "gop";
  if (/\b(democrat|democratic|dem)\b/.test(key)) return "dem";
  if (/\b(republican|gop|rep)\b/.test(key)) return "gop";
  return "dem";
}

/**
 * Race-tile / caption / footer labels. Candidates stay last names.
 * PACs use Almanac's full sponsor name (or the short→full map when a
 * payload sends SDCC / Alliance / MSCC / WOTP).
 */
const DISPLAY_NAME: Record<string, string> = {
  "fogle for missouri": "Fogle",
  "betsy fogle": "Fogle",
  fogle: "Fogle",
  "friends of melanie stinnett": "Stinnett",
  "melanie stinnett": "Stinnett",
  stinnett: "Stinnett",
  "missouri senate campaign committee": "Missouri Senate Campaign Committee",
  mscc: "Missouri Senate Campaign Committee",
  "forward pac": "Forward PAC",
  forward: "Forward PAC",
  "legio xiii pac": "Legio XIII PAC",
  "legio xiii": "Legio XIII PAC",
  legio: "Legio XIII PAC",
  "will of the people pac": "Will of the People PAC",
  "will of the people": "Will of the People PAC",
  wotp: "Will of the People PAC",
  "senate democratic campaign committee": "Senate Democratic Campaign Committee",
  sdcc: "Senate Democratic Campaign Committee",
  "patterson for missouri": "Patterson",
  "jon patterson": "Patterson",
  patterson: "Patterson",
  "missouri alliance pac": "Missouri Alliance PAC",
  alliance: "Missouri Alliance PAC",
  "keri ingle for mo sd8": "Ingle",
  "keri ingle": "Ingle",
  ingle: "Ingle",
};

/** Just In keeps first+last for candidates; PACs are the full committee name. */
const JUST_IN_NAME: Record<string, string> = {
  "fogle for missouri": "Betsy Fogle",
  "betsy fogle": "Betsy Fogle",
  fogle: "Betsy Fogle",
  "friends of melanie stinnett": "Melanie Stinnett",
  "melanie stinnett": "Melanie Stinnett",
  stinnett: "Melanie Stinnett",
  "missouri senate campaign committee": "Missouri Senate Campaign Committee",
  mscc: "Missouri Senate Campaign Committee",
  "forward pac": "Forward PAC",
  forward: "Forward PAC",
  "legio xiii pac": "Legio XIII PAC",
  "legio xiii": "Legio XIII PAC",
  legio: "Legio XIII PAC",
  "will of the people pac": "Will of the People PAC",
  "will of the people": "Will of the People PAC",
  wotp: "Will of the People PAC",
  "senate democratic campaign committee": "Senate Democratic Campaign Committee",
  sdcc: "Senate Democratic Campaign Committee",
  "patterson for missouri": "Jon Patterson",
  "jon patterson": "Jon Patterson",
  patterson: "Jon Patterson",
  "missouri alliance pac": "Missouri Alliance PAC",
  alliance: "Missouri Alliance PAC",
  "keri ingle for mo sd8": "Keri Ingle",
  "keri ingle": "Keri Ingle",
  ingle: "Keri Ingle",
};

export function displaySponsorName(name: string): string {
  const raw = name.trim();
  if (!raw) return raw;
  return (
    DISPLAY_NAME[raw.toLowerCase()] ??
    raw.replace(/\s+for Missouri$/i, "").replace(/^Friends of\s+/i, "").replace(/\s+for MO SD\d+$/i, "")
  );
}

/** @deprecated Use displaySponsorName — kept so older callers still resolve. */
export function shortSponsorName(name: string): string {
  return displaySponsorName(name);
}

export function justInSponsorName(name: string): string {
  const raw = name.trim();
  if (!raw) return raw;
  return JUST_IN_NAME[raw.toLowerCase()] ?? displaySponsorName(raw);
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

function buyerId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function addBuyer(buckets: Map<string, BuyerRow>, row: AlmanacBuyRow, name: string, spend: number, grp: number): void {
  if (!(spend > 0) && !(grp > 0)) return;
  const radio = displayMedia(row.media) === "radio";
  const existing = buckets.get(name);
  if (existing) {
    existing.spend += spend;
    existing.grp += grp;
    existing.cpp = existing.grp > 0 ? existing.spend / existing.grp : 0;
    existing.radioOnly = Boolean(existing.radioOnly && radio);
    return;
  }
  buckets.set(name, {
    id: buyerId(name),
    name,
    spend,
    grp,
    cpp: grp > 0 ? spend / grp : 0,
    color: colorForSponsor(row),
    side: sideForAffiliation(row.affiliation),
    radioOnly: radio,
  });
}

export function rowsToBuyers(rows: readonly AlmanacBuyRow[]): BuyerRow[] {
  const buckets = new Map<string, BuyerRow>();
  for (const row of rows) {
    addBuyer(buckets, row, displaySponsorName(row.sponsor), row.spend, row.grp);
  }
  return [...buckets.values()].sort((a, b) => b.spend - a.spend);
}

/** This-week (Tue–Mon) sponsor totals, Almanac-weighted. $0 weeks are omitted. */
export function rowsToWeekBuyers(rows: readonly AlmanacBuyRow[], weekOf: string): BuyerRow[] {
  const buckets = new Map<string, BuyerRow>();
  for (const row of rows) {
    const slice = weekSliceOfFlight(row.flightStart, row.flightEnd, { spend: row.spend, grp: row.grp }, weekOf);
    addBuyer(buckets, row, displaySponsorName(row.sponsor), slice.spend, slice.grp);
  }
  return [...buckets.values()].sort((a, b) => b.spend - a.spend);
}

/** Prefer station_groups.name; else stations.owner_group. */
export function stationGroupName(row: { stationGroup?: string; ownerGroup?: string }): string {
  return String(row.stationGroup || row.ownerGroup || "").trim();
}

function stationSpends(rows: readonly AlmanacBuyRow[]): Map<string, number> {
  const spends = new Map<string, number>();
  for (const row of rows) {
    const call = String(row.station ?? "").trim();
    if (!call || /DMA$/i.test(call)) continue;
    spends.set(call, (spends.get(call) ?? 0) + row.spend);
  }
  return spends;
}

function sortedCallSigns(spends: Map<string, number>): string[] {
  return [...spends.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([call]) => call);
}

export function rowsToJustIn(rows: readonly AlmanacBuyRow[], maxTiles = MAX_JUST_IN_TILES): JustInBuy[] {
  const groups = new Map<string, JustInBuy>();
  const rowsByKey = new Map<string, AlmanacBuyRow[]>();
  for (const row of rows) {
    const media = displayMedia(row.media);
    const group = stationGroupName(row);
    const key = `${justInSponsorName(row.sponsor)}|${row.market}|${media}|${group || row.station}`;
    const list = rowsByKey.get(key) ?? [];
    list.push(row);
    rowsByKey.set(key, list);
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
      stations: row.station ? [row.station] : [],
      stationGroup: group || undefined,
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
    const calls = sortedCallSigns(stationSpends(rowsByKey.get(key) ?? []));
    if (calls.length) {
      buy.stations = calls;
      buy.station = calls[0]!;
    }
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount).slice(0, maxTiles);
}

/** Attach group + call signs onto just_in tiles from the matching buy_ids. */
export function enrichJustInFromRows(tiles: JustInBuy[], rows: readonly AlmanacBuyRow[]): JustInBuy[] {
  if (!tiles.length || !rows.length) return tiles;
  return tiles.map((tile) => {
    if (tile.stationGroup && (tile.stations?.length ?? 0) > 0) return tile;
    const matches = rows.filter((row) => justInSponsorName(row.sponsor) === tile.sponsor);
    const scoped = tile.id ? matches.filter((row) => row.id === tile.id) : matches;
    const use = scoped.length ? scoped : matches;
    if (!use.length) return tile;
    const groups = new Set(use.map(stationGroupName).filter(Boolean));
    const calls = sortedCallSigns(stationSpends(use));
    return {
      ...tile,
      stationGroup: groups.size === 1 ? [...groups][0] : tile.stationGroup,
      stations: calls.length ? calls : tile.stations,
      station: calls[0] || tile.station,
    };
  });
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
  const groupEmbed = embed(station.station_groups);
  const ownerGroup = String(station.owner_group ?? raw.owner_group ?? raw.ownerGroup ?? "");
  const stationGroup = String(
    groupEmbed.name ?? raw.station_group ?? raw.stationGroup ?? ownerGroup,
  );
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
    flightEnd: String(raw.flight_end ?? raw.flightEnd ?? ""),
    ownerGroup: ownerGroup || undefined,
    stationGroup: stationGroup || undefined,
    createdAt: raw.created_at != null ? String(raw.created_at) : undefined,
    updatedAt: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };
}

const BUY_SELECT =
  "id,race_slug,spend,grp35,media_type,flight_start,flight_end,affiliation,created_at,updated_at,stations(call_sign,market,owner_group,station_group_id,station_groups(name)),sponsors(name,default_affiliation,sponsor_type)";

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

function parseCallSigns(raw: unknown, fallback = ""): string[] {
  const fromList = Array.isArray(raw)
    ? raw.map((value) => String(value ?? "").trim()).filter(Boolean)
    : typeof raw === "string" && raw.trim()
      ? raw.split(/[,/]/).map((value) => value.trim()).filter(Boolean)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const call of [...fromList, fallback]) {
    const value = call.trim();
    if (!value || /DMA$/i.test(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function parseJustInPayload(raw: unknown): JustInBuy[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const sponsor = justInSponsorName(String(row.sponsor ?? ""));
    const explicit = typeof row.color === "string" ? row.color.trim() : "";
    const station = String(row.station ?? "");
    const stations = parseCallSigns(row.stations ?? row.call_signs ?? row.callSigns, station);
    const stationGroup = String(
      row.stationGroup ?? row.station_group ?? row.owner_group ?? row.ownerGroup ?? row.group ?? "",
    ).trim();
    return [{
      id: row.id != null ? String(row.id) : undefined,
      sponsor,
      amount: Number(row.amount ?? row.spend ?? 0),
      market: String(row.market ?? ""),
      media: displayMedia(String(row.media ?? "TV")),
      station: stations[0] || station,
      stations,
      stationGroup: stationGroup || undefined,
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
      name: displaySponsorName(String(row.name ?? "")),
      spend: Number(row.spend ?? 0),
      grp: Number(row.grp ?? 0),
      cpp: Number(row.cpp ?? 0),
      color: String(row.color ?? (side === "gop" ? GOP_CANDIDATE : DEM_CANDIDATE)),
      side,
    }];
  }).filter((row) => row.name);
}
