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
  status: "new" | "recent" | "partial" | "original" | "concern";
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
    heroLine: "Mold and inspection risk change the math on $230,000.",
    support:
      "The house has real upgrades — new roof after a tree hit, about half rebuilt open-concept, half new siding, newer HVAC. It also has serious mold and inspection concerns. Those two stories pull the price in opposite directions.",
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
      { label: "Mold", value: "Major concern" },
      { label: "Inspection", value: "High risk" },
    ],
    condition: [
      {
        label: "Mold",
        status: "concern",
        detail:
          "This is the main issue. Mold can mean cleanup, dry-out, new insulation, and sometimes opening walls or the crawl. Buyers and lenders care a lot.",
      },
      {
        label: "Inspection risk",
        status: "concern",
        detail:
          "A normal inspection will dig into moisture, crawl space, air quality, and repairs. Surprises here can kill a full-price deal.",
      },
      {
        label: "Roof",
        status: "new",
        detail: "Full new roof after a tree hit the house — a big cost already paid.",
      },
      {
        label: "Open-concept half",
        status: "new",
        detail: "About half the home was rebuilt open and modern after that damage.",
      },
      {
        label: "Siding / HVAC",
        status: "partial",
        detail: "About half new siding. Heating and cooling look recent (likely under ten years).",
      },
      {
        label: "Crawl space",
        status: "concern",
        detail:
          "Crawl-space ranch + past water/tree damage is where mold often hides. This needs a hard look, not a shrug.",
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
        title: "A good street — that is not the problem.",
        body:
          "Ravenwood is a solid Springfield neighborhood with strong schools. Nearby homes support mid-$300,000 values when condition is clean. Location is not what is holding this deal back. Mold and inspection risk are.",
        visual: "map",
        bullets: [
          "65804 homes have been selling in about ~10 days",
          "Typical sale price in the zip: around $291,000",
          "Same-street peers often read near $310,000–$320,000 when healthy",
        ],
      },
      {
        id: "mold",
        eyebrow: "The real issue",
        title: "Mold and inspection risk have to lead the decision.",
        body:
          "If a buyer walks through with an inspector, mold and moisture are likely to show up as red flags. That can mean a lower price, big repair credits, or a canceled contract. An as-is offer with no inspection is the buyer saying: “I will take that risk.”",
        visual: "condition",
        bullets: [
          "Small / contained mold jobs often run a few thousand dollars",
          "Crawl-space or widespread mold can run into the tens of thousands",
          "Until someone measures the problem, the safe price assumes the worse case",
        ],
        stat: { value: "As-is", label: "Buyer is pricing unknown mold risk" },
      },
      {
        id: "condition",
        eyebrow: "What was fixed",
        title: "Upgrades help — they do not erase mold.",
        body:
          "New roof, open-concept rebuild, partial new siding, and newer HVAC are real value. They support a higher price if the house is clean. They do not cancel a mold problem. A buyer can love the kitchen and still walk over the crawl space.",
        visual: "none",
      },
      {
        id: "worth",
        eyebrow: "Two price stories",
        title: "Clean house vs. problem house.",
        body:
          "If mold is minor and fixed, a fair sale still looks about $275,000–$345,000 (mid near $310,000). If mold is major and the sale is as-is, the honest range drops — closer to $230,000–$280,000 — because the next owner owns the cleanup and the unknown.",
        stat: { value: "$230–280k", label: "As-is range with serious mold risk" },
        visual: "schools",
      },
      {
        id: "offer",
        eyebrow: "The offer",
        title: "$230,000 is a risk price — not a retail price.",
        body:
          "This bid skips realtor fees and skips inspection. That only makes sense if the buyer expects expensive findings. Compared with a clean $310,000 sale, it looks low. Compared with “major mold, sell today, no inspection,” it is inside a hard as-is band — near the bottom, but not nonsense.",
        stat: { value: "−$80k", label: "vs clean mid-point · near as-is floor" },
        visual: "nets",
      },
      {
        id: "call",
        eyebrow: "Bottom line",
        title: "Get the mold facts. Then pick a lane.",
        body:
          "Do not accept or reject $230,000 in the dark. First decide how bad the mold is. If it is limited and fixable, counter higher or list. If it is widespread and you want out without repairs, $230,000 as-is becomes much more reasonable — especially with no realtor fee.",
        bullets: [
          "Best next step: mold inspection / crawl assessment with a real scope and cost",
          "If cleanup is small: counter toward the mid/high $200,000s or list near $300,000",
          "If cleanup is large and you will not fix it: $230,000 as-is can be a fair exit",
        ],
      },
    ],
    comps: [
      {
        address: "1703 E Buena Vista St",
        note: "Same street — closest match (healthy)",
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
        note: "Fixer sale — shows distress pricing",
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
        label: "Take $230k as-is (no realtor)",
        salePrice: 230000,
        realtorFeePct: 0,
        realtorFee: 0,
        estimatedNet: 230000,
        note: "Buyer eats mold/inspection risk. Fast exit.",
        highlight: true,
      },
      {
        label: "Private as-is at $260k",
        salePrice: 260000,
        realtorFeePct: 0,
        realtorFee: 0,
        estimatedNet: 260000,
        note: "Still as-is, but closer to a fair risk price.",
      },
      {
        label: "Fix mold, then list clean",
        salePrice: 310000,
        realtorFeePct: 0.06,
        realtorFee: fee(310000, 0.06),
        estimatedNet: 310000 - fee(310000, 0.06),
        note: "Gross keep ~$291k before mold repair cost. Subtract cleanup from this.",
      },
      {
        label: "List with issues disclosed",
        salePrice: 275000,
        realtorFeePct: 0.055,
        realtorFee: fee(275000, 0.055),
        estimatedNet: 275000 - fee(275000, 0.055),
        note: "Assumes buyers discount for known problems; ~5.5% fees.",
      },
    ],
    valuation: {
      low: 230000,
      mid: 310000,
      high: 345000,
      offer: 230000,
      zest: 304900,
      thesis:
        "Mold and inspection risk split this into two bands. Clean / fixed: about $275,000–$345,000 (mid near $310,000). As-is with major mold: about $230,000–$280,000. The $230,000 offer is the floor of that as-is band — harsh if mold is small, fairer if mold is large and unresolved.",
      recommendation:
        "Get a mold/crawl scope before you answer $230,000. If mold is major and you will sell as-is, this offer is in range. If mold is limited, push for more money.",
    },
    notebook: {
      title: "Simple math with mold in the room",
      paragraphs: [
        "Healthy-house story: nearby sales and estimates still point near $305,000–$320,000. New roof and remodel support that — if the house is clean.",
        "Problem-house story: major mold plus a tough inspection changes who will buy and what they will pay. Many retail buyers drop out. Investors and as-is buyers stay, and they discount hard.",
        "What mold can cost: small jobs may be a few thousand dollars. Crawl-space or widespread mold can land in the $15,000–$40,000+ range once you add dry-out, remediation, insulation, and repairs. Until you have a written scope, assume the buyer is pricing something ugly.",
        "Offer at $230,000 with no inspection and no realtor: that is a risk-transfer price. It is about $80,000 under a clean mid-point — and near the floor of a serious as-is band ($230,000–$280,000).",
        "Realtor fees still matter on the other path: list clean at $310,000 with ~6% fees and you keep about $291,000 — but only after you pay to fix mold (and only if the house then appraises/inspects clean). If cleanup costs $25,000, your net is closer to $266,000. If cleanup costs $50,000, your net is closer to $241,000 — near this offer.",
        "So the fork is simple: (1) Learn the mold cost. (2) If cheap to fix, do not take $230,000 — counter or list. (3) If expensive and you will not fix it, $230,000 as-is can be a rational exit, not a gift.",
        "Recommendation: get a mold/crawl assessment first. Let that number choose between “counter higher” and “take the sure as-is check.”",
      ],
    },
    researchDate: "August 12, 2026",
    sources: [
      "Property condition notes (roof, remodel, siding, HVAC, mold/inspection concerns)",
      "Public estimate and tax data (Zillow)",
      "Recent area sales reported through public listing sites",
      "Typical residential mold remediation cost ranges (industry ballparks; not a quote)",
    ],
  },
};

export function getStory(slug: string): ClientStory | null {
  return STORIES[slug] ?? null;
}

export const STORY_SLUGS = Object.keys(STORIES);
