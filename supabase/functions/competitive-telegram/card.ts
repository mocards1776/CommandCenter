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
  /** Caption only: true when every this-week row for this sponsor is radio. */
  radioOnly?: boolean;
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
  /** Primary / first call sign. Prefer `stations` + `stationGroup` for the note. */
  station: string;
  /** Call signs in this station group, spend-desc then alpha. */
  stations?: string[];
  /** Almanac station_groups.name, else stations.owner_group. */
  stationGroup?: string;
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
  /** `Week 4` or `Week 0 (Election Day)` — header + caption. */
  weekNumberLabel: string;
  justInTitle: string;
  buyers: BuyerRow[];
  /** This-week (Tue–Mon) sponsor totals for the caption. Image tiles stay race-to-date. */
  weekBuyers: BuyerRow[];
  weekLabel: string;
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
  { id: "forward-pac", name: "Forward PAC", spend: 162745, grp: 980.9, cpp: 166, color: DEM_PAC, side: "dem" },
  { id: "missouri-senate-campaign-committee", name: "Missouri Senate Campaign Committee", spend: 119310, grp: 642.6, cpp: 186, color: GOP_PAC, side: "gop" },
];

/**
 * Current Almanac week (Tue 10/6–Mon 10/12) KYTV Just In — not last week's
 * Fogle $70,420 / 939 GRP flight that started 9/29.
 * MSCC KYTV $47,440 / 274.8 GRP (filed 10/5); Fogle KYTV $32,300 / 358.9 GRP (10/6).
 */
export const SD30_SAMPLE_JUST_IN: readonly JustInBuy[] = [
  {
    id: "a59019d1-ff74-46d4-b119-b1e78c0dce09",
    sponsor: "Missouri Senate Campaign Committee",
    amount: 47440,
    market: "Springfield",
    media: "TV",
    station: "KYTV",
    stations: ["KYTV"],
    stationGroup: "Gray Media",
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
    stations: ["KYTV"],
    stationGroup: "Gray Media",
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
export const CHICAGO_TZ = "America/Chicago";
/** Almanac Tuesday week of election day — Week 0. */
export const ELECTION_DAY = "2026-11-03";

const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Almanac media-buy week is Tuesday–Monday. Caption "This week" uses this window. */
export function almanacWeekBounds(asOf = SAMPLE_AS_OF): { start: string; end: string } {
  const [y, m, d] = asOf.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d));
  const dow = date.getUTCDay();
  const back = (dow - 2 + 7) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  const start = ymd(date);
  date.setUTCDate(date.getUTCDate() + 6);
  return { start, end: ymd(date) };
}

/** @deprecated Almanac weeks are Tuesday–Monday; alias kept for older tests. */
export function broadcastWeekBounds(asOf = SAMPLE_AS_OF): { start: string; end: string } {
  return almanacWeekBounds(asOf);
}

export function inAlmanacWeek(flightStart: string | undefined, asOf = SAMPLE_AS_OF): boolean {
  if (!flightStart) return false;
  const { start, end } = almanacWeekBounds(asOf);
  return flightStart >= start && flightStart <= end;
}

export function inBroadcastWeek(flightStart: string | undefined, asOf = SAMPLE_AS_OF): boolean {
  return inAlmanacWeek(flightStart, asOf);
}

