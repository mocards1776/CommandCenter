/**
 * iPad-width compact recap-card proofs from live ESPN summaries.
 * Run from CommandCenter-main/:
 *   node --experimental-strip-types scripts/render-times-recap-template.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fetchEspnBox, printEspnBoxHtml, printRecapFillHtml } from "../src/lib/newspaper-agate.ts";
import { newspaperEspnGet } from "../src/lib/newspaper-espn.ts";
import { periodLabels } from "../src/lib/newspaper-box.ts";
import {
  formatRecapWhen,
  pickRecapLeaders,
  recapCardGraf,
  recapDropLead,
  recapPrintStory,
  recapPullQuote,
  type RecapLeader,
} from "../src/lib/newspaper-recap.ts";

type Event = {
  id?: string;
  date?: string;
  competitions?: {
    venue?: { fullName?: string };
    status?: { type?: { completed?: boolean; detail?: string; shortDetail?: string } };
    headlines?: { shortLinkText?: string; description?: string }[];
    competitors?: {
      homeAway?: string;
      score?: string;
      winner?: boolean;
      hits?: number;
      errors?: number;
      linescores?: { value?: number }[];
      records?: { type?: string; summary?: string }[];
      team?: {
        displayName?: string;
        shortDisplayName?: string;
        abbreviation?: string;
        color?: string;
        logo?: string;
      };
    }[];
  }[];
};

type Side = {
  name: string;
  short: string;
  abbrev: string;
  color: string | null;
  logo: string | null;
  score: string;
  record: string | null;
  hits: string | null;
  errors: string | null;
  lines: (number | null)[];
};

type CardGame = {
  headline: string;
  byline: string;
  when: string;
  venue: string | null;
  status: string;
  dateline: string | null;
  graf: string;
  dropCap: boolean;
  story: string;
  photo: string | null;
  caption: string;
  away: Side;
  home: Side;
  periods: string[];
  leaders: RecapLeader[];
  boxHtml: string;
  fillHtml: string;
  pageFillHtml: string;
  quote: string | null;
  photo2: string | null;
  path: string;
};

const DESKS = [
  { path: "football/nfl", league: "NFL", file: "nfl-page" },
  { path: "baseball/mlb", league: "MLB", file: "mlb-page" },
  { path: "hockey/nhl", league: "NHL", file: "nhl-page" },
] as const;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function shift(day: string, n: number): string {
  const d = new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));
}

function paint(color: string | null | undefined): string {
  if (!color) return "#1f2a44";
  return color.startsWith("#") ? color : `#${color}`;
}

async function latestFinals(path: string, want: number): Promise<{ event: Event; day: string }[]> {
  const today = ymd(new Date());
  const out: { event: Event; day: string }[] = [];
  const seen = new Set<string>();
  for (const delta of [0, -1, -2, -3, -4, -5, -6]) {
    const day = shift(today, delta);
    try {
      const board = (await newspaperEspnGet(`${path}/scoreboard?dates=${day}&limit=300`)) as { events?: Event[] };
      for (const ev of board.events ?? []) {
        if (!ev.id || seen.has(ev.id)) continue;
        if (!ev.competitions?.[0]?.status?.type?.completed) continue;
        seen.add(ev.id);
        out.push({ event: ev, day });
        if (out.length >= want) return out;
      }
    } catch {
      /* try an earlier day */
    }
  }
  return out;
}

