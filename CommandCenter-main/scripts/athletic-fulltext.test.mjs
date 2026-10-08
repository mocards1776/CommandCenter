/**
 * Run with: node scripts/athletic-fulltext.test.mjs
 */
import {
  isDataDomeBlock,
  loadIsHigh,
  namesClub,
  oneMinuteLoad,
  pickAthleticArticles,
  rssArticles,
} from "./athletic-fulltext.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(oneMinuteLoad(" 12:00 up 1 day, load average: 0.40, 0.20, 0.10") === 0.4, "reads the 1-minute load");
assert(oneMinuteLoad("load averages: 1.50, 1.00, 0.50") === 1.5, "reads the plural uptime form");
assert(loadIsHigh(2, 2), "load at the CPU count is high");
assert(!loadIsHigh(0.2, 2), "a quiet box is not high");
assert(loadIsHigh(Number.NaN, 2), "an unreadable load does not run");

const xml = `
<rss><channel>
<item><title>Cardinals add a starter</title><link>https://www.nytimes.com/athletic/1/cardinals?utm=1</link><description>St. Louis</description></item>
<item><title>League notebook</title><link>https://www.nytimes.com/athletic/2/notebook</link><description>Around the sport</description></item>
<item><title>Blues practice notes</title><link>https://www.nytimes.com/athletic/3/blues</link><description>St. Louis</description></item>
</channel></rss>`;
const picked = pickAthleticArticles(rssArticles(xml), 2);
assert(picked.map((row) => row.url).join() === "https://www.nytimes.com/athletic/1/cardinals,https://www.nytimes.com/athletic/3/blues", "club-named articles come first and the query is stripped");
assert(namesClub("Arsenal win"), "arsenal is a club name");
assert(isDataDomeBlock("<html>captcha-delivery.com datadome</html>"), "a DataDome page is a block");
assert(!isDataDomeBlock("<article><p>The Cardinals added a starter.</p></article>"), "a story is not a block");

const many = Array.from({ length: 20 }, (_, i) => ({
  title: `Notebook ${i}`,
  url: `https://www.nytimes.com/athletic/${i}/note`,
  snippet: "",
}));
assert(pickAthleticArticles(many).length === 15, "at most 15 articles");

console.log("athletic-fulltext script ok");