/** YYYY-MM-DD for `now` in America/Chicago — the day the update is sent. */
export function chicagoToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((part) => part.type === "year")?.value;
  const m = parts.find((part) => part.type === "month")?.value;
  const d = parts.find((part) => part.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

function daysBetween(start: string, end: string): number {
  return Math.round((utcDate(end).getTime() - utcDate(start).getTime()) / 86_400_000);
}

/** `floor((election_date - week_start_date) / 7)` on Almanac Tuesday weeks. */
export function electionWeekNumber(weekStart: string, electionDay = ELECTION_DAY): number {
  return Math.floor(daysBetween(weekStart, electionDay) / 7);
}

/** `Week 4`, or `Week 0 (Election Day)` from Nov 3 onward. */
export function formatElectionWeekLabel(weekStart: string, electionDay = ELECTION_DAY): string {
  const n = electionWeekNumber(weekStart, electionDay);
  if (n <= 0) return "Week 0 (Election Day)";
  return `Week ${n}`;
}

function formatWeekRange(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  const a = `${SHORT_MONTH[(sm ?? 1) - 1]} ${sd}`;
  const b = sm === em ? String(ed) : `${SHORT_MONTH[(em ?? 1) - 1]} ${ed}`;
  return `${a}–${b}`;
}

/** "This week · Week 4 (Oct 6–12):" */
export function formatWeekCaptionLabel(start: string, end: string): string {
  const week = formatElectionWeekLabel(start);
  if (week === "Week 0 (Election Day)") return `This week · ${week}:`;
  return `This week · ${week} (${formatWeekRange(start, end)}):`;
}

export function displayMedia(media: string): string {
  const key = media.trim().toLowerCase();
  if (key === "broadcast" || key === "tv") return "TV";
  if (key === "radio") return "radio";
  if (key === "cable") return "cable";
  return media || "TV";
}

/** Call signs for the Just In note — drop leftover "{market} DMA" labels. */
export function justInCallSigns(buy: Pick<JustInBuy, "station" | "stations">): string[] {
  const raw = buy.stations?.length ? buy.stations : buy.station ? [buy.station] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    const call = String(value ?? "").trim();
    if (!call || /DMA$/i.test(call) || seen.has(call)) continue;
    seen.add(call);
    out.push(call);
  }
  return out;
}

/** Card note: `Gray Media · KSPR added` or `KSPR added` when no group. */
export function formatJustInNote(buy: JustInBuy): string {
  const calls = justInCallSigns(buy).join(", ");
  const group = String(buy.stationGroup ?? "").trim();
  if (group && calls) return `${group} · ${calls} added`;
  if (calls) return `${calls} added`;
  return "";
}

/** Caption parenthetical: `Gray Media · KSPR` (no trailing "added"). */
export function formatJustInCaptionNote(buy: JustInBuy): string {
  const calls = justInCallSigns(buy).join(", ");
  const group = String(buy.stationGroup ?? "").trim();
  if (group && calls) return `${group} · ${calls}`;
  return calls || group;
}

/** "Missouri Senate Campaign Committee added $47,440 in Springfield TV for 274.8 GRP (Gray Media · KYTV)" */
export function formatJustInLine(buy: JustInBuy): string {
  const base = `${buy.sponsor} added ${formatSpendExact(buy.amount)} in ${buy.market} ${displayMedia(buy.media)} for ${formatGrp(buy.grp)} GRP`;
  const note = formatJustInCaptionNote(buy);
  return note ? `${base} (${note})` : base;
}

/** Caption "This week" line. Never prints `0 GRP`. */
export function formatWeekBuyerLine(row: BuyerRow): string {
  const spend = formatSpendExact(row.spend);
  if (row.grp > 0) return `${row.name} ${spend} / ${formatGrp(row.grp)} GRP`;
  if (row.radioOnly) return `${row.name} ${spend} (radio)`;
  return `${row.name} ${spend}`;
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
  weekBuyers?: BuyerRow[];
  asOf?: string;
  logoData?: string | null;
  market?: string;
}): CompetitiveCard {
  const asOf = opts.asOf ?? SAMPLE_AS_OF;
  const week = almanacWeekBounds(asOf);
  const meta = raceMeta(opts.slug, opts.market ?? opts.justIn[0]?.market ?? opts.buyers[0]?.name ?? "");
  const justIn = opts.justIn.map((row) => ({ ...row, media: displayMedia(row.media) }));
  return {
    kicker: "COMPETITIVE",
    office: meta.office,
    race: meta.race,
    title: meta.title,
    market: opts.market || meta.market,
    dateLabel: formatDateLabel(asOf),
    weekNumberLabel: formatElectionWeekLabel(week.start),
    justInTitle: "Just in",
    buyers: opts.buyers.map((row) => ({ ...row })),
    weekBuyers: (opts.weekBuyers ?? []).filter((row) => row.spend > 0 || row.grp > 0).map((row) => ({ ...row })),
    weekLabel: formatWeekCaptionLabel(week.start, week.end),
    justIn,
    stillAhead: [],
    captionWhatsNew: justIn.map(formatJustInLine).join("; "),
    logoData: opts.logoData ?? null,
    footer: "Thompson Communications",
    handle: "@ThompsonCompetitive_bot",
  };
}

