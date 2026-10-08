/**
 * Run with: node --experimental-strip-types src/lib/newspaper-feeds.test.ts
 * from CommandCenter-main/.
 */
import { fileMlbtr, parseMlbtr } from "./newspaper-mlbtr.ts";
import { isMissouriPolitics, keepLocalWire } from "./newspaper-missouri.ts";
import { normalizeTitle, powerMizzouCard, powerMizzouPage, type PowerItem } from "./newspaper-powermizzou.ts";
import { storyRank } from "./newspaper-sections.ts";
import type { GameWrapCard } from "./newspaper-sports.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>MLBTR Chat: Tuesday</title>
  <link>https://www.mlbtraderumors.com/chat</link>
  <category>St. Louis Cardinals</category>
  <content:encoded><![CDATA[<p>Ignore.</p>]]></content:encoded>
</item>
<item>
  <title>Cardinals check in on a starter</title>
  <link>https://www.mlbtraderumors.com/2026/10/cardinals-starter.html</link>
  <pubDate>Wed, 08 Oct 2026 18:00:00 GMT</pubDate>
  <category><![CDATA[St. Louis Cardinals]]></category>
  <description>A short dek.</description>
  <content:encoded><![CDATA[<p>${"The Cardinals asked about the right-hander. ".repeat(20)}</p>]]></content:encoded>
</item>
<item>
  <title>Poll: Which team wins the deadline?</title>
  <link>https://www.mlbtraderumors.com/poll</link>
</item>
<item>
  <title>Royals add a bullpen arm</title>
  <link>https://www.mlbtraderumors.com/2026/10/royals-arm.html</link>
  <category>Kansas City Royals</category>
  <description>Kansas City signed a reliever.</description>
  <content:encoded><![CDATA[<p>Kansas City signed a reliever to a major-league deal.</p>]]></content:encoded>
</item>
<item>
  <title>Dodgers nearing a deal</title>
  <link>https://www.mlbtraderumors.com/2026/10/dodgers.html</link>
  <category>Los Angeles Dodgers</category>
  <content:encoded><![CDATA[<p>${"Los Angeles is close. ".repeat(20)}</p>]]></content:encoded>
</item>
</channel></rss>`;

const parsed = parseMlbtr(xml);
assert(parsed.length === 3, "chat and poll titles drop");
const filed = fileMlbtr(parsed);
assert(filed.cardinals.length === 1 && filed.cardinals[0]!.favoriteKey === "mlb-stl", "Cardinals tag files on the club desk");
assert((filed.cardinals[0]!.body ?? "").length > 400, "content:encoded is the body");
assert(filed.royals.length === 1 && filed.royals[0]!.source === "MLB Trade Rumors", "Royals tag files on the Missouri desk");
assert(filed.league.length === 1 && filed.league[0]!.favoriteKey === "", "other clubs file on the MLB desk");

const athletic = {
  id: "athletic-excerpt",
  caption: "The Athletic",
  headline: "An excerpt",
  body: "Short athletic excerpt.",
  favoriteKey: "",
  leaguePath: "baseball/mlb",
} as GameWrapCard;
const mlbtr = filed.league[0]!;
assert(storyRank(mlbtr, "2026-10-08-evening") > storyRank(athletic, "2026-10-08-evening"), "full MLBTR outranks an Athletic excerpt");

const page = powerMizzouPage(`<html><article><p>${"Missouri ran the ball and kept the clock moving in the second half. ".repeat(12)}</p><p>Nav item</p></article></html>`);
assert(!page.paywall && page.text.length >= 400, "open article body is kept");
assert(!page.text.includes("Nav item"), "short nav paragraphs stay out");
const locked = powerMizzouPage(`<html><script>{"isAccessibleForFree":false}</script><article><p>${"x ".repeat(300)}</p></article></html>`);
assert(locked.paywall && locked.text === "", "a paywall marker drops the body");
const vip = powerMizzouPage(`<div class="vip-lock"></div><article><p>${"y ".repeat(300)}</p></article></html>`);
assert(vip.paywall, "a VIP lock drops the body");

const item: PowerItem = { title: "Tigers wrap camp", link: "https://www.powermizzou.com/camp", publishedAt: null, excerpt: "Camp notes from Columbia." };
const brief = powerMizzouCard(item, "Too short.");
assert(brief.status === "Brief" && brief.favoriteKey === "cfb-mizzou", "a short page stays a Mizzou brief");
assert(normalizeTitle("Tigers, wrap  camp") === normalizeTitle("Tigers wrap camp"), "titles dedupe loosely");
const hoops = powerMizzouCard({ ...item, title: "Dennis Gates sets the rotation" }, "x".repeat(500));
assert(hoops.favoriteKey === "cbb-mizzou" && hoops.status === "Story", "basketball files on the hoops desk");

assert(!keepLocalWire({ title: "WATCH: Storms", link: "https://www.ky3.com/2026/10/08/storm/", snippet: "x".repeat(100) }, "KY3"), "video titles drop");
assert(!keepLocalWire({ title: "Creek leak", link: "https://www.ky3.com/video/2026/10/08/clip/", snippet: "x".repeat(100) }, "KY3"), "video paths drop");
assert(!keepLocalWire({ title: "Mindful Monday", link: "https://www.ky3.com/2026/10/08/mindful/", snippet: "To report a correction or typo, please email digitalnews@ky3.com" }, "KY3"), "KY3 stubs drop");
assert(keepLocalWire({ title: "Council votes on the budget", link: "https://www.ky3.com/2026/10/08/budget/", snippet: "x".repeat(120) }, "KY3"), "a KY3 article stays");
assert(!keepLocalWire({ title: "Short", link: "https://www.ozarksfirst.com/news/local-news/short/", snippet: "Too thin." }, "KOLR"), "a thin KOLR dek drops");
assert(isMissouriPolitics("Governor Kehoe signed the bill"), "Kehoe is politics");
assert(!isMissouriPolitics("Police investigate a shooting"), "a crime brief is not politics");

console.log("newspaper-feeds ok");
