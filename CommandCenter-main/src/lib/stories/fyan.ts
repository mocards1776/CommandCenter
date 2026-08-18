import type { ClientStory } from "./types";
import { PLAN_48_D13, PLAN_50_D13, PLAN_15_D13 } from "./missouriCounties";

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
    body:
      "Robert Washington Fyan is the great-great-great-grandfather of Ken, Wally and John Thompson. Marshfield is the through-line.",
  },
  cover: {
    display: "Fyan",
    sub: "Marshfield · Missouri’s 13th",
    meta: "Robert Washington Fyan · 1835–1896",
    statValue: "3 terms",
    statLabel: "U.S. House · 48th, 52nd, 53rd",
    compareWarn: "Missed 42.3% of roll calls",
    compareGood: "Silver Democrat · DW-NOMINATE −0.335",
  },
  address: "Robert Washington Fyan",
  cityLine: "Marshfield, Missouri · 13th Congressional District",
  heroLine:
    "Robert Washington Fyan is the great-great-great-grandfather of Ken, Wally and John Thompson. Union major, 14th-circuit judge, and a three-term Democrat from a swing Ozarks seat.",
  support:
    "Arthur, then Harrison, then Cleveland. A House that went Democratic in 1882, Democratic again in 1890, and stayed that way through the Panic of 1893. In U.S. cities in 1890 a half-gallon of milk ran about 14¢ — call it 27¢ a gallon — with eggs near 21¢ a dozen and butter 26¢ a pound.",
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
      title: "The line",
      body:
        "Fyan is the great-great-great-grandfather of Ken, Wally and John Thompson. Webster County is where the public life happened.",
    },
    {
      title: "The times",
      body:
        "First term under Chester A. Arthur, with Democrats running the House after the 1882 wave (about 196–117). Back in 1891 under Benjamin Harrison, in a House of 238 Democrats, 86 Republicans, and 8 Populists. Last term under Grover Cleveland’s second administration, Panic of 1893, Wilson–Gorman tariff, and a fight over silver.",
    },
  ],
  compareCards: [
    {
      title: "The country he walked into",
      cost: "48th House · 1883–85 · Arthur",
      answers:
        "Democrats had just taken the House. Speaker John G. Carlisle. Pendleton civil-service reform was already law. The big remaining fights were tariff, railroad land grants, and pensions.",
      doesNot: "Does not make him a Washington regular — he missed more than two in five roll calls over a lifetime",
    },
    {
      title: "What a dollar bought",
      cost: "U.S. city averages, 1890 · BLS / Historical Statistics",
      answers:
        "Milk ~13.6¢ a half-gallon (about 27¢ a gallon). Eggs ~21¢ a dozen. Butter ~26¢ a pound. Round steak ~12¢ a pound. A manufacturing day’s wage was in the neighborhood of a dollar and a half.",
      doesNot: "Does not pin a Marshfield grocery ledger — these are national city averages, not a Webster County receipt",
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
        "Wife Elizabeth “Lizzie” P. Hyer of Dent County died in the April 18, 1880 cyclone.",
    },
    {
      label: "Congress",
      status: "new",
      detail:
        "Democrat, Missouri’s 13th: 48th (1883–85), 52nd and 53rd (1891–95). Lost the 1884 nomination; beat Wade in 1890; retired in 1894.",
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
        "Whole counties, filled. The 13th is the red block: Springfield and Joplin-country with Webster, Christian, Taney, Stone, Polk, and Dallas. Henry, Bates, Vernon, and the western border counties sit in the 12th, not the 13th. St. Louis city was split among more than one seat; the independent city is shown as a single fill.",
    },
    {
      id: "mo-50",
      title: "Missouri · 14 seats · 50th–52nd Congresses",
      years: "1887–1893",
      congress: "1885 tweak · Fyan’s 1890 comeback",
      plan: "50",
      counties: D13_50,
      note:
        "Same fourteen-seat frame. The 1885 act pulled Dallas and Polk into the 6th and Jasper into the 12th. The 13th that sent Fyan back in 1890 is nine counties: Barry, Christian, Greene, Lawrence, McDonald, Newton, Stone, Taney, Webster. Springfield still in the district. Marshfield still the home pin.",
    },
    {
      id: "mo-53",
      title: "Missouri · 15 seats · 53rd Congress",
      years: "1893–1895",
      congress: "Elected 1892 · Cleveland’s second term",
      plan: "53",
      counties: D13_53,
      note:
        "The 1890 census added a fifteenth seat. Webster stays in the 13th. Greene does not — Springfield goes to the 7th. The new 13th runs Marshfield and Wright and Texas County east into the Lead Belt: Jefferson, St. Francois, Washington, Iron, Madison, Wayne. That is why John H. Raney of Piedmont is the next 13th-district man after Fyan retired.",
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
      headline: "Fyan (D) 13,904 · Cloud (R) 12,424 · Hazeltine (GB) 6,122",
      detail:
        "New 14-district map. Majority 1,480. The Democratic cyclone year nationally. William W. Cloud (also listed as William T. Cloud) and Greenbacker J. S. / Ira S. Hazeltine. Source for the raw count: 1883 History of Henry County.",
    },
    {
      year: "1884",
      date: "November 4, 1884",
      result: "lost",
      headline: "Lost the Democratic nomination. Wade (R) 50.3% · Thomas (D) 45.0% · Haseltine (GB) 4.7%",
      detail:
        "Cleveland beats Blaine for president the same day. A. L. Thomas is the Democratic nominee, not Fyan. Republican gain. William H. Wade of Springfield takes the seat.",
    },
    {
      year: "1886",
      date: "November 2, 1886",
      result: "out",
      headline: "Not a candidate. Wade (R) 51.8% · Cravens (D) 44.9% · Sobicski (GB) 3.3%",
      detail: "Jeremiah C. Cravens is the Democrat. Wade holds. Cleveland still in the White House; Republicans pick up House seats nationally.",
    },
    {
      year: "1888",
      date: "November 6, 1888",
      result: "out",
      headline: "Not a candidate. Wade (R) 48.4% · Matclock (D) 40.0% · Alter (Union Labor) 11.1%",
      detail:
        "C. C. Matclock is the Democrat. Harrison beats Cleveland. Wade’s plurality is smaller; Union Labor takes a real bite.",
    },
    {
      year: "1890",
      date: "November 4, 1890",
      result: "won",
      headline: "Fyan (D) 49.9% · Wade (R) 41.6% · Vertrees (Union Labor) 8.5%",
      detail:
        "The McKinley-tariff midterm. Democrats take the House 238–86 with 8 Populists. Fyan beats the incumbent. Harrison still president when the 52nd sits.",
    },
    {
      year: "1892",
      date: "November 8, 1892",
      result: "won",
      headline: "Fyan (D) 57.05% · Whitledge (R) 42.82% · Harding (Ind.) 0.13%",
      detail:
        "Cleveland returns. Missouri now elects fifteen. Webster stays in the 13th; Springfield does not. Comfortable win over J. B. Whitledge.",
    },
    {
      year: "1894",
      date: "November 6, 1894",
      result: "retired",
      headline: "Retired. Raney (R) 51.3% · Fox (D) 48.7%",
      detail:
        "Depression midterm after the Panic of 1893. John H. Raney of Piedmont takes the Lead-Belt 13th from James D. Fox. Republican gain on the new map.",
    },
  ],
  billVotes: [
    {
      date: "Jan 31, 1884",
      congress: "48th",
      cast: "Yea",
      bill: "H.R. 3933 · Texas-Pacific land forfeiture",
      note:
        "Voted to forfeit unused railroad land grants. The public record on railroads is this kind of vote — not a donor list. No railroad backing file survives, and this is not the vote of a man carrying water for the land-grant roads.",
    },
    {
      date: "May 6, 1884",
      congress: "48th",
      cast: "Nay",
      bill: "H.R. 5893 · strike the enacting clause (tariff reduction)",
      note:
        "Nay on killing a bill to cut import duties and wartime tariff taxes. A Democrat in Arthur’s last full year, on the side of tariff reduction.",
    },
    {
      date: "Dec 17, 1884",
      congress: "48th",
      cast: "Yea",
      bill: "H.R. 5461 · railroad passenger separation",
      note:
        "On the interstate-commerce bill that died before the 1887 Act, he voted to let railroads separate white and colored passengers at their own discretion.",
    },
    {
      date: "Mar 24, 1892",
      congress: "52nd",
      cast: "Nay",
      bill: "H.R. 4426 · table free coinage of silver",
      note:
        "Nay on tabling Bland free silver. He wanted the bill kept alive. That is the silver-Democrat tell, and it matches the Ozarks more than the Cleveland gold men.",
    },
    {
      date: "Apr 4, 1892",
      congress: "52nd",
      cast: "Yea",
      bill: "H.R. 6185 · Geary Act (Chinese exclusion)",
      note:
        "Yea to suspend the rules and pass a bill absolutely prohibiting Chinese persons from coming into the United States — the Geary Act, extending and hardening the 1882 exclusion law.",
    },
    {
      date: "Aug 28, 1893",
      congress: "53rd",
      cast: "Nay",
      bill: "H.R. 1 · repeal Sherman Silver Purchase Act",
      note:
        "The vote of the term. Cleveland called a special session to stop Treasury silver purchases. House passed repeal 239–109. Fyan voted Nay, and Yea on the free-coinage ratio amendments that failed the same day. A Marshfield Democrat against his own president on money.",
    },
    {
      date: "Feb 1, 1894",
      congress: "53rd",
      cast: "Yea",
      bill: "H.R. 4864 · Wilson tariff (House passage)",
      note:
        "Yea to pass the Wilson bill — Democratic tariff reduction, later chewed up in the Senate into Wilson–Gorman (income tax, sugar deals) and signed August 27, 1894. He voted against some farm-product duty hikes on the way.",
    },
    {
      date: "Apr 4, 1894",
      congress: "53rd",
      cast: "Absent",
      bill: "H.R. 4956 · coin silver bullion (override)",
      note:
        "Bland’s seigniorage bill to coin the Treasury’s silver, over Cleveland’s veto. Fyan had voted with Bland on the substitute in March, then missed the override. Attendance is the other half of the record.",
    },
  ],
  chapters: [
    {
      id: "family",
      eyebrow: "The line",
      title: "Great-great-great-grandfather of Ken, Wally and John Thompson.",
      body:
        "Bedford Springs to Marshfield to three Thompson brothers. The public story is a Union officer, a long-sitting circuit judge, and a Democrat who could win, lose, and win again in the same 13th.",
      visual: "family",
      bullets: [
        "Ken Thompson · Wally Thompson · John Thompson",
        "Relation: great-great-great-grandsons of Robert Washington Fyan (1835–1896)",
        "Place: Marshfield / Webster County",
      ],
      stat: { value: "3g", label: "Great-great-great-grandsons · Ken, Wally, John" },
    },
    {
      id: "origin",
      eyebrow: "Who he was",
      title: "Pennsylvania-born. Missouri-made.",
      body:
        "Born March 11, 1835, at Bedford Springs, Pennsylvania. Common schools, the bar in 1858, then Marshfield. County attorney by 1859. Lebanon for a stretch around 1870; Webster County again before 1880. Died in Marshfield, July 28, 1896. Buried Lebanon Cemetery.",
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
        "June 1861: into Federal service. Hampton’s regiment and the Webster County Home Guards, then captain of Company B, 24th Missouri Infantry — later major — and the 46th Missouri. After Pea Ridge he wrote home from Taney County (April 17, 1862). That Union record is why the later House Democrat from this country does not read like a Bourbon from the Deep South.",
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
        "Circuit attorney in Springfield, 1865–66, including the failed Hickok prosecution. Circuit judge of the 14th judicial circuit from April 1866 to January 1883. In 1875 he sat on Missouri’s constitutional convention. In 1879 he presided over Laclede County’s first legal hanging (State v. Joseph Core). April 18, 1880: the cyclone killed Lizzie Hyer Fyan.",
      visual: "condition",
      bullets: [
        "Hickok–Tutt, July 1866 — prosecutor, not the winner",
        "14th circuit judge, 1866–1883",
        "1875 Missouri constitutional convention",
        "Lizzie Hyer Fyan died in the 1880 cyclone",
      ],
      stat: { value: "17 yrs", label: "On the 14th circuit before the House" },
    },
    {
      id: "era",
      eyebrow: "The times",
      title: "Arthur. Then Harrison. Then Cleveland again.",
      body:
        "He seated in December 1883 with Chester A. Arthur in the White House and John G. Carlisle in the Speaker’s chair. Democrats had just taken the House in the 1882 wave, about 196 seats to 117 Republican. He was out for Cleveland’s whole first term. He came back in 1891 under Harrison, into a House of 238 Democrats, 86 Republicans, and 8 Populists — the McKinley-tariff hangover. His last term is Cleveland’s second: Panic of 1893, special session on silver, Wilson–Gorman in 1894. In U.S. cities in 1890 a half-gallon of milk was about 14¢ (roughly 27¢ a gallon), eggs about 21¢ a dozen, butter 26¢ a pound, round steak 12¢ a pound.",
      visual: "compare",
      bullets: [
        "48th House (1883–85): Arthur · Speaker Carlisle · Democratic majority after 1882",
        "Out 1885–91: Cleveland I, then Harrison — Wade holds the 13th",
        "52nd House (1891–93): Harrison · Democrats 238, Republicans 86, Populists 8",
        "53rd House (1893–95): Cleveland II · Panic of 1893 · Democrats 218, Republicans 124, Populists 11",
        "1890 city grocery: milk ~14¢ / ½ gal · eggs ~21¢ / doz · butter ~26¢ / lb",
      ],
      stat: { value: "27¢", label: "About a gallon of milk in U.S. cities, 1890" },
    },
    {
      id: "congress",
      eyebrow: "The House",
      title: "Win, lose the nomination, wait, win, win, retire.",
      body:
        "Elected in the 1882 Democratic wave: 13,904 to 12,424, Greenbacker on 6,122. In 1884 he lost the nomination; Wade took the seat with 50.3% while Cleveland was winning the presidency. Wade held in 1886 and 1888. Fyan came back in 1890 with 49.9% in the McKinley midterm, then 57% in 1892 on the new fifteen-seat map. He did not run in 1894. Raney of Piedmont won the depression-year 13th 51.3–48.7.",
      visual: "elections",
      bullets: [
        "1882: won · 13,904–12,424–6,122 · maj. 1,480",
        "1884: lost nomination · Wade 50.3% / Thomas 45.0%",
        "1886–88: out · Wade re-elected",
        "1890: won · 49.9%–41.6%–8.5%",
        "1892: won · 57.05%–42.82%",
        "1894: retired · Raney (R) 51.3%",
      ],
      stat: { value: "1890", label: "The year he beat Wade and came back" },
    },
    {
      id: "maps",
      eyebrow: "The maps",
      title: "The whole state, county by county.",
      body:
        "Fourteen seats when he first went. Fifteen when he last sat. Webster is in the 13th on every map. Springfield is in it for the first two, then not. The 1883 13th is Ozarks plus Joplin-country. The 1892 13th is Marshfield east through Wright and Texas into the Lead Belt. That is the map change that turns a Springfield–Marshfield seat into a Piedmont seat.",
      visual: "districtMap",
      bullets: [
        "48th: twelve counties in the 13th, Greene to McDonald, including Jasper, Polk, Dallas",
        "50th–52nd: Jasper, Dallas, and Polk leave · nine-county 13th · Springfield remains",
        "53rd: fifteen seats · Greene to the 7th · Webster, Wright, Texas, and the Lead Belt",
        "Filled counties from the Lewis–Martis digital boundaries, not dots on an outline",
      ],
      stat: { value: "15", label: "Seats in the 1892 map · Webster still 13th" },
    },
    {
      id: "bills",
      eyebrow: "The votes",
      title: "Silver over Cleveland. Tariff down. Exclusion up.",
      body:
        "The interesting votes are not obscure. March 24, 1892: Nay on tabling free coinage. April 4, 1892: Yea on the Geary Chinese-exclusion bill. August 28, 1893: Nay on repealing the Sherman Silver Purchase Act — against the president of his own party, after voting Yea on every free-coinage ratio amendment that day. February 1, 1894: Yea on the Wilson tariff in the House. In 1884 he voted to forfeit unused Texas-Pacific land grants, which is the railroad story the paper trail will support. No itemized campaign file names the Frisco or anyone else as a backer.",
      visual: "bills",
      bullets: [
        "Silver Democrat: anti-table in 1892, anti-repeal in 1893",
        "Wilson tariff: Yea on House passage, 1894",
        "Geary Act: Yea, 1892",
        "Railroad land grants: Yea to forfeit unused grants, 1884",
        "1884 commerce bill: Yea to let railroads separate white and colored passengers",
      ],
      stat: { value: "Nay", label: "On repealing Sherman silver, Aug 28, 1893" },
    },
    {
      id: "votes",
      eyebrow: "The Grok read",
      title: "Moderate Democrat. High absences. Occasional party breaks.",
      body:
        "That is still the VoteView / GovTrack picture. Lifetime DW-NOMINATE first dimension −0.335: a Democrat, not a Republican, and not the most partisan Democrat in the room. On the 53rd House he sits more liberal than 69% of the chamber and more conservative than 51% of Democrats. Across three terms he missed 428 of 1,011 roll calls (42.3%), a little above the 37% median for members still serving in March 1895. Perfect in his first weeks, then long stretches above 50% missed, then 3.4% missed in winter 1893–94 — the silver-and-tariff winter.",
      visual: "votes",
      bullets: [
        "DW-NOMINATE dim-1 −0.335 · dim-2 0.46 (VoteView, ICPSR 3418)",
        "53rd House: more liberal than 69% of members · more conservative than 51% of Democrats",
        "Missed 428 / 1,011 roll calls = 42.3% (GovTrack lifetime)",
        "The party break that shows: Nay on Sherman repeal with a Democratic president pushing Yea",
      ],
      stat: { value: "42.3%", label: "Missed roll calls · three House terms" },
    },
    {
      id: "place",
      eyebrow: "Marshfield",
      title: "The town is the through-line.",
      body:
        "He practiced there, buried a wife there after the 1880 cyclone, represented it in Washington, died there on July 28, 1896, and was taken to Lebanon Cemetery. For Ken, Wally and John Thompson, Webster County is not an abstract district number.",
      visual: "none",
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
        "Three House terms. Silver over Cleveland. A 13th that kept Webster and eventually dropped Springfield. Robert Washington Fyan is the great-great-great-grandfather of Ken, Wally and John Thompson.",
      bullets: [
        "Ken, Wally and John Thompson — great-great-great-grandsons",
        "MO-13 Democrat · 1883–85 and 1891–95",
        "Nay on Sherman silver repeal · Yea on Wilson tariff · Yea on Geary",
        "Missed 42.3% of roll calls · DW-NOMINATE −0.335",
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
      "A Marshfield Union Democrat in a swing 13th. First term under Arthur, last terms under Harrison and Cleveland. The maps change around Webster; Webster does not leave the district.",
    recommendation:
      "Three terms, a lost nomination, a comeback, and a silver vote against his own president. The line to Ken, Wally and John Thompson is great-great-great-grandfather.",
  },
  notebook: {
    title: "The record",
    paragraphs: [
      "Robert Washington Fyan (March 11, 1835 – July 28, 1896). Great-great-great-grandfather of Ken, Wally and John Thompson. Democrat of Marshfield. Missouri’s 13th congressional district, 48th Congress (1883–85) and 52nd–53rd (1891–95).",
      "Elections: 1882 won 13,904–12,424–6,122 (maj. 1,480). 1884 lost the Democratic nomination; Wade 50.3%, A. L. Thomas 45.0%, Haseltine 4.7%. 1886 out (Wade 51.8%). 1888 out (Wade 48.4%). 1890 won 49.9%–41.6%–8.5%. 1892 won 57.05%–42.82%. 1894 retired; Raney 51.3%–Fox 48.7%. Percentages from the House-elections pages (Dubin via Wikipedia); 1882 raw count from the 1883 History of Henry County.",
      "Maps (Lewis–Martis digital boundaries, counties filled): 48th 13th = Barry, Christian, Dallas, Greene, Jasper, Lawrence, McDonald, Newton, Polk, Stone, Taney, Webster. 50th–52nd drops Dallas, Jasper, Polk. 53rd (15 seats) keeps Webster and adds Wright, Texas, and the Lead Belt; Greene goes to the 7th.",
      "Votes: Nay to table free silver (H.R. 4426, Mar 24, 1892). Yea on Geary exclusion (H.R. 6185, Apr 4, 1892). Nay on Sherman silver-purchase repeal (H.R. 1, Aug 28, 1893). Yea on Wilson tariff House passage (H.R. 4864, Feb 1, 1894). Yea to forfeit Texas-Pacific land grants (H.R. 3933, Jan 31, 1884). No itemized campaign contributions; no railroad donor file.",
      "Times: Arthur / Harrison / Cleveland II. 48th House Democratic after 1882. 52nd House 238 D, 86 R, 8 Populist. 53rd House and the Panic of 1893. 1890 U.S. city milk about 14¢ a half-gallon.",
      "Other marks: Union 24th/46th Missouri; Hickok–Tutt prosecution 1866; 14th circuit judge 1866–83; 1875 constitutional convention; Lizzie Hyer killed in the April 18, 1880 cyclone; died Marshfield, buried Lebanon Cemetery.",
    ],
  },
  researchDate: "August 18, 2026",
  sources: [
    "VoteView ICPSR 3418 (DW-NOMINATE −0.335 / 0.46; roll calls including RH0530012 and H.R. 4426)",
    "GovTrack member 404377 (missed-vote table, 428/1,011 = 42.3%; H.R. 4426 table vote)",
    "Jeffrey B. Lewis, Brandon DeVine, Lincoln Pitcher, and Kenneth C. Martis, Digital Boundary Definitions of United States Congressional Districts, 1789–2012",
    "Biographical Directory of the U.S. Congress (F000436)",
    "1883 History of Henry County, Missouri (1882 13th-district tally)",
    "Wikipedia U.S. House election pages 1882–1894 (Missouri 13th percentages; Dubin)",
    "Political Graveyard, Missouri U.S. Representatives 1880s–1890s",
    "U.S. Bureau of Labor / Historical Statistics of the United States (1890 city food prices)",
    "State Historical Society of Missouri, Robert Washington Fyan Papers (R0567)",
    "St. Louis Daily Globe-Democrat portrait, November 6, 1890 (Wikimedia Commons)",
  ],
};
