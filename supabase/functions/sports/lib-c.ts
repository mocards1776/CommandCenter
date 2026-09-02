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

import {
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
} from "./lib-b.ts";

async function scrapeTeamBbrefSummary(
  abbrev: string,
  season: number,
): Promise<Record<string, unknown>> {
  const abbr = abbrev.toUpperCase();
  const url = `https://www.baseball-reference.com/teams/${abbr}/${season}.shtml`;
  // Prefer fetchBbrefHtml (direct + proxy) — bare timedFetch gets CF-blocked from some edge IPs.
  const fetched = await fetchBbrefHtml(
    url,
    { headers: { "User-Agent": UA, Accept: "text/html" } },
    HEAVY_MS,
  );
  if (!fetched?.html) return { error: "BBRef team page unavailable", abbrev: abbr, season };
  const html = fetched.html.replace(/<!--([\s\S]*?)-->/g, "$1");
  const infoBlock =
    html.match(/id="info"[^>]*>([\s\S]*?)<button id="meta_more_button"/i)?.[1] ??
    html;
  // BBRef sometimes puts a space before </strong> ("Manager: </strong>").
  const pickStrong = (label: string) => {
    const re = new RegExp(
      `<strong>${label}:\\s*</strong>\\s*([\\s\\S]*?)(?:</p>|<p>|$)`,
      "i",
    );
    const m = infoBlock.match(re);
    if (!m) return null;
    return decodeHtmlEntities(stripTags(m[1])).replace(/\s+/g, " ").trim() || null;
  };
  const managerRaw = pickStrong("Manager");
  const managerMatch = managerRaw?.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const recordBlock = infoBlock.match(/Record:<\/strong>\s*([\s\S]{0,280}?)<\/p>/i);
  const recordText = recordBlock
    ? decodeHtmlEntities(stripTags(recordBlock[1])).replace(/\s+/g, " ").trim()
    : null;
  const recordMatch = recordText?.match(/(\d+-\d+)/);
  const placeMatch = recordText?.match(
    /(\d+(?:st|nd|rd|th)\s+place\s+in\s+[A-Za-z0-9_.\s-]+?)(?:\s*\(|$)/i,
  );
  const standing = placeMatch?.[1]
    ? placeMatch[1].replace(/_/g, " ").replace(/\s+/g, " ").trim()
    : null;
  const playoffBlock = infoBlock.match(
    /Playoff Odds:<\/strong><\/a>\s*([\s\S]{0,200}?)<\/p>/i,
  ) ?? infoBlock.match(/Playoff Odds:<\/strong>\s*([\s\S]{0,200}?)<\/p>/i);
  const playoffText = playoffBlock
    ? decodeHtmlEntities(stripTags(playoffBlock[1])).replace(/\s+/g, " ").trim()
    : null;
  const postseasonPct =
    playoffText?.match(/([<>]?[\d.]+%)\s*to make postseason/i)?.[1] ?? null;
  const worldSeriesPct =
    playoffText?.match(/([<>]?[\d.]+%)\s*to win World Series/i)?.[1] ?? null;
  const pythagBlock =
    infoBlock.match(
      /Pythagorean W-L:[\s\S]{0,40}?<\/a>\s*([\s\S]*?)<\/p>/i,
    ) ??
    infoBlock.match(
      /Pythagorean W-L:[\s\S]*?(\d+-\d+,\s*\d+\s*Runs,\s*\d+\s*Runs Allowed)/i,
    );
  const pythagText = pythagBlock
    ? decodeHtmlEntities(stripTags(pythagBlock[1])).replace(/\s+/g, " ").trim()
    : null;
  const pythagRecord = pythagText?.match(/(\d+-\d+)/)?.[1] ?? null;
  const runsScored = pythagText?.match(/(\d+)\s*Runs/i)?.[1] ?? null;
  const runsAllowed = pythagText?.match(/(\d+)\s*Runs Allowed/i)?.[1] ?? null;
  const multi = infoBlock.match(
    /Multi-year:<\/strong>\s*Batting\s*-\s*(\d+)[,\s]*Pitching\s*-\s*(\d+)/i,
  );
  const oneYear = infoBlock.match(
    /One-year:<\/strong>\s*Batting\s*-\s*(\d+)[,\s]*Pitching\s*-\s*(\d+)/i,
  );
  const attendanceRaw = pickStrong("Attendance");
  const salaryHref =
    html.match(/href="(\/teams\/[^"]*salaries[^"]*)"/i)?.[1] ??
    `/teams/${abbr}/${abbr.toLowerCase()}-salaries-and-contracts.shtml`;
  const scheduleHref =
    html.match(
      new RegExp(
        `href="(/teams/[^"]*${abbr}/${season}-schedule-scores[^"]*)"`,
        "i",
      ),
    )?.[1] ?? `/teams/${abbr}/${season}-schedule-scores.shtml`;

  return {
    source: "baseball-reference",
    url,
    salariesUrl: salaryHref.startsWith("http")
      ? salaryHref
      : `https://www.baseball-reference.com${salaryHref}`,
    scheduleUrl: `https://www.baseball-reference.com${scheduleHref}`,
    season,
    abbrev: abbr,
    record: recordMatch?.[1] ?? null,
    standing,
    playoffOdds: {
      postseason: postseasonPct,
      worldSeries: worldSeriesPct,
      text: playoffText,
    },
    manager: managerMatch
      ? { name: managerMatch[1]!.trim(), record: managerMatch[2]!.trim() }
      : managerRaw
        ? { name: managerRaw, record: null }
        : null,
    president: pickStrong("President"),
    farmDirector: pickStrong("Farm Director"),
    scoutingDirector: pickStrong("Scouting Director"),
    ballpark: pickStrong("Ballpark"),
    attendance: attendanceRaw,
    parkFactors: {
      multiYear: multi
        ? { batting: Number(multi[1]), pitching: Number(multi[2]) }
        : null,
      oneYear: oneYear
        ? { batting: Number(oneYear[1]), pitching: Number(oneYear[2]) }
        : null,
      note: "Over 100 favors batters, under 100 favors pitchers.",
    },
    pythagorean: {
      record: pythagRecord,
      runsScored: runsScored ? Number(runsScored) : null,
      runsAllowed: runsAllowed ? Number(runsAllowed) : null,
    },
  };
}

/** Team payroll / contracts table from Baseball-Reference. */
async function scrapeTeamPayroll(abbrev: string): Promise<Record<string, unknown>> {
  const abbr = abbrev.toUpperCase();
  // Resolve salaries URL from the current season team page when possible.
  const season = new Date().getFullYear();
  let salariesUrl: string | null = null;
  try {
    const teamPage = await fetchBbrefHtml(
      `https://www.baseball-reference.com/teams/${abbr}/${season}.shtml`,
      { headers: { "User-Agent": UA, Accept: "text/html" } },
      10_000,
    );
    if (teamPage?.html) {
      const href = teamPage.html.match(/href="(\/teams\/[^"]*salaries[^"]*)"/i)?.[1];
      if (href) {
        salariesUrl = href.startsWith("http")
          ? href
          : `https://www.baseball-reference.com${href}`;
      }
    }
  } catch {
    /* fall through */
  }
  if (!salariesUrl) {
    salariesUrl = `https://www.baseball-reference.com/teams/${abbr}/${abbr.toLowerCase()}-salaries-and-contracts.shtml`;
  }

  const fetched = await fetchBbrefHtml(
    salariesUrl,
    { headers: { "User-Agent": UA, Accept: "text/html" } },
    HEAVY_MS,
  );
  if (!fetched?.html) return { error: "BBRef payroll unavailable", abbrev: abbr };
  let html = fetched.html.replace(/<!--([\s\S]*?)-->/g, "$1");
  if (!/id="payroll"/i.test(html)) {
    return { error: "Payroll table not found", abbrev: abbr, url: salariesUrl };
  }

  const table = html.match(/<table[^>]*id="payroll"[\s\S]*?<\/table>/i)?.[0] ?? "";
  const rows: {
    name: string;
    age: string | null;
    experience: string | null;
    serviceTime: string | null;
    acquired: string | null;
    contractStatus: string | null;
    salary: string | null;
    salaryAmount: number | null;
    bbrefId: string | null;
  }[] = [];
  const year = String(new Date().getFullYear());
  for (const rowHtml of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = rowHtml[1];
    if (/data-stat="player"[^>]*scope="col"/i.test(row) || !/data-stat="player"/i.test(row)) {
      continue;
    }
    const cell = (stat: string) => {
      const m = row.match(
        new RegExp(`data-stat="${stat}"[^>]*>([\\s\\S]*?)</t[dh]`, "i"),
      );
      return m ? decodeHtmlEntities(stripTags(m[1])).replace(/\s+/g, " ").trim() : null;
    };
    const name = cell("player");
    if (!name || /^(name|player)$/i.test(name)) continue;
    const salaryRaw = cell("contract_y0") ?? cell(`salary_${year}`) ?? cell("salary");
    const bbrefId = row.match(/\/players\/[a-z]\/([a-z0-9]+)\.shtml/i)?.[1] ?? null;
    rows.push({
      name,
      age: cell("age"),
      experience: cell("experience"),
      serviceTime: cell("service_time"),
      acquired: cell("how_acquired"),
      contractStatus: cell("contract_summary"),
      salary: salaryRaw,
      salaryAmount: salaryRaw ? parseCompactMoney(salaryRaw) : null,
      bbrefId,
    });
  }

  const payrollTotal = rows.reduce((sum, r) => sum + (r.salaryAmount ?? 0), 0);

  return {
    source: "baseball-reference",
    url: salariesUrl,
    abbrev: abbr,
    season: year,
    payrollTotal,
    payrollTotalDisplay: payrollTotal ? moneyDisplay(payrollTotal) : null,
    rows,
  };
}

const BBREF_TEAM_ABBREVS = [
  "ARI", "ATL", "BAL", "BOS", "CHC", "CHW", "CIN", "CLE", "COL", "DET",
  "HOU", "KCR", "LAA", "LAD", "MIA", "MIL", "MIN", "NYM", "NYY", "ATH",
  "PHI", "PIT", "SDP", "SEA", "SFG", "STL", "TBR", "TEX", "TOR", "WSN",
];

function parseFaYear(contractStatus: string, season: number): number | null {
  const s = contractStatus.trim();
  const faAfter = s.match(/FA after (\d{4})/i);
  if (faAfter) return Number(faAfter[1]);
  const opt = s.match(/(?:club|player|mutual|team|vesting) option (?:for )?(\d{4})/i);
  if (opt) return Number(opt[1]);
  if (/\bUFA\b/i.test(s) || /unrestricted free agent/i.test(s)) return season;
  if (/^1 yr\//i.test(s)) return season + 1;
  const range = s.match(/\((\d{2})-(\d{2})\)/);
  if (range) {
    const end = Number(range[2]);
    const yy = season % 100;
    if (end === yy) return season + 1;
    if (end < 70) {
      const century = Math.floor(season / 100) * 100;
      const fullEnd = century + end;
      if (fullEnd === season) return season + 1;
    }
  }
  return null;
}

function isUpcomingFreeAgent(contractStatus: string | null, season: number): boolean {
  if (!contractStatus) return false;
  const s = contractStatus.trim();
  if (/pre-?arb/i.test(s) || /minor league/i.test(s)) return false;
  const faYear = parseFaYear(s, season);
  return faYear != null && faYear >= season && faYear <= season + 1;
}

async function scrapeLeaguePayroll(): Promise<Record<string, unknown>> {
  const season = new Date().getFullYear();
  const started = Date.now();
  // Leave headroom under the 55s withBudget so partial results still return.
  const softDeadlineMs = 48_000;
  const allRows: {
    name: string;
    teamAbbrev: string;
    age: string | null;
    experience: string | null;
    serviceTime: string | null;
    acquired: string | null;
    contractStatus: string | null;
    salary: string | null;
    salaryAmount: number | null;
    bbrefId: string | null;
  }[] = [];
  let teamsLoaded = 0;
  const concurrency = 8;
  for (let i = 0; i < BBREF_TEAM_ABBREVS.length; i += concurrency) {
    if (Date.now() - started > softDeadlineMs && teamsLoaded >= 8) break;
    const batch = BBREF_TEAM_ABBREVS.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (abbrev) => {
        try {
          return await scrapeTeamPayroll(abbrev);
        } catch {
          return { abbrev, rows: [] as Record<string, unknown>[] };
        }
      }),
    );
    for (const result of results) {
      const abbr = String(result.abbrev ?? "");
      const rows = (result.rows ?? []) as {
        name: string;
        age?: string | null;
        experience?: string | null;
        serviceTime?: string | null;
        acquired?: string | null;
        contractStatus?: string | null;
        salary?: string | null;
        salaryAmount?: number | null;
        bbrefId?: string | null;
      }[];
      if (rows.length) teamsLoaded += 1;
      for (const row of rows) {
        if (!row.name) continue;
        allRows.push({
          name: row.name,
          teamAbbrev: abbr,
          age: row.age ?? null,
          experience: row.experience ?? null,
          serviceTime: row.serviceTime ?? null,
          acquired: row.acquired ?? null,
          contractStatus: row.contractStatus ?? null,
          salary: row.salary ?? null,
          salaryAmount: row.salaryAmount ?? null,
          bbrefId: row.bbrefId ?? null,
        });
      }
    }
  }

  const topSalaries = [...allRows]
    .filter((r) => (r.salaryAmount ?? 0) > 0)
    .sort((a, b) => (b.salaryAmount ?? 0) - (a.salaryAmount ?? 0))
    .slice(0, 40)
    .map((r, i) => ({
      rank: i + 1,
      name: r.name,
      teamAbbrev: r.teamAbbrev,
      salary: r.salary ?? moneyDisplay(r.salaryAmount!),
      salaryAmount: r.salaryAmount!,
      contractStatus: r.contractStatus,
      serviceTime: r.serviceTime,
      bbrefId: r.bbrefId,
    }));

  const upcomingFreeAgents = allRows
    .filter((r) => isUpcomingFreeAgent(r.contractStatus, season))
    .sort((a, b) => {
      const faA = parseFaYear(a.contractStatus ?? "", season) ?? 9999;
      const faB = parseFaYear(b.contractStatus ?? "", season) ?? 9999;
      if (faA !== faB) return faA - faB;
      return (b.salaryAmount ?? 0) - (a.salaryAmount ?? 0);
    })
    .map((r) => ({
      name: r.name,
      teamAbbrev: r.teamAbbrev,
      salary: r.salary,
      salaryAmount: r.salaryAmount,
      serviceTime: r.serviceTime,
      contractStatus: r.contractStatus ?? "",
      faYear: parseFaYear(r.contractStatus ?? "", season),
      bbrefId: r.bbrefId,
    }));

  return {
    source: "baseball-reference",
    season: String(season),
    teamsLoaded,
    topSalaries,
    upcomingFreeAgents,
  };
}

