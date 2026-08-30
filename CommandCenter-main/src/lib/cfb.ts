/** College football via ESPN — scoreboard, RUWT, hot seat, player pages. */

import { parseEspnBroadcasts, type GameBroadcast } from "./game-broadcasts";
import { supabase } from "./supabase";
import { formatSportsDateLong } from "./utils";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const ESPN_WEB = "https://site.web.api.espn.com/apis/common/v3/sports/football/college-football";
const CORE =
  "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football";

export function chicagoTodayCfb(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export function cfbTeamLogo(teamId: string | number): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`;
}

export function cfbHeadshot(playerId: string | number, size = 350): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/college-football/players/full/${playerId}.png&w=${size}&h=${size}`;
}

/** Programs surfaced in RUWT interest + hot seat (FBS focus). */
export const CFB_FOCUS_TEAMS: { id: number; name: string; abbrev: string }[] = [
  { id: 142, name: "Missouri", abbrev: "MIZ" },
  { id: 333, name: "Alabama", abbrev: "ALA" },
  { id: 2, name: "Auburn", abbrev: "AUB" },
  { id: 8, name: "Arkansas", abbrev: "ARK" },
  { id: 57, name: "Florida", abbrev: "FLA" },
  { id: 61, name: "Georgia", abbrev: "UGA" },
  { id: 96, name: "Kentucky", abbrev: "UK" },
  { id: 99, name: "LSU", abbrev: "LSU" },
  { id: 145, name: "Ole Miss", abbrev: "MISS" },
  { id: 201, name: "Mississippi State", abbrev: "MSST" },
  { id: 263, name: "Tennessee", abbrev: "TENN" },
  { id: 245, name: "Texas A&M", abbrev: "TAMU" },
  { id: 228, name: "Texas", abbrev: "TEX" },
  { id: 251, name: "Texas Tech", abbrev: "TTU" },
  { id: 239, name: "Baylor", abbrev: "BAY" },
  { id: 262, name: "Oklahoma", abbrev: "OU" },
  { id: 2305, name: "Kansas State", abbrev: "KSU" },
  { id: 2306, name: "Kansas", abbrev: "KU" },
  { id: 52, name: "Florida State", abbrev: "FSU" },
  { id: 153, name: "North Carolina", abbrev: "UNC" },
  { id: 150, name: "Duke", abbrev: "DUKE" },
  { id: 258, name: "Virginia", abbrev: "UVA" },
  { id: 130, name: "Michigan", abbrev: "MICH" },
  { id: 194, name: "Ohio State", abbrev: "OSU" },
  { id: 213, name: "Penn State", abbrev: "PSU" },
  { id: 77, name: "Northwestern", abbrev: "NW" },
  { id: 356, name: "Illinois", abbrev: "ILL" },
  { id: 275, name: "Wisconsin", abbrev: "WIS" },
  { id: 2294, name: "Iowa", abbrev: "IOWA" },
  { id: 164, name: "Rutgers", abbrev: "RUT" },
  { id: 87, name: "Notre Dame", abbrev: "ND" },
  { id: 2483, name: "Oregon", abbrev: "ORE" },
  { id: 254, name: "Utah", abbrev: "UTAH" },
  { id: 30, name: "USC", abbrev: "USC" },
  { id: 26, name: "UCLA", abbrev: "UCLA" },
  { id: 9, name: "Arizona State", abbrev: "ASU" },
  { id: 12, name: "Arizona", abbrev: "ARIZ" },
  { id: 25, name: "California", abbrev: "CAL" },
  { id: 38, name: "Colorado", abbrev: "COLO" },
  { id: 59, name: "Georgia Tech", abbrev: "GT" },
  { id: 183, name: "Syracuse", abbrev: "SYR" },
  { id: 221, name: "Pitt", abbrev: "PITT" },
  { id: 103, name: "Boston College", abbrev: "BC" },
  { id: 152, name: "NC State", abbrev: "NCST" },
  { id: 154, name: "Wake Forest", abbrev: "WAKE" },
  { id: 2390, name: "Miami", abbrev: "MIA" },
  { id: 97, name: "Louisville", abbrev: "LOU" },
  { id: 235, name: "Memphis", abbrev: "MEM" },
  { id: 242, name: "Boise State", abbrev: "BOIS" },
];

export type CfbScoreSide = {
  teamId: number;
  name: string;
  abbrev: string;
  score: number | null;
  record: string | null;
  logo: string | null;
  color: string;
  /** Official poll rank (1–25 only). ESPN uses 99 as unranked sentinel. */
  rank: number | null;
  /** ESPN FPI ordinal across FBS (can be 26–130+). */
  fpiRank: number | null;
};

export type CfbLiveSituation = {
  downDistanceText: string | null;
  possessionText: string | null;
  yardLine: number | null;
  isRedZone: boolean;
  possessionTeamId: string | null;
  lastPlayText: string | null;
};

export type CfbScoreGame = {
  id: string;
  status: string;
  shortDetail: string | null;
  live: boolean;
  final: boolean;
  away: CfbScoreSide;
  home: CfbScoreSide;
  when: string | null;
  whenShort: string | null;
  venue: string | null;
  date: string | null;
  broadcasts: GameBroadcast[];
  /** ESPN period number (1–4 regulation, 5+ OT). */
  period: number | null;
  situation: CfbLiveSituation | null;
  /** DraftKings (etc.) line from ESPN scoreboard — watchability only. */
  odds: CfbGameOdds | null;
};

/** Point spread is home-centric (negative ⇒ home favored), matching ESPN. */
export type CfbGameOdds = {
  details: string | null;
  /** Home team spread (e.g. -6.5 ⇒ home -6.5). */
  spread: number | null;
  overUnder: number | null;
  /** Team id of the spread favorite. */
  favoriteTeamId: number | null;
  provider: string | null;
};

export type CfbScoredGame = CfbScoreGame & {
  score: number;
  reasons: string[];
};

export type CfbRuwtContext = {
  teamInterest: Record<string, number>;
  watchTeamIds?: Set<string>;
};

export type CfbCoach = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamAbbrev: string;
  teamLogo: string | null;
  teamColor: string;
  headshot: string | null;
  recordSummary: string | null;
  wins: number;
  losses: number;
  winPct: number | null;
  hotSeatScore: number;
  hotSeatRank: number;
  firedOddsPct: number | null;
  firedOddsAmerican: string | null;
  /** Prediction-market URL when available (Kalshi coach-out, etc.). */
  kalshiUrl: string | null;
  factors: { label: string; points: number; detail: string }[];
};

export type CfbTeamStaffMember = {
  id: string;
  name: string;
  title: string;
  headshot: string | null;
  /** False when we only have a name (no ESPN coach id to open). */
  linkable: boolean;
  /** Short Wikipedia intro when available. */
  bio?: string | null;
};

export type CfbCoachSeasonRecord = {
  season: number;
  school: string;
  teamId: string | null;
  teamAbbrev: string | null;
  wins: number;
  losses: number;
  ties: number;
  summary: string;
};

export type CfbCoachCareerTotals = {
  wins: number;
  losses: number;
  ties: number;
  seasons: number;
  summary: string;
};

export type CfbCoachBioFact = {
  label: string;
  value: string;
};

export type CfbCoachCareerStop = {
  years: string;
  detail: string;
  kind: "playing" | "coaching";
};

export type CfbCoachProfile = CfbCoach & {
  bio: string | null;
  bioFacts: CfbCoachBioFact[];
  /** Playing + assistant/HC stops from Wikipedia when available. */
  careerPath: CfbCoachCareerStop[];
  careerHighlights: string[];
  /** Head-coaching W–L by season and school (ESPN coach seasons). */
  seasonRecords: CfbCoachSeasonRecord[];
  career: CfbCoachCareerTotals | null;
  /** e.g. Kalshi — null when heat is record-only. */
  oddsSource: string | null;
  /** College Football Reference search / coach page when resolved. */
  cfbRefUrl: string | null;
  /** Wikipedia article when resolved. */
  wikiUrl: string | null;
  /** Extra portrait URLs for <img onError> (e.g. team logo). */
  headshotFallbacks: string[];
  /** Current program staff (assistants) when team is known. */
  staff: CfbTeamStaffMember[];
};

export type CfbScoringPlay = {
  id: string;
  text: string;
  clock: string | null;
  teamAbbrev: string | null;
};

export type CfbBoxPlayerRow = {
  id: string;
  name: string;
  stats: string[];
};

export type CfbBoxStatGroup = {
  teamAbbrev: string;
  name: string;
  labels: string[];
  athletes: CfbBoxPlayerRow[];
};

export type CfbTeamGameStat = {
  teamAbbrev: string;
  label: string;
  value: string;
};

/** ESPN clip attached to a CFB game summary (recap package or play highlight). */
export type CfbGameVideo = {
  id: string;
  headline: string;
  description: string | null;
  thumb: string | null;
  /** Progressive MP4 when ESPN exposes one (embeddable in-app). */
  mp4: string | null;
  href: string | null;
  durationSec: number | null;
  /** Origin network when this is a FOX/CBS backup rather than ESPN. */
  source?: "espn" | "fox" | "cbs";
};

export type CfbBackupHighlights = {
  /** Best full-game package from FOX or CBS. */
  primary: CfbGameVideo | null;
  /** Extra play clips (usually FOX). */
  clips: CfbGameVideo[];
};


export type CfbGameDetail = CfbScoreGame & {
  scoringPlays: CfbScoringPlay[];
  boxGroups: CfbBoxStatGroup[];
  teamStats: CfbTeamGameStat[];
  article: {
    headline: string;
    description: string | null;
    storyHtml: string | null;
  } | null;
  /** Best ESPN recap / full-highlights package when available. */
  recapVideo: CfbGameVideo | null;
  /** Other embeddable clips from the summary (play highlights, related). */
  videos: CfbGameVideo[];
  /** Pregame extras from ESPN summary when box/article are empty. */
  oddsLine: string | null;
  predictor: { homeWinPct: number | null; awayWinPct: number | null } | null;
  lastFive: {
    teamId: number;
    teamAbbrev: string;
    results: { label: string; result: string; score: string | null }[];
  }[];
  venueDetail: string | null;
};

type EspnVideoRaw = {
  id?: string | number;
  headline?: string;
  title?: string;
  description?: string;
  caption?: string;
  duration?: number;
  thumbnail?: string;
  images?: { url?: string }[];
  posterImages?: { default?: { href?: string }; full?: { href?: string } };
  links?: {
    web?: { href?: string };
    source?: { href?: string; HD?: { href?: string } };
    mobile?: { source?: { href?: string } };
  };
};

function espnVideoMp4(v: EspnVideoRaw): string | null {
  const candidates = [
    v.links?.mobile?.source?.href,
    v.links?.source?.HD?.href,
    v.links?.source?.href,
  ];
  for (const href of candidates) {
    if (href && /\.mp4(\?|$)/i.test(href)) return href;
  }
  return null;
}

function mapEspnGameVideo(raw: EspnVideoRaw): CfbGameVideo | null {
  const id = raw.id != null ? String(raw.id) : "";
  const headline = (raw.headline || raw.title || "").trim();
  if (!id || !headline) return null;
  const mp4 = espnVideoMp4(raw);
  return {
    id,
    headline,
    description: (raw.description || raw.caption || "").trim() || null,
    thumb:
      raw.posterImages?.full?.href ??
      raw.posterImages?.default?.href ??
      raw.thumbnail ??
      raw.images?.[0]?.url ??
      null,
    mp4,
    href: raw.links?.web?.href ?? `https://www.espn.com/video/clip?id=${id}`,
    durationSec: typeof raw.duration === "number" ? raw.duration : null,
    source: "espn",
  };
}

/** Prefer full-highlight / recap packages over short studio bites. */
export function pickCfbRecapVideo(videos: CfbGameVideo[]): CfbGameVideo | null {
  const withMp4 = videos.filter((v) => v.mp4);
  if (!withMp4.length) return null;
  const scored = withMp4.map((v) => {
    const h = v.headline.toLowerCase();
    let score = 0;
    if (/full\s+highlights?/.test(h)) score += 20;
    else if (/\bhighlights?\b/.test(h)) score += 10;
    if (/\brecap\b/.test(h)) score += 8;
    if (v.durationSec != null && v.durationSec >= 90) score += 4;
    else if (v.durationSec != null && v.durationSec >= 60) score += 2;
    if (v.durationSec != null && v.durationSec < 45 && !/\bhighlight/i.test(h)) {
      score -= 6;
    }
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score || (b.v.durationSec ?? 0) - (a.v.durationSec ?? 0));
  return scored[0]?.v ?? null;
}

const FOX_BIFROST_KEY = "jE7yBJVRNAwdDesMgTzTXUUSx1It41Fq";

function cfbTeamSearchToken(name: string, abbrev: string): string {
  const first = (name.trim().split(/\s+/)[0] || abbrev).toLowerCase();
  // Keep acronyms like UNLV / USC intact; otherwise first word ("Memphis").
  return first.replace(/[^a-z0-9]/g, "");
}

function scoreBackupHighlight(
  headline: string,
  awayName: string,
  homeName: string,
  awayAbbrev: string,
  homeAbbrev: string,
): number {
  const h = headline.toLowerCase();
  const awayTok = cfbTeamSearchToken(awayName, awayAbbrev);
  const homeTok = cfbTeamSearchToken(homeName, homeAbbrev);
  let score = 0;
  if (/full\s+highlights?/.test(h) || /\bhighlights?\b.*\bcfb\b/.test(h)) score += 20;
  else if (/\bhighlights?\b/.test(h)) score += 10;
  if (awayTok && h.includes(awayTok)) score += 6;
  if (homeTok && h.includes(homeTok)) score += 6;
  if (/volleyball|soccer|basketball|softball|baseball/.test(h)) score -= 30;
  return score;
}

async function fetchFoxBackupHighlights(opts: {
  awayName: string;
  homeName: string;
  awayAbbrev: string;
  homeAbbrev: string;
}): Promise<CfbGameVideo[]> {
  const awayTok = cfbTeamSearchToken(opts.awayName, opts.awayAbbrev);
  const homeTok = cfbTeamSearchToken(opts.homeName, opts.homeAbbrev);
  const queries = [
    `${opts.awayName} ${opts.homeName} highlights`,
    `${awayTok} ${homeTok} highlights`,
    `${opts.awayAbbrev} ${opts.homeAbbrev} highlights`,
  ];
  const byId = new Map<string, CfbGameVideo>();

  for (const q of queries) {
    try {
      const url =
        `https://api.foxsports.com/bifrost/v1/search/content?text=` +
        `${encodeURIComponent(q)}&apikey=${FOX_BIFROST_KEY}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        results?: {
          title?: string;
          components?: {
            type?: string;
            model?: {
              title?: string;
              webUrl?: string;
              contentType?: string;
              isVideo?: boolean;
              image?: { url?: string; altUrl?: string };
              sparkId?: string;
            };
          }[];
        }[];
      };
      for (const section of data.results ?? []) {
        if (!/video/i.test(section.title ?? "")) continue;
        for (const c of section.components ?? []) {
          const m = c.model;
          const title = (m?.title ?? "").trim();
          const path = m?.webUrl ?? "";
          if (!title || !/\/watch\/fmc-/i.test(path)) continue;
          const score = scoreBackupHighlight(
            title,
            opts.awayName,
            opts.homeName,
            opts.awayAbbrev,
            opts.homeAbbrev,
          );
          if (score < 10) continue;
          const id = path.split("/").pop() || m?.sparkId || title;
          if (byId.has(id)) continue;
          byId.set(id, {
            id,
            headline: title.replace(/🏈/g, "").trim(),
            description: "FOX Sports",
            thumb: m?.image?.url ?? m?.image?.altUrl ?? null,
            mp4: null,
            href: path.startsWith("http") ? path : `https://www.foxsports.com${path}`,
            durationSec: null,
            source: "fox",
          });
        }
      }
      if (byId.size) break;
    } catch {
      /* try next query */
    }
  }

  return [...byId.values()].sort(
    (a, b) =>
      scoreBackupHighlight(
        b.headline,
        opts.awayName,
        opts.homeName,
        opts.awayAbbrev,
        opts.homeAbbrev,
      ) -
      scoreBackupHighlight(
        a.headline,
        opts.awayName,
        opts.homeName,
        opts.awayAbbrev,
        opts.homeAbbrev,
      ),
  );
}

