/**
 * Run with: node --experimental-strip-types src/lib/newspaper-issue.test.ts
 */
import {
  asPrintedIssue,
  issueCacheKey,
  issueCacheOwner,
  ISSUE_VERSION,
  retainCachedIssues,
  slimIssue,
} from "./newspaper-issue.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const issue = asPrintedIssue(
  "2026-10-01-morning",
  ISSUE_VERSION,
  [{ id: "a", headline: "Cardinals win" }],
  [{ key: ["2026-10-01-morning", "tt-weather-marshfield"], data: { temp: 62 } }],
  {
    printedAt: "2026-10-01T11:02:00.000Z",
    companions: { dayAhead: { date: "2026-10-01" }, beez: { team: { name: "Beez" } } },
  },
);
assert(issue?.id === "2026-10-01-morning", "keeps the press id");
assert(issue?.stories.length === 1, "keeps the stories");
assert(issue?.queries.length === 1, "keeps the desks");
assert(issue?.printedAt === "2026-10-01T11:02:00.000Z", "keeps printed_at");
assert((issue?.companions as { dayAhead?: { date: string } })?.dayAhead?.date === "2026-10-01", "keeps companions");
assert((issue?.companions as { beez?: { team?: { name: string } } })?.beez?.team?.name === "Beez", "keeps the Beez row");
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

const now = Date.parse("2026-10-05T23:30:00.000Z");
const cached = retainCachedIssues(
  [
    { id: "2026-10-05-evening", printedAt: "2026-10-05T22:03:00.000Z" },
    { id: "2026-10-05-morning", printedAt: "2026-10-05T11:02:00.000Z" },
    { id: "2026-10-03-morning", printedAt: "2026-10-03T11:00:00.000Z" },
  ],
  "2026-10-05-evening",
  now,
);
assert(
  cached.map((r) => r.id).join(",") === "2026-10-05-evening,2026-10-05-morning",
  "cache keeps the last 24h and drops the older morning",
);
const keepWriting = retainCachedIssues(
  [{ id: "2026-10-05-evening", printedAt: "2026-10-05T22:03:00.000Z" }],
  "2026-10-05-evening",
  now,
);
assert(keepWriting.length === 1, "the issue being written is always kept");

assert(issueCacheKey("user-a", "2026-10-05-evening") === "user-a\t2026-10-05-evening", "cache key is user then press");
assert(issueCacheOwner("user-a\t2026-10-05-evening") === "user-a", "owner is the left side");
assert(issueCacheOwner("2026-10-05-evening") === null, "a bare press id is not a per-user key");
assert(
  issueCacheKey("user-a", "2026-10-05-evening") !== issueCacheKey("user-b", "2026-10-05-evening"),
  "two accounts do not share an edition file",
);

console.log("newspaper-issue ok");
