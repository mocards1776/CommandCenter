import type { ClientStory } from "./types";

const DISTRICT_COUNTIES_1883 = [
  "Greene",
  "Webster",
  "Lawrence",
  "Barry",
  "McDonald",
  "Newton",
  "Jasper",
  "Barton",
  "Dade",
  "Cedar",
  "Vernon",
  "St. Clair",
  "Bates",
  "Henry",
];

export const FYAN_STORY: ClientStory = {
  slug: "robert-washington-fyan",
  metaTitle: "Robert Washington Fyan — Family Brief",
  brand: "Thompson Family History",
  brandTag: "A private family brief",
  markSrc: "/stories/robert-w-fyan.jpg",
  layout: "portrait",
  portraitSrc: "/stories/robert-w-fyan.jpg",
  portraitCredit: "St. Louis Daily Globe-Democrat, November 6, 1890 · Wikimedia Commons",
  family: {
    names: "Ken, Wally and John Thompson",
    relation: "Great-great-great-grandsons",
    body:
      "Robert Washington Fyan is the great-great-great-grandfather of Ken, Wally and John Thompson. This brief is for them — a Marshfield congressman, Union officer, and circuit judge, written as a scroll they can share.",
  },
  cover: {
    display: "Fyan",
    sub: "Great-great-great-grandfather",
    meta: "Robert Washington Fyan · 1835–1896 · Marshfield, Missouri",
    statValue: "3 terms",
    statLabel: "U.S. House · Missouri 13th",
    compareWarn: "Missed 42.3% of roll calls",
    compareGood: "Moderate Democrat · DW-NOMINATE −0.335",
  },
  address: "Robert Washington Fyan",
  cityLine: "Marshfield, Missouri · 13th Congressional District",
  heroLine:
    "He is the great-great-great-grandfather of Ken, Wally and John Thompson. Union major, circuit judge, and a three-term Democratic congressman from the southwest Missouri 13th.",
  support:
    "A Grok voting-record read still holds: moderate Missouri Democrat, high absences, occasional party breaks. The House he served had no FEC donor file — campaign cash from 1882–1892 was not itemized the way it is now.",
  keyNumbers: [
    { label: "House terms", value: "3", tone: "good" },
    { label: "District", value: "MO-13", tone: "neutral" },
    { label: "Party", value: "Democrat", tone: "neutral" },
    { label: "Missed votes", value: "42.3%", tone: "warn" },
    { label: "Ideology", value: "−0.335", tone: "good" },
    { label: "1882 majority", value: "1,480", tone: "good" },
  ],
  callouts: [
    {
      title: "Ken · Wally · John Thompson",
      body:
        "Fyan is their great-great-great-grandfather. Marshfield and Webster County are the through-line — the same ground as later Thompson family land in the county.",
    },
    {
      title: "No itemized campaign contributions survive",
      body:
        "The FEC did not exist until the 1970s. House campaigns in the 1880s were not required to publish donor lists. SHSMO’s Fyan papers are military receipts, not a campaign ledger. What we have are election totals, not checks.",
    },
  ],
  compareCards: [
    {
      title: "What the roll calls show",
      cost: "GovTrack + VoteView · 48th, 52nd, 53rd Houses",
      answers: "Attendance, DW-NOMINATE placement, and how often he sat with Democrats",
      doesNot: "Does not explain why he missed a given vote",
    },
    {
      title: "What the donor file cannot show",
      cost: "No FEC / no 1880s House disclosure statute",
      answers: "Why the contribution search comes back empty",
      doesNot: "Does not mean he ran without money — only that the names and dollars were not filed",
    },
  ],
  geo: {
    lat: 37.3392,
    lng: -92.9071,
    label: "Marshfield, Webster County, Missouri",
  },
  facts: [
    { label: "Born", value: "Mar 11, 1835" },
    { label: "Died", value: "Jul 28, 1896" },
    { label: "Home", value: "Marshfield, MO" },
    { label: "Party", value: "Democrat" },
    { label: "House", value: "MO-13 · 3 terms" },
    { label: "War", value: "Union · 24th & 46th Mo." },
    { label: "Bench", value: "14th circuit · 1866–83" },
    { label: "Buried", value: "Lebanon Cemetery" },
  ],
  condition: [
    {
      label: "Lawyer",
      status: "new",
      detail: "Admitted 1858. Practiced in Marshfield; county attorney 1859.",
    },
    {
      label: "Union officer",
      status: "recent",
      detail:
        "Webster County Home Guards, then captain of Co. B, 24th Missouri Infantry (major), and the 46th Missouri. Letter from Taney County after Pea Ridge, April 17, 1862.",
    },
    {
      label: "Prosecutor",
      status: "partial",
      detail:
        "Circuit attorney in Springfield, 1865–66. In July 1866 he prosecuted James Butler “Wild Bill” Hickok for killing Dave Tutt — and lost.",
    },
    {
      label: "Circuit judge",
      status: "recent",
      detail: "14th judicial circuit of Missouri, April 1866 to January 1883. 1875 state constitutional convention.",
    },
    {
      label: "1880 cyclone",
      status: "concern",
      detail:
        "Wife Elizabeth “Lizzie” P. Hyer of Dent County died in the April 18, 1880 tornado that wrecked Marshfield.",
    },
    {
      label: "Congress",
      status: "new",
      detail:
        "Democrat, Missouri’s 13th district: 48th Congress (1883–85), then 52nd and 53rd (1891–95). Lost 1884 to Republican William H. Wade; beat Wade in 1890.",
    },
  ],
  repairs: [],
  proceedsOptions: [],
  schools: [],
  districtMaps: [
    {
      id: "mo13-1883",
      title: "Missouri’s 13th · 48th Congress",
      years: "1883–1885",
      congress: "48th Congress (elected 1882)",
      counties: DISTRICT_COUNTIES_1883,
      note:
        "Fourteen whole counties, from the History of Henry County (1883) listing the new 14-district apportionment. Marshfield (Webster) and Springfield (Greene) sit in the east of the district; Joplin-country (Jasper, Newton, McDonald) on the west.",
    },
    {
      id: "mo13-1891",
      title: "Missouri’s 13th · 52nd & 53rd Congresses",
      years: "1891–1895",
      congress: "52nd–53rd (elected 1890, 1892)",
      counties: DISTRICT_COUNTIES_1883,
      note:
        "Fyan still sat as MO-13 from Marshfield. Missouri’s 1885 act kept fourteen House seats; the 1893 act (fifteen seats) governed the 1894 election, after he retired. Successor John H. Raney of Piedmont is the tell that the next map pulled the 13th southeast.",
    },
  ],
  voteRows: [
    { period: "Dec 1883–Feb 1884", eligible: 34, missed: 0, pct: 0, percentile: "0th" },
    { period: "Mar–May 1884", eligible: 71, missed: 14, pct: 19.7, percentile: "37th" },
    { period: "Jun–Jul 1884", eligible: 83, missed: 55, pct: 66.3, percentile: "85th" },
    { period: "Dec 1884–Mar 1885", eligible: 146, missed: 82, pct: 56.2, percentile: "93rd" },
    { period: "Dec 1891–Feb 1892", eligible: 30, missed: 21, pct: 70.0, percentile: "96th" },
    { period: "Mar–May 1892", eligible: 83, missed: 26, pct: 31.3, percentile: "39th" },
    { period: "Jun–Aug 1892", eligible: 110, missed: 61, pct: 55.5, percentile: "78th" },
    { period: "Dec 1892–Mar 1893", eligible: 81, missed: 44, pct: 54.3, percentile: "82nd" },
    { period: "Aug–Nov 1893", eligible: 68, missed: 14, pct: 20.6, percentile: "25th" },
    { period: "Dec 1893–Feb 1894", eligible: 89, missed: 3, pct: 3.4, percentile: "8th" },
    { period: "Mar–May 1894", eligible: 100, missed: 78, pct: 78.0, percentile: "75th" },
    { period: "Jun–Aug 1894", eligible: 68, missed: 13, pct: 19.1, percentile: "14th" },
    { period: "Dec 1894–Mar 1895", eligible: 48, missed: 17, pct: 35.4, percentile: "70th" },
  ],
  chapters: [
    {
      id: "family",
      eyebrow: "This family",
      title: "Great-great-great-grandfather of Ken, Wally and John Thompson.",
      body:
        "The line runs from a Bedford Springs lawyer who made Marshfield his town, through Webster County, to three Thompson brothers. This page is the shareable version of that fact — not a Wikipedia stub, a family brief.",
      visual: "family",
      bullets: [
        "Ken Thompson · Wally Thompson · John Thompson",
        "Relation: great-great-great-grandsons of Robert Washington Fyan (1835–1896)",
        "Place that still connects: Marshfield / Webster County, Missouri",
      ],
      stat: { value: "3g", label: "Great-great-great-grandsons · Ken, Wally, John" },
    },
    {
      id: "origin",
      eyebrow: "Who he was",
      title: "Pennsylvania-born. Missouri-made.",
      body:
        "Born March 11, 1835, at Bedford Springs, Pennsylvania. Common schools, then the bar in 1858, then Marshfield. By 1859 he was county attorney. Webster County is where the rest of the story happens.",
      visual: "portrait",
      bullets: [
        "March 11, 1835 – July 28, 1896 (age 61)",
        "Admitted to the bar 1858 · practice in Marshfield",
        "Lived in Lebanon by 1870; back in Webster County before 1880",
        "Buried Lebanon Cemetery, Laclede County",
      ],
      stat: { value: "1858", label: "Year he was admitted and opened in Marshfield" },
    },
    {
      id: "war",
      eyebrow: "The war",
      title: "A Union Democrat from a split state.",
      body:
        "June 1861: into Federal service. Hampton’s regiment and the Webster County Home Guards, then captain of Company B, 24th Missouri Infantry — later major — and the 46th Missouri. After Pea Ridge he wrote home from Taney County (April 17, 1862). That Union record is why a later Democratic House member from southwest Missouri does not read like a Deep-South Bourbon Democrat.",
      visual: "none",
      bullets: [
        "24th Missouri Infantry · Co. B captain, then major",
        "46th Missouri Infantry",
        "SHSMO papers: clothing receipts, a deceased officer’s effects, and that 1862 letter",
      ],
      stat: { value: "Union", label: "24th & 46th Missouri Infantry" },
    },
    {
      id: "bench",
      eyebrow: "The bench",
      title: "Seventeen years as circuit judge — then Congress.",
      body:
        "Circuit attorney in Springfield, 1865–66, including the failed Hickok prosecution. Circuit judge of the 14th judicial circuit from April 1866 to January 1883. In 1875 he sat on Missouri’s constitutional convention. In 1879 he presided over Laclede County’s first legal hanging (State v. Joseph Core). April 18, 1880: the Marshfield cyclone killed his wife, Elizabeth “Lizzie” P. Hyer.",
      visual: "condition",
      bullets: [
        "Hickok–Tutt, July 1866 — prosecutor, not the winner",
        "14th circuit judge, 1866–1883",
        "1875 Missouri constitutional convention",
        "Lizzie Hyer Fyan died in the 1880 Marshfield tornado",
      ],
      stat: { value: "17 yrs", label: "On the 14th circuit before the House" },
    },
    {
      id: "congress",
      eyebrow: "The House",
      title: "Three terms in a swing Ozarks district.",
      body:
        "Elected Democrat to the 48th Congress in 1882: 13,904 to William W. Cloud’s 12,424, with Greenbacker J. S. Hazeltine on 6,122 — majority 1,480. Lost the seat in 1884 to Republican William H. Wade of Springfield. Took it back in 1890 (Wade again), held it in 1892 against J. B. Whitledge, and retired rather than run in 1894.",
      visual: "compare",
      bullets: [
        "1882: Fyan (D) 13,904 · Cloud 12,424 · Hazeltine 6,122 · maj. 1,480",
        "1884: lost to William H. Wade (R, Springfield)",
        "1890: beat Wade; Union Labor also on the ballot",
        "1892: beat J. B. Whitledge (R); C. W. Harding (Ind.)",
        "1894: retired · John H. Raney (R, Piedmont) took the next map’s 13th",
      ],
      stat: { value: "1,480", label: "1882 plurality in the new 13th" },
    },
    {
      id: "maps",
      eyebrow: "The maps",
      title: "Fourteen counties. Springfield to the Kansas line.",
      body:
        "The 1882 apportionment built a 14-seat Missouri House. Fyan’s 13th was not the later Lead-Belt 13th. In 1883 it was Greene, Webster, Lawrence, Barry, McDonald, Newton, Jasper, Barton, Dade, Cedar, Vernon, St. Clair, Bates, and Henry — Marshfield and Springfield on one side, Joplin-country and the western border counties on the other.",
      visual: "districtMap",
      bullets: [
        "48th Congress map (1883–85): fourteen whole counties, listed in 1883",
        "Home pin: Marshfield, Webster County",
        "Rival pin: Springfield, Greene County (Wade, 1885–91)",
        "1893’s fifteen-district act is why the number “13th” later means Piedmont, not Marshfield",
      ],
      stat: { value: "14", label: "Counties in the 1883 13th district" },
    },
    {
      id: "votes",
      eyebrow: "The Grok read",
      title: "Moderate Democrat. High absences. Occasional party breaks.",
      body:
        "That is the VoteView / GovTrack picture, and it is what the shared Grok conversation named. Lifetime DW-NOMINATE first dimension −0.335: a Democrat, not a Republican, and not the most partisan Democrat in the room. On the 53rd House he sits more liberal than 69% of the chamber and more conservative than 51% of Democrats — the middle of his own party. Across three terms he missed 428 of 1,011 roll calls (42.3%), a little above the 37% median for members still serving in March 1895. Attendance was uneven: perfect in his first weeks, then long stretches above 50% missed, then a sharp 3.4% miss rate in winter 1893–94.",
      visual: "votes",
      bullets: [
        "DW-NOMINATE dim-1 −0.335 · dim-2 0.46 (VoteView, ICPSR 3418)",
        "53rd House: more liberal than 69% of members · more conservative than 51% of Democrats",
        "Missed 428 / 1,011 roll calls = 42.3% (GovTrack lifetime)",
        "Party breaks: a Union-veteran Democrat from a district that elected a Republican (Wade) for three terms between Fyan’s stays — he did not vote like a machine regular",
        "Shared Grok brief: grok.com/share/…fddb9f67-c2df-4c5b-bd1f-9415b0e26e78",
      ],
      stat: { value: "42.3%", label: "Missed roll calls · three House terms" },
    },
    {
      id: "money",
      eyebrow: "Campaign money",
      title: "The contribution file is empty. That is the finding.",
      body:
        "There is no itemized list of who paid for Fyan’s 1882, 1890, or 1892 races. The Federal Election Campaign Act is 1971. The Tillman Act (no corporate treasury money) is 1907 — eleven years after he died. Nineteenth-century House campaigns ran on party committees, assessments, and cash that newspapers almost never printed as a donor table. The State Historical Society of Missouri’s Fyan papers are a Civil War letter and quartermaster receipts, not a campaign account book. What we can still count are votes, not dollars.",
      visual: "none",
      bullets: [
        "FEC / modern donor databases: no coverage (he died 1896)",
        "SHSMO R0567: military papers only",
        "Hyer–Fyan family letters (R1426): personal, 1875–1888, not a finance file",
        "Surviving 1882 tally: 13,904 votes — the public record of support, not of checks",
        "Typical of the era: state party and local Democrats, not disclosed PACs",
      ],
      stat: { value: "$0 filed", label: "Itemized federal contributions on record" },
    },
    {
      id: "place",
      eyebrow: "Marshfield",
      title: "The town is the through-line.",
      body:
        "He practiced there, buried a wife there after the 1880 cyclone, represented it in Washington, died there on July 28, 1896, and was taken to Lebanon Cemetery. For Ken, Wally and John Thompson, Webster County is not an abstract district number. It is the same county.",
      visual: "map",
      bullets: [
        "Marshfield, Webster County · 37.34° N, 92.91° W",
        "Died in Marshfield, July 28, 1896",
        "Interred Lebanon Cemetery, Laclede County",
      ],
    },
    {
      id: "call",
      eyebrow: "Keep this",
      title: "A Union judge from Marshfield who held a swing seat.",
      body:
        "Three House terms, a competitive 13th, a moderate Democratic voting record, and a missing donor file because the country did not yet keep one. The family sentence is the one that matters for the people this link is for: Robert Washington Fyan is the great-great-great-grandfather of Ken, Wally and John Thompson.",
      bullets: [
        "Ken, Wally and John Thompson — great-great-great-grandsons",
        "MO-13 Democrat · 1883–85 and 1891–95",
        "Moderate on DW-NOMINATE (−0.335) · 42.3% missed votes",
        "Campaign contributions: none itemized in any public archive we could open",
      ],
    },
  ],
  comps: [],
  netScenarios: [],
  valuation: {
    low: 0,
    mid: 0,
    high: 0,
    offer: 0,
    zest: 0,
    thesis:
      "Not a property brief. Fyan’s public record is military, judicial, and congressional. The 13th district he won in 1882 was fourteen southwest and west-border counties. His House ideology is a moderate Democrat with high absences.",
    recommendation:
      "Share this as family history. The line to Ken, Wally and John Thompson is great-great-great-grandfather. The maps are the 1883 fourteen-county 13th. The money chapter is an honest blank: no itemized contributions survive.",
  },
  notebook: {
    title: "The record",
    paragraphs: [
      "Robert Washington Fyan (March 11, 1835 – July 28, 1896). Great-great-great-grandfather of Ken, Wally and John Thompson. Democrat of Marshfield. Missouri’s 13th congressional district, 48th Congress (1883–85) and 52nd–53rd (1891–95).",
      "1883 district counties (fourteen): Greene, Webster, Lawrence, Barry, McDonald, Newton, Jasper, Barton, Dade, Cedar, Vernon, St. Clair, Bates, Henry. Source: 1883 History of Henry County listing the new apportionment, with Fyan 13,904 · Cloud 12,424 · Hazeltine 6,122 · majority 1,480.",
      "Grok / VoteView / GovTrack: moderate Democrat (DW-NOMINATE −0.335). 53rd House — more liberal than 69% of members, more conservative than 51% of Democrats. Missed 428 of 1,011 roll calls (42.3%). Occasional party breaks fit a Union veteran in a district that sent Republican William H. Wade to the House for three terms between Fyan’s.",
      "Campaign contributions: no itemized federal or state donor list located. FEC post-dates him by ~75 years. SHSMO Fyan papers are wartime, not campaign finance.",
      "Other marks: Union 24th/46th Missouri; Hickok–Tutt prosecution 1866; 14th circuit judge 1866–83; 1875 constitutional convention; Lizzie Hyer killed in the April 18, 1880 Marshfield tornado; died Marshfield, buried Lebanon Cemetery.",
    ],
  },
  researchDate: "August 18, 2026",
  sources: [
    "Shared Grok conversation: Moderate Missouri Democrat — High Absences, Occasional Party Breaks",
    "VoteView ICPSR 3418 (DW-NOMINATE −0.335 / 0.46; 48th, 52nd, 53rd House members file)",
    "GovTrack member 404377 (missed-vote table, 428/1,011 = 42.3%)",
    "Biographical Directory of the U.S. Congress (F000436)",
    "1883 History of Henry County, Missouri (13th district counties and 1882 vote)",
    "Political Graveyard / Missouri SOS historic U.S. Representatives list (1882, 1890, 1892)",
    "State Historical Society of Missouri, Robert Washington Fyan Papers (R0567)",
    "St. Louis Daily Globe-Democrat portrait, November 6, 1890 (Wikimedia Commons)",
  ],
};