async function loadGame(path: string, found: { event: Event; day: string }): Promise<CardGame | null> {
  if (!found.event.id) return null;
  const box = await fetchEspnBox(path, found.event.id);
  const sum = (await newspaperEspnGet(`${path}/summary?event=${found.event.id}`)) as {
    article?: { story?: string; byline?: string; images?: { url?: string; width?: number; caption?: string }[] };
  };
  const comp = found.event.competitions?.[0];
  const awayC = comp?.competitors?.find((c) => c.homeAway === "away");
  const homeC = comp?.competitors?.find((c) => c.homeAway === "home");
  if (!awayC?.team || !homeC?.team) return null;
  const side = (c: NonNullable<typeof awayC>): Side => {
    const packSide = box && (c.homeAway === "away" ? box.game.away : box.game.home);
    return {
      name: c.team!.displayName || c.team!.shortDisplayName || "—",
      short: c.team!.shortDisplayName || c.team!.displayName || "—",
      abbrev: (c.team!.abbreviation || "—").toUpperCase(),
      color: c.team!.color ? `#${c.team!.color}` : packSide?.color ?? null,
      logo: c.team!.logo ?? packSide?.logo ?? null,
      score: c.score ?? "–",
      record: c.records?.find((r) => r.type === "total")?.summary ?? null,
      hits: packSide?.hits ?? (c.hits != null ? String(c.hits) : null),
      errors: packSide?.errors ?? (c.errors != null ? String(c.errors) : null),
      lines: (c.linescores ?? []).map((l) => (typeof l.value === "number" ? l.value : null)),
    };
  };
  const away = side(awayC);
  const home = side(homeC);
  const leaders = pickRecapLeaders(
    path,
    (box?.game.leaders ?? []).map((l) => ({
      label: l.label,
      name: l.name,
      line: l.line ?? "",
      headshot: l.headshot,
      team: l.team,
      id: l.id,
      href: null,
    })),
    box?.game.decisions ?? [],
  );
  const rawStory = sum.article?.story || "";
  const graf = recapCardGraf(rawStory);
  const printed = recapPrintStory(rawStory, null);
  const image = sum.article?.images?.[0];
  const image2 = (sum.article?.images ?? []).find((img) => img.url && img.url !== image?.url);
  const quote = recapPullQuote(rawStory);
  const nextUp = box?.nextUp ?? null;
  const fillMatter = {
    quote,
    photo2: image2?.url ? { url: image2.url, caption: image2.caption ?? null } : null,
    nextUp,
  };
  const periods = box?.game.periods?.length
    ? box.game.periods
    : periodLabels(path, Math.max(away.lines.length, home.lines.length, 1));
  return {
    headline: comp?.headlines?.[0]?.shortLinkText || `${away.short} ${away.score}, ${home.short} ${home.score}`,
    byline: sum.article?.byline || "Wire",
    when: formatRecapWhen(found.event.date ?? null),
    venue: box?.game.venue || comp?.venue?.fullName || null,
    status: comp?.status?.type?.shortDetail || "Final",
    dateline: graf.dateline,
    graf: graf.body,
    dropCap: graf.dropCap,
    story: printed.body,
    photo: image?.url ?? null,
    caption: image?.caption || `${away.name} at ${home.name}.`,
    away,
    home,
    periods,
    leaders,
    boxHtml: box ? printEspnBoxHtml(box) : "",
    fillHtml: box ? printRecapFillHtml(box, fillMatter, "card") : "",
    pageFillHtml: box ? printRecapFillHtml(box, fillMatter, "page") : "",
    quote,
    photo2: image2?.url ?? null,
    path,
  };
}

