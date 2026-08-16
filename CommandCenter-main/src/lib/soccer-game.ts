/** ESPN soccer game summary → typed preview/detail for Dispatch reader. */

import { formatSportsDateLong, fmtTime } from "@/lib/utils";

/** Same CDN path as `soccerTeamLogo` — kept local to avoid pulling supabase via soccer.ts. */
function teamLogo(teamId: string | number): string {
  return `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`;
}

export type SoccerGameSide = {
  id: string;
  name: string;
  shortName: string;
  abbrev: string;
  logo: string | null;
  record: string | null;
  form: string | null;
  score: string | null;
};

export type SoccerGameLeader = {
  name: string;
  value: string;
  detail: string;
};

export type SoccerGameOdds = {
  provider: string;
  awayOpen: string | null;
  awayMl: string | null;
  homeOpen: string | null;
  homeMl: string | null;
  drawOpen: string | null;
  drawMl: string | null;
  totalLine: string | null;
  totalOverOdds: string | null;
  totalUnderOdds: string | null;
  awaySpread: string | null;
  awaySpreadOdds: string | null;
  homeSpread: string | null;
  homeSpreadOdds: string | null;
};

export type SoccerGameDetail = {
  eventId: string;
  leagueSlug: string;
  leagueName: string;
  status: string;
  state: "pre" | "in" | "post";
  when: string | null;
  venue: string | null;
  previewHtml: string;
  storyHtml: string | null;
  away: SoccerGameSide;
  home: SoccerGameSide;
  odds: SoccerGameOdds | null;
  topScorers: { away: SoccerGameLeader | null; home: SoccerGameLeader | null };
  mostAssists: { away: SoccerGameLeader | null; home: SoccerGameLeader | null };
  teamStats: { label: string; away: string; home: string }[];
  standings: {
    rank: string;
    teamId: string;
    name: string;
    abbrev: string;
    gp: string;
    w: string;
    d: string;
    l: string;
    gd: string;
    pts: string;
    highlight: boolean;
  }[];
  headToHead: {
    date: string;
    label: string;
    score: string;
    competition: string | null;
  }[];
  lastFive: { teamId: string; abbrev: string; results: string }[];
  espnUrl: string;
};

type EspnSummary = {
  header?: {
    id?: string;
    competitions?: EspnCompetition[];
    league?: {
      slug?: string;
      name?: string;
      abbreviation?: string;
      shortName?: string;
      midsizeName?: string;
    };
    links?: { href?: string; rel?: string[] }[];
  };
  gameInfo?: { venue?: { fullName?: string } };
  article?: {
    headline?: string;
    description?: string;
    story?: string;
    links?: { web?: { href?: string } };
  };
  pickcenter?: EspnPickCenter[];
  odds?: EspnPickCenter[];
  leaders?: {
    team?: { id?: string; abbreviation?: string };
    leaders?: {
      name?: string;
      displayName?: string;
      leaders?: {
        displayValue?: string;
        summary?: string;
        athlete?: { displayName?: string; shortName?: string };
      }[];
    }[];
  }[];
  boxscore?: {
    teams?: {
      homeAway?: string;
      team?: { id?: string; abbreviation?: string };
      statistics?: { name?: string; label?: string; displayValue?: string }[];
    }[];
  };
  standings?: {
    groups?: {
      standings?: {
        entries?: {
          id?: string;
          team?:
            | string
            | {
                id?: string;
                displayName?: string;
                shortDisplayName?: string;
                abbreviation?: string;
              };
          stats?: {
            name?: string;
            abbreviation?: string;
            displayName?: string;
            shortDisplayName?: string;
            displayValue?: string;
            value?: number | string;
          }[];
        }[];
      };
    }[];
  };
  seasonseries?: {
    summary?: string;
    shortSummary?: string;
    events?: {
      date?: string;
      competitionName?: string;
      competitors?: {
        homeAway?: string;
        score?: string | number;
        winner?: boolean;
        team?: { abbreviation?: string; displayName?: string; id?: string };
      }[];
    }[];
  }[];
  lastFiveGames?: {
    team?: { id?: string; abbreviation?: string };
    events?: { gameResult?: string }[];
  }[];
  news?: {
    articles?: { headline?: string; description?: string; story?: string }[];
  };
};

