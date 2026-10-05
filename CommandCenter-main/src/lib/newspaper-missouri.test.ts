/**
 * Run with: node --experimental-strip-types src/lib/newspaper-missouri.test.ts
 * from CommandCenter-main/.
 */
import {
  buildMissouriDesk,
  isPromoMissouriItem,
  parseCombest,
} from "./newspaper-missouri.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(
  isPromoMissouriItem({
    source: "Debt collection series",
    headline: "Empathy in debt collection: Was John wrong to confront the delinquent debtor on the radio?",
    url: "https://johncombestblog.com/f/empathy-in-debt-collection?blogcategory=Debt+collection",
  }),
  "Combest's debt-collection series is promo",
);
assert(
  isPromoMissouriItem({
    source: "Combest",
    headline: "Did John get scammed on an “emergency” loan?",
    url: "https://johncombestblog.com/f/how-to-collect-debt-after-you-loan-someone-money",
  }),
  "the companion how-to-collect post is promo",
);
assert(
  !isPromoMissouriItem({
    source: "Missouri Independent",
    headline: "Hawley and Warren to probe insurers over zero-payout claims",
    url: "https://missouriindependent.com/2026/10/05/hawley-warren",
  }),
  "straight statehouse copy stays",
);

const html = `
<p><a href="https://missouriindependent.com/2026/10/05/medicaid">Missouri Independent: Missouri rejects Medicaid hardship exceptions</a></p>
<p><a href="https://johncombestblog.com/f/empathy-in-debt-collection?blogcategory=Debt+collection">Debt collection series: Empathy in debt collection: Was John wrong to confront the delinquent debtor on the radio?</a></p>
<p><a href="https://johncombest.com/2026/10/05/monday-headlines/">Monday headlines home</a></p>
`;
const parsed = parseCombest(html);
assert(parsed.some((i) => i.headline.includes("Medicaid")), "Combest's political links stay");
assert(!parsed.some((i) => /debt collection/i.test(i.headline)), "the debt-collection series never parses in");
assert(!parsed.some((i) => /johncombest\.com/i.test(i.url)), "johncombest.com self-links are skipped");

const desk = buildMissouriDesk({
  combest: parsed,
  wires: [
    {
      id: "mo-debt",
      source: "Debt collection series",
      headline: "Empathy in debt collection: Was John wrong to confront the delinquent debtor on the radio?",
      url: "https://johncombestblog.com/f/empathy-in-debt-collection?blogcategory=Debt+collection",
      kind: "story",
      photo: null,
      dek: null,
      when: null,
    },
  ],
  scout: null,
});
assert(!desk.items.some((i) => /debt/i.test(i.headline)), "promo never reaches the Missouri desk");
assert(desk.items.some((i) => i.headline.includes("Medicaid")), "the political brief is what files");

console.log("newspaper-missouri ok");