const SHEET_CSS = `
  html, body { margin: 0; background: #151b28; }
  .sheet {
    box-sizing: border-box; width: 1032px; min-height: 1000px; height: 1000px; margin: 0 auto;
    padding: 12px 20px 14px; background: #fbfaf6; color: #121418;
    font-family: "Libre Franklin", system-ui, sans-serif;
    display: flex; flex-direction: column;
  }
  .folio { margin: 0 0 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6f78; display: flex; justify-content: space-between; }
  .folio b { color: #121418; }
  .tt-recap-page { flex: 1; display: grid; gap: 6px; min-height: 0; align-items: stretch; align-content: stretch; }
  .tt-recap-page.n2 { grid-template-rows: 1fr 1fr; }
  .tt-recap-page.n3 { grid-template-rows: 1fr 1fr 1fr; }
  .tt-recap-card { height: 100%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; padding: 0 0 4px; border-bottom: 1px solid #e4e0d4; }
  .tt-recap-card:last-child { border-bottom: 0; padding-bottom: 0; }
  .tt-recap-card-copy { flex: 0 0 auto; min-height: 0; }
  .tt-recap-fill { flex: 1 1 auto; min-height: 0; overflow: hidden; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e4e0d4; display: flex; flex-direction: column; gap: 5px; }
  .tt-recap-fill-block h4, .tt-recap-fill-next h4 { margin: 0 0 2px; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #6b6f78; }
  .tt-recap-fill-score, .tt-recap-fill-stats { width: 100%; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
  .tt-recap-fill-score th, .tt-recap-fill-score td, .tt-recap-fill-stats th, .tt-recap-fill-stats td { padding: 1px 4px; text-align: right; border-bottom: 1px solid #e4e0d4; white-space: nowrap; }
  .tt-recap-fill-score .n, .tt-recap-fill-stats .n { text-align: left; white-space: normal; }
  .tt-recap-fill-score .per { font-weight: 800; font-size: 9px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b6f78; text-align: left; }
  .tt-recap-fill-score .play { max-width: 0; width: 46%; overflow: hidden; text-overflow: ellipsis; }
  .tt-recap-fill-photo { flex: 1 1 auto; min-height: 48px; margin: 0; overflow: hidden; }
  .tt-recap-fill-photo img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; }
  .tt-recap-fill-quote { margin: 0; padding: 3px 0 3px 8px; border-left: 3px solid #121418; font-family: "Source Serif 4", Georgia, serif; font-style: italic; font-size: 13px; line-height: 1.3; }
  .tt-recap-fill-next p { margin: 0; font-size: 12px; font-weight: 600; }
  .wsj-kicker { margin: 0; font-size: 10px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #b3121d; }
  .wsj-hl { margin: 2px 0 3px; font-family: "Playfair Display", Georgia, serif; font-size: 20px; line-height: 1.08; }
  .tt-score-mast { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: #121418; border: 2px solid #121418; }
  .tt-score-mast-side { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 6px; min-height: 40px; padding: 4px 8px; color: #fff; }
  .tt-score-mast-side em { display: block; font-style: normal; font-size: 8px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.8; }
  .tt-score-mast-side strong { display: block; font-family: "Playfair Display", Georgia, serif; font-size: 13px; }
  .tt-score-mast-side b { font-family: Oswald, sans-serif; font-size: 22px; font-weight: 600; line-height: 1; }
  .tt-score-mast-state { position: absolute; left: 50%; top: 3px; transform: translateX(-50%); padding: 1px 6px; background: #fbfaf6; color: #121418; font-size: 8px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
  .tt-mark { width: 22px; height: 22px; object-fit: contain; }
  table.tt-line { width: 100%; border-collapse: collapse; font-family: Oswald, sans-serif; font-size: 12px; margin: 4px 0 0; }
  table.tt-line th, table.tt-line td { padding: 2px 3px; text-align: center; border-bottom: 1px solid #e4e0d4; }
  table.tt-line .team { text-align: left; }
  .tt-line-team { display: flex; align-items: center; gap: 6px; }
  .tt-line-team em { font-style: normal; font-size: 9px; color: #6b6f78; font-family: "Libre Franklin", sans-serif; }
  .tt-recap-chips { list-style: none; margin: 4px 0 0; padding: 4px 0 0; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px 10px; border-top: 1px solid #e4e0d4; }
  .tt-recap-chips li { display: flex; gap: 6px; align-items: center; min-width: 0; }
  .tt-recap-chips em { display: block; font-style: normal; font-size: 8px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #6b6f78; }
  .tt-recap-chips b { display: block; font-size: 12px; }
  .tt-recap-chips i { display: block; font-style: normal; font-size: 10.5px; color: #3a3e46; }
  .tt-face { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: #eee; flex: none; }
  .tt-recap-photo.card { float: right; width: 112px; margin: 2px 0 6px 10px; }
  .tt-recap-photo.card img { width: 100%; height: 74px; object-fit: cover; object-position: center top; display: block; }
  .tt-recap-graf { margin: 3px 0 0; font-family: "Source Serif 4", Georgia, serif; font-size: 14.5px; line-height: 1.4; }
  .tt-recap-graf .wsj-drop { float: left; margin: 0.04em 0.08em 0 0; font-family: "Playfair Display", Georgia, serif; font-weight: 900; font-size: 3.2em; line-height: 0.8; }
  .wsj-dateline { font-weight: 800; letter-spacing: 0.08em; font-size: 0.78em; text-transform: uppercase; }
  .tt-recap-more { clear: both; margin: 8px 0 0; }
  .tt-recap-full { display: inline-flex; align-items: center; padding: 5px 12px; border: 1px solid #121418; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
`;

