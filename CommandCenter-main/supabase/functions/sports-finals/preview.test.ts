/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/sports-finals/preview.test.ts
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { previewReplyMarkup } from "../_shared/telegram-markup.ts";
import {
  darkLogoMark,
  eveningWindowEnd,
  espnDarkLogoUrl,
  inEveningWindow,
  lastName,
  PREVIEW_LIMIT,
  printReason,
  previewClaimKey,
  previewCaption,
  recordsLine,
  selectEveningPreview,
  sortPreviewForDisplay,
  starterLine,
  type PreviewGame,
} from "./preview-slate.ts";
import { PREVIEW_ALERT_HEIGHT, PREVIEW_ALERT_WIDTH, previewCardModel, renderPreviewSvg } from "./preview-svg.ts";
import { goaliesFromSummary, pitcherLineFromStat } from "./preview-boards.ts";
import {
  applyLightningLogos,
  capitalsLogoDataUri,
  isCapitalsSide,
  isLightningSide,
  lightningLogoDataUri,
} from "./preview-logos.ts";
import { nhlDarkRimFile } from "../_shared/nhl-dark-logos.ts";
import {
  mlbPostseasonHeat,
  MLB_PLAYOFF_SERIES_HEAT,
  scoreNhlRuwtGame,
  scoreRuwtGame,
  rankRuwtGames,
  rankRuwtNhlGames,
  rankRuwtNflGames,
  rankRuwtSoccerGames,
  rankRuwtCfbGames,
  cfbGotwTwoScoreEase,
  cfbEffectivelyDecided,
} from "./ruwt-rank.ts";

const appHeatUrl = [
  new URL("../../../CommandCenter-main/src/lib/mlb-playoff-heat.ts", import.meta.url),
  new URL("../../../src/lib/mlb-playoff-heat.ts", import.meta.url),
].find((url) => existsSync(fileURLToPath(url)));
if (!appHeatUrl) throw new Error("mlb-playoff-heat.ts not found");
const appHeat = await import(appHeatUrl.href);

const appMarginUrl = [
  new URL("../../../CommandCenter-main/src/lib/cfb-live-margin.ts", import.meta.url),
  new URL("../../../src/lib/cfb-live-margin.ts", import.meta.url),
].find((url) => existsSync(fileURLToPath(url)));
if (!appMarginUrl) throw new Error("cfb-live-margin.ts not found");
const appMargin = await import(appMarginUrl.href);

const now = new Date("2026-10-05T22:00:00.000Z"); // 5pm CDT
assert.equal(eveningWindowEnd(now).toISOString(), "2026-10-06T06:30:00.000Z", "window ends 1:30am CT");
assert.equal(previewClaimKey("2026-10-05"), "evening-preview:2026-10-05");

assert.equal(inEveningWindow("2026-10-05T16:00:00-05:00", now), false, "4pm CT already started before the 5pm send");
assert.equal(inEveningWindow("2026-10-05T19:00:00-05:00", now), true, "7pm CT is still to play");
assert.equal(inEveningWindow("2026-10-05T22:05:00.000Z", now), true, "just after send stays in");
assert.equal(inEveningWindow("2026-10-06T06:15:00.000Z", now), true, "late West Coast before 1:30am CT");
assert.equal(inEveningWindow("2026-10-06T06:45:00.000Z", now), false, "after 1:30am CT is out");
assert.equal(inEveningWindow(null, now), false);

{
  const input = { live: false, final: false, officialDate: "2026-10-05" };
  assert.deepEqual(mlbPostseasonHeat(input, now), appHeat.mlbPostseasonHeat(input, now));
  assert.equal(mlbPostseasonHeat(input, now)?.points, MLB_PLAYOFF_SERIES_HEAT);
  const live = { live: true, final: false, officialDate: "2026-10-05" };
  assert.deepEqual(mlbPostseasonHeat(live, now), appHeat.mlbPostseasonHeat(live, now));
}

assert.equal(cfbGotwTwoScoreEase(12, true), appMargin.cfbGotwTwoScoreEase(12, true));
assert.equal(
  cfbEffectivelyDecided({ diff: 10, late: true, clockSec: 90, leaderWinPct: null }),
  appMargin.cfbEffectivelyDecided({ diff: 10, late: true, clockSec: 90, leaderWinPct: null }),
);

