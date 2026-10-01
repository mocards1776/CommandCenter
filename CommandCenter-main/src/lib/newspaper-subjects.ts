/**
 * Who a story is about: the players it names most, with a photograph and the
 * season line to set beside the copy when the wire sent no picture.
 */

import { namePieces, type NameIndex, type Person } from "./newspaper-people.ts";

export type PlayerRef = { path: string; id: string };

export type PlayerFile = {
  href: string;
  name: string;
  position: string | null;
  team: string | null;
  /** "17 HR · .242 AVG · .704 OPS" */
  line: string | null;
  /** Season the line covers, when it isn't the current one. */
  lineNote: string | null;
  headshot: string | null;
  /** A wide game-action photograph, when the league keeps one. */
  action: string | null;
};

const ROUTES: [RegExp, string][] = [
  [/^\/sports\/mlb\/player\/(\d+)/, "baseball/mlb"],
  [/^\/sports\/nfl\/player\/(\d+)/, "football/nfl"],
  [/^\/sports\/cfb\/player\/(\d+)/, "football/college-football"],
  [/^\/sports\/nhl\/player\/(\d+)/, "hockey/nhl"],
];

export function playerRef(href: string): PlayerRef | null {
  for (const [re, path] of ROUTES) {
    const id = re.exec(href)?.[1];
    if (id) return { path, id };
  }
  return null;
}

/**
 * The people a story names, most-mentioned first. A name in the headline
 * counts for three mentions; bare surnames count once the full name has run.
 */
export function storySubjects(
  story: { headline: string; dek?: string | null; body?: string | null },
  index: NameIndex,
  max = 4,
): Person[] {
  const counts = new Map<string, { person: Person; n: number; first: number }>();
  const seen = new Set<string>();
  let order = 0;
  const tally = (text: string | null | undefined, weight: number) => {
    if (!text) return;
    for (const piece of namePieces(text, index, seen)) {
      if (typeof piece === "string") continue;
      const hit = counts.get(piece.person.href);
      if (hit) hit.n += weight;
      else counts.set(piece.person.href, { person: piece.person, n: weight, first: order++ });
    }
  };
  // Headlines run surnames; let them count once the full name appears anywhere in the copy.
  for (const text of [story.headline, story.dek, story.body]) if (text) namePieces(text, index, seen);
  tally(story.headline, 3);
  tally(story.dek, 2);
  tally(story.body, 1);
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.first - b.first)
    .slice(0, max)
    .map((c) => c.person);
}

const MLB_IMG = "https://img.mlbstatic.com/mlb-photos/image/upload";

export function mlbAction(id: string): string {
  return `${MLB_IMG}/w_1200,q_auto:best/v1/people/${id}/action/hero/current`;
}

export function mlbPortrait(id: string): string {
  return `${MLB_IMG}/w_360,q_auto:best/v1/people/${id}/headshot/67/current`;
}

function espnSlug(path: string): string | null {
  return { "football/nfl": "nfl", "football/college-football": "college-football", "hockey/nhl": "nhl" }[path] ?? null;
}

export function espnPortrait(path: string, id: string): string | null {
  const slug = espnSlug(path);
  return slug ? `https://a.espncdn.com/i/headshots/${slug}/players/full/${id}.png` : null;
}

type MlbStat = Record<string, string | number | undefined>;
type MlbPerson = {
  id?: number;
  fullName?: string;
  primaryPosition?: { abbreviation?: string };
  currentTeam?: { id?: number; name?: string };
  stats?: { group?: { displayName?: string }; splits?: { stat?: MlbStat }[] }[];
};

function mlbLine(pitcher: boolean, stat: MlbStat | undefined): string | null {
  if (!stat) return null;
  if (pitcher) {
    const ip = stat.inningsPitched;
    if (!ip || ip === "0.0") return null;
    return `${stat.wins ?? 0}-${stat.losses ?? 0} · ${stat.era ?? "—"} ERA · ${stat.strikeOuts ?? 0} SO · ${ip} IP`;
  }
  if (!Number(stat.atBats ?? 0)) return null;
  return `${stat.avg ?? "—"} AVG · ${stat.homeRuns ?? 0} HR · ${stat.rbi ?? 0} RBI · ${stat.ops ?? "—"} OPS`;
}

function statFor(p: MlbPerson, group: string): MlbStat | undefined {
  return p.stats?.find((s) => s.group?.displayName === group)?.splits?.[0]?.stat;
}

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Farm clubs keep their own level, and their stats only answer to it. */
const affiliateLevels = new Map<number, number>();