const READER_CSS = `
  html, body { margin: 0; background: #151b28; }
  .reader { box-sizing: border-box; width: 1032px; margin: 0 auto; padding: 18px 36px 36px; background: #fbfaf6; color: #121418; font-family: "Libre Franklin", system-ui, sans-serif; }
  .bar { display: flex; justify-content: space-between; align-items: center; margin: 0 0 16px; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #6b6f78; }
  .bar b { color: #121418; }
  .save { padding: 3px 8px; border: 1px solid #121418; color: #121418; }
  .wsj-kicker { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #b3121d; }
  h1 { margin: 6px 0 8px; font-family: "Playfair Display", Georgia, serif; font-size: 30px; line-height: 1.05; }
  .by { margin: 0 0 14px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #5b5f68; }
  .by em { font-style: italic; font-family: "Source Serif 4", Georgia, serif; text-transform: none; letter-spacing: 0; margin-right: 4px; }
  .wsj-dateline { font-weight: 800; letter-spacing: 0.08em; font-size: 0.78em; text-transform: uppercase; }
  .tt-score-mast { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 3px; background: #121418; border: 3px solid #121418; }
  .tt-score-mast-side { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; min-height: 56px; padding: 8px 10px; color: #fff; }
  .tt-score-mast-side em { display: block; font-style: normal; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.8; }
  .tt-score-mast-side strong { display: block; font-family: "Playfair Display", Georgia, serif; font-size: 18px; }
  .tt-score-mast-side b { font-family: Oswald, sans-serif; font-size: 34px; font-weight: 600; line-height: 1; }
  .tt-score-mast-state { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); padding: 2px 8px; background: #fbfaf6; color: #121418; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
  .tt-mark { width: 36px; height: 36px; object-fit: contain; }
  .tt-recap-linehead { display: flex; justify-content: space-between; margin: 10px 0 4px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6f78; }
  .tt-recap-linehead b { color: #121418; }
  table.tt-line { width: 100%; border-collapse: collapse; font-family: Oswald, sans-serif; }
  table.tt-line th, table.tt-line td { padding: 5px; text-align: center; border-bottom: 1px solid #e4e0d4; }
  table.tt-line .team { text-align: left; }
  .tt-line-team { display: flex; align-items: center; gap: 7px; }
  .tt-line-team em { font-style: normal; font-size: 10px; color: #6b6f78; font-family: "Libre Franklin", sans-serif; }
  .tt-recap-chips { list-style: none; margin: 10px 0 0; padding: 10px 0 0; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; border-top: 1px solid #e4e0d4; }
  .tt-recap-chips li { display: flex; gap: 8px; align-items: center; }
  .tt-recap-chips em { display: block; font-style: normal; font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #6b6f78; }
  .tt-recap-chips b { display: block; font-size: 13px; }
  .tt-recap-chips i { display: block; font-style: normal; font-size: 11.5px; color: #3a3e46; }
  .tt-face { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: #eee; }
  .tt-recap-photo { margin: 16px 0; }
  .tt-recap-photo.wide img { width: 100%; max-height: 220px; object-fit: cover; object-position: center top; display: block; }
  .tt-recap-photo figcaption { margin-top: 5px; font-size: 12px; font-style: italic; color: #6b6f78; }
  .story { font-family: "Source Serif 4", Georgia, serif; font-size: 18px; line-height: 1.6; max-width: 42rem; }
  .story.drop .wsj-drop { float: left; margin: 0.05em 0.1em 0 0; font-family: "Playfair Display", Georgia, serif; font-weight: 900; font-size: 4.2em; line-height: 0.8; }
  .box { clear: both; margin-top: 22px; padding-top: 10px; border-top: 2px solid #121418; }
  .box h3 { margin: 0 0 10px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
`;

