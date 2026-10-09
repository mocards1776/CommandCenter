/**
 * Run with: node --experimental-strip-types src/lib/reader-links.test.ts
 * from CommandCenter-main/.
 */
import { readerHref } from "./reader-links.ts";

function assertEqual(got: unknown, want: unknown) {
  if (got !== want) throw new Error(`FAIL\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
}

const base = "https://www.stltoday.com/sports/baseball/cardinals/article_1.html";

assertEqual(readerHref("/sports/hockey/blues/", base), "https://www.stltoday.com/sports/hockey/blues/");
assertEqual(readerHref("article_2.html", base), "https://www.stltoday.com/sports/baseball/cardinals/article_2.html");
assertEqual(readerHref("//cdn.example.com/a.jpg", base), "https://cdn.example.com/a.jpg");
assertEqual(readerHref("https://www.mlb.com/news/x", base), "https://www.mlb.com/news/x");
assertEqual(readerHref("mailto:desk@stltoday.com", base), "mailto:desk@stltoday.com");
assertEqual(readerHref("javascript:alert(1)", base), null);
assertEqual(readerHref(" JavaScript:void(0)", base), null);
assertEqual(readerHref("data:text/html,hi", base), null);
assertEqual(readerHref("#comments", base), null);
assertEqual(readerHref("", base), null);
assertEqual(readerHref("/relative", null), null);
assertEqual(readerHref("https://espn.com/x", null), "https://espn.com/x");

console.log("reader-links: ok");
