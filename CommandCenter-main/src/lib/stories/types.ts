/**
 * Scroll-story registry + content for client presentations.
 * Slug must match KNOWN_SLUGS in supabase/functions/story-link.
 */

import { FYAN_STORY } from "./fyan";

export type StoryComp = {
  address: string;
  note: string;
  beds: number;
  baths: number;
  sqft: number;
  /** When set, notebook / land briefs show acres instead of beds·baths·sqft */
  acres?: number;
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

export type RepairEstimate = {
  issue: string;
  low: number;
  high: number;
  note: string;
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

export type ProceedsOption = {
  title: string;
  summary: string;
  detail: string;
};

export type CompareCard = {
  title: string;
  cost: string;
  answers: string;
  doesNot: string;
};

export type RepairOdds = {
  amount: number;
  pct: number;
  note?: string;
  /** What would have to be wrong for spend to reach this level */
  wrongIf?: string;
};

export type DistrictMapSpec = {
  id: string;
  title: string;
  years: string;
  congress: string;
  counties: string[];
  note: string;
  /** Lewis/Martis county-fill plan: 48th, 50th–52nd, or 53rd (15 seats). */
  plan?: "48" | "50" | "53";
};

export type VoteRow = {
  period: string;
  eligible: number;
  missed: number;
  pct: number;
  percentile?: string;
};

export type ElectionRow = {
  year: string;
  date: string;
  result: "won" | "lost" | "out" | "retired";
  headline: string;
  detail: string;
};

export type BillVote = {
  date: string;
  congress: string;
  cast: "Yea" | "Nay" | "Absent";
  bill: string;
  note: string;
};

export type StoryChapter = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
  stat?: { value: string; label: string };
  visual?:
    | "map"
    | "condition"
    | "schools"
    | "nets"
    | "repairs"
    | "proceeds"
    | "options"
    | "compare"
    | "odds"
    | "districtMap"
    | "votes"
    | "family"
    | "portrait"
    | "elections"
    | "bills"
    | "none";
};

export type ClientStory = {
  slug: string;
  metaTitle: string;
  brand: string;
  brandTag: string;
  markSrc: string;
  /** property = house brief; proceeds = sale-money / control; land = acreage / FMV brief; portrait = family / biography */
  layout: "property" | "proceeds" | "land" | "portrait";
  portraitSrc?: string;
  portraitCredit?: string;
  districtMaps?: DistrictMapSpec[];
  voteRows?: VoteRow[];
  electionRows?: ElectionRow[];
  billVotes?: BillVote[];
  family?: { names: string; relation: string; body: string };
  cover: {
    display: string;
    sub: string;
    meta: string;
    statValue: string;
    statLabel: string;
    compareWarn: string;
    compareGood: string;
  };
  address: string;
  cityLine: string;
  heroLine: string;
  support: string;
  /** Big numbers strip under the hero (optional) */
  keyNumbers?: { label: string; value: string; tone?: "warn" | "good" | "neutral" }[];
  /** Hard callouts to reduce repeat questions */
  callouts?: { title: string; body: string }[];
  compareCards?: CompareCard[];
  /** Estimated P(repair spend ≥ amount) — judgment, not a bid */
  repairOdds?: RepairOdds[];
  geo: { lat: number; lng: number; label: string };
  facts: { label: string; value: string }[];
  condition: ConditionItem[];
  repairs: RepairEstimate[];
  proceedsOptions: ProceedsOption[];
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

const LIST_CLEAN = 310000;
const LIST_FEE = 0.06;
const LIST_NET_BEFORE_REPAIRS = LIST_CLEAN - fee(LIST_CLEAN, LIST_FEE); // ~291400
const OFFER_AS_IS = 230000;
const BREAKEVEN_REPAIRS = LIST_NET_BEFORE_REPAIRS - OFFER_AS_IS; // ~61400

export const STORIES: Record<string, ClientStory> = {
  "1715-e-buena-vista": {
    slug: "1715-e-buena-vista",
    metaTitle: "1715 E. Buena Vista — Market Brief",
    brand: "Mark Turner Market Research",
    brandTag: "Independent housing brief",
    markSrc: "/brand/mark-turner-market.png",
    layout: "property",
    cover: {
      display: "Buena Vista",
      sub: "$230k as-is vs ~$310k clean",
      meta: "1715 E. Buena Vista St · Springfield, MO 65804",
      statValue: "−$80k",
      statLabel: "gap · offer vs clean mid",
      compareWarn: "$230,000 as-is · no inspection",
      compareGood: "clean mid ~$310,000",
    },
    address: "1715 E. Buena Vista St",
    cityLine: "Springfield, MO 65804 · Ravenwood",
    heroLine: "Big numbers first: $230,000 as-is offer · ~$310,000 clean mid · about $61,000 of repairs before $230k wins on math.",
    support:
      "Tree damage, weather exposure, and a tougher inspection are why the offer is low. Your private inspection is for you — this as-is buyer is not owed that report.",
    keyNumbers: [
      { label: "As-is offer", value: "$230,000", tone: "warn" },
      { label: "Clean mid", value: "~$310,000", tone: "good" },
      { label: "Gap", value: "−$80,000", tone: "warn" },
      { label: "Break-even repairs", value: "~$61,000", tone: "neutral" },
      { label: "Private inspection", value: "~$400–$900", tone: "neutral" },
      { label: "Private appraisal", value: "~$350–$600", tone: "neutral" },
      { label: "65804 days on market", value: "~30 days", tone: "good" },
    ],
    callouts: [
      {
        title: "This as-is buyer is not owed your inspection",
        body:
          "They waived inspection and buy as-is. Your private report is yours — for deciding whether $230,000 is smart. You do not have to hand it to them. (A later retail listing is different: then plan to share what you know.)",
      },
      {
        title: "Hammer the math",
        body:
          "List near $310,000 with ~6% fees ≈ $291,000 before repairs. $230,000 as-is has $0 realtor fee. Headroom ≈ $61,000. Under that in fixes → counter or list. Over that (and you will not fix) → $230k can win.",
      },
    ],
    compareCards: [
      {
        title: "Home inspection",
        cost: "~$350–$550 · package ~$400–$900",
        answers: "What is wrong / what may cost money (condition)",
        doesNot: "Does not set the sale price",
      },
      {
        title: "Appraisal",
        cost: "~$350–$600 typical",
        answers: "What the house is worth in today’s market (value opinion)",
        doesNot: "Does not find crawl / moisture problems for you",
      },
    ],
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
      { label: "Tree damage", value: "Catastrophic · rebuilt" },
      { label: "Private inspection", value: "~$350–$550" },
    ],
    condition: [
      {
        label: "Tree / weather exposure",
        status: "concern",
        detail:
          "The house was open after a catastrophic tree hit. Even with a rebuild, inspectors look hard at what water and weather may have done in the crawl, walls, and insulation.",
      },
      {
        label: "Age-related systems",
        status: "partial",
        detail:
          "1976 ranch means some original pieces can still hide behind the remodel — plumbing, wiring, vapor barrier, foundation vents. Normal for the era; still on an inspector’s checklist.",
      },
      {
        label: "Roof",
        status: "new",
        detail: "Full new roof after the tree — a major cost already behind you.",
      },
      {
        label: "Open-concept half",
        status: "new",
        detail: "About half the home was rebuilt open and modern after the damage.",
      },
      {
        label: "Siding / HVAC",
        status: "partial",
        detail: "About half new siding. Heating and cooling look recent (likely under ten years).",
      },
      {
        label: "Moisture / mold risk",
        status: "concern",
        detail:
          "One common leftover after weather exposure — not unique to this house, but worth pricing. Can be a small cleanup or a bigger crawl/insulation job.",
      },
    ],
    repairs: [
      {
        issue: "Moisture / mold (contained)",
        low: 2500,
        high: 8000,
        note: "Spot cleanup, dry-out, limited materials",
      },
      {
        issue: "Moisture / mold (crawl or widespread)",
        low: 15000,
        high: 40000,
        note: "Remediation, insulation, vapor work, repairs",
      },
      {
        issue: "Crawl space / vapor / insulation",
        low: 4000,
        high: 18000,
        note: "Common on ranches after water exposure",
      },
      {
        issue: "Electrical or plumbing catch-up",
        low: 2000,
        high: 12000,
        note: "Age + remodel transitions",
      },
      {
        issue: "Finish / cosmetic punch list",
        low: 3000,
        high: 15000,
        note: "Older half, trim, paint, small systems",
      },
      {
        issue: "Stack of “a few things”",
        low: 15000,
        high: 35000,
        note: "Typical bundled inspection fallout — not a disaster",
      },
    ],
    proceedsOptions: [],
    schools: [
      { name: "Walt Disney Elementary", grades: "K–5", rating: 10, miles: "0.6 mi" },
      { name: "Cherokee Middle", grades: "6–8", rating: 8, miles: "1.8 mi" },
      { name: "Kickapoo High", grades: "9–12", rating: 8, miles: "1.7 mi" },
    ],
    chapters: [
      {
        id: "numbers",
        eyebrow: "The numbers",
        title: "Three figures decide most of this.",
        body:
          "$230,000 is the as-is offer (no inspection, no realtor). ~$310,000 is the clean mid-point from nearby comps. ~$61,000 is how much repair spend it takes before the list path falls behind $230k after fees.",
        visual: "none",
        bullets: [
          "$230,000 — as-is offer on the table",
          "~$310,000 — clean mid (nearby peers often ~$305k–$320k)",
          "−$80,000 — gap vs clean mid",
          `~${money(BREAKEVEN_REPAIRS)} — repair headroom before $230k ties a clean list (~$310k − 6% fees ≈ ${money(LIST_NET_BEFORE_REPAIRS)})`,
          "As-is band if risk stays unresolved: about $230,000–$280,000",
          "Clean / fixed band: about $275,000–$345,000",
        ],
        stat: { value: "−$80k", label: "Offer vs clean mid — the gap to beat" },
      },
      {
        id: "place",
        eyebrow: "Where it is",
        title: "Location supports the mid-$300,000s when clean.",
        body:
          "Ravenwood / 65804 is solid. Schools are strong. Same-street peers often read near $310,000–$320,000 when the house shows clean. The street is not the problem — leftover post-tree risk is.",
        visual: "map",
        bullets: [
          "65804 median days on market recently ~30 days (not months)",
          "Springfield metro median days on market ~44 days",
          "Typical sale price in the zip: around $291,000",
          "Healthy comps nearby still cluster in the low-to-mid $300,000s",
        ],
      },
      {
        id: "tempo",
        eyebrow: "Are houses sitting?",
        title: "More listings ≠ a dead market.",
        body:
          "You may hear “nothing is moving.” Citywide, inventory is higher than a year ago, so the street can feel slower. The market report still shows homes trading — not freezing. In 65804, median time on market has recently been about ~30 days. Springfield metro sits around ~44 days. That is weeks, not a year on the lawn. Sale-to-list prices near asking also say buyers are still closing deals.",
        visual: "none",
        bullets: [
          "65804: median days on market ≈ 30 days (recent Realtor.com zip read)",
          "Springfield metro: median days on market ≈ 44 days (Jun 2026)",
          "Citywide active listings up sharply YoY — more choice, so it can feel “stuck” even while sales continue",
          "Sale-to-list near ~100% recently — not a fire-sale market",
          "What people notice: more for-sale signs + some price cuts (~20%+ of listings in some local reads)",
          "What the data still says: median homes are going pending in about a month in 65804",
          "For this offer: market tempo does not erase the −$80k gap or the ~$61k repair break-even math",
        ],
        stat: { value: "~30 days", label: "65804 median days on market · still turning over" },
      },
      {
        id: "risk",
        eyebrow: "Why the offer is low",
        title: "Open to the weather = tougher inspection assumptions.",
        body:
          "1976 crawl-space ranch · catastrophic tree damage · open to weather during that chapter. Inspectors look hard at moisture, crawl, insulation, age systems — and mold when it shows up. The $230k bid skips inspection on purpose.",
        visual: "condition",
        bullets: [
          "Already done: new roof, ~½ open-concept rebuild, ~½ new siding, newer HVAC",
          "Still unknown: crawl, moisture history, systems behind the new work",
          "As-is + no inspection = buyer prices the unknown",
        ],
        stat: { value: "As-is", label: "Buyer skipped inspection on purpose" },
      },
      {
        id: "look",
        eyebrow: "Your private look",
        title: "Pay for an inspection. Keep the report.",
        body:
          "Hire your own inspector — for you. Standard visit ~$350–$550. Add crawl/moisture and you are often ~$400–$900 total. Tiny vs an $80,000 gap.",
        visual: "none",
        bullets: [
          "Cost: ~$350–$550 standard · ~$400–$900 with crawl/moisture",
          "THIS AS-IS BUYER IS NOT OWED YOUR REPORT",
          "They waived inspection — your look is only to decide on their price",
          "Retail listing later is different — then plan to share what you know",
        ],
        stat: { value: "Not owed", label: "As-is buyer does not get your private report" },
      },
      {
        id: "appraisal",
        eyebrow: "Appraisal?",
        title: "Inspection ≠ appraisal. Different questions.",
        body:
          "An inspection answers “what is wrong?” An appraisal answers “what is it worth?” A private appraisal usually runs about $350–$600. It will not replace a crawl/moisture look. It can help if you want a third-party value number before you counter or list — especially after you know condition.",
        visual: "compare",
        bullets: [
          "Appraisal cost: ~$350–$600 typical (ballpark)",
          "Useful now if: you want a value opinion vs the $230k / $310k story",
          "Less useful alone if: you still do not know repair scope — value assumes a condition story",
          "Best pair: inspection first (or with it), then appraisal if you still need a value stamp",
          "Relative to −$80k gap: cheap; not a substitute for knowing repair dollars",
        ],
        stat: { value: "~$350–600", label: "Typical private appraisal cost · value, not condition" },
      },
      {
        id: "repairs",
        eyebrow: "Repair math",
        title: "Under ~$61k in fixes, listing still beats $230k.",
        body:
          `List ~${money(LIST_CLEAN)} − ~6% fees ≈ ${money(LIST_NET_BEFORE_REPAIRS)} before repairs. As-is ${money(OFFER_AS_IS)} has $0 realtor fee. Headroom ≈ ${money(BREAKEVEN_REPAIRS)}.`,
        visual: "repairs",
        bullets: [
          "Repairs under ~$25,000 → listing path clearly ahead",
          "Repairs ~$40,000–$50,000 → still often ahead; closer",
          `Repairs over ~${money(BREAKEVEN_REPAIRS)} → $230k can win on math alone`,
          "Ballparks: contained moisture ~$2.5k–$8k · crawl/widespread ~$15k–$40k · crawl/vapor ~$4k–$18k · electrical/plumbing ~$2k–$12k · punch list ~$3k–$15k · “a few things” stack ~$15k–$35k",
        ],
        stat: { value: money(BREAKEVEN_REPAIRS), label: "Repair spend where $230k ties a clean list" },
      },
      {
        id: "worth",
        eyebrow: "Price bands",
        title: "Clean band vs as-is band.",
        body:
          "Clean / fixed: about $275,000–$345,000 (mid ~$310,000). Heavy unresolved risk sold as-is: about $230,000–$280,000. $230k is the floor of that risk band.",
        stat: { value: "$230–280k", label: "As-is band if inspection risk stays with the buyer" },
        visual: "schools",
      },
      {
        id: "offer",
        eyebrow: "The offer",
        title: "$230,000 prices unfinished risk.",
        body:
          "No realtor · no inspection. Low vs clean mid (−$80k). Inside a hard as-is band if leftovers are ugly and you will not fix them.",
        stat: { value: "−$80k", label: "vs clean mid · near as-is floor" },
        visual: "nets",
      },
      {
        id: "call",
        eyebrow: "Bottom line",
        title: "Inspect for you. Keep the report. Then pick a lane.",
        body:
          "Do not answer $230,000 on vibe. Private inspection first (buyer is not owed it). Optional appraisal if you still want a value number. Then: modest fixes → counter/list; huge fixes you will not do → $230k can be fair.",
        bullets: [
          "Private inspection ~$400–$900 — KEEP IT; as-is buyer is not owed it",
          "Optional appraisal ~$350–$600 — value opinion, not a condition report",
          "Fixes well under ~$61,000 → push past $230k or list",
          "Fixes over ~$61,000 and you will not do them → $230k as-is can win",
        ],
      },
      {
        id: "odds",
        eyebrow: "Repair odds",
        title: "Estimated chance repairs hit at least this much.",
        body:
          "Judgment odds only — not a contractor bid. Based on what is known so far: 1976 crawl-space ranch, catastrophic tree damage, open to weather, partial rebuild, and the usual moisture / systems catch-up pattern. Read each line as: “chance total leftover repairs land at or above this number.” The high-dollar rows are rare — and each one lists what would have to be wrong to get there.",
        visual: "odds",
        bullets: [
          "Nearly certain you face some real catch-up cost (not $0)",
          "Mid five figures need a real moisture/crawl or multi-system stack — plausible, not automatic",
          "Hitting ~$61,000+ needs several ugly findings at once — minority case",
          "$80,000+ needs cascading failure (structure + widespread remediation + major systems) — uncommon",
          "Private inspection is how you replace these odds with a real scope",
        ],
        stat: { value: "~4%", label: "Judgment odds of an $80k+ cascading worst case" },
      },
    ],
    repairOdds: [
      {
        amount: 5000,
        pct: 95,
        note: "Almost sure some punch-list / spot work",
        wrongIf: "Normal leftover trim, seal, or small moisture touch-up after a weather/rebuild chapter.",
      },
      {
        amount: 10000,
        pct: 80,
        note: "Likely beyond tiny fixes",
        wrongIf: "More than cosmetics — e.g. limited dry-out, insulation patches, a few electrical/plumbing catch-ups.",
      },
      {
        amount: 15000,
        pct: 65,
        note: "Common stacked catch-up",
        wrongIf: "Several small jobs land together: punch list + crawl vapor work + one age-system fix.",
      },
      {
        amount: 25000,
        pct: 45,
        note: "Meaningful multi-item stack",
        wrongIf: "Documented crawl moisture or mold in a contained area, plus systems/finish work — not a single surprise.",
      },
      {
        amount: 40000,
        pct: 22,
        note: "Heavy crawl / moisture path",
        wrongIf: "Widespread crawl moisture or mold needing remediation, insulation replacement, and related repairs — not spot cleanup.",
      },
      {
        amount: 61000,
        pct: 10,
        note: "Around list vs $230k break-even",
        wrongIf:
          "Heavy remediation plus major systems (e.g. HVAC or plumbing redo) and a big finish stack — several hard findings, not one.",
      },
      {
        amount: 80000,
        pct: 4,
        note: "Cascading worst case",
        wrongIf:
          "Would need a pile-up: structural or framing damage from the tree/water chapter, widespread mold/crawl rebuild, and major mechanical replacement all at once. Uncommon if the visible rebuild was done soundly — inspection is how you rule it in or out.",
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
        note: "Buyer owns leftover inspection risk. Fast exit.",
        highlight: true,
      },
      {
        label: "Fix ~$20k, then list clean",
        salePrice: 310000,
        realtorFeePct: 0.06,
        realtorFee: fee(310000, 0.06),
        estimatedNet: LIST_NET_BEFORE_REPAIRS - 20000,
        note: `Keep ~${money(LIST_NET_BEFORE_REPAIRS)} after fees, minus ~$20k fixes → still ~$61k above $230k.`,
      },
      {
        label: "Fix ~$45k, then list clean",
        salePrice: 310000,
        realtorFeePct: 0.06,
        realtorFee: fee(310000, 0.06),
        estimatedNet: LIST_NET_BEFORE_REPAIRS - 45000,
        note: "Still ahead of $230k on paper, but closer — time and hassle count.",
      },
      {
        label: "Heavy fixes ~$65k, then list",
        salePrice: 310000,
        realtorFeePct: 0.06,
        realtorFee: fee(310000, 0.06),
        estimatedNet: LIST_NET_BEFORE_REPAIRS - 65000,
        note: "Net slips under the as-is offer — this is where $230k wins on math.",
      },
    ],
    valuation: {
      low: 230000,
      mid: 310000,
      high: 345000,
      offer: 230000,
      zest: 304900,
      thesis:
        "Clean / fixed: about $275,000–$345,000 (mid ~$310,000). As-is with heavy unresolved risk: about $230,000–$280,000. $230,000 is the floor of the as-is band — low if repairs are modest, fairer if they clear ~$61,000 and you will not fix them.",
      recommendation:
        "Private inspection first (~$400–$900). Keep the report — this as-is buyer is not owed it. Optional appraisal (~$350–$600) if you want a value opinion. If fixes stay well under ~$61,000, push past $230k or list. If not, and you will not fix, $230k can be in range.",
    },
    notebook: {
      title: "The math board",
      paragraphs: [
        "Clean mid ~$310,000. As-is offer $230,000. Gap −$80,000.",
        `List path: ${money(LIST_CLEAN)} − ~6% ≈ ${money(LIST_NET_BEFORE_REPAIRS)} before repairs. As-is path: ${money(OFFER_AS_IS)} with $0 realtor. Break-even repair spend ≈ ${money(BREAKEVEN_REPAIRS)}.`,
        "Repair ballparks (not quotes): contained moisture ~$2.5k–$8k; crawl/widespread ~$15k–$40k; crawl/vapor ~$4k–$18k; electrical/plumbing ~$2k–$12k; punch list ~$3k–$15k; stacked “a few things” ~$15k–$35k.",
        "Private inspection ~$350–$550 (or ~$400–$900 with crawl/moisture). AS-IS BUYER IS NOT OWED YOUR REPORT.",
        "Private appraisal ~$350–$600. Answers value, not condition. Useful after (or with) inspection if you still want a third-party number vs $230k / $310k.",
        "65804: median days on market ~30 days recently; Springfield metro ~44 days. More listings citywide can feel slow, but homes are still closing. Same-street peers often ~$310k–$320k when clean. Typical zip sale ~$291k. Schools: Disney 10, Cherokee 8, Kickapoo 8.",
        "Upgrades already paid: new roof, ~½ open rebuild, ~½ siding, newer HVAC. Risk: weather exposure + crawl/moisture/age systems.",
        "Lane: inspect → total fixes → under ~$61k and willing → counter/list; over ~$61k and unwilling → $230k as-is can be rational.",
        "Repair odds (judgment, P(cost ≥ X)): ≥$5k ~95% · ≥$10k ~80% · ≥$15k ~65% · ≥$25k ~45% · ≥$40k ~22% · ≥$61k ~10% · ≥$80k ~4%. High-dollar rows need stacked failures (widespread crawl remediation, major systems, or structural) — see Repair odds chapter. Replace with a private scope.",
      ],
    },
    researchDate: "August 12, 2026",
    sources: [
      "Property condition notes (tree damage, roof, remodel, siding, HVAC)",
      "Public estimate and tax data (Zillow)",
      "Recent area sales reported through public listing sites",
      "Typical residential repair / remediation cost ranges (industry ballparks; not a quote)",
      "Typical Springfield-area home inspection fee ranges (industry ballparks; not a quote)",
      "Typical residential appraisal fee ranges (industry ballparks; not a quote)",
      "Realtor.com / FRED market tempo (65804 & Springfield MO days on market, inventory — mid-2026 reads)",
    ],
  },
  "1715-e-buena-vista-financial": {
    slug: "1715-e-buena-vista-financial",
    metaTitle: "Sale Proceeds — Financial Brief",
    brand: "Mark Turner Financial Research",
    brandTag: "Independent sale-proceeds brief",
    markSrc: "/brand/mark-turner-financial.png",
    layout: "proceeds",
    cover: {
      display: "Sale Proceeds",
      sub: "Closing · Control · Two of three",
      meta: "What happens to the money after a sale",
      statValue: "2 of 3",
      statLabel: "must agree before funds move",
      compareWarn: "not a solo checking account",
      compareGood: "trust + dual-control bank card",
    },
    address: "Sale proceeds plan",
    cityLine: "After closing · shared money control",
    heroLine: "When a sale closes, the wire should not land in a single-name account by default.",
    support:
      "This brief is only about the money side of a sale: where proceeds go, who can move them, and how to set a simple two-of-three approval so large transfers need agreement — not one person acting alone.",
    geo: {
      lat: 37.1323354,
      lng: -93.2652218,
      label: "Springfield, MO",
    },
    facts: [
      { label: "Goal", value: "Shared control" },
      { label: "People", value: "Three named" },
      { label: "Rule", value: "Any 2 of 3" },
      { label: "Vehicle", value: "Living trust" },
      { label: "Account", value: "Trust-titled" },
      { label: "Bank card", value: "Dual authorization" },
      { label: "Bridge", value: "Attorney escrow" },
      { label: "Avoid", value: "Solo joint account" },
    ],
    condition: [],
    repairs: [],
    proceedsOptions: [
      {
        title: "Living trust + three co-trustees",
        summary: "Best fit for two-of-three control",
        detail:
          "Sale proceeds go into a revocable living trust. Name three co-trustees. Write the trust so distributions or large transfers need agreement of any two of the three. The deposit account is titled to the trust, not to one person alone.",
      },
      {
        title: "Trust bank / brokerage signature card",
        summary: "Where dual control is enforced day to day",
        detail:
          "Once funds sit in a trust-titled account, set the bank or brokerage signature rules to dual authorization — often “any two of three.” That card is what stops a single signature from moving the money.",
      },
      {
        title: "Attorney escrow (short-term)",
        summary: "Park funds while paperwork catches up",
        detail:
          "Closing proceeds can sit briefly in a lawyer’s trust / escrow account while the lasting trust and bank setup are finished. Useful as a bridge — not usually the long-term home for the money.",
      },
      {
        title: "Medicaid vs. this control plan",
        summary: "Different jobs — do not confuse them",
        detail:
          "The revocable trust + two-of-three setup is for shared approval of transfers. It generally does not remove assets from Medicaid resource counting. Irrevocable Medicaid planning trusts are a separate design with look-back rules — use an elder-law attorney if that is the goal.",
      },
    ],
    schools: [],
    chapters: [
      {
        id: "why",
        eyebrow: "The point",
        title: "Sale money needs a control plan before the wire.",
        body:
          "A closing check or wire is easy to park in the wrong place: one person’s everyday account. Once it is there, any later “shared oversight” is harder. Decide the control structure first — then tell the title company where to send the funds.",
        visual: "none",
        bullets: [
          "Decide who must agree before large transfers",
          "Title the receiving account to match that plan",
          "Give title / closing the correct payee instructions early",
        ],
        stat: { value: "Before close", label: "Set the receiving account and approval rule" },
      },
      {
        id: "rule",
        eyebrow: "The rule",
        title: "Three people. Any two must agree.",
        body:
          "A clear, common pattern: name three people on the arrangement, and require any two to approve moving money. That keeps day-to-day flexibility (not everyone has to sign every time) while blocking solo transfers.",
        visual: "proceeds",
        bullets: [
          "Three named decision-makers",
          "Two signatures / approvals for distributions or large moves",
          "One person alone cannot empty the account",
        ],
        stat: { value: "2 of 3", label: "Shared-approval rule for sale proceeds" },
      },
      {
        id: "trust",
        eyebrow: "The vehicle",
        title: "A living trust is usually how you encode that rule.",
        body:
          "Put the sale proceeds into a revocable living trust. Name three co-trustees. Spell out in the document that distributions and large transfers need any two of the three. Then open a bank or brokerage account titled to the trust — not to an individual — and set the signature card to match.",
        visual: "none",
        bullets: [
          "Trust owns the cash (or holds it for the beneficiary)",
          "Co-trustees follow the written two-of-three rule",
          "Bank / brokerage enforces dual authorization on the account",
        ],
      },
      {
        id: "medicaid",
        eyebrow: "Medicaid",
        title: "Shared control is not the same as Medicaid planning.",
        body:
          "A revocable living trust is a great tool for two-of-three approval — and a weak shield for Medicaid. If the person who sold the house can still revoke the trust or benefit from the money, Medicaid usually still counts those assets when someone applies for long-term care help. Moving sale proceeds into a revocable trust does not hide them.",
        visual: "none",
        bullets: [
          "Revocable living trust: usually still “your money” for Medicaid resource tests",
          "Home sale cash often becomes a countable asset once it is proceeds in the bank",
          "Irrevocable trusts are a different tool — and transfers can trigger a look-back (often ~5 years) and a penalty period",
          "If Medicaid eligibility matters, talk to an elder-law attorney before you retitle large sums",
        ],
        stat: { value: "Not a shield", label: "Revocable trust ≠ Medicaid asset protection" },
      },
      {
        id: "bank",
        eyebrow: "The account",
        title: "Ordinary joint checking usually fails this test.",
        body:
          "Many “joint” personal accounts let any one owner write a check or send a wire. That is convenient — and the opposite of two-of-three control. Ask the bank for a trust account (or similar) with dual authorization. If they cannot do it, switch institutions or keep funds in attorney escrow until you find one that can.",
        visual: "none",
        bullets: [
          "Ask: “Can this account require two of three to move money?”",
          "Get the answer in writing on the signature card",
          "TOD / POD designations are not a living dual-control plan",
        ],
        stat: { value: "Ask the bank", label: "Dual authorization ≠ standard joint account" },
      },
      {
        id: "bridge",
        eyebrow: "If timing is tight",
        title: "Use escrow as a bridge — not the forever home.",
        body:
          "If closing arrives before the trust and bank card are ready, proceeds can sit briefly with the closing attorney or in a lawyer’s trust account. That buys days or weeks to finish paperwork. Then move funds into the trust-titled, dual-control account.",
        visual: "none",
        bullets: [
          "Short-term parking only",
          "Written instructions for the next transfer into the trust account",
          "Do not leave long-term cash unlabeled in escrow by accident",
        ],
      },
      {
        id: "steps",
        eyebrow: "Checklist",
        title: "Do this in order.",
        body:
          "Simple sequence so the wire does not outrun the paperwork.",
        visual: "nets",
        bullets: [
          "1. Meet an estate / real-estate attorney — draft or update the living trust with three co-trustees and a two-of-three rule",
          "2. Open the trust-titled bank or brokerage account; set dual authorization",
          "3. Tell title / closing the exact payee name and account instructions",
          "4. If the account is not ready at closing, use attorney escrow as a bridge",
          "5. After funding, keep a one-page note of who the three people are and how approvals work",
        ],
        stat: { value: "5 steps", label: "From “sale closes” to “money under shared control”" },
      },
      {
        id: "call",
        eyebrow: "Bottom line",
        title: "Control the landing pad for the proceeds.",
        body:
          "The financial job after a sale is simple: do not let the full proceeds sit where one person can move them alone. Use a living trust with three co-trustees, a two-of-three approval rule, and a bank card that matches. That plan is about control — not Medicaid eligibility. Confirm both the documents and any Medicaid questions with the right attorney.",
        bullets: [
          "Structure: living trust + three co-trustees",
          "Rule: any two of three to move money",
          "Account: trust-titled with dual authorization",
          "Medicaid: revocable trust usually still counts — ask an elder-law attorney if that matters",
          "Bridge: attorney escrow only if the setup is not ready at closing",
        ],
      },
    ],
    comps: [],
    netScenarios: [
      {
        label: "Wire to trust account (ready at closing)",
        salePrice: 230000,
        realtorFeePct: 0,
        realtorFee: 0,
        estimatedNet: 230000,
        note: "Best case: title pays the trust. Dual-control card already active.",
        highlight: true,
      },
      {
        label: "Wire to attorney escrow (bridge)",
        salePrice: 230000,
        realtorFeePct: 0,
        realtorFee: 0,
        estimatedNet: 230000,
        note: "Fine for a short hold while trust / bank paperwork finishes.",
      },
      {
        label: "Wire to one person’s checking (avoid)",
        salePrice: 230000,
        realtorFeePct: 0,
        realtorFee: 0,
        estimatedNet: 230000,
        note: "Same dollars — but one signature can move them. Harder to fix later.",
      },
      {
        label: "Listed sale net example (~6% fees)",
        salePrice: 310000,
        realtorFeePct: 0.06,
        realtorFee: fee(310000, 0.06),
        estimatedNet: 310000 - fee(310000, 0.06),
        note: "Whatever the sale price, the receiving-account plan stays the same.",
      },
    ],
    valuation: {
      low: 0,
      mid: 230000,
      high: 310000,
      offer: 230000,
      zest: 230000,
      thesis:
        "This brief does not price the house. It maps where sale proceeds should land and how three people can share control so any two must agree before money moves.",
      recommendation:
        "Before closing, set a living trust with three co-trustees and a two-of-three rule, open a trust-titled dual-control account, and give title those payee instructions — or park briefly in attorney escrow until that is ready. Treat Medicaid as a separate question: a revocable control trust usually still counts as an available resource.",
    },
    notebook: {
      title: "Sale proceeds — money control only",
      paragraphs: [
        "This page is not about condition, comps, or offer strategy. It is about the cash after a sale.",
        "Target setup: revocable living trust · three co-trustees · written rule that any two must approve distributions or large transfers · bank/brokerage account titled to the trust with dual authorization on the signature card.",
        "Why not a normal joint account? Because many joint accounts allow any one owner to withdraw. That fails the two-of-three goal even if three names appear on the statement.",
        "Why not TOD/POD alone? Those designations usually matter after death. They do not create shared living approval for moving money today.",
        "Medicaid in plain terms: if the seller can revoke the trust or still benefit from the money, long-term care Medicaid usually still treats those assets as available. A revocable living trust built for two-of-three control is not an asset-protection vault. Home-sale proceeds sitting in cash are often countable. Irrevocable trusts and gifts can start a look-back clock (commonly about five years) and may cause a penalty period if someone applies for Medicaid too soon — that is specialized elder-law work, not a side effect of the control plan above.",
        "Timing: finish the trust and account before closing when you can. If you cannot, use attorney escrow as a short bridge, then move funds into the dual-control trust account.",
        "Closing instructions: the payee name on the wire / check should match the trust (or escrow), not an individual’s everyday account.",
        "Not legal or tax advice — confirm the document language, bank card, and any Medicaid questions with an attorney (estate counsel for control; elder-law counsel if eligibility matters).",
      ],
    },
    researchDate: "August 12, 2026",
    sources: [
      "General trust / multi-signer account patterns (educational overview; not legal or tax advice)",
      "Typical dual-authorization / co-trustee banking practices (confirm with the holding bank)",
      "General Medicaid resource / look-back concepts for trusts (educational overview; state rules vary — confirm with an elder-law attorney)",
    ],
  },

  "evans-road-webster-land": {
    slug: "evans-road-webster-land",
    metaTitle: "Evans Road Lot WP001 — Land Market Brief",
    brand: "Thompson Brothers Market Research",
    brandTag: "Independent land & acreage brief",
    markSrc: "/brand/thompson-brothers-market.png",
    layout: "land",
    cover: {
      display: "Evans Road",
      sub: "68.91 acres · indicated mid ~$400k",
      meta: "Evans Rd Lot WP001 · Marshfield, MO 65706 · Webster County",
      statValue: "~$5,800",
      statLabel: "per acre · indicated mid",
      compareWarn: "2021 ask $339,000 · now off-market",
      compareGood: "Today’s mid ~$400,000",
    },
    address: "Evans Rd Lot WP001",
    cityLine: "Marshfield, MO 65706 · Webster County",
    heroLine:
      "68.91-acre combination farm on Evans Road. Last public ask $339,000 (2021). Indicated fair-market mid today ~$400,000 (~$5,800/ac).",
    support:
      "Zillow / Whitetail listing (Lot WP001): mature hardwoods, improved hay pasture, building sites, paved-road access, about 4 miles from Marshfield High — Marshfield R-I schools. Currently off-market.",
    keyNumbers: [
      { label: "Acres (Zillow)", value: "68.91", tone: "neutral" },
      { label: "Indicated mid", value: "~$400,000", tone: "good" },
      { label: "Per acre mid", value: "~$5,800", tone: "good" },
      { label: "2021 ask", value: "$339,000", tone: "warn" },
      { label: "FMV low", value: "~$330,000", tone: "warn" },
      { label: "FMV high", value: "~$470,000", tone: "good" },
      { label: "1-yr base", value: "~$412k", tone: "neutral" },
      { label: "10-yr base", value: "~$538k", tone: "good" },
    ],
    callouts: [
      {
        title: "This is the original listing tract",
        body:
          "Evans Rd Lot WP001, Marshfield 65706 (ZPID 2078063843). Vacant land — combination farm with timber, improved pasture, and build sites. Not a house brief. Status on Zillow: off-market.",
      },
      {
        title: "2021 ask is a floor for today’s talk — not a ceiling",
        body:
          "Whitetail listed it at $339,000 in Aug 2021 (~$4,920/ac). Webster farm values and SW rec/timber opinion marks have moved since. Working mid today ~$400,000 unless a fresh walk shows weaker pasture or access.",
      },
    ],
    compareCards: [
      {
        title: "Prior public ask",
        cost: "$339,000 · Aug 2021 · Whitetail",
        answers: "What sellers asked last time this tract was marketed",
        doesNot: "Does not lock today’s value — market and land use have moved",
      },
      {
        title: "County + SW survey context",
        cost: "Webster farm ~$5,011/ac · SW pasture/rec higher",
        answers: "Neighborhood pricing for farm and recreational ground",
        doesNot: "Does not replace a site walk of timber vs pasture share",
      },
    ],
    geo: {
      lat: 37.3545517,
      lng: -92.8401542,
      label: "Evans Rd Lot WP001, Marshfield, MO 65706",
    },
    facts: [
      { label: "Acres", value: "68.91 (Zillow)" },
      { label: "Type", value: "Vacant land · combination farm" },
      { label: "County / ZIP", value: "Webster · 65706" },
      { label: "Access", value: "Paved roads · Evans Road" },
      { label: "Schools", value: "Marshfield R-I" },
      { label: "To Marshfield HS", value: "~4 miles (listing)" },
      { label: "2021 ask", value: "$339,000" },
      { label: "Status", value: "Off-market (Zillow)" },
    ],
    condition: [
      {
        label: "Timber",
        status: "recent",
        detail:
          "Listing notes large white oak, red oak, and hickory — mature hardwood cover that supports hunting and a selective-timber story.",
      },
      {
        label: "Pasture / hay",
        status: "new",
        detail:
          "Pasture described as improved for hay production, with open ground usable for livestock or food plots. That is the main step-up vs raw timber-only peers.",
      },
      {
        label: "Building sites",
        status: "new",
        detail:
          "Combination farm with building sites among the hardwoods. Lifestyle / homesite demand near Marshfield is part of the bid.",
      },
      {
        label: "Access & schools",
        status: "new",
        detail:
          "Paved-road access; listing puts Marshfield High about 4 miles out. Marshfield R-I district — a real premium vs remote recreational tracts.",
      },
      {
        label: "Improvements / dwelling",
        status: "concern",
        detail:
          "No house in the valuation. Confirm fence, pond, interior lanes, and utilities on a walk — they move you inside the band.",
      },
      {
        label: "Listing status",
        status: "partial",
        detail:
          "Off-market on Zillow after 2020 and 2021 marketing chapters. Treat $339k as last public ask, not an active offer.",
      },
    ],
    repairs: [
      {
        issue: "Boundary survey (if stale)",
        low: 2500,
        high: 8000,
        note: "Typical rural survey ballpark — confirm acres vs Zillow 68.91",
      },
      {
        issue: "Fence catch-up for livestock",
        low: 8000,
        high: 35000,
        note: "Only if you run cattle/horses; hunt leases often skip full perimeter",
      },
      {
        issue: "Hay / pasture refresh",
        low: 2000,
        high: 12000,
        note: "Fertility, clipping, or reseed if the improved pasture has slipped",
      },
      {
        issue: "Food plots / hunt setup",
        low: 1500,
        high: 8000,
        note: "Supports lease rates and recreational use",
      },
      {
        issue: "Selective timber cruise",
        low: 500,
        high: 2500,
        note: "Cruise fee only — oak/hickory volume decides harvest dollars",
      },
    ],
    proceedsOptions: [
      {
        title: "Hunting / recreational lease",
        summary: "Often ~$20–$45+/ac · year",
        detail:
          "Hardwood + Marshfield proximity supports a stronger lease than remote timber. On ~69 acres that is roughly $1,400–$3,100+/yr for a solid deer/turkey lease.",
      },
      {
        title: "Hay or pasture lease",
        summary: "Cash rent on open acres",
        detail:
          "Listing already frames improved hay ground. Lease the open acres to a neighbor for hay or cattle while you keep timber for recreation.",
      },
      {
        title: "Selective oak / hickory harvest",
        summary: "Lump sum · planned cut",
        detail:
          "Mature white/red oak and hickory can fund a capital event. Cruise first; leave seed trees and access so residual land value holds.",
      },
      {
        title: "Homesite + keep the farm",
        summary: "Split use · not a full sale",
        detail:
          "Build among the hardwoods, keep pasture and timber as buffer. Monetizes the Marshfield-school lifestyle bid without liquidating all 68.91 acres.",
      },
      {
        title: "Cabin / short-stay recreation",
        summary: "Needs a structure + access",
        detail:
          "Weekend hunting / Ozark getaway demand can support seasonal rentals if you add a cabin or RV pad. More work than a plain hunt lease.",
      },
      {
        title: "Solar or specialty lease",
        summary: "Screen only · not base case",
        detail:
          "Utility-scale solar needs transmission, slope, and a willing lessee. Treat as optionality after a developer pass — not the default income path.",
      },
    ],
    schools: [
      { name: "Marshfield High", grades: "9–12", rating: 7, miles: "~4 mi" },
      { name: "Shook Elementary", grades: "K–5", rating: 8, miles: "Marshfield R-I" },
      { name: "Daniel Webster Elementary", grades: "K–5", rating: 7, miles: "Marshfield R-I" },
    ],
    chapters: [
      {
        id: "place",
        eyebrow: "The tract",
        title: "Evans Rd Lot WP001 — 68.91 acres outside Marshfield.",
        body:
          "Original Zillow listing: vacant combination farm on Evans Road, Marshfield 65706, Webster County. Paved access, Marshfield R-I schools, about 4 miles from Marshfield High. Map pin ≈37.3546, −92.8402.",
        visual: "map",
        bullets: [
          "Acres: 68.91 (Zillow lot size)",
          "Address style: Evans Rd Lot WP001 · Marshfield, MO 65706",
          "Land use: timber + improved hay pasture + building sites",
          "Broker history: Whitetail Properties (2021 ask $339,000)",
          "Status: off-market — no active public ask right now",
        ],
        stat: { value: "68.91 ac", label: "Zillow lot size · survey still wise" },
      },
      {
        id: "listing",
        eyebrow: "Listing history",
        title: "Last marketed at $339,000 in 2021.",
        body:
          "Public price history on the Zillow card: listed ~$120,000 in 2020 (then pending/removed), re-listed Aug 24, 2021 at $339,000 with Whitetail, went pending mid-September, removed Nov 2021. Today the page reads off-market — so $339k is the last ask, not a live offer.",
        visual: "compare",
        bullets: [
          "Aug 2021 ask: $339,000 ≈ $4,920 per acre",
          "2020 chapter at $120,000 looks like an earlier/partial marketing path — do not treat as today’s comp alone",
          "Days to pending in 2021: about three weeks — demand showed up when priced",
          "No Zestimate on the vacant-land card",
        ],
        stat: { value: "$339k", label: "Last public ask · Aug 2021" },
      },
      {
        id: "market",
        eyebrow: "Market read",
        title: "Combination farm near Marshfield prices above raw timber.",
        body:
          "Webster County farm index ≈ $5,011/ac (Q2 2025). MU Southwest opinion marks for pasture and hunt/rec sit higher. Nearby raw timber asks (e.g. ~70 ac Old Luthy) still print nearer the mid-$4,000s/ac. This tract’s hay pasture, oaks, paved access, and school district pull it toward the index — and often a bit above.",
        visual: "none",
        bullets: [
          "Webster farm avg ≈ $5,011/ac → × 68.91 ≈ $345,000 index check",
          "2021 ask already near ~$4,920/ac — sellers priced location, not distress timber",
          "SW Missouri pasture / rec survey marks support a premium to remote timber",
          "Buyers: farmers, rec/lifestyle, and investors still split the Missouri land bid",
        ],
        stat: { value: "~$5.0k", label: "Webster farm index · per acre" },
      },
      {
        id: "site",
        eyebrow: "What the listing says",
        title: "Oaks, improved pasture, build sites, paved roads.",
        body:
          "Remarks: easy-access tract near a growing community; building sites among mature hardwoods; white oak, red oak, hickory; pasture improved for hay; open ground for livestock; hunting; appointment only. That package is why this is not a pure recreational-timber comp.",
        visual: "condition",
        bullets: [
          "Plus: Marshfield R-I · paved access · hay + timber mix · build sites",
          "Confirm on walk: exact open-acre share, fence, water, interior roads, utilities",
          "Drag if found: overgrown pasture, access easement issues, or acreage short of 68.91",
        ],
      },
      {
        id: "fmv",
        eyebrow: "Fair market value",
        title: "Indicated band today: about $330,000–$470,000.",
        body:
          "Working mid ~$400,000 (~$5,800/ac). That sits above the 2021 ask after several years of land appreciation, above the bare Webster index (~$345k on 68.91 ac), and below improved hay/frontage peers that clear $6,500+/ac.",
        visual: "schools",
        bullets: [
          "Low ~$330,000 (~$4,790/ac) — if pasture/access underwhelm vs the remarks",
          "Mid ~$400,000 (~$5,800/ac) — indicated fair market for the listed combination farm",
          "High ~$470,000 (~$6,820/ac) — strong open acres, utilities, polished build site",
          "Prior ask $339,000 is a historical floor for conversation, not today’s list price",
          "Not an appraisal — pending survey and site walk",
        ],
        stat: { value: "~$400k", label: "Indicated fair-market mid · whole tract" },
      },
      {
        id: "forecast",
        eyebrow: "1 · 5 · 10 year",
        title: "Base case: modest compounding from the $400k mid.",
        body:
          "Missouri respondents still expect a few percent of upside in 2026 for “other” land, with farm-income headwinds in the background. We do not replay 2020–2025’s sharp run-up.",
        visual: "none",
        bullets: [
          "1 year (base +3%): ~$412,000 · bull +5% ~$420k · bear flat ~$392k",
          "5 years (base 3.5% CAGR): ~$475,000 · bull 5% ~$511k · bear 1.5% ~$431k",
          "10 years (base 3% CAGR): ~$538,000 · bull 4.5% ~$620k · bear 1.5% ~$464k",
          "Bull case needs sustained Marshfield lifestyle demand + thin local inventory",
          "Bear case: higher rates, thick land listings, or pasture quality disappointment",
        ],
        stat: { value: "~$538k", label: "10-year base on today’s mid (≈3% CAGR)" },
      },
      {
        id: "income",
        eyebrow: "Hold income",
        title: "Ways to earn without selling the land.",
        body:
          "Title stays with you. The listing’s own use cases — hunting, livestock/hay, building — map cleanly onto lease and light-improvement income.",
        visual: "options",
        bullets: [
          "Hunt lease on hardwood cover — often the simplest annual check",
          "Hay / pasture lease on the improved open ground",
          "Selective oak/hickory cut as a planned lump sum",
          "Homesite or cabin to monetize Marshfield-school lifestyle demand",
          "Solar only after a site screen — not assumed",
        ],
        stat: { value: "$1.4–3k+", label: "Illustrative annual hunt-lease band on ~69 ac" },
      },
      {
        id: "paths",
        eyebrow: "Money paths",
        title: "Sell, hold+lease, or improve then sell.",
        body:
          "A mid sale with a typical land-broker fee still clears around the mid-$370ks before taxes and closing costs. Holding with hay + hunt income keeps the 5–10 year path open.",
        visual: "nets",
        bullets: [
          "Sell at mid (~$400k) with ~6% fee → keep roughly ~$376k before other costs",
          "Sell at high band if the walk proves strong open acres + utilities",
          "Hold + hunt/hay lease → small annual yield, upside retained",
          "2021 ask $339k is useful history — price today’s deal off the new mid",
        ],
      },
      {
        id: "call",
        eyebrow: "Bottom line",
        title: "Treat ~$5,800/ac as the working mid until the walk.",
        body:
          "Start from the Zillow card (68.91 ac, last ask $339k, off-market). Walk timber vs pasture, confirm access and schools story, then lease for income or list near the mid with comps in hand.",
        bullets: [
          "Working FMV: ~$330k–$470k (mid ~$400k)",
          "Anchor history: 2021 Whitetail ask $339,000",
          "1 / 5 / 10 yr base: ~$412k / ~$475k / ~$538k",
          "Non-sale income: hunt lease + hay lease first; timber/homesite as options",
        ],
      },
    ],
    repairOdds: [],
    comps: [
      {
        address: "This tract · 2021 ask",
        note: "Evans Rd WP001 · last Whitetail ask",
        beds: 0,
        baths: 0,
        sqft: 0,
        acres: 68.91,
        price: 339000,
        priceLabel: money(339000) + " ask ’21",
        date: "Aug 2021",
        kind: "estimate",
        map: { x: 52, y: 50 },
      },
      {
        address: "Old Luthy Rd · Niangua",
        note: "Active ~70 ac timber / creek · size peer",
        beds: 0,
        baths: 0,
        sqft: 0,
        acres: 70,
        price: 299999,
        priceLabel: money(299999) + " ask",
        kind: "active",
        map: { x: 72, y: 28 },
      },
      {
        address: "Beach Rd · Conway (Webster 80)",
        note: "Active 80 ac hay + frontage + electric",
        beds: 0,
        baths: 0,
        sqft: 0,
        acres: 80,
        price: 522900,
        priceLabel: money(522900) + " ask",
        kind: "active",
        map: { x: 30, y: 62 },
      },
      {
        address: "Wiseman Rd · Marshfield",
        note: "Active ~84 ac pasture/timber + pond",
        beds: 0,
        baths: 0,
        sqft: 0,
        acres: 84,
        price: 649999,
        priceLabel: money(649999) + " ask",
        kind: "active",
        map: { x: 40, y: 40 },
      },
      {
        address: "Hwy B · Marshfield",
        note: "Active 78.2 ac timber / food plots",
        beds: 0,
        baths: 0,
        sqft: 0,
        acres: 78.2,
        price: 520000,
        priceLabel: money(520000) + " ask",
        kind: "active",
        map: { x: 35, y: 35 },
      },
      {
        address: "Webster farm index",
        note: "County avg × 68.91 ac (Q2 2025)",
        beds: 0,
        baths: 0,
        sqft: 0,
        acres: 68.91,
        price: 345000,
        priceLabel: money(345000) + " idx",
        kind: "estimate",
        map: { x: 58, y: 58 },
      },
    ],
    netScenarios: [
      {
        label: "Sell at indicated mid (~$400k)",
        salePrice: 400000,
        realtorFeePct: 0.06,
        realtorFee: fee(400000, 0.06),
        estimatedNet: 400000 - fee(400000, 0.06),
        note: "Typical land-broker fee ballpark. Before taxes, survey, and closing costs.",
        highlight: true,
      },
      {
        label: "Sell at high band (~$470k)",
        salePrice: 470000,
        realtorFeePct: 0.06,
        realtorFee: fee(470000, 0.06),
        estimatedNet: 470000 - fee(470000, 0.06),
        note: "Needs the improved pasture / utilities / build-site story to stick.",
      },
      {
        label: "Hold + hunt/hay lease (illustrative)",
        salePrice: 0,
        realtorFeePct: 0,
        realtorFee: 0,
        estimatedNet: 2500,
        note: "~$2,500/yr illustrative stacked lease. Keeps 5–10 year appreciation.",
      },
      {
        label: "Hold 10 yrs at base path",
        salePrice: 538000,
        realtorFeePct: 0.06,
        realtorFee: fee(538000, 0.06),
        estimatedNet: 538000 - fee(538000, 0.06),
        note: "Sells the ~$538k 10-year base later — compounding sketch, not a promise.",
      },
    ],
    valuation: {
      low: 330000,
      mid: 400000,
      high: 470000,
      offer: 400000,
      zest: 345000,
      thesis:
        "Indicated fair market for Evans Rd Lot WP001 (68.91 acres, Marshfield 65706): about $330,000–$470,000. Working mid ~$400,000 (~$5,800/ac). Last public ask was $339,000 in Aug 2021. County farm index on this acreage ≈ $345,000 — mid sits above that for pasture + schools + paved access.",
      recommendation:
        "Walk timber vs hay share, confirm 68.91 acres and access, then choose lease income or a list near the mid. Use the 2021 $339k ask as history. Commission a site-specific appraisal before a financed deal or estate valuation.",
    },
    notebook: {
      title: "Land math board",
      paragraphs: [
        "Subject: Evans Rd Lot WP001, Marshfield, MO 65706 (Webster County). Zillow ZPID 2078063843. Lot size 68.91 acres. Vacant combination farm — hardwoods, improved hay pasture, building sites. Off-market.",
        "Listing history: 2020 ask $120,000 (pending/removed); Aug 2021 Whitetail ask $339,000 (~$4,920/ac), pending ~3 weeks later, removed Nov 2021.",
        "Indicated FMV today: low ~$330,000 (~$4,790/ac) · mid ~$400,000 (~$5,800/ac) · high ~$470,000 (~$6,820/ac). Index check: ~$5,011 × 68.91 ≈ $345,000.",
        "Comps: prior ask $339k; Old Luthy ~70 ac timber $299,999; Webster 80 Beach Rd $522,900; Wiseman Rd ~84 ac $649,999; Hwy B 78.2 ac timber/food plots ~$520k.",
        "Forecast on $400k mid — 1 yr base +3% ≈ $412k; 5 yr @3.5% CAGR ≈ $475k; 10 yr @3% CAGR ≈ $538k.",
        "Hold income: hunt lease + hay/pasture lease; selective oak/hickory; homesite/cabin; solar only if screened.",
        "Sell path: mid − ~6% ≈ $376k before other costs. Firm: Thompson Brothers Market Research — not an appraisal, legal advice, or tax advice.",
      ],
    },
    researchDate: "August 12, 2026",
    sources: [
      "Zillow / Trulia listing: Evans Rd Lot WP001, Marshfield, MO 65706 (ZPID 2078063843) — lot size, remarks, price history, off-market status",
      "Shared Google Maps pin (Evans Road area ≈37.3546, −92.8402)",
      "FarmlandIntel Webster County farmland average (Q2 2025 ≈ $5,011/ac)",
      "University of Missouri Extension Farmland Values Opinion Survey (G401, 2025)",
      "Public land listings: Old Luthy Rd; Beach Rd Webster 80; Wiseman Rd ~84 ac; Hwy B 78.2 ac",
      "Industry ballparks for rural survey, fence, hunt-lease, and land-broker fees (not quotes)",
    ],
  },

  "robert-washington-fyan": FYAN_STORY,

};

export function getStory(slug: string): ClientStory | null {
  return STORIES[slug] ?? null;
}

export const STORY_SLUGS = Object.keys(STORIES);
