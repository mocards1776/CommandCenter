/** Recent W-L form for teams (MLB via Stats API, NFL via ESPN scoreboard history). */

import { chicagoToday } from "./mlb";

export type TeamFormStrip = {
  teamId: number | string;
  abbrev: string;
  name: string;
  record: string | null;
  standing: string | null;
  last5: string;
  last10: string;
  last20: string;
};

function ordinalPlace(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/** Compact L5 / L10 / L20 line for team box scores. */
export function formatTeamFormLine(form: TeamFormStrip | null | undefined): string | null {
  if (!form) return null;
  return `L5 ${form.last5} · L10 ${form.last10} · L20 ${form.last20}`;
}

function formRecord(results: boolean[], n: number): string {
  const slice = results.slice(-n);
  if (!slice.length) return "—";
  const w = slice.filter(Boolean).length;
  return `${w}-${slice.length - w}`;
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/** MLB / MiLB team form from recent finals on the schedule. */
export async function fetchMlbTeamForm(
  teamId: number,
  sportId?: number | null,
): Promise<TeamFormStrip> {
  const end = chicagoToday();
  const start = addDaysIso(end, -45);
  // Include Single-A → MLB so farm game pages get L5/L10/L20.
  const sportIds =
    sportId != null && sportId > 0 && sportId !== 1
      ? String(sportId)
      : "1,11,12,13,14";
  const [schedRes, standRes] = await Promise.all([
    fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportIds=${sportIds}&teamId=${teamId}&startDate=${start}&endDate=${end}`,
      { headers: { Accept: "application/json" } },
    ),
    sportId != null && sportId > 1
      ? Promise.resolve(null)
      : fetch(
          `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${end.slice(0, 4)}&standingsTypes=regularSeason`,
          { headers: { Accept: "application/json" } },
        ),
  ]);
  const wins: boolean[] = [];
  let abbrev = "—";
  let name = "Team";
  let record: string | null = null;
  if (schedRes.ok) {
    const sched = (await schedRes.json()) as {
      dates?: {
        games?: {
          officialDate?: string;
          status?: { abstractGameState?: string };
          teams?: {
            away?: {
              team?: { id?: number; name?: string; abbreviation?: string };
              isWinner?: boolean;
              leagueRecord?: { wins?: number; losses?: number };
            };
            home?: {
              team?: { id?: number; name?: string; abbreviation?: string };
              isWinner?: boolean;
              leagueRecord?: { wins?: number; losses?: number };
            };
          };
        }[];
      }[];
    };
    const rows: { date: string; won: boolean }[] = [];
    for (const day of sched.dates ?? []) {
      for (const g of day.games ?? []) {
        if (g.status?.abstractGameState !== "Final") continue;
        const home = g.teams?.home;
        const away = g.teams?.away;
        if (!home || !away) continue;
        const us = home.team?.id === teamId ? home : away;
        if (us.team?.id !== teamId) continue;
        abbrev = us.team?.abbreviation ?? abbrev;
        name = us.team?.name ?? name;
        if (us.leagueRecord) {
          record = `${us.leagueRecord.wins ?? 0}-${us.leagueRecord.losses ?? 0}`;
        }
        rows.push({
          date: g.officialDate ?? "",
          won: Boolean(us.isWinner),
        });
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    for (const r of rows) wins.push(r.won);
  }

  let standing: string | null = null;
  if (standRes?.ok) {
    const stand = (await standRes.json()) as {
      records?: {
        league?: { id?: number; name?: string };
        division?: { name?: string };
        teamRecords?: {
          team?: { id?: number };
          divisionRank?: string;
          leagueRank?: string;
          leagueRecord?: { wins?: number; losses?: number };
        }[];
      }[];
    };
    for (const block of stand.records ?? []) {
      for (const row of block.teamRecords ?? []) {
        if (row.team?.id !== teamId) continue;
        const rawDiv = block.division?.name ?? "";
        const leagueName =
          block.league?.id === 104 || /national/i.test(rawDiv) || /national/i.test(block.league?.name ?? "")
            ? "National League"
            : block.league?.id === 103 || /american/i.test(rawDiv) || /american/i.test(block.league?.name ?? "")
              ? "American League"
              : /national/i.test(rawDiv)
                ? "National League"
                : /american/i.test(rawDiv)
                  ? "American League"
                  : "league";
        const rankNum = Number.parseInt(String(row.leagueRank ?? ""), 10);
        standing =
          Number.isFinite(rankNum) && rankNum > 0
            ? `${ordinalPlace(rankNum)} in ${leagueName}`
            : row.leagueRank
              ? `${row.leagueRank} in ${leagueName}`
              : null;
        if (!record && row.leagueRecord) {
          record = `${row.leagueRecord.wins ?? 0}-${row.leagueRecord.losses ?? 0}`;
        }
      }
    }
  }

  return {
    teamId,
    abbrev,
    name,
    record,
    standing,
    last5: formRecord(wins, 5),
    last10: formRecord(wins, 10),
    last20: formRecord(wins, 20),
  };
}

export type MlbFormStandingRow = {
  rank: number;
  teamId: number;
  team: string;
  abbrev: string;
  wins: number;
  losses: number;
  pct: string;
};

export type MlbFormStandingsBoard = {
  window: number;
  label: string;
  rows: MlbFormStandingRow[];
};

function pctString(wins: number, losses: number): string {
  const g = wins + losses;
  if (!g) return "—";
  return (wins / g).toFixed(3).replace(/^0/, "");
}

/** League-wide standings by record over the last N games (5…50). */
export async function fetchMlbFormStandings(
  windows: number[] = [5, 10, 20, 30, 40, 50],
): Promise<MlbFormStandingsBoard[]> {
  const end = chicagoToday();
  const span = Math.max(...windows, 50) + 10;
  const start = addDaysIso(end, -Math.ceil(span * 1.6));
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${start}&endDate=${end}&gameType=R`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Form standings schedule failed (${res.status})`);
  const sched = (await res.json()) as {
    dates?: {
      games?: {
        officialDate?: string;
        status?: { abstractGameState?: string };
        teams?: {
          away?: {
            team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
            isWinner?: boolean;
          };
          home?: {
            team?: { id?: number; name?: string; abbreviation?: string; teamName?: string };
            isWinner?: boolean;
          };
        };
      }[];
    }[];
  };

  type TeamAcc = {
    teamId: number;
    name: string;
    abbrev: string;
    results: boolean[];
  };
  const byTeam = new Map<number, TeamAcc>();
  const dayRows: { date: string; teamId: number; won: boolean; name: string; abbrev: string }[] =
    [];

  for (const day of sched.dates ?? []) {
    for (const g of day.games ?? []) {
      if (g.status?.abstractGameState !== "Final") continue;
      const date = g.officialDate ?? "";
      for (const side of [g.teams?.away, g.teams?.home]) {
        const id = side?.team?.id;
        if (!id || side?.isWinner == null) continue;
        const full = side.team?.name ?? "Team";
        const short = (side.team?.teamName ?? full).replace(
          /^(St\. Louis|Chicago|New York|Los Angeles|Tampa Bay|Kansas City|San Francisco|San Diego|Toronto) /,
          "",
        );
        dayRows.push({
          date,
          teamId: id,
          won: Boolean(side.isWinner),
          name: short,
          abbrev: side.team?.abbreviation ?? "—",
        });
      }
    }
  }
  dayRows.sort((a, b) => a.date.localeCompare(b.date));
  for (const r of dayRows) {
    let acc = byTeam.get(r.teamId);
    if (!acc) {
      acc = { teamId: r.teamId, name: r.name, abbrev: r.abbrev, results: [] };
      byTeam.set(r.teamId, acc);
    }
    acc.results.push(r.won);
    acc.name = r.name;
    acc.abbrev = r.abbrev;
  }

  return windows.map((window) => {
    const rows: MlbFormStandingRow[] = [...byTeam.values()]
      .map((t) => {
        const slice = t.results.slice(-window);
        const wins = slice.filter(Boolean).length;
        const losses = slice.length - wins;
        return {
          rank: 0,
          teamId: t.teamId,
          team: t.name,
          abbrev: t.abbrev,
          wins,
          losses,
          pct: pctString(wins, losses),
        };
      })
      .filter((r) => r.wins + r.losses > 0)
      .sort((a, b) => {
        const pa = a.wins + a.losses ? a.wins / (a.wins + a.losses) : 0;
        const pb = b.wins + b.losses ? b.wins / (b.wins + b.losses) : 0;
        if (pb !== pa) return pb - pa;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.team.localeCompare(b.team);
      })
      .map((r, i) => ({ ...r, rank: i + 1 }));

    return {
      window,
      label: `Last ${window}`,
      rows,
    };
  });
}

/** NFL team form from recent ESPN scoreboard days. */
export async function fetchNflTeamForm(
  teamId: number | string,
  abbrevHint?: string,
): Promise<TeamFormStrip> {
  const id = String(teamId);
  const wins: boolean[] = [];
  let abbrev = abbrevHint ?? "—";
  let name = "Team";
  let record: string | null = null;
  const today = new Date();
  for (let i = 0; i < 28; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${y}${m}${day}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) continue;
      const board = (await res.json()) as {
        events?: {
          competitions?: {
            status?: { type?: { state?: string; completed?: boolean } };
            competitors?: {
              homeAway?: string;
              winner?: boolean;
              score?: string | number;
              records?: { type?: string; summary?: string }[];
              team?: { id?: string; abbreviation?: string; displayName?: string };
            }[];
          }[];
        }[];
      };
      for (const event of board.events ?? []) {
        const comp = event.competitions?.[0];
        const status = comp?.status?.type;
        const final = status?.state === "post" || status?.completed === true;
        if (!final) continue;
        const us = (comp?.competitors ?? []).find((c) => String(c.team?.id) === id);
        if (!us) continue;
        abbrev = us.team?.abbreviation ?? abbrev;
        name = us.team?.displayName ?? name;
        const rec = (us.records ?? []).find((r) => r.type === "total")?.summary;
        if (rec) record = rec;
        wins.push(Boolean(us.winner));
      }
    } catch {
      /* skip day */
    }
  }
  // wins collected newest-first from the loop — reverse to chronological.
  wins.reverse();

  let standing: string | null = null;
  try {
    const standRes = await fetch(
      "https://site.api.espn.com/apis/v2/sports/football/nfl/standings",
      { headers: { Accept: "application/json" } },
    );
    if (standRes.ok) {
      const stand = (await standRes.json()) as {
        children?: {
          name?: string;
          children?: {
            name?: string;
            standings?: {
              entries?: {
                team?: { id?: string };
                stats?: { name?: string; value?: number; displayValue?: string }[];
              }[];
            };
          }[];
          standings?: {
            entries?: {
              team?: { id?: string };
              stats?: { name?: string; value?: number; displayValue?: string }[];
            }[];
          };
        }[];
      };
      outer: for (const conf of stand.children ?? []) {
        const divs = conf.children?.length ? conf.children : [conf];
        for (const div of divs) {
          for (const entry of div.standings?.entries ?? []) {
            if (String(entry.team?.id) !== id) continue;
            const rankStat = (entry.stats ?? []).find(
              (s) => s.name === "rank" || s.name === "playoffseed",
            );
            const rank = Number(rankStat?.value ?? rankStat?.displayValue ?? NaN);
            const divName = (div.name ?? conf.name ?? "")
              .replace(/American Football Conference/i, "AFC")
              .replace(/National Football Conference/i, "NFC")
              .replace(/\s+Division$/i, "");
            standing =
              Number.isFinite(rank) && rank > 0 && divName
                ? `${ordinalPlace(rank)} in ${divName}`
                : divName || null;
            break outer;
          }
        }
      }
    }
  } catch {
    /* standings optional */
  }

  return {
    teamId: id,
    abbrev,
    name,
    record,
    standing,
    last5: formRecord(wins, 5),
    last10: formRecord(wins, 10),
    last20: formRecord(wins, 20),
  };
}

export type CategoryLeader = {
  category: string;
  abbrev: string;
  playerId: number;
  name: string;
  shortName: string;
  value: string;
  line: string;
};

/** Cardinals-style batting / pitching category leaders (with photos). */
export async function fetchMlbTeamCategoryLeaders(
  teamId: number,
  abbrev: string,
): Promise<{ batting: CategoryLeader[]; pitching: CategoryLeader[] }> {
  const season = Number(chicagoToday().slice(0, 4));
  async function topHit(
    sortStat: string,
    category: string,
    abbrevLabel: string,
    format: (stat: Record<string, unknown>) => { value: string; line: string } | null,
    opts?: { minAb?: number },
  ): Promise<CategoryLeader | null> {
    const url =
      `https://statsapi.mlb.com/api/v1/stats?stats=season&group=hitting&season=${season}` +
      `&teamIds=${teamId}&sportIds=1&playerPool=all&limit=12&order=desc&sortStat=${sortStat}`;
    const raw = (await fetch(url, { headers: { Accept: "application/json" } }).then((r) =>
      r.json(),
    )) as {
      stats?: {
        splits?: {
          player?: { id?: number; fullName?: string };
          stat?: Record<string, unknown>;
        }[];
      }[];
    };
    for (const s of raw.stats?.[0]?.splits ?? []) {
      const ab = Number(s.stat?.atBats ?? 0);
      if (opts?.minAb != null && ab < opts.minAb) continue;
      const formatted = format(s.stat ?? {});
      if (!formatted || !s.player?.id) continue;
      const full = s.player.fullName ?? "—";
      const parts = full.trim().split(/\s+/);
      const short =
        parts.length >= 2
          ? `${parts[0]![0]}. ${parts[parts.length - 1]}`
          : full;
      return {
        category,
        abbrev: abbrevLabel,
        playerId: s.player.id,
        name: full,
        shortName: short,
        value: formatted.value,
        line: `${abbrev} · ${formatted.line}`,
      };
    }
    return null;
  }

  async function topPitch(
    sortStat: string,
    category: string,
    abbrevLabel: string,
    order: "asc" | "desc",
    format: (stat: Record<string, unknown>) => { value: string; line: string } | null,
    opts?: { minIp?: number },
  ): Promise<CategoryLeader | null> {
    const url =
      `https://statsapi.mlb.com/api/v1/stats?stats=season&group=pitching&season=${season}` +
      `&teamIds=${teamId}&sportIds=1&playerPool=all&limit=12&order=${order}&sortStat=${sortStat}`;
    const raw = (await fetch(url, { headers: { Accept: "application/json" } }).then((r) =>
      r.json(),
    )) as {
      stats?: {
        splits?: {
          player?: { id?: number; fullName?: string };
          stat?: Record<string, unknown>;
        }[];
      }[];
    };
    for (const s of raw.stats?.[0]?.splits ?? []) {
      const ip = parseFloat(String(s.stat?.inningsPitched ?? 0));
      if (opts?.minIp != null && !(ip >= opts.minIp)) continue;
      const formatted = format(s.stat ?? {});
      if (!formatted || !s.player?.id) continue;
      const full = s.player.fullName ?? "—";
      const parts = full.trim().split(/\s+/);
      const short =
        parts.length >= 2
          ? `${parts[0]![0]}. ${parts[parts.length - 1]}`
          : full;
      return {
        category,
        abbrev: abbrevLabel,
        playerId: s.player.id,
        name: full,
        shortName: short,
        value: formatted.value,
        line: `${abbrev} · ${formatted.line}`,
      };
    }
    return null;
  }

  const batting = (
    await Promise.all([
      topHit("homeRuns", "Home runs", "HR", (s) => ({
        value: String(s.homeRuns ?? 0),
        line: `${s.avg ?? "—"} AVG · ${s.rbi ?? 0} RBI`,
      })),
      topHit(
        "avg",
        "Average",
        "AVG",
        (s) => ({
          value: String(s.avg ?? "—"),
          line: `${s.homeRuns ?? 0} HR · ${s.rbi ?? 0} RBI`,
        }),
        { minAb: 100 },
      ),
      topHit("rbi", "RBI", "RBI", (s) => ({
        value: String(s.rbi ?? 0),
        line: `${s.homeRuns ?? 0} HR · ${s.avg ?? "—"} AVG`,
      })),
      topHit("stolenBases", "Stolen bases", "SB", (s) => ({
        value: String(s.stolenBases ?? 0),
        line: `${s.avg ?? "—"} AVG · ${s.homeRuns ?? 0} HR`,
      })),
    ])
  ).filter((x): x is CategoryLeader => Boolean(x));

  const pitching = (
    await Promise.all([
      topPitch(
        "era",
        "ERA",
        "ERA",
        "asc",
        (s) => ({
          value: String(s.era ?? "—"),
          line: `${s.wins ?? 0}-${s.losses ?? 0} · ${s.inningsPitched ?? "—"} IP`,
        }),
        { minIp: 40 },
      ),
      topPitch("strikeOuts", "Strikeouts", "SO", "desc", (s) => ({
        value: String(s.strikeOuts ?? 0),
        line: `${s.era ?? "—"} ERA · ${s.inningsPitched ?? "—"} IP`,
      })),
      topPitch("wins", "Wins", "W", "desc", (s) => ({
        value: String(s.wins ?? 0),
        line: `${s.era ?? "—"} ERA · ${s.strikeOuts ?? 0} SO`,
      })),
      topPitch("saves", "Saves", "SV", "desc", (s) => ({
        value: String(s.saves ?? 0),
        line: `${s.era ?? "—"} ERA · ${s.strikeOuts ?? 0} SO`,
      })),
    ])
  ).filter((x): x is CategoryLeader => Boolean(x));

  return { batting, pitching };
}
