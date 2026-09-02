import {
  ESPN,
  UA,
  FETCH_MS,
  SEARCH_MS,
  HEAVY_MS,
  json,
  timedFetch,
  fetchBbrefHtml,
  withBudget,
  safePath,
  stripTags,
  moneyDisplay,
  parseMoney,
  pickCurrentSalary,
  parseBbrefTotals,
  scrapeBbref,
  slugifyName,
  SPOTRAC_PLAYER_RE,
  normalizeSpotracUrl,
  spotracUrlForName,
  findSpotracUrl,
  scrapeSpotrac,
  hasContractBits,
  scrapeContract,
  normPerson,
  firstNamesMatch,
  splitPersonName,
  peopleMatch,
  slugMatchesName,
  notePublishedMs,
  scrapeRotoWireNote,
  parseRotoWorldPosts,
  scrapeRotoWorldFeed,
  scrapeRotoWorldNote,
  scrapePlayerBrief,
  findBbrefManagerUrl,
  parseBbrefInt,
  extractBbrefManagerPhoto,
  detectManagerLeash,
  extractBbrefManagerContract,
  extractBbrefInterimRecord,
  scrapeBbrefManager,
  ordinal,
  fetchGoogleNews,
  isRelevantMlbManagerRumor,
  scrapeManagerRumors,
  scrapeBbrefManagerPhoto,
  kalshiDollarProb,
  kalshiMidProb,
  kalshiAmerican,
  scrapeManagerFiredOdds,
  scrapeManagerMotyOdds,
  scrapeNflCoachFiredOdds,
  scrapeCfbCoachFiredOdds,
  type PlayerNewsNote,
  type RotoWorldFeedItem
} from "./lib-a.ts";

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function scrapeGolferSeasonResults(golferId: string, year: number) {
  const url = `https://www.espn.com/golf/player/results/_/id/${encodeURIComponent(golferId)}/year/${year}`;
  // ESPN bot-walls full Chrome UAs with a tiny 202 page; a short Mozilla/5.0 UA returns the SSR table.
  const html = await (
    await timedFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.espn.com/",
      },
    })
  ).text();
  const results: {
    event: string;
    date: string | null;
    position: string;
    score: string | null;
    tournamentId: string | null;
  }[] = [];
  const rowRe =
    /leaderboard\?tournamentId=(\d+)[^>]*>([^<]+)<\/a>[\s\S]*?<td class="Table__TD">([^<]*)<\/td>[\s\S]*?\((?:<!-- -->)?([-+]?\d+|E)(?:<!-- -->)?\)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const pos = (m[3] ?? "").trim();
    if (!pos) continue;
    results.push({
      event: decodeHtmlEntities((m[2] ?? "").trim()),
      date: null,
      position: pos,
      score: m[4] === "E" ? "E" : m[4] ?? null,
      tournamentId: m[1] ?? null,
    });
  }
  // Fallback without score capture (CUT/WD rows).
  if (!results.length) {
    const loose =
      /leaderboard\?tournamentId=(\d+)[^>]*>([^<]+)<\/a>[\s\S]*?<td class="Table__TD">([^<]*)<\/td>/g;
    while ((m = loose.exec(html))) {
      const pos = (m[3] ?? "").trim();
      if (!pos || /Table__TD/.test(pos)) continue;
      results.push({
        event: decodeHtmlEntities((m[2] ?? "").trim()),
        date: null,
        position: pos,
        score: null,
        tournamentId: m[1] ?? null,
      });
    }
  }
  return { year, results };
}

async function scrapeGolferLastWin(golferId: string) {
  const yearNow = new Date().getUTCFullYear();
  for (let y = yearNow; y >= yearNow - 12; y--) {
    const { results } = await scrapeGolferSeasonResults(golferId, y);
    // ESPN lists chronologically — last win in a year is the latest 1/T1.
    const wins = results.filter((r) => /^(?:x)?1$/i.test(r.position));
    if (wins.length) {
      const last = wins[wins.length - 1]!;
      return {
        event: last.event,
        year: y,
        position: last.position,
        score: last.score,
        tournamentId: last.tournamentId,
      };
    }
  }
  return null;
}

/** Resolve a RotoWire golf player page from display name. */
async function resolveGolferRotoWireUrl(name: string): Promise<string | null> {
  const want = normPerson(name);
  const slugWant = want.replace(/\s+/g, "-");
  const last = want.split(" ").slice(-1)[0] ?? "";
  const newsUrl =
    `https://www.rotowire.com/golf/news.php?player=` + encodeURIComponent(name.trim());
  const html = await (
    await timedFetch(newsUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        Referer: "https://www.rotowire.com/golf/",
      },
    }, SEARCH_MS)
  ).text();

  const re =
    /href="(?:https:\/\/www\.rotowire\.com)?(\/golf\/player\/([a-z0-9-]+-\d+))"[^>]*>([^<]+)</gi;
  let m: RegExpExecArray | null;
  let soft: string | null = null;
  while ((m = re.exec(html))) {
    const path = m[1]!;
    const slug = (m[2] ?? "").toLowerCase();
    const label = normPerson(m[3] ?? "");
    if (
      label === want ||
      slug === slugWant ||
      slug.startsWith(`${slugWant}-`)
    ) {
      return `https://www.rotowire.com${path}`;
    }
    if (
      !soft &&
      last &&
      (label.includes(want) || want.includes(label) || slug.includes(last))
    ) {
      soft = `https://www.rotowire.com${path}`;
    }
  }

  const slugHit = html.match(new RegExp(`/golf/player/(${slugWant}-\\d+)`, "i"));
  if (slugHit?.[1]) return `https://www.rotowire.com/golf/player/${slugHit[1]}`;
  return soft;
}