/**
 * This-week sample for the SD-30 preview. Flights match the Oct 6 book
 * (Fogle 9/29–10/12, Forward 10/3–10/12, Stinnett 10/5–10/18, MSCC 10/5–10/11).
 * Image tiles stay race-to-date; only the caption uses these.
 */
export const SD30_SAMPLE_WEEK_BUYERS: readonly BuyerRow[] = [
  { id: "fogle-week", name: "Fogle", spend: 54036, grp: 648, cpp: 0, color: DEM_CANDIDATE, side: "dem" },
  { id: "forward-week", name: "Forward PAC", spend: 121287, grp: 735, cpp: 0, color: DEM_PAC, side: "dem" },
  { id: "stinnett-week", name: "Stinnett", spend: 37878, grp: 507, cpp: 0, color: GOP_CANDIDATE, side: "gop" },
  { id: "mscc-week", name: "Missouri Senate Campaign Committee", spend: 45908, grp: 279, cpp: 0, color: GOP_PAC, side: "gop" },
  { id: "legio-week", name: "Legio XIII PAC", spend: 16941, grp: 0, cpp: 0, color: GOP_PAC, side: "gop", radioOnly: true },
];

export function sd30SampleCard(logoData: string | null = null): CompetitiveCard {
  return buildCompetitiveCard({
    slug: "mo-sd30",
    justIn: SD30_SAMPLE_JUST_IN.map((row) => ({ ...row })),
    buyers: SD30_SAMPLE_BUYERS.map((row) => ({ ...row })),
    weekBuyers: SD30_SAMPLE_WEEK_BUYERS.map((row) => ({ ...row })),
    asOf: SAMPLE_AS_OF,
    logoData,
    market: "Springfield",
  });
}

/** Live SD-8 snapshot from the Oct 7 card Josh marked up. */
export const SD8_SAMPLE_BUYERS: readonly BuyerRow[] = [
  { id: "sdcc", name: "Senate Democratic Campaign Committee", spend: 707900, grp: 1429.7, cpp: 0, color: DEM_PAC, side: "dem" },
  { id: "patterson", name: "Patterson", spend: 462656, grp: 1811.4, cpp: 0, color: GOP_CANDIDATE, side: "gop" },
  { id: "alliance", name: "Missouri Alliance PAC", spend: 388125, grp: 983.9, cpp: 0, color: GOP_PAC, side: "gop" },
  { id: "ingle", name: "Ingle", spend: 229455, grp: 1608.8, cpp: 0, color: DEM_CANDIDATE, side: "dem" },
  { id: "wotp", name: "Will of the People PAC", spend: 2572, grp: 0, cpp: 0, color: DEM_PAC, side: "dem" },
];

export const SD8_SAMPLE_JUST_IN: readonly JustInBuy[] = [
  {
    id: "sd8-ingle-just",
    sponsor: "Keri Ingle",
    amount: 7080,
    market: "Kansas City",
    media: "TV",
    station: "WDAF",
    stations: ["WDAF"],
    stationGroup: "Nexstar Media Group",
    grp: 28.2,
    color: DEM_CANDIDATE,
    flightStart: "2026-10-06",
  },
];

