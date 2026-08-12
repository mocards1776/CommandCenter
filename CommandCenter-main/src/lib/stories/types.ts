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

export type StoryChapter = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets?: string[];
  stat?: { value: string; label: string };
  visual?: "map" | "condition" | "schools" | "nets" | "repairs" | "proceeds" | "none";
};

export type ClientStory = {
  slug: string;
  metaTitle: string;
  brand: string;
  brandTag: string;
  markSrc: string;
  /** property = house brief; proceeds = sale-money / control brief only */
  layout: "property" | "proceeds";
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
      sub: "Tree damage · Inspection · Offer",
      meta: "1715 E. Buena Vista St · Springfield, MO 65804",
      statValue: "$230k",
      statLabel: "as-is · pricing leftover risk",
      compareWarn: "no inspection · no realtor",
      compareGood: "clean mid ~$310,000",
    },
    address: "1715 E. Buena Vista St",
    cityLine: "Springfield, MO 65804 · Ravenwood",
    heroLine: "A 1976 ranch that was open to the weather after a tree hit — the offer is pricing inspection risk.",
    support:
      "You already paid for the big visible work: new roof, about half rebuilt open-concept, half new siding, newer HVAC. What is left is the usual question for a house this age that sat open after catastrophic damage — what will a careful inspection still find, and what does that cost to make right?",
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
        id: "place",
        eyebrow: "Where it is",
        title: "Location supports a mid-$300,000 story.",
        body:
          "Ravenwood is a solid Springfield neighborhood with strong schools. Same-street peers often read near $310,000–$320,000 when the house shows clean. The question is not the street — it is how much unfinished risk remains after the tree and the rebuild.",
        visual: "map",
        bullets: [
          "65804 homes have been selling in about ~10 days",
          "Typical sale price in the zip: around $291,000",
          "Healthy comps nearby still cluster in the low-to-mid $300,000s",
        ],
      },
      {
        id: "risk",
        eyebrow: "Inspection risk",
        title: "Open to the elements changes what buyers assume.",
        body:
          "A 1976 crawl-space ranch that took catastrophic tree damage — and sat open to weather during that chapter — invites a tougher inspection. Moisture, crawl conditions, insulation, and related cleanup (including mold when it shows up) are the usual suspects. The $230,000 as-is, no-inspection bid is the buyer saying they will own whatever is still hiding.",
        visual: "condition",
        bullets: [
          "Upgrades already done: roof, half remodel, half siding, newer HVAC",
          "Still unknown: crawl, moisture history, age systems behind the new work",
          "As-is + no inspection = buyer prices the unknown, not the kitchen",
        ],
        stat: { value: "As-is", label: "Offer skips inspection on purpose" },
      },
      {
        id: "look",
        eyebrow: "Know before you answer",
        title: "A cheap private look beats guessing on $230,000.",
        body:
          "Hire your own inspector — paid by you, for you. A standard home inspection on a house this size usually runs about $350–$550. If you want a deeper crawl or moisture look, figure roughly $150–$400 more (mold sampling, if you choose it, can add a few hundred on top). All-in, a solid private package is often about $400–$900 — small money next to an $80,000 gap versus a clean mid-point. That report is not the buyer’s inspection. This offer is as-is with no inspection, so you are not obligated to hand them your private results; they already agreed to take condition risk without one. Use the look to decide whether $230,000 is smart for you. (If you later list to a normal retail buyer, plan to share what you know — that is a different path.)",
        visual: "none",
        bullets: [
          "Typical cost: ~$350–$550 for a home inspection; ~$400–$900 if you add crawl/moisture work",
          "As-is, no-inspection buyer: you do not have to give them your private report",
          "Retail listing later is different — then what you know usually gets disclosed",
        ],
        stat: { value: "~$400–900", label: "Typical private inspection package to size the risk" },
      },
      {
        id: "repairs",
        eyebrow: "Repair math",
        title: "When fixing still beats $230,000 — and when it does not.",
        body:
          `List near ${money(LIST_CLEAN)} with about 6% realtor fees and you keep roughly ${money(LIST_NET_BEFORE_REPAIRS)} before repair spend. The as-is offer is ${money(OFFER_AS_IS)} with no realtor fee. That leaves about ${money(BREAKEVEN_REPAIRS)} of headroom for fixes before the list path falls behind $230,000 on pure cash. Under that line, fixing (or a modest credit) still wins. Over it — or if you will not fix and will not wait — the as-is check starts to make sense.`,
        visual: "repairs",
        bullets: [
          `Repairs under ~$25,000: listing path still clearly ahead of $230,000`,
          `Repairs ~$40,000–$50,000: gap shrinks; stress and time start to matter`,
          `Repairs over ~${money(BREAKEVEN_REPAIRS)}: $230,000 as-is can win on math alone`,
        ],
        stat: { value: money(BREAKEVEN_REPAIRS), label: "Approx. repair spend where $230k ties a clean list" },
      },
      {
        id: "worth",
        eyebrow: "Price bands",
        title: "Retail if clean enough — risk price if not.",
        body:
          "If leftover issues are ordinary and handled, a fair sale still looks about $275,000–$345,000 (mid near $310,000). If inspection fallout is heavy and you sell as-is with no work, buyers discount into a lower band — closer to $230,000–$280,000 — because they own the cleanup and the unknown.",
        stat: { value: "$230–280k", label: "As-is band when inspection risk stays with the buyer" },
        visual: "schools",
      },
      {
        id: "offer",
        eyebrow: "The offer",
        title: "$230,000 is pricing unfinished risk — not the remodel.",
        body:
          "No realtor fee and no inspection only make sense if the buyer expects real findings. Against a clean mid-point it looks low. Against “tree-damage ranch, unknown leftovers, sell today,” it sits near the bottom of a hard as-is band — not a retail bid, but not random either.",
        stat: { value: "−$80k", label: "vs clean mid-point · near as-is floor" },
        visual: "nets",
      },
      {
        id: "call",
        eyebrow: "Bottom line",
        title: "Get a private scope. Then pick the lane.",
        body:
          "Do not accept or reject $230,000 on vibe. Spend a little on your own inspection math. If the stack of fixes is modest, counter or list. If the stack is large and you want out without more work, $230,000 as-is becomes a rational exit — especially with no realtor fee.",
        bullets: [
          "Next step: private inspection (~$350–$550, or ~$400–$900 with crawl/moisture) — keep the report; this buyer is not owed it",
          "If total fix-up stays well under ~$60,000: push past $230,000 or list",
          "If fixes clear ~$60,000+ and you will not do them: $230,000 as-is can be fair",
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
        "Clean enough after ordinary post-damage catch-up: about $275,000–$345,000 (mid near $310,000). Heavy unresolved inspection risk sold as-is: about $230,000–$280,000. The $230,000 offer is the floor of that risk band — fair when repair math turns negative, low when leftovers are modest.",
      recommendation:
        "Spend ~$400–$900 on a private inspection package first (you keep the report; this as-is buyer is not owed it). If total fix-up stays well under ~$60,000, push past $230,000 or list. If repairs clear that line and you will not do them, the as-is offer is in range.",
    },
    notebook: {
      title: "Repair headroom vs. the as-is check",
      paragraphs: [
        "Clean-house story: nearby sales and estimates still point near $305,000–$320,000. New roof and remodel support that when the house inspects like a finished project.",
        "Risk story: a 1976 ranch open to weather after a tree invites inspection attention — crawl, moisture, insulation, age systems, and sometimes mold. That is normal for this history, not a separate mystery.",
        `List path math: ${money(LIST_CLEAN)} sale − ~6% fees ≈ ${money(LIST_NET_BEFORE_REPAIRS)} before repairs. As-is path: ${money(OFFER_AS_IS)} with $0 realtor fee. Headroom for fixes before $230,000 wins: about ${money(BREAKEVEN_REPAIRS)}.`,
        "Example stacks (ballparks, not quotes): light moisture + punch list ~$8,000–$20,000 → list path still much better. Crawl/moisture work + systems catch-up ~$25,000–$45,000 → still often ahead, but closer. Wide remediation + structural/systems pile ~$60,000–$80,000+ → $230,000 can be the better cash answer.",
        "How to know without guessing: pay for your own inspector (about $350–$550 for a standard visit on this size home) and, if needed, a crawl/moisture add-on (often putting a fuller package around $400–$900). That look is for your decision on this offer.",
        "This buyer waived inspection and is buying as-is. You are not obligated to provide them your private inspection results — the report is yours. They already priced unknowns without seeing it. (Listing to a normal retail buyer later is a different lane; then plan to share what you know.)",
        "Recommendation: private scope → total the likely fixes → if you are clearly under the ~$60,000 headroom and willing to finish, counter or list; if you are over it (or unwilling), $230,000 as-is is a rational exit.",
      ],
    },
    researchDate: "August 12, 2026",
    sources: [
      "Property condition notes (tree damage, roof, remodel, siding, HVAC)",
      "Public estimate and tax data (Zillow)",
      "Recent area sales reported through public listing sites",
      "Typical residential repair / remediation cost ranges (industry ballparks; not a quote)",
      "Typical Springfield-area home inspection fee ranges (industry ballparks; not a quote)",
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
        title: "What usually does not create two-of-three",
        summary: "Plain joint accounts & TOD alone",
        detail:
          "A normal joint bank account often allows any single owner to withdraw. Transfer-on-death / payable-on-death designations help after death, but they do not create shared approval while everyone is living. Ask the bank for dual-control language specifically.",
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
          "The financial job after a sale is simple: do not let the full proceeds sit where one person can move them alone. Use a living trust with three co-trustees, a two-of-three approval rule, and a bank card that matches. Confirm the details with an attorney and the bank — this is a map, not a form.",
        bullets: [
          "Structure: living trust + three co-trustees",
          "Rule: any two of three to move money",
          "Account: trust-titled with dual authorization",
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
        "Before closing, set a living trust with three co-trustees and a two-of-three rule, open a trust-titled dual-control account, and give title those payee instructions — or park briefly in attorney escrow until that is ready.",
    },
    notebook: {
      title: "Sale proceeds — money control only",
      paragraphs: [
        "This page is not about condition, comps, or offer strategy. It is about the cash after a sale.",
        "Target setup: revocable living trust · three co-trustees · written rule that any two must approve distributions or large transfers · bank/brokerage account titled to the trust with dual authorization on the signature card.",
        "Why not a normal joint account? Because many joint accounts allow any one owner to withdraw. That fails the two-of-three goal even if three names appear on the statement.",
        "Why not TOD/POD alone? Those designations usually matter after death. They do not create shared living approval for moving money today.",
        "Timing: finish the trust and account before closing when you can. If you cannot, use attorney escrow as a short bridge, then move funds into the dual-control trust account.",
        "Closing instructions: the payee name on the wire / check should match the trust (or escrow), not an individual’s everyday account.",
        "Not legal or tax advice — confirm the document language and bank card with an attorney and the institution that will hold the funds.",
      ],
    },
    researchDate: "August 12, 2026",
    sources: [
      "General trust / multi-signer account patterns (educational overview; not legal or tax advice)",
      "Typical dual-authorization / co-trustee banking practices (confirm with the holding bank)",
    ],
  },
};

export function getStory(slug: string): ClientStory | null {
  return STORIES[slug] ?? null;
}

export const STORY_SLUGS = Object.keys(STORIES);
