/**
 * Run with: node --experimental-strip-types src/lib/newspaper-national.test.ts
 * from CommandCenter-main/.
 */
import {
  asNationalDesk,
  cleanHeadline,
  clusterItems,
  clusterBriefs,
  creditLine,
  isExcludedItem,
  itemsFromFeed,
  mechanicalStories,
  nationalPress,
  NATIONAL_SOURCES,
  parseRss,
  preferredItem,
  rankClusters,
  readNationalEditor,
  sameStory,
  sampleNationalDesk,
  scoreCluster,
  significantWords,
  storiesFromEditor,
  storyFromCluster,
  type NationalItem,
  type NationalSource,
} from "./newspaper-national.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const fox: NationalSource = {
  id: "fox-latest",
  outlet: "Fox News",
  outletWeight: 1.2,
  url: "https://example.com/fox",
  kind: "lead",
};

const rss = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[White House and Senate reopen spending talks - Fox News]]></title>
    <link>https://www.foxnews.com/politics/spending-talks</link>
    <pubDate>Sun, 05 Oct 2026 08:00:00 GMT</pubDate>
    <description>Negotiators returned to the Capitol overnight.</description>
  </item>
  <item>
    <title>Bari Weiss: Why the left cannot quit Trump</title>
    <link>https://www.foxnews.com/opinion/bari-weiss-column</link>
    <description>An opinion column.</description>
  </item>
  <item>
    <title>Watch: the Sunday morning show</title>
    <link>https://www.foxnews.com/video/sunday-show</link>
  </item>
  <item>
    <title>Cardinals beat Cubs</title>
    <link>https://www.foxnews.com/sports/cardinals-beat-cubs</link>
  </item>
</channel></rss>`;

const parsed = parseRss(rss);
assert(parsed.length === 4, "parseRss reads every item");
assert(parsed[0]!.title.includes("White House"), "title comes out of CDATA");
assert(parsed[0]!.url.includes("foxnews.com/politics"), "link is kept");
assert(parsed[0]!.publishedAt?.startsWith("2026-10-05"), "pubDate becomes ISO");

assert(cleanHeadline("White House talks - Fox News") === "White House talks", "outlet suffix drops");
assert(isExcludedItem({ title: "A column", url: "https://www.wsj.com/opinion/x" }), "opinion path is spiked");
assert(isExcludedItem({ title: "Watch now: the debate", url: "https://www.foxnews.com/politics/debate" }), "watch-now title is spiked");
assert(!isExcludedItem({ title: "Senate reopens the spending fight", url: "https://www.foxnews.com/politics/spending" }), "straight news stays");

const foxItems = itemsFromFeed(fox, parsed);
assert(foxItems.length === 1 && foxItems[0]!.position === 0, "opinion, video and sports drop; lead keeps its rank");
assert(foxItems[0]!.title === "White House and Senate reopen spending talks", "headline is cleaned");

const google = parseRss(`<rss><channel>
  <item>
    <title>Justices take a firearms case - Associated Press</title>
    <link>https://news.google.com/rss/articles/abc</link>
    <source url="https://apnews.com">Associated Press</source>
    <description>&lt;a href="https://apnews.com/article/scotus-guns"&gt;Justices take a firearms case&lt;/a&gt;</description>
  </item>
</channel></rss>`);
assert(google[0]!.url === "https://apnews.com/article/scotus-guns", "Google News yields the wire URL");

const now = new Date("2026-10-05T12:00:00Z");
function item(partial: Partial<NationalItem> & Pick<NationalItem, "id" | "title" | "outlet">): NationalItem {
  return {
    sourceId: "x",
    outletWeight: 1,
    kind: "lead",
    url: `https://example.com/${partial.id}`,
    snippet: `${partial.title}. More copy follows for the summary.`,
    publishedAt: "2026-10-05T08:00:00Z",
    position: 0,
    ...partial,
  };
}

const spendFox = item({ id: "a", title: "White House and Senate reopen spending talks", outlet: "Fox News", outletWeight: 1.2, position: 0, kind: "popular" });
const spendWsj = item({ id: "b", title: "Senate spending talks restart at the White House", outlet: "WSJ", outletWeight: 1.3, position: 1 });
const spendAp = item({ id: "c", title: "White House spending talks resume in Senate", outlet: "AP", outletWeight: 1.15, kind: "wire", position: 0 });
const celeb = item({ id: "d", title: "A singer posts a new album teaser online", outlet: "New York Post", outletWeight: 1, position: 2, publishedAt: "2026-10-03T08:00:00Z" });
const court = item({ id: "e", title: "Justices take up a federal firearms rule", outlet: "WSJ", outletWeight: 1.3, position: 0 });

assert(sameStory(significantWords(spendFox.title), significantWords(spendWsj.title)), "spending titles cluster");
assert(!sameStory(significantWords(spendFox.title), significantWords(court.title)), "unrelated titles stay apart");

const groups = clusterItems([spendFox, spendWsj, spendAp, celeb, court]);
assert(groups.length === 3, "three events: spending, celebrity, court");
assert(groups.some((g) => g.length === 3 && g.some((i) => i.outlet === "AP")), "wires join the spending cluster");

const ranked = rankClusters([spendFox, spendWsj, spendAp, celeb, court], now);
assert(ranked[0]!.items.some((i) => i.title.includes("spending")), "consensus + popular + wire leads");
assert(ranked[0]!.wireConfirm && ranked[0]!.popular, "spending cluster is confirmed and trending");
assert(ranked.at(-1)!.items[0]!.id === "d", "old singleton celebrity ranks last");

