/**
 * Send-on-update hook for Almanac load batches.
 *
 * Almanac calls this once per finished load — never per row, never from a
 * competitive_buys INSERT trigger. buy_ids are always required for a send.
 * Empty buy_ids → skip (200).
 *
 * Inserts (true new rows) — buy_ids only:
 *   POST { "action": "send", "race_slug": "mo-sd30", "buy_ids": ["…"] }
 *   Just In = those rows' full spend + GRP (rowsToJustIn). Same
 *   sponsor + station group across stations collapses to one tile.
 *   A same-load patch within FRESH_INSERT_WINDOW_MS still counts as new.
 *
 * Revisions (increase on an existing buy) — buy_ids + just_in deltas:
 *   POST { "action": "send", "race_slug", "buy_ids", "just_in": [{
 *     sponsor, amount, grp, market, media, station, side
 *   }] }
 *   `amount` / `grp` are the *increase*, never the full revised row totals
 *   (e.g. MSCC Nexstar +$6,450 / ~47 GRP, not $17.6k / 134 GRP).
 *   parseJustInPayload wins; fetchBuysByIds is skipped for Just In.
 *   Almanac may send one tile per station group.
 *   buy_ids only + updated_at past the insert window → 409 (do not post
 *   full totals as if they were the change).
 *
 * Daily recap — today's inserts, buy_ids only, skip the edited-buy guard:
 *   POST { "action": "send", "race_slug", "buy_ids", "recap": true }
 *
 * On `just_in` without `color`, pass `side: "gop"` (or affiliation / MSCC
 * sponsor) or an explicit red `color`. GOP PAC / MSCC tiles are red-family,
 * never indigo and never Dem blue.
 *
 * Race / DMA pies / affiliation totals are live Almanac competitive_buys
 * for the race_slug when ALMANAC_* keys are set; otherwise pass `buyers`
 * or `totals` on the payload.
 */
import {
  almanacWeekBounds,
  buildCompetitiveCard,
  chicagoToday,
  type CompetitiveCard,
} from "./card.ts";
import {
  almanacCredentials,
  buyersFromTotals,
  editedBuyIds,
  editedBuysRefuseError,
  enrichJustInFromRows,
  MAX_BUY_IDS,
  parseBuyersPayload,
  parseBuyIds,
  parseJustInPayload,
  restAlmanacClient,
  rowsToBuyers,
  rowsToJustIn,
  rowsToWeekBuyers,
  type AlmanacClient,
  type CompetitiveSendBody,
  type EnvGet,
} from "./almanac.ts";

export type SendPlan =
  | { ok: true; skipped: true; reason: "empty buy_ids"; race_slug: string }
  | { ok: true; skipped: false; card: CompetitiveCard; race_slug: string; buy_ids: string[]; source: "almanac" | "payload" }
  | { ok: false; error: string; status: number };

export async function planCompetitiveSend(
  body: CompetitiveSendBody,
  opts: { env: EnvGet; almanac?: AlmanacClient | null; asOf?: string } ,
): Promise<SendPlan> {
  const raceSlug = String(body.race_slug ?? "").trim();
  if (!raceSlug) return { ok: false, error: "race_slug is required", status: 400 };

  const buyIds = parseBuyIds(body.buy_ids);
  if (!buyIds.length) {
    return { ok: true, skipped: true, reason: "empty buy_ids", race_slug: raceSlug };
  }
  if (buyIds.length > MAX_BUY_IDS) {
    return { ok: false, error: `buy_ids exceeds ${MAX_BUY_IDS}`, status: 400 };
  }

  const payloadJustIn = parseJustInPayload(body.just_in);
  const recap = body.recap === true;
  const payloadBuyers = parseBuyersPayload(body.buyers);
  const totalBuyers = buyersFromTotals(body.totals);
  const creds = almanacCredentials(opts.env);
  const client = opts.almanac === undefined
    ? (creds.url && creds.key ? restAlmanacClient(creds.url, creds.key) : null)
    : opts.almanac;

  let justIn = payloadJustIn;
  let buyers = payloadBuyers.length ? payloadBuyers : totalBuyers;
  let weekBuyers: typeof buyers = [];
  let source: "almanac" | "payload" = payloadJustIn.length && buyers.length ? "payload" : "payload";
  const asOf = opts.asOf
    ?? (typeof body.asOf === "string" && body.asOf.trim() ? body.asOf.trim() : chicagoToday());
  const weekOf = almanacWeekBounds(asOf).start;

  if (client) {
    const [batch, raceRows] = await Promise.all([
      justIn.length ? Promise.resolve([]) : client.fetchBuysByIds(buyIds),
      client.fetchRaceBuys(raceSlug),
    ]);
    if (!justIn.length) {
      if (!recap) {
        const edited = editedBuyIds(batch);
        if (edited.length) {
          return { ok: false, error: editedBuysRefuseError(edited), status: 409 };
        }
      }
      justIn = rowsToJustIn(batch.filter((row) => !row.race_slug || row.race_slug === raceSlug));
    } else {
      const metaRows = raceRows.filter((row) => buyIds.includes(row.id));
      justIn = enrichJustInFromRows(justIn, metaRows);
    }
    if (!buyers.length) buyers = rowsToBuyers(raceRows);
    weekBuyers = rowsToWeekBuyers(raceRows, weekOf);
    source = "almanac";
  }

  if (!justIn.length) {
    return {
      ok: false,
      error: "Just In buys not found. Wire ALMANAC_SUPABASE_URL + ALMANAC_SUPABASE_SERVICE_ROLE_KEY or pass just_in.",
      status: 503,
    };
  }
  if (!buyers.length) {
    return {
      ok: false,
      error: "Race totals missing. Wire Almanac keys or pass buyers / totals { dem, gop }.",
      status: 503,
    };
  }

  const market = justIn[0]?.market || buyers[0]?.name || "";
  const card = buildCompetitiveCard({
    slug: raceSlug,
    justIn,
    buyers,
    weekBuyers,
    asOf,
    market,
  });
  return { ok: true, skipped: false, card, race_slug: raceSlug, buy_ids: buyIds, source };
}