function mlbGame(partial: Partial<{
  id: string;
  teamId: number;
  oppId: number;
  live: boolean;
  final: boolean;
  officialDate: string;
  record: string;
}>): Parameters<typeof scoreGameInterest>[0] {
  return {
    id: partial.id ?? "1",
    live: partial.live ?? false,
    final: partial.final ?? false,
    inning: null,
    officialDate: partial.officialDate ?? "2026-10-05",
    away: {
      teamId: partial.teamId ?? 143,
      name: "Away",
      abbrev: "AWY",
      score: null,
      record: partial.record ?? "96-66",
      probablePitcher: "A",
      probablePitcherId: 1,
    },
    home: {
      teamId: partial.oppId ?? 119,
      name: "Home",
      abbrev: "HME",
      score: null,
      record: "98-64",
      probablePitcher: "B",
      probablePitcherId: 2,
    },
  };
}

const octoberPlayoff = scoreRuwtGame(mlbGame({ id: "lad" }), {
  teamInterest: {},
  watchPlayerIds: new Set(),
  watchManagerIds: new Set(),
});
assert.ok(octoberPlayoff.reasons.includes("Playoff series"), "October MLB keeps series weight");
assert.ok(octoberPlayoff.score >= 54 + 4 + 10, `October pregame heat ${octoberPlayoff.score}`);

const cardinals = scoreRuwtGame(mlbGame({ id: "stl", teamId: 138, oppId: 112 }), {
  teamInterest: { "138": 10 },
  watchPlayerIds: new Set(),
  watchManagerIds: new Set(),
});
assert.ok(cardinals.reasons.includes("Cardinals"), "Cardinals hardcoded bump stays");
assert.ok(cardinals.score > octoberPlayoff.score, "Cardinals + interest outranks a generic playoff");

const blues = scoreNhlRuwtGame(
  {
    id: "stl-nhl",
    live: false,
    final: false,
    away: { teamId: "19", abbrev: "STL", score: null },
    home: { teamId: "9", abbrev: "DAL", score: null },
  },
  { teamInterest: { "19": 10 } },
);
assert.equal(blues.score, 12 + Math.round(10 * 4.2), "Blues get default interest, not live heat");
assert.ok(blues.reasons.includes("Your #1 team"));

const ranked = rankRuwtGames(
  [mlbGame({ id: "100", teamId: 143 }), mlbGame({ id: "200", teamId: 138, oppId: 112 })],
  { teamInterest: { "138": 10 }, watchPlayerIds: new Set(), watchManagerIds: new Set() },
  8,
);
assert.equal(ranked[0]!.id, "200", "hottest first");

const nhlRanked = rankRuwtNhlGames(
  [
    { id: "1", live: false, final: false, away: { teamId: "1", abbrev: "BOS", score: null }, home: { teamId: "2", abbrev: "TOR", score: null } },
    { id: "2", live: false, final: false, away: { teamId: "19", abbrev: "STL", score: null }, home: { teamId: "9", abbrev: "DAL", score: null } },
  ],
  { "19": 10 },
  8,
);
assert.equal(nhlRanked[0]!.id, "2");

const nflRanked = rankRuwtNflGames(
  [
    { id: "10", live: false, final: false, away: { teamId: "1", abbrev: "ATL", score: null }, home: { teamId: "2", abbrev: "NO", score: null } },
    { id: "11", live: false, final: false, away: { teamId: "8", abbrev: "DET", score: null }, home: { teamId: "16", abbrev: "MIN", score: null } },
  ],
  { "8": 10 },
  8,
);
assert.equal(nflRanked[0]!.id, "11");

const soccer = rankRuwtSoccerGames(
  [
    {
      id: "s1",
      live: false,
      final: false,
      pregame: true,
      leagueSlug: "eng.1",
      away: { teamId: "359", abbrev: "ARS", score: null },
      home: { teamId: "364", abbrev: "LIV", score: null },
    },
    {
      id: "s2",
      live: false,
      final: false,
      pregame: true,
      leagueSlug: "eng.2",
      away: { teamId: "1", abbrev: "AAA", score: null },
      home: { teamId: "2", abbrev: "BBB", score: null },
    },
  ],
  { "359": 10 },
  8,
);
assert.equal(soccer[0]!.id, "s1");

