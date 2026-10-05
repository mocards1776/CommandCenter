/**
 * iPad-width recap proofs from live ESPN summaries.
 * Run from CommandCenter-main/:
 *   node --experimental-strip-types scripts/render-times-recap-template.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fetchEspnBox, printEspnBoxHtml } from "../src/lib/newspaper-agate.ts";
import { newspaperEspnGet } from "../src/lib/newspaper-espn.ts";
import {
  formatRecapWhen,
  pickRecapLeaders,
  recapPhotoKind,
  recapDropLead,
  recapPrintStory,
  type RecapLeader,
} from "../src/lib/newspaper-recap.ts";

type Event = {
  id?: string;
  date?: string;
  competitions?: {
    venue?: { fullName?: string };
    status?: { type?: { completed?: boolean; detail?: string; shortDetail?: string } };
    competitors?: {
      homeAway?: string;
      score?: string;
      winner?: boolean;
      hits?: number;
      errors?: number;
      linescores?: { value?: number }[];
      records?: { type?: string; summary?: string }[];
      team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string; color?: string; logo?: string };
    }[];
    headlines?: { shortLinkText?: string; description?: string }[];
  }[];
};

const DESKS = [
  { path: "football/nfl", league: "NFL", file: "nfl-recap", compact: false },
  { path: "baseball/mlb", league: "MLB", file: "mlb-recap", compact: false },
  { path: "hockey/nhl", league: "NHL", file: "nhl-recap", compact: false },
  { path: "basketball/nba", league: "NBA", file: "nba-recap", compact: true },
] as const;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function shift(day: string, n: number): string {
  const d = new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

async function latestFinal(path: string): Promise<{ event: Event; day: string } | null> {
  const today = ymd(new Date());
  for (const delta of [0, -1, -2, -3, -4, -5, -6]) {
    const day = shift(today, delta);
    try {
      const board = (await newspaperEspnGet(`${path}/scoreboard?dates=${day}&limit=300`)) as { events?: Event[] };
      const hit = (board.events ?? []).find((ev) => ev.competitions?.[0]?.status?.type?.completed);
      if (hit) return { event: hit, day };
    } catch {
      /* try an earlier day */
    }
  }
  return null;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));
}

function paint(color: string | null | undefined): string {
  if (!color) return "#1f2a44";
  return color.startsWith("#") ? color : `#${color}`;
}

