import {
  FLAT_RETENTION_DAYS,
  flatEditionExpired,
  flatKeepFrom,
  flatEditionAsk,
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

console.log("newspaper-flat ok");
