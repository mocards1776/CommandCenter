/**
 * Run with: node --experimental-strip-types src/lib/newspaper-issue.test.ts
 */
import { asPrintedIssue, ISSUE_VERSION, slimIssue } from "./newspaper-issue.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const issue = asPrintedIssue(
  "2026-10-01-morning",
  ISSUE_VERSION,
  [{ id: "a", headline: "Cardinals win" }],
  [{ key: ["2026-10-01-morning", "tt-weather-marshfield"], data: { temp: 62 } }],
);
assert(issue?.id === "2026-10-01-morning", "keeps the press id");
assert(issue?.stories.length === 1, "keeps the stories");
assert(issue?.queries.length === 1, "keeps the desks");
assert(asPrintedIssue("x", 0, [], []) === null, "drops an older press file");
assert(asPrintedIssue("x", ISSUE_VERSION, {}, []) === null, "drops a file with no story list");

const bulkySource = {
  version: ISSUE_VERSION,
  id: "2026-10-01-midday",
  stories: [{ headline: "Blues" }],
  queries: [
    {
      key: ["2026-10-01-midday", "rss-article-v3", "https://example.com"],
      data: { contentHtml: "x".repeat(80), contentText: "The Blues won." },
    },
  ],
};
const bulky = slimIssue(bulkySource, JSON.stringify(bulkySource).length - 1);
assert(!JSON.stringify(bulky).includes("contentHtml"), "drops article html when the file is large");
assert(JSON.stringify(bulky).includes("The Blues won."), "keeps the copy");

console.log("newspaper-issue ok");