/** After-round RotoWire blurbs for a golfer (player page scrape). */
async function scrapeGolferRotoNotes(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 3) return { name: trimmed, url: null, notes: [], error: "Bad name" };

  const url = await resolveGolferRotoWireUrl(trimmed);
  if (!url) {
    return { name: trimmed, url: null, notes: [], error: "Golfer not found on RotoWire" };
  }

  const html = await (
    await timedFetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        Referer: "https://www.rotowire.com/golf/news.php",
      },
    }, HEAVY_MS)
  ).text();

  const notes: { headline: string; body: string; date: string | null }[] = [];
  const seen = new Set<string>();
  const itemRe =
    /<div class="news-update__headline">([\s\S]*?)<\/div>[\s\S]*?<div class="news-update__timestamp">([\s\S]*?)<\/div>[\s\S]*?<div class="news-update__news">([\s\S]*?)<\/div>(?:[\s\S]*?<div class="news-update__analysis">([\s\S]*?)<\/div>)?/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html))) {
    const headline = decodeHtmlEntities(stripTags(m[1] ?? "")).replace(/\s+/g, " ").trim();
    const date = decodeHtmlEntities(stripTags(m[2] ?? "")).replace(/\s+/g, " ").trim() || null;
    const news = decodeHtmlEntities(stripTags(m[3] ?? "")).replace(/\s+/g, " ").trim();
    const analysisRaw = decodeHtmlEntities(stripTags(m[4] ?? ""))
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^ANALYSIS\s*/i, "")
      .trim();
    const analysis =
      analysisRaw && !/subscribe now/i.test(analysisRaw) ? analysisRaw : "";
    const body = [news, analysis].filter(Boolean).join(" ").trim();
    if (!headline || !body) continue;
    const key = headline.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push({ headline, body, date });
    if (notes.length >= 8) break;
  }

  if (!notes.length) {
    return { name: trimmed, url, notes: [], error: "No RotoWire notes found" };
  }
  return { name: trimmed, url, notes };
}

type PipelineBio = { contentTitle?: string | null; contentText?: string | null };
type PipelineRow = {
  rank?: number | null;
  playerEntity?: {
    position?: string | null;
    eta?: string | null;
    player?: { id?: number | null; fullName?: string | null } | null;
    prospectBio?: PipelineBio[] | null;
  } | null;
};



