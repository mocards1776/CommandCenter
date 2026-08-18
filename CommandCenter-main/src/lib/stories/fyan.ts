import type { ClientStory } from "./types";
import { PLAN_48_D13, PLAN_50_D13, PLAN_15_D13 } from "./missouriCounties";
import {
  PRES_1888_DEM,
  PRES_1888_GOP,
  PRES_1892_DEM,
  PRES_1892_GOP,
  PRES_2024_DEM,
  PRES_2024_GOP,
} from "./missouriPres";

const D13_48 = [...PLAN_48_D13];
const D13_50 = [...PLAN_50_D13];
const D13_53 = [...PLAN_15_D13];

export const FYAN_STORY: ClientStory = {
  slug: "robert-washington-fyan",
  metaTitle: "Robert Washington Fyan — Marshfield, Missouri 13th",
  brand: "Thompson Family History",
  brandTag: "Marshfield · the 13th · 1835–1896",
  markSrc: "/stories/robert-w-fyan.jpg",
  layout: "portrait",
  portraitSrc: "/stories/robert-w-fyan.jpg",
  portraitCredit: "St. Louis Daily Globe-Democrat, November 6, 1890 · Wikimedia Commons",
  family: {
    names: "Ken, Wally and John Thompson",
    relation: "Great-great-great-grandsons",
    body: "Marshfield is the through-line.",
  },
  cover: {
    display: "Fyan",
    sub: "Marshfield · Missouri’s 13th",
    meta: "Robert Washington Fyan · 1835–1896",
    statValue: "3 terms",
    statLabel: "U.S. House · 48th, 52nd, 53rd",
    compareWarn: "Missed about two votes in five",
    compareGood: "A Democrat in the middle of his party",
  },
  address: "Robert Washington Fyan",
  cityLine: "Marshfield, Missouri · 13th Congressional District",
  heroLine:
    "Great-great-great-grandfather of Ken, Wally and John Thompson. A Union major who became the 14th-circuit judge, then a three-term Democrat in a district that could go either way.",
  support:
    "He sat in the House under three presidents — Chester A. Arthur, then Benjamin Harrison, then Grover Cleveland again — and never under a Republican majority. The fights that defined those years were silver, the tariff, and, in 1893, a financial panic. The rest of this scroll is that story, in order.",
  keyNumbers: [
    { label: "House terms", value: "3", tone: "good" },
    { label: "District", value: "MO-13", tone: "neutral" },
    { label: "Party", value: "Democrat", tone: "neutral" },
  ],
  callouts: [],
  compareCards: [
    {
      title: "Who was in charge",
      cost: "The White House and the House",
      answers:
        "Arthur when Fyan first seated (1883). Harrison when he came back (1891). Cleveland when the crash hit (1893). Democrats ran the House all three of his terms — they had taken it in the 1882 wave, taken it again in 1890, and still held it in the 53rd Congress.",
      doesNot:
        "He was out of office for Cleveland’s entire first term (1885–89). William H. Wade of Springfield held the 13th those years.",
    },
    {
      title: "What a dollar bought",
      cost: "U.S. city averages, 1890",
      answers:
        "A half-gallon of milk was about 14¢, so a gallon ran roughly 27¢. Eggs were about 21¢ a dozen, butter 26¢ a pound, round steak 12¢ a pound. A factory hand made on the order of a dollar and a half a day. The point is scale: a congressional race in this country was still a world where a quarter bought a gallon of milk.",
      doesNot: "These are national city averages from the Bureau of Labor / Historical Statistics — not a Marshfield grocer’s ledger.",
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
        "Webster County Home Guards, then captain of Co. B, 24th Missouri Infantry (later major), and the 46th Missouri.",
    },
    {
      label: "Prosecutor",
      status: "partial",
      detail:
        "Circuit attorney in Springfield, 1865–66. Prosecuted Wild Bill Hickok for killing Dave Tutt in July 1866 — and lost.",
    },
    {
      label: "Circuit judge",
      status: "recent",
      detail: "14th judicial circuit, April 1866 to January 1883. Sat on the 1875 state constitutional convention.",
    },
    {
      label: "1880 cyclone",
      status: "concern",
      detail: "Elizabeth “Lizzie” P. Hyer of Dent County, his wife, died in the April 18, 1880 cyclone.",
    },
    {
      label: "Congress",
      status: "new",
      detail:
        "Missouri’s 13th: 1883–85, then 1891–95. Lost the 1884 nomination, beat Wade in 1890, retired in 1894.",
    },
  ],
  repairs: [],
  proceedsOptions: [],
  schools: [],
  districtMaps: [
    {
      id: "mo-48",
      title: "Missouri · 14 seats · 48th Congress",
      years: "1883–1885",
      congress: "Elected 1882 · Arthur in the White House",
      plan: "48",
      counties: D13_48,
      note:
        "Each county is filled with its district color. The 13th is red: Springfield and Joplin-country with Webster, Christian, Taney, Stone, Polk, and Dallas. The western border counties — Henry, Bates, Vernon — sit in the 12th. St. Louis city was carved into more than one seat; it shows here as one fill.",
    },
    {
      id: "mo-50",
      title: "Missouri · 14 seats · 50th–52nd Congresses",
      years: "1887–1893",
      congress: "After the 1885 tweak · the map of the 1890 comeback",
      plan: "50",
      counties: D13_50,
      note:
        "Still fourteen seats. Dallas and Polk moved to the 6th; Jasper to the 12th. The 13th that sent Fyan back is nine counties, Springfield still in it, Marshfield still the home pin.",
    },
    {
      id: "mo-53",
      title: "Missouri · 15 seats · 53rd Congress",
      years: "1893–1895",
      congress: "Elected 1892 · Cleveland’s second term",
      plan: "53",
      counties: D13_53,
      note:
        "The 1890 census added a fifteenth seat. Webster stays in the 13th. Greene does not — Springfield goes to the 7th. The new 13th runs Marshfield through Wright and Texas County into the Lead Belt. That is why the next man in the 13th is John H. Raney of Piedmont.",
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
  electionRows: [
    {
      year: "1882",
      date: "November 7, 1882",
      result: "won",
      headline: "Fyan 13,904 · Cloud 12,424 · Hazeltine 6,122",
      detail:
        "First race on the new 14-district map. He beat Republican William W. Cloud (also listed as William T. Cloud) by 1,480 votes — a plurality, not a majority of all ballots, because Greenbacker J. S. / Ira S. Hazeltine took 6,122. Nationally this was the Democratic wave year.",
    },
    {
      year: "1884",
      date: "November 4, 1884",
      result: "lost",
      headline: "Lost the nomination. Wade 50.3% · Thomas 45.0% · Haseltine 4.7%",
      detail:
        "Fyan was not on the November ballot. A. L. Thomas was the Democrat. Republican William H. Wade of Springfield won the same day Cleveland beat Blaine for president.",
    },
    {
      year: "1886",
      date: "November 2, 1886",
      result: "out",
      headline: "Wade 51.8% · Cravens 44.9% · Sobicski 3.3%",
      detail: "Fyan did not run. Jeremiah C. Cravens was the Democrat. Wade held.",
    },
    {
      year: "1888",
      date: "November 6, 1888",
      result: "out",
      headline: "Wade 48.4% · Matclock 40.0% · Alter 11.1%",
      detail:
        "Still out. C. C. Matclock was the Democrat. Union Labor took a real bite. Harrison beat Cleveland for president.",
    },
    {
      year: "1890",
      date: "November 4, 1890",
      result: "won",
      headline: "Fyan 49.9% · Wade 41.6% · Vertrees 8.5%",
      detail:
        "The McKinley-tariff midterm. Democrats took the House 238–86, with 8 Populists. Fyan beat the incumbent. Harrison was still president when this Congress sat.",
    },
    {
      year: "1892",
      date: "November 8, 1892",
      result: "won",
      headline: "Fyan 57.05% · Whitledge 42.82% · Harding 0.13%",
      detail:
        "Cleveland returned to the White House. Missouri now elected fifteen members. Webster stayed in the 13th; Springfield did not. Comfortable win over J. B. Whitledge.",
    },
    {
      year: "1894",
      date: "November 6, 1894",
      result: "retired",
      headline: "Raney 51.3% · Fox 48.7%",
      detail:
        "Fyan did not run. After the Panic of 1893, John H. Raney of Piedmont took the Lead-Belt 13th from James D. Fox.",
    },
  ],
  billVotes: [
    {
      date: "Jan 31, 1884",
      congress: "48th",
      cast: "Yea",
      bill: "H.R. 3933 · Texas-Pacific land forfeiture",
      note:
        "Voted to take back unused railroad land grants. No donor file names the Frisco or anyone else as a backer. This is the railroad vote that survives: against the giveaway, not for it.",
    },
    {
      date: "May 6, 1884",
      congress: "48th",
      cast: "Nay",
      bill: "H.R. 5893 · kill a tariff-cut bill",
      note:
        "Nay on striking the enacting clause — that is, he voted against killing a bill to cut import duties. A Democrat for lower tariffs, in Arthur’s last full year.",
    },
    {
      date: "Dec 17, 1884",
      congress: "48th",
      cast: "Yea",
      bill: "H.R. 5461 · railroad passenger separation",
      note:
        "On a failed interstate-commerce bill, he voted to let railroads separate white and colored passengers at their own discretion.",
    },
    {
      date: "Mar 24, 1892",
      congress: "52nd",
      cast: "Nay",
      bill: "H.R. 4426 · table free coinage of silver",
      note:
        "To “table” a bill is to kill it without a vote on the merits. He voted Nay — keep Bland’s free-silver bill alive. That is the Ozarks silver-Democrat tell.",
    },
    {
      date: "Apr 4, 1892",
      congress: "52nd",
      cast: "Yea",
      bill: "H.R. 6185 · Geary Act",
      note:
        "Yea to extend and harden Chinese exclusion. The Geary Act made the 1882 ban harsher and required Chinese residents to carry residence papers.",
    },
    {
      date: "Aug 28, 1893",
      congress: "53rd",
      cast: "Nay",
      bill: "H.R. 1 · repeal Sherman Silver Purchase Act",
      note:
        "The vote of his career. Cleveland called a special session to stop the Treasury from buying silver. The House passed repeal 239–109. Fyan voted Nay, and Yea on every free-coinage ratio amendment that failed the same day. A Marshfield Democrat against his own president on money.",
    },
    {
      date: "Feb 1, 1894",
      congress: "53rd",
      cast: "Yea",
      bill: "H.R. 4864 · Wilson tariff, House passage",
      note:
        "Yea to cut the McKinley tariff. The Senate later chewed it into Wilson–Gorman. He voted against some farm-product duty hikes on the way through.",
    },
    {
      date: "Apr 4, 1894",
      congress: "53rd",
      cast: "Absent",
      bill: "H.R. 4956 · coin silver bullion over Cleveland’s veto",
      note:
        "He had voted with Richard Bland in March to coin the Treasury’s silver, then missed the veto override. Attendance is the other half of the record.",
    },
  ],
  ideology: {
    score: -0.335,
    dim2: 0.46,
    houseMoreLiberalThan: 69,
    demsMoreConservativeThan: 51,
    axisLeft: "Democratic / more for silver & lower tariffs",
    axisRight: "Republican / more for gold & protection",
    caption:
      "VoteView’s first dimension for the 53rd House (1893–95). Negative is the Democratic side of that Congress. Fyan sits left of most of the chamber and almost exactly in the middle of the Democrats.",
  },
  presMaps: [
    {
      id: "pres-1888",
      title: "Missouri · president · 1888",
      year: "November 6, 1888",
      subtitle: "Cleveland holds the state · Harrison takes Webster",
      demLabel: "Cleveland",
      gopLabel: "Harrison",
      dem: [...PRES_1888_DEM],
      gop: [...PRES_1888_GOP],
      note:
        "County plurality, Political Graveyard. Cleveland 261,943 (50.24%), Harrison 236,252 (45.31%), Streeter (Union Labor) 3.57%. Webster, Greene, St. Louis city, and the German counties go Harrison. Little Dixie and the Bootheel go Cleveland. Fyan is out of the House this year.",
    },
    {
      id: "pres-1892",
      title: "Missouri · president · 1892",
      year: "November 8, 1892",
      subtitle: "Cleveland’s comeback · Weaver in the mix · Webster still Harrison",
      demLabel: "Cleveland",
      gopLabel: "Harrison",
      dem: [...PRES_1892_DEM],
      gop: [...PRES_1892_GOP],
      note:
        "County plurality from the Wikipedia / Dave Leip table. Cleveland 268,400 (49.56%), Harrison 227,646 (42.03%), Weaver 41,204 (7.61%). Weaver takes no county plurality. Webster: Harrison 1,389 (45.38%), Cleveland 1,273 (41.59%), Weaver 382 (12.48%). Greene: Harrison 4,839 (45.81%) to Cleveland 4,051 (38.35%). Same day Fyan wins the 13th.",
    },
    {
      id: "pres-2024",
      title: "Missouri · president · 2024",
      year: "November 5, 2024",
      subtitle: "The old two-color state, collapsed",
      demLabel: "Harris",
      gopLabel: "Trump",
      dem: [...PRES_2024_DEM],
      gop: [...PRES_2024_GOP],
      note:
        "Trump 1,751,986 (58.49%), Harris 1,200,599 (40.08%). Harris carries four units: Jackson, Boone, St. Louis County, St. Louis city. Webster: Trump 15,984 (80.67%) to Harris 3,653 (18.44%). Greene: Trump 59.33%. Jackson stays Democratic; St. Louis city, Harrison country in 1892, is now the bluest unit on the map.",
    },
  ],
  spectrum: {
    score: -0.335,
    axisLeft: "Democratic / more liberal on today’s party-line axis",
    axisRight: "Republican / more conservative on today’s party-line axis",
    caption:
      "Same first-dimension scale as the earlier VoteView card, now with 119th Congress (2025–27) members placed on it. The number is comparable. The fight that produced it is not.",
    peers: [
      {
        name: "Ron Wyden",
        office: "Senate · Oregon",
        score: -0.335,
        note: "Exact match to three decimals — the closest living seat on this scale",
      },
      {
        name: "Joe Courtney",
        office: "House · Connecticut 2nd",
        score: -0.337,
        note: "Closest House Democrat",
      },
      {
        name: "Emilia Sykes",
        office: "House · Ohio 13th",
        score: -0.332,
        note: "A few thousandths the other way",
      },
      {
        name: "House Democratic median",
        office: "119th House · 222 Democrats",
        score: -0.396,
        note: "Fyan sits a little to the right of today’s Democratic middle",
      },
      {
        name: "Jared Golden / Josh Gottheimer / Henry Cuellar",
        office: "House Democrats · conservative edge",
        score: -0.165,
        note: "Golden −0.106, Gottheimer −0.165, Cuellar −0.225 — not where Fyan sits",
      },
      {
        name: "Elizabeth Warren / Bernie Sanders",
        office: "Senate · Massachusetts / Vermont",
        score: -0.744,
        note: "Warren −0.744, Sanders −0.546 — not where Fyan sits either",
      },
    ],
    missouri: [
      {
        name: "Wesley Bell",
        office: "House · Missouri 1st",
        score: -0.472,
        note: "To Fyan’s left",
      },
      {
        name: "Emanuel Cleaver",
        office: "House · Missouri 5th",
        score: -0.454,
        note: "To Fyan’s left",
      },
      {
        name: "Ann Wagner",
        office: "House · Missouri 2nd",
        score: 0.392,
        note: "Nearest Missouri Republican — still far to Fyan’s right",
      },
      {
        name: "Sam Graves",
        office: "House · Missouri 6th",
        score: 0.449,
        note: "Republican side of the chamber",
      },
      {
        name: "Mark Alford",
        office: "House · Missouri 4th",
        score: 0.565,
        note: "Includes much of the old Ozarks country",
      },
      {
        name: "Jason Smith",
        office: "House · Missouri 8th",
        score: 0.578,
        note: "Lead Belt / southeast — the 53rd-map 13th country",
      },
      {
        name: "Robert Onder",
        office: "House · Missouri 3rd",
        score: 0.693,
        note: "Far right of Fyan’s −0.335",
      },
      {
        name: "Eric Burlison",
        office: "House · Missouri 7th",
        score: 0.734,
        note: "Springfield–Ozarks seat that covers Greene",
      },
      {
        name: "Josh Hawley",
        office: "Senate · Missouri",
        score: 0.819,
        note: "Among the most conservative scores in the 119th Senate",
      },
      {
        name: "Eric Schmitt",
        office: "Senate · Missouri",
        score: 0.884,
        note: "The state’s other senator — further still",
      },
    ],
  },
  chapters: [
    {
      id: "origin",
      eyebrow: "Who he was",
      title: "Pennsylvania-born. Missouri-made.",
      body:
        "Robert Washington Fyan was born March 11, 1835, at Bedford Springs, Pennsylvania. Common schools, the bar in 1858, then Marshfield. By 1859 he was county attorney. He spent a stretch in Lebanon around 1870 and was back in Webster County before 1880. He died in Marshfield on July 28, 1896, and was buried at Lebanon Cemetery in Laclede County.",
      visual: "portrait",
    },
    {
      id: "war",
      eyebrow: "The war",
      title: "A Union Democrat from a split state.",
      body:
        "In June 1861 he went into Federal service: Hampton’s regiment and the Webster County Home Guards, then captain of Company B, 24th Missouri Infantry — later major — and the 46th Missouri. After the battle of Pea Ridge he wrote home from Taney County, April 17, 1862. That letter is still in the State Historical Society of Missouri’s Fyan papers, with clothing receipts and a deceased officer’s effects.\n\nThat Union record is why the later House Democrat from this country does not read like a Bourbon Democrat. “Bourbon” was the name for the conservative Southern Democrats after Reconstruction — men who wanted the old planter order restored, low taxes, and white rule, and who had generally been with the Confederacy. Fyan was a Democrat, but he had worn blue. In a state that had sent men both ways, that was a different kind of Democrat, and it is part of why a Republican like Wade could also win this seat.",
      visual: "none",
      stat: { value: "Union", label: "24th & 46th Missouri Infantry" },
    },
    {
      id: "bench",
      eyebrow: "The bench",
      title: "Seventeen years as circuit judge — then Congress.",
      body:
        "After the war he was circuit attorney in Springfield, 1865–66. In July 1866 that meant prosecuting James Butler “Wild Bill” Hickok for killing Dave Tutt on the square — and losing. Then the 14th judicial circuit, April 1866 to January 1883. He sat on Missouri’s 1875 constitutional convention. In 1879 he presided over Laclede County’s first legal hanging, State v. Joseph Core. On April 18, 1880, the cyclone killed Lizzie Hyer Fyan.",
      visual: "condition",
      stat: { value: "17 yrs", label: "On the 14th circuit before the House" },
    },
    {
      id: "era",
      eyebrow: "The times",
      title: "Three presidents, a Democratic House, and 27¢ milk.",
      body:
        "When he first took his seat in December 1883, Chester A. Arthur was president — a Republican who had succeeded the assassinated Garfield — and Democrats had just seized the House in the 1882 elections, about 196 seats to 117. John G. Carlisle of Kentucky was Speaker. Fyan’s first term is that Congress.\n\nHe was then out for six years. Grover Cleveland, the first Democratic president since the war, served 1885–89. Benjamin Harrison, a Republican, beat him in 1888. Fyan came back in March 1891, still under Harrison, into a House the Democrats had retaken in the 1890 midterm: 238 Democrats, 86 Republicans, 8 Populists. Voters had punished Harrison’s party for the McKinley tariff, a high-tax law on imports.\n\nHis last term is Cleveland’s second. In 1893 banks failed and unemployment spiked — the Panic of 1893. Cleveland called Congress back to stop the government from buying silver. That fight, and a new tariff bill, ate the 53rd House.\n\nTo put a dollar in scale: in U.S. cities in 1890, the government later figured, a half-gallon of milk cost about 14¢ — call it 27¢ a gallon. Eggs were about 21¢ a dozen. Butter was 26¢ a pound. Round steak was 12¢ a pound. A factory day’s wage was in the neighborhood of a dollar and a half. Those are national city averages, not a Webster County receipt, but they are why “a gallon of milk” is a fair way to feel the 1890s.",
      visual: "compare",
    },
    {
      id: "congress",
      eyebrow: "The races",
      title: "Win, lose the nomination, wait, win, win, walk away.",
      body:
        "November 7, 1882: Fyan 13,904, Cloud 12,424, Hazeltine 6,122. The 1,480 is the gap between Fyan and Cloud — his winning margin over the Republican, not a majority of every ballot cast. Three men were on the ticket; Fyan had the most, not more than half.\n\nIn 1884 the Democrats nominated A. L. Thomas instead. Wade won with 50.3%. Fyan stayed out in 1886 and 1888 while Wade held on. He came back in 1890 with 49.9% to Wade’s 41.6%, then won easily in 1892, 57% to 43%, on a new fifteen-seat map. He did not run in 1894. Raney of Piedmont took the seat 51.3–48.7 in the depression midterm.",
      visual: "elections",
    },
    {
      id: "maps",
      eyebrow: "The maps",
      title: "Webster stays. Springfield does not.",
      body:
        "Missouri had fourteen House seats when Fyan first went to Washington and fifteen when he last sat. The maps below fill every county in the state by district. The 13th is red.\n\nIn 1883 the 13th is Springfield to Joplin-country, with Webster, Christian, Taney, and Stone in it. After 1885, Jasper, Dallas, and Polk leave; Springfield stays. In 1892 the state adds a seat. Greene — Springfield — moves to the 7th. Webster stays in the 13th, which now runs east through Wright and Texas County into the Lead Belt. Marshfield remains home. The district around it changes.",
      visual: "districtMap",
    },
    {
      id: "bills",
      eyebrow: "The votes",
      title: "Silver over Cleveland. Tariff down. Exclusion up.",
      body:
        "The votes that still have color are few, and they are not obscure. In 1892 he voted against tabling free coinage of silver — he wanted the bill kept alive — and he voted Yea on the Geary Act, which made Chinese exclusion harsher. On August 28, 1893, with Cleveland demanding an end to Treasury silver purchases, he voted Nay on repeal and Yea on every free-coinage amendment that died the same day. In 1894 he voted Yea to cut the tariff in the House.\n\nIn 1884 he voted to forfeit unused Texas-Pacific land grants. That is the railroad story the paper trail will support. No itemized campaign file names a railroad as a backer.",
      visual: "bills",
      stat: { value: "Nay", label: "On repealing Sherman silver, Aug 28, 1893" },
    },
    {
      id: "votes",
      eyebrow: "Where he sat",
      title: "A Democrat in the middle of his party — who missed a lot of votes.",
      body:
        "Political scientists Keith Poole and Howard Rosenthal built a scoring system called DW-NOMINATE from every recorded House roll call. Think of it as a seating chart. Each member gets a number, usually between −1 and +1, on the main fight of that era. In the 1890s that fight was mostly money and the tariff: silver and lower duties on the Democratic side, gold and high protection on the Republican side. Negative is Democratic. Positive is Republican. Zero is the middle of the chamber.\n\nFyan’s score on that first dimension is −0.335. He is not a Republican. He is not a radical. On the 53rd House — his last term — VoteView places him left of 69% of all members (most of the people to his right are Republicans) and to the right of 51% of Democrats. That is the middle of his own party: more conservative than half the Democrats, more liberal than most of the House.\n\nA second number, +0.46 on “dimension 2,” picks up a weaker, cross-cutting axis — regional and sectional issues that were not simply gold versus silver. It is real in the math and less useful as a label. The number that tells you who he was in the room is −0.335.\n\nAttendance is the other score. He missed 428 of 1,011 roll calls, 42.3%. The median member still serving in March 1895 missed about 37%. He was perfect in his first weeks in 1883, then gone for long stretches, then almost always present in the silver-and-tariff winter of 1893–94, when it counted.",
      visual: "ideology",
      stat: { value: "−0.335", label: "DW-NOMINATE · Democratic side of the 1890s House" },
    },
    {
      id: "place",
      eyebrow: "Marshfield",
      title: "The town is the through-line.",
      body:
        "He practiced there, buried Lizzie there after the 1880 cyclone, represented it in Washington, died there on July 28, 1896, and was taken to Lebanon Cemetery. Webster County is not an abstract district number. It is the ground under the three terms, the lost nomination, and the comeback.",
      visual: "none",
    },
    {
      id: "president",
      eyebrow: "The presidential map",
      title: "Missouri voted Cleveland. Webster voted Harrison.",
      body:
        "In the years around Fyan’s House service, Missouri was a Democratic presidential state with a real Republican geography underneath. Statewide: Cleveland 236,023 (53.49%) to Blaine 203,081 (46.02%) in 1884; Cleveland 261,943 (50.24%) to Harrison 236,252 (45.31%) in 1888; Cleveland 268,400 (49.56%) to Harrison 227,646 (42.03%) in 1892, with Weaver’s Populists at 7.61%. The county fills below are 1888 and 1892. Political Graveyard lists 1884 county plurality as “No data” for every county, so that year is statewide only — the map is not invented.\n\nThe local tell is the split ticket. Webster and Greene voted Harrison for president in both 1888 and 1892. In 1892 Webster was Harrison 1,389 (45.38%), Cleveland 1,273 (41.59%), Weaver 382 (12.48%). Greene was Harrison 4,839 (45.81%) to Cleveland 4,051 (38.35%). Those same counties sent a Democrat to the House in 1890 and 1892. Marshfield could vote Republican for president and still send Fyan to Washington.\n\nThe third map is 2024, so the old spectrum has something to sit against. Trump 1,751,986 (58.49%), Harris 1,200,599 (40.08%). Harris carried four units: Jackson, Boone, St. Louis County, and St. Louis city. Webster went Trump 15,984 to 3,653 — 80.67% to 18.44%. Greene went Trump 59.33%. Jackson, which Cleveland carried 55.90% in 1892, stayed Democratic. St. Louis city, which Harrison carried, is now the bluest unit on the map. The competitive statewide Democratic Missouri of Fyan’s lifetime is gone.",
      visual: "presMap",
      bullets: [
        "1884: Cleveland 53.49% · Blaine 46.02% · county plurality not compiled",
        "1888: Cleveland 50.24% · Harrison 45.31% · Webster and Greene Harrison",
        "1892: Cleveland 49.56% · Harrison 42.03% · Weaver 7.61% · Webster Harrison by 116 votes",
        "2024: Trump 58.49% · Harris 40.08% · Harris in four units · Webster Trump 80.67%",
      ],
      stat: { value: "Harrison", label: "Webster & Greene for president, 1888 and 1892" },
    },
    {
      id: "spectrum",
      eyebrow: "Then and now",
      title: "The number is comparable. The fight is not.",
      body:
        "VoteView’s first dimension is a seating chart built from every recorded roll call. Fyan’s number on that chart, −0.335 in the 53rd House, can be set next to the 119th Congress (2025–27). The closest living match to three decimals is Sen. Ron Wyden of Oregon, also −0.335. In the House: Joe Courtney of Connecticut (−0.337) and Emilia Sykes of Ohio (−0.332). About 66% of today’s House Democrats sit to his left. About 67% of the whole House sits to his right.\n\nThat number is not an issue-by-issue twin. The 1890s axis was silver, the tariff, and sectional fights. The 2020s axis is almost entirely party-line. Modern Democrats are compressed into a tight band, which is why a member whose public reputation is far from a Marshfield silver Democrat can land near −0.33. He does not belong with today’s most conservative House Democrats — Jared Golden (−0.106), Josh Gottheimer (−0.165), Henry Cuellar (−0.225) — and he does not belong with Elizabeth Warren (−0.744) or Bernie Sanders (−0.546). He sits a little to the right of the current House Democratic median (−0.396).\n\nMissouri’s own 119th delegation makes the geographic collapse visible in people. The two Democrats, Emanuel Cleaver (−0.454) and Wesley Bell (−0.472), sit to Fyan’s left. Every Missouri Republican sits far to his right: Ann Wagner (+0.392), Sam Graves (+0.449), Mark Alford (+0.565), Jason Smith (+0.578), Robert Onder (+0.693), Eric Burlison of the Springfield–Ozarks 7th (+0.734), and Sens. Josh Hawley (+0.819) and Eric Schmitt (+0.884). A Union Democrat from a swing 13th does not have a seat in this state’s present congressional party.",
      visual: "spectrum",
      bullets: [
        "Closest living scores: Wyden −0.335 · Courtney −0.337 · Sykes −0.332",
        "House Democratic median today −0.396 — Fyan a notch to its right",
        "Not the Blue Dog edge (Golden / Gottheimer / Cuellar) and not Warren / Sanders",
        "Missouri now: Cleaver and Bell to his left; every Republican, including Burlison, Hawley, and Schmitt, far to his right",
      ],
      stat: { value: "−0.335", label: "Same first-dimension score as Sen. Ron Wyden" },
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
      "A Marshfield Union Democrat in a swing 13th. First term under Arthur, last terms under Harrison and Cleveland. The maps change around Webster; Webster does not leave the district.",
    recommendation:
      "Three terms, a lost nomination, a comeback, and a silver vote against his own president.",
  },
  notebook: {
    title: "The record",
    paragraphs: [
      "Robert Washington Fyan (March 11, 1835 – July 28, 1896). Great-great-great-grandfather of Ken, Wally and John Thompson. Democrat of Marshfield. Missouri’s 13th, 48th Congress (1883–85) and 52nd–53rd (1891–95).",
      "Elections: 1882 won 13,904–12,424–6,122 (plurality 1,480 over Cloud). 1884 lost the nomination; Wade 50.3%, A. L. Thomas 45.0%. 1886–88 out. 1890 won 49.9%–41.6%–8.5%. 1892 won 57.05%–42.82%. 1894 retired; Raney 51.3%–Fox 48.7%.",
      "Maps: 48th 13th = Barry, Christian, Dallas, Greene, Jasper, Lawrence, McDonald, Newton, Polk, Stone, Taney, Webster. 50th–52nd drops Dallas, Jasper, Polk. 53rd keeps Webster, adds Wright, Texas, and the Lead Belt; Greene to the 7th.",
      "Votes: Nay to table free silver (1892). Yea on Geary (1892). Nay on Sherman repeal (1893). Yea on Wilson tariff House passage (1894). Yea to forfeit Texas-Pacific grants (1884). DW-NOMINATE −0.335: middle of the Democrats, left of most of the House. Missed 42.3% of roll calls.",
      "Times: Arthur, Harrison, Cleveland II. Democratic House throughout his service. 1890 U.S. city milk about 14¢ a half-gallon.",
      "Presidential maps (appended): 1884 Cleveland 53.49%–46.02% statewide; Political Graveyard has no 1884 county plurality. 1888 and 1892 county fills: Cleveland over most of the state; Harrison in the Ozarks, German counties, St. Louis city and county — including Webster and Greene. 1892 Webster Harrison 45.38%–41.59%. 2024 Trump 58.49%; Harris only Jackson, Boone, St. Louis County, St. Louis city; Webster Trump 80.67%. Nominate analogue (119th Congress): Wyden −0.335, Courtney −0.337, Sykes −0.332; House Dem median −0.396. Missouri now: Cleaver −0.454, Bell −0.472; Wagner +0.392 through Burlison +0.734; Hawley +0.819, Schmitt +0.884.",
    ],
  },
  researchDate: "August 18, 2026",
  sources: [
    "VoteView ICPSR 3418 (DW-NOMINATE −0.335 / 0.46; roll calls including RH0530012 and H.R. 4426)",
    "GovTrack member 404377 (missed-vote table, 428/1,011 = 42.3%)",
    "Jeffrey B. Lewis, Brandon DeVine, Lincoln Pitcher, and Kenneth C. Martis, Digital Boundary Definitions of United States Congressional Districts, 1789–2012",
    "Biographical Directory of the U.S. Congress (F000436)",
    "1883 History of Henry County, Missouri (1882 13th-district tally)",
    "Wikipedia U.S. House election pages 1882–1894 (Missouri 13th percentages)",
    "U.S. Bureau of Labor / Historical Statistics of the United States (1890 city food prices)",
    "State Historical Society of Missouri, Robert Washington Fyan Papers (R0567)",
    "St. Louis Daily Globe-Democrat portrait, November 6, 1890 (Wikimedia Commons)",
    "Political Graveyard, Missouri presidential county plurality winners, 1888 (St. Louis → St. Louis County; St. Louis city → St. Louis City). 1884 county page is “No data” for every county",
    "Wikipedia, 1884 / 1888 / 1892 / 2024 United States presidential election in Missouri (statewide totals; 1892 and 2024 county tables)",
    "VoteView HSall_members.csv, 119th Congress DW-NOMINATE first dimension (retrieved August 18, 2026)",
  ],
};
