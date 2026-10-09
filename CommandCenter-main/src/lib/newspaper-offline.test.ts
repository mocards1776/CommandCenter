/**
 * Run with: node --experimental-strip-types src/lib/newspaper-offline.test.ts
 */
import { upgradeStoryImageUrl } from "./newspaper-images.ts";
import { collectEditionImageUrls, isSharpOriginalUrl } from "./newspaper-offline.ts";
import { ISSUE_VERSION, type PrintedIssue } from "./newspaper-issue.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const thumb =
  "https://bloximages.newyork1.vip.townnews.com/stltoday.com/content/tncms/assets/v3/editorial/a/bc/abc.image.jpg?resize=200%2C133";
const original =
  "https://bloximages.newyork1.vip.townnews.com/stltoday.com/content/tncms/assets/v3/editorial/a/bc/abc.image.jpg";

assert(!isSharpOriginalUrl(thumb), "a 200px BLOX thumb is not cached");
assert(isSharpOriginalUrl(original), "the BLOX original is cached");
assert(!isSharpOriginalUrl("https://cdn.example.com/photo.jpg?w=240"), "a generic small w= is not cached");
assert(
  isSharpOriginalUrl("https://cdn.example.com/photo.jpg?w=1600"),
  "an already-upgraded 1600w file is cached",
);
assert(!isSharpOriginalUrl("/local.jpg"), "relative URLs are skipped");

const issue: PrintedIssue = {
  version: ISSUE_VERSION,
  id: "2026-10-05-evening",
  stories: [{ id: "lead", photo: thumb, headline: "Cards" }],
  queries: [{ key: ["2026-10-05-evening", "tt-watch"], data: { logo: original } }],
};
const urls = collectEditionImageUrls(issue);
assert(urls.includes(original), "thumbs are upgraded to the original before cache");
assert(
  urls.every((url) => !/[?&]resize=200/i.test(url)),
  "no downscaled resize= is queued",
);

const shot = "https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png";
const shotThumb = upgradeStoryImageUrl(shot)!;
const logo = "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png";
const logoThumb = upgradeStoryImageUrl(logo)!;
assert(isSharpOriginalUrl(shotThumb), "an ESPN headshot combiner thumb is cached");
assert(isSharpOriginalUrl(logoThumb), "an ESPN logo combiner thumb is cached");
const espnIssue: PrintedIssue = {
  version: ISSUE_VERSION,
  id: "2026-10-08-evening",
  stories: [{ id: "lead", photo: shot }],
  queries: [{ key: ["2026-10-08-evening", "tt-board"], data: { logo } }],
};
const espnUrls = collectEditionImageUrls(espnIssue);
assert(espnUrls.includes(shotThumb) && espnUrls.includes(logoThumb), "headshots and logos prefetch the combiner thumb");
assert(!espnUrls.includes(shot) && !espnUrls.includes(logo), "full-size ESPN originals are not queued");

console.log("newspaper-offline ok");