const cfb = rankRuwtCfbGames(
  [
    {
      id: "c1",
      live: false,
      final: false,
      period: null,
      broadcasts: [{ name: "ESPN+" }],
      odds: null,
      away: { teamId: 99, abbrev: "AAA", score: null, record: "3-3", rank: null, fpiRank: null },
      home: { teamId: 100, abbrev: "BBB", score: null, record: "2-4", rank: null, fpiRank: null },
    },
    {
      id: "c2",
      live: false,
      final: false,
      period: null,
      broadcasts: [{ name: "ABC" }],
      odds: null,
      away: { teamId: 2483, abbrev: "ORE", score: null, record: "6-0", rank: 3, fpiRank: 2 },
      home: { teamId: 194, abbrev: "OSU", score: null, record: "6-0", rank: 1, fpiRank: 1 },
    },
  ],
  {},
  8,
);
assert.equal(cfb[0]!.id, "c2", "top-10 CFB clash stays on the RUWT formula");

function game(partial: Partial<PreviewGame> & Pick<PreviewGame, "id" | "startIso" | "heat">): PreviewGame {
  return {
    sport: "mlb",
    league: "MLB",
    competition: null,
    away: { teamId: "1", name: "Away", abbrev: "AWY", logo: null, record: null },
    home: { teamId: "2", name: "Home", abbrev: "HME", logo: null, record: null },
    live: false,
    final: false,
    reasons: ["Playoff Gm 3"],
    tv: ["FOX"],
    path: "/sports/mlb/game/1",
    why: "Playoff Gm 3",
    network: "FOX",
    probableAway: null,
    probableHome: null,
    awayStarter: null,
    homeStarter: null,
    oddsLine: null,
    ...partial,
  };
}

const slate = selectEveningPreview(
  [
    game({ id: "early", startIso: "2026-10-05T16:00:00-05:00", heat: 99 }),
    game({ id: "live", startIso: "2026-10-05T22:10:00.000Z", heat: 90, live: true }),
    game({ id: "final", startIso: "2026-10-05T22:10:00.000Z", heat: 88, final: true }),
    game({ id: "hot", startIso: "2026-10-05T20:08:00-05:00", heat: 86, reasons: ["Playoff series"] }),
    game({
      id: "later",
      startIso: "2026-10-05T19:00:00-05:00",
      heat: 70,
      sport: "nhl",
      league: "NHL",
      reasons: ["Blues"],
    }),
    game({ id: "too-late", startIso: "2026-10-06T07:00:00.000Z", heat: 95 }),
  ],
  now,
  PREVIEW_LIMIT,
);
assert.deepEqual(
  slate.map((g) => g.id),
  ["hot", "later"],
  "only not-started games in the evening window, hottest first",
);
assert.deepEqual(
  sortPreviewForDisplay(slate).map((g) => g.id),
  ["later", "hot"],
  "card prints in start-time order",
);

assert.equal(selectEveningPreview([game({ id: "done", startIso: "2026-10-05T22:10:00.000Z", heat: 80, final: true })], now).length, 0);

assert.equal(
  printReason({
    reasons: ["Upcoming", "Your #1 team", "Playoff series"],
    seriesLine: "Playoff Gm 3",
    away: { teamId: "1", name: "PHI", abbrev: "PHI", logo: null, record: null },
    home: { teamId: "2", name: "LAD", abbrev: "LAD", logo: null, record: null },
    league: "MLB",
  }),
  "Playoff Gm 3",
);
assert.equal(
  printReason({
    reasons: ["Ranked matchup"],
    seriesLine: null,
    away: { teamId: "1", name: "Oregon", abbrev: "ORE", logo: null, record: null, rank: 3 },
    home: { teamId: "2", name: "Ohio State", abbrev: "OSU", logo: null, record: null, rank: 1 },
    league: "CFB",
  }),
  "Top-10 clash",
);

