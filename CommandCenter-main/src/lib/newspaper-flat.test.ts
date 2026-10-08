import {
  FLAT_PAGE_H,
  FLAT_PAGE_W,
  FLAT_RETENTION_DAYS,
  flatEditionExpired,
  flatKeepFrom,
  flatEditionAsk,
  flatReaderScale,
  flatRequested,
  isFlatManifest,
} from "./newspaper-flat.ts";

if (FLAT_RETENTION_DAYS !== 7) throw new Error("retention");
if (flatKeepFrom("2026-10-07") !== "2026-10-01") throw new Error(`keep ${flatKeepFrom("2026-10-07")}`);
if (!flatEditionExpired("2026-09-30-evening", "2026-10-07")) throw new Error("sep 30 should go");
if (flatEditionExpired("2026-10-01-morning", "2026-10-07")) throw new Error("oct 1 stays");
if (flatEditionExpired("2026-10-07-evening", "2026-10-07")) throw new Error("today stays");
if (!flatRequested("?flat=1", undefined)) throw new Error("query on");
if (flatRequested("?flat=0", "1")) throw new Error("query off wins");
if (!flatRequested("", "1")) throw new Error("env on");
if (flatRequested("", undefined)) throw new Error("default off");
if (flatEditionAsk("2026-10-07-evening-test", "today") !== "2026-10-07-evening-test") throw new Error("test edition");
if (flatEditionAsk("nope", "today") !== "today") throw new Error("bad edition falls back");
if (!isFlatManifest({ issueId: "2026-10-07-evening", pages: [{ url: "https://example.test/a.webp" }] })) {
  throw new Error("manifest");
}
if (isFlatManifest({ issueId: "x", pages: [] })) throw new Error("empty pages");

if (FLAT_PAGE_W !== 1032 || FLAT_PAGE_H !== 1376) throw new Error("page size");
if (flatReaderScale({ portrait: true, pagerWidth: 1032, pagerHeight: 1261 }) !== 1) throw new Error("portrait hidden sidebar");
if (flatReaderScale({ portrait: true, pagerWidth: 836, pagerHeight: 1100 }) !== 1) throw new Error("portrait sidebar stays 1");
if (flatReaderScale({ portrait: true, pagerWidth: 1032, pagerHeight: 900 }) !== 1) throw new Error("portrait short stays 1");
const landH = flatReaderScale({ portrait: false, pagerWidth: 1376, pagerHeight: 900 });
if (landH !== 900 / FLAT_PAGE_H) throw new Error(`landscape height fit ${landH}`);
const landW = flatReaderScale({ portrait: false, pagerWidth: 400, pagerHeight: 900 });
if (landW !== 400 / FLAT_PAGE_W) throw new Error(`landscape stays whole ${landW}`);

console.log("newspaper-flat ok");