async function fetchCbsBackupHighlight(opts: {
  awayName: string;
  homeName: string;
  awayAbbrev: string;
  homeAbbrev: string;
  date: string | null;
}): Promise<CfbGameVideo | null> {
  if (!opts.date) return null;
  const m = opts.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!month || !day) return null;

  const away = cfbTeamSearchToken(opts.awayName, opts.awayAbbrev);
  const home = cfbTeamSearchToken(opts.homeName, opts.homeAbbrev);
  const dateTags = [`${month}${day}`, `${month}-${day}`, `${m[2]}${m[3]}`];
  const slugs: string[] = [];
  for (const tag of dateTags) {
    slugs.push(`ncaaf-highlights-${away}-at-${home}-${tag}`);
    slugs.push(`ncaaf-highlights-${home}-vs-${away}-${tag}`);
    slugs.push(`ncaaf-highlights-${away}-${home}-${tag}`);
  }

  for (const slug of slugs) {
    const href = `https://www.cbssports.com/watch/general/video/${slug}`;
    try {
      const res = await fetch(href, {
        headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;
      const finalUrl = res.url || href;
      if (/\/watch\/general\/?$/i.test(finalUrl.replace(/\/$/, ""))) continue;
      const html = await res.text();
      const title =
        html.match(/property="og:title" content="([^"]+)"/i)?.[1] ||
        html.match(/<title>([^<]+)/i)?.[1] ||
        "";
      const image = html.match(/property="og:image" content="([^"]+)"/i)?.[1] || null;
      if (!/highlight/i.test(title)) continue;
      const score = scoreBackupHighlight(
        title,
        opts.awayName,
        opts.homeName,
        opts.awayAbbrev,
        opts.homeAbbrev,
      );
      if (score < 10) continue;
      return {
        id: `cbs:${slug}`,
        headline: title.replace(/\s*Stream of General Videos.*$/i, "").trim() || title.trim(),
        description: "CBS Sports",
        thumb: image && /^https?:/i.test(image) ? image : null,
        mp4: null,
        href: finalUrl,
        durationSec: null,
        source: "cbs",
      };
    } catch {
      /* try next slug */
    }
  }
  return null;
}

/** FOX + CBS highlight packages when ESPN has no embeddable recap clip. */
export async function fetchCfbBackupHighlights(opts: {
  awayName: string;
  homeName: string;
  awayAbbrev: string;
  homeAbbrev: string;
  date: string | null;
}): Promise<CfbBackupHighlights> {
  const [fox, cbs] = await Promise.all([
    fetchFoxBackupHighlights(opts).catch(() => [] as CfbGameVideo[]),
    fetchCbsBackupHighlight(opts).catch(() => null),
  ]);

  const foxPrimary =
    fox.find((v) => /full\s+highlights?|\bhighlights?\b.*\bcfb\b/i.test(v.headline)) ??
    fox[0] ??
    null;
  const primary = foxPrimary ?? cbs;
  const clips = fox.filter((v) => v.id !== primary?.id).slice(0, 8);
  // If FOX won primary, still surface CBS as an extra clip when present.
  if (primary?.source === "fox" && cbs && cbs.id !== primary.id) {
    clips.unshift(cbs);
  }

  return { primary, clips };
}

export type CfbPlayerProfile = {
  id: string;
  name: string;
  number: string | null;
  position: string | null;
  positionName: string | null;
  teamId: string | null;
  teamName: string | null;
  teamAbbrev: string | null;
  teamColor: string | null;
  teamLogo: string | null;
  headshot: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  classYear: string | null;
  birthPlace: string | null;
  experience: string | null;
  bio: string | null;
  status: string | null;
  seasonStats: { label: string; value: string }[];
  statCategories: { name: string; stats: { label: string; value: string }[] }[];
  seasonSplits: {
    season: string;
    categories: { name: string; stats: { label: string; value: string }[] }[];
  }[];
  gameLogCategories: {
    name: string;
    labels: string[];
    rows: {
      eventId: string | null;
      date: string | null;
      week: number | null;
      opponent: string;
      atVs: string | null;
      result: string;
      score: string | null;
      stats: { label: string; value: string }[];
    }[];
  }[];
  recentGames: { label: string; result: string; line: string }[];
  news: { headline: string; description: string; image: string | null; href: string | null }[];
};

function parseScore(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function chicagoDateFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/** Official Top 25 only — ESPN marks unranked teams as curatedRank=99. */
export function cfbPollRank(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw < 1 || raw > 25) return null;
  return raw;
}

let fpiRankCache: { map: Map<number, number>; fetchedAt: number } | null = null;
const FPI_CACHE_MS = 30 * 60 * 1000;

/** ESPN Football Power Index ranks for all FBS teams (ordinal 1…N). */
export async function fetchCfbFpiRanks(): Promise<Map<number, number>> {
  const now = Date.now();
  if (fpiRankCache && now - fpiRankCache.fetchedAt < FPI_CACHE_MS) {
    return fpiRankCache.map;
  }
  const map = new Map<number, number>();
  try {
    const url =
      "https://site.web.api.espn.com/apis/fitt/v3/sports/football/college-football/powerindex?limit=200";
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`FPI ${res.status}`);
    const data = (await res.json()) as {
      teams?: {
        team?: { id?: string };
        categories?: { name?: string; values?: number[]; names?: string[] }[];
      }[];
    };
    for (const row of data.teams ?? []) {
      const id = Number(row.team?.id);
      if (!id) continue;
      const fpi = (row.categories ?? []).find((c) => c.name === "fpi");
      if (!fpi?.values?.length) continue;
      const names = fpi.names ?? [];
      const rankIdx = names.indexOf("fpirank");
      const rankVal = rankIdx >= 0 ? fpi.values[rankIdx] : fpi.values[1];
      if (typeof rankVal === "number" && rankVal > 0) {
        map.set(id, Math.round(rankVal));
      }
    }
  } catch {
    /* keep empty — UI falls back to poll-only */
  }
  fpiRankCache = { map, fetchedAt: now };
  return map;
}

function mapCfbSituation(
  sit:
    | {
        downDistanceText?: string;
        possessionText?: string;
        yardLine?: number;
        isRedZone?: boolean;
        possession?: string;
        lastPlay?: { text?: string; team?: { id?: string } };
      }
    | null
    | undefined,
  live: boolean,
): CfbLiveSituation | null {
  if (!live || !sit) return null;
  return {
    downDistanceText: sit.downDistanceText ?? null,
    possessionText: sit.possessionText ?? null,
    yardLine: typeof sit.yardLine === "number" ? sit.yardLine : null,
    isRedZone: Boolean(sit.isRedZone),
    possessionTeamId: sit.possession ?? sit.lastPlay?.team?.id ?? null,
    lastPlayText: sit.lastPlay?.text ?? null,
  };
}

type EspnEvent = {
  id?: string;
  date?: string;
  competitions?: {
    venue?: { fullName?: string };
    status?: {
      period?: number;
      type?: {
        state?: string;
        completed?: boolean;
        description?: string;
        detail?: string;
        shortDetail?: string;
      };
    };
    broadcasts?: {
      market?: string | { type?: string };
      names?: string[];
      media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
    }[];
    geoBroadcasts?: {
      market?: { type?: string };
      media?: { shortName?: string; name?: string; logo?: string; darkLogo?: string };
    }[];
    competitors?: {
      homeAway?: string;
      score?: unknown;
      curatedRank?: { current?: number };
      records?: { type?: string; summary?: string }[];
      team?: {
        id?: string;
        displayName?: string;
        shortDisplayName?: string;
        abbreviation?: string;
        color?: string;
        logos?: { href?: string }[];
      };
    }[];
    situation?: Parameters<typeof mapCfbSituation>[0];
    odds?: {
      details?: string;
      spread?: number;
      overUnder?: number;
      provider?: { name?: string; displayName?: string };
      awayTeamOdds?: { favorite?: boolean; team?: { id?: string } };
      homeTeamOdds?: { favorite?: boolean; team?: { id?: string } };
    }[];
  }[];
};

type EspnCompetitor = {
  homeAway?: string;
  score?: unknown;
  curatedRank?: { current?: number };
  records?: { type?: string; summary?: string }[];
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
};

function sideFromCompetitor(
  c: EspnCompetitor,
  fpiByTeam?: Map<number, number>,
): CfbScoreSide {
  const team = c.team ?? {};
  const abbrev = team.abbreviation ?? "—";
  const overall = (c.records ?? []).find((r) => r.type === "total")?.summary ?? null;
  const teamId = Number(team.id) || 0;
  return {
    teamId,
    name: team.displayName ?? team.shortDisplayName ?? abbrev,
    abbrev,
    score: parseScore(c.score),
    record: overall,
    logo: team.logos?.[0]?.href ?? cfbTeamLogo(team.id ?? 0),
    color: (team.color ?? "555555").replace(/^#/, ""),
    rank: cfbPollRank(c.curatedRank?.current),
    fpiRank: teamId && fpiByTeam ? (fpiByTeam.get(teamId) ?? null) : null,
  };
}

function mapCfbOdds(
  odds:
    | {
        details?: string;
        spread?: number;
        overUnder?: number;
        provider?: { name?: string; displayName?: string };
        awayTeamOdds?: { favorite?: boolean; team?: { id?: string } };
        homeTeamOdds?: { favorite?: boolean; team?: { id?: string } };
      }[]
    | null
    | undefined,
): CfbGameOdds | null {
  const row = odds?.[0];
  if (!row) return null;
  const spread =
    typeof row.spread === "number" && Number.isFinite(row.spread) ? row.spread : null;
  const overUnder =
    typeof row.overUnder === "number" && Number.isFinite(row.overUnder)
      ? row.overUnder
      : null;
  let favoriteTeamId: number | null = null;
  if (row.homeTeamOdds?.favorite && row.homeTeamOdds.team?.id) {
    favoriteTeamId = Number(row.homeTeamOdds.team.id) || null;
  } else if (row.awayTeamOdds?.favorite && row.awayTeamOdds.team?.id) {
    favoriteTeamId = Number(row.awayTeamOdds.team.id) || null;
  } else if (spread != null) {
    // Home-centric spread fallback: negative ⇒ home favored.
    favoriteTeamId = null; // filled by caller with home/away ids if needed
  }
  if (!row.details && spread == null && overUnder == null) return null;
  return {
    details: row.details ?? null,
    spread,
    overUnder,
    favoriteTeamId,
    provider: row.provider?.displayName ?? row.provider?.name ?? null,
  };
}

function mapCfbEvent(
  event: EspnEvent,
  fpiByTeam?: Map<number, number>,
): CfbScoreGame | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;
  const awayC = comp.competitors?.find((c) => c.homeAway === "away");
  const homeC = comp.competitors?.find((c) => c.homeAway === "home");
  if (!awayC?.team?.id || !homeC?.team?.id) return null;
  const st = comp.status?.type;
  const live = st?.state === "in";
  const final = Boolean(st?.completed);
  const iso = event.date ?? null;
  const whenDate = iso ? new Date(iso) : null;
  const whenShort =
    whenDate && !Number.isNaN(whenDate.getTime())
      ? whenDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/Chicago",
          timeZoneName: "short",
        })
      : null;
  const periodRaw = comp.status?.period;
  const period =
    typeof periodRaw === "number" && Number.isFinite(periodRaw) && periodRaw > 0
      ? periodRaw
      : null;
  const odds = mapCfbOdds(comp.odds);
  if (odds && odds.favoriteTeamId == null && odds.spread != null) {
    odds.favoriteTeamId =
      odds.spread < 0
        ? Number(homeC.team.id) || null
        : odds.spread > 0
          ? Number(awayC.team.id) || null
          : null;
  }
  return {
    id: String(event.id ?? comp.status?.type?.detail ?? Math.random()),
    status: st?.description ?? st?.detail ?? "Scheduled",
    shortDetail: st?.shortDetail ?? st?.detail ?? null,
    live,
    final,
    away: sideFromCompetitor(awayC, fpiByTeam),
    home: sideFromCompetitor(homeC, fpiByTeam),
    when: iso ? formatSportsDateLong(iso) : null,
    whenShort,
    venue: comp.venue?.fullName ?? null,
    date: chicagoDateFromIso(iso),
    broadcasts: parseEspnBroadcasts(comp.geoBroadcasts, comp.broadcasts),
    period,
    situation: mapCfbSituation(comp.situation, live),
    odds,
  };
}

export async function fetchCfbScoreboard(dates?: string): Promise<CfbScoreGame[]> {
  const [fpiByTeam, boardRes] = await Promise.all([
    fetchCfbFpiRanks().catch(() => new Map<number, number>()),
    fetch(dates ? `${ESPN}/scoreboard?dates=${dates}` : `${ESPN}/scoreboard`, {
      headers: { Accept: "application/json" },
    }),
  ]);
  if (!boardRes.ok) throw new Error(`CFB scoreboard ${boardRes.status}`);
  const raw = (await boardRes.json()) as { events?: EspnEvent[] };
  return (raw.events ?? [])
    .map((e) => mapCfbEvent(e, fpiByTeam))
    .filter((g): g is CfbScoreGame => Boolean(g?.id));
}