function parsePipelineBio(contentText: string): {
  gradesLine: string | null;
  grades: { label: string; value: string }[];
  paragraphs: string[];
} {
  const html = decodeHtmlEntities(contentText);
  const gradeMatch = html.match(
    /Scouting grades:\s*<\/strong>\s*([^<]+)/i,
  ) || html.match(/<strong>\s*Scouting grades:?\s*<\/strong>\s*([^<]+)/i);
  const gradesLine = gradeMatch?.[1]?.replace(/\s+/g, " ").trim() || null;
  const grades: { label: string; value: string }[] = [];
  if (gradesLine) {
    for (const part of gradesLine.split("|")) {
      const m = part.trim().match(/^([^:]+):\s*(\d+)\s*$/);
      if (m) grades.push({ label: m[1].trim(), value: m[2] });
    }
  }
  const paragraphs: string[] = [];
  for (const block of html.matchAll(/<p>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(block[1] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    if (/^scouting grades:/i.test(text)) continue;
    if (/^video scouting report/i.test(text)) continue;
    paragraphs.push(text);
  }
  return { gradesLine, grades, paragraphs };
}

function slugifyPlayer(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** MLB.com “More Bio Info” narrative modal body. */
async function scrapeMlbPlayerBio(
  playerId: number,
  name: string,
): Promise<Record<string, unknown>> {
  const slug = slugifyPlayer(name || String(playerId));
  const url = `https://www.mlb.com/player/${slug}-${playerId}`;
  const res = await timedFetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  const html = await res.text();
  const bodyMatch =
    html.match(
      /id=["']playerBioModalBody["'][^>]*>\s*([\s\S]*?)\s*<\/div>\s*(?:<\/div>\s*)?(?:<footer|<\/section|<aside|$)/i,
    ) ??
    html.match(/id=["']playerBioModalBody["'][^>]*>\s*([\s\S]*?)\s*<\/div>/i);
  let raw = bodyMatch?.[1] ?? "";
  if (!raw || raw.length < 40) {
    return { error: "Bio not found", found: false, url };
  }
  // Keep year headings + paragraphs; strip scripts/styles.
  raw = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .trim();
  const fullNameMatch = html.match(
    /class="[^"]*p-modal__title[^"]*"[^>]*>([^<]+)</i,
  );
  const text = stripTags(raw).replace(/\s+/g, " ").trim();
  // Light HTML cleanup for client rendering
  const cleanHtml = raw
    .replace(/<\/?(?:span|font)[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<h\d[^>]*>/gi, "\n\n")
    .replace(/<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    found: true,
    fullName: fullNameMatch ? stripTags(fullNameMatch[1]).trim() : null,
    html: cleanHtml,
    text,
    url,
  };
}

/** True when a BBRef player page title roughly matches the requested name. */
function bbrefPageMatchesName(html: string, name: string): boolean {
  const want = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!want) return true;
  const h1 =
    html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1] ??
    html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ??
    "";
  const got = stripTags(h1)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!got) return false;
  if (got === want || got.includes(want) || want.includes(got)) return true;
  const wantLast = want.split(/\s+/).slice(-1)[0] ?? "";
  const gotLast = got.split(/\s+/).slice(-1)[0] ?? "";
  const wantFirst = want.split(/\s+/)[0] ?? "";
  const gotFirst = got.split(/\s+/)[0] ?? "";
  return Boolean(wantLast && gotLast === wantLast && wantFirst && gotFirst.startsWith(wantFirst[0]!));
}

/** Resolve BBRef player page HTML (shared with contract scrape). */
async function loadBbrefPlayerHtml(
  name: string,
  mlbId?: number | null,
): Promise<{ url: string; html: string } | null> {
  // Direct MLB id redirect is far faster/more reliable than search (and avoids
  // soft-timeouts that blank season WAR on the player card).
  if (mlbId != null && Number.isFinite(mlbId) && mlbId > 0) {
    try {
      const directUrl =
        `https://www.baseball-reference.com/redirect.fcgi?player=1&mlb_ID=${Math.trunc(mlbId)}`;
      const page = await fetchBbrefHtml(
        directUrl,
        { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" },
        HEAVY_MS,
      );
      if (
        page &&
        /\/players\/[a-z]\/[a-z0-9]+\.shtml/i.test(page.url) &&
        page.html.length > 20_000
      ) {
        // Only trust the redirect when the page is the requested player. A wrong
        // mlbId used to return another player's WAR with no name check.
        if (!name || bbrefPageMatchesName(page.html, name)) {
          return page;
        }
      }
    } catch {
      /* fall through to name search */
    }
  }

  const q = encodeURIComponent(name.trim());
  const searchUrl = `https://www.baseball-reference.com/search/search.fcgi?search=${q}`;
  const searchPage = await fetchBbrefHtml(
    searchUrl,
    { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" },
    SEARCH_MS + FETCH_MS,
  );
  if (!searchPage) return null;
  let html = searchPage.html;
  let playerUrl = searchPage.url;
  const want = name.trim().toLowerCase();
  if (!/\/players\/[a-z]\/[a-z0-9]+\.shtml/i.test(playerUrl)) {
    const linkRe = /href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"[^>]*>([^<]{2,80})<\/a>/gi;
    let best: { path: string; score: number } | null = null;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html))) {
      const label = stripTags(m[2]).toLowerCase();
      let score = 0;
      if (label === want) score = 100;
      else if (label.startsWith(want) || want.startsWith(label)) score = 80;
      else if (label.includes(want.split(/\s+/).slice(-1)[0] ?? "")) score = 40;
      if (!best || score > best.score) best = { path: m[1], score };
    }
    const fallback = html.match(/href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"/i);
    const path = (best && best.score >= 40 ? best.path : null) ?? fallback?.[1];
    if (!path) return null;
    playerUrl = `https://www.baseball-reference.com${path}`;
    const playerPage = await fetchBbrefHtml(
      playerUrl,
      {
        headers: {
          "User-Agent": UA,
          Accept: "text/html",
          Referer: searchUrl,
        },
      },
      FETCH_MS,
    );
    if (!playerPage) return null;
    html = playerPage.html;
    playerUrl = playerPage.url;
  }
  if (/just a moment|cf-browser-verification/i.test(html)) return null;
  if (name && !bbrefPageMatchesName(html, name)) return null;
  return { url: playerUrl, html };
}

/** Stats API / ESPN abbrev → Baseball-Reference preview URL team code. */
const PREVIEW_TEAM_CODE: Record<string, string> = {
  AZ: "ARI",
  ARI: "ARI",
  ATL: "ATL",
  BAL: "BAL",
  BOS: "BOS",
  CHC: "CHN",
  CWS: "CHA",
  CHW: "CHA",
  CIN: "CIN",
  CLE: "CLE",
  COL: "COL",
  DET: "DET",
  HOU: "HOU",
  KC: "KCA",
  KCR: "KCA",
  LAA: "ANA",
  ANA: "ANA",
  LAD: "LAN",
  MIA: "MIA",
  MIL: "MIL",
  MIN: "MIN",
  NYM: "NYN",
  NYY: "NYA",
  OAK: "ATH",
  ATH: "ATH",
  PHI: "PHI",
  PIT: "PIT",
  SD: "SDN",
  SDP: "SDN",
  SEA: "SEA",
  SF: "SFN",
  SFG: "SFN",
  STL: "SLN",
  TB: "TBA",
  TBR: "TBA",
  TEX: "TEX",
  TOR: "TOR",
  WSH: "WSN",
  WSN: "WSN",
};

function previewTeamCode(abbrev: string): string | null {
  const key = abbrev.trim().toUpperCase();
  return PREVIEW_TEAM_CODE[key] ?? (key.length === 3 ? key : null);
}

function stripCell(raw: string): string {
  return decodeHtmlEntities(stripTags(raw)).replace(/\s+/g, " ").trim();
}

function parseBbrefPreviewTeamSummary(chunk: string): Record<string, string | null> {
  const pick = (label: string) => {
    const re = new RegExp(
      `${label}\\s*</t[dh]>\\s*<t[dh][^>]*>\\s*([\\s\\S]*?)\\s*</t[dh]>`,
      "i",
    );
    const m = chunk.match(re) ?? chunk.match(new RegExp(`${label}\\s+([\\dA-Za-z().\\-/# ]{1,40})`, "i"));
    if (!m) return null;
    return stripCell(m[1]).replace(/^[:\s]+/, "") || null;
  };
  // Plain-text fallback after tags stripped (div_teamdata_* markup varies).
  const plain = stripCell(chunk);
  const plainPick = (label: string) => {
    const m = plain.match(new RegExp(`${label}\\s+([\\dA-Za-z().\\-/#][\\dA-Za-z().\\-/# ]{0,36})`, "i"));
    return m?.[1]?.trim() || null;
  };
  return {
    record: pick("Record") ?? plainPick("Record"),
    manager: pick("Manager") ?? plainPick("Manager"),
    gameNumber: pick("Game #") ?? plainPick("Game #"),
    standing: pick("Standing") ?? plainPick("Standing"),
    last10: pick("Last 10") ?? plainPick("Last 10"),
    last20: pick("Last 20") ?? plainPick("Last 20"),
    last30: pick("Last 30") ?? plainPick("Last 30"),
    home: pick("Home") ?? plainPick("Home"),
    away: pick("Away") ?? plainPick("Away"),
    extraInnings: pick("Extra Innings") ?? plainPick("Extra Innings"),
    vsRhp: pick("vs\\. RHP") ?? plainPick("vs. RHP"),
    vsLhp: pick("vs\\. LHP") ?? plainPick("vs. LHP"),
    oneRun: pick("1-Run Games") ?? plainPick("1-Run Games"),
  };
}

function parseBbrefPreviewTable(
  html: string,
  tableId: string,
  wanted: string[],
  limit = 14,
): Record<string, string>[] {
  const block =
    html.match(new RegExp(`<table[^>]*id="${tableId}"[^>]*>([\\s\\S]*?)</table>`, "i"))?.[1] ??
    null;
  if (!block) return [];

  const headerCells = [
    ...block.matchAll(/<thead>[\s\S]*?<tr[^>]*>([\s\S]*?)<\/tr>/i),
  ];
  const headerRow = headerCells[0]?.[1] ?? "";
  const headers = [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
    stripCell(m[1]).replace(/\s+/g, " "),
  );

  const alias: Record<string, string[]> = {
    name: ["Batter", "Pitcher", "Player", "Name"],
    PA: ["PA"],
    BA: ["BA", "AVG"],
    OBP: ["OBP"],
    SLG: ["SLG"],
    OPS: ["OPS"],
    opsVr: ["OPS vRH", "OPS vRH"],
    opsVl: ["OPS vLH", "OPS vLH"],
    ops28: ["OPS Last 28d", "OPS last 28 days"],
    HR: ["HR"],
    SB: ["SB"],
    IP: ["IP"],
    ERA: ["ERA"],
    K9: ["K/9"],
    BF: ["BF"],
  };

  const indexFor = (key: string): number => {
    const names = alias[key] ?? [key];
    for (const n of names) {
      const i = headers.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (i >= 0) return i;
    }
    // data-stat fallback
    return -1;
  };

  const rows: Record<string, string>[] = [];
  const body = block.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? block;
  for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      stripCell(m[1]),
    );
    if (!cells.length) continue;

    const out: Record<string, string> = {};
    // Prefer data-stat when present
    let usedDataStat = false;
    for (const m of row[1].matchAll(/data-stat="([^"]+)"[^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
      usedDataStat = true;
      const stat = m[1];
      const val = stripCell(m[2]);
      if (stat === "player" || stat === "name_display") out.name = val.replace(/^\d+\.\s*/, "");
      else out[stat] = val;
    }
    if (!usedDataStat) {
      for (const key of wanted) {
        const idx = indexFor(key);
        if (idx < 0 || idx >= cells.length) continue;
        const val = cells[idx] ?? "";
        if (key === "name") out.name = val.replace(/^\d+\.\s*/, "");
        else out[key] = val;
      }
    }
    const name = out.name ?? "";
    if (!name || /^(player|pitcher|batter|total)$/i.test(name)) continue;
    rows.push(out);
    if (rows.length >= limit) break;
  }
  return rows;
}

/** Baseball-Reference daily matchup preview (season series, splits, batter/pitcher tables). */
async function scrapeBbrefGamePreview(opts: {
  homeAbbrev: string;
  awayAbbrev: string;
  date: string; // YYYY-MM-DD
  gameNumber?: number;
}): Promise<Record<string, unknown>> {
  const homeCode = previewTeamCode(opts.homeAbbrev);
  const awayCode = previewTeamCode(opts.awayAbbrev);
  if (!homeCode) return { error: "Unknown home team abbrev", ...opts };
  const date = opts.date.replace(/-/g, "");
  if (!/^\d{8}$/.test(date)) return { error: "Bad date", ...opts };
  const gameNum = opts.gameNumber && opts.gameNumber > 1 ? String(opts.gameNumber) : "0";
  const year = date.slice(0, 4);
  const url =
    `https://www.baseball-reference.com/previews/${year}/${homeCode}${date}${gameNum}.shtml`;
  const res = await timedFetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  }, 18_000);
  if (!res.ok) return { error: `BBRef preview ${res.status}`, url, homeCode, awayCode };
  const html = (await res.text()).replace(/<!--([\s\S]*?)-->/g, "$1");
  if (/just a moment|cf-browser-verification/i.test(html) || html.length < 5_000) {
    return { error: "BBRef preview blocked or empty", url };
  }

  const awayAbbrev = (opts.awayAbbrev || "").toUpperCase();
  const homeAbbrev = (opts.homeAbbrev || "").toUpperCase();
  const awayChunk =
    html.match(new RegExp(`id="div_teamdata_${awayAbbrev}"([\\s\\S]*?)id="all_last10_`, "i"))?.[1] ??
    html.match(new RegExp(`id="div_teamdata_${awayAbbrev}"([\\s\\S]{0,3500})`, "i"))?.[1] ??
    "";
  const homeChunk =
    html.match(new RegExp(`id="div_teamdata_${homeAbbrev}"([\\s\\S]*?)id="all_last10_`, "i"))?.[1] ??
    html.match(new RegExp(`id="div_teamdata_${homeAbbrev}"([\\s\\S]{0,3500})`, "i"))?.[1] ??
    "";

  const series: { date: string; result: string }[] = [];
  const seriesBlock =
    html.match(/<h2[^>]*>\s*Season Series\s*<\/h2>([\s\S]*?)(?:<h2|Last 10 games head-to-head)/i)?.[1] ??
    "";
  for (const row of seriesBlock.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const text = stripCell(row[1]);
    if (!text || /^date\b/i.test(text) || text.length < 8) continue;
    if (!/\d{4}|@|vs/i.test(text) && !/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(text)) {
      continue;
    }
    series.push({ date: text.slice(0, 32), result: text });
  }

  const batterWanted = ["name", "PA", "BA", "OBP", "SLG", "OPS", "opsVr", "opsVl", "ops28", "HR", "SB"];
  const pitcherWanted = ["name", "IP", "ERA", "K9", "BA", "OPS", "ops28", "HR"];

  const awayBatters = parseBbrefPreviewTable(html, `batters_${awayAbbrev}`, batterWanted);
  const homeBatters = parseBbrefPreviewTable(html, `batters_${homeAbbrev}`, batterWanted);
  const awayPitchers = parseBbrefPreviewTable(html, `pitchers_${awayAbbrev}`, pitcherWanted);
  const homePitchers = parseBbrefPreviewTable(html, `pitchers_${homeAbbrev}`, pitcherWanted);

  return {
    source: "baseball-reference",
    url,
    homeAbbrev,
    awayAbbrev,
    homeCode,
    awayCode: awayCode ?? awayAbbrev,
    awaySummary: parseBbrefPreviewTeamSummary(awayChunk),
    homeSummary: parseBbrefPreviewTeamSummary(homeChunk),
    seasonSeries: series.slice(0, 20),
    awayBatters,
    homeBatters,
    awayPitchers,
    homePitchers,
  };
}

