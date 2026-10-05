/**
 * Run with: node --experimental-strip-types src/lib/newspaper-paras.test.ts
 * from CommandCenter-main/.
 */
import {
  isAbbreviationPeriod,
  mergeShortNewspaperParas,
  newspaperParas,
  splitNewspaperSentences,
} from "./newspaper-national.ts";
import { proseParas } from "./newspaper-copy.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function assertEqual(got: unknown, want: unknown, msg: string) {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    throw new Error(`FAIL: ${msg}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
  }
}

const sen = "Sen. Flávio Bolsonaro finished first in Brazil’s presidential vote, setting up an Oct. 25 runoff against incumbent Luiz Inácio Lula da Silva after neither won a majority. The result leaves the leftist incumbent with an uphill fight in Latin America’s largest democracy.";
assertEqual(
  splitNewspaperSentences(sen),
  [
    "Sen. Flávio Bolsonaro finished first in Brazil’s presidential vote, setting up an Oct. 25 runoff against incumbent Luiz Inácio Lula da Silva after neither won a majority.",
    "The result leaves the leftist incumbent with an uphill fight in Latin America’s largest democracy.",
  ],
  "Sen. and Oct. stay inside the first sentence",
);

const coast = "The U.S. Coast Guard suspended the search for a Boston-bound medical aircraft that vanished off Nantucket. Six people were aboard.";
assertEqual(
  splitNewspaperSentences(coast),
  [
    "The U.S. Coast Guard suspended the search for a Boston-bound medical aircraft that vanished off Nantucket.",
    "Six people were aboard.",
  ],
  "U.S. does not start a new sentence",
);

const boat = "U.S. Southern Command struck a suspected narcotics vessel in the Caribbean, killing four people alleged to be traffickers. Footage showed the boat erupting in a fireball.";
assertEqual(
  splitNewspaperSentences(boat),
  [
    "U.S. Southern Command struck a suspected narcotics vessel in the Caribbean, killing four people alleged to be traffickers.",
    "Footage showed the boat erupting in a fireball.",
  ],
  "Leading U.S. stays with Southern Command",
);

const titles = "Rep. Smith and Gov. Jones met Dr. Lee, Mr. Adams, Mrs. Chen, Ms. Patel, Gen. Grant, Lt. Col. Hale, St. Louis officials and Jr. and Sr. partners at Inc., Co. and Corp. No. 12 vs. the field. The vote failed.";
const titleParts = splitNewspaperSentences(titles);
assert(titleParts.length === 2, `title abbreviations stay one sentence (${titleParts.length})`);
assert(titleParts[0]!.startsWith("Rep. Smith"), "opens on Rep.");
assert(titleParts[1]!.startsWith("The vote failed"), "real sentence still splits");

const uk = "Officials in the U.K. and at the U.N. briefed D.C. staff. Talks resume Monday.";
assertEqual(
  splitNewspaperSentences(uk),
  ["Officials in the U.K. and at the U.N. briefed D.C. staff.", "Talks resume Monday."],
  "U.K., U.N. and D.C. are not sentence ends",
);

const months = "The panel meets Jan. 4 after a Feb. memo, then Aug. 12, Sept. 1, Oct. 25, Nov. 3 and Dec. 18. A vote follows.";
assertEqual(splitNewspaperSentences(months).length, 2, "month abbreviations do not split");

const states = "Prosecutors in Calif., Fla. and Mo. joined the filing. The court set a hearing.";
assertEqual(splitNewspaperSentences(states).length, 2, "Calif., Fla. and Mo. stay attached");

const initial = "A. B. Corbin said the rule would stand. The justices noted the split.";
assertEqual(
  splitNewspaperSentences(initial),
  ["A. B. Corbin said the rule would stand.", "The justices noted the split."],
  "single-letter initials do not split",
);

assert(isAbbreviationPeriod("Sen. Flávio", 3), "Sen. is an abbreviation period");
assert(isAbbreviationPeriod("U.S. Coast", 3), "second period of U.S. is an abbreviation");
assert(!isAbbreviationPeriod("vote failed. The", 11), "a real sentence period is not an abbreviation");

assertEqual(
  mergeShortNewspaperParas(["Sen.", "Flávio Bolsonaro finished first in Brazil."]),
  ["Sen. Flávio Bolsonaro finished first in Brazil."],
  "a 4-character stub merges into the next graf",
);
assertEqual(
  mergeShortNewspaperParas(["The U.S.", "Coast Guard suspended the search."]),
  ["The U.S. Coast Guard suspended the search."],
  "The U.S. stub merges forward",
);
assertEqual(
  mergeShortNewspaperParas(["U.S.", "Southern Command struck a boat."]),
  ["U.S. Southern Command struck a boat."],
  "U.S. stub merges forward",
);
assertEqual(
  mergeShortNewspaperParas(["A full first sentence lives here.", "End."]),
  ["A full first sentence lives here. End."],
  "a trailing stub merges backward",
);

assertEqual(
  newspaperParas(sen),
  [
    "Sen. Flávio Bolsonaro finished first in Brazil’s presidential vote, setting up an Oct. 25 runoff against incumbent Luiz Inácio Lula da Silva after neither won a majority.",
    "The result leaves the leftist incumbent with an uphill fight in Latin America’s largest democracy.",
  ],
  "string summary becomes two grafs without breaking Sen.",
);

assertEqual(
  newspaperParas(["The U.S.", "Coast Guard suspended the search for the plane."]),
  ["The U.S. Coast Guard suspended the search for the plane."],
  "Grok array still runs the short-graf guard",
);

assertEqual(
  newspaperParas(["Sen. Flávio Bolsonaro finished first in Brazil’s presidential vote.", "The result leaves Lula with an uphill fight."]),
  [
    "Sen. Flávio Bolsonaro finished first in Brazil’s presidential vote.",
    "The result leaves Lula with an uphill fight.",
  ],
  "a real Grok paragraph array is kept",
);

const longAbbrev =
  `${"Word ".repeat(80)}Sen. Flávio Bolsonaro spoke in D.C. after the U.S. filing. ${"More copy follows here. ".repeat(20)}`;
const longParas = proseParas(longAbbrev);
assert(longParas.every((p) => !/^(?:Sen\.|U\.S\.|D\.C\.)$/.test(p.trim())), "long-copy proseParas never emits a lone abbreviation");
assert(longParas.every((p) => p.length >= 25), "grouped long copy still merges stubs under 25 characters");

console.log("newspaper-paras ok");