const spendScore = scoreCluster([spendFox, spendWsj, spendAp], now);
const oneScore = scoreCluster([court], now);
assert(spendScore.score > oneScore.score, "three-outlet cluster beats a singleton");

const pick = preferredItem([spendAp, spendFox, spendWsj]);
assert(pick.outlet === "Fox News", "prefer the conservative most-read item over the wire");
assert(creditLine([spendFox, spendWsj, spendAp]) === "Fox News, WSJ, AP", "credit conservative desks first");

const mech = mechanicalStories(ranked, 8);
assert(mech.length >= 3 && mech[0]!.source === "Fox News", "fallback files the ranked clusters");
assert(mech[0]!.credit.includes("Fox News") && mech[0]!.url.includes("example.com"), "fallback keeps a real link");

const briefs = clusterBriefs(ranked, 25);
const desk = readNationalEditor(
  {
    picks: [
      {
        clusterId: briefs[0]!.id,
        headline: "Washington reopens the spending fight",
        summary: "Negotiators returned to the Capitol overnight after a weekend of stalled talks on a stopgap bill.",
        sourceItemId: spendFox.id,
        credit: "Fox News, WSJ",
      },
      {
        clusterId: briefs.find((b) => b.items.some((i) => i.id === "e"))!.id,
        headline: "Court takes a firearms rule",
        summary: "The justices agreed to hear a challenge that has split the appeals courts this year.",
        sourceItemId: "missing",
        credit: "WSJ",
      },
      {
        clusterId: "nope",
        headline: "Invented",
        summary: "This cluster was never on the budget and must be dropped by the reader.",
        sourceItemId: "x",
        credit: "Nope",
      },
    ],
    rationale: "Lead is the budget story.",
    model: "grok-4.6",
  },
  briefs,
);
assert(desk && desk.picks.length === 2, "unknown cluster drops; two real picks stay");
assert(desk!.picks[1]!.sourceItemId === court.id, "a missing item id falls back to the cluster lead");
assert(readNationalEditor({ picks: [] }, briefs) == null, "an empty editor is unused");

const edited = storiesFromEditor(desk!, ranked);
assert(edited[0]!.headline === "Washington reopens the spending fight", "Grok headline is what prints");
assert(edited[0]!.url === spendFox.url, "chosen conservative link is kept");
assert(edited[0]!.paragraphs?.length === 1, "a one-sentence summary becomes one graf");

const grafDesk = readNationalEditor(
  {
    picks: [
      {
        clusterId: briefs[0]!.id,
        headline: "Washington reopens the spending fight",
        summary: "The U.S. Coast Guard and Sen. Smith briefed reporters.",
        paragraphs: ["The U.S.", "Coast Guard and Sen. Smith briefed reporters in D.C. after the U.K. notice."],
        sourceItemId: spendFox.id,
        credit: "Fox News, WSJ",
      },
      {
        clusterId: briefs.find((b) => b.items.some((i) => i.id === "e"))!.id,
        headline: "Court takes a firearms rule",
        summary: "The justices agreed to hear a challenge that has split the appeals courts this year.",
        sourceItemId: court.id,
        credit: "WSJ",
      },
    ],
    rationale: "Grafs from Grok.",
    model: "grok-4.6",
  },
  briefs,
);
assert(grafDesk && grafDesk.picks[0]!.paragraphs.length === 1, "Grok stub 'The U.S.' merges into the next graf");
assert(grafDesk!.picks[0]!.paragraphs[0]!.startsWith("The U.S. Coast Guard"), "merged graf keeps U.S. on the Coast Guard");
assert(grafDesk!.picks[0]!.summary.startsWith("The U.S. Coast Guard"), "joined summary matches the guarded grafs");

const filed = asNationalDesk({
  issue_id: "2026-10-05-morning",
  edition: "morning",
  stories: edited,
  sources: [],
  editor: { fallback: false, model: "grok-4.6" },
  printed_at: "2026-10-05T11:07:00Z",
});
assert(filed?.stories.length === 2 && filed.issueId === "2026-10-05-morning", "a filed row becomes a desk");
assert(asNationalDesk({ issue_id: "2026-10-05-morning", stories: [] }) == null, "empty row hides the section");

const sample = sampleNationalDesk("2026-10-05-morning");
assert(sample.stories.length === 8 && sample.stories[0]!.headline.length > 20, "sample desk is a full page");
assert(NATIONAL_SOURCES.some((s) => s.id === "fox-popular" && s.kind === "popular"), "Fox most-read is in the list");
assert(NATIONAL_SOURCES.every((s) => s.url.startsWith("https://")), "every source is a public https feed");

assert(nationalPress(new Date("2026-10-05T10:30:00Z")).id === "2026-10-04-evening", "before 6 a.m. Central is last night");
assert(nationalPress(new Date("2026-10-05T11:30:00Z")).id === "2026-10-05-morning", "6 a.m. is the morning paper");
assert(nationalPress(new Date("2026-10-05T17:30:00Z")).edition === "midday", "noon is midday");
assert(nationalPress(new Date("2026-10-05T22:30:00Z")).edition === "evening", "5 p.m. is evening");

const story = storyFromCluster(ranked[0]!);
assert(story.summary.length > 20 && story.credit.includes("AP"), "cluster story has a summary and wire credit");

console.log("newspaper-national ok");
