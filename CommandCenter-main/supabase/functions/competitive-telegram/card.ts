/**
 * Competitive intel card model for @ThompsonCompetitive_bot.
 *
 * Numbers are the filed buys — no letter grades, no invented ratings.
 * Just in is spend that landed, not process notes.
 */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export type Affiliation = "dem" | "gop";

export type BuyerRow = {
  id: string;
  name: string;
  spend: number;
  grp: number;
  cpp: number;
  color: string;
  side: Affiliation;
};

export type AffiliationSlice = {
  id: Affiliation;
  label: string;
  parties: string;
  spend: number;
  grp: number;
  color: string;
};

/** A buy that just filed — sponsor / market / media / amount / GRP. */
export type JustInBuy = {
  id?: string;
  sponsor: string;
  amount: number;
  market: string;
  media: string;
  station: string;
  grp: number;
  color: string;
  flightStart?: string;
};

/** Party colors. GOP PAC / MSCC stay in the red family — never indigo. */
export const DEM_CANDIDATE = "#0A84FF";
export const DEM_PAC = "#64D2FF";
export const GOP_CANDIDATE = "#FF3B30";
/** Distinct from candidate red, still clearly red (not #5E5CE6 purple). */
export const GOP_PAC = "#FF6B63";

export type AheadItem = {
  text: string;
  line: string;
  sub: string;
};

export type CompetitiveCard = {
  kicker: string;
  office: string;
  race: string;
  title: string;
  market: string;
  dateLabel: string;
  justInTitle: string;
  buyers: BuyerRow[];
  justIn: JustInBuy[];
  stillAhead: AheadItem[];
  captionWhatsNew: string;
  logoData: string | null;
  footer: string;
  handle: string;
};

/** Springfield SD-30 snapshot Josh reviewed (Oct 6, 2026). */
export const SD30_SAMPLE_BUYERS: readonly BuyerRow[] = [
  { id: "fogle", name: "Fogle", spend: 453350, grp: 4873.5, cpp: 93, color: DEM_CANDIDATE, side: "dem" },
  { id: "stinnett", name: "Stinnett", spend: 253570, grp: 2766.6, cpp: 92, color: GOP_CANDIDATE, side: "gop" },
  { id: "forward", name: "Forward", spend: 162745, grp: 980.9, cpp: 166, color: DEM_PAC, side: "dem" },
  { id: "mscc", name: "MSCC", spend: 119310, grp: 642.6, cpp: 186, color: GOP_PAC, side: "gop" },
];

/**
 * Current broadcast week (Mon 10/5–Sun 10/11) KYTV deltas — not last week's
 * Fogle $70,420 / 939 GRP flight that started 9/29.
 * MSCC KYTV $47,440 / 274.8 GRP (10/5); Fogle KYTV $32,300 / 358.9 GRP (10/6).
 */
export const SD30_SAMPLE_JUST_IN: readonly JustInBuy[] = [
  {
    id: "a59019d1-ff74-46d4-b119-b1e78c0dce09",
    sponsor: "MSCC",
    amount: 47440,
    market: "Springfield",
    media: "TV",
    station: "KYTV",
    grp: 274.8,
    color: GOP_PAC,
    flightStart: "2026-10-05",
  },
  {
    id: "16c2dcfa-5d5d-4fc0-a9e3-08312dce1fa5",
    sponsor: "Betsy Fogle",
    amount: 32300,
    market: "Springfield",
    media: "TV",
    station: "KYTV",
    grp: 358.9,
    color: DEM_CANDIDATE,
    flightStart: "2026-10-06",
  },
];

export const SD30_SAMPLE_AHEAD: readonly AheadItem[] = [
  { text: "Verify remaining weeks on air", line: "Remaining weeks", sub: "still to verify" },
  { text: "FCC copies still lag", line: "FCC copies", sub: "still lag" },
  { text: "Radio / cable — no GRP in this book", line: "Radio / cable", sub: "no GRP in this book" },
];