/** Prefer current-season WAR from a year+stat table instead of the last numeric cell sitewide. */
function parseBbrefWarCell(row: string, warStat: string): number | null {
  // Visible cell text first (matches BBRef's one-decimal display, including <strong> leaders).
  const raw = row.match(
    new RegExp(`data-stat="${warStat}"[^>]*>([\\s\\S]*?)</t[dh]>`, "i"),
  )?.[1];
  if (raw) {
    const text = stripTags(raw).replace(/,/g, "").trim();
    if (/^-?[0-9.]+$/.test(text)) {
      const n = Number(text);
      if (Number.isFinite(n)) return n;
    }
  }
  // Fallback: csk is higher precision when the cell is empty/spacer.
  const csk = row.match(new RegExp(`data-stat="${warStat}"[^>]*\\bcsk="(-?[0-9.]+)"`, "i"))?.[1];
  if (csk && /^-?[0-9.]+$/.test(csk)) {
    const n = Number(csk);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
  }
  return null;
}

/** Full WAR tables only — never slice on bare `id="` (matches entity-id= and truncates). */
function extractBbrefWarTables(searchable: string): string {
  const parts: string[] = [];
  for (const id of [
    "players_value_batting",
    "players_value_pitching",
    "players_standard_batting",
    "players_standard_pitching",
  ]) {
    const m = searchable.match(
      new RegExp(`<table[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?<\\/table>`, "i"),
    );
    if (m) parts.push(m[0]);
  }
  return parts.length ? parts.join("\n") : searchable;
}

