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
  /** Rough map offset from subject, in percent of the local map (x right, y down). */
  map?: { x: number; y: number };
};

export type ConditionItem = {
  label: string;
  status: "new" | "recent" | "partial" | "original";
  detail: string;
};

export type StoryChapter = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
  stat?: { value: string; label: string };
  visual?: "map" | "condition" | "schools" | "none";
};

export type ClientStory = {
  slug: string;
  metaTitle: string;
  brand: string;
  address: string;
  cityLine: string;
  heroLine: string;
  support: string;
  /** WGS84 for map embeds */
  geo: { lat: number; lng: number; label: string };
  facts: { label: string; value: string }[];
  condition: ConditionItem[];
  schools: { name: string; grades: string; rating: number; miles: string }[];
  chapters: StoryChapter[];
  comps: StoryComp[];
  valuation: {
    low: number;
    mid: number;
    high: number;
    offer: number;
    zest: number;
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
    heroLine: "$230,000 as-is — with a new roof, open-concept half, and recent HVAC.",
    support:
      "1976 ranch, 3 bed / 2 bath, 2,154 sq ft on a third of an acre. Tree damage forced a brand-new roof and rebuilt roughly half the house into open concept. Half the exterior has new siding. HVAC likely under ten years.",
    geo: {
      lat: 37.1323354,
      lng: -93.2652218,
      label: "1715 E Buena Vista St, Springfield, MO 65804",
    },
    facts: [
      { label: "Beds / baths", value: "3 / 2" },
      { label: "Living area", value: "2,154 sq ft" },
      { label: "Lot", value: "0.30 ac" },
      { label: "Built", value: "1976 · ranch" },
      { label: "Roof", value: "Brand new" },
      { label: "HVAC", value: "< 10 years" },
      { label: "Interior", value: "~½ open concept" },
      { label: "Siding", value: "~½ new" },
    ],
    condition: [
      {
        label: "Roof",
        status: "new",
        detail: "Replaced after a tree fell on the house — full new roof, not a patch.",
      },
      {
        label: "Open-concept half",
        status: "new",
        detail: "Roughly half the home rebuilt open and modern after the tree damage.",
      },
      {
        label: "Siding",
        status: "partial",
        detail: "About half the exterior has new siding; the rest is original.",
      },
      {
        label: "HVAC",
        status: "recent",
        detail: "Likely under ten years old — not a 1976 furnace waiting to die.",
      },
      {
        label: "Unrenovated half",
        status: "original",
        detail: "Remaining rooms still carry 1970s layout and finishes — the residual work.",
      },
      {
        label: "Crawl / systems",
        status: "original",
        detail: "Crawl-space ranch: moisture, plumbing, and panel quirks are the leftover risks.",
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
        eyebrow: "Location",
        title: "Ravenwood, south Springfield — quiet and convenient.",
        body:
          "E. Buena Vista sits in Ravenwood off Republic Road: mature trees, car-dependent but calm, Kickapoo feeders. The lot is about a third of an acre with a circular drive. This is not a flip-street — it’s a hold neighborhood.",
        visual: "map",
        bullets: [
          "Parcel · Lot 63, Ravenwood Sub",
          "Walk Score 43 · Noise score ~9.7/10",
          "2025 taxes $1,990 · HOA $2/mo",
        ],
      },
      {
        id: "condition",
        eyebrow: "Condition",
        title: "The expensive surprises already happened.",
        body:
          "A tree took out part of the house. Insurance-era work left a brand-new roof, roughly half the floor plan rebuilt as open concept, and about half the siding replaced. HVAC is probably under a decade old. What’s left is unfinished potential — not a full gut.",
        visual: "condition",
      },
      {
        id: "market",
        eyebrow: "The zip",
        title: "65804 still clears in about ten days.",
        body:
          "July 2026 Zillow read: median sale near $291k, ~10 days on market, sale-to-list around 95%. Updated product on good streets gets chased. An off-market as-is write at $230k skips the retail scrum.",
        stat: { value: "$291k", label: "65804 median sale (Jul 2026)" },
        visual: "schools",
      },
      {
        id: "offer",
        eyebrow: "The offer",
        title: "Twenty-five points under the model — with systems already paid.",
        body:
          "Zestimate sits near $305k ($277–$329k). Same-street peers read ~$310–$320k. At $230k you’re buying ~$107/sq ft against a ~$142/sq ft model — and you are not starting from a dead roof or dead HVAC.",
        stat: { value: "−24.5%", label: "Offer vs Zestimate" },
      },
      {
        id: "call",
        eyebrow: "Call",
        title: "Take $230k. The haircut still dwarfs the leftovers.",
        body:
          "Even if the original half needs paint, floors, bath refresh, and crawl work, that stack is usually far smaller than the $50k–$75k embedded in this price. Tree damage already forced the big-ticket spend.",
      },
    ],
    comps: [
      {
        address: "1703 E Buena Vista St",
        note: "Same street, same year — closest peer",
        beds: 4,
        baths: 2,
        sqft: 2057,
        price: 319700,
        priceLabel: money(319700) + " Zest.",
        kind: "estimate",
        map: { x: 42, y: 48 },
      },
      {
        address: "1725 E Buena Vista St",
        note: "Same street · 3/3",
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
        note: "Updated Ravenwood — sold Jun 2026",
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
        note: "Larger updated walk-out",
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
        note: "1942 fixer — floor, not peer",
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
        note: "Similar size · 1980",
        beds: 3,
        baths: 2,
        sqft: 2018,
        price: 360100,
        priceLabel: money(360100) + " Zest.",
        kind: "estimate",
        map: { x: 55, y: 78 },
      },
    ],
    valuation: {
      low: 275000,
      mid: 310000,
      high: 345000,
      offer: 230000,
      zest: 304900,
      thesis:
        "With a new roof, open-concept rebuild on half the house, partial new siding, and recent HVAC, as-is fair value likely sits nearer $275k–$345k. $230k is a clear buy — residual work is finishes and crawl, not catastrophe.",
    },
    notebook: {
      title: "Notebook — inspection vs. haircut",
      paragraphs: [
        "Assumption: waive inspection at $230,000. Market model without the remodel story already said ~$277k–$329k (Zestimate ~$305k). Same-street estimates ~$310–$320k. Condition update moves the realistic band up — call it roughly $275k–$345k depending on how the unrenovated half shows.",
        "What already got paid: brand-new roof after tree damage, roughly half the house rebuilt open concept, about half the siding new, HVAC likely under ten years. Those are the line items that usually wreck a 1976 as-is underwrite.",
        "What can still bite: crawl moisture, older plumbing/electrical on the untouched side, unfinished baths/kitchen zones, completing siding, cosmetic continuity between the new half and the old half. A blunt residual budget of $15k–$40k is more honest than the $40k–$75k full-systems stack we would have assumed before knowing about the tree rebuild.",
        "Haircut math still wins: $230k is ~$75k under the Zestimate and ~$45k+ under a conservative post-remodel low. Almost any inspection finding short of foundation failure or mold is cheaper than giving that cushion back.",
        "Bottom line: take the number. Title, insurance bindability, and a walk for smell/soft floors remain the non-negotiables — not a formal inspection contingency.",
      ],
    },
    researchDate: "August 12, 2026",
    sources: [
      "Owner/buyer condition notes (roof, open-concept half, siding, HVAC)",
      "Zillow (Zestimate, tax history, school ratings)",
      "SOMO MLS solds via public listing mirrors",
      "OpenStreetMap geocode · 65804 market snapshot Jul 2026",
    ],
  },
};

export function getStory(slug: string): ClientStory | null {
  return STORIES[slug] ?? null;
}

export const STORY_SLUGS = Object.keys(STORIES);
