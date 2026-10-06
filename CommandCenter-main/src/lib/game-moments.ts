/**
 * Shared scoring-moment taxonomy for sports game-detail overlays.
 *
 * Sports-only: diffs scores / scoring plays already fetched on game detail
 * (MLB boxscore, ESPN NHL/NFL/CFB summaries). Does not depend on the MLB
 * 2D PBP panel. Leaves newspaper / Times / Telegram / RUWT heat alone.
 */


export type GameMomentSport = "mlb" | "nfl" | "nhl" | "cfb";

/**
 * Canonical event kinds the overlay can celebrate.
 * Add here first when wiring a new scoring type (soccer goal, pick-six, walk-off).
 */
export type GameMomentKind =
  | "score_change"
  | "run"
  | "home_run"
  | "goal"
  | "touchdown"
  | "field_goal"
  | "safety"
  | "score";

export type GameMomentIntensity = "high" | "medium";

export type GameMomentTeam = {
  id: string;
  abbrev: string;
  name: string;
  logo: string | null;
  color: string | null;
};

export type GameMomentPlayer = {
  id: string | null;
  name: string;
  shortName: string;
  headshot: string | null;
};

export type GameMomentScore = {
  away: number;
  home: number;
  awayAbbrev: string;
  homeAbbrev: string;
};

export type GameMoment = {
  id: string;
  sport: GameMomentSport;
  kind: GameMomentKind;
  headline: string;
  subhead: string | null;
  detail: string | null;
  team: GameMomentTeam | null;
  player: GameMomentPlayer | null;
  score: GameMomentScore | null;
  periodLabel: string | null;
  intensity: GameMomentIntensity;
};

export type ScoringPlaySnap = {
  id: string;
  text: string;
  clock: string | null;
  period: string | number | null;
  teamId: string | null;
  teamAbbrev: string | null;
  awayScore: number | null;
  homeScore: number | null;
  strength: string | null;
  tags: string[];
  eventType: string | null;
  rbi: number | null;
  player: GameMomentPlayer | null;
};

export type GameMomentSignals = {
  /** Sum of box-score home runs — used to classify MLB score jumps. */
  homeRuns: number;
  rbi: number;
  batter: GameMomentPlayer | null;
};

export type GameMomentSnapshot = {
  sport: GameMomentSport;
  gameId: string;
  live: boolean;
  away: GameMomentTeam & { score: number };
  home: GameMomentTeam & { score: number };
  periodLabel: string | null;
  scoringPlays: ScoringPlaySnap[];
  recentScoring: ScoringPlaySnap[];
  signals?: GameMomentSignals;
};

export const MOMENT_KIND_LABEL: Record<GameMomentKind, string> = {
  score_change: "SCORE",
  run: "RUN SCORED",
  home_run: "HOME RUN",
  goal: "GOAL",
  touchdown: "TOUCHDOWN",
  field_goal: "FIELD GOAL",
  safety: "SAFETY",
  score: "SCORE",
};

export function momentIntensity(kind: GameMomentKind): GameMomentIntensity {
  if (kind === "home_run" || kind === "goal" || kind === "touchdown") return "high";
  return "medium";
}

export function momentDurationMs(kind: GameMomentKind): number {
  return momentIntensity(kind) === "high" ? 3400 : 2600;
}