/** MLB Pipeline scouting grades + narrative for a prospect (hide when absent). */
async function scrapePipelineScouting(playerId: number): Promise<Record<string, unknown>> {
  const year = new Date().getFullYear();
  const query = `
    query PipelineSelection($slug: String!, $limit: Int) {
      getPlayerRankingsFromSelection(slug: $slug, limit: $limit) {
        rank
        playerEntity {
          position
          eta
          player { id fullName }
          prospectBio { contentTitle contentText }
        }
      }
    }
  `;
  const slugs = [
    `sel-pr-${year}-top100`,
    `sel-pr-${year}-cardinals`,
    `sel-pr-${year - 1}-top100`,
    `sel-pr-${year - 1}-cardinals`,
  ];

  let hit: PipelineRow | null = null;
  let sourceSlug: string | null = null;
  for (const slug of slugs) {
    const res = await timedFetch(
      "https://data-graph.mlb.com/graphql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Origin: "https://www.mlb.com",
          Referer: "https://www.mlb.com/cardinals/prospects",
          "User-Agent": UA,
        },
        body: JSON.stringify({
          query,
          variables: { slug, limit: 100 },
        }),
      },
      FETCH_MS,
    );
    if (!res.ok) continue;
    const payload = (await res.json()) as {
      data?: { getPlayerRankingsFromSelection?: PipelineRow[] };
    };
    const rows = payload.data?.getPlayerRankingsFromSelection ?? [];
    const found = rows.find((r) => Number(r.playerEntity?.player?.id) === playerId);
    if (found) {
      hit = found;
      sourceSlug = slug;
      break;
    }
  }

  if (!hit?.playerEntity?.player?.id) {
    return { found: false, playerId };
  }

  const bios = hit.playerEntity.prospectBio ?? [];
  const preferred =
    bios.find((b) => String(b.contentTitle ?? "") === String(year)) ??
    [...bios].reverse().find((b) => (b.contentText ?? "").toLowerCase().includes("scouting grades")) ??
    bios[bios.length - 1] ??
    null;
  if (!preferred?.contentText) {
    return { found: false, playerId };
  }
  const parsed = parsePipelineBio(preferred.contentText);
  if (!parsed.gradesLine && parsed.paragraphs.length === 0) {
    return { found: false, playerId };
  }

  const fullName = hit.playerEntity.player.fullName ?? "";
  const slug = fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    found: true,
    playerId,
    playerName: fullName,
    rank: hit.rank ?? null,
    eta: hit.playerEntity.eta ?? null,
    position: hit.playerEntity.position ?? null,
    gradesLine: parsed.gradesLine,
    grades: parsed.grades,
    paragraphs: parsed.paragraphs,
    bioYear: preferred.contentTitle ?? null,
    sourceSlug,
    pipelineUrl: `https://www.mlb.com/prospects/${slug}-${playerId}`,
  };
}