const caption = previewCaption(slate, "2026-10-05");
assert.equal(caption, "Tonight's top games · Mon, Oct 5");
assert.doesNotMatch(caption, /@/);
assert.doesNotMatch(caption, /\bheat\b/i);

assert.equal(lastName("Shane Bieber"), "Bieber");
assert.equal(lastName("Andrei Vasilevskiy"), "Vasilevskiy");
assert.equal(lastName("Kenley Jansen Jr."), "Jansen");
assert.equal(lastName(null), null);

const detailed = game({
  id: "detail",
  startIso: "2026-10-05T20:08:00-05:00",
  heat: 80,
  away: { teamId: "143", name: "Phillies", abbrev: "PHI", logo: null, record: "96-66" },
  home: { teamId: "119", name: "Dodgers", abbrev: "LAD", logo: null, record: "98-64" },
  probableAway: "Wheeler",
  probableHome: "Glasnow",
  awayStarter: { id: "1", name: "Wheeler", role: "P", line: "16-7 · 2.46 ERA", photoUrl: null },
  homeStarter: { id: "2", name: "Glasnow", role: "P", line: "4-3 · 3.11 ERA", photoUrl: null },
  why: "ALDS Game 2",
});
assert.equal(recordsLine(detailed), "PHI 96-66  ·  LAD 98-64");
assert.equal(starterLine(detailed), "Wheeler vs Glasnow");
assert.equal(
  starterLine(game({ id: "nfl-line", startIso: "2026-10-05T19:15:00-05:00", heat: 40, sport: "nfl", league: "NFL", oddsLine: "ATL -3.5" })),
  "ATL -3.5",
);
assert.equal(
  starterLine({
    sport: "nhl",
    away: { teamId: "4", name: "Flyers", abbrev: "PHI", logo: null, record: "1-0" },
    home: { teamId: "27", name: "Lightning", abbrev: "TB", logo: null, record: "1-0" },
    probableAway: "Ersson",
    probableHome: "Vasilevskiy",
    oddsLine: null,
  }),
  "Ersson / Vasilevskiy",
);

assert.equal(
  goaliesFromSummary({
    goalies: {
      awayTeam: {
        athletes: [
          {
            id: "1",
            displayName: "Samuel Ersson",
            statistics: [
              { abbreviation: "W", displayValue: "1" },
              { abbreviation: "L", displayValue: "0" },
              { abbreviation: "OTL", displayValue: "0" },
              { abbreviation: "GAA", displayValue: "2.10" },
              { abbreviation: "SV%", displayValue: ".922" },
            ],
          },
        ],
      },
      homeTeam: {
        athletes: [{ id: "2976847", displayName: "Andrei Vasilevskiy", headshot: { href: "https://a.espncdn.com/i/headshots/nhl/players/full/2976847.png" } }],
      },
    },
  }).away?.line,
  "1-0-0 · 2.10 GAA · .922 SV%",
);
assert.equal(
  pitcherLineFromStat({ wins: 10, losses: 9, era: "4.44" }),
  "10-9 · 4.44 ERA",
);