function htmlFor(opts: {
  league: string;
  path: string;
  headline: string;
  byline: string;
  when: string;
  venue: string | null;
  status: string;
  compact: boolean;
  dateline: string | null;
  away: {
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
  home: {
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
  periods: string[];
  leaders: RecapLeader[];
  photo: string | null;
  photoWidth: number | null;
  caption: string;
  story: string;
  dropCap: boolean;
  boxHtml: string;
}): string {
  const kind = recapPhotoKind(opts.photo, opts.photoWidth);
  const photo =
    kind === "none" || !opts.photo
      ? ""
      : `<figure class="tt-recap-photo ${kind}"><img src="${esc(opts.photo)}" alt="" />${opts.caption ? `<figcaption>${esc(opts.caption)}</figcaption>` : ""}</figure>`;
  const chips = opts.leaders
    .map((l) => {
      const face = l.headshot
        ? `<img class="tt-face md" src="${esc(l.headshot)}" alt="" />`
        : l.team || opts.home.logo
          ? `<img class="tt-recap-chip-logo" src="${esc(l.headshot || (l.team === opts.away.abbrev ? opts.away.logo : opts.home.logo) || opts.home.logo || "")}" alt="" />`
          : `<span class="tt-face md empty"></span>`;
      return `<li>${face}<span><em>${esc(l.label)}${l.team ? ` · ${esc(l.team)}` : ""}</em><b>${esc(l.name)}</b>${l.line ? `<i>${esc(l.line)}</i>` : ""}</span></li>`;
    })
    .join("");
  const mlb = opts.path.startsWith("baseball/");
  const lineRows = [opts.away, opts.home]
    .map(
      (s) => `<tr>
        <th class="team"><span class="tt-line-team">${s.logo ? `<img class="tt-mark xs" src="${esc(s.logo)}" alt="" />` : ""}<b>${esc(s.short)}</b>${s.record ? `<em>${esc(s.record)}</em>` : ""}</span></th>
        ${opts.periods.map((_, i) => `<td class="per">${s.lines[i] ?? "–"}</td>`).join("")}
        <td class="tot">${esc(s.score)}</td>
        ${mlb ? `<td class="rhe">${esc(s.hits ?? "–")}</td><td class="rhe">${esc(s.errors ?? "–")}</td>` : ""}
      </tr>`,
    )
    .join("");
  const lead = recapDropLead(opts.dateline, opts.story);
  const story =
    lead &&
    `<p class="story${opts.dropCap ? " drop" : ""} ended">${
      opts.dropCap
        ? `<span class="drop">${esc(lead.letter)}</span>${
            lead.datelineRest != null ? `<span class="wsj-dateline">${esc(lead.datelineRest)} — </span>` : ""
          }${esc(lead.body)}`
        : `${lead.city ? `<span class="wsj-dateline">${esc(lead.city)} — </span>` : ""}${esc(
            lead.city ? lead.body : `${lead.letter}${lead.body}`,
          )}`
    }</p>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Thompson Times · ${esc(opts.league)} recap</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@600;800&family=Oswald:wght@600&family=Playfair+Display:wght@700;900&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap" />
  <style>
    html, body { margin: 0; background: #151b28; }
    .sheet { box-sizing: border-box; width: 1032px; margin: 0 auto; padding: 28px 36px 40px; background: #fbfaf6; color: #121418; font-family: "Libre Franklin", system-ui, sans-serif; }
    .wsj-kicker { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #b3121d; }
    h1 { margin: 6px 0 8px; font-family: "Playfair Display", Georgia, serif; font-size: ${opts.compact ? "32px" : "42px"}; line-height: 1.05; }
    .by { margin: 0 0 14px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #5b5f68; }
    .by em { font-style: italic; font-family: "Source Serif 4", Georgia, serif; text-transform: none; letter-spacing: 0; margin-right: 4px; }
    .wsj-dateline { font-weight: 800; letter-spacing: 0.08em; font-size: 0.78em; text-transform: uppercase; }
    .tt-score-mast { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 3px; background: #121418; border: 3px solid #121418; }
    .tt-score-mast-side { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; min-height: ${opts.compact ? "56px" : "72px"}; padding: 10px 12px; color: #fff; }
    .tt-score-mast-side em { display: block; font-style: normal; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.8; }
    .tt-score-mast-side strong { display: block; font-family: "Playfair Display", Georgia, serif; font-size: ${opts.compact ? "16px" : "20px"}; }
    .tt-score-mast-side b { font-family: Oswald, sans-serif; font-size: ${opts.compact ? "28px" : "36px"}; font-weight: 600; line-height: 1; }
    .tt-score-mast-state { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); padding: 2px 8px; background: #fbfaf6; color: #121418; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .tt-mark { width: 18px; height: 18px; object-fit: contain; }
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
    .tt-recap-chip-logo { width: 36px; height: 36px; object-fit: contain; }
    .tt-recap-photo { margin: 16px 0; }
    .tt-recap-photo.wide img { width: 100%; max-height: 420px; object-fit: cover; display: block; }
    .tt-recap-photo.inset { float: right; width: 280px; margin: 4px 0 12px 18px; }
    .tt-recap-photo.inset img { width: 100%; height: auto; display: block; }
    .tt-recap-photo figcaption { margin-top: 5px; font-size: 12px; font-style: italic; color: #6b6f78; }
    .story { font-family: "Source Serif 4", Georgia, serif; font-size: 18px; line-height: 1.6; max-width: 42rem; }
    .story.drop .drop { float: left; margin: 0.05em 0.1em 0 0; font-family: "Playfair Display", Georgia, serif; font-weight: 900; font-size: 4.2em; line-height: 0.8; }
    .ended::after { content: " ■"; }
    .box { clear: both; margin-top: 22px; padding-top: 10px; border-top: 2px solid #121418; }
    .box h3 { margin: 0 0 10px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
    .note { margin: 0 0 16px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #6b6f78; }
    .tt-print-group { margin: 14px 0; }
    .tt-print-group.twins { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .tt-print-group.twins h4 { grid-column: 1 / -1; }
    .tt-print-group h4 { margin: 0 0 6px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
    table.tt-print-agate { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    table.tt-print-agate th, table.tt-print-agate td { padding: 2px 4px; border-bottom: 1px solid #e4e0d4; text-align: right; font-family: Oswald, sans-serif; font-weight: 600; }
    table.tt-print-agate th.n, table.tt-print-agate td.n { text-align: left; font-family: "Libre Franklin", sans-serif; font-weight: 600; }
    table.tt-print-agate tr.sub td.n { padding-left: 12px; color: #4a4e56; }
    table.tt-print-agate tfoot td { border-top: 2px solid #121418; }
    table.tt-print-agate tr.per th { text-align: left; letter-spacing: 0.1em; text-transform: uppercase; font-size: 10px; padding-top: 8px; }
    table.tt-print-agate td.play { font-family: "Libre Franklin", sans-serif; font-weight: 500; text-align: left; }
    table.tt-print-agate i { font-style: italic; font-weight: 500; color: #5b5f68; }
    .tt-print-notes { font-size: 11px; color: #5b5f68; }
    .tt-print-notes i { font-style: normal; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="sheet">
    <p class="note">${opts.compact ? "Compact desk wrap" : "Full recap"} · ${esc(opts.league)} · iPad 1032</p>
    <p class="wsj-kicker">${esc(opts.league)}</p>
    <h1>${esc(opts.headline)}</h1>
    <p class="by"><em>By</em> ${esc(opts.byline)}${opts.when ? ` · ${esc(opts.when)}` : ""}</p>
    <div class="tt-score-mast">
      <div class="tt-score-mast-side" style="background:${paint(opts.away.color)}">
        ${opts.away.logo ? `<img class="tt-mark" src="${esc(opts.away.logo)}" alt="" />` : ""}
        <span><em>Away</em><strong>${esc(opts.away.short)}</strong></span>
        <b>${esc(opts.away.score)}</b>
      </div>
      <div class="tt-score-mast-side" style="background:${paint(opts.home.color)}">
        ${opts.home.logo ? `<img class="tt-mark" src="${esc(opts.home.logo)}" alt="" />` : ""}
        <span><em>Home</em><strong>${esc(opts.home.short)}</strong></span>
        <b>${esc(opts.home.score)}</b>
      </div>
      <span class="tt-score-mast-state">${esc(opts.status)}</span>
    </div>
    <div class="tt-recap-linehead"><b>${esc(opts.status)}</b><span>${esc(opts.venue || "")}</span></div>
    <table class="tt-line">
      <thead><tr><th class="team"></th>${opts.periods.map((p) => `<th>${esc(p)}</th>`).join("")}<th class="tot">${mlb ? "R" : "T"}</th>${mlb ? "<th>H</th><th>E</th>" : ""}</tr></thead>
      <tbody>${lineRows}</tbody>
    </table>
    <ul class="tt-recap-chips">${chips}</ul>
    ${photo}
    ${story || ""}
    ${opts.boxHtml ? `<section class="box"><h3>Box score</h3>${opts.boxHtml}</section>` : ""}
  </div>
</body>
</html>`;
}

const outDir = process.env.TIMES_RECAP_OUT || "/tmp/times-recap-template";
mkdirSync(outDir, { recursive: true });
const written: string[] = [];

for (const desk of DESKS) {
  const found = await latestFinal(desk.path);
  if (!found?.event.id) {
    console.error(`no final for ${desk.league}`);
    continue;
  }
  const box = await fetchEspnBox(desk.path, found.event.id);
  const sum = (await newspaperEspnGet(`${desk.path}/summary?event=${found.event.id}`)) as {
    article?: { story?: string; byline?: string; images?: { url?: string; width?: number }[] };
    header?: { competitions?: Event["competitions"] };
  };
  const comp = found.event.competitions?.[0];
  const awayC = comp?.competitors?.find((c) => c.homeAway === "away");
  const homeC = comp?.competitors?.find((c) => c.homeAway === "home");
  if (!awayC?.team || !homeC?.team) continue;
  const side = (c: NonNullable<typeof awayC>, packed: typeof box) => {
    const packSide = packed && (c.homeAway === "away" ? packed.game.away : packed.game.home);
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
  const away = side(awayC, box);
  const home = side(homeC, box);
  const leaders = pickRecapLeaders(
    desk.path,
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
  const printed = recapPrintStory(sum.article?.story || "", desk.compact ? 420 : null);
  const image = sum.article?.images?.[0];
  const html = htmlFor({
    league: desk.league,
    path: desk.path,
    headline: comp?.headlines?.[0]?.shortLinkText || `${away.short} ${away.score}, ${home.short} ${home.score}`,
    byline: sum.article?.byline || `${desk.league} Wire`,
    when: formatRecapWhen(found.event.date ?? null),
    venue: box?.game.venue || comp?.venue?.fullName || null,
    status: comp?.status?.type?.shortDetail || "Final",
    compact: desk.compact,
    dateline: printed.dateline,
    away,
    home,
    periods: box?.game.periods ?? away.lines.map((_, i) => String(i + 1)),
    leaders,
    photo: image?.url ?? null,
    photoWidth: image?.width ?? null,
    caption: `${away.name} at ${home.name}.`,
    story: printed.body,
    dropCap: printed.dropCap,
    boxHtml: desk.compact || !box ? "" : printEspnBoxHtml(box),
  });
  const file = `${outDir}/${desk.file}.html`;
  writeFileSync(file, html);
  written.push(file);
}

writeFileSync(`${outDir}/index.json`, JSON.stringify({ written }, null, 2));
console.log(JSON.stringify({ outDir, written }, null, 2));
if (written.length < 4) throw new Error(`expected 4 recap proofs, wrote ${written.length}`);
console.log("times recap template proof ok");