function mast(away: Side, home: Side, status: string, slim: boolean): string {
  const side = (s: Side, label: string) => `<div class="tt-score-mast-side" style="background:${paint(s.color)}">
    ${s.logo ? `<img class="tt-mark" src="${esc(s.logo)}" alt="" />` : ""}
    <span><em>${label}</em><strong>${esc(s.short)}</strong></span>
    <b>${esc(s.score)}</b>
  </div>`;
  return `<div class="tt-score-mast${slim ? " slim" : ""}">${side(away, "Away")}${side(home, "Home")}<span class="tt-score-mast-state">${esc(status)}</span></div>`;
}

function lineTable(game: CardGame): string {
  const mlb = game.path.startsWith("baseball/");
  const rows = [game.away, game.home]
    .map(
      (s) => `<tr>
        <th class="team"><span class="tt-line-team">${s.logo ? `<img class="tt-mark" src="${esc(s.logo)}" alt="" />` : ""}<b>${esc(s.abbrev)}</b>${s.record ? `<em>${esc(s.record)}</em>` : ""}</span></th>
        ${game.periods.map((_, i) => `<td>${s.lines[i] ?? "–"}</td>`).join("")}
        <td>${esc(s.score)}</td>
        ${mlb ? `<td>${esc(s.hits ?? "–")}</td><td>${esc(s.errors ?? "–")}</td>` : ""}
      </tr>`,
    )
    .join("");
  return `<table class="tt-line"><thead><tr><th class="team"></th>${game.periods.map((p) => `<th>${esc(p)}</th>`).join("")}<th>${mlb ? "R" : "T"}</th>${mlb ? "<th>H</th><th>E</th>" : ""}</tr></thead><tbody>${rows}</tbody></table>`;
}

function chips(game: CardGame): string {
  return `<ul class="tt-recap-chips">${game.leaders
    .map((l) => {
      const face = l.headshot
        ? `<img class="tt-face" src="${esc(l.headshot)}" alt="" />`
        : `<span class="tt-face"></span>`;
      return `<li>${face}<span><em>${esc(l.label)}${l.team ? ` · ${esc(l.team)}` : ""}</em><b>${esc(l.name)}</b>${l.line ? `<i>${esc(l.line)}</i>` : ""}</span></li>`;
    })
    .join("")}</ul>`;
}

function cardHtml(game: CardGame, league: string): string {
  const lead = recapDropLead(game.dateline, game.graf);
  const graf = lead
    ? `<p class="tt-recap-graf${game.dropCap ? " drop" : ""}">${
        game.dropCap
          ? `<span class="wsj-drop">${esc(lead.letter)}</span>${
              lead.datelineRest != null ? `<span class="wsj-dateline">${esc(lead.datelineRest)} — </span>` : ""
            }${esc(lead.body)}`
          : `${lead.city ? `<span class="wsj-dateline">${esc(lead.city)} — </span>` : ""}${esc(
              lead.city ? lead.body : `${lead.letter}${lead.body}`,
            )}`
      }</p>`
    : "";
  const photo = game.photo
    ? `<figure class="tt-recap-photo card"><img src="${esc(game.photo)}" alt="" /></figure>`
    : "";
  return `<article class="tt-recap-card">
    ${mast(game.away, game.home, game.status, true)}
    ${lineTable(game)}
    ${chips(game)}
    <div class="tt-recap-card-copy">
      ${photo}
      <p class="wsj-kicker">${esc(league)}</p>
      <h2 class="wsj-hl">${esc(game.headline)}</h2>
      ${graf}
      <p class="tt-recap-more"><span class="tt-recap-full">Full story ›</span></p>
    </div>
    ${game.fillHtml ? `<div class="tt-recap-fill">${game.fillHtml}</div>` : ""}
  </article>`;
}

function pageHtml(league: string, games: CardGame[]): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>Thompson Times · ${esc(league)} recaps</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600;800&family=Oswald:wght@600&family=Playfair+Display:wght@700;900&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap" />
<style>${SHEET_CSS}</style></head>
<body><div class="sheet">
  <p class="folio"><b>The Thompson Times</b><span>${esc(league)} · Recaps · iPad 1366×1024</span></p>
  <div class="tt-recap-page n${games.length}">${games.map((g) => cardHtml(g, league)).join("")}</div>
