/**
 * Scroll-story registry + content for client presentations.
 * Slug must match KNOWN_SLUGS in supabase/functions/story-link.
 */

export type StoryComp = {
  address: string;
  note: string;
  beds: number;
  baths: number;
  sqft: number;
  price: number | null;
  priceLabel: string;
  date?: string;
  kind: "sold" | "estimate" | "active";
};

export type StoryChapter = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  /** Optional supporting lines shown under the body */
  bullets?: string[];
  /** Optional big number callout */
  stat?: { value: string; label: string };
};

export type ClientStory = {
  slug: string;
  /** Client-facing metadata title */
  metaTitle: string;
  brand: string;
  address: string;
  cityLine: string;
  heroLine: string;
  support: string;
  facts: { label: string; value: string }[];
  chapters: StoryChapter[];
  comps: StoryComp[];
  valuation: {
    low: number;
    mid: number;
    high: number;
    offer: number;
    thesis: string;
  };
  notebook: {
    title: string;
    paragraphs: string[];
  };
  researchDate: string;
  sources: string[];
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const STORIES: Record<string, ClientStory> = {
  "1715-e-buena-vista": {
    slug: "1715-e-buena-vista",
    metaTitle: "1715 E. Buena Vista — Offer Brief",
    brand: "Command Center",
    address: "1715 E. Buena Vista St",
    cityLine: "Springfield, MO 65804 · Ravenwood / Southside",
    heroLine: "A $230,000 as-is offer against a ~$305k market read.",
    support:
      "Ranch home, 1976, 3 bed / 2 bath, 2,154 sq ft on a third of an acre. Off-market. No inspection contingency.",
    facts: [
      { label: "Beds / baths", value: "3 / 2" },
      { label: "Living area", value: "2,154 sq ft" },
      { label: "Lot", value: "0.30 ac · 13,016 sq ft" },
      { label: "Built", value: "1976 · ranch" },
      { label: "Foundation", value: "Crawl space" },
      { label: "HOA", value: "$2 / mo" },
      { label: "2025 taxes", value: "$1,990" },
      { label: "Schools", value: "Disney 10 · Cherokee 8 · Kickapoo 8" },
    ],
    chapters: [
      {
        id: "subject",
        eyebrow: "The house",
        title: "Quiet Ravenwood ranch with room to work.",
        body:
          "Long-held off-market home on E. Buena Vista: one story, wood-stove fireplace, stone/frame exterior, mature trees, circular drive. No recorded renovations — assume 1970s systems until proven otherwise. Kickapoo feeders and a silent-score neighborhood are the durable demand drivers.",
        bullets: [
          "Parcel 1918109019 · Lot 63, Ravenwood",
          "Assessed value jumped 21% into 2024–25 ($32,890 → $39,940)",
          "Rent read ~$1,900 / mo if held as a rental",
        ],
      },
      {
        id: "market",
        eyebrow: "The zip",
        title: "65804 clears fast and still favors sellers.",
        body:
          "July 2026 Zillow read on 65804: median sale about $291k, ~10 days on market, sale-to-list near 95%. Inventory is thin. That backdrop supports mid-$200ks for dated product — and makes a clean, cash-leaning as-is contract more attractive to a long-term owner than a retail listing slog.",
        stat: { value: "$291k", label: "65804 median sale (Jul 2026)" },
      },
      {
        id: "comps",
        eyebrow: "Comps",
        title: "Same street wants the high $200s to low $300s.",
        body:
          "Direct street estimates sit near $310–320k. Farther Ravenwood sales pull higher when updated or larger. The fixer at 1424 E. Buena Vista ($115k, May 2025) is a distress floor — not a peer for a livable 2,100 sq ft ranch.",
      },
      {
        id: "offer",
        eyebrow: "The offer",
        title: "Twenty-five points under the Zestimate is the cushion.",
        body:
          "Zestimate $304,900 (range $277k–$329k). Offer $230,000 is ~$75k under the point estimate and ~$47k under the low end — about $107 / sq ft versus a ~$142 / sq ft model. That haircut is the inspection.",
        stat: { value: "−24.5%", label: "Offer vs Zestimate" },
      },
      {
        id: "risk",
        eyebrow: "What can go wrong",
        title: "Age is the risk. Price is the hedge.",
        body:
          "Roof, HVAC, plumbing, electrical, crawl moisture, and cosmetic kitchen/bath work are the usual 1976 bill. A blunt rehab budget of $40k–$75k still leaves most paths under a mid-range ARV if the market read holds. Catastrophic foundation or mold would be the exception — not the base case.",
        bullets: [
          "Systems / roof / HVAC cluster: often $20k–$40k",
          "Kitchen + baths + floors: often $20k–$35k",
          "All-in near $280k still clears a $277k–$305k ARV band in the base case",
        ],
      },
      {
        id: "call",
        eyebrow: "Call",
        title: "Take the number. Underwrite the work.",
        body:
          "In a 10-day market, a $230k as-is write is a strong buy if title and insurance cooperate. The bet is not that the house is perfect — it is that almost any plausible repair stack is cheaper than giving back $50k–$75k of market cushion at the contract price.",
      },
    ],
    comps: [
      {
        address: "1703 E Buena Vista St",
        note: "Same street, same year, 4/2 — closest peer",
        beds: 4,
        baths: 2,
        sqft: 2057,
        price: 319700,
        priceLabel: money(319700) + " Zest.",
        kind: "estimate",
      },
      {
        address: "1725 E Buena Vista St",
        note: "Same street · 3 bed / 3 bath",
        beds: 3,
        baths: 3,
        sqft: 1900,
        price: 317900,
        priceLabel: money(317900),
        kind: "estimate",
      },
      {
        address: "1933 E Buena Vista St",
        note: "Updated Ravenwood contemporary — ceiling, not peer",
        beds: 4,
        baths: 3,
        sqft: 2874,
        price: 389000,
        priceLabel: money(389000),
        date: "Jun 2026",
        kind: "sold",
      },
      {
        address: "1880 E Cardinal St",
        note: "Larger updated walk-out nearby",
        beds: 5,
        baths: 3.5,
        sqft: 4286,
        price: 435000,
        priceLabel: money(435000),
        date: "Oct 2025",
        kind: "sold",
      },
      {
        address: "1424 E Buena Vista St",
        note: "1942 fixer — distress floor only",
        beds: 3,
        baths: 1,
        sqft: 1707,
        price: 115000,
        priceLabel: money(115000),
        date: "May 2025",
        kind: "sold",
      },
      {
        address: "4832 S Warwick Ave",
        note: "Similar size · newer (1980)",
        beds: 3,
        baths: 2,
        sqft: 2018,
        price: 360100,
        priceLabel: money(360100) + " Zest.",
        kind: "estimate",
      },
    ],
    valuation: {
      low: 260000,
      mid: 295000,
      high: 330000,
      offer: 230000,
      thesis:
        "As-is fair value lands roughly $260k–$330k depending on condition. $230k is a clear buy if major systems are merely tired, not failed.",
    },
    notebook: {
      title: "Notebook — inspection vs. haircut",
      paragraphs: [
        "Assumption on the table: waive inspection at $230,000. The market model says the house is worth about $277k–$329k in ordinary retail condition (Zestimate point $304,900). Same-street estimates cluster near $310k–$320k. Zip median sale is ~$291k with ~10 DOM.",
        "Haircut math: $75k under the Zestimate, $47k under the published low end, ~$61k under a blended mid of $291k. That is the contingency budget.",
        "What an inspection usually finds on a 1976 crawl-space ranch: aging roof, HVAC near end of life, GFCI/panel quirks, possible galvanized supply, moisture or insulation in the crawl, dated kitchen and baths. A stacked worst-reasonable bill of $40k–$75k still leaves all-in acquisition near or under the low-to-mid ARV band — especially if you keep cosmetic work on a rental schedule.",
        "When the thesis breaks: active foundation movement, widespread mold, or unpermitted structural work that insurers refuse. Those are low-base-rate events relative to “needs a roof and a furnace.” Title, flood/insurance bindability, and a walk-through for smell/soft floors remain the non-negotiables even without a formal inspection contingency.",
        "Bottom line: the $230k number already prices in a heavy repair day. Unless the house is structurally compromised, paying for surprises out of the discount is cheaper than losing the deal to a retail bidder at $280k+.",
      ],
    },
    researchDate: "August 12, 2026",
    sources: [
      "Zillow (Zestimate, tax history, school ratings)",
      "Redfin (tax history; estimate unavailable)",
      "SOMO MLS solds via public listing mirrors (1933 E Buena Vista, 1880 E Cardinal, 1424 E Buena Vista)",
      "65804 market snapshot via Zillow (Jul 2026)",
    ],
  },
};

export function getStory(slug: string): ClientStory | null {
  return STORIES[slug] ?? null;
}

export const STORY_SLUGS = Object.keys(STORIES);