function parseBbrefSeasonAndCareerWar(
  searchable: string,
  warStat: string,
): { seasonWar: number | null; careerWar: number | null } {
  const year = new Date().getFullYear();
  const byYear = new Map<number, number>();
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(searchable))) {
    const row = m[1];
    // Skip headers + summary / multi-year aggregate rows.
    // Do NOT skip on bare colspan= — BBRef year rows use colspan on spacer cells,
    // and that filter was blanking season WAR while the footer career row still matched.
    if (
      /thead|colhead|over_header|scope="col"|162\s*Game\s*Avg/i.test(row) ||
      /data-stat="year_id"[^>]*>\s*(?:<[^>]+>)?\s*Yrs\b/i.test(row) ||
      /\(\s*\d+\s*Yrs?\s*\)/i.test(row)
    ) {
      continue;
    }
    const yRaw =
      row.match(/data-stat="year_id"[^>]*\bcsk="(\d{4})"/i)?.[1] ??
      row.match(/data-stat="year_id"[^>]*>\s*(?:<a[^>]*>)?\s*(\d{4})/i)?.[1] ??
      row.match(/href="\/players\/gl\.fcgi[^"]*year=(\d{4})/i)?.[1];
    if (!yRaw) continue;
    const w = parseBbrefWarCell(row, warStat);
    if (w == null) continue;
    const y = Number(yRaw);
    if (!Number.isFinite(y)) continue;
    const team =
      row.match(/data-stat="(?:team_id|team_name_abbr)"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]*)/i)?.[1]
        ?.trim() ?? "";
    const isMultiTeam = /^(?:\d+TM)$/i.test(team);
    const prev = byYear.get(y);
    // Prefer 2TM/3TM totals; otherwise keep the larger value (totals beat splits).
    if (prev == null || isMultiTeam || Math.abs(w) >= Math.abs(prev)) {
      byYear.set(y, w);
    }
  }

  const seasonWar = byYear.has(year)
    ? byYear.get(year)!
    : byYear.size
      ? [...byYear.entries()].sort((a, b) => b[0] - a[0])[0]![1]
      : null;

  let careerWar: number | null = null;
  const footBlock = searchable.match(/<tfoot>([\s\S]*?)<\/tfoot>/i)?.[1] ?? "";
  if (footBlock) {
    const footRowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let fr: RegExpExecArray | null;
    while ((fr = footRowRe.exec(footBlock))) {
      const row = fr[1];
      if (!/data-stat="year_id"[^>]*>[\s\S]*?\bYrs\b/i.test(row) && !/\bYrs\b/i.test(row)) {
        continue;
      }
      const w = parseBbrefWarCell(row, warStat);
      if (w != null) {
        careerWar = w;
        break;
      }
    }
  }
  if (careerWar == null && byYear.size) {
    careerWar =
      Math.round([...byYear.values()].reduce((a, b) => a + b, 0) * 10) / 10;
  }
  return { seasonWar, careerWar };
}

