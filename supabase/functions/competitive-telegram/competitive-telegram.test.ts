/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/competitive-telegram/competitive-telegram.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  SAMPLE_AS_OF,
  SD30_CAPTION_WHATS_NEW,
  SD30_SAMPLE_BUYERS,
  barWidth,
  buildCompetitiveCard,
  competitiveCaption,
  formatJustInLine,
  formatCpp,
  formatGrp,
  formatSpendExact,
  formatSpendShort,
  SD30_SAMPLE_JUST_IN,
  DEM_CANDIDATE,
  GOP_CANDIDATE,
  GOP_PAC,
  loadTciLogoDataUri,
  affiliationTotals,
  broadcastWeekBounds,
  inBroadcastWeek,
  maxGrp,
  maxSpend,
  raceSpendTotal,
  sd30SampleCard,
} from "./card.ts";
import {
  FRESH_INSERT_WINDOW_MS,
  MAX_BUY_IDS,
  colorForSponsor,
  editedBuyIds,
  editedBuysRefuseError,
  isEditedBuy,
  mapRestBuy,
  parseBuyIds,
  parseJustInPayload,
  rowsToBuyers,
  rowsToJustIn,
  type AlmanacBuyRow,
} from "./almanac.ts";
import { planCompetitiveSend } from "./send.ts";
import {
  COMPETITIVE_ALERT_HEIGHT,
  COMPETITIVE_ALERT_WIDTH,
  GLASS_SHADOW_STD_DEVIATION,
  LOGO_DISPLAY_WIDTH,
  LOGO_X,
  ORB_BLUR_STD_DEVIATION,
  renderCompetitiveSvg,
} from "./svg.ts";
import {
  prepareTelegramPhoto,
  sendTelegramPhoto,
  TELEGRAM_GRAPHIC_METHOD,
  TELEGRAM_JPEG_QUALITY,
  TELEGRAM_JPEG_QUALITY_FLOOR,
  TELEGRAM_PHOTO_MAX_BYTES,
} from "./telegram.ts";

const card = sd30SampleCard("data:image/png;base64,aaa");
const svg = renderCompetitiveSvg(card);

