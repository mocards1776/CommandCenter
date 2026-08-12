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
  map?: { x: number; y: number };
};

export type ConditionItem = {
  label: string;
  status: "new" | "recent" | "partial" | "original";
  detail: string;
};

export type NetScenario = {
  label: string;
  salePrice: number;
  realtorFeePct: number;
  realtorFee: number;
  estimatedNet: number;
  note: string;
  highlight?: boolean;
};

export type StoryChapter = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
  stat?: { value: string; label: string };
  visual?: "map" | "condition" | "schools" | "nets" | "none";
};

export type ClientStory = {
  slug: string;
  metaTitle: string;
  brand: string;
  brandTag: string;
  address: string;
  cityLine: string;
  heroLine: string;
  support: string;
  geo: { lat: number; lng: number; label: string };
  facts: { label: string; value: string }[];
  condition: ConditionItem[];
  schools: { name: string; grades: string; rating: number; miles: string }[];
  chapters: StoryChapter[];
  comps: StoryComp[];
  netScenarios: NetScenario[];
  valuation: {
    low: number;
    mid: number;
    high: number;
    offer: number;
    zest: number;
    thesis: string;
    recommendation: string;
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

/** Round to nearest dollar for fee math shown to clients. */
function fee(price: number, pct: number) {
  return Math.round(price * pct);
}

export const STORIES: Record<string, ClientStory> = {
  "1715-e-buena-vista": {
    slug: "1715-e-buena-vista",
    metaTitle: "1715 E. Buena Vista — Market Brief",
    brand: "Mark Turner Market Research",
    brandTag: "Independent housing brief",
    address: "1715 E. Buena Vista St",
    cityLine: "Springfield, MO 65804 · Ravenwood",
    heroLine: "The $230,000 offer is well below what this house should bring.",
    support:
      "A 1976 ranch with a brand-new roof, roughly half the home rebuilt open-concept, half new siding, and HVAC likely under ten years old. Nearby sales and estimates point much higher than this bid.",
    geo: {
      lat: 37.1323354,
      lng: -93.2652218,
      label: "1715 E Buena Vista St, Springfield, MO 65804",
    },
    facts: [
      { label: "Beds / baths", value: "3 / 2" },
      { label: "Size", value: "2,154 sq ft" },
      { label: "Lot", value: "0.30 acre" },
      { label: "Built", value: "1976 ranch" },
      { label: "Roof", value: "Brand new" },
      { label: "HVAC", value: "Under ~10 yrs" },
      { label: "Interior", value: "~½ open concept" },
      { label: "Siding", value: "~½ new" },
    ],
    condition: [
      {
        label: "Roof",
        status: "new",
        detail: "Full new roof after a tree hit the house — a major cost already paid.",
      },
      {
        label: "Open-concept half",
        status: "new",
        detail: "About half the home was rebuilt open and modern after that damage.",
      },
      {
        label: "Siding",
        status: "partial",
        detail: "Roughly half the outside has new siding.",
      },
      {
        label: "HVAC",
        status: "recent",
        detail: "Heating and cooling look recent — likely under ten years old.",
      },
      {
        label: "Other half",
        status: "original",
        detail: "The untouched side still has older layout and finishes.",
      },
      {
        label: "Crawl space",
        status: "original",
        detail: "Still a crawl-space ranch — worth a careful look, but not a reason to gift $50k+.",
      },
    ],
    schools: [
      { name: "Walt Disney Elementary", grades: "K–5", rating: 10, miles: "0.6 mi" },
      { name: "Cherokee Middle", grades: "6–8", rating: 8, miles: "1.8 mi" },
      { name: "Kickapoo High", grades: "9–12", rating: 8, miles: "1.7 mi" },
    ],
    chapters: [
      {
        id: "place",
        eyebrow: "Where it is",
        title: "A quiet Ravenwood street with strong schools.",
        body:
          "This home sits in Ravenwood on Springfield’s south side. Homes here tend to hold value. Schools nearby rate well. The lot is about a third of an acre with mature trees.",
        visual: "map",
        bullets: [
          "65804 homes have been selling in roughly ~10 days",
          "Typical sale price in the zip lately: around $291,000",
          "Yearly tax bill: about $1,990",
        ],
      },
      {
        id: "condition",
        eyebrow: "What was fixed",
        title: "The big-ticket items are already done.",
        body:
          "A tree damaged the house. That led to a brand-new roof and a rebuild of about half the home into open concept. About half the siding is new. The heating and cooling system looks recent. Buyers usually pay more for that kind of work — not less.",
        visual: "condition",
      },
      {
        id: "worth",
        eyebrow: "What it’s worth",
        title: "A fair range is about $275,000 to $345,000.",
        body:
          "Online estimates put the home near $305,000. Similar homes on the same street read about $310,000–$320,000. Updated homes nearby have sold higher. Given the new roof and remodel work, a mid-point near $310,000 is reasonable.",
        stat: { value: "$310k", label: "Best mid-point estimate" },
        visual: "schools",
      },
      {
        id: "offer",
        eyebrow: "The offer",
        title: "$230,000 is a low bid — even before realtor fees.",
        body:
          "Yes, this offer skips realtor commissions. That saves roughly $15,000–$19,000 compared with a normal listing. But the gap between $230,000 and a fair sale is much larger than that savings. You would still come out behind.",
        stat: { value: "−$80k", label: "Offer vs ~$310k mid-point" },
        visual: "nets",
      },
      {
        id: "call",
        eyebrow: "Bottom line",
        title: "Do not take $230,000.",
        body:
          "Unless you need to sell in a hurry for personal reasons, this price leaves too much money on the table. A stronger private sale, or a normal listing after realtor fees, should still net tens of thousands more.",
        bullets: [
          "Counter toward the mid-$200,000s or higher",
          "Or list near $300,000–$320,000 and negotiate",
          "Only accept $230,000 if speed matters more than price",
        ],
      },
    ],
    comps: [
      {
        address: "1703 E Buena Vista St",
        note: "Same street — closest match",
        beds: 4,
        baths: 2,
        sqft: 2057,
        price: 319700,
        priceLabel: money(319700) + " est.",
        kind: "estimate",
        map: { x: 42, y: 48 },
      },
      {
        address: "1725 E Buena Vista St",
        note: "Same street",
        beds: 3,
        baths: 3,
        sqft: 1900,
        price: 317900,
        priceLabel: money(317900),
        kind: "estimate",
        map: { x: 62, y: 46 },
      },
      {
        address: "1933 E Buena Vista St",
        note: "Updated home nearby — sold",
        beds: 4,
        baths: 3,
        sqft: 2874,
        price: 389000,
        priceLabel: money(389000),
        date: "Jun 2026",
        kind: "sold",
        map: { x: 78, y: 38 },
      },
      {
        address: "1880 E Cardinal St",
        note: "Larger updated home — sold",
        beds: 5,
        baths: 3.5,
        sqft: 4286,
        price: 435000,
        priceLabel: money(435000),
        date: "Oct 2025",
        kind: "sold",
        map: { x: 70, y: 62 },
      },
      {
        address: "1424 E Buena Vista St",
        note: "Old fixer — not a fair match",
        beds: 3,
        baths: 1,
        sqft: 1707,
        price: 115000,
        priceLabel: money(115000),
        date: "May 2025",
        kind: "sold",
        map: { x: 22, y: 55 },
      },
      {
        address: "4832 S Warwick Ave",
        note: "Similar size",
        beds: 3,
        baths: 2,
        sqft: 2018,
        price: 360100,
        priceLabel: money(360100) + " est.",
        kind: "estimate",
        map: { x: 55, y: 78 },
      },
    ],
    netScenarios: [
      {
        label: "Take the $230k offer",
        salePrice: 230000,
        realtorFeePct: 0,
        realtorFee: 0,
        estimatedNet: 230000,
        note: "No realtor. Fast, but far below market.",
        highlight: true,
      },
      {
        label: "Private sale at $280k",
        salePrice: 280000,
        realtorFeePct: 0,
        realtorFee: 0,
        estimatedNet: 280000,
        note: "No realtor. Still ~$50k more than the offer.",
      },
      {
        label: "List near mid-point",
        salePrice: 310000,
        realtorFeePct: 0.06,
        realtorFee: fee(310000, 0.06),
        estimatedNet: 310000 - fee(310000, 0.06),
        note: "Assumes ~6% total realtor cost. You still keep far more.",
      },
      {
        label: "Soft listing price",
        salePrice: 290000,
        realtorFeePct: 0.055,
        realtorFee: fee(290000, 0.055),
        estimatedNet: 290000 - fee(290000, 0.055),
        note: "Assumes ~5.5% total realtor cost on a softer price.",
      },
    ],
    valuation: {
      low: 275000,
      mid: 310000,
      high: 345000,
      offer: 230000,
      zest: 304900,
      thesis:
        "After the tree rebuild — new roof, open-concept half, partial new siding, and recent HVAC — a fair sale looks closer to $275,000–$345,000. The $230,000 offer sits well under that band.",
      recommendation:
        "Pass on $230,000 unless you must sell immediately. Even after typical realtor fees, a normal sale should put more money in your pocket.",
    },
    notebook: {
      title: "Simple math",
      paragraphs: [
        "What buyers nearby are paying: online tools say about $305,000. Homes on the same street look like $310,000–$320,000. We use a mid-point of about $310,000.",
        "What this offer pays: $230,000. That is about $80,000 under the mid-point — roughly 26% low.",
        "Realtor fees: a normal listing often costs about 5.5%–6% of the sale price in total commissions (shared across agents; exact splits vary). On a $310,000 sale, that is about $17,000–$19,000. On a $290,000 sale at 5.5%, about $16,000.",
        "Why “no realtor” does not rescue this offer: skipping a $17,000–$19,000 fee only helps if the sale price is close to fair value. Here the discount is much larger than the fee. Example: list at $310,000, pay 6% ($18,600), keep about $291,400 — still roughly $61,000 more than $230,000.",
        "Even a softer path wins: sell privately at $280,000 with no realtor and you are still about $50,000 ahead of this offer. List at $290,000 with 5.5% fees and keep about $274,000 — still about $44,000 ahead.",
        "What could still need work: the older half of the house, crawl space, and finishing touches. Those jobs matter, but they do not usually erase an $80,000 price gap.",
        "Recommendation: do not accept $230,000. Counter higher, seek another private buyer, or list. Choose $230,000 only if speed is the top goal.",
      ],
    },
    researchDate: "August 12, 2026",
    sources: [
      "Property condition notes (roof, remodel, siding, HVAC)",
      "Public estimate and tax data (Zillow)",
      "Recent area sales reported through public listing sites",
      "OpenStreetMap location · 65804 market snapshot",
    ],
  },
};

export function getStory(slug: string): ClientStory | null {
  return STORIES[slug] ?? null;
}

export const STORY_SLUGS = Object.keys(STORIES);