</div></body></html>`;
}

const FAVORITE_ABBREV: Record<string, Set<string>> = {
  "football/nfl": new Set(["DET", "KC"]),
  "baseball/mlb": new Set(["STL"]),
  "hockey/nhl": new Set(["STL"]),
  "basketball/nba": new Set(["PHI"]),
  "football/college-football": new Set(["MIZ"]),
};

function isFavoriteGame(game: CardGame): boolean {
  const want = FAVORITE_ABBREV[game.path];
  if (!want) return false;
  return want.has(game.away.abbrev) || want.has(game.home.abbrev);
}

function sectionAHtml(league: string, game: CardGame): string {
  const excerpt = recapPrintStory(game.story, 720);
  const lead = recapDropLead(game.dateline, excerpt.body);
  const story = lead
    ? `<p class="story drop"><span class="wsj-drop">${esc(lead.letter)}</span>${
        lead.datelineRest != null ? `<span class="wsj-dateline">${esc(lead.datelineRest)} — </span>` : ""
      }${esc(lead.body)}</p>`
    : "";
  const photo = game.photo
    ? `<figure class="tt-recap-photo wide"><img src="${esc(game.photo)}" alt="" />${
        game.caption ? `<figcaption>${esc(game.caption)}</figcaption>` : ""
      }</figure>`
    : "";
  const want = FAVORITE_ABBREV[game.path];
  const club = want?.has(game.home.abbrev) ? game.home.short : game.away.short;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>Thompson Times · Section A · ${esc(club)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600;800&family=Oswald:wght@600&family=Playfair+Display:wght@700;900&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap" />
<style>${READER_CSS}
  .reader { box-sizing: border-box; width: 1032px; height: 1000px; min-height: 1000px; overflow: hidden; margin: 0 auto; padding: 12px 28px 16px; display: flex; flex-direction: column; }
  .folio { margin: 0 0 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6f78; display: flex; justify-content: space-between; flex: none; }
  .folio b { color: #121418; }
  h1 { font-size: 26px; }
  .tt-recap-photo.wide img { max-height: 160px; }
  .story { font-size: 16px; line-height: 1.45; max-width: none; flex: none; }
  .tt-recap-fill { flex: 1 1 auto; min-height: 0; overflow: hidden; margin-top: 8px; padding-top: 8px; border-top: 2px solid #121418; display: flex; flex-direction: column; gap: 6px; }
  .tt-recap-fill-block h4, .tt-recap-fill-next h4 { margin: 0 0 2px; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #6b6f78; }
  .tt-recap-fill-score, .tt-recap-fill-stats { width: 100%; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
  .tt-recap-fill-score th, .tt-recap-fill-score td, .tt-recap-fill-stats th, .tt-recap-fill-stats td { padding: 1px 4px; text-align: right; border-bottom: 1px solid #e4e0d4; white-space: nowrap; }
  .tt-recap-fill-score .n, .tt-recap-fill-stats .n { text-align: left; white-space: normal; }
  .tt-recap-fill-score .per { font-weight: 800; font-size: 9px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b6f78; text-align: left; }
  .tt-recap-fill-score .play { max-width: 0; width: 48%; overflow: hidden; text-overflow: ellipsis; }
  .tt-recap-fill-photo { flex: 1 1 auto; min-height: 64px; margin: 0; overflow: hidden; }
  .tt-recap-fill-photo img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center top; }
  .tt-recap-fill-quote { margin: 0; padding: 4px 0 4px 10px; border-left: 3px solid #e31837; font-family: "Source Serif 4", Georgia, serif; font-style: italic; font-size: 15px; line-height: 1.35; }
  .tt-recap-fill-next p { margin: 0; font-size: 13px; font-weight: 600; }
</style></head>
<body><div class="reader">
  <p class="folio"><b>The Thompson Times</b><span>Section A · The Essentials · ${esc(club)} · iPad 1366×1024</span></p>
  <p class="wsj-kicker">${esc(league)} · ${esc(club)} desk</p>
  <h1>${esc(game.headline)}</h1>
  <p class="by"><em>By</em> ${esc(game.byline)}${game.when ? ` · ${esc(game.when)}` : ""}</p>
  ${mast(game.away, game.home, game.status, false)}
  <div class="tt-recap-linehead"><b>${esc(game.status)}</b><span>${esc(game.venue || "")}</span></div>
  ${lineTable(game)}
  ${chips(game)}
  ${photo}
  ${story}
  ${game.pageFillHtml ? `<div class="tt-recap-fill">${game.pageFillHtml}</div>` : ""}
</div></body></html>`;
}