type EspnCompetition = {
  date?: string;
  venue?: { fullName?: string };
  status?: {
    type?: {
      state?: string;
      completed?: boolean;
      description?: string;
      detail?: string;
      shortDetail?: string;
    };
  };
  competitors?: {
    homeAway?: string;
    score?: string | number;
    form?: string;
    record?: { type?: string; summary?: string; displayValue?: string }[];
    team?: {
      id?: string;
      displayName?: string;
      shortDisplayName?: string;
      abbreviation?: string;
      logo?: string;
      logos?: { href?: string }[];
    };
  }[];
};

type EspnPickCenter = {
  provider?: { name?: string };
  overUnder?: number | string;
  spread?: number | string;
  overOdds?: number | string;
  underOdds?: number | string;
  moneyline?: {
    away?: { open?: { odds?: string }; close?: { odds?: string } };
    home?: { open?: { odds?: string }; close?: { odds?: string } };
    draw?: { open?: { odds?: string }; close?: { odds?: string } };
  };
  pointSpread?: {
    away?: { open?: { line?: string; odds?: string }; close?: { line?: string; odds?: string } };
    home?: { open?: { line?: string; odds?: string }; close?: { line?: string; odds?: string } };
  };
  total?: {
    over?: { open?: { line?: string; odds?: string }; close?: { line?: string; odds?: string } };
    under?: { open?: { line?: string; odds?: string }; close?: { line?: string; odds?: string } };
  };
  awayTeamOdds?: { moneyLine?: number; spreadOdds?: number };
  homeTeamOdds?: { moneyLine?: number; spreadOdds?: number };
  drawOdds?: { moneyLine?: number };
};

const DEFAULT_LEAGUES = ["eng.2", "eng.1"] as const;

/** Mashed ESPN copy: glued CamelCase names or SCORE-like WOL2-1-0 blobs. */
export function isMashedEspnBlob(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/[a-z][A-Z]/.test(t)) return true;
  if (/[A-Z]{2,}\d-\d-\d/.test(t)) return true;
  return false;
}