function cfbArticleRelevantToGame(
  text: string,
  away: { name: string; abbrev: string },
  home: { name: string; abbrev: string },
): boolean {
  const blob = text.trim();
  if (!blob) return false;
  if (/fantasy|dfs|waiver|promo|presented by/i.test(blob)) return false;

  const mentions = (abbrev: string, name: string): boolean => {
    const nameLc = name.toLowerCase();
    const hay = blob.toLowerCase();
    if (nameLc.length >= 5 && hay.includes(nameLc)) return true;
    // "Hawai'i Rainbow Warriors" / "Stanford Cardinal" → location tokens
    const location = nameLc
      .replace(
        /\s+(rainbow warriors|cardinal|tigers|bulldogs|wildcats|eagles|bears|lions|panthers|knights|aggies|sooners|longhorns|buckeyes|wolverines|trojans|bruins|ducks|huskies|seminoles|gators|volunteers|commodores|razorbacks|crimson tide|fighting irish|yellow jackets|demon deacons|tar heels|wolfpack|cavaliers|hokies|orange|boilermakers|hoosiers|spartans|hawkeyes|badgers|gophers|nittany lions|terrapins|cornhuskers|jayhawks|cyclones|mountaineers|cougars|utes|buffaloes|sun devils|wildcats)\s*$/i,
        "",
      )
      .trim();
    if (location.length >= 4 && hay.includes(location)) return true;
    // Strip diacritics-ish apostrophes for Hawaii / Hawai'i
    const locFlat = location.replace(/['']/g, "");
    const hayFlat = hay.replace(/['']/g, "");
    if (locFlat.length >= 4 && hayFlat.includes(locFlat)) return true;
    const ab = abbrev.trim();
    if (ab.length >= 2) {
      const re = new RegExp(`\\b${ab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(blob)) return true;
    }
    return false;
  };

  return mentions(away.abbrev, away.name) || mentions(home.abbrev, home.name);
}

export async function fetchCfbGameDetail(eventId: string): Promise<CfbGameDetail> {
  const [fpiByTeam, res] = await Promise.all([
    fetchCfbFpiRanks().catch(() => new Map<number, number>()),
    fetch(`${ESPN}/summary?event=${encodeURIComponent(eventId)}`, {
      headers: { Accept: "application/json" },
    }),
  ]);
  if (!res.ok) throw new Error(`CFB summary ${res.status}`);
  const raw = (await res.json()) as {
    header?: {
      competitions?: (NonNullable<EspnEvent["competitions"]>[number] & {
        date?: string;
      })[];
      id?: string;
    };
    scoringPlays?: {
      id?: string;
      text?: string;
      clock?: { displayValue?: string };
      team?: { abbreviation?: string };
    }[];
    boxscore?: {
      teams?: {
        team?: { abbreviation?: string };
        statistics?: {
          name?: string;
          displayValue?: string;
          label?: string;
          abbreviation?: string;
        }[];
      }[];
      players?: {
        team?: { abbreviation?: string };
        statistics?: {
          name?: string;
          labels?: string[];
          athletes?: {
            athlete?: { id?: string; displayName?: string };
            stats?: string[];
          }[];
        }[];
      }[];
    };
    article?: {
      headline?: string;
      description?: string;
      story?: string;
      video?: EspnVideoRaw[];
    };
    news?:
      | { articles?: { headline?: string; description?: string; story?: string }[] }
      | { headline?: string; description?: string; story?: string }[];
    videos?: EspnVideoRaw[];
    pickcenter?: {
      details?: string;
      overUnder?: number;
      spread?: number;
    }[];
    odds?: { details?: string; overUnder?: number }[];
    predictor?: {
      homeTeam?: { gameProjection?: { winPercentage?: string } };
      awayTeam?: { gameProjection?: { winPercentage?: string } };
    };
    lastFiveGames?: {
      team?: { id?: string; abbreviation?: string };
      events?: {
        id?: string;
        gameDate?: string;
        score?: string;
        result?: string;
        opponent?: { abbreviation?: string; displayName?: string };
      }[];
    }[];
    gameInfo?: {
      venue?: { fullName?: string; address?: { city?: string; state?: string } };
      weather?: { displayValue?: string; temperature?: number };
    };
  };

  const headerComp = raw.header?.competitions?.[0];
  let boardCache: CfbScoreGame[] | null = null;
  const loadBoard = async (dates?: string | null) => {
    if (!boardCache) {
      boardCache = await fetchCfbScoreboard(dates || undefined).catch(
        () => [] as CfbScoreGame[],
      );
    }
    return boardCache;
  };

  let base = headerComp
    ? mapCfbEvent(
        {
          id: eventId,
          date: headerComp.date,
          competitions: raw.header?.competitions,
        },
        fpiByTeam,
      )
    : null;
  if (!base) {
    // Fallback: current week board (may miss older/future events).
    const board = await loadBoard();
    base = board.find((g) => g.id === String(eventId)) ?? null;
  }
  if (!base) throw new Error("CFB game not found");

  // Summary header sometimes omits TV; scoreboard usually has it.
  if (!base.broadcasts.length) {
    const board = await loadBoard(base.date);
    const fromBoard = board.find((g) => g.id === String(eventId));
    if (fromBoard?.broadcasts.length) {
      base = { ...base, broadcasts: fromBoard.broadcasts };
    }
  }

  const boxGroups: CfbBoxStatGroup[] = [];
  for (const side of raw.boxscore?.players ?? []) {
    const abbrev = side.team?.abbreviation ?? "—";
    for (const group of side.statistics ?? []) {
      const gname = group.name ?? "stats";
      const labels = group.labels ?? [];
      const athletes: CfbBoxPlayerRow[] = [];
      for (const row of group.athletes ?? []) {
        const id = row.athlete?.id;
        if (!id) continue;
        athletes.push({
          id: String(id),
          name: row.athlete?.displayName ?? "—",
          stats: row.stats ?? [],
        });
      }
      if (athletes.length) {
        boxGroups.push({ teamAbbrev: abbrev, name: gname, labels, athletes });
      }
    }
  }

  const teamStats: CfbTeamGameStat[] = [];
  for (const side of raw.boxscore?.teams ?? []) {
    const abbrev = side.team?.abbreviation ?? "—";
    for (const s of side.statistics ?? []) {
      const label = s.label ?? s.abbreviation ?? s.name ?? "Stat";
      const value = s.displayValue ?? "—";
      if (!value || value === "—") continue;
      teamStats.push({ teamAbbrev: abbrev, label, value });
    }
  }

  const newsArticles = Array.isArray(raw.news)
    ? raw.news
    : (raw.news?.articles ?? []);

  const candidates = [
    raw.article,
    ...newsArticles,
  ].filter((a): a is NonNullable<typeof a> => Boolean(a?.headline));

  const articleRaw =
    candidates.find((a) =>
      cfbArticleRelevantToGame(
        `${a.headline ?? ""} ${a.description ?? ""}`,
        base.away,
        base.home,
      ),
    ) ?? null;

  const pick = raw.pickcenter?.[0] ?? raw.odds?.[0];
  const oddsLine = pick?.details
    ? `${pick.details}${pick.overUnder != null ? ` · O/U ${pick.overUnder}` : ""}`
    : null;

  const winPct = (rawPct: string | undefined) => {
    if (!rawPct) return null;
    const n = Number(rawPct);
    if (!Number.isFinite(n)) return null;
    return n <= 1 ? Math.round(n * 100) : Math.round(n);
  };
  const predictor =
    raw.predictor?.homeTeam || raw.predictor?.awayTeam
      ? {
          homeWinPct: winPct(raw.predictor.homeTeam?.gameProjection?.winPercentage),
          awayWinPct: winPct(raw.predictor.awayTeam?.gameProjection?.winPercentage),
        }
      : null;

  const lastFive = (raw.lastFiveGames ?? []).map((side) => ({
    teamId: Number(side.team?.id) || 0,
    teamAbbrev: side.team?.abbreviation ?? "—",
    results: (side.events ?? []).slice(0, 5).map((e) => ({
      label: e.opponent?.abbreviation ?? e.opponent?.displayName ?? "Opp",
      result: e.result ?? "—",
      score: e.score ?? null,
    })),
  }));

  const venueBits = [
    raw.gameInfo?.venue?.fullName || base.venue,
    raw.gameInfo?.venue?.address
      ? [raw.gameInfo.venue.address.city, raw.gameInfo.venue.address.state]
          .filter(Boolean)
          .join(", ")
      : null,
    raw.gameInfo?.weather?.displayValue
      ? `${raw.gameInfo.weather.temperature ?? ""}${
          raw.gameInfo.weather.temperature != null ? "° " : ""
        }${raw.gameInfo.weather.displayValue}`.trim()
      : null,
  ].filter(Boolean);

  const videoById = new Map<string, CfbGameVideo>();
  for (const rawVid of [...(raw.article?.video ?? []), ...(raw.videos ?? [])]) {
    const mapped = mapEspnGameVideo(rawVid);
    if (!mapped || videoById.has(mapped.id)) continue;
    videoById.set(mapped.id, mapped);
  }
  const videos = [...videoById.values()];
  const recapVideo = pickCfbRecapVideo(videos);

  return {
    ...base,
    venue: base.venue ?? raw.gameInfo?.venue?.fullName ?? null,
    scoringPlays: (raw.scoringPlays ?? []).map((s) => ({
      id: String(s.id ?? Math.random()),
      text: s.text ?? "",
      clock: s.clock?.displayValue ?? null,
      teamAbbrev: s.team?.abbreviation ?? null,
    })),
    boxGroups,
    teamStats,
    article: articleRaw?.headline
      ? {
          headline: articleRaw.headline,
          description: articleRaw.description ?? null,
          storyHtml: articleRaw.story ?? null,
        }
      : null,
    recapVideo,
    videos,
    oddsLine,
    predictor,
    lastFive,
    venueDetail: venueBits.length ? venueBits.join(" · ") : null,
  };
}

export type CfbTeamWinTrendPoint = {
  season: number;
  wins: number;
  losses: number;
};

export type CfbTeamScheduleGame = {
  id: string;
  week: number | null;
  date: string | null;
  dateLabel: string | null;
  name: string;
  shortName: string;
  status: string;
  shortDetail: string | null;
  live: boolean;
  final: boolean;
  home: boolean;
  teamScore: number | null;
  oppScore: number | null;
  oppId: string | null;
  oppName: string;
  oppAbbrev: string;
  oppLogo: string | null;
  oppRank: number | null;
  won: boolean | null;
};

export type CfbTeamPage = {
  id: string;
  name: string;
  abbrev: string;
  color: string;
  logo: string | null;
  record: string | null;
  standing: string | null;
  conference: string | null;
  fpiRank: number | null;
  nextEvent: { id: string; name: string; date: string | null } | null;
  roster: {
    id: string;
    name: string;
    number: string | null;
    position: string | null;
    headshot: string | null;
  }[];
  schedule: CfbTeamScheduleGame[];
  coaches: CfbTeamStaffMember[];
  /** Where assistant/coordinator names came from (Wikipedia season page, etc.). */
  staffSource: string | null;
  winTrend: CfbTeamWinTrendPoint[];
  recent: CfbScoreGame[];
};

export type CfbConference = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
};

export type CfbStandingRow = {
  teamId: string;
  name: string;
  abbrev: string;
  logo: string | null;
  overall: string | null;
  conference: string | null;
  pointsFor: string | null;
  pointsAgainst: string | null;
  streak: string | null;
};

export type CfbPollEntry = {
  rank: number;
  previous: number | null;
  points: number | null;
  firstPlaceVotes: number | null;
  record: string | null;
  trend: string | null;
  teamId: string;
  name: string;
  abbrev: string;
  logo: string | null;
};

export type CfbPollBoard = {
  id: string;
  name: string;
  shortName: string;
  entries: CfbPollEntry[];
};

export type CfbLeaderRow = {
  rank: number;
  value: string;
  athleteId: string;
  athleteName: string;
  athleteHeadshot: string | null;
  position: string | null;
  teamId: string | null;
  teamAbbrev: string | null;
  teamLogo: string | null;
};

export type CfbLeaderCategory = {
  id: string;
  name: string;
  displayName: string;
  leaders: CfbLeaderRow[];
};

const FBS_CONFERENCE_LABELS: Record<string, string> = {
  "151": "American",
  "1": "ACC",
  "4": "Big 12",
  "5": "Big Ten",
  "12": "CUSA",
  "18": "Independents",
  "15": "MAC",
  "17": "Mountain West",
  "9": "Pac-12",
  "8": "SEC",
  "37": "Sun Belt",
};

function parseEspnScore(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return null;
}

function standingStat(
  stats: { name?: string; abbreviation?: string; displayValue?: string }[] | undefined,
  ...names: string[]
): string | null {
  for (const s of stats ?? []) {
    const key = (s.name ?? "").toLowerCase();
    const abbr = (s.abbreviation ?? "").toLowerCase();
    if (names.some((n) => key === n.toLowerCase() || abbr === n.toLowerCase())) {
      return s.displayValue ?? null;
    }
  }
  return null;
}

export async function fetchCfbConferences(): Promise<CfbConference[]> {
  const res = await fetch(
    "https://site.api.espn.com/apis/v2/sports/football/college-football/standings",
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`CFB conferences ${res.status}`);
  const raw = (await res.json()) as {
    children?: {
      id?: string | number;
      name?: string;
      shortName?: string;
      abbreviation?: string;
    }[];
  };
  return (raw.children ?? [])
    .map((c) => ({
      id: String(c.id ?? ""),
      name: c.name ?? "Conference",
      shortName: c.shortName ?? c.name ?? "Conference",
      abbreviation: (c.abbreviation ?? c.shortName ?? c.name ?? "—").toUpperCase(),
    }))
    .filter((c) => c.id);
}

export async function fetchCfbConferenceStandings(
  groupId: string,
): Promise<{ conference: CfbConference; rows: CfbStandingRow[] }> {
  const res = await fetch(
    `https://site.api.espn.com/apis/v2/sports/football/college-football/standings?group=${encodeURIComponent(groupId)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`CFB standings ${res.status}`);
  const raw = (await res.json()) as {
    id?: string | number;
    name?: string;
    shortName?: string;
    abbreviation?: string;
    standings?: {
      entries?: {
        team?: {
          id?: string;
          displayName?: string;
          abbreviation?: string;
          logos?: { href?: string }[];
        };
        stats?: { name?: string; abbreviation?: string; displayValue?: string }[];
      }[];
    };
  };
  const conference: CfbConference = {
    id: String(raw.id ?? groupId),
    name: raw.name ?? "Conference",
    shortName: raw.shortName ?? raw.name ?? "Conference",
    abbreviation: (raw.abbreviation ?? raw.shortName ?? "—").toUpperCase(),
  };
  const rows: CfbStandingRow[] = [];
  for (const e of raw.standings?.entries ?? []) {
    const team = e.team ?? {};
    if (!team.id) continue;
    rows.push({
      teamId: String(team.id),
      name: team.displayName ?? "—",
      abbrev: (team.abbreviation ?? "—").toUpperCase(),
      logo: team.logos?.[0]?.href ?? cfbTeamLogo(team.id),
      overall: standingStat(e.stats, "overall"),
      conference: standingStat(e.stats, "vs. Conf.", "CONF", "vs Conf"),
      pointsFor: standingStat(e.stats, "pointsFor", "PF"),
      pointsAgainst: standingStat(e.stats, "pointsAgainst", "PA"),
      streak: standingStat(e.stats, "streak", "STRK"),
    });
  }
  return { conference, rows };
}

export async function fetchCfbPolls(): Promise<CfbPollBoard[]> {
  const res = await fetch(`${ESPN}/rankings`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CFB rankings ${res.status}`);
  const raw = (await res.json()) as {
    rankings?: {
      id?: string | number;
      name?: string;
      shortName?: string;
      ranks?: {
        current?: number;
        previous?: number;
        points?: number;
        firstPlaceVotes?: number;
        recordSummary?: string;
        trend?: string;
        team?: {
          id?: string;
          abbreviation?: string;
          displayName?: string;
          location?: string;
          logos?: { href?: string }[];
        };
      }[];
    }[];
  };
  const boards: CfbPollBoard[] = [];
  for (const poll of raw.rankings ?? []) {
    const entries: CfbPollEntry[] = [];
    for (const r of poll.ranks ?? []) {
      const team = r.team ?? {};
      if (!team.id || r.current == null) continue;
      entries.push({
        rank: r.current,
        previous: typeof r.previous === "number" ? r.previous : null,
        points: typeof r.points === "number" ? r.points : null,
        firstPlaceVotes:
          typeof r.firstPlaceVotes === "number" ? r.firstPlaceVotes : null,
        record: r.recordSummary ?? null,
        trend: r.trend ?? null,
        teamId: String(team.id),
        name: team.displayName ?? team.location ?? "—",
        abbrev: (team.abbreviation ?? "—").toUpperCase(),
        logo: team.logos?.[0]?.href ?? cfbTeamLogo(team.id),
      });
    }
    if (!entries.length) continue;
    boards.push({
      id: String(poll.id ?? poll.shortName ?? poll.name ?? boards.length),
      name: poll.name ?? "Poll",
      shortName: poll.shortName ?? poll.name ?? "Poll",
      entries,
    });
  }
  return boards;
}

export async function fetchCfbLeaders(season?: number): Promise<{
  season: number;
  categories: CfbLeaderCategory[];
}> {
  const year = season ?? new Date().getFullYear();
  const tryYears = [year, year - 1];
  for (const y of tryYears) {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v3/sports/football/college-football/leaders?season=${y}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) continue;
    const raw = (await res.json()) as {
      leaders?: {
        categories?: {
          name?: string;
          displayName?: string;
          leaders?: {
            displayValue?: string;
            athlete?: {
              id?: string;
              displayName?: string;
              headshot?: { href?: string };
              position?: { abbreviation?: string };
            };
            team?: {
              id?: string;
              abbreviation?: string;
              logos?: { href?: string }[];
            };
          }[];
        }[];
      };
    };
    const categories: CfbLeaderCategory[] = [];
    for (const cat of raw.leaders?.categories ?? []) {
      const leaders: CfbLeaderRow[] = [];
      (cat.leaders ?? []).forEach((row, idx) => {
        const a = row.athlete ?? {};
        if (!a.id) return;
        const team = row.team ?? {};
        leaders.push({
          rank: idx + 1,
          value: row.displayValue ?? "—",
          athleteId: String(a.id),
          athleteName: a.displayName ?? "—",
          athleteHeadshot: a.headshot?.href ?? cfbHeadshot(a.id, 200),
          position: a.position?.abbreviation ?? null,
          teamId: team.id ? String(team.id) : null,
          teamAbbrev: team.abbreviation ? team.abbreviation.toUpperCase() : null,
          teamLogo: team.logos?.[0]?.href ?? (team.id ? cfbTeamLogo(team.id) : null),
        });
      });
      if (!leaders.length) continue;
      categories.push({
        id: cat.name ?? cat.displayName ?? String(categories.length),
        name: cat.name ?? "stat",
        displayName: cat.displayName ?? cat.name ?? "Leaders",
        leaders,
      });
    }
    if (categories.length) return { season: y, categories };
  }
  return { season: year, categories: [] };
}

function stripWikiMarkup(raw: string): string {
  return raw
    .replace(/\{\{tooltip\|([^|}]+)\|([^}]+)\}\}/gi, "$1 ($2)")
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/\[\[[^|\]]*\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s*\(interim\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wikiFootballSeasonTitle(teamDisplayName: string, year: number): string {
  return `${year}_${teamDisplayName.replace(/\s+/g, "_")}_football_team`;
}

function parseWikiStaffLine(line: string): { name: string; title: string } | null {
  const cleaned = line.replace(/^\*\s*/, "").trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/\s+[–\-—]\s+/);
  const name = stripWikiMarkup(parts[0] ?? "");
  if (!name || /^reference:/i.test(name)) return null;
  let title = parts.length > 1 ? stripWikiMarkup(parts.slice(1).join(" – ")) : "Assistant coach";
  title = title.replace(/^'+|'+$/g, "").trim() || "Assistant coach";
  return { name, title };
}

function parseWikiRosterFooterStaff(wt: string): { title: string; name: string }[] {
  const footer = wt.match(
    /\{\{American football roster\/Footer[\s\S]*?\n\}\}/i,
  )?.[0];
  if (!footer) return [];
  const out: { title: string; name: string }[] = [];
  const seen = new Set<string>();

  const push = (name: string, title: string) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push({ name, title });
  };

  const hcBlock = footer.match(/\|head_coach\s*=\s*([\s\S]*?)(?=\n\|[a-z_]+\s*=|\n\}\})/i)?.[1] ?? "";
  for (const line of hcBlock.split("\n")) {
    if (!/^\*/.test(line.trim())) continue;
    const row = parseWikiStaffLine(line.trim());
    if (row) push(row.name, "Head coach");
  }

  const asstBlock =
    footer.match(/\|asst_coach\s*=\s*([\s\S]*?)(?=\n\|[a-z_]+\s*=|\n\}\})/i)?.[1] ?? "";
  for (const line of asstBlock.split("\n")) {
    if (!/^\*/.test(line.trim())) continue;
    const row = parseWikiStaffLine(line.trim());
    if (row) push(row.name, row.title);
  }
  return out;
}

function parseWikiCoachingStaffTable(wt: string): { title: string; name: string }[] {
  const section = wt.match(
    /==+\s*Coaching staff\s*==+([\s\S]*?)(?=\n==+|\n\{\{Reflist|\n\[\[Category:)/i,
  )?.[1];
  if (!section || !/\{\|/.test(section)) return [];
  const out: { title: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const row of section.split(/\n\|-\s*\n/)) {
    const cells = [...row.matchAll(/\|{1,2}\s*([^|\n]+)/g)].map((m) =>
      stripWikiMarkup(m[1] ?? ""),
    );
    if (cells.length < 2) continue;
    const name = cells[0]?.replace(/^align=center\|/i, "").trim() ?? "";
    const title = cells[1]?.replace(/^align=center\|/i, "").trim() ?? "";
    if (!name || !title) continue;
    if (/^name$/i.test(name) || /^position$/i.test(title)) continue;
    if (/reference:/i.test(name) || /colspan/i.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, title });
  }
  return out;
}

function parseWikiInfoboxCoaches(wt: string): { title: string; name: string }[] {
  const roles: { key: string; title: string }[] = [
    { key: "head_coach", title: "Head coach" },
    { key: "off_coach", title: "Offensive coordinator" },
    { key: "def_coach", title: "Defensive coordinator" },
    { key: "special_teams_coach", title: "Special teams coordinator" },
    { key: "st_coach", title: "Special teams coordinator" },
  ];
  const out: { title: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const role of roles) {
    const m = wt.match(new RegExp(`\\|\\s*${role.key}\\s*=\\s*(.+)`, "i"));
    if (!m) continue;
    const name = stripWikiMarkup(m[1] ?? "");
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ title: role.title, name });
  }
  return out;
}

/**
 * Assistant / coordinator names from the team's Wikipedia season page.
 * Prefers the roster Footer staff list or Coaching staff table; falls back to infobox.
 * Tries current + prior season and keeps the richest staff list.
 */
async function fetchWikiCoachingStaff(
  teamDisplayName: string,
): Promise<{ title: string; name: string; source: string }[]> {
  const year = new Date().getFullYear();
  const titles = [
    wikiFootballSeasonTitle(teamDisplayName, year),
    wikiFootballSeasonTitle(teamDisplayName, year - 1),
  ];
  let best: { title: string; name: string; source: string }[] = [];

  for (const page of titles) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&origin=*`,
        {
          headers: {
            Accept: "application/json",
            "Api-User-Agent": "CommandCenterCFB/1.0 (sports dashboard; local)",
          },
        },
      );
      if (!res.ok) continue;
      const raw = (await res.json()) as {
        error?: unknown;
        parse?: { wikitext?: { ["*"]?: string } };
      };
      if (raw.error) continue;
      const wt = raw.parse?.wikitext?.["*"] ?? "";
      if (!wt) continue;

      const source = `Wikipedia · ${page.replace(/_/g, " ")}`;
      let rows: { title: string; name: string }[] = parseWikiRosterFooterStaff(wt);
      if (rows.length < 2) rows = parseWikiCoachingStaffTable(wt);
      if (rows.length < 2) rows = parseWikiInfoboxCoaches(wt);
      if (!rows.length) continue;
      const mapped = rows.map((r) => ({ ...r, source }));
      if (mapped.length > best.length) best = mapped;
    } catch {
      /* try next year */
    }
  }
  return best;
}

function parseWikiInfoboxCareerPath(wikitext: string): CfbCoachCareerStop[] {
  const stops: CfbCoachCareerStop[] = [];
  const push = (kind: "playing" | "coaching", yearsRaw: string, detailRaw: string) => {
    const years = stripWikiMarkup(yearsRaw);
    const detail = stripWikiMarkup(detailRaw);
    if (!years || !detail) return;
    stops.push({ years, detail, kind });
  };
  for (const m of wikitext.matchAll(/\| *player_years(\d+) *= *([^\n]+)/gi)) {
    const n = m[1]!;
    const team = wikitext.match(new RegExp(`\\| *player_team${n} *= *([^\\n]+)`, "i"))?.[1] ?? "";
    const pos = wikitext.match(new RegExp(`\\| *player_positions *= *([^\\n]+)`, "i"))?.[1];
    const detail = pos && n === "1" ? `${team} (${pos})` : team;
    push("playing", m[2]!, detail);
  }
  for (const m of wikitext.matchAll(/\| *coach_years(\d+) *= *([^\n]+)/gi)) {
    const n = m[1]!;
    const team = wikitext.match(new RegExp(`\\| *coach_team${n} *= *([^\\n]+)`, "i"))?.[1] ?? "";
    push("coaching", m[2]!, team);
  }
  return stops;
}

type WikiFootballCoachCard = {
  title: string;
  extract: string | null;
  image: string | null;
  url: string;
  careerPath: CfbCoachCareerStop[];
  birthDate: string | null;
  birthPlace: string | null;
};

function cleanWikiImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/[?&]utm_[^&]+/g, "").replace(/\?$/, "").trim() || null;
}