export const SD8_SAMPLE_WEEK_BUYERS: readonly BuyerRow[] = [
  { id: "sdcc-week", name: "Senate Democratic Campaign Committee", spend: 103321, grp: 221.9, cpp: 0, color: DEM_PAC, side: "dem" },
  { id: "alliance-week", name: "Missouri Alliance PAC", spend: 75351, grp: 188, cpp: 0, color: GOP_PAC, side: "gop" },
  { id: "patterson-week", name: "Patterson", spend: 57331, grp: 250.2, cpp: 0, color: GOP_CANDIDATE, side: "gop" },
  { id: "ingle-week", name: "Ingle", spend: 7080, grp: 28.2, cpp: 0, color: DEM_CANDIDATE, side: "dem" },
];

export function sd8SampleCard(logoData: string | null = null): CompetitiveCard {
  return buildCompetitiveCard({
    slug: "mo-sd8",
    justIn: SD8_SAMPLE_JUST_IN.map((row) => ({ ...row })),
    buyers: SD8_SAMPLE_BUYERS.map((row) => ({ ...row })),
    weekBuyers: SD8_SAMPLE_WEEK_BUYERS.map((row) => ({ ...row })),
    asOf: SAMPLE_AS_OF,
    logoData,
    market: "Kansas City",
  });
}

/** Live Oct 7 MSCC KSPR revision Josh marked up: +$3,570 / +25.3 GRP. */
export const SD30_KSPR_REVISION_JUST_IN: readonly JustInBuy[] = [
  {
    id: "a9bb199c-240f-42a7-84f6-3533aaf8451d",
    sponsor: "Missouri Senate Campaign Committee",
    amount: 3570,
    market: "Springfield",
    media: "TV",
    station: "KSPR",
    stations: ["KSPR"],
    stationGroup: "Gray Media",
    grp: 25.3,
    color: GOP_PAC,
    flightStart: "2026-10-05",
  },
];

export function sd30KsprRevisionCard(logoData: string | null = null): CompetitiveCard {
  return buildCompetitiveCard({
    slug: "mo-sd30",
    justIn: SD30_KSPR_REVISION_JUST_IN.map((row) => ({ ...row })),
    buyers: SD30_SAMPLE_BUYERS.map((row) => ({ ...row })),
    weekBuyers: SD30_SAMPLE_WEEK_BUYERS.map((row) => ({ ...row })),
    asOf: "2026-10-07",
    logoData,
    market: "Springfield",
  });
}

/** One Gray tile listing KYTV + KSPR when the same send covers both. */
export const SD30_GRAY_TWO_STATION_JUST_IN: readonly JustInBuy[] = [
  {
    id: "mscc-gray",
    sponsor: "Missouri Senate Campaign Committee",
    amount: 51010,
    market: "Springfield",
    media: "TV",
    station: "KYTV",
    stations: ["KYTV", "KSPR"],
    stationGroup: "Gray Media",
    grp: 300.1,
    color: GOP_PAC,
    flightStart: "2026-10-05",
  },
];

export function sd30GrayTwoStationCard(logoData: string | null = null): CompetitiveCard {
  return buildCompetitiveCard({
    slug: "mo-sd30",
    justIn: SD30_GRAY_TWO_STATION_JUST_IN.map((row) => ({ ...row })),
    buyers: SD30_SAMPLE_BUYERS.map((row) => ({ ...row })),
    weekBuyers: SD30_SAMPLE_WEEK_BUYERS.map((row) => ({ ...row })),
    asOf: "2026-10-07",
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
  const [dem, gop] = affiliationTotals(card.buyers);
  const race = raceSpendTotal(card.buyers);
  const lines = [
    `Just in · ${card.title} · ${card.market}`,
    ...card.justIn.map(formatJustInLine),
    "",
    card.weekLabel,
    ...card.weekBuyers.map(formatWeekBuyerLine),
    "",
    `Race to date: Dem ${formatSpendExact(dem!.spend)} / GOP ${formatSpendExact(gop!.spend)}; race ${formatSpendExact(race)}; DMA GRP: Dem ${formatGrp(dem!.grp)} / GOP ${formatGrp(gop!.grp)}`,
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
