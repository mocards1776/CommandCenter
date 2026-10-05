/**
 * Run with: node --experimental-strip-types src/lib/newspaper-images.test.ts
 * from CommandCenter-main/.
 */
import {
  estimateStoryImageWidth,
  isNarrowStoryImage,
  pickBestStoryImage,
  srcsetCandidates,
  upgradeStoryImageUrl,
} from "./newspaper-images.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const bloxThumb =
  "https://bloximages.newyork1.vip.townnews.com/stltoday.com/content/tncms/assets/v3/editorial/7/d7/7d70ba2c.image.jpg?resize=200%2C133";
const bloxUp = upgradeStoryImageUrl(bloxThumb);
assert(bloxUp?.includes("stltoday.com") && bloxUp.includes(".image.jpg"), "BLOX host and file are kept");
assert(!/[?&]resize=/i.test(bloxUp ?? ""), "BLOX resize= is stripped so the original ships");
assert(estimateStoryImageWidth(bloxThumb) === 200, "resize=200,133 is a 200px thumb");
assert(isNarrowStoryImage(bloxThumb), "a 200px BLOX thumb is too small to bleed");

const bloxPlain =
  "https://bloximages.chicago2.vip.townnews.com/stltoday.com/content/tncms/assets/v3/editorial/a/bc/abc.image.jpg?resize=750,500&order=crop";
const bloxPlainUp = upgradeStoryImageUrl(bloxPlain);
assert(bloxPlainUp != null && !/[?&]resize=/i.test(bloxPlainUp), "comma resize is stripped");
assert(bloxPlainUp?.includes("order=crop"), "other BLOX query params stay");

const bloxW =
  "https://bloximages.newyork1.vip.townnews.com/stltoday.com/content/tncms/assets/v3/editorial/a/bc/abc.image.jpg?w=320&h=180";
assert(!/[?&]w=/i.test(upgradeStoryImageUrl(bloxW) ?? ""), "BLOX w= is stripped");
assert(!/[?&]h=/i.test(upgradeStoryImageUrl(bloxW) ?? ""), "BLOX leftover h= is stripped with w=");

const preview =
  "https://bloximages.newyork1.vip.townnews.com/stltoday.com/content/tncms/assets/v3/editorial/a/bc/abc.preview.jpg";
assert(
  upgradeStoryImageUrl(preview)?.includes(".image.jpg") && !upgradeStoryImageUrl(preview)?.includes(".preview.jpg"),
  ".preview size suffix becomes .image",
);

const pathResize =
  "https://bloximages.newyork1.vip.townnews.com/stltoday.com/content/tncms/assets/v3/editorial/a/bc/abc.image.jpg/resize/200x133/";
assert(
  !/\/resize\/200x133/i.test(upgradeStoryImageUrl(pathResize) ?? ""),
  "path /resize/200x133/ is dropped",
);
assert(estimateStoryImageWidth(pathResize) === 200, "path resize width is read");

const generic = "https://cdn.example.com/photo.jpg?w=240&h=160";
assert(upgradeStoryImageUrl(generic)?.includes("w=1600"), "a generic small w= is bumped to 1600");

const cloud = "https://images.minutemediacdn.com/image/upload/c_fill,w_16,ar_16:9/photo.jpg";
assert(upgradeStoryImageUrl(cloud)?.includes("w_1600"), "Cloudinary w_16 LQIP becomes w_1600");

const largeBlox =
  "https://bloximages.newyork1.vip.townnews.com/stltoday.com/content/tncms/assets/v3/editorial/a/bc/abc.image.jpg?resize=1800,1200";
assert(
  upgradeStoryImageUrl(largeBlox)?.includes("resize=1800"),
  "an already-large BLOX resize is left alone",
);
assert(!isNarrowStoryImage(largeBlox), "1800px is wide enough to bleed");

const best = pickBestStoryImage([
  { url: bloxThumb, width: 200 },
  { url: "https://bloximages.newyork1.vip.townnews.com/stltoday.com/photo.jpg?resize=1200,630", width: 1200 },
  "https://example.com/tiny.jpg?w=80",
]);
assert(best?.includes("photo.jpg") && !/[?&]resize=/i.test(best ?? ""), "largest media:content wins, then upgrades");

const srcset = srcsetCandidates(
  "https://cdn.example.com/a.jpg?w=200 200w, https://cdn.example.com/a.jpg?w=1400 1400w",
);
assert(srcset.length === 2 && srcset[1]!.width === 1400, "srcset yields width candidates");
assert(
  pickBestStoryImage(srcset)?.includes("w=1600"),
  "the 1400w srcset candidate is chosen and upgraded",
);

const unknown = pickBestStoryImage(["https://cdn.example.com/original.jpg", bloxThumb]);
assert(unknown?.includes("original.jpg"), "a URL with no size hint beats a known 200px thumb");

assert(upgradeStoryImageUrl("javascript:alert(1)") == null, "non-http is dropped");
assert(upgradeStoryImageUrl(null) == null, "empty is dropped");
assert(pickBestStoryImage([null, "", "  "]) == null, "no usable candidate");

console.log("newspaper-images ok");