async function wikiSearchFootballCoachTitle(name: string): Promise<string | null> {
  try {
    const api = new URL("https://en.wikipedia.org/w/api.php");
    api.searchParams.set("action", "query");
    api.searchParams.set("list", "search");
    api.searchParams.set("srsearch", `${name} American football coach`);
    api.searchParams.set("srlimit", "8");
    api.searchParams.set("format", "json");
    api.searchParams.set("origin", "*");
    const res = await fetch(api.toString(), {
      headers: { Accept: "application/json", "User-Agent": "CommandCenter/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { search?: { title?: string; snippet?: string }[] };
    };
    const last = name.split(/\s+/).slice(-1)[0]?.toLowerCase() ?? "";
    const first = name.split(/\s+/)[0]?.toLowerCase() ?? "";
    const hits = (data.query?.search ?? []).filter((h) => {
      const t = (h.title ?? "").toLowerCase();
      if (/^list of\b/i.test(t)) return false;
      if (/\b(disambiguation|album|film|song)\b/i.test(t)) return false;
      return t.includes(last);
    });
    const prefer =
      hits.find((h) => /american football coach/i.test(h.title ?? "")) ??
      hits.find((h) => /\bfootball coach\b/i.test(h.title ?? "")) ??
      hits.find((h) => {
        const t = (h.title ?? "").toLowerCase();
        return t.startsWith(first) && t.includes(last);
      }) ??
      hits.find((h) =>
        /coach|football/i.test(`${h.title ?? ""} ${h.snippet ?? ""}`),
      ) ??
      hits[0];
    return prefer?.title ?? null;
  } catch {
    return null;
  }
}

async function fetchWikiFootballCoachCard(name: string): Promise<WikiFootballCoachCard | null> {
  const titles = [
    `${name.trim()} (American football coach)`,
    `${name.trim()} (football coach)`,
    name.trim(),
  ];
  const searched = await wikiSearchFootballCoachTitle(name);
  if (searched && !titles.includes(searched)) titles.unshift(searched);

  for (const title of titles) {
    try {
      const api = new URL("https://en.wikipedia.org/w/api.php");
      api.searchParams.set("action", "query");
      api.searchParams.set("titles", title);
      api.searchParams.set("prop", "pageimages|extracts|info");
      api.searchParams.set("inprop", "url");
      api.searchParams.set("exintro", "1");
      api.searchParams.set("explaintext", "1");
      api.searchParams.set("pithumbsize", "640");
      api.searchParams.set("pilicense", "any");
      api.searchParams.set("format", "json");
      api.searchParams.set("redirects", "1");
      api.searchParams.set("origin", "*");
      const res = await fetch(api.toString(), {
        headers: { Accept: "application/json", "User-Agent": "CommandCenter/1.0" },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              missing?: boolean;
              title?: string;
              extract?: string;
              fullurl?: string;
              thumbnail?: { source?: string };
              original?: { source?: string };
            }
          >;
        };
      };
      const page = Object.values(data.query?.pages ?? {})[0];
      if (!page || page.missing) continue;
      const extract = page.extract?.trim() || null;
      if (extract && /may refer to:/i.test(extract)) continue;
      if (extract && /^this is a list of\b/i.test(extract)) continue;
      if (!extract && !page.thumbnail && !page.original) continue;
      // Reject list / index pages that slipped through search.
      if (/^list of\b/i.test(page.title ?? title)) continue;
      const lastName = name.split(/\s+/).slice(-1)[0] ?? "";
      if (
        lastName.length > 2 &&
        extract &&
        !new RegExp(`\\b${lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
          extract,
        )
      ) {
        continue;
      }

      let careerPath: CfbCoachCareerStop[] = [];
      let birthDate: string | null = null;
      let birthPlace: string | null = null;
      try {
        const parseRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page.title ?? title)}&prop=wikitext&format=json&origin=*`,
          { headers: { Accept: "application/json", "User-Agent": "CommandCenter/1.0" } },
        );
        if (parseRes.ok) {
          const parsed = (await parseRes.json()) as {
            parse?: { wikitext?: { ["*"]?: string } };
          };
          const wt = parsed.parse?.wikitext?.["*"] ?? "";
          careerPath = parseWikiInfoboxCareerPath(wt);
          const bd = wt.match(/\| *birth_date *= *([^\n]+)/i)?.[1];
          const bp = wt.match(/\| *birth_place *= *([^\n]+)/i)?.[1];
          if (bd) {
            const m = bd.match(/(\d{4})\|(\d{1,2})\|(\d{1,2})/);
            if (m) {
              birthDate = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
                .toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                });
            } else {
              const cleaned = stripWikiMarkup(bd);
              if (cleaned && !/\{\{/.test(cleaned)) birthDate = cleaned;
            }
          }
          if (bp) birthPlace = stripWikiMarkup(bp) || null;
        }
      } catch {
        /* extract-only is fine */
      }

      return {
        title: page.title ?? title,
        extract,
        image: cleanWikiImageUrl(page.original?.source ?? page.thumbnail?.source),
        url:
          page.fullurl ??
          `https://en.wikipedia.org/wiki/${encodeURIComponent((page.title ?? title).replace(/ /g, "_"))}`,
        careerPath,
        birthDate,
        birthPlace,
      };
    } catch {
      /* try next title */
    }
  }
  return null;
}

function formatCoachBirthPlace(raw: {
  city?: string;
  state?: string;
  country?: string;
} | null | undefined): string | null {
  if (!raw) return null;
  const bits = [raw.city, raw.state, raw.country === "USA" ? null : raw.country].filter(Boolean);
  return bits.length ? bits.join(", ") : null;
}

function formatCoachDob(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function searchEspnCoachHeadshot(
  name: string,
): Promise<{ id: string | null; headshot: string | null }> {
  try {
    const res = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/search?region=us&lang=en&limit=8&query=${encodeURIComponent(name)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return { id: null, headshot: null };
    const data = (await res.json()) as {
      items?: {
        id?: string;
        displayName?: string;
        type?: string;
        headshot?: { href?: string };
      }[];
    };

    const last = name.split(/\s+/).slice(-1)[0]?.toLowerCase() ?? "";
    const hit =
      (data.items ?? []).find(
        (it) =>
          /coach|person|athlete/i.test(it.type ?? "") &&
          (it.displayName ?? "").toLowerCase().includes(last),
      ) ?? (data.items ?? []).find((it) => /coach|person/i.test(it.type ?? ""));
    if (!hit) return { id: null, headshot: null };
    // Never invent player-CDN URLs for coaches — those 404 and break the UI.
    return {
      id: hit.id ? String(hit.id) : null,
      headshot: hit.headshot?.href ?? null,
    };
  } catch {
    return { id: null, headshot: null };
  }
}

export async function fetchCfbTeamWinTrend(
  teamId: string | number,
  seasons = 5,
): Promise<CfbTeamWinTrendPoint[]> {
  const id = String(teamId);
  const end = new Date().getFullYear() - 1;
  const years = Array.from({ length: seasons }, (_, i) => end - seasons + 1 + i);
  const points = await Promise.all(
    years.map(async (season) => {
      try {
        const res = await fetch(
          `${CORE}/seasons/${season}/types/2/teams/${id}/records/0?lang=en&region=us`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) return null;
        const raw = (await res.json()) as {
          summary?: string;
          stats?: { name?: string; value?: number }[];
        };
        const winsStat = raw.stats?.find((s) => s.name === "wins")?.value;
        const lossesStat = raw.stats?.find((s) => s.name === "losses")?.value;
        let wins =
          typeof winsStat === "number" && Number.isFinite(winsStat) ? Math.round(winsStat) : null;
        let losses =
          typeof lossesStat === "number" && Number.isFinite(lossesStat)
            ? Math.round(lossesStat)
            : null;
        if (wins == null || losses == null) {
          const m = (raw.summary ?? "").match(/^(\d+)\s*-\s*(\d+)/);
          if (!m) return null;
          wins = Number(m[1]);
          losses = Number(m[2]);
        }
        return { season, wins, losses } satisfies CfbTeamWinTrendPoint;
      } catch {
        return null;
      }
    }),
  );
  return points.filter((p): p is CfbTeamWinTrendPoint => Boolean(p));
}

function staffTitleRank(title: string): number {
  const t = title.toLowerCase();
  if (/^head coach$/.test(t)) return 0;
  if (/offensive coordinator/.test(t)) return 1;
  if (/defensive coordinator/.test(t)) return 2;
  if (/special teams/.test(t)) return 3;
  if (/coordinator/.test(t)) return 4;
  if (/analyst|graduate assistant|quality control|strength|performance/.test(t)) return 80;
  return 20;
}

async function buildCfbCoachingStaff(opts: {
  teamId: string;
  teamName: string;
  rosterCoaches: { id: string; name: string }[];
}): Promise<{ coaches: CfbTeamStaffMember[]; staffSource: string | null }> {
  const wikiStaff = await fetchWikiCoachingStaff(opts.teamName).catch(() => []);
  const byName = new Map<string, CfbTeamStaffMember>();
  let staffSource: string | null = wikiStaff[0]?.source ?? null;

  const upsert = (row: CfbTeamStaffMember) => {
    const key = row.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, row);
      return;
    }
    const preferNewTitle =
      staffTitleRank(row.title) < staffTitleRank(prev.title) ||
      (prev.title === "Coach" && row.title !== "Coach") ||
      (prev.title === "Assistant coach" && row.title !== "Assistant coach");
    byName.set(key, {
      id: prev.linkable ? prev.id : row.linkable ? row.id : prev.id,
      name: prev.name,
      title: preferNewTitle ? row.title : prev.title,
      headshot: prev.headshot ?? row.headshot,
      linkable: prev.linkable || row.linkable,
      bio: prev.bio ?? row.bio ?? null,
    });
  };

  for (const c of opts.rosterCoaches) {
    upsert({
      id: c.id,
      name: c.name,
      title: "Head coach",
      headshot: null,
      linkable: true,
    });
  }

  // Cap ESPN headshot lookups — full staff lists can be 15+ names.
  const toSearch = wikiStaff.filter(
    (w) => !opts.rosterCoaches.some((c) => c.name.toLowerCase() === w.name.toLowerCase()),
  );
  const searchChunk = 6;
  for (let i = 0; i < toSearch.length; i += searchChunk) {
    const chunk = toSearch.slice(i, i + searchChunk);
    await Promise.all(
      chunk.map(async (w) => {
        const searched = await searchEspnCoachHeadshot(w.name);
        upsert({
          id: searched.id ?? `name:${w.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name: w.name,
          title: w.title,
          headshot: searched.headshot,
          linkable: Boolean(searched.id),
        });
      }),
    );
  }

  for (const w of wikiStaff) {
    const rosterHit = opts.rosterCoaches.find(
      (c) => c.name.toLowerCase() === w.name.toLowerCase(),
    );
    if (!rosterHit) continue;
    upsert({
      id: rosterHit.id,
      name: rosterHit.name,
      title: w.title,
      headshot: null,
      linkable: true,
    });
  }

  const coaches = [...byName.values()].sort(
    (a, b) =>
      staffTitleRank(a.title) - staffTitleRank(b.title) || a.name.localeCompare(b.name),
  );
  if (!coaches.length) staffSource = null;
  else if (!staffSource && opts.rosterCoaches.length) staffSource = "ESPN roster";
  return { coaches, staffSource };
}

export async function fetchCfbTeamPage(teamId: string): Promise<CfbTeamPage> {
  const id = String(teamId);
  const [fpiByTeam, teamRes, rosterRes, scheduleRes] = await Promise.all([
    fetchCfbFpiRanks().catch(() => new Map<number, number>()),
    fetch(`${ESPN}/teams/${id}`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN}/teams/${id}/roster`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN}/teams/${id}/schedule`, { headers: { Accept: "application/json" } }),
  ]);
  if (!teamRes.ok) throw new Error(`CFB team ${teamRes.status}`);
  const teamJson = (await teamRes.json()) as {
    team?: {
      id?: string;
      displayName?: string;
      abbreviation?: string;
      color?: string;
      logos?: { href?: string }[];
      record?: { items?: { type?: string; summary?: string }[] };
      standingSummary?: string;
      groups?: {
        id?: string | number;
        isConference?: boolean;
        name?: string;
        parent?: { id?: string | number; name?: string };
      };
      nextEvent?: { id?: string; name?: string; date?: string }[];
    };
  };
  const t = teamJson.team ?? {};
  const roster: CfbTeamPage["roster"] = [];
  const rosterCoaches: { id: string; name: string }[] = [];
  if (rosterRes.ok) {
    const rosterJson = (await rosterRes.json()) as {
      athletes?: {
        items?: {
          id?: string;
          displayName?: string;
          jersey?: string;
          position?: { abbreviation?: string };
          headshot?: { href?: string };
        }[];
      }[];
      coach?: { id?: string; firstName?: string; lastName?: string; displayName?: string }[];
    };
    for (const group of rosterJson.athletes ?? []) {
      for (const a of group.items ?? []) {
        if (!a.id) continue;
        roster.push({
          id: String(a.id),
          name: a.displayName ?? "—",
          number: a.jersey ?? null,
          position: a.position?.abbreviation ?? null,
          headshot: a.headshot?.href ?? cfbHeadshot(a.id, 200),
        });
      }
    }
    for (const c of rosterJson.coach ?? []) {
      if (!c.id) continue;
      const name =
        c.displayName?.trim() ||
        [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
        "Coach";
      rosterCoaches.push({ id: String(c.id), name });
    }
  }

  const teamName = t.displayName ?? "Team";
  const [staffPack, winTrend] = await Promise.all([
    buildCfbCoachingStaff({ teamId: id, teamName, rosterCoaches }),
    fetchCfbTeamWinTrend(id, 5).catch(() => [] as CfbTeamWinTrendPoint[]),
  ]);
  const coaches = staffPack.coaches;
  const staffSource = staffPack.staffSource;

  const schedule: CfbTeamScheduleGame[] = [];
  if (scheduleRes.ok) {
    const schedJson = (await scheduleRes.json()) as {
      events?: {
        id?: string;
        date?: string;
        name?: string;
        shortName?: string;
        week?: { number?: number } | number;
        competitions?: {
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
            score?: unknown;
            winner?: boolean;
            curatedRank?: { current?: number };
            team?: {
              id?: string;
              displayName?: string;
              abbreviation?: string;
              logos?: { href?: string }[];
            };
          }[];
        }[];
      }[];
    };
    for (const ev of schedJson.events ?? []) {
      if (!ev.id) continue;
      const comp = ev.competitions?.[0];
      const st = comp?.status?.type;
      const live = st?.state === "in";
      const final = Boolean(st?.completed) || st?.state === "post";
      const self = (comp?.competitors ?? []).find((c) => String(c.team?.id) === id);
      const opp = (comp?.competitors ?? []).find((c) => String(c.team?.id) !== id);
      if (!self || !opp?.team) continue;
      const weekRaw = ev.week;
      const week =
        typeof weekRaw === "number"
          ? weekRaw
          : typeof weekRaw?.number === "number"
            ? weekRaw.number
            : null;
      const iso = ev.date ?? null;
      const whenDate = iso ? new Date(iso) : null;
      const dateLabel =
        whenDate && !Number.isNaN(whenDate.getTime())
          ? whenDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "numeric",
              day: "numeric",
              timeZone: "America/Chicago",
            })
          : null;
      const teamScore = parseEspnScore(self.score);
      const oppScore = parseEspnScore(opp.score);
      let won: boolean | null = null;
      if (final && teamScore != null && oppScore != null) {
        won = teamScore > oppScore ? true : teamScore < oppScore ? false : null;
      } else if (typeof self.winner === "boolean") {
        won = self.winner;
      }
      schedule.push({
        id: String(ev.id),
        week,
        date: iso,
        dateLabel,
        name: ev.name ?? ev.shortName ?? "Game",
        shortName: ev.shortName ?? ev.name ?? "Game",
        status: st?.description ?? st?.detail ?? "Scheduled",
        shortDetail: st?.shortDetail ?? st?.detail ?? null,
        live,
        final,
        home: self.homeAway === "home",
        teamScore,
        oppScore,
        oppId: opp.team.id ? String(opp.team.id) : null,
        oppName: opp.team.displayName ?? "Opponent",
        oppAbbrev: (opp.team.abbreviation ?? "—").toUpperCase(),
        oppLogo: opp.team.logos?.[0]?.href ?? (opp.team.id ? cfbTeamLogo(opp.team.id) : null),
        oppRank: cfbPollRank(opp.curatedRank?.current),
        won,
      });
    }
  }

  const recentBoard = await fetchCfbScoreboard().catch(() => [] as CfbScoreGame[]);
  const recent = recentBoard.filter(
    (g) => String(g.away.teamId) === id || String(g.home.teamId) === id,
  );

  const next = t.nextEvent?.[0];
  const groupId = t.groups?.id != null ? String(t.groups.id) : null;
  const conference =
    (groupId && FBS_CONFERENCE_LABELS[groupId]) ||
    (t.standingSummary?.match(/\bin\s+(.+)$/i)?.[1] ?? null);

  return {
    id,
    name: t.displayName ?? "Team",
    abbrev: (t.abbreviation ?? "—").toUpperCase(),
    color: (t.color ?? "555555").replace(/^#/, ""),
    logo: t.logos?.[0]?.href ?? cfbTeamLogo(id),
    record: (t.record?.items ?? []).find((r) => r.type === "total")?.summary ?? null,
    standing: t.standingSummary ?? null,
    conference,
    fpiRank: fpiByTeam.get(Number(id)) ?? null,
    nextEvent: next?.id
      ? { id: String(next.id), name: next.name ?? "Next game", date: next.date ?? null }
      : null,
    roster,
    schedule,
    coaches,
    staffSource,
    winTrend,
    recent,
  };
}

type FbsTeamRow = {
  id: number;
  name: string;
  abbrev: string;
  color: string;
  logo: string | null;
};

async function fetchCoreJson<T>(url: string): Promise<T | null> {
  try {
    // ESPN $ref links are often http:// — browsers block those from https apps.
    const href = url.replace(/^http:\/\//i, "https://");
    const res = await fetch(href, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** All FBS teams for a season (group 80). */
export async function fetchFbsTeams(season = new Date().getFullYear()): Promise<FbsTeamRow[]> {
  const listUrl = `${CORE}/seasons/${season}/types/2/groups/80/teams?limit=200`;
  const list = await fetchCoreJson<{ items?: { $ref?: string }[] }>(listUrl);
  const refs = list?.items?.map((i) => i.$ref).filter(Boolean) ?? [];
  const rows: FbsTeamRow[] = [];
  const chunkSize = 12;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const chunk = refs.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ref) => {
        const team = await fetchCoreJson<{
          id?: string;
          displayName?: string;
          abbreviation?: string;
          color?: string;
          logos?: { href?: string }[];
        }>(ref!);
        if (!team?.id || !team.abbreviation) return;
        rows.push({
          id: Number(team.id),
          name: team.displayName ?? team.abbreviation,
          abbrev: team.abbreviation.toUpperCase(),
          color: (team.color ?? "555555").replace(/^#/, ""),
          logo: team.logos?.[0]?.href ?? cfbTeamLogo(team.id),
        });
      }),
    );
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function dollarProb(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n === 0) return 0;
  return Math.max(0.01, Math.min(0.99, n));
}

function americanFromProb(p: number): string {
  if (p >= 0.5) return `-${Math.round((100 * p) / (1 - p))}`;
  return `+${Math.round((100 * (1 - p)) / p)}`;
}

type KalshiCfbCoachMarket = {
  name: string;
  teamAbbrev: string | null;
  teamHint: string | null;
  impliedPct: number;
  american: string;
  ticker: string;
  url: string;
};

function cfbAbbrevFromKalshiTicker(ticker: string): string | null {
  const parts = ticker.split("-");
  const tail = parts[parts.length - 1]?.toUpperCase();
  return tail && /^[A-Z0-9]{2,6}$/.test(tail) ? tail : null;
}

function cfbAbbrevFromKalshiSubtitle(hint: string | null): string | null {
  if (!hint) return null;
  const cleaned = hint.replace(/^:+\s*/, "").trim();
  for (const t of CFB_FOCUS_TEAMS) {
    if (cleaned.toLowerCase().includes(t.name.toLowerCase())) return t.abbrev;
  }
  return null;
}

/** Kalshi “coach out before Sep 1” markets for college football. */
export async function fetchCfbCoachFiredOdds(): Promise<KalshiCfbCoachMarket[]> {
  type EdgeItem = {
    name?: string;
    teamHint?: string | null;
    oddsAmerican?: string;
    impliedPct?: number;
    ticker?: string;
    url?: string;
  };

  const usable = (data: unknown): data is { items?: EdgeItem[] } =>
    Boolean(data) &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown }).items) &&
    !(data as { error?: string }).error;

  let items: EdgeItem[] = [];
  try {
    const { data } = await supabase.functions.invoke("sports", {
      body: { action: "cfbCoachFiredOdds" },
    });
    if (usable(data) && (data.items?.length ?? 0) > 0) {
      items = data.items ?? [];
    }
  } catch {
    /* fall through */
  }

  if (!items.length) {
    try {
      const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (base && key) {
        const res = await fetch(`${base}/functions/v1/sports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
          body: JSON.stringify({ action: "cfbCoachFiredOdds" }),
        });
        if (res.ok) {
          const data = (await res.json()) as { items?: EdgeItem[]; error?: string };
          if (!data.error && data.items?.length) items = data.items;
        }
      }
    } catch {
      /* */
    }
  }

  const out: KalshiCfbCoachMarket[] = [];
  for (const m of items) {
    const name = (m.name ?? "").trim();
    if (!name) continue;
    const pct = typeof m.impliedPct === "number" ? m.impliedPct : null;
    if (pct == null || !Number.isFinite(pct) || pct <= 0) continue;
    const hint = m.teamHint ?? null;
    const p = Math.max(0.01, Math.min(0.99, pct > 1 ? pct / 100 : pct));
    out.push({
      name,
      teamAbbrev:
        cfbAbbrevFromKalshiTicker(m.ticker ?? "") ?? cfbAbbrevFromKalshiSubtitle(hint),
      teamHint: hint,
      impliedPct: pct > 1 ? pct : Math.round(pct * 1000) / 10,
      american: m.oddsAmerican || americanFromProb(p),
      ticker: m.ticker ?? "",
      url: m.url ?? "",
    });
  }
  out.sort((a, b) => b.impliedPct - a.impliedPct);
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const results = await Promise.all(chunk.map(fn));
    for (const r of results) if (r != null) out.push(r);
  }
  return out;
}