async function espnSoccerSummary(
  league: string,
  eventId: string,
): Promise<EspnSummary | null> {
  const path = `soccer/${league}/summary?event=${encodeURIComponent(eventId)}`;
  const hosts = [
    "https://site.api.espn.com/apis/site/v2/sports",
    "https://site.web.api.espn.com/apis/site/v2/sports",
  ];
  for (const host of hosts) {
    try {
      const ctl = new AbortController();
      const timer = window.setTimeout(() => ctl.abort(), 12_000);
      try {
        const res = await fetch(`${host}/${path}`, {
          headers: { Accept: "application/json" },
          signal: ctl.signal,
        });
        if (!res.ok) continue;
        const data = (await res.json()) as EspnSummary & { error?: string };
        if (data && typeof data === "object" && !data.error && data.header?.competitions?.length) {
          return data;
        }
      } finally {
        window.clearTimeout(timer);
      }
    } catch {
      /* try next host */
    }
  }

  try {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!base || !key) return null;
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 20_000);
    try {
      const res = await fetch(`${base}/functions/v1/sports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        body: JSON.stringify({ path }),
        signal: ctl.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as EspnSummary & { error?: string };
      if (data && typeof data === "object" && !data.error && data.header?.competitions?.length) {
        return data;
      }
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    /* give up */
  }
  return null;
}

function leagueDisplayName(slug: string, headerName?: string | null): string {
  if (headerName) return headerName;
  if (slug === "eng.1") return "Premier League";
  if (slug === "eng.2") return "EFL Championship";
  return slug;
}

function fmtAmerican(n: number | string | null | undefined): string | null {
  if (n == null || n === "") return null;
  if (typeof n === "string") {
    const t = n.trim();
    if (!t) return null;
    if (/^[+-]/.test(t)) return t;
    const num = Number(t);
    if (!Number.isFinite(num)) return t;
    return num > 0 ? `+${num}` : String(num);
  }
  if (!Number.isFinite(n)) return null;
  return n > 0 ? `+${n}` : String(n);
}

function pickRecord(
  records: { type?: string; summary?: string; displayValue?: string }[] | undefined,
): string | null {
  if (!records?.length) return null;
  const total = records.find((r) => r.type === "total");
  return total?.summary || total?.displayValue || records[0]?.summary || records[0]?.displayValue || null;
}

function parseSide(
  c:
    | NonNullable<EspnCompetition["competitors"]>[number]
    | undefined,
): SoccerGameSide {
  const id = String(c?.team?.id ?? "");
  const logo =
    c?.team?.logo ||
    c?.team?.logos?.[0]?.href ||
    (id ? teamLogo(id) : null);
  return {
    id,
    name: c?.team?.displayName || c?.team?.shortDisplayName || "Team",
    shortName: c?.team?.shortDisplayName || c?.team?.abbreviation || "Team",
    abbrev: c?.team?.abbreviation || "—",
    logo,
    record: pickRecord(c?.record),
    form: c?.form?.trim() || null,
    score: c?.score != null && c.score !== "" ? String(c.score) : null,
  };
}

function parseOdds(pc: EspnPickCenter | undefined): SoccerGameOdds | null {
  if (!pc) return null;
  const ml = pc.moneyline;
  const ps = pc.pointSpread;
  const tot = pc.total;
  const provider = pc.provider?.name?.trim() || "Odds";

  const awayOpen = ml?.away?.open?.odds ?? null;
  const awayMl = ml?.away?.close?.odds ?? fmtAmerican(pc.awayTeamOdds?.moneyLine);
  const homeOpen = ml?.home?.open?.odds ?? null;
  const homeMl = ml?.home?.close?.odds ?? fmtAmerican(pc.homeTeamOdds?.moneyLine);
  const drawOpen = ml?.draw?.open?.odds ?? null;
  const drawMl = ml?.draw?.close?.odds ?? fmtAmerican(pc.drawOdds?.moneyLine);

  const awaySpread = ps?.away?.close?.line ?? (pc.spread != null ? String(pc.spread) : null);
  const awaySpreadOdds =
    ps?.away?.close?.odds ?? fmtAmerican(pc.awayTeamOdds?.spreadOdds);
  const homeSpread = ps?.home?.close?.line ?? null;
  const homeSpreadOdds =
    ps?.home?.close?.odds ?? fmtAmerican(pc.homeTeamOdds?.spreadOdds);

  let totalLine: string | null = null;
  const overLine = tot?.over?.close?.line;
  if (overLine) {
    totalLine = overLine.replace(/^[ou]/i, "");
  } else if (pc.overUnder != null) {
    totalLine = String(pc.overUnder);
  }

  const totalOverOdds = tot?.over?.close?.odds ?? fmtAmerican(pc.overOdds);
  const totalUnderOdds = tot?.under?.close?.odds ?? fmtAmerican(pc.underOdds);

  if (
    !awayMl &&
    !homeMl &&
    !drawMl &&
    !totalLine &&
    !awaySpread &&
    !homeSpread
  ) {
    return null;
  }

  return {
    provider,
    awayOpen,
    awayMl,
    homeOpen,
    homeMl,
    drawOpen,
    drawMl,
    totalLine,
    totalOverOdds,
    totalUnderOdds,
    awaySpread,
    awaySpreadOdds,
    homeSpread,
    homeSpreadOdds,
  };
}

function leaderFromCategories(
  teamBlock:
    | {
        team?: { id?: string };
        leaders?: {
          name?: string;
          displayName?: string;
          leaders?: {
            displayValue?: string;
            summary?: string;
            athlete?: { displayName?: string; shortName?: string };
          }[];
        }[];
      }
    | undefined,
  names: string[],
): SoccerGameLeader | null {
  if (!teamBlock?.leaders?.length) return null;
  const want = names.map((n) => n.toLowerCase());
  const cat = teamBlock.leaders.find((c) => {
    const n = (c.name || "").toLowerCase();
    const d = (c.displayName || "").toLowerCase();
    return want.some((w) => n === w || d === w || n.includes(w) || d.includes(w));
  });
  const top = cat?.leaders?.[0];
  if (!top) return null;
  const name = top.athlete?.displayName || top.athlete?.shortName;
  if (!name) return null;
  return {
    name,
    value: top.displayValue?.trim() || "—",
    detail: top.summary?.trim() || cat?.displayName || cat?.name || "",
  };
}

function findTeamLeaders(
  leaders: EspnSummary["leaders"],
  teamId: string,
): (typeof leaders extends (infer U)[] | undefined ? U : never) | undefined {
  if (!leaders?.length) return undefined;
  return leaders.find((l) => String(l.team?.id ?? "") === teamId);
}

function statValue(
  stats: { name?: string; abbreviation?: string; displayName?: string; shortDisplayName?: string; displayValue?: string; value?: number | string }[] | undefined,
  names: string[],
): string {
  if (!stats?.length) return "—";
  const want = names.map((n) => n.toLowerCase());
  for (const s of stats) {
    const keys = [s.name, s.abbreviation, s.displayName, s.shortDisplayName]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());
    if (keys.some((k) => want.includes(k))) {
      return s.displayValue != null && s.displayValue !== ""
        ? String(s.displayValue)
        : s.value != null
          ? String(s.value)
          : "—";
    }
  }
  return "—";
}

function parseTeamStats(
  box: EspnSummary["boxscore"],
  awayId: string,
  homeId: string,
): { label: string; away: string; home: string }[] {
  const teams = box?.teams ?? [];
  const away =
    teams.find((t) => t.homeAway === "away") ||
    teams.find((t) => String(t.team?.id ?? "") === awayId);
  const home =
    teams.find((t) => t.homeAway === "home") ||
    teams.find((t) => String(t.team?.id ?? "") === homeId);
  if (!away?.statistics?.length && !home?.statistics?.length) return [];

  const labels: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const s of [...(away?.statistics ?? []), ...(home?.statistics ?? [])]) {
    const key = s.name || s.label || "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    labels.push({ key, label: s.label || s.name || key });
  }

  const prefer = [
    "possessionPct",
    "totalShots",
    "shotsOnTarget",
    "wonCorners",
    "foulsCommitted",
    "yellowCards",
    "redCards",
    "offsides",
    "saves",
    "accuratePasses",
    "totalPasses",
    "passPct",
  ];
  labels.sort((a, b) => {
    const ia = prefer.indexOf(a.key);
    const ib = prefer.indexOf(b.key);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const val = (
    side: typeof away,
    key: string,
  ): string => {
    const hit = side?.statistics?.find((s) => s.name === key || s.label === key);
    return hit?.displayValue != null && hit.displayValue !== "" ? String(hit.displayValue) : "—";
  };

  return labels.slice(0, 14).map(({ key, label }) => ({
    label,
    away: val(away, key),
    home: val(home, key),
  }));
}

function parseStandings(
  raw: EspnSummary["standings"],
  awayId: string,
  homeId: string,
): SoccerGameDetail["standings"] {
  const entries = raw?.groups?.[0]?.standings?.entries ?? [];
  return entries.map((e) => {
    const teamObj = typeof e.team === "object" && e.team ? e.team : null;
    const teamId = String(teamObj?.id ?? e.id ?? "");
    const name =
      (typeof e.team === "string" ? e.team : null) ||
      teamObj?.displayName ||
      teamObj?.shortDisplayName ||
      "Team";
    const abbrev =
      teamObj?.abbreviation ||
      abbrevFromName(name) ||
      "—";
    return {
      rank: statValue(e.stats, ["rank", "Rank"]),
      teamId,
      name,
      abbrev,
      gp: statValue(e.stats, ["gamesPlayed", "GP", "Games Played"]),
      w: statValue(e.stats, ["wins", "W", "Wins"]),
      d: statValue(e.stats, ["ties", "draws", "D", "Draws", "Ties"]),
      l: statValue(e.stats, ["losses", "L", "Losses"]),
      gd: statValue(e.stats, ["pointDifferential", "goalDifference", "GD", "Goal Difference"]),
      pts: statValue(e.stats, ["points", "PTS", "Points"]),
      highlight: teamId === awayId || teamId === homeId,
    };
  });
}

function abbrevFromName(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length >= 3) {
    return parts
      .map((p) => p[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 3);
  }
  if (parts.length === 2) {
    const a = (parts[0] ?? "").slice(0, 3).toUpperCase();
    return a || null;
  }
  return parts[0]!.slice(0, 3).toUpperCase();
}

function parseHeadToHead(
  series: EspnSummary["seasonseries"],
): SoccerGameDetail["headToHead"] {
  const events = series?.[0]?.events ?? [];
  return events.slice(0, 5).map((ev) => {
    const home = (ev.competitors ?? []).find((c) => c.homeAway === "home");
    const away = (ev.competitors ?? []).find((c) => c.homeAway === "away");
    const ha = away?.team?.abbreviation || "?";
    const hh = home?.team?.abbreviation || "?";
    const as = away?.score != null ? String(away.score) : "—";
    const hs = home?.score != null ? String(home.score) : "—";
    const dateRaw = ev.date || "";
    const date = dateRaw ? formatSportsDateLong(dateRaw) || dateRaw.slice(0, 10) : "";
    return {
      date,
      label: `${ha} @ ${hh}`,
      score: `${as}–${hs}`,
      competition: ev.competitionName ?? null,
    };
  });
}

function parseLastFive(raw: EspnSummary["lastFiveGames"]): SoccerGameDetail["lastFive"] {
  return (raw ?? []).map((row) => ({
    teamId: String(row.team?.id ?? ""),
    abbrev: row.team?.abbreviation || "—",
    results: (row.events ?? [])
      .slice(0, 5)
      .map((e) => e.gameResult || "")
      .join(""),
  }));
}

function whenLabel(iso: string | null | undefined, state: string, status: string): string | null {
  if (!iso) return status || null;
  try {
    const long = formatSportsDateLong(iso);
    const time = fmtTime(iso);
    if (state === "pre") return `${long} · ${time}`;
    return long || status || null;
  } catch {
    return status || null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPreviewHtml(opts: {
  away: SoccerGameSide;
  home: SoccerGameSide;
  leagueName: string;
  venue: string | null;
  when: string | null;
  state: string;
  status: string;
  odds: SoccerGameOdds | null;
  seriesSummary: string | null;
  lastFive: SoccerGameDetail["lastFive"];
}): string {
  const { away, home, leagueName, venue, when, state, status, odds, seriesSummary, lastFive } =
    opts;
  const venueBit = venue ? ` at ${escapeHtml(venue)}` : "";
  const kick =
    state === "pre"
      ? when
        ? `Kickoff ${escapeHtml(when)}.`
        : "Kickoff TBD."
      : state === "in"
        ? `Live — ${escapeHtml(status)}.`
        : `${escapeHtml(status)}${when ? ` · ${escapeHtml(when)}` : ""}.`;

  const paras: string[] = [];
  paras.push(
    `<p><strong>${escapeHtml(away.name)} vs ${escapeHtml(home.name)}</strong> — ${escapeHtml(leagueName)}${venueBit}. ${kick}</p>`,
  );

  const awayForm =
    lastFive.find((r) => r.teamId === away.id)?.results || away.form || "";
  const homeForm =
    lastFive.find((r) => r.teamId === home.id)?.results || home.form || "";
  const formBits: string[] = [];
  if (awayForm || homeForm) {
    formBits.push(
      `Form: ${escapeHtml(away.shortName || away.abbrev)} ${escapeHtml(awayForm || "—")} · ${escapeHtml(home.shortName || home.abbrev)} ${escapeHtml(homeForm || "—")}`,
    );
  }
  const recBits: string[] = [];
  if (away.record || home.record) {
    recBits.push(
      `Records: ${escapeHtml(away.abbrev)} ${escapeHtml(away.record || "—")} · ${escapeHtml(home.abbrev)} ${escapeHtml(home.record || "—")}`,
    );
  }
  if (formBits.length || recBits.length) {
    paras.push(`<p>${[...formBits, ...recBits].join(". ")}</p>`);
  }

  if (seriesSummary) {
    paras.push(`<p>Head-to-head: ${escapeHtml(seriesSummary)}</p>`);
  }

  if (odds && (odds.awayMl || odds.homeMl || odds.drawMl || odds.totalLine)) {
    const bits = [
      odds.awayMl ? `${escapeHtml(away.shortName || away.abbrev)} ${escapeHtml(odds.awayMl)}` : null,
      odds.drawMl ? `Draw ${escapeHtml(odds.drawMl)}` : null,
      odds.homeMl ? `${escapeHtml(home.shortName || home.abbrev)} ${escapeHtml(odds.homeMl)}` : null,
      odds.totalLine ? `O/U ${escapeHtml(odds.totalLine)}` : null,
    ].filter(Boolean);
    paras.push(
      `<p>Odds (${escapeHtml(odds.provider)}): ${bits.join(" · ")}</p>`,
    );
  }

  return paras.join("\n");
}

function extractStoryHtml(sum: EspnSummary): string | null {
  const article = sum.article;
  if (article) {
    const story = article.story?.trim();
    if (story && !isMashedEspnBlob(story) && story.replace(/<[^>]+>/g, "").trim().length >= 40) {
      return story;
    }
    const desc = article.description?.trim();
    if (desc && !isMashedEspnBlob(desc) && desc.length >= 40) {
      return `<p>${escapeHtml(desc.replace(/^—\s*/, ""))}</p>`;
    }
  }
  const news = sum.news?.articles?.[0];
  if (news) {
    const story = news.story?.trim();
    if (story && !isMashedEspnBlob(story) && story.replace(/<[^>]+>/g, "").trim().length >= 40) {
      return story;
    }
    const desc = news.description?.trim();
    if (desc && !isMashedEspnBlob(desc) && desc.length >= 40) {
      return `<p>${escapeHtml(desc.replace(/^—\s*/, ""))}</p>`;
    }
  }
  return null;
}

function normalizeState(raw: string | undefined, completed?: boolean): "pre" | "in" | "post" {
  if (completed || raw === "post") return "post";
  if (raw === "in") return "in";
  return "pre";
}

export async function fetchSoccerGameDetail(
  eventId: string,
  leagueHint?: string | null,
): Promise<SoccerGameDetail> {
  const id = String(eventId || "").trim();
  if (!id) throw new Error("Missing soccer event id");

  const tried = new Set<string>();
  const order: string[] = [];
  const hint = leagueHint?.trim().toLowerCase() || null;
  if (hint) order.push(hint);
  for (const L of DEFAULT_LEAGUES) {
    if (!order.includes(L)) order.push(L);
  }

  let sum: EspnSummary | null = null;
  let usedSlug = hint || "eng.2";

  for (const league of order) {
    if (tried.has(league)) continue;
    tried.add(league);
    const data = await espnSoccerSummary(league, id);
    if (!data) continue;
    sum = data;
    const headerSlug = data.header?.league?.slug?.trim();
    usedSlug = headerSlug || league;
    // If header reveals another league we haven't tried and payload looks thin, keep going —
    // but ESPN usually returns the right game even on the wrong eng.* path.
    if (headerSlug && !tried.has(headerSlug) && headerSlug !== league) {
      // Prefer the header slug payload if we can fetch it cleanly; otherwise keep this one.
      const better = await espnSoccerSummary(headerSlug, id);
      tried.add(headerSlug);
      if (better) {
        sum = better;
        usedSlug = better.header?.league?.slug?.trim() || headerSlug;
      }
    }
    break;
  }

  if (!sum?.header?.competitions?.[0]) {
    throw new Error("Soccer game summary unavailable");
  }

  const comp = sum.header.competitions[0];
  const st = comp.status?.type;
  const state = normalizeState(st?.state, st?.completed);
  const status = st?.description || st?.shortDetail || st?.detail || (state === "post" ? "Full Time" : state === "in" ? "Live" : "Scheduled");
  const leagueName = leagueDisplayName(
    usedSlug,
    sum.header.league?.name ||
      sum.header.league?.shortName ||
      sum.header.league?.abbreviation ||
      null,
  );

  const awayRaw = (comp.competitors ?? []).find((c) => c.homeAway === "away");
  const homeRaw = (comp.competitors ?? []).find((c) => c.homeAway === "home");
  const away = parseSide(awayRaw);
  const home = parseSide(homeRaw);

  const venue = sum.gameInfo?.venue?.fullName || comp.venue?.fullName || null;
  const when = whenLabel(comp.date, state, status);
  const odds = parseOdds(sum.pickcenter?.[0] || sum.odds?.[0]);

  const awayLeaders = findTeamLeaders(sum.leaders, away.id);
  const homeLeaders = findTeamLeaders(sum.leaders, home.id);
  const topScorers = {
    away: leaderFromCategories(awayLeaders, ["goals", "totalGoals", "goal"]),
    home: leaderFromCategories(homeLeaders, ["goals", "totalGoals", "goal"]),
  };
  const mostAssists = {
    away: leaderFromCategories(awayLeaders, ["assists", "goalAssists", "assist"]),
    home: leaderFromCategories(homeLeaders, ["assists", "goalAssists", "assist"]),
  };

  const teamStats = parseTeamStats(sum.boxscore, away.id, home.id);
  const standings = parseStandings(sum.standings, away.id, home.id);
  const headToHead = parseHeadToHead(sum.seasonseries);
  const lastFive = parseLastFive(sum.lastFiveGames);
  const seriesSummary =
    sum.seasonseries?.[0]?.summary || sum.seasonseries?.[0]?.shortSummary || null;

  const storyHtml = extractStoryHtml(sum);
  const previewHtml = buildPreviewHtml({
    away,
    home,
    leagueName,
    venue,
    when,
    state,
    status,
    odds,
    seriesSummary,
    lastFive,
  });

  const espnUrl =
    sum.article?.links?.web?.href ||
    sum.header.links?.find((l) => l.rel?.includes("summary"))?.href ||
    `https://www.espn.com/soccer/match/_/gameId/${id}`;

  return {
    eventId: id,
    leagueSlug: usedSlug,
    leagueName,
    status,
    state,
    when,
    venue,
    previewHtml,
    storyHtml,
    away,
    home,
    odds,
    topScorers,
    mostAssists,
    teamStats,
    standings,
    headToHead,
    lastFive,
    espnUrl,
  };
}