/** Implied promotion % from ESPN projected Championship finish. */
function promotionProbFromProjectedPlace(place: number): number {
  if (place <= 1) return 0.92;
  if (place === 2) return 0.86;
  if (place === 3) return 0.48;
  if (place === 4) return 0.38;
  if (place === 5) return 0.32;
  if (place === 6) return 0.28;
  if (place <= 8) return 0.14;
  if (place <= 10) return 0.08;
  if (place <= 14) return 0.04;
  return 0.015;
}

function americanFromProb(p: number): string {
  const clamped = Math.min(0.98, Math.max(0.02, p));
  if (clamped >= 0.5) {
    return String(Math.round((-100 * clamped) / (1 - clamped)));
  }
  return `+${Math.round((100 * (1 - clamped)) / clamped)}`;
}

type SoccerPromotionOdd = {
  teamId: string;
  name: string;
  percent: number;
  american: string;
  projectedPlace: number | null;
  source: string;
  url: string | null;
};

/** Polymarket (when open) + ESPN projected finishes → Championship promotion odds. */
async function scrapeChampionshipPromotionOdds(): Promise<Record<string, unknown>> {
  const byId = new Map<string, SoccerPromotionOdd>();

  // Polymarket — prefer live markets for the current season when listed.
  try {
    const searchUrl =
      "https://gamma-api.polymarket.com/public-search?q=" +
      encodeURIComponent("efl championship team promoted");
    const search = (await (
      await timedFetch(searchUrl, { headers: { Accept: "application/json", "User-Agent": UA } }, 8_000)
    ).json()) as {
      events?: { slug?: string; title?: string; closed?: boolean }[];
    };
    const slug =
      (search.events ?? []).find(
        (e) =>
          /championship/i.test(e.title ?? "") &&
          /promot/i.test(e.title ?? "") &&
          e.closed === false &&
          e.slug,
      )?.slug ??
      (search.events ?? []).find((e) => e.slug && /championship.*promot|promot.*championship/i.test(e.slug))
        ?.slug ??
      "efl-championship-team-promoted-to-epl";

    const evRes = await timedFetch(
      `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`,
      { headers: { Accept: "application/json", "User-Agent": UA } },
      8_000,
    );
    if (evRes.ok) {
      const events = (await evRes.json()) as {
        title?: string;
        closed?: boolean;
        markets?: {
          groupItemTitle?: string;
          question?: string;
          closed?: boolean;
          active?: boolean;
          outcomePrices?: string | string[];
          outcomes?: string | string[];
        }[];
      }[];
      const ev = Array.isArray(events) ? events[0] : null;
      if (ev && ev.closed !== true) {
        const nameToId: Record<string, string> = {
          wrexham: "352",
          "wolverhampton wanderers": "380",
          wolves: "380",
        };
        for (const m of ev.markets ?? []) {
          if (m.closed === true) continue;
          const label = (m.groupItemTitle || m.question || "").trim();
          const key = label.toLowerCase().replace(/\s+fc$/i, "").trim();
          let teamId: string | null = null;
          let name = label;
          for (const [n, id] of Object.entries(nameToId)) {
            if (key === n || key.includes(n)) {
              teamId = id;
              name = n === "wolves" || n.includes("wolverhampton") ? "Wolves" : "Wrexham";
              break;
            }
          }
          if (!teamId) continue;
          let prices = m.outcomePrices;
          if (typeof prices === "string") {
            try {
              prices = JSON.parse(prices) as string[];
            } catch {
              prices = [];
            }
          }
          const yes = Number((prices as string[])?.[0]);
          if (!Number.isFinite(yes) || yes <= 0) continue;
          byId.set(teamId, {
            teamId,
            name,
            percent: Math.round(yes * 1000) / 10,
            american: americanFromProb(yes),
            projectedPlace: null,
            source: "Polymarket",
            url: `https://polymarket.com/event/${slug}`,
          });
        }
      }
    }
  } catch {
    /* optional */
  }

  // ESPN projected finishes for clubs still missing market odds.
  try {
    const storyIds: number[] = [];
    try {
      const news = (await (
        await timedFetch(
          "https://now.core.api.espn.com/v1/sports/news?limit=50&league=eng.2",
          { headers: { Accept: "application/json", "User-Agent": UA } },
          8_000,
        )
      ).json()) as { headlines?: { id?: number; headline?: string }[] };
      for (const h of news.headlines ?? []) {
        if (
          h.id &&
          /predict|projected finish|guide to new season|every club/i.test(h.headline ?? "")
        ) {
          storyIds.push(h.id);
        }
      }
    } catch {
      /* known id below */
    }
    if (!storyIds.includes(49583537)) storyIds.push(49583537);

    for (const storyId of storyIds) {
      const storyPayload = (await (
        await timedFetch(
          `https://now.core.api.espn.com/v1/sports/news/${storyId}`,
          { headers: { Accept: "application/json", "User-Agent": UA } },
          8_000,
        )
      ).json()) as { headlines?: { story?: string; links?: { web?: { href?: string } } }[] };
      const storyHtml = storyPayload.headlines?.[0]?.story ?? "";
      const storyText = stripTags(storyHtml);
      if (!/Wrexham|Wolves/i.test(storyText)) continue;
      const url = storyPayload.headlines?.[0]?.links?.web?.href ?? null;
      const targets: { teamId: string; name: string; patterns: RegExp[] }[] = [
        {
          teamId: "352",
          name: "Wrexham",
          patterns: [/Wrexham\s*[—–-]+\s*(\d+)(?:st|nd|rd|th)?/i],
        },
        {
          teamId: "380",
          name: "Wolves",
          patterns: [
            /Wolves\s*[—–-]+\s*(\d+)(?:st|nd|rd|th)?/i,
            /Wolverhampton Wanderers\s*[—–-]+\s*(\d+)(?:st|nd|rd|th)?/i,
          ],
        },
      ];
      for (const t of targets) {
        if (byId.has(t.teamId)) continue;
        let place: number | null = null;
        for (const re of t.patterns) {
          const m = storyText.match(re);
          if (m) {
            place = Number(m[1]);
            break;
          }
        }
        if (place == null || !Number.isFinite(place)) continue;
        const p = promotionProbFromProjectedPlace(place);
        byId.set(t.teamId, {
          teamId: t.teamId,
          name: t.name,
          percent: Math.round(p * 1000) / 10,
          american: americanFromProb(p),
          projectedPlace: place,
          source: "ESPN projection",
          url,
        });
      }
      if (byId.size >= 2) break;
    }
  } catch {
    /* optional */
  }

  const items = [...byId.values()];
  return {
    league: "eng.2",
    items,
    source: items[0]?.source ?? "none",
  };
}

export {
  scrapeTeamBbrefSummary,
  scrapeTeamPayroll,
  BBREF_TEAM_ABBREVS,
  parseFaYear,
  isUpcomingFreeAgent,
  scrapeLeaguePayroll,
  scrapePipelineScouting,
  promotionProbFromProjectedPlace,
  americanFromProb,
  scrapeChampionshipPromotionOdds,
  type SoccerPromotionOdd
};