export function scoreCfbRuwtGame(g: CfbScoreGame, ctx?: CfbRuwtContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const diff =
    g.away.score != null && g.home.score != null
      ? Math.abs(g.away.score - g.home.score)
      : null;
  const detail = `${g.shortDetail ?? ""} ${g.status ?? ""}`.toLowerCase();
  const period = g.period;
  const inOt =
    (period != null && period >= 5) || /\bot\b|overtime/.test(detail);

  if (g.live) {
    score += 40;
    reasons.push("Live");
    // Drama from margin — without this every live game sits at flat 40.
    if (diff != null) {
      if (diff <= 3) {
        score += 28;
        reasons.push("One-score game");
      } else if (diff <= 8) {
        score += 14;
        reasons.push("Tight");
      } else if (diff >= 28) {
        score -= 20;
        reasons.push("Blowout");
      } else if (diff >= 21) {
        score -= 14;
        reasons.push("Blowout");
      } else if (diff >= 14) {
        score -= 8;
      }
    }
    if (inOt) {
      score += 32;
      reasons.push("Overtime");
    } else if (diff == null || diff <= 14) {
      // Late-game bump only when still watchable — don't cancel blowout drag.
      if (period === 4 || /\b4th\b/.test(detail)) {
        score += 18;
        reasons.push("4th quarter");
      } else if (period === 3 || /\b3rd\b/.test(detail)) {
        score += 8;
        reasons.push("3rd quarter");
      }
    }
    if (g.situation?.isRedZone && (diff == null || diff <= 14)) {
      score += 18;
      reasons.push("Red zone");
    }
    if (
      g.situation?.downDistanceText?.startsWith("4th") &&
      (diff == null || diff <= 14)
    ) {
      score += 12;
      reasons.push("4th down");
    }
  } else if (!g.final) {
    score += 8;
    reasons.push("Upcoming");
  } else {
    score += 2;
  }

  const awayRank = g.away.rank;
  const homeRank = g.home.rank;
  if (awayRank && homeRank && awayRank <= 25 && homeRank <= 25) {
    score += 28;
    reasons.push("Ranked matchup");
  } else if ((awayRank && awayRank <= 25) || (homeRank && homeRank <= 25)) {
    score += 16;
    reasons.push("Ranked team");
  } else {
    const af = g.away.fpiRank;
    const hf = g.home.fpiRank;
    if (af != null && hf != null && af <= 40 && hf <= 40) {
      score += 10;
      reasons.push("FPI quality");
    }
  }

  // Betting line — market consensus for watchability (not for tips).
  const odds = g.odds;
  const spread = odds?.spread ?? null;
  const absSpread = spread != null ? Math.abs(spread) : null;
  if (absSpread != null) {
    if (absSpread <= 3) {
      score += 18;
      reasons.push(odds?.details ? `Pick'em (${odds.details})` : "Pick'em line");
    } else if (absSpread <= 7) {
      score += 12;
      reasons.push(odds?.details ? `Close line (${odds.details})` : "Close line");
    } else if (absSpread <= 10.5) {
      score += 6;
      reasons.push("Competitive line");
    } else if (absSpread >= 28) {
      score -= 14;
      reasons.push("Heavy chalk");
    } else if (absSpread >= 17) {
      score -= 8;
      reasons.push("Lopsided line");
    }
  }

  // Market vs FPI: books favor the worse FPI side → interesting disagreement.
  const favId = odds?.favoriteTeamId ?? null;
  if (favId != null && g.away.fpiRank != null && g.home.fpiRank != null) {
    const favFpi = favId === g.away.teamId ? g.away.fpiRank : favId === g.home.teamId ? g.home.fpiRank : null;
    const dogFpi = favId === g.away.teamId ? g.home.fpiRank : favId === g.home.teamId ? g.away.fpiRank : null;
    // Lower FPI ordinal = stronger team. Favorite with worse (higher) FPI = market ≠ FPI.
    if (favFpi != null && dogFpi != null && favFpi > dogFpi + 2) {
      score += 10;
      reasons.push("Market vs FPI");
    }
  }

  // Live: favorite trailing = upset watch (uses scoreboard, not FPI).
  if (g.live && favId != null && g.away.score != null && g.home.score != null) {
    const favScore = favId === g.away.teamId ? g.away.score : favId === g.home.teamId ? g.home.score : null;
    const dogScore = favId === g.away.teamId ? g.home.score : favId === g.home.teamId ? g.away.score : null;
    if (favScore != null && dogScore != null && dogScore > favScore) {
      score += 22;
      reasons.push("Upset watch");
    } else if (
      favScore != null &&
      dogScore != null &&
      absSpread != null &&
      absSpread >= 3
    ) {
      // Favorite leading but not covering yet → still interesting.
      const favMargin = favScore - dogScore;
      if (favMargin >= 0 && favMargin < absSpread - 0.5 && favMargin <= 10) {
        score += 8;
        reasons.push("Against the number");
      }
    }
  }

  for (const side of [g.away, g.home]) {
    const interest = ctx?.teamInterest[String(side.teamId)] ?? 0;
    if (interest >= 7) {
      score += interest * 3;
      reasons.push(`${side.abbrev} interest ${interest}`);
    }
    if (ctx?.watchTeamIds?.has(String(side.teamId))) {
      score += 12;
      reasons.push(`Watch ${side.abbrev}`);
    }
  }

  if (g.final && diff != null && diff <= 7) {
    score += 10;
    reasons.push("Close final");
  }

  return { score: Math.max(0, score), reasons: [...new Set(reasons)].slice(0, 5) };
}

