/**
 * Send-on-update hook for Almanac load batches.
 *
 * Almanac calls this once per finished load — never per row, never from a
 * competitive_buys INSERT trigger:
 *
 *   POST { "action": "send", "race_slug": "mo-sd30", "buy_ids": ["…", "…"] }
 *
 * Empty buy_ids → skip (200). Just In is those rows (spend + GRP only).
 * Race / DMA pies / affiliation totals are live Almanac competitive_buys
 * for the race_slug when ALMANAC_* keys are set; otherwise pass `buyers`
 * or `totals` on the payload.
 */
import {
  buildCompetitiveCard,
  SAMPLE_AS_OF,
  type CompetitiveCard,
} from "./card.ts";
import {
  almanacCredentials,
  buyersFromTotals,
  parseBuyersPayload,
  parseBuyIds,
  parseJustInPayload,
  restAlmanacClient,
  rowsToBuyers,
  rowsToJustIn,
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

  const payloadJustIn = parseJustInPayload(body.just_in);
  const payloadBuyers = parseBuyersPayload(body.buyers);
  const totalBuyers = buyersFromTotals(body.totals);
  const creds = almanacCredentials(opts.env);
  const client = opts.almanac === undefined
    ? (creds.url && creds.key ? restAlmanacClient(creds.url, creds.key) : null)
    : opts.almanac;

  let justIn = payloadJustIn;
  let buyers = payloadBuyers.length ? payloadBuyers : totalBuyers;
  let source: "almanac" | "payload" = payloadJustIn.length && buyers.length ? "payload" : "payload";

  if (client) {
    const [batch, raceRows] = await Promise.all([
      justIn.length ? Promise.resolve([]) : client.fetchBuysByIds(buyIds),
      buyers.length ? Promise.resolve([]) : client.fetchRaceBuys(raceSlug),
    ]);
    if (!justIn.length) justIn = rowsToJustIn(batch.filter((row) => !row.race_slug || row.race_slug === raceSlug));
    if (!buyers.length) buyers = rowsToBuyers(raceRows);
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
    asOf: opts.asOf ?? (typeof body.asOf === "string" ? body.asOf : SAMPLE_AS_OF),
    market,
  });
  return { ok: true, skipped: false, card, race_slug: raceSlug, buy_ids: buyIds, source };
}