/** Compact BBRef daily WAR index — bat + pitch summed per player/year. */
type WarDumpRec = { name: string; playerId: string | null; byYear: Map<number, number> };
type WarDumpIndex = {
  at: number;
  byMlbId: Map<number, WarDumpRec>;
  byName: Map<string, WarDumpRec>;
};

const WAR_DUMP_TTL_MS = 6 * 60 * 60_000;
let warDumpIndex: WarDumpIndex | null = null;
let warDumpInflight: Promise<WarDumpIndex | null> | null = null;

function normalizeWarName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ingestWarDump(index: WarDumpIndex, text: string): void {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return;
  const header = lines[0]!.split(",");
  const iMlb = header.indexOf("mlb_ID");
  const iYear = header.indexOf("year_ID");
  const iWar = header.indexOf("WAR");
  const iName = header.indexOf("name_common");
  const iPid = header.indexOf("player_ID");
  if (iMlb < 0 || iYear < 0 || iWar < 0 || iName < 0) return;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(",");
    const mlbId = Number(cols[iMlb]);
    const year = Number(cols[iYear]);
    const war = Number(cols[iWar]);
    const name = (cols[iName] ?? "").trim();
    if (!Number.isFinite(year) || !Number.isFinite(war)) continue;
    let rec =
      (Number.isFinite(mlbId) && mlbId > 0 ? index.byMlbId.get(mlbId) : undefined) ??
      (name ? index.byName.get(normalizeWarName(name)) : undefined);
    if (!rec) rec = { name, playerId: cols[iPid] ?? null, byYear: new Map() };
    rec.byYear.set(year, (rec.byYear.get(year) ?? 0) + war);
    if (!rec.playerId && cols[iPid]) rec.playerId = cols[iPid]!;
    if (Number.isFinite(mlbId) && mlbId > 0) index.byMlbId.set(mlbId, rec);
    if (name) index.byName.set(normalizeWarName(name), rec);
  }
}

async function loadWarDumpIndex(): Promise<WarDumpIndex | null> {
  if (warDumpIndex && Date.now() - warDumpIndex.at < WAR_DUMP_TTL_MS) return warDumpIndex;
  if (warDumpInflight) return warDumpInflight;
  warDumpInflight = (async () => {
    const headers = { "User-Agent": UA, Accept: "text/plain" };
    const [batRes, pitRes] = await Promise.all([
      timedFetch(
        "https://www.baseball-reference.com/data/war_daily_bat.txt",
        { headers },
        20_000,
      ).catch(() => null),
      timedFetch(
        "https://www.baseball-reference.com/data/war_daily_pitch.txt",
        { headers },
        20_000,
      ).catch(() => null),
    ]);
    const next: WarDumpIndex = {
      at: Date.now(),
      byMlbId: new Map(),
      byName: new Map(),
    };
    if (batRes?.ok) ingestWarDump(next, await batRes.text());
    if (pitRes?.ok) ingestWarDump(next, await pitRes.text());
    if (next.byMlbId.size === 0 && next.byName.size === 0) return warDumpIndex;
    warDumpIndex = next;
    return next;
  })().finally(() => {
    warDumpInflight = null;
  });
  return warDumpInflight;
}

function warFromDumpIndex(
  index: WarDumpIndex,
  mlbId?: number | null,
  name?: string | null,
): { seasonWar: number | null; careerWar: number | null; url: string | null } | null {
  const rec =
    (mlbId != null && mlbId > 0 ? index.byMlbId.get(Math.trunc(mlbId)) : undefined) ??
    (name ? index.byName.get(normalizeWarName(name)) : undefined);
  if (!rec || rec.byYear.size === 0) return null;
  const year = new Date().getFullYear();
  const years = [...rec.byYear.keys()].sort((a, b) => b - a);
  const rawSeason = rec.byYear.has(year) ? rec.byYear.get(year)! : rec.byYear.get(years[0]!)!;
  const rawCareer = [...rec.byYear.values()].reduce((a, b) => a + b, 0);
  const letter = (rec.playerId ?? "x")[0] ?? "x";
  return {
    seasonWar: Math.round(rawSeason * 10) / 10,
    careerWar: Math.round(rawCareer * 10) / 10,
    url: rec.playerId
      ? `https://www.baseball-reference.com/players/${letter}/${rec.playerId}.shtml`
      : "https://www.baseball-reference.com/data/war_daily_bat.txt",
  };
}

