/**
 * Competitive intel card model for @ThompsonCompetitive_bot.
 *
 * Numbers are the filed buys — no letter grades, no invented ratings.
 * Display helpers only format; they do not change the underlying spend/GRP/CPP.
 */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export type BuyerRow = {
  id: string;
  name: string;
  spend: number;
  grp: number;
  cpp: number;
  color: string;
};

export type WhatsNewItem = {
  label: string;
  detail: string;
  color: string;
};

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
  whatsNew: WhatsNewItem[];
  stillAhead: AheadItem[];
  captionWhatsNew: string;
  logoData: string | null;
  footer: string;
  handle: string;
};

/** Springfield SD-30 snapshot Josh reviewed (Oct 6, 2026). */
export const SD30_SAMPLE_BUYERS: readonly BuyerRow[] = [
  { id: "fogle", name: "Fogle", spend: 453350, grp: 4873.5, cpp: 93, color: "#0A84FF" },
  { id: "stinnett", name: "Stinnett", spend: 253570, grp: 2766.6, cpp: 92, color: "#FF3B30" },
  { id: "forward", name: "Forward", spend: 162745, grp: 980.9, cpp: 166, color: "#64D2FF" },
  { id: "mscc", name: "MSCC", spend: 119310, grp: 642.6, cpp: 186, color: "#5E5CE6" },
];

export const SD30_SAMPLE_WHATS_NEW: readonly WhatsNewItem[] = [
  { label: "GRP rebuild", detail: "FCC×AD35 on all major TV", color: "#0A84FF" },
  { label: "KSPR dark", detail: "KYTV CPP — no FCC", color: "#FF3B30" },
  { label: "CPPs locked", detail: "$93 / $92 / $166 / $186", color: "#5E5CE6" },
];

export const SD30_SAMPLE_AHEAD: readonly AheadItem[] = [
  { text: "Verify remaining weeks on air", line: "Remaining weeks", sub: "still to verify" },
  { text: "FCC copies still lag", line: "FCC copies", sub: "still lag" },
  { text: "Radio / cable — no GRP in this book", line: "Radio / cable", sub: "no GRP in this book" },
];

export const SD30_CAPTION_WHATS_NEW =
  "GRP rebuild (FCC×AD35); KSPR dark @ KYTV CPP; market CPPs locked";

export function sd30SampleCard(logoData: string | null = null): CompetitiveCard {
  return {
    kicker: "COMPETITIVE",
    office: "Missouri Senate",
    race: "SD-30",
    title: "Missouri SD-30",
    market: "Springfield",
    dateLabel: "October 6, 2026",
    justInTitle: "Just in",
    buyers: SD30_SAMPLE_BUYERS.map((row) => ({ ...row })),
    whatsNew: SD30_SAMPLE_WHATS_NEW.map((row) => ({ ...row })),
    stillAhead: SD30_SAMPLE_AHEAD.map((row) => ({ ...row })),
    captionWhatsNew: SD30_CAPTION_WHATS_NEW,
    logoData,
    footer: "Thompson Communications",
    handle: "@ThompsonCompetitive_bot",
  };
}

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
    ...card.whatsNew.map((item) => `${item.label} — ${item.detail}`),
    "",
    ...card.buyers.map(
      (row) =>
        `${row.name} ${formatSpendExact(row.spend)} / ${formatGrp(row.grp)} GRP / ${formatCpp(row.cpp)} CPP`,
    ),
    "",
    `Still ahead: ${card.stillAhead.map((item) => item.text).join("; ")}`,
    `What’s new: ${card.captionWhatsNew}`,
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