async function levelOf(teamId: number, parentId: number, season: number): Promise<number | null> {
  if (!affiliateLevels.has(teamId)) {
    const data = await json<{ teams?: { id?: number; sport?: { id?: number } }[] }>(
      `https://statsapi.mlb.com/api/v1/teams/affiliates?teamIds=${parentId}&season=${season}`,
    );
    for (const t of data?.teams ?? []) if (t.id && t.sport?.id) affiliateLevels.set(t.id, t.sport.id);
  }
  return affiliateLevels.get(teamId) ?? null;
}

async function mlbFiles(ids: string[], season: number): Promise<Map<string, PlayerFile>> {
  const out = new Map<string, PlayerFile>();
  if (!ids.length) return out;
  const data = await json<{ people?: (MlbPerson & { currentTeam?: { parentOrgId?: number } })[] }>(
    `https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(",")}&hydrate=currentTeam,stats(group=[hitting,pitching],type=[season],season=${season})`,
  );
  await Promise.all(
    (data?.people ?? []).map(async (p) => {
      if (!p.id) return;
      const id = String(p.id);
      const pitcher = /^(P|SP|RP)$/.test(p.primaryPosition?.abbreviation ?? "");
      let line = mlbLine(pitcher, statFor(p, pitcher ? "pitching" : "hitting"));
      const team = p.currentTeam;
      if (!line && team?.id && team.parentOrgId) {
        const sportId = await levelOf(team.id, team.parentOrgId, season);
        if (sportId && sportId !== 1) {
          const farm = await json<{ stats?: { splits?: { stat?: MlbStat }[] }[] }>(
            `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&group=${pitcher ? "pitching" : "hitting"}&season=${season}&sportId=${sportId}`,
          );
          line = mlbLine(pitcher, farm?.stats?.[0]?.splits?.[0]?.stat);
        }
      }
      out.set(id, {
        href: `/sports/mlb/player/${id}`,
        name: (p.fullName ?? "").replace(/\s+/g, " "),
        position: p.primaryPosition?.abbreviation ?? null,
        team: team?.name ?? null,
        line,
        lineNote: null,
        headshot: mlbPortrait(id),
        action: mlbAction(id),
      });
    }),
  );
  return out;
}

type EspnAthlete = {
  athlete?: {
    displayName?: string;
    position?: { abbreviation?: string };
    team?: { displayName?: string };
    headshot?: { href?: string };
    statsSummary?: { displayName?: string; statistics?: { abbreviation?: string; displayValue?: string }[] };
  };
};

/** "2025 Regular Season Stats:" → "2025"; nothing when it is this season. */
export function seasonNote(label: string | null | undefined, season: number): string | null {
  const year = label?.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year || Number(year) === season) return null;
  return /post|playoff/i.test(label!) ? `${year} playoffs` : year;
}

async function espnFile(ref: PlayerRef, href: string, season: number): Promise<PlayerFile | null> {
  const [sport, league] = ref.path.split("/");
  const data = await json<EspnAthlete>(
    `https://site.web.api.espn.com/apis/common/v3/sports/${sport}/${league}/athletes/${ref.id}`,
  );
  const a = data?.athlete;
  if (!a?.displayName) return null;
  const stats = (a.statsSummary?.statistics ?? []).filter((s) => s.abbreviation && s.displayValue);
  const note = a.statsSummary?.displayName ?? null;
  return {
    href,
    name: a.displayName,
    position: a.position?.abbreviation ?? null,
    team: a.team?.displayName ?? null,
    line: stats.length ? stats.map((s) => `${s.displayValue} ${s.abbreviation}`).join(" · ") : null,
    lineNote: seasonNote(note, season),
    headshot: a.headshot?.href ?? espnPortrait(ref.path, ref.id),
    action: null,
  };
}

/** Files for every player href, keyed by href. Unknown routes are skipped. */
export async function fetchPlayerFiles(hrefs: string[], season: number): Promise<Record<string, PlayerFile>> {
  const refs = [...new Set(hrefs)].map((href) => ({ href, ref: playerRef(href) })).filter((r) => r.ref);
  const mlbIds = refs.filter((r) => r.ref!.path === "baseball/mlb").map((r) => r.ref!.id);
  const out: Record<string, PlayerFile> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < mlbIds.length; i += 40) chunks.push(mlbIds.slice(i, i + 40));
  const [mlb, espn] = await Promise.all([
    Promise.all(chunks.map((c) => mlbFiles(c, season))),
    Promise.all(refs.filter((r) => r.ref!.path !== "baseball/mlb").map((r) => espnFile(r.ref!, r.href, season))),
  ]);
  for (const map of mlb) for (const file of map.values()) out[file.href] = file;
  for (const file of espn) if (file) out[file.href] = file;
  return out;
}

/** True once the browser has the picture; false for a 404 or a timeout. */
export function imageLoads(src: string | null | undefined, timeoutMs = 8000): Promise<boolean> {
  if (!src || typeof Image === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img.naturalWidth > 1);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = src;
  });
}