/** Accent hairline — cool, not neon. */
export function momentAccent(kind: GameMomentKind, teamColor?: string | null): string {
  if (kind === "goal") return "#8ec9e6";
  if (kind === "touchdown") return "#d4b46a";
  if (kind === "home_run") return "#e0c48a";
  if (kind === "field_goal") return "#c4a56a";
  if (kind === "run") return "#d8dee8";
  if (teamColor && /^[0-9a-f]{6}$/i.test(teamColor.replace(/^#/, ""))) {
    return `#${teamColor.replace(/^#/, "")}`;
  }
  return "rgba(255,255,255,0.55)";
}

export function classifyFootballScore(text: string, tags: string[] = []): GameMomentKind {
  const blob = `${tags.join(" ")} ${text}`.toLowerCase();
  if (/\btouchdown\b|\btd\b/.test(blob) || tags.includes("TD")) return "touchdown";
  if (/\bfield goal\b|\bfg\b/.test(blob) || tags.includes("FG")) return "field_goal";
  if (/\bsafety\b/.test(blob)) return "safety";
  if (/two[- ]?point|2[- ]?pt/.test(blob)) return "score";
  return "score_change";
}

export function classifyNhlGoal(strength: string | null | undefined, text: string): {
  kind: GameMomentKind;
  headline: string;
} {
  const blob = `${strength ?? ""} ${text}`.toLowerCase();
  if (/\bempty ?net\b|\ben\b/.test(blob)) return { kind: "goal", headline: "EMPTY NET GOAL" };
  if (/\bshorthanded\b|\bshg\b|\bsh\b/.test(blob)) return { kind: "goal", headline: "SHORTHANDED GOAL" };
  if (/\bpower play\b|\bppg\b|\bpp\b/.test(blob)) return { kind: "goal", headline: "POWER PLAY GOAL" };
  return { kind: "goal", headline: "GOAL" };
}

export function classifyMlbPlay(play: {
  event?: string | null;
  eventType?: string | null;
  description?: string | null;
  rbi?: number | null;
}): GameMomentKind {
  const ev = `${play.eventType ?? ""} ${play.event ?? ""}`.toLowerCase();
  if (/home_run|home run/.test(ev) || /homers|grand slam|home run/i.test(play.description ?? "")) {
    return "home_run";
  }
  if ((play.rbi ?? 0) > 0 || mlbPlayLooksLikeScore(play.description)) return "run";
  return "score_change";
}

export function mlbPlayLooksLikeScore(description: string | null | undefined): boolean {
  return /\bscores?\b|homers|grand slam|home run/i.test(description ?? "");
}

export function classifyMlbScoreJump(
  next: GameMomentSnapshot,
  prev: GameMomentSnapshot | null,
): GameMomentKind {
  const hrUp = (next.signals?.homeRuns ?? 0) > (prev?.signals?.homeRuns ?? 0);
  if (hrUp) return "home_run";
  return "run";
}

const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;

export function shortMomentName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName.toUpperCase();
  let last = parts[parts.length - 1]!;
  let used = 1;
  if (NAME_SUFFIX.test(last) && parts.length >= 3) {
    last = `${parts[parts.length - 2]} ${last}`;
    used = 2;
  }
  const first = parts[0]!;
  if (parts.length - used < 1) return fullName.toUpperCase();
  return `${first[0]!.toUpperCase()}. ${last}`.toUpperCase();
}

function sideFromAbbrev(
  snap: GameMomentSnapshot,
  abbrev: string | null,
  teamId: string | null,
): GameMomentTeam & { score: number } {
  if (teamId && String(snap.away.id) === String(teamId)) return snap.away;
  if (teamId && String(snap.home.id) === String(teamId)) return snap.home;
  const a = (abbrev ?? "").toUpperCase();
  if (a && snap.away.abbrev.toUpperCase() === a) return snap.away;
  if (a && snap.home.abbrev.toUpperCase() === a) return snap.home;
  return snap.away.score >= snap.home.score ? snap.away : snap.home;
}

function scoreboard(snap: GameMomentSnapshot, play?: ScoringPlaySnap | null): GameMomentScore {
  return {
    away: play?.awayScore ?? snap.away.score,
    home: play?.homeScore ?? snap.home.score,
    awayAbbrev: snap.away.abbrev,
    homeAbbrev: snap.home.abbrev,
  };
}

function mlbHeadline(kind: GameMomentKind, rbi: number | null, runDelta: number): string {
  if (kind === "home_run") {
    if (rbi === 4 || runDelta >= 4) return "GRAND SLAM";
    if (rbi === 3 || runDelta === 3) return "3-RUN HOME RUN";
    if (rbi === 2 || runDelta === 2) return "2-RUN HOME RUN";
    return "HOME RUN";
  }
  if (runDelta > 1) return `${runDelta} RUNS SCORED`;
  if (rbi != null && rbi > 1) return `${rbi} RUNS SCORED`;
  return "RUN SCORED";
}

export function buildMomentFromPlay(snap: GameMomentSnapshot, play: ScoringPlaySnap): GameMoment {
  const team = sideFromAbbrev(snap, play.teamAbbrev, play.teamId);
  let kind: GameMomentKind = "score_change";
  let headline = MOMENT_KIND_LABEL.score_change;

  if (snap.sport === "mlb") {
    kind = classifyMlbPlay({
      event: play.eventType,
      eventType: play.eventType,
      description: play.text,
      rbi: play.rbi,
    });
    const runDelta = Math.max(play.rbi ?? 0, 1);
    headline = mlbHeadline(kind, play.rbi, runDelta);
  } else if (snap.sport === "nhl") {
    const goal = classifyNhlGoal(play.strength, play.text);
    kind = goal.kind;
    headline = goal.headline;
  } else {
    kind = classifyFootballScore(play.text, play.tags);
    headline = MOMENT_KIND_LABEL[kind];
  }

  const period =
    play.clock && play.period != null
      ? `${String(play.period).toString().toUpperCase()} · ${play.clock}`
      : play.clock || (play.period != null ? String(play.period) : snap.periodLabel);

  return {
    id: `${snap.sport}:${snap.gameId}:${play.id}`,
    sport: snap.sport,
    kind,
    headline,
    subhead: play.player?.shortName ?? play.player?.name ?? team.abbrev,
    detail: play.text || null,
    team,
    player: play.player,
    score: scoreboard(snap, play),
    periodLabel: period,
    intensity: momentIntensity(kind),
  };
}

function buildScoreChangeMoment(
  snap: GameMomentSnapshot,
  side: "away" | "home",
  prev: GameMomentSnapshot | null,
): GameMoment {
  const team = snap[side];
  const prevScore = prev ? prev[side].score : 0;
  const delta = snap[side].score - prevScore;
  const kind: GameMomentKind =
    snap.sport === "mlb"
      ? classifyMlbScoreJump(snap, prev)
      : snap.sport === "nhl"
        ? "goal"
        : "score_change";
  const headline =
    snap.sport === "mlb"
      ? mlbHeadline(kind, null, Math.max(delta, 1))
      : snap.sport === "nhl"
        ? "GOAL"
        : "SCORE";
  const player = snap.signals?.batter ?? null;
  return {
    id: `${snap.sport}:${snap.gameId}:score:${snap.away.score}-${snap.home.score}`,
    sport: snap.sport,
    kind,
    headline,
    subhead: player?.shortName ?? team.abbrev,
    detail: null,
    team,
    player,
    score: scoreboard(snap),
    periodLabel: snap.periodLabel,
    intensity: momentIntensity(kind),
  };
}

/**
 * Diff two snapshots. First observation is the caller's job to seed —
 * pass `prev = null` to get no celebrations (mount / historical score).
 */
export function diffGameMoments(
  prev: GameMomentSnapshot | null,
  next: GameMomentSnapshot,
): GameMoment[] {
  if (!prev) return [];
  if (prev.gameId !== next.gameId || prev.sport !== next.sport) return [];

  const seen = new Set([
    ...prev.scoringPlays.map((p) => p.id),
    ...prev.recentScoring.map((p) => p.id),
  ]);
  const incoming = [...next.scoringPlays, ...next.recentScoring];
  const fresh: ScoringPlaySnap[] = [];
  const used = new Set<string>();
  for (const play of incoming) {
    if (!play.id || seen.has(play.id) || used.has(play.id)) continue;
    used.add(play.id);
    fresh.push(play);
  }

  const moments = fresh.map((play) => buildMomentFromPlay(next, play));
  const awayUp = next.away.score > prev.away.score;
  const homeUp = next.home.score > prev.home.score;
  if (moments.length === 0 && (awayUp || homeUp)) {
    moments.push(buildScoreChangeMoment(next, awayUp ? "away" : "home", prev));
  }
  return moments;
}

/** Latest scoring moment on a snapshot — preview / replay, not live-diff. */
export function latestMoment(snapshot: GameMomentSnapshot): GameMoment | null {
  const play = snapshot.scoringPlays[snapshot.scoringPlays.length - 1]
    ?? snapshot.recentScoring[0]
    ?? null;
  if (play) return buildMomentFromPlay(snapshot, play);
  if (snapshot.away.score > 0 || snapshot.home.score > 0) {
    const side = snapshot.home.score >= snapshot.away.score ? "home" : "away";
    return buildScoreChangeMoment(snapshot, side, null);
  }
  return null;
}

/** Public preview fixtures — real marks, no cream discs. */
export function demoMoment(kind: GameMomentKind): GameMoment {
  const mlbAway = {
    id: "147",
    abbrev: "NYY",
    name: "Yankees",
    logo: "https://www.mlbstatic.com/team-logos/team-primary-on-light/147.svg",
    color: "132448",
  };
  const mlbHome = {
    id: "139",
    abbrev: "TB",
    name: "Rays",
    logo: "https://www.mlbstatic.com/team-logos/team-primary-on-light/139.svg",
    color: "092c5c",
  };
  const nhlAway = {
    id: "20",
    abbrev: "TB",
    name: "Lightning",
    logo: "https://a.espncdn.com/i/teamlogos/nhl/500/tb.png",
    color: "002868",
  };
  const nhlHome = {
    id: "1",
    abbrev: "BOS",
    name: "Bruins",
    logo: "https://a.espncdn.com/i/teamlogos/nhl/500/bos.png",
    color: "000000",
  };
  const nflAway = {
    id: "10",
    abbrev: "KC",
    name: "Chiefs",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png",
    color: "e31837",
  };
  const nflHome = {
    id: "12",
    abbrev: "BUF",
    name: "Bills",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png",
    color: "00338d",
  };

  const base = {
    id: `demo:${kind}`,
    kind,
    headline: MOMENT_KIND_LABEL[kind],
    intensity: momentIntensity(kind),
    player: null as GameMomentPlayer | null,
    detail: null as string | null,
    periodLabel: null as string | null,
    subhead: null as string | null,
    team: null as GameMomentTeam | null,
    score: null as GameMomentScore | null,
    sport: "mlb" as GameMomentSport,
  };

  if (kind === "home_run" || kind === "run") {
    return {
      ...base,
      sport: "mlb",
      headline: kind === "home_run" ? "HOME RUN" : "RUN SCORED",
      subhead: kind === "home_run" ? "R. PALACIOS" : "J. DELUCA",
      detail:
        kind === "home_run"
          ? "Richardson Palacios homers on a fly ball to right field."
          : "Jonny DeLuca grounds into a fielder's choice.  Chandler Simpson scores.",
      team: mlbHome,
      player: {
        id: kind === "home_run" ? "1" : "2",
        name: kind === "home_run" ? "Richardson Palacios" : "Jonny DeLuca",
        shortName: kind === "home_run" ? "R. PALACIOS" : "J. DELUCA",
        headshot: null,
      },
      score: { away: 0, home: kind === "home_run" ? 2 : 1, awayAbbrev: "NYY", homeAbbrev: "TB" },
      periodLabel: kind === "home_run" ? "BOT 4TH" : "BOT 2ND",
    };
  }

  if (kind === "goal") {
    return {
      ...base,
      sport: "nhl",
      headline: "POWER PLAY GOAL",
      subhead: "B. POINT",
      detail: "Brayden Point slap shot from the circle.",
      team: nhlAway,
      player: {
        id: "2563060",
        name: "Brayden Point",
        shortName: "B. POINT",
        headshot: "https://a.espncdn.com/i/headshots/nhl/players/full/2563060.png",
      },
      score: { away: 3, home: 2, awayAbbrev: "TB", homeAbbrev: "BOS" },
      periodLabel: "2ND · 12:41",
    };
  }

  if (kind === "touchdown" || kind === "field_goal" || kind === "safety" || kind === "score") {
    return {
      ...base,
      sport: "nfl",
      headline: MOMENT_KIND_LABEL[kind],
      subhead: kind === "touchdown" ? "J. ALLEN" : "T. BASS",
      detail:
        kind === "touchdown"
          ? "Josh Allen 6 yd rush for a touchdown."
          : kind === "field_goal"
            ? "Tyler Bass 41 yd field goal."
            : kind === "safety"
              ? "Chiefs safety, tackled in the end zone."
              : "Josh Allen rush for a 2-pt conversion.",
      team: nflHome,
      player: {
        id: kind === "touchdown" ? "3918298" : "3916433",
        name: kind === "touchdown" ? "Josh Allen" : "Tyler Bass",
        shortName: kind === "touchdown" ? "J. ALLEN" : "T. BASS",
        headshot: `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${kind === "touchdown" ? "3918298" : "3916433"}.png&w=423&h=423`,
      },
      score: { away: 14, home: kind === "field_goal" ? 17 : 21, awayAbbrev: "KC", homeAbbrev: "BUF" },
      periodLabel: "Q3 · 4:21",
    };
  }

  return {
    ...base,
    sport: "mlb",
    headline: "SCORE",
    subhead: mlbAway.abbrev,
    team: mlbAway,
    score: { away: 2, home: 1, awayAbbrev: "NYY", homeAbbrev: "TB" },
    periodLabel: "TOP 6TH",
  };
}

export const DEMO_MOMENT_KINDS: GameMomentKind[] = [
  "run",
  "home_run",
  "goal",
  "touchdown",
  "field_goal",
  "score_change",
];