export function rankCfbRuwtGames(
  games: CfbScoreGame[],
  ctx?: CfbRuwtContext,
  limit = 24,
): CfbScoredGame[] {
  return [...games]
    .map((g) => {
      const { score, reasons } = scoreCfbRuwtGame(g, ctx);
      return { ...g, score, reasons };
    })
    .sort((a, b) => b.score - a.score || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

async function fetchTeamCoachAndRecord(
  teamId: number,
  season: number,
): Promise<{
  coachId: string;
  coachName: string;
  wins: number;
  losses: number;
  recordSummary: string | null;
  teamName: string;
  teamAbbrev: string;
  teamColor: string;
  teamLogo: string | null;
} | null> {
  const team = await fetchCoreJson<{
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
    record?: { $ref?: string };
    coaches?: { $ref?: string };
  }>(`${CORE}/seasons/${season}/teams/${teamId}?lang=en&region=us`);
  if (!team) return null;

  let wins = 0;
  let losses = 0;
  let recordSummary: string | null = null;
  const recordRef = team.record?.$ref;
  if (recordRef) {
    const rec = await fetchCoreJson<{
      items?: { stats?: { name?: string; value?: number }[]; summary?: string }[];
    }>(recordRef);
    const total = rec?.items?.find((i) => i.summary?.includes("-")) ?? rec?.items?.[0];
    recordSummary = total?.summary ?? null;
    for (const s of total?.stats ?? []) {
      if (s.name === "wins") wins = Number(s.value) || 0;
      if (s.name === "losses") losses = Number(s.value) || 0;
    }
  }

  const coachesRef = team.coaches?.$ref;
  if (!coachesRef) return null;
  const coachList = await fetchCoreJson<{ items?: { $ref?: string }[] }>(coachesRef);
  const coachRef = coachList?.items?.[0]?.$ref;
  if (!coachRef) return null;
  const coach = await fetchCoreJson<{ id?: string; firstName?: string; lastName?: string }>(
    coachRef,
  );
  if (!coach?.id) return null;
  const coachName = [coach.firstName, coach.lastName].filter(Boolean).join(" ").trim();
  if (!coachName) return null;

  return {
    coachId: String(coach.id),
    coachName,
    wins,
    losses,
    recordSummary,
    teamName: team.displayName ?? "Team",
    teamAbbrev: team.abbreviation ?? "—",
    teamColor: (team.color ?? "333333").replace(/^#/, ""),
    teamLogo: team.logos?.[0]?.href ?? cfbTeamLogo(teamId),
  };
}

function recordHeatFactors(
  wins: number,
  losses: number,
  recordSummary: string | null,
): { score: number; factors: CfbCoach["factors"] } {
  const games = wins + losses;
  const winPct = games > 0 ? wins / games : null;
  const factors: CfbCoach["factors"] = [];
  let score = 0;
  if (winPct != null) {
    if (winPct < 0.35) {
      score += 22;
      factors.push({ label: "Record", points: 22, detail: `Win % ${(winPct * 100).toFixed(0)}` });
    } else if (winPct < 0.5) {
      score += 12;
      factors.push({ label: "Record", points: 12, detail: `Win % ${(winPct * 100).toFixed(0)}` });
    } else if (winPct >= 0.75) {
      score -= 8;
      factors.push({ label: "Record", points: -8, detail: `Win % ${(winPct * 100).toFixed(0)}` });
    }
  }
  if (losses >= 4 && games > 0) {
    const pts = Math.min(12, losses * 2);
    score += pts;
    factors.push({ label: "Losses", points: pts, detail: `${losses} losses` });
  }
  if (recordSummary && !factors.length) {
    factors.push({ label: "Record", points: 0, detail: recordSummary });
  }
  return { score, factors };
}

/** CFB hot seat — Kalshi coach-out % when available, full FBS records for context. */
export async function fetchCfbCoaches(): Promise<CfbCoach[]> {
  const season = new Date().getFullYear();
  const fbsTeams = await fetchFbsTeams(season).catch(() =>
    CFB_FOCUS_TEAMS.map((t) => ({
      id: t.id,
      name: t.name,
      abbrev: t.abbrev,
      color: "555555",
      logo: cfbTeamLogo(t.id),
    })),
  );
  const byAbbrev = new Map(fbsTeams.map((t) => [t.abbrev.toUpperCase(), t]));
  const kalshi = await fetchCfbCoachFiredOdds().catch(() => [] as KalshiCfbCoachMarket[]);
  const coveredTeamIds = new Set<number>();
  const rows: Omit<CfbCoach, "hotSeatRank">[] = [];

  for (const m of kalshi) {
    const team =
      (m.teamAbbrev ? byAbbrev.get(m.teamAbbrev.toUpperCase()) : null) ??
      [...fbsTeams].find((t) =>
        (m.teamHint ?? "").toLowerCase().includes(t.name.toLowerCase()),
      ) ??
      null;
    if (team) coveredTeamIds.add(team.id);
    const pack = team ? await fetchTeamCoachAndRecord(team.id, season).catch(() => null) : null;
    const wins = pack?.wins ?? 0;
    const losses = pack?.losses ?? 0;
    const recordSummary = pack?.recordSummary ?? null;
    const winPct = wins + losses > 0 ? wins / (wins + losses) : null;
    const marketPct = m.impliedPct;
    const marketPts = Math.round(marketPct * 0.85 * 10) / 10;
    const factors: CfbCoach["factors"] = [
      {
        label: "Kalshi %",
        points: marketPts,
        detail: `Kalshi ~${marketPct.toFixed(1)}% coach-out → +${marketPts} heat`,
      },
    ];
    let score = 20 + marketPts;
    const recordAdj = recordHeatFactors(wins, losses, recordSummary);
    score += recordAdj.score;
    factors.push(...recordAdj.factors);
    const id =
      pack?.coachId && /^\d+$/.test(pack.coachId)
        ? pack.coachId
        : m.ticker.replace(/^KXCOACHOUTNCAAFB-[^-]+-/, "") ||
          m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    rows.push({
      id,
      name: pack?.coachName || m.name,
      teamId: team ? String(team.id) : "0",
      teamName: team?.name ?? pack?.teamName ?? m.teamHint ?? "FBS",
      teamAbbrev: team?.abbrev ?? pack?.teamAbbrev ?? m.teamAbbrev ?? "—",
      teamLogo: team?.logo ?? pack?.teamLogo ?? null,
      teamColor: team?.color ?? pack?.teamColor ?? "333",
      headshot: null,
      recordSummary,
      wins,
      losses,
      winPct,
      hotSeatScore: Math.max(0, Math.min(100, Math.round(score))),
      firedOddsPct: marketPct,
      firedOddsAmerican: m.american,
      kalshiUrl: m.url,
      factors,
    });
  }

  const remaining = fbsTeams.filter((t) => !coveredTeamIds.has(t.id));
  const extras = await mapWithConcurrency(remaining, 10, async (team) => {
    const pack = await fetchTeamCoachAndRecord(team.id, season);
    if (!pack) return null;
    const games = pack.wins + pack.losses;
    const winPct = games > 0 ? pack.wins / games : null;
    const { score: recordScore, factors } = recordHeatFactors(
      pack.wins,
      pack.losses,
      pack.recordSummary,
    );
    let score = 15 + recordScore;
    if (score < 8 && games === 0) return null;
    return {
      id: pack.coachId,
      name: pack.coachName,
      teamId: String(team.id),
      teamName: pack.teamName,
      teamAbbrev: pack.teamAbbrev,
      teamLogo: pack.teamLogo,
      teamColor: pack.teamColor,
      headshot: null,
      recordSummary: pack.recordSummary,
      wins: pack.wins,
      losses: pack.losses,
      winPct,
      hotSeatScore: Math.round(score * 10) / 10,
      firedOddsPct: null,
      firedOddsAmerican: null,
      kalshiUrl: null,
      factors,
    } satisfies Omit<CfbCoach, "hotSeatRank">;
  });

  rows.push(...extras);

  rows.sort((a, b) => {
    const ap = a.firedOddsPct ?? -1;
    const bp = b.firedOddsPct ?? -1;
    if (ap !== bp) return bp - ap;
    return b.hotSeatScore - a.hotSeatScore || a.name.localeCompare(b.name);
  });
  return rows.map((r, i) => ({ ...r, hotSeatRank: i + 1 }));
}

/** Year-by-year head-coaching record + school from ESPN coach seasons. */
export async function fetchCfbCoachSeasonRecords(
  coachId: string,
): Promise<CfbCoachSeasonRecord[]> {
  const id = String(coachId);
  if (!/^\d+$/.test(id)) return [];

  const person = await fetchCoreJson<{
    coachSeasons?: { $ref?: string }[];
  }>(`${CORE}/coaches/${id}?lang=en&region=us`);
  const seasonRefs = (person?.coachSeasons ?? [])
    .map((s) => s.$ref)
    .filter((r): r is string => Boolean(r));
  if (!seasonRefs.length) return [];

  const teamCache = new Map<string, { name: string; abbrev: string }>();
  const rows: CfbCoachSeasonRecord[] = [];
  const chunkSize = 5;

  for (let i = 0; i < seasonRefs.length; i += chunkSize) {
    const chunk = seasonRefs.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ref) => {
        const seasonMatch = ref.match(/\/seasons\/(\d+)\/coaches\//);
        const season = seasonMatch ? Number(seasonMatch[1]) : null;
        if (!season) return;

        const seasonCoach = await fetchCoreJson<{
          team?: { $ref?: string };
          records?: { record?: { $ref?: string }; team?: { $ref?: string } }[];
        }>(ref);
        const teamRef =
          seasonCoach?.team?.$ref ?? seasonCoach?.records?.[0]?.team?.$ref ?? null;
        const teamId = teamRef?.match(/\/teams\/(\d+)/)?.[1] ?? null;
        if (!teamId) return;

        let school = "—";
        let teamAbbrev: string | null = null;
        const cached = teamCache.get(`${season}:${teamId}`);
        if (cached) {
          school = cached.name;
          teamAbbrev = cached.abbrev;
        } else {
          const team = await fetchCoreJson<{
            displayName?: string;
            abbreviation?: string;
          }>(`${CORE}/seasons/${season}/teams/${teamId}?lang=en&region=us`);
          school = team?.displayName ?? `Team ${teamId}`;
          teamAbbrev = team?.abbreviation?.toUpperCase() ?? null;
          teamCache.set(`${season}:${teamId}`, { name: school, abbrev: teamAbbrev ?? "—" });
        }

        const recordRef =
          seasonCoach?.records?.[0]?.record?.$ref ??
          `${CORE}/seasons/${season}/types/2/coaches/${id}/record?lang=en&region=us`;
        const rec = await fetchCoreJson<{
          summary?: string;
          displayValue?: string;
          stats?: { name?: string; value?: number }[];
        }>(recordRef);

        const winsStat = rec?.stats?.find((s) => s.name === "wins")?.value;
        const lossesStat = rec?.stats?.find((s) => s.name === "losses")?.value;
        const tiesStat = rec?.stats?.find((s) => s.name === "ties")?.value;
        let wins =
          typeof winsStat === "number" && Number.isFinite(winsStat) ? Math.round(winsStat) : null;
        let losses =
          typeof lossesStat === "number" && Number.isFinite(lossesStat)
            ? Math.round(lossesStat)
            : null;
        let ties =
          typeof tiesStat === "number" && Number.isFinite(tiesStat) ? Math.round(tiesStat) : 0;
        const summaryRaw = rec?.summary ?? rec?.displayValue ?? "";
        if (wins == null || losses == null) {
          const m = summaryRaw.match(/^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?/);
          if (!m) return;
          wins = Number(m[1]);
          losses = Number(m[2]);
          ties = m[3] != null ? Number(m[3]) : 0;
        }
        if (wins + losses + ties <= 0 && season < new Date().getFullYear()) return;

        const summary =
          ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
        rows.push({
          season,
          school,
          teamId,
          teamAbbrev,
          wins,
          losses,
          ties,
          summary,
        });
      }),
    );
  }

  rows.sort((a, b) => b.season - a.season || a.school.localeCompare(b.school));
  return rows;
}

function careerFromSeasonRecords(records: CfbCoachSeasonRecord[]): CfbCoachCareerTotals | null {
  if (!records.length) return null;
  const wins = records.reduce((n, r) => n + r.wins, 0);
  const losses = records.reduce((n, r) => n + r.losses, 0);
  const ties = records.reduce((n, r) => n + r.ties, 0);
  const summary = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
  return { wins, losses, ties, seasons: records.length, summary };
}

function cfbRefSearchUrl(name: string): string {
  return `https://www.sports-reference.com/cfb/search/search.fcgi?search=${encodeURIComponent(name)}`;
}

export async function fetchCfbCoachProfile(coachId: string): Promise<CfbCoachProfile> {
  const all = await fetchCfbCoaches().catch(() => [] as CfbCoach[]);
  let base =
    all.find((c) => c.id === coachId) ??
    all.find((c) => c.id.toLowerCase() === coachId.toLowerCase()) ??
    all.find((c) => c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === coachId.toLowerCase()) ??
    null;

  if (!base) {
    base = await fetchCfbCoachDirect(coachId);
  }
  if (!base) throw new Error("Coach not found");

  // Prefer a real ESPN coach id so career seasons resolve (Kalshi rows used ticker tails).
  if (!/^\d+$/.test(base.id) && base.teamId && base.teamId !== "0") {
    const pack = await fetchTeamCoachAndRecord(
      Number(base.teamId),
      new Date().getFullYear(),
    ).catch(() => null);
    if (pack?.coachId && /^\d+$/.test(pack.coachId)) {
      base = {
        ...base,
        id: pack.coachId,
        name: pack.coachName || base.name,
        teamName: pack.teamName || base.teamName,
        teamAbbrev: pack.teamAbbrev || base.teamAbbrev,
        teamLogo: pack.teamLogo ?? base.teamLogo,
        teamColor: pack.teamColor || base.teamColor,
        recordSummary: base.recordSummary ?? pack.recordSummary,
        wins: base.wins || pack.wins,
        losses: base.losses || pack.losses,
      };
    }
  }

  let bio: string | null = null;
  // Do not invent ESPN player-CDN URLs for coaches (404 → broken question-mark image).
  let headshot: string | null = base.headshot;
  let wikiUrl: string | null = null;
  let careerPath: CfbCoachCareerStop[] = [];
  const bioFacts: CfbCoachBioFact[] = [];

  const espnCoachIdEarly = /^\d+$/.test(base.id) ? base.id : null;
  const [wikiCard, corePerson, espnSearch] = await Promise.all([
    fetchWikiFootballCoachCard(base.name).catch(() => null),
    espnCoachIdEarly
      ? fetchCoreJson<{
          birthPlace?: { city?: string; state?: string; country?: string };
          dateOfBirth?: string;
          college?: { $ref?: string };
        }>(`${CORE}/coaches/${espnCoachIdEarly}?lang=en&region=us`).catch(() => null)
      : Promise.resolve(null),
    searchEspnCoachHeadshot(base.name),
  ]);

  if (espnSearch.headshot) headshot = espnSearch.headshot;
  if (espnSearch.id && /^\d+$/.test(espnSearch.id) && !/^\d+$/.test(base.id)) {
    base = { ...base, id: espnSearch.id };
  }

  if (wikiCard?.image) headshot = wikiCard.image;
  if (wikiCard?.extract) bio = wikiCard.extract;
  if (wikiCard?.url) wikiUrl = wikiCard.url;
  if (wikiCard?.careerPath.length) careerPath = wikiCard.careerPath;

  const born =
    wikiCard?.birthDate || formatCoachDob(corePerson?.dateOfBirth ?? null);
  const hometown =
    wikiCard?.birthPlace || formatCoachBirthPlace(corePerson?.birthPlace);
  if (born) bioFacts.push({ label: "Born", value: born });
  if (hometown) bioFacts.push({ label: "Hometown", value: hometown });

  if (corePerson?.college?.$ref) {
    const college = await fetchCoreJson<{
      name?: string;
      shortName?: string;
      abbrev?: string;
    }>(corePerson.college.$ref).catch(() => null);
    const alma = college?.name || college?.shortName;
    if (alma) bioFacts.push({ label: "Alma mater", value: alma });
  }

  if (!bio) {
    try {
      const search = await fetch(
        `https://site.web.api.espn.com/apis/common/v3/search?region=us&lang=en&limit=8&query=${encodeURIComponent(base.name)}`,
        { headers: { Accept: "application/json" } },
      );
      if (search.ok) {
        const data = (await search.json()) as {
          items?: { description?: string; type?: string }[];
        };
        const hit = (data.items ?? []).find((it) => /coach|person/i.test(it.type ?? ""));
        if (hit?.description?.trim()) bio = hit.description.trim();
      }
    } catch {
      /* */
    }
  }

  const espnCoachId = /^\d+$/.test(base.id) ? base.id : null;
  const seasonRecords = espnCoachId
    ? await fetchCfbCoachSeasonRecords(espnCoachId).catch(() => [] as CfbCoachSeasonRecord[])
    : [];
  const career = careerFromSeasonRecords(seasonRecords);

  if (career) {
    bioFacts.push({ label: "Head coaching record", value: career.summary });
  } else if (base.recordSummary) {
    bioFacts.push({ label: "Season record", value: base.recordSummary });
  }
  if (seasonRecords.length) {
    const schools = [...new Set(seasonRecords.map((r) => r.school))];
    if (schools.length) bioFacts.push({ label: "Programs", value: schools.join(", ") });
  }

  let staff: CfbTeamStaffMember[] = [];
  if (base.teamId && base.teamId !== "0") {
    // Resolve official ESPN display name for Wikipedia season-page titles.
    let wikiTeamName = base.teamName;
    const teamMeta = await fetchCoreJson<{ displayName?: string }>(
      `${CORE}/seasons/${new Date().getFullYear()}/teams/${base.teamId}?lang=en&region=us`,
    ).catch(() => null);
    if (teamMeta?.displayName) wikiTeamName = teamMeta.displayName;

    const pack = await buildCfbCoachingStaff({
      teamId: base.teamId,
      teamName: wikiTeamName,
      rosterCoaches: espnCoachId
        ? [{ id: espnCoachId, name: base.name }]
        : [{ id: base.id, name: base.name }],
    }).catch(() => ({ coaches: [] as CfbTeamStaffMember[], staffSource: null }));
    staff = pack.coaches.filter((c) => c.name.toLowerCase() !== base!.name.toLowerCase());

    // Enrich top assistants with Wikipedia portraits / short bios.
    const enrichTargets = staff
      .filter((s) => staffTitleRank(s.title) <= 4)
      .slice(0, 8);
    await Promise.all(
      enrichTargets.map(async (s) => {
        const card = await fetchWikiFootballCoachCard(s.name).catch(() => null);
        if (!card) return;
        s.headshot = card.image ?? s.headshot;
        if (card.extract) {
          const first = card.extract.split(/(?<=\.)\s+/)[0]?.trim();
          s.bio = first || card.extract.slice(0, 220);
        }
      }),
    );
  }

  const careerHighlights: string[] = [];
  if (career) {
    careerHighlights.push(
      `Career record: ${career.summary} across ${career.seasons} season${career.seasons === 1 ? "" : "s"}`,
    );
  } else if (base.recordSummary) {
    careerHighlights.push(`Season record: ${base.recordSummary}`);
  }
  if (seasonRecords.length) {
    const schools = [...new Set(seasonRecords.map((r) => r.school))];
    if (schools.length) careerHighlights.push(`Schools: ${schools.join(", ")}`);
  }
  if (base.firedOddsPct != null) {
    careerHighlights.push(`Coach-out implied: ${base.firedOddsPct.toFixed(1)}%`);
  }
  if (careerPath.length) {
    const hc = careerPath.filter((s) => s.kind === "coaching").slice(-3);
    if (hc.length) {
      careerHighlights.push(
        `Recent stops: ${hc.map((s) => `${s.years} ${s.detail}`).join(" · ")}`,
      );
    }
  }

  const headshotFallbacks = [base.teamLogo].filter((u): u is string => Boolean(u));

  return {
    ...base,
    headshot,
    headshotFallbacks,
    bio,
    bioFacts,
    careerPath,
    careerHighlights,
    seasonRecords,
    career,
    oddsSource: base.firedOddsPct != null ? "Kalshi" : null,
    cfbRefUrl: cfbRefSearchUrl(base.name),
    wikiUrl,
    staff,
  };
}

/** Resolve a coach by ESPN id when they're missing from the hot-seat board (e.g. 0–0 teams). */
async function fetchCfbCoachDirect(coachId: string): Promise<CfbCoach | null> {
  const id = String(coachId);
  const season = new Date().getFullYear();
  let seasonCoach =
    (await fetchCoreJson<{
      id?: string;
      firstName?: string;
      lastName?: string;
      team?: { $ref?: string };
      experience?: number;
    }>(`${CORE}/seasons/${season}/coaches/${id}?lang=en&region=us`)) ?? null;

  if (seasonCoach && !seasonCoach.team?.$ref) {
    const prev = await fetchCoreJson<{
      id?: string;
      firstName?: string;
      lastName?: string;
      team?: { $ref?: string };
      experience?: number;
    }>(`${CORE}/seasons/${season - 1}/coaches/${id}?lang=en&region=us`);
    if (prev?.team?.$ref) seasonCoach = { ...seasonCoach, team: prev.team };
  }

  if (!seasonCoach?.id) {
    seasonCoach = await fetchCoreJson<{
      id?: string;
      firstName?: string;
      lastName?: string;
      team?: { $ref?: string };
      experience?: number;
    }>(`${CORE}/seasons/${season - 1}/coaches/${id}?lang=en&region=us`);
  }

  if (!seasonCoach?.id) {
    const person = await fetchCoreJson<{
      id?: string;
      firstName?: string;
      lastName?: string;
      coachSeasons?: { $ref?: string }[];
    }>(`${CORE}/coaches/${id}?lang=en&region=us`);
    if (!person?.id) return null;
    const seasonRef = person.coachSeasons?.[0]?.$ref;
    const fromSeason = seasonRef
      ? await fetchCoreJson<{
          id?: string;
          firstName?: string;
          lastName?: string;
          team?: { $ref?: string };
        }>(seasonRef)
      : null;
    const teamRef = fromSeason?.team?.$ref;
    const teamIdMatch = teamRef?.match(/\/teams\/(\d+)/);
    const teamId = teamIdMatch?.[1] ?? "";
    let teamName = "Team";
    let teamAbbrev = "—";
    let teamColor = "555555";
    let teamLogo: string | null = teamId ? cfbTeamLogo(teamId) : null;
    if (teamId) {
      const team = await fetchCoreJson<{
        displayName?: string;
        abbreviation?: string;
        color?: string;
        logos?: { href?: string }[];
      }>(`${CORE}/seasons/${season}/teams/${teamId}?lang=en&region=us`);
      if (team) {
        teamName = team.displayName ?? teamName;
        teamAbbrev = (team.abbreviation ?? "—").toUpperCase();
        teamColor = (team.color ?? "555555").replace(/^#/, "");
        teamLogo = team.logos?.[0]?.href ?? teamLogo;
      }
    }
    const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
    if (!name) return null;
    return {
      id: String(person.id),
      name,
      teamId,
      teamName,
      teamAbbrev,
      teamLogo,
      teamColor,
      headshot: null,
      recordSummary: null,
      wins: 0,
      losses: 0,
      winPct: null,
      hotSeatScore: 0,
      hotSeatRank: 0,
      firedOddsPct: null,
      firedOddsAmerican: null,
      kalshiUrl: null,
      factors: [],
    };
  }

  const teamRef = seasonCoach.team?.$ref;
  const teamIdMatch = teamRef?.match(/\/teams\/(\d+)/);
  const teamId = teamIdMatch?.[1] ?? "";
  let teamName = "Team";
  let teamAbbrev = "—";
  let teamColor = "555555";
  let teamLogo: string | null = teamId ? cfbTeamLogo(teamId) : null;
  let recordSummary: string | null = null;
  let wins = 0;
  let losses = 0;
  if (teamId) {
    const pack = await fetchTeamCoachAndRecord(Number(teamId), season).catch(() => null);
    if (pack) {
      teamName = pack.teamName;
      teamAbbrev = pack.teamAbbrev;
      teamColor = pack.teamColor;
      teamLogo = pack.teamLogo;
      recordSummary = pack.recordSummary;
      wins = pack.wins;
      losses = pack.losses;
    } else {
      const team = await fetchCoreJson<{
        displayName?: string;
        abbreviation?: string;
        color?: string;
        logos?: { href?: string }[];
      }>(`${CORE}/seasons/${season}/teams/${teamId}?lang=en&region=us`);
      if (team) {
        teamName = team.displayName ?? teamName;
        teamAbbrev = (team.abbreviation ?? "—").toUpperCase();
        teamColor = (team.color ?? "555555").replace(/^#/, "");
        teamLogo = team.logos?.[0]?.href ?? teamLogo;
      }
    }
  }

  const name = [seasonCoach.firstName, seasonCoach.lastName].filter(Boolean).join(" ").trim();
  if (!name) return null;
  const games = wins + losses;
  return {
    id: String(seasonCoach.id),
    name,
    teamId,
    teamName,
    teamAbbrev,
    teamLogo,
    teamColor,
    headshot: null,
    recordSummary,
    wins,
    losses,
    winPct: games > 0 ? wins / games : null,
    hotSeatScore: 0,
    hotSeatRank: 0,
    firedOddsPct: null,
    firedOddsAmerican: null,
    kalshiUrl: null,
    factors: [],
  };
}

type CfbGameLogEventMeta = {
  id?: string;
  week?: number;
  gameDate?: string;
  atVs?: string;
  gameResult?: string;
  score?: string;
  opponent?: { displayName?: string; abbreviation?: string };
};

function parseCfbGameLogEvents(raw: unknown): Record<string, CfbGameLogEventMeta> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, CfbGameLogEventMeta> = {};
    for (const ev of raw) {
      const id = String((ev as CfbGameLogEventMeta).id ?? "");
      if (id) out[id] = ev as CfbGameLogEventMeta;
    }
    return out;
  }
  if (typeof raw === "object") return raw as Record<string, CfbGameLogEventMeta>;
  return {};
}

function buildCfbStatCategories(
  labels: string[],
  values: string[],
  catsMeta: { name?: string; displayName?: string; count?: number }[],
): CfbPlayerProfile["statCategories"] {
  let offset = 0;
  const statCategories: CfbPlayerProfile["statCategories"] = [];
  for (const cat of catsMeta) {
    const count = cat.count ?? 0;
    statCategories.push({
      name: cat.displayName ?? cat.name ?? "Stats",
      stats: labels.slice(offset, offset + count).map((label, i) => ({
        label,
        value: values[offset + i] ?? "—",
      })),
    });
    offset += count;
  }
  return statCategories;
}

export async function fetchCfbPlayerProfile(playerId: string): Promise<CfbPlayerProfile> {
  const id = String(playerId);
  const [athleteRes, overviewRes] = await Promise.all([
    fetch(`${ESPN_WEB}/athletes/${id}`, { headers: { Accept: "application/json" } }),
    fetch(`${ESPN_WEB}/athletes/${id}/overview`, { headers: { Accept: "application/json" } }),
  ]);
  if (!athleteRes.ok) throw new Error(`CFB player ${athleteRes.status}`);
  const raw = (await athleteRes.json()) as { athlete?: Record<string, unknown> };
  const overview = overviewRes.ok ? ((await overviewRes.json()) as Record<string, unknown>) : {};
  const a = { ...(raw.athlete ?? {}) } as Record<string, unknown>;
  const team = (a.team ?? {}) as {
    id?: string;
    displayName?: string;
    abbreviation?: string;
    color?: string;
    logos?: { href?: string }[];
  };
  const position = (a.position ?? {}) as { abbreviation?: string; displayName?: string };
  const classYear =
    (a.displayExperience as string | undefined) ||
    (a.experience as { displayValue?: string } | undefined)?.displayValue ||
    null;
  const birthPlace =
    (a.displayBirthPlace as string | undefined)?.trim() ||
    (() => {
      const bp = a.birthPlace as { city?: string; state?: string; country?: string } | undefined;
      return bp ? [bp.city, bp.state?.trim(), bp.country].filter(Boolean).join(", ") : null;
    })();

  const statistics = overview.statistics as
    | {
        labels?: string[];
        categories?: { name?: string; displayName?: string; count?: number }[];
        splits?: { displayName?: string; type?: string; stats?: string[] }[];
      }
    | undefined;
  const labels = statistics?.labels ?? [];
  const values = statistics?.splits?.[0]?.stats ?? [];
  const catsMeta = statistics?.categories ?? [];
  const statCategories = buildCfbStatCategories(labels, values, catsMeta);
  const seasonSplits = (statistics?.splits ?? []).map((split, idx) => ({
    season: split.displayName ?? split.type ?? `Season ${idx + 1}`,
    categories: buildCfbStatCategories(labels, split.stats ?? [], catsMeta),
  }));

  const summaryStats = (
    (a.statsSummary as { statistics?: { shortDisplayName?: string; displayValue?: string }[] })
      ?.statistics ?? []
  ).map((s) => ({ label: s.shortDisplayName ?? "Stat", value: s.displayValue ?? "—" }));

  const gameLog = overview.gameLog as
    | {
        events?: unknown;
        statistics?: {
          displayName?: string;
          labels?: string[];
          events?: { eventId?: string; stats?: string[] }[];
        }[];
      }
    | undefined;
  const eventMeta = parseCfbGameLogEvents(gameLog?.events);
  const gameLogCategories: CfbPlayerProfile["gameLogCategories"] = (gameLog?.statistics ?? []).map(
    (block) => {
      const blockLabels = block.labels ?? labels;
      const rows = (block.events ?? []).map((ev) => {
        const meta = eventMeta[String(ev.eventId ?? "")] ?? {};
        const stats = ev.stats ?? [];
        const opponent =
          meta.opponent?.abbreviation ?? meta.opponent?.displayName ?? "—";
        const result = `${meta.gameResult ?? ""} ${meta.score ?? ""}`.trim() || "—";
        return {
          eventId: ev.eventId != null ? String(ev.eventId) : null,
          date: meta.gameDate ?? null,
          week: meta.week ?? null,
          opponent,
          atVs: meta.atVs ?? null,
          result,
          score: meta.score ?? null,
          stats: blockLabels.map((label, i) => ({
            label,
            value: stats[i] ?? "—",
          })),
        };
      });
      return {
        name: block.displayName ?? "Stats",
        labels: blockLabels,
        rows,
      };
    },
  );
  const recentGames: CfbPlayerProfile["recentGames"] = (gameLogCategories[0]?.rows ?? [])
    .slice(0, 8)
    .map((row) => ({
      label:
        row.week != null
          ? `Wk ${row.week} ${row.atVs ?? ""} ${row.opponent}`.trim()
          : row.opponent,
      result: row.result,
      line: row.stats
        .slice(0, 5)
        .map((s) => s.value)
        .join(" · "),
    }));

  const newsRaw = overview.news as
    | { headline?: string; description?: string; images?: { url?: string }[]; links?: { href?: string; web?: { href?: string } }[] }[]
    | undefined;

  const headshotHref =
    (a.headshot as { href?: string } | undefined)?.href ||
    (overview.headshot as { href?: string } | undefined)?.href ||
    null;

  return {
    id,
    name: String(a.displayName ?? a.fullName ?? "Player"),
    number: a.jersey != null ? String(a.jersey) : null,
    position: position.abbreviation ?? null,
    positionName: position.displayName ?? null,
    teamId: team.id ?? null,
    teamName: team.displayName ?? null,
    teamAbbrev: team.abbreviation ?? null,
    teamColor: (team.color ?? "d9515c").replace(/^#/, ""),
    teamLogo: team.logos?.[0]?.href ?? (team.id ? cfbTeamLogo(team.id) : null),
    headshot: headshotHref ?? cfbHeadshot(id),
    height: (a.displayHeight as string | undefined) ?? null,
    weight: a.displayWeight != null ? String(a.displayWeight) : null,
    age: typeof a.age === "number" ? a.age : null,
    classYear,
    birthPlace,
    experience: classYear,
    bio:
      (typeof a.bio === "string" && a.bio.trim()) ||
      (typeof overview.description === "string" && overview.description.trim()) ||
      null,
    status:
      (a.injuries as { status?: string }[] | undefined)?.[0]?.status ||
      (a.status as { name?: string } | undefined)?.name ||
      null,
    seasonStats: summaryStats.length ? summaryStats : (statCategories[0]?.stats.slice(0, 8) ?? []),
    statCategories,
    seasonSplits,
    gameLogCategories,
    recentGames,
    news: (newsRaw ?? []).slice(0, 8).map((n) => ({
      headline: n.headline ?? "",
      description: n.description ?? "",
      image: n.images?.[0]?.url ?? null,
      href: n.links?.[0]?.href ?? n.links?.[0]?.web?.href ?? null,
    })),
  };
}