assert.equal(COMPETITIVE_ALERT_WIDTH, 1080);
assert.equal(COMPETITIVE_ALERT_HEIGHT, 1350);
assert.equal(CARD_WIDTH, 1080);
assert.equal(CARD_HEIGHT, 1350);
assert.match(svg, /width="1080"/);
assert.match(svg, /height="1350"/);
assert.match(svg, /#EFE8DC|#F2EEE6|#F4EFE6/i, "cream field, not a dark poster");
assert.doesNotMatch(svg, /#07101d|#0b1220|#111827/i);

assert.equal(LOGO_X, (1080 - LOGO_DISPLAY_WIDTH) / 2, "wordmark is centered on the field");
assert.match(svg, new RegExp(`<image href="data:image/png;base64,aaa" x="${LOGO_X}"`));
assert.doesNotMatch(svg, /logo-plate|logoHalo|logo-disc/i);
assert.doesNotMatch(svg, /letter grade|Grade [A-F]|rating [A-F]|\bHIGH\b/i);
assert.match(svg, /glassDepth|rgba\(255,255,255/, "liquid-glass panels");
assert.equal(ORB_BLUR_STD_DEVIATION, 26, "feathered orbs without the 42-blur OOM path");
assert.ok(ORB_BLUR_STD_DEVIATION > 14 && ORB_BLUR_STD_DEVIATION < 42);
assert.match(svg, new RegExp(`stdDeviation="${ORB_BLUR_STD_DEVIATION}"`));
assert.doesNotMatch(svg, /stdDeviation="42"/);
assert.ok(GLASS_SHADOW_STD_DEVIATION <= 10, "glass shadow stays isolate-safe");
{
  const pngSrc = readFileSync(new URL("./png.ts", import.meta.url), "utf8");
  assert.match(pngSrc, /PNG_FIT_TO_WIDTH = 900/);
  assert.match(pngSrc, /fitTo: \{ mode: "width", value: PNG_FIT_TO_WIDTH \}/);
}
assert.match(svg, />added</, "Just In says added for net-new load-batch buys");
assert.doesNotMatch(svg, />updated</);
assert.equal(GOP_PAC, "#FF6B63", "GOP PAC / MSCC is red-family, not indigo");
assert.equal(SD30_SAMPLE_JUST_IN[0]!.color, GOP_PAC);
assert.equal(SD30_SAMPLE_BUYERS[3]!.color, GOP_PAC);
assert.match(svg, /#FF6B63/);
assert.doesNotMatch(svg, /#5E5CE6/i, "MSCC must not use the old indigo PAC");

const fogle = SD30_SAMPLE_BUYERS[0]!;
const stinnett = SD30_SAMPLE_BUYERS[1]!;
const forward = SD30_SAMPLE_BUYERS[2]!;
const mscc = SD30_SAMPLE_BUYERS[3]!;
assert.equal(fogle.spend, 453350);
assert.equal(fogle.grp, 4873.5);
assert.equal(fogle.cpp, 93);
assert.equal(stinnett.spend, 253570);
assert.equal(stinnett.grp, 2766.6);
assert.equal(stinnett.cpp, 92);
assert.equal(forward.spend, 162745);
assert.equal(forward.grp, 980.9);
assert.equal(forward.cpp, 166);
assert.equal(mscc.spend, 119310);
assert.equal(mscc.grp, 642.6);
assert.equal(mscc.cpp, 186);

assert.equal(formatSpendExact(453350), "$453,350");
assert.equal(formatSpendShort(453350), "$453k");
assert.equal(formatSpendShort(253570), "$254k");
assert.equal(formatSpendShort(162745), "$163k");
assert.equal(formatSpendShort(119310), "$119k");
assert.equal(formatGrp(4873.5), "4,873.5");
assert.equal(formatGrp(2766.6), "2,766.6");
assert.equal(formatGrp(980.9), "980.9");
assert.equal(formatGrp(642.6), "642.6");
assert.equal(formatCpp(93), "$93");
assert.equal(formatCpp(186), "$186");

assert.match(svg, /\$453k/);
assert.match(svg, /\$254k/);
assert.match(svg, /\$163k/);
assert.match(svg, /\$119k/);
assert.match(svg, /4,873\.5 GRP/);
assert.match(svg, /2,766\.6 GRP/);
assert.match(svg, /980\.9 GRP/);
assert.match(svg, /642\.6 GRP/);
assert.doesNotMatch(svg, /\$93 CPP|\$92 CPP|\$166 CPP|\$186 CPP/);
assert.match(svg, /JUST IN|Just in/);
assert.match(svg, /MSCC|Betsy Fogle/);
assert.match(svg, /\$47,440/);
assert.match(svg, /274\.8 GRP/);
assert.match(svg, /\$32,300/);
assert.match(svg, /358\.9 GRP/);
assert.doesNotMatch(svg, /\$70,420|939 GRP|\$52,745|704 GRP/);
assert.match(svg, /Springfield TV/);
assert.doesNotMatch(svg, /GRP rebuild|KSPR dark|CPPs locked|FCC×AD35/);
assert.doesNotMatch(svg, /Still ahead|STILL AHEAD|Remaining weeks/);
assert.match(svg, /SPEND/);
assert.match(svg, />GRP</);
assert.match(svg, /Dem/);
assert.match(svg, /GOP/);
assert.match(svg, /Fogle \+ Forward/);
assert.match(svg, /Stinnett \+ MSCC/);
assert.match(svg, /\$616k/);
assert.match(svg, /\$373k/);
assert.match(svg, /\$616,095/);
assert.match(svg, /\$372,880/);
assert.match(svg, /\$988,975/);
assert.match(svg, /5,854\.4/);
assert.match(svg, /3,409\.2/);
assert.match(svg, /<path d="M/);
assert.match(svg, /SD-30/);
assert.match(svg, /October 6, 2026/);
assert.match(svg, /Springfield/);

const track = 948;
{
  const [dem, gop] = affiliationTotals(SD30_SAMPLE_BUYERS);
  assert.equal(dem!.spend, 453350 + 162745);
  assert.equal(gop!.spend, 253570 + 119310);
  assert.equal(dem!.grp, 4873.5 + 980.9);
  assert.equal(gop!.grp, 2766.6 + 642.6);
  assert.equal(raceSpendTotal(SD30_SAMPLE_BUYERS), 453350 + 162745 + 253570 + 119310);
}
assert.equal(maxSpend(SD30_SAMPLE_BUYERS), 453350);
assert.equal(maxGrp(SD30_SAMPLE_BUYERS), 4873.5);
assert.equal(barWidth(453350, 453350, track), track);
assert.equal(barWidth(253570, 453350, track), Math.round((253570 / 453350) * track));
assert.equal(barWidth(162745, 453350, track), Math.round((162745 / 453350) * track));
assert.equal(barWidth(119310, 453350, track), Math.round((119310 / 453350) * track));
assert.equal(barWidth(4873.5, 4873.5, track), track);
assert.equal(barWidth(2766.6, 4873.5, track), Math.round((2766.6 / 4873.5) * track));
assert.equal(barWidth(980.9, 4873.5, track), Math.round((980.9 / 4873.5) * track));
assert.equal(barWidth(642.6, 4873.5, track), Math.round((642.6 / 4873.5) * track));

const caption = competitiveCaption(card);
assert.match(caption, /\$453,350 \/ 4,873\.5 GRP/);
assert.match(caption, /\$253,570 \/ 2,766\.6 GRP/);
assert.match(caption, /\$162,745 \/ 980\.9 GRP/);
assert.match(caption, /\$119,310 \/ 642\.6 GRP/);
assert.doesNotMatch(caption, /Just in[\s\S]*?CPP/);
assert.ok(caption.includes("MSCC added $47,440 in Springfield TV for 274.8 GRP"));
assert.ok(caption.includes("Betsy Fogle added $32,300 in Springfield TV for 358.9 GRP"));
assert.ok(SD30_CAPTION_WHATS_NEW.includes("$47,440"));
assert.doesNotMatch(SD30_CAPTION_WHATS_NEW, /\$70,420|CPP/);
assert.equal(
  formatJustInLine(SD30_SAMPLE_JUST_IN[0]!),
  "MSCC added $47,440 in Springfield TV for 274.8 GRP",
);
assert.doesNotMatch(formatJustInLine(SD30_SAMPLE_JUST_IN[0]!), /CPP/);
assert.match(caption, /DMA spend: Dem \$616,095 \/ GOP \$372,880; race \$988,975/);
assert.match(caption, /DMA GRP: Dem 5,854\.4 \/ GOP 3,409\.2/);
{
  const week = broadcastWeekBounds("2026-10-06");
  assert.equal(week.start, "2026-10-05");
  assert.equal(week.end, "2026-10-11");
  assert.equal(inBroadcastWeek("2026-10-05", "2026-10-06"), true);
  assert.equal(inBroadcastWeek("2026-10-06", "2026-10-06"), true);
  assert.equal(inBroadcastWeek("2026-09-29", "2026-10-06"), false);
  assert.ok(SD30_SAMPLE_JUST_IN.every((buy) => inBroadcastWeek(buy.flightStart, "2026-10-06")));
}

{
  const logo = await loadTciLogoDataUri();
  assert.ok(logo && logo.startsWith("data:image/png;base64,"));
  assert.ok(logo.length > 200, "real TCI wordmark is embedded");
  const withLogo = renderCompetitiveSvg(sd30SampleCard(logo));
  assert.match(withLogo, /<image href="data:image\/png;base64,/);
  assert.doesNotMatch(withLogo, /logo-plate|logoHalo|logo-disc/);
  assert.ok(!/rect[^>]+fill="#FFFFFF"/.test(withLogo), "no opaque white logo plate");
}

assert.equal(TELEGRAM_GRAPHIC_METHOD, "sendPhoto");
assert.ok(TELEGRAM_JPEG_QUALITY >= 95);
assert.ok(TELEGRAM_JPEG_QUALITY_FLOOR >= 92);
assert.equal(TELEGRAM_PHOTO_MAX_BYTES, 10 * 1024 * 1024);
{
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const asPng = prepareTelegramPhoto(png, null);
  assert.equal(asPng.mime, "image/png");
  assert.equal(asPng.filename, "competitive.png");

  const jpegOut = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  let seenQuality = 0;
  const asJpeg = prepareTelegramPhoto(png, (src, quality) => {
    seenQuality = quality;
    assert.equal(src, png);
    return jpegOut;
  });
  assert.equal(seenQuality, TELEGRAM_JPEG_QUALITY);
  assert.equal(asJpeg.mime, "image/jpeg");
  assert.equal(asJpeg.filename, "competitive.jpg");
  assert.equal(asJpeg.quality, TELEGRAM_JPEG_QUALITY);
}

{
  const calls: { url: string; field: string; type: string; name: string }[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const form = init?.body as FormData;
    const file = (form?.get("document") ?? form?.get("photo")) as File | Blob | null;
    calls.push({
      url: String(input),
      field: form?.has("document") ? "document" : form?.has("photo") ? "photo" : "none",
      type: file && "type" in file ? String(file.type) : "",
      name: file && "name" in file ? String((file as File).name) : "",
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    await sendTelegramPhoto("tok", "857547432", new Uint8Array([137, 80, 78, 71]), "SD-30", null, () =>
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
    );
  } finally {
    globalThis.fetch = orig;
  }
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /\/sendPhoto$/);
  assert.doesNotMatch(calls[0]!.url, /sendDocument/);
  assert.equal(calls[0]!.field, "photo");
  assert.equal(calls[0]!.type, "image/jpeg");
  assert.equal(calls[0]!.name, "competitive.jpg");
}

const emptyEnv = { get: () => undefined };

function almanacRow(partial: Partial<AlmanacBuyRow> & Pick<AlmanacBuyRow, "id" | "sponsor" | "spend" | "grp" | "affiliation">): AlmanacBuyRow {
  return {
    race_slug: "mo-sd30",
    media: "broadcast",
    station: "KYTV",
    market: "Springfield",
    sponsorType: "candidate",
    flightStart: "2026-10-06",
    ...partial,
  };
}

{
  assert.deepEqual(parseBuyIds([]), []);
  assert.deepEqual(parseBuyIds([" a ", "", "b"]), ["a", "b"]);
  const skipped = await planCompetitiveSend({ action: "send", race_slug: "mo-sd30", buy_ids: [] }, { env: emptyEnv });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.ok && skipped.skipped, true);
  const noSlug = await planCompetitiveSend({ action: "send", buy_ids: ["1"] }, { env: emptyEnv });
  assert.equal(noSlug.ok, false);
  const tooMany = await planCompetitiveSend(
    { action: "send", race_slug: "mo-sd30", buy_ids: Array.from({ length: MAX_BUY_IDS + 1 }, (_, i) => String(i)) },
    { env: emptyEnv },
  );
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.ok === false && tooMany.status, 400);
}

{
  const batch = [
    almanacRow({ id: "sd30-mscc", sponsor: "Missouri Senate Campaign Committee", spend: 47440, grp: 274.8, affiliation: "Melanie Stinnett", sponsorType: "pac", flightStart: "2026-10-05" }),
    almanacRow({ id: "sd30-fogle", sponsor: "Fogle for Missouri", spend: 32300, grp: 358.9, affiliation: "Betsy Fogle" }),
  ];
  const race = [
    ...batch,
    almanacRow({ id: "tot-fogle", sponsor: "Fogle for Missouri", spend: 434655, grp: 4514.6, affiliation: "Betsy Fogle" }),
    almanacRow({ id: "tot-stinnett", sponsor: "Friends of Melanie Stinnett", spend: 253570, grp: 2716.7, affiliation: "Melanie Stinnett" }),
    almanacRow({ id: "tot-forward", sponsor: "Forward PAC", spend: 162745, grp: 980.9, affiliation: "Betsy Fogle", sponsorType: "pac" }),
    almanacRow({ id: "tot-mscc", sponsor: "Missouri Senate Campaign Committee", spend: 71870, grp: 367.8, affiliation: "Melanie Stinnett", sponsorType: "pac" }),
  ];
  const client = {
    fetchBuysByIds: async (ids: string[]) => batch.filter((row) => ids.includes(row.id)),
    fetchRaceBuys: async () => race,
  };
  const plan = await planCompetitiveSend(
    { action: "send", race_slug: "mo-sd30", buy_ids: ["sd30-mscc", "sd30-fogle"] },
    { env: emptyEnv, almanac: client },
  );
  assert.equal(plan.ok, true);
  assert.equal(plan.ok && !plan.skipped && plan.card.race, "SD-30");
  if (!plan.ok || plan.skipped) throw new Error("expected sd30 send card");
  const sendSvg = renderCompetitiveSvg(plan.card);
  const sendCaption = competitiveCaption(plan.card);
  assert.match(sendSvg, /\$47,440/);
  assert.match(sendSvg, /\$32,300/);
  assert.match(sendSvg, /274\.8 GRP/);
  assert.match(sendSvg, /358\.9 GRP/);
  assert.doesNotMatch(sendSvg, /\$70,420|CPP/);
  assert.doesNotMatch(sendCaption, /Just in[\s\S]*?CPP/);
  assert.match(sendCaption, /DMA spend: Dem \$/);
  assert.equal(plan.buy_ids.length, 2);
  assert.equal(rowsToJustIn(batch).length, 2);
  assert.equal(rowsToJustIn(batch).find((row) => row.sponsor === "MSCC")?.color, GOP_PAC);
}

{
  const multi = [
    almanacRow({
      id: "fogle-kytv",
      sponsor: "Fogle for Missouri",
      spend: 20000,
      grp: 200,
      affiliation: "Betsy Fogle",
      station: "KYTV",
      market: "Springfield",
    }),
    almanacRow({
      id: "fogle-kspr",
      sponsor: "Fogle for Missouri",
      spend: 12300,
      grp: 158.9,
      affiliation: "Betsy Fogle",
      station: "KSPR",
      market: "Springfield",
    }),
  ];
  const just = rowsToJustIn(multi);
  assert.equal(just.length, 1);
  assert.equal(just[0]!.amount, 32300);
  assert.equal(just[0]!.grp, 358.9);
  assert.equal(just[0]!.station, "Springfield DMA");
  assert.equal(just[0]!.sponsor, "Betsy Fogle");
  const dmaSvg = renderCompetitiveSvg(buildCompetitiveCard({
    slug: "mo-sd30",
    justIn: just,
    buyers: SD30_SAMPLE_BUYERS.map((row) => ({ ...row })),
    asOf: SAMPLE_AS_OF,
    market: "Springfield",
  }));
  assert.match(dmaSvg, /Springfield DMA/);
  assert.doesNotMatch(dmaSvg, />KYTV<|>KSPR</);

  const single = rowsToJustIn([
    almanacRow({
      id: "fogle-only",
      sponsor: "Fogle for Missouri",
      spend: 32300,
      grp: 358.9,
      affiliation: "Betsy Fogle",
      station: "KYTV",
      market: "Springfield",
    }),
  ]);
  assert.equal(single.length, 1);
  assert.equal(single[0]!.station, "KYTV");
}

{
  const batch = [
    almanacRow({
      id: "sd8-sdcc",
      race_slug: "mo-sd8",
      sponsor: "Senate Democratic Campaign Committee",
      spend: 64400,
      grp: 101.1,
      affiliation: "Keri Ingle",
      sponsorType: "pac",
      station: "WDAF",
      market: "Kansas City",
    }),
    almanacRow({
      id: "sd8-pat",
      race_slug: "mo-sd8",
      sponsor: "Patterson for Missouri",
      spend: 39880,
      grp: 96.2,
      affiliation: "Jon Patterson",
      station: "WDAF",
      market: "Kansas City",
      flightStart: "2026-10-05",
    }),
  ];
  const race = [
    almanacRow({ id: "r1", race_slug: "mo-sd8", sponsor: "Senate Democratic Campaign Committee", spend: 707900, grp: 1429.7, affiliation: "Keri Ingle", sponsorType: "pac", market: "Kansas City" }),
    almanacRow({ id: "r2", race_slug: "mo-sd8", sponsor: "Patterson for Missouri", spend: 462656, grp: 1811.4, affiliation: "Jon Patterson", market: "Kansas City" }),
    almanacRow({ id: "r3", race_slug: "mo-sd8", sponsor: "Missouri Alliance PAC", spend: 388125, grp: 983.85, affiliation: "Jon Patterson", sponsorType: "pac", market: "Kansas City" }),
    almanacRow({ id: "r4", race_slug: "mo-sd8", sponsor: "Keri Ingle for MO SD8", spend: 220490, grp: 1554.6, affiliation: "Keri Ingle", market: "Kansas City" }),
  ];
  const plan = await planCompetitiveSend(
    { action: "send", race_slug: "mo-sd8", buy_ids: ["sd8-sdcc", "sd8-pat"] },
    {
      env: emptyEnv,
      almanac: {
        fetchBuysByIds: async (ids) => batch.filter((row) => ids.includes(row.id)),
        fetchRaceBuys: async (slug) => {
          assert.equal(slug, "mo-sd8");
          return race;
        },
      },
    },
  );
  assert.equal(plan.ok, true);
  if (!plan.ok || plan.skipped) throw new Error("expected sd8 send card");
  assert.equal(plan.card.race, "SD-8");
  assert.equal(plan.card.market, "Kansas City");
  const sendSvg = renderCompetitiveSvg(plan.card);
  assert.match(sendSvg, /\$64,400/);
  assert.match(sendSvg, /\$39,880/);
  assert.match(sendSvg, /SDCC|Jon Patterson/);
  assert.match(sendSvg, /Kansas City/);
  assert.doesNotMatch(sendSvg, /CPP/);
  assert.match(sendSvg, /Patterson|Alliance|Ingle|SDCC/);
  const [dem, gop] = affiliationTotals(plan.card.buyers);
  assert.equal(dem!.spend, 707900 + 220490);
  assert.equal(gop!.spend, 462656 + 388125);
  assert.ok(rowsToBuyers(race).length >= 4);
}

{
  const payloadOnly = await planCompetitiveSend(
    {
      action: "send",
      race_slug: "mo-sd30",
      buy_ids: ["payload-1"],
      just_in: [{ sponsor: "Betsy Fogle", amount: 32300, market: "Springfield", media: "TV", station: "KYTV", grp: 358.9 }],
      buyers: [
        { name: "Fogle", spend: 453350, grp: 4873.5, side: "dem" },
        { name: "Stinnett", spend: 253570, grp: 2766.6, side: "gop" },
      ],
    },
    { env: emptyEnv, almanac: null },
  );
  assert.equal(payloadOnly.ok, true);
  assert.equal(payloadOnly.ok && !payloadOnly.skipped && payloadOnly.source, "payload");
}

{
  assert.equal(colorForSponsor({ sponsor: "MSCC", affiliation: "", sponsorType: "" }), GOP_PAC);
  assert.equal(colorForSponsor({ affiliation: "Melanie Stinnett", sponsorType: "pac" }), GOP_PAC);
  assert.equal(colorForSponsor({ side: "gop", sponsorType: "pac" }), GOP_PAC);
  assert.equal(colorForSponsor({ side: "gop", sponsor: "Stinnett" }), GOP_CANDIDATE);
  assert.equal(colorForSponsor({ sponsor: "Betsy Fogle" }), DEM_CANDIDATE);
  const inferred = parseJustInPayload([
    { sponsor: "MSCC", amount: 6450, grp: 47, market: "Springfield", media: "TV", station: "KYTV" },
    { sponsor: "MSCC", amount: 6450, grp: 47, market: "Springfield", media: "TV", side: "gop" },
  ]);
  assert.equal(inferred.length, 2);
  assert.equal(inferred[0]!.color, GOP_PAC);
  assert.equal(inferred[1]!.color, GOP_PAC);
  assert.notEqual(inferred[0]!.color, DEM_CANDIDATE);
}

{
  const revisedFull = almanacRow({
    id: "mscc-nexstar",
    sponsor: "Missouri Senate Campaign Committee",
    spend: 17600,
    grp: 134,
    affiliation: "Melanie Stinnett",
    sponsorType: "pac",
    station: "KSPR",
  });
  let fetchedBatchIds: string[] | null = null;
  const plan = await planCompetitiveSend(
    {
      action: "send",
      race_slug: "mo-sd30",
      buy_ids: ["mscc-nexstar"],
      just_in: [{
        sponsor: "MSCC",
        amount: 6450,
        grp: 47,
        market: "Springfield",
        media: "TV",
        station: "Springfield DMA",
        side: "gop",
      }],
    },
    {
      env: emptyEnv,
      almanac: {
        fetchBuysByIds: async (ids) => {
          fetchedBatchIds = ids;
          return [revisedFull];
        },
        fetchRaceBuys: async () => [
          revisedFull,
          almanacRow({ id: "fogle", sponsor: "Fogle for Missouri", spend: 453350, grp: 4873.5, affiliation: "Betsy Fogle" }),
        ],
      },
    },
  );
  assert.equal(plan.ok, true);
  if (!plan.ok || plan.skipped) throw new Error("expected revision-delta Just In card");
  assert.equal(fetchedBatchIds, null, "just_in skips fetchBuysByIds");
  assert.equal(plan.card.justIn.length, 1);
  assert.equal(plan.card.justIn[0]!.amount, 6450);
  assert.equal(plan.card.justIn[0]!.grp, 47);
  assert.equal(plan.card.justIn[0]!.station, "Springfield DMA");
  assert.equal(plan.card.justIn[0]!.color, GOP_PAC);
  const sendSvg = renderCompetitiveSvg(plan.card);
  const sendCaption = competitiveCaption(plan.card);
  assert.match(sendSvg, /\$6,450/);
  assert.match(sendSvg, /47 GRP/);
  assert.match(sendSvg, /Springfield DMA/);
  assert.match(sendSvg, /#FF6B63/);
  const justInBlock = sendSvg.match(/JUST IN[\s\S]*?RACE/)?.[0] ?? "";
  assert.match(justInBlock, /\$6,450/);
  assert.doesNotMatch(justInBlock, /\$17,600/);
  assert.doesNotMatch(formatJustInLine(plan.card.justIn[0]!), /\$17,600|134 GRP/);
  assert.ok(sendCaption.includes("MSCC added $6,450 in Springfield TV for 47 GRP"));
  assert.equal(rowsToBuyers([revisedFull])[0]!.color, GOP_PAC);
  assert.equal(rowsToBuyers([revisedFull])[0]!.side, "gop");
}

{
  const insert = [
    almanacRow({
      id: "mscc-new",
      sponsor: "Missouri Senate Campaign Committee",
      spend: 17600,
      grp: 134,
      affiliation: "Melanie Stinnett",
      sponsorType: "pac",
      station: "KYTV",
    }),
  ];
  let fetched = false;
  const plan = await planCompetitiveSend(
    { action: "send", race_slug: "mo-sd30", buy_ids: ["mscc-new"] },
    {
      env: emptyEnv,
      almanac: {
        fetchBuysByIds: async (ids) => {
          fetched = true;
          assert.deepEqual(ids, ["mscc-new"]);
          return insert;
        },
        fetchRaceBuys: async () => [
          ...insert,
          almanacRow({ id: "fogle", sponsor: "Fogle for Missouri", spend: 453350, grp: 4873.5, affiliation: "Betsy Fogle" }),
        ],
      },
    },
  );
  assert.equal(fetched, true, "inserts without just_in fetch full rows");
  assert.equal(plan.ok, true);
  if (!plan.ok || plan.skipped) throw new Error("expected insert full-amount Just In");
  assert.equal(plan.card.justIn[0]!.amount, 17600);
  assert.equal(plan.card.justIn[0]!.grp, 134);
  assert.equal(plan.card.justIn[0]!.color, GOP_PAC);
  const insertSvg = renderCompetitiveSvg(plan.card);
  assert.match(insertSvg, /\$17,600/);
  assert.match(insertSvg, /134 GRP/);
}

{
  assert.equal(FRESH_INSERT_WINDOW_MS, 5 * 60 * 1000);
  assert.equal(isEditedBuy({}), false);
  assert.equal(isEditedBuy({ createdAt: "2026-10-07T18:00:00.000Z", updatedAt: "2026-10-07T18:00:00.000Z" }), false);
  assert.equal(isEditedBuy({ createdAt: "2026-10-07T18:00:00.000Z", updatedAt: "2026-10-07T18:04:59.000Z" }), false);
  assert.equal(isEditedBuy({ createdAt: "2026-10-07T18:00:00.000Z", updatedAt: "2026-10-07T18:05:00.000Z" }), false);
  assert.equal(isEditedBuy({ createdAt: "2026-10-07T18:00:00.000Z", updatedAt: "2026-10-07T18:05:00.001Z" }), true);
  const mapped = mapRestBuy({
    id: "mscc-nexstar",
    race_slug: "mo-sd30",
    spend: 17600,
    grp35: 134,
    created_at: "2026-10-01T18:35:46.645Z",
    updated_at: "2026-10-07T17:56:48.931Z",
  }, "mo-sd30");
  assert.equal(mapped.createdAt, "2026-10-01T18:35:46.645Z");
  assert.equal(mapped.updatedAt, "2026-10-07T17:56:48.931Z");
  assert.equal(isEditedBuy(mapped), true);
  assert.equal(isEditedBuy({ createdAt: "not-a-date", updatedAt: "2026-10-07T18:10:00.000Z" }), false);
  assert.deepEqual(
    editedBuyIds([
      almanacRow({
        id: "fresh",
        sponsor: "MSCC",
        spend: 100,
        grp: 1,
        affiliation: "Melanie Stinnett",
        createdAt: "2026-10-07T18:00:00.000Z",
        updatedAt: "2026-10-07T18:02:00.000Z",
      }),
      almanacRow({
        id: "mscc-nexstar",
        sponsor: "MSCC",
        spend: 17600,
        grp: 134,
        affiliation: "Melanie Stinnett",
        createdAt: "2026-10-01T18:35:46.000Z",
        updatedAt: "2026-10-07T17:56:48.000Z",
      }),
    ]),
    ["mscc-nexstar"],
  );
}

{
  const revised = almanacRow({
    id: "mscc-nexstar",
    sponsor: "Missouri Senate Campaign Committee",
    spend: 17600,
    grp: 134,
    affiliation: "Melanie Stinnett",
    sponsorType: "pac",
    station: "KSPR",
    createdAt: "2026-10-01T18:35:46.645Z",
    updatedAt: "2026-10-07T17:56:48.931Z",
  });
  const plan = await planCompetitiveSend(
    { action: "send", race_slug: "mo-sd30", buy_ids: ["mscc-nexstar"] },
    {
      env: emptyEnv,
      almanac: {
        fetchBuysByIds: async () => [revised],
        fetchRaceBuys: async () => [revised],
      },
    },
  );
  assert.equal(plan.ok, false);
  assert.equal(plan.ok === false && plan.status, 409);
  assert.equal(plan.ok === false && plan.error, editedBuysRefuseError(["mscc-nexstar"]));
  assert.match(plan.ok === false ? plan.error : "", /mscc-nexstar/);
  assert.match(plan.ok === false ? plan.error : "", /just_in/);
}

{
  const patched = almanacRow({
    id: "mscc-new",
    sponsor: "Missouri Senate Campaign Committee",
    spend: 17600,
    grp: 134,
    affiliation: "Melanie Stinnett",
    sponsorType: "pac",
    station: "KYTV",
    createdAt: "2026-10-07T18:00:00.000Z",
    updatedAt: "2026-10-07T18:03:00.000Z",
  });
  const plan = await planCompetitiveSend(
    { action: "send", race_slug: "mo-sd30", buy_ids: ["mscc-new"] },
    {
      env: emptyEnv,
      almanac: {
        fetchBuysByIds: async () => [patched],
        fetchRaceBuys: async () => [
          patched,
          almanacRow({ id: "fogle", sponsor: "Fogle for Missouri", spend: 453350, grp: 4873.5, affiliation: "Betsy Fogle" }),
        ],
      },
    },
  );
  assert.equal(plan.ok, true);
  if (!plan.ok || plan.skipped) throw new Error("expected same-load patch to count as insert");
  assert.equal(plan.card.justIn[0]!.amount, 17600);
  assert.equal(plan.card.justIn[0]!.grp, 134);
}

{
  const outsideWindow = almanacRow({
    id: "mscc-late",
    sponsor: "Missouri Senate Campaign Committee",
    spend: 17600,
    grp: 134,
    affiliation: "Melanie Stinnett",
    sponsorType: "pac",
    createdAt: "2026-10-07T18:00:00.000Z",
    updatedAt: "2026-10-07T18:06:00.000Z",
  });
  const plan = await planCompetitiveSend(
    { action: "send", race_slug: "mo-sd30", buy_ids: ["mscc-late"] },
    {
      env: emptyEnv,
      almanac: {
        fetchBuysByIds: async () => [outsideWindow],
        fetchRaceBuys: async () => [outsideWindow],
      },
    },
  );
  assert.equal(plan.ok, false);
  assert.equal(plan.ok === false && plan.status, 409);
  assert.match(plan.ok === false ? plan.error : "", /mscc-late/);
}

{
  const recapRow = almanacRow({
    id: "mscc-recap",
    sponsor: "Missouri Senate Campaign Committee",
    spend: 17600,
    grp: 134,
    affiliation: "Melanie Stinnett",
    sponsorType: "pac",
    station: "KYTV",
    createdAt: "2026-10-07T14:00:00.000Z",
    updatedAt: "2026-10-07T22:10:00.000Z",
  });
  let fetched = false;
  const plan = await planCompetitiveSend(
    { action: "send", race_slug: "mo-sd30", buy_ids: ["mscc-recap"], recap: true },
    {
      env: emptyEnv,
      almanac: {
        fetchBuysByIds: async (ids) => {
          fetched = true;
          assert.deepEqual(ids, ["mscc-recap"]);
          return [recapRow];
        },
        fetchRaceBuys: async () => [
          recapRow,
          almanacRow({ id: "fogle", sponsor: "Fogle for Missouri", spend: 453350, grp: 4873.5, affiliation: "Betsy Fogle" }),
        ],
      },
    },
  );
  assert.equal(fetched, true, "recap without just_in still fetches rows");
  assert.equal(plan.ok, true);
  if (!plan.ok || plan.skipped) throw new Error("expected recap to skip edited-buy guard");
  assert.equal(plan.card.justIn[0]!.amount, 17600);
  assert.equal(plan.card.justIn[0]!.grp, 134);
  const recapSvg = renderCompetitiveSvg(plan.card);
  assert.match(recapSvg, /\$17,600/);
  assert.match(recapSvg, /134 GRP/);
}

console.log("competitive-telegram tests ok");