export function formatSpendShort(spend: number): string {
  if (!Number.isFinite(spend)) return "—";
  if (Math.abs(spend) >= 1000) return `$${Math.round(spend / 1000)}k`;
  return `$${Math.round(spend)}`;
}

export function formatSpendExact(spend: number): string {
  if (!Number.isFinite(spend)) return "—";
  return `$${Math.round(spend).toLocaleString("en-US")}`;
}

export function formatGrp(grp: number): string {
  if (!Number.isFinite(grp)) return "—";
  const rounded = Math.round(grp * 10) / 10;
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

export function formatCpp(cpp: number): string {
  if (!Number.isFinite(cpp)) return "—";
  return `$${Math.round(cpp)}`;
}

export const SAMPLE_AS_OF = "2026-10-06";

/** US broadcast week is Monday–Sunday. */
export function broadcastWeekBounds(asOf = SAMPLE_AS_OF): { start: string; end: string } {
  const [y, m, d] = asOf.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d));
  const dow = date.getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  date.setUTCDate(date.getUTCDate() - back);
  const start = ymd(date);
  date.setUTCDate(date.getUTCDate() + 6);
  return { start, end: ymd(date) };
}

export function inBroadcastWeek(flightStart: string | undefined, asOf = SAMPLE_AS_OF): boolean {
  if (!flightStart) return false;
  const { start, end } = broadcastWeekBounds(asOf);
  return flightStart >= start && flightStart <= end;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function displayMedia(media: string): string {
  const key = media.trim().toLowerCase();
  if (key === "broadcast" || key === "tv") return "TV";
  if (key === "radio") return "radio";
  if (key === "cable") return "cable";
  return media || "TV";
}

/** "MSCC added $47,440 in Springfield TV for 274.8 GRP" */
export function formatJustInLine(buy: JustInBuy): string {
  return `${buy.sponsor} added ${formatSpendExact(buy.amount)} in ${buy.market} ${displayMedia(buy.media)} for ${formatGrp(buy.grp)} GRP`;
}

export const SD30_CAPTION_WHATS_NEW = SD30_SAMPLE_JUST_IN.map(formatJustInLine).join("; ");

export type RaceMeta = {
  slug: string;
  title: string;
  race: string;
  market: string;
  office: string;
};

export const RACE_CATALOG: Record<string, RaceMeta> = {
  "mo-sd30": { slug: "mo-sd30", title: "Missouri SD-30", race: "SD-30", market: "Springfield", office: "Missouri Senate" },
  "mo-sd8": { slug: "mo-sd8", title: "Missouri SD-8", race: "SD-8", market: "Kansas City", office: "Missouri Senate" },
};

export function raceMeta(slug: string, fallbackMarket = ""): RaceMeta {
  const known = RACE_CATALOG[slug];
  if (known) return known;
  const district = slug.replace(/^mo-/, "").toUpperCase();
  return {
    slug,
    title: `Missouri ${district}`,
    race: district,
    market: fallbackMarket,
    office: "Missouri Senate",
  };
}

export function formatDateLabel(ymdDate: string): string {
  const [y, m, d] = ymdDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d));
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function buildCompetitiveCard(opts: {
  slug: string;
  justIn: JustInBuy[];
  buyers: BuyerRow[];
  asOf?: string;
  logoData?: string | null;
  market?: string;
}): CompetitiveCard {
  const asOf = opts.asOf ?? SAMPLE_AS_OF;
  const meta = raceMeta(opts.slug, opts.market ?? opts.justIn[0]?.market ?? opts.buyers[0]?.name ?? "");
  const justIn = opts.justIn.map((row) => ({ ...row, media: displayMedia(row.media) }));
  return {
    kicker: "COMPETITIVE",
    office: meta.office,
    race: meta.race,
    title: meta.title,
    market: opts.market || meta.market,
    dateLabel: formatDateLabel(asOf),
    justInTitle: "Just in",
    buyers: opts.buyers.map((row) => ({ ...row })),
    justIn,
    stillAhead: [],
    captionWhatsNew: justIn.map(formatJustInLine).join("; "),
    logoData: opts.logoData ?? null,
    footer: "Thompson Communications",
    handle: "@ThompsonCompetitive_bot",
  };
}