const svg = renderPreviewSvg(
  previewCardModel(
    [
      ...sortPreviewForDisplay(slate),
      detailed,
      game({
        id: "lightning",
        startIso: "2026-10-05T18:00:00-05:00",
        heat: 60,
        sport: "nhl",
        league: "NHL",
        away: { teamId: "4", name: "Flyers", abbrev: "PHI", logo: null, record: "1-0-0", logoData: "data:image/png;base64,aaa" },
        home: {
          teamId: "20",
          name: "Lightning",
          abbrev: "TB",
          logo: null,
          record: "1-0-0",
          logoData: "data:image/png;base64,bbb",
          color: "#002868",
        },
        probableAway: "Ersson",
        probableHome: "Vasilevskiy",
        awayStarter: { id: "4", name: "Ersson", role: "G", line: "1-0-0 · 2.10 GAA", photoUrl: null },
        homeStarter: { id: "20", name: "Vasilevskiy", role: "G", line: "1-1-0 · 2.59 GAA · .889 SV%", photoUrl: null },
        why: null,
        network: "ESPN+",
      }),
    ],
    "Monday, October 5 · Central",
  ),
);
assert.match(svg, /Tonight(&apos;|')s top games/);
assert.match(svg, /width="1080"/);
assert.match(svg, /height="1350"/);
assert.equal(PREVIEW_ALERT_WIDTH, 1080);
assert.equal(PREVIEW_ALERT_HEIGHT, 1350);
assert.doesNotMatch(svg, />86</);
assert.doesNotMatch(svg, /live field/i);
assert.doesNotMatch(svg, /logo-plate/);
assert.doesNotMatch(svg, /id="logoStroke"/);
assert.doesNotMatch(svg, /feMorphology/);
assert.match(svg, /96-66/);
assert.match(svg, /98-64/);
assert.match(svg, /Wheeler/);
assert.match(svg, /2\.46 ERA/);
assert.match(svg, /Glasnow/);
assert.match(svg, /Ersson/);
assert.match(svg, /2\.59 GAA/);
assert.match(svg, /Vasilevskiy/);
assert.match(svg, /ALDS Game 2/);
assert.equal(darkLogoMark("#002868", "nhl", "20"), true);
assert.equal(darkLogoMark("#fe5823", "nhl", "15"), false);
assert.match(espnDarkLogoUrl("https://a.espncdn.com/i/teamlogos/nhl/500/20.png") ?? "", /500-dark\/20/);
assert.equal(isLightningSide("nhl", { teamId: "20", abbrev: "TB" }), true);
assert.equal(isLightningSide("nhl", { teamId: "15", abbrev: "PHI" }), false);
assert.equal(isLightningSide("mlb", { teamId: "139", abbrev: "TB" }), false);
assert.equal(isCapitalsSide("nhl", { teamId: "23", abbrev: "WSH" }), true);
assert.equal(isCapitalsSide("nhl", { teamId: "20", abbrev: "TB" }), false);
assert.equal(isCapitalsSide("mlb", { teamId: "120", abbrev: "WSH" }), false);
assert.equal(nhlDarkRimFile({ sport: "nhl", abbrev: "WSH" }), "nhl-wsh.png");
assert.equal(nhlDarkRimFile({ sport: "mlb", abbrev: "WSH" }), null);
const lightningUri = await lightningLogoDataUri();
assert.ok(lightningUri?.startsWith("data:image/png;base64,"));
assert.ok((lightningUri?.length ?? 0) > 1000);
const capitalsUri = await capitalsLogoDataUri();
assert.ok(capitalsUri?.startsWith("data:image/png;base64,"));
assert.ok((capitalsUri?.length ?? 0) > 1000);
assert.notEqual(lightningUri, capitalsUri);
const lightningGame = game({
  id: "tb-logo",
  startIso: "2026-10-05T18:00:00-05:00",
  heat: 50,
  sport: "nhl",
  league: "NHL",
  home: { teamId: "20", name: "Lightning", abbrev: "TB", logo: "https://a.espncdn.com/i/teamlogos/nhl/500/20.png", record: "1-0-0", logoData: "data:image/png;base64,espn" },
});
await applyLightningLogos([lightningGame]);
assert.equal(lightningGame.home.logoData, lightningUri);
const capitalsGame = game({
  id: "wsh-logo",
  startIso: "2026-10-05T19:00:00-05:00",
  heat: 50,
  sport: "nhl",
  league: "NHL",
  away: { teamId: "23", name: "Capitals", abbrev: "WSH", logo: "https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png", record: "1-0-0", logoData: "data:image/png;base64,espn" },
});
await applyLightningLogos([capitalsGame]);
assert.equal(capitalsGame.away.logoData, capitalsUri);

const markup = previewReplyMarkup("https://command-center-flax-gamma.vercel.app");
assert.ok(markup);
const parsed = JSON.parse(markup) as { inline_keyboard: { text: string; web_app?: { url: string } }[][] };
assert.deepEqual(
  parsed.inline_keyboard[0]!.map((b) => b.text),
  ["RUWT board", "Sports home"],
);

console.log("preview.test.ts ok");