/** Season + career WAR from BBRef's published daily dumps (bat + pitch summed). */
async function scrapeBbrefWarDaily(opts: {
  mlbId?: number | null;
  name?: string | null;
}): Promise<{ seasonWar: number | null; careerWar: number | null; url: string | null } | null> {
  const index = await loadWarDumpIndex();
  if (!index) return null;
  return warFromDumpIndex(index, opts.mlbId, opts.name);
}

/** Service time + WAR (+ optional league WAR rank) from Baseball Reference. */
async function scrapePlayerExtras(
  name: string,
  isPitcher: boolean,
  mlbId?: number | null,
  teamAbbrev?: string | null,
): Promise<Record<string, unknown>> {
  // Daily WAR dumps first — Cloudflare blocks player HTML from many edge IPs, and
  // FanGraphs leaders JSON is flaky. The dumps are static text (CF-cached) and
  // already include two-way totals once bat + pitch rows are summed.
  const dump = await scrapeBbrefWarDaily({ mlbId, name }).catch(() => null);

  const pageP = loadBbrefPlayerHtml(name, mlbId).catch(() => null);
  const fgP =
    dump?.seasonWar == null && dump?.careerWar == null
      ? scrapeFangraphsWar({
          mlbId: mlbId ?? null,
          name,
          isPitcher,
          teamAbbrev: teamAbbrev ?? null,
        }).catch(() => null)
      : Promise.resolve(null);

  // Don't block WAR on a slow BBRef HTML scrape when the dump already has it.
  const page = dump
    ? await Promise.race([
        pageP,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
      ])
    : await pageP;
  const fg = await fgP;

  let serviceTime: string | null = null;
  let seasonWar: number | null = null;
  let careerWar: number | null = null;
  let url: string | null = null;

  if (page) {
    const searchable = page.html.replace(/<!--([\s\S]*?)-->/g, "$1");
    url = page.url;
    const stMatch =
      searchable.match(
        /Service Time(?:\s*\([^)]*\))?\s*<\/strong>\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ) ??
      searchable.match(/Service Time[^<]{0,60}<\/strong>\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i) ??
      searchable.match(/Service Time[^:]*:\s*([0-9]+(?:\.[0-9]+)?)/i);
    serviceTime = stMatch?.[1] ?? null;
    const primary = isPitcher ? "p_war" : "b_war";
    const secondary = isPitcher ? "b_war" : "p_war";
    // Prefer the player value/standard tables — never the truncated entity-id slice.
    const valueSlice = extractBbrefWarTables(searchable);
    ({ seasonWar, careerWar } = parseBbrefSeasonAndCareerWar(valueSlice, primary));
    // Two-way players / misclassified pitchers: fall back to the other WAR column.
    if (seasonWar == null && careerWar == null) {
      ({ seasonWar, careerWar } = parseBbrefSeasonAndCareerWar(valueSlice, secondary));
    }
    if (seasonWar == null && careerWar == null) {
      ({ seasonWar, careerWar } = parseBbrefSeasonAndCareerWar(searchable, primary));
    }
    if (seasonWar == null && careerWar == null) {
      ({ seasonWar, careerWar } = parseBbrefSeasonAndCareerWar(searchable, secondary));
    }
  }

  if (dump) {
    // Dump is the source of truth (bat + pitch summed). HTML parse is batting- or
    // pitching-only and blanked two-way cards when Cloudflare blocked the page.
    if (dump.seasonWar != null) seasonWar = dump.seasonWar;
    if (dump.careerWar != null) careerWar = dump.careerWar;
    if (!url && dump.url) url = dump.url;
  }

  if (fg && (seasonWar == null || careerWar == null)) {
    if (seasonWar == null && fg.seasonWar != null) seasonWar = fg.seasonWar;
    if (careerWar == null && fg.careerWar != null) careerWar = fg.careerWar;
    if (!url && fg.url) url = fg.url;
  }

  if (!page && seasonWar == null && careerWar == null && !serviceTime) {
    return { error: "Player not found on Baseball Reference", name };
  }

  // Core fields only — skip league-rank scrape (extra BBRef page) so WAR survives soft timeouts.
  return {
    source:
      dump && (seasonWar != null || careerWar != null)
        ? "bbref-war-daily"
        : page && (seasonWar != null || careerWar != null || serviceTime)
          ? "baseball-reference"
          : fg
            ? "fangraphs"
            : page
              ? "baseball-reference"
              : "bbref-war-daily",
    url,
    name,
    serviceTime,
    seasonWar,
    careerWar,
    warRank: null as number | null,
    warOf: null as number | null,
  };
}

/** FanGraphs team ids for season/career leaderboard filters. */
const FANGRAPHS_TEAM_ID: Record<string, number> = {
  LAA: 1,
  BAL: 2,
  BOS: 3,
  CHW: 4,
  CWS: 4,
  CLE: 5,
  DET: 6,
  KC: 7,
  KCR: 7,
  MIN: 8,
  NYY: 9,
  OAK: 10,
  ATH: 10,
  SEA: 11,
  TB: 12,
  TBR: 12,
  TEX: 13,
  TOR: 14,
  AZ: 15,
  ARI: 15,
  ATL: 16,
  CHC: 17,
  CIN: 18,
  COL: 19,
  MIA: 20,
  HOU: 21,
  LAD: 22,
  MIL: 23,
  WSH: 24,
  WSN: 24,
  NYM: 25,
  PHI: 26,
  PIT: 27,
  STL: 28,
  SD: 29,
  SDP: 29,
  SF: 30,
  SFG: 30,
};