export function sd30SampleCard(logoData: string | null = null): CompetitiveCard {
  return buildCompetitiveCard({
    slug: "mo-sd30",
    justIn: SD30_SAMPLE_JUST_IN.filter((buy) => inBroadcastWeek(buy.flightStart, SAMPLE_AS_OF)).map((row) => ({ ...row })),
    buyers: SD30_SAMPLE_BUYERS.map((row) => ({ ...row })),
    asOf: SAMPLE_AS_OF,
    logoData,
    market: "Springfield",
  });
}

export function raceSpendTotal(buyers: readonly BuyerRow[]): number {
  return buyers.reduce((sum, row) => sum + row.spend, 0);
}

export function affiliationTotals(buyers: readonly BuyerRow[]): AffiliationSlice[] {
  const dem = { spend: 0, grp: 0 };
  const gop = { spend: 0, grp: 0 };
  for (const row of buyers) {
    const bucket = row.side === "gop" ? gop : dem;
    bucket.spend += row.spend;
    bucket.grp += row.grp;
  }
  const parties = (side: Affiliation) =>
    buyers
      .filter((row) => (row.side === "gop" ? "gop" : "dem") === side)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 2)
      .map((row) => row.name)
      .join(" + ");
  return [
    { id: "dem", label: "Dem", parties: parties("dem"), spend: dem.spend, grp: dem.grp, color: DEM_CANDIDATE },
    { id: "gop", label: "GOP", parties: parties("gop"), spend: gop.spend, grp: gop.grp, color: GOP_CANDIDATE },
  ];
}

export function landscapeBuyers(buyers: readonly BuyerRow[], limit = 4): BuyerRow[] {
  return [...buyers].sort((a, b) => b.spend - a.spend).slice(0, limit);
}

export function maxSpend(buyers: readonly BuyerRow[]): number {
  return buyers.reduce((max, row) => Math.max(max, row.spend), 0);
}

export function maxGrp(buyers: readonly BuyerRow[]): number {
  return buyers.reduce((max, row) => Math.max(max, row.grp), 0);
}

/** Track fill in px. Uses raw values so rounding for labels cannot skew the bars. */
export function barWidth(value: number, max: number, track: number, minPx = 10): number {
  if (!(max > 0) || !(track > 0) || !(value > 0)) return 0;
  return Math.max(minPx, Math.round((value / max) * track));
}

export function competitiveCaption(card: CompetitiveCard): string {
  const lines = [
    `Just in · ${card.title} · ${card.market}`,
    ...card.justIn.map(formatJustInLine),
    "",
    ...card.buyers.map(
      (row) =>
        `${row.name} ${formatSpendExact(row.spend)} / ${formatGrp(row.grp)} GRP`,
    ),
    "",
    (() => {
      const [dem, gop] = affiliationTotals(card.buyers);
      const race = raceSpendTotal(card.buyers);
      return `DMA spend: Dem ${formatSpendExact(dem!.spend)} / GOP ${formatSpendExact(gop!.spend)}; race ${formatSpendExact(race)}; DMA GRP: Dem ${formatGrp(dem!.grp)} / GOP ${formatGrp(gop!.grp)}`;
    })(),
  ];
  return lines.join("\n");
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x4000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
  }
  return btoa(bin);
}

/** TCI wordmark only — PNG must be transparent. No disc or plate. */
export async function loadTciLogoDataUri(): Promise<string | null> {
  const href = new URL("./assets/tc-logo.png", import.meta.url);
  try {
    const { readFile } = await import("node:fs/promises");
    const bytes = new Uint8Array(await readFile(href));
    if (bytes.length < 32) return null;
    return `data:image/png;base64,${bytesToBase64(bytes)}`;
  } catch {
    try {
      const bytes = await Deno.readFile(href);
      return `data:image/png;base64,${bytesToBase64(bytes)}`;
    } catch {
      return null;
    }
  }
}
