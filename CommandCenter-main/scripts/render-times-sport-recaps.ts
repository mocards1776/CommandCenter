/**
 * Live (or fixture) recaps-desk proof for 2026-10-05-morning.
 * Run from CommandCenter-main/:
 *   node --experimental-strip-types scripts/render-times-sport-recaps.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileEditionStories } from "../src/lib/newspaper.ts";
import { wrapBriefSentences } from "../src/lib/newspaper-box-wrap.ts";
import { groupSportRecaps, orderSportRecaps } from "../src/lib/newspaper-sport-desk.ts";
import {
  enrichWireStories,
  fetchNewspaperWire,
  logWireFiling,
  tallyWireGames,
} from "../src/lib/newspaper-wire.ts";
import type { GameWrapCard } from "../src/lib/newspaper-sports.ts";
import type { SportsFavorite } from "../src/lib/sports.ts";

const favs: SportsFavorite[] = [
  { key: "mlb-stl", name: "St. Louis Cardinals", shortName: "Cardinals", sport: "Baseball", league: "MLB", espnPath: "baseball/mlb/teams/24", kind: "team" },
  { key: "nhl-stl", name: "St. Louis Blues", shortName: "Blues", sport: "Hockey", league: "NHL", espnPath: "hockey/nhl/teams/19", kind: "team" },
  { key: "nfl-det", name: "Detroit Lions", shortName: "Lions", sport: "Football", league: "NFL", espnPath: "football/nfl/teams/8", kind: "team" },
  { key: "nfl-kc", name: "Kansas City Chiefs", shortName: "Chiefs", sport: "Football", league: "NFL", espnPath: "football/nfl/teams/12", kind: "team" },
  { key: "nba-phi", name: "Philadelphia 76ers", shortName: "Sixers", sport: "Basketball", league: "NBA", espnPath: "basketball/nba/teams/20", kind: "team" },
  { key: "cfb-mizzou", name: "Mizzou Football", shortName: "Mizzou", sport: "Football", league: "NCAA", espnPath: "football/college-football/teams/142", kind: "team" },
];

const pressId = "2026-10-05-morning";
const day = "2026-10-05";

const wire = await fetchNewspaperWire({ favs, day, pressId });
const finals = wire.games.filter((g) => g.final);
const enriched = await enrichWireStories(finals, finals.length);
const tallies = tallyWireGames(enriched);
logWireFiling(`recaps ${pressId}`, enriched);

function asCard(g: (typeof enriched)[number]): GameWrapCard {
  const scored = g.away.score != null && g.home.score != null;
  const favKey = [...g.favoriteKeys].sort((a, b) => {
    const w = (k: string) => (k.endsWith("-stl") || k.includes("mizzou") ? 100 : k.includes("det") ? 70 : k.includes("kc") ? 50 : 10);
    return w(b) - w(a);
  })[0] ?? "";
  return {
    id: `wire-${g.id}`,
    favoriteKey: favKey,
    teamName: favKey ? favs.find((f) => f.key === favKey)?.shortName ?? "" : g.away.winner ? g.away.short : g.home.short,
    teamHref: "/",
    sportLabel: g.league,
    leaguePath: g.path,
    headline: g.headline,
    dek: g.series,
    body: g.body,
    scoreLine: scored ? `${g.away.abbrev} ${g.away.score}  ·  ${g.home.abbrev} ${g.home.score}` : `${g.away.abbrev} at ${g.home.abbrev}`,
    when: g.startedAt,
    won: null,
    gameHref: g.href,
    wrapHref: null,
    feedUrl: null,
    gameId: g.eventId,
    stats: scored
      ? [
          { label: g.away.abbrev, value: String(g.away.score) },
          { label: g.home.abbrev, value: String(g.home.score) },
        ]
      : [],
    leaders: g.leaders,
    teamStats: [],
    division: [],
    wrapKind: g.wrapKind ?? null,
    sec: g.sec,
    ranked: Boolean(g.away.seed || g.home.seed),
    preseason: g.preseason,
    postseason: g.postseason,
    followed: g.favoriteKeys.length > 0,
    status: g.statusDetail,
    caption: g.wrapKind === "box" ? "Times box wrap" : null,
  };
}

const cards = enriched.map(asCard);
const filed = fileEditionStories({
  fresh: cards,
  carried: [],
  readKeys: new Set(),
  pressId,
});

function htmlFor(path: string, title: string, code: string): string {
  const leagueCards = orderSportRecaps(
    cards.filter((c) => c.leaguePath === path && c.scoreLine),
    path,
  );
  const bands = groupSportRecaps(leagueCards, path);
  const sections = bands
    .map((band) => {
      const items = band.cards
        .map((card) => {
          const copy = wrapBriefSentences(card.body || "", 4);
          const kicker =
            card.wrapKind === "box"
              ? "Times box wrap"
              : card.sec && card.leaguePath === "football/college-football"
                ? `${card.sportLabel} · SEC`
                : card.sportLabel;
          const leaders = card.leaders
            .slice(0, 4)
            .map((l) => `<li><strong>${esc(l.name)}</strong> <span>${esc(l.line)}</span></li>`)
            .join("");
          const related = (card.related ?? [])
            .map((r) => `<li><em>${esc(r.source || "Related")}</em> ${esc(r.headline)}</li>`)
            .join("");
          return `<article class="tt-wrap-brief">
            <p class="kicker">${esc(kicker)}</p>
            <h3>${esc(card.headline)}</h3>
            ${card.scoreLine ? `<p class="score"><b>${esc(card.status || "Final")}</b> ${esc(card.scoreLine)}</p>` : ""}
            ${copy ? `<p class="copy">${esc(copy)}</p>` : ""}
            ${leaders ? `<aside class="box"><h4>The box</h4><ul>${leaders}</ul></aside>` : ""}
            ${related ? `<ul class="related">${related}</ul>` : ""}
          </article>`;
        })
        .join("\n");
      return `<section class="band"><h2>${esc(band.title)} <em>${band.cards.length}</em></h2>${items}</section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Thompson Times · ${esc(title)} · ${pressId}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600;800&family=Oswald:wght@600&family=Playfair+Display:wght@700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap" />
  <style>
    html, body { margin: 0; background: #151b28; }
    .sheet {
      box-sizing: border-box;
      width: 1032px;
      min-height: 1290px;
      margin: 0 auto;
      padding: 22px 26px 36px;
      background: #fbfaf6;
      color: #121418;
      font-family: "Libre Franklin", system-ui, sans-serif;
    }
    header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #121418; padding-bottom: 8px; margin-bottom: 16px; }
    .code { font-family: Oswald, sans-serif; font-size: 46px; line-height: 0.9; }
    header p { margin: 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6f78; }
    .flow { columns: 3; column-gap: 24px; }
    .band { break-inside: avoid; margin: 0 0 18px; }
    .band h2 { margin: 0 0 10px; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 1px solid #121418; padding-bottom: 4px; }
    .band h2 em { font-style: normal; color: #6b6f78; margin-left: 8px; }
    .tt-wrap-brief { break-inside: avoid; margin: 0 0 14px; padding: 0 0 12px; border-bottom: 1px solid rgba(18,20,24,0.15); }
    .kicker { margin: 0; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #b3121d; }
    h3 { margin: 3px 0 4px; font-family: "Playfair Display", Georgia, serif; font-size: 17px; line-height: 1.15; }
    .score { margin: 0; font-size: 12px; }
    .score b { margin-right: 6px; }
    .copy { margin: 6px 0 0; font-family: "Source Serif 4", Georgia, serif; font-size: 15px; line-height: 1.42; }
    .box { margin: 8px 0 0; padding: 8px 10px; background: #f2efe6; border-top: 3px solid #121418; }
    .box h4 { margin: 0 0 6px; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; }
    .box ul { margin: 0; padding: 0; list-style: none; }
    .box li { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; font-size: 12.5px; border-bottom: 1px dotted rgba(18,20,24,0.15); }
    .related { list-style: none; margin: 8px 0 0; padding: 6px 0 0; border-top: 1px dotted rgba(18,20,24,0.15); font-size: 11.5px; color: #3a3e46; }
    .related em { font-style: normal; font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-right: 6px; color: #6b6f78; }
  </style>
</head>
<body>
  <div class="sheet">
    <header>
      <div>
        <div class="code">${esc(code)}</div>
        <p>Thompson Times · ${esc(title)} · Recaps</p>
      </div>
      <p>${esc(pressId)} · ${leagueCards.length} wraps</p>
    </header>
    <div class="flow">${sections}</div>
  </div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));
}

const outDir = process.env.TIMES_RECAPS_OUT || "/tmp/times-recaps";
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/nfl.html`, htmlFor("football/nfl", "National Football League", "NFL"));
writeFileSync(`${outDir}/cfb.html`, htmlFor("football/college-football", "College Football", "CFB"));
writeFileSync(`${outDir}/tally.json`, JSON.stringify({ pressId, tallies, filed: filed.length }, null, 2));

const missing: string[] = [];
for (const league of ["NFL", "NHL", "MLB", "NBA"] as const) {
  const row = tallies.find((r) => r.league === league);
  if (!row || row.finals < 1) missing.push(`${league} finals=${row?.finals ?? 0}`);
  if (row && row.wraps < row.finals) missing.push(`${league} wraps=${row.wraps}/${row.finals}`);
}
const nfl = tallies.find((r) => r.league === "NFL");
if (!nfl || nfl.finals < 14) missing.push(`NFL finals=${nfl?.finals ?? 0}`);
const nba = tallies.find((r) => r.league === "NBA");
if (nba && nba.boxWraps < 1 && nba.finals > 0) missing.push("NBA preseason produced no Times box wrap");

console.log(JSON.stringify({ pressId, tallies, outDir, missing }, null, 2));
if (missing.length) throw new Error(`times-recaps live proof failed: ${missing.join("; ")}`);
console.log("times-recaps live proof ok");