async function scrapeFangraphsWar(opts: {
  mlbId: number | null;
  name: string;
  isPitcher: boolean;
  teamAbbrev: string | null;
}): Promise<{ seasonWar: number | null; careerWar: number | null; url: string | null } | null> {
  const yearNow = new Date().getFullYear();
  const seasonsToTry = [yearNow, yearNow - 1];
  const stats = opts.isPitcher ? "pit" : "bat";
  const wantId = opts.mlbId != null && opts.mlbId > 0 ? Math.trunc(opts.mlbId) : null;
  const wantName = opts.name.trim().toLowerCase().replace(/\./g, "");

  const loadPage = async (team: number, season: number, season1: number, pageitems = 80) => {
    const url =
      `https://www.fangraphs.com/api/leaders/major-league/data` +
      `?pos=all&stats=${stats}&lg=all&qual=0&type=8` +
      `&season=${season}&season1=${season1}&month=0&team=${team}` +
      `&pageitems=${pageitems}&pagenum=1&ind=0`;
    const res = await timedFetch(
      url,
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          Referer: "https://www.fangraphs.com/",
        },
      },
      12_000,
    );
    if (!res.ok) return [] as Record<string, unknown>[];
    const text = await res.text();
    if (/just a moment|cf-browser-verification/i.test(text) || text[0] !== "{") return [];
    try {
      const json = JSON.parse(text) as { data?: Record<string, unknown>[] };
      return Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  };

  const matchRow = (rows: Record<string, unknown>[]) => {
    if (wantId != null) {
      const byId = rows.find((r) => Number(r.xMLBAMID) === wantId);
      if (byId) return byId;
    }
    return (
      rows.find((r) => {
        const n = String(r.PlayerName ?? r.PlayerNameRoute ?? "")
          .toLowerCase()
          .replace(/\./g, "")
          .trim();
        return n && (n === wantName || n.includes(wantName) || wantName.includes(n));
      }) ?? null
    );
  };

  const teamId =
    opts.teamAbbrev && FANGRAPHS_TEAM_ID[opts.teamAbbrev.toUpperCase()]
      ? FANGRAPHS_TEAM_ID[opts.teamAbbrev.toUpperCase()]!
      : 0;

  let seasonRow: Record<string, unknown> | null = null;
  for (const y of seasonsToTry) {
    if (teamId > 0) seasonRow = matchRow(await loadPage(teamId, y, y, 60));
    if (!seasonRow) seasonRow = matchRow(await loadPage(0, y, y, 200));
    if (seasonRow) break;
  }

  let careerRow: Record<string, unknown> | null = null;
  const fgPlayerId = seasonRow?.playerid != null ? Number(seasonRow.playerid) : null;
  // Career board filtered by team is small enough to include the player; league-wide career
  // leaders often omit them.
  if (teamId > 0) {
    const careerRows = await loadPage(teamId, yearNow, 1871, 80);
    careerRow =
      (fgPlayerId && Number.isFinite(fgPlayerId)
        ? careerRows.find((r) => Number(r.playerid) === fgPlayerId)
        : null) ?? matchRow(careerRows);
  }
  if (!careerRow && fgPlayerId && Number.isFinite(fgPlayerId)) {
    const careerRows = await loadPage(0, yearNow, 1871, 150);
    careerRow = careerRows.find((r) => Number(r.playerid) === fgPlayerId) ?? null;
  }

  const asWar = (row: Record<string, unknown> | null) => {
    if (!row || row.WAR == null || row.WAR === "") return null;
    const n = typeof row.WAR === "number" ? row.WAR : Number(row.WAR);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
  };

  const seasonWar = asWar(seasonRow);
  const careerWar = asWar(careerRow);
  if (seasonWar == null && careerWar == null) return null;
  return {
    seasonWar,
    careerWar,
    url:
      fgPlayerId != null
        ? `https://www.fangraphs.com/players/${encodeURIComponent(
            String(seasonRow?.PlayerNameRoute ?? opts.name).replace(/\s+/g, "-").toLowerCase(),
          )}/${fgPlayerId}/stats`
        : "https://www.fangraphs.com/",
  };
}


function parseCompactMoney(raw: string): number | null {
  const t = decodeHtmlEntities(raw).replace(/,/g, "").trim();
  if (!t || t === "—" || t === "-" || /^free/i.test(t)) return null;
  const m = t.match(/^\$?\s*([\d.]+)\s*([kmb])?/i);
  if (!m) return parseMoney(t);
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit === "k") return Math.round(n * 1_000);
  if (unit === "m") return Math.round(n * 1_000_000);
  if (unit === "b") return Math.round(n * 1_000_000_000);
  return Math.round(n);
}

/** Baseball-Reference team season summary (org / park / pythag). */

export {
  decodeHtmlEntities,
  scrapeGolferSeasonResults,
  scrapeGolferLastWin,
  resolveGolferRotoWireUrl,
  scrapeGolferRotoNotes,
  parsePipelineBio,
  slugifyPlayer,
  scrapeMlbPlayerBio,
  bbrefPageMatchesName,
  loadBbrefPlayerHtml,
  previewTeamCode,
  stripCell,
  parseBbrefPreviewTeamSummary,
  parseBbrefPreviewTable,
  scrapeBbrefGamePreview,
  parseBbrefWarCell,
  extractBbrefWarTables,
  parseBbrefSeasonAndCareerWar,
  WAR_DUMP_TTL_MS,
  normalizeWarName,
  ingestWarDump,
  loadWarDumpIndex,
  warFromDumpIndex,
  scrapeBbrefWarDaily,
  scrapePlayerExtras,
  scrapeFangraphsWar,
  parseCompactMoney,
  type PipelineBio,
  type PipelineRow,
  type WarDumpRec,
  type WarDumpIndex
};