function readerHtml(league: string, game: CardGame): string {
  const lead = recapDropLead(game.dateline, game.story);
  const story = lead
    ? `<p class="story drop"><span class="wsj-drop">${esc(lead.letter)}</span>${
        lead.datelineRest != null ? `<span class="wsj-dateline">${esc(lead.datelineRest)} — </span>` : ""
      }${esc(lead.body)}</p>`
    : "";
  const photo = game.photo
    ? `<figure class="tt-recap-photo wide"><img src="${esc(game.photo)}" alt="" />${
        game.caption ? `<figcaption>${esc(game.caption)}</figcaption>` : ""
      }</figure>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>Thompson Times · ${esc(league)} reader</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600;800&family=Oswald:wght@600&family=Playfair+Display:wght@700;900&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap" />
<style>${READER_CSS}</style></head>
<body><div class="reader">
  <p class="bar"><span>← Back to the paper</span><b>The Thompson Times</b><span class="save">Save</span></p>
  <p class="wsj-kicker">${esc(league)}</p>
  <h1>${esc(game.headline)}</h1>
  <p class="by"><em>By</em> ${esc(game.byline)}${game.when ? ` · ${esc(game.when)}` : ""}</p>
  ${mast(game.away, game.home, game.status, false)}
  <div class="tt-recap-linehead"><b>${esc(game.status)}</b><span>${esc(game.venue || "")}</span></div>
  ${lineTable(game)}
  ${chips(game)}
  ${photo}
  ${story}
  ${game.boxHtml ? `<section class="box"><h3>Box score</h3>${game.boxHtml}</section>` : ""}
</div></body></html>`;
}

const outDir = process.env.TIMES_RECAP_OUT || "/tmp/times-recap-template";
mkdirSync(outDir, { recursive: true });
const written: string[] = [];
let readerGame: CardGame | null = null;
let readerLeague = "NFL";
let sectionA: { league: string; game: CardGame } | null = null;

for (const desk of DESKS) {
  const found = await latestFinals(desk.path, 8);
  const games: CardGame[] = [];
  for (const row of found) {
    const game = await loadGame(desk.path, row);
    if (game) games.push(game);
  }
  if (games.length < 2) {
    console.error(`need 2+ finals for ${desk.league}, got ${games.length}`);
    continue;
  }
  const file = `${outDir}/${desk.file}.html`;
  writeFileSync(file, pageHtml(desk.league, games.slice(0, 2)));
  written.push(file);
  if (!readerGame && games[0]) {
    readerGame = games[0];
    readerLeague = desk.league;
  }
  if (!sectionA) {
    const hit = games.find(isFavoriteGame);
    if (hit) sectionA = { league: desk.league, game: hit };
  }
}

if (readerGame) {
  const file = `${outDir}/reader-recap.html`;
  writeFileSync(file, readerHtml(readerLeague, readerGame));
  written.push(file);
}

if (!sectionA) {
  for (const desk of [
    { path: "football/nfl", league: "NFL" },
    { path: "hockey/nhl", league: "NHL" },
    { path: "baseball/mlb", league: "MLB" },
  ] as const) {
    const found = await latestFinals(desk.path, 16);
    for (const row of found) {
      const game = await loadGame(desk.path, row);
      if (game && isFavoriteGame(game)) {
        sectionA = { league: desk.league, game };
        break;
      }
    }
    if (sectionA) break;
  }
}

if (sectionA) {
  const file = `${outDir}/section-a-recap.html`;
  writeFileSync(file, sectionAHtml(sectionA.league, sectionA.game));
  written.push(file);
}

writeFileSync(`${outDir}/index.json`, JSON.stringify({ written }, null, 2));
console.log(JSON.stringify({ outDir, written }, null, 2));
if (written.length < 5) throw new Error(`expected 5 proofs, wrote ${written.length}`);
console.log("times recap card proof ok");
