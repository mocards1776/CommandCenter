import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMlbTeamBbrefSummary,
  fetchMlbTeamLeaderCards,
  fetchMlbTeamPayroll,
  fetchMlbTeamWinTrend,
  leaderHeadshot,
  type MlbTeamLeaderCard,
  type MlbTeamWinTrendHonor,
} from "@/lib/mlb-team-page";
import { cn } from "@/lib/utils";

function readableAccent(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#e8e4d9";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.42 ? "#e8e4d9" : hex;
}

const HONOR_META: Record<
  MlbTeamWinTrendHonor,
  { label: string; title: string; className: string }
> = {
  DIV: {
    label: "DIV",
    title: "Division champion",
    className: "border-sky-400/40 bg-sky-500/15 text-sky-200",
  },
  WC: {
    label: "WC",
    title: "Wild card",
    className: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  },
  LCS: {
    label: "LCS",
    title: "League champion",
    className: "border-violet-400/40 bg-violet-500/15 text-violet-200",
  },
  WS: {
    label: "WS",
    title: "World Series champion",
    className: "border-yellow-400/50 bg-yellow-500/20 text-yellow-100",
  },
};

export function MlbTeamOrgSummary({
  abbrev,
  accent,
  playoffOdds,
  wildCardOdds,
  fallbackRecord,
  fallbackStanding,
  fallbackManager,
  fallbackPresident,
  season = new Date().getFullYear(),
}: {
  abbrev: string;
  accent: string;
  playoffOdds?: string | null;
  wildCardOdds?: string | null;
  fallbackRecord?: string | null;
  fallbackStanding?: string | null;
  fallbackManager?: { id?: number; name: string; record?: string | null } | null;
  fallbackPresident?: string | null;
  season?: number;
}) {
  const summary = useQuery({
    queryKey: ["mlb-team-bbref-summary", abbrev, season],
    queryFn: () => fetchMlbTeamBbrefSummary(abbrev, season),
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const s = summary.data;

  if (summary.isPending) {
    return (
      <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c] px-4 py-4">
        <p className="text-chalk-dim animate-pulse text-[12px]">Loading team overview…</p>
      </section>
    );
  }

  const recordColor = readableAccent(accent);

  const bbrefPost = s?.playoffOdds?.postseason;
  const bbrefWs = s?.playoffOdds?.worldSeries;
  const oddsLine = bbrefPost
    ? `${bbrefPost} to make postseason${bbrefWs ? `, ${bbrefWs} to win World Series` : ""}`
    : playoffOdds
      ? `Make postseason ${playoffOdds}${wildCardOdds ? ` · WC ${wildCardOdds}` : ""}`
      : null;

  const managerName = s?.manager?.name ?? fallbackManager?.name ?? null;
  const managerRecord = s?.manager?.record ?? fallbackManager?.record ?? null;
  const managerId = fallbackManager?.id;

  const rows: { label: string; value: ReactNode }[] = [];
  const record = s?.record ?? fallbackRecord;
  const standing = s?.standing ?? fallbackStanding;
  if (record) {
    rows.push({
      label: "Record",
      value: (
        <span>
          <span className="numeral text-[18px] font-semibold" style={{ color: recordColor }}>
            {record}
          </span>
          {standing ? <span className="text-chalk ml-2 text-[12px]">{standing}</span> : null}
        </span>
      ),
    });
  }
  if (oddsLine) {
    rows.push({
      label: "Playoff odds",
      value: <span className="text-cream text-[13px]">{oddsLine}</span>,
    });
  }
  if (managerName) {
    rows.push({
      label: "Manager",
      value: (
        <span className="text-cream text-[13px]">
          {managerId ? (
            <Link to={`/sports/mlb/managers/${managerId}`} className="hover:text-accent hover:underline">
              {managerName}
            </Link>
          ) : (
            managerName
          )}
          {managerRecord ? ` (${managerRecord})` : ""}
        </span>
      ),
    });
  }
  const president = s?.president ?? fallbackPresident;
  if (president) rows.push({ label: "President", value: president });
  if (s?.farmDirector) rows.push({ label: "Farm Director", value: s.farmDirector });
  if (s?.scoutingDirector) rows.push({ label: "Scouting Director", value: s.scoutingDirector });
  if (s?.ballpark) rows.push({ label: "Ballpark", value: s.ballpark });
  if (s?.attendance) rows.push({ label: "Attendance", value: s.attendance });
  if (s?.parkFactors?.multiYear || s?.parkFactors?.oneYear) {
    rows.push({
      label: "Park Factors",
      value: (
        <span className="text-[12px] leading-relaxed text-[#d5dae6]">
          {s.parkFactors.multiYear
            ? `Multi-year: Batting ${s.parkFactors.multiYear.batting}, Pitching ${s.parkFactors.multiYear.pitching}`
            : null}
          {s.parkFactors.multiYear && s.parkFactors.oneYear ? " · " : null}
          {s.parkFactors.oneYear
            ? `One-year: Batting ${s.parkFactors.oneYear.batting}, Pitching ${s.parkFactors.oneYear.pitching}`
            : null}
          <span className="text-chalk-dim mt-0.5 block text-[11px]">
            {s.parkFactors.note || "Over 100 favors batters, under 100 favors pitchers."}
          </span>
        </span>
      ),
    });
  }
  if (s?.pythagorean?.record) {
    rows.push({
      label: "Pythagorean W-L",
      value: (
        <span className="text-cream text-[13px]">
          <span className="numeral">{s.pythagorean.record}</span>
          {s.pythagorean.runsScored != null && s.pythagorean.runsAllowed != null
            ? ` · ${s.pythagorean.runsScored} Runs, ${s.pythagorean.runsAllowed} Runs Allowed`
            : ""}
        </span>
      ),
    });
  }

  if (rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-[15px] font-semibold text-white">{season} Statistics</h3>
      </div>
      <dl className="divide-y divide-white/[0.06]">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-3 px-4 py-2.5">
            <dt className="text-chalk-dim w-28 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em]">
              {r.label}
            </dt>
            <dd className="min-w-0 text-[13px] text-[#e8e4d9]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MlbTeamWinTrend({
  teamId,
  accent,
}: {
  teamId: number;
  accent: string;
}) {
  const trend = useQuery({
    queryKey: ["mlb-team-win-trend", teamId],
    queryFn: () => fetchMlbTeamWinTrend(teamId, 5),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  if (trend.isPending) {
    return <p className="text-chalk-dim animate-pulse text-[12px]">Loading win trend…</p>;
  }
  const rows = trend.data ?? [];
  if (rows.length === 0) return null;
  const maxWins = Math.max(100, ...rows.map((r) => r.wins));

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-[15px] font-semibold text-white">5-Year Win Trend</h3>
        <p className="text-chalk-dim mt-0.5 text-[11px] uppercase tracking-[0.14em]">
          Regular season wins
        </p>
      </div>
      <ul className="flex flex-col gap-2.5 px-4 py-4">
        {rows.map((r) => (
          <li key={r.season} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2">
            <span className="numeral text-chalk text-[12px]">{r.season}</span>
            <div className="h-3.5 overflow-hidden rounded-sm bg-white/[0.06]">
              <div
                className="h-full rounded-sm transition-[width] duration-500"
                style={{
                  width: `${Math.max(4, (r.wins / maxWins) * 100)}%`,
                  background: accent,
                }}
                title={`${r.wins}-${r.losses}`}
              />
            </div>
            <div className="flex items-center gap-1.5">
              {r.honors?.map((h) => (
                <span
                  key={`${r.season}-${h}`}
                  title={HONOR_META[h].title}
                  className={cn(
                    "rounded border px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]",
                    HONOR_META[h].className,
                  )}
                >
                  {HONOR_META[h].label}
                </span>
              ))}
              <span className="numeral text-right text-[13px] font-semibold text-white">
                {r.wins}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-chalk-dim border-t border-white/[0.06] px-4 py-2.5 text-[10px]">
        WC = wild card · DIV = division · LCS = league · WS = World Series
      </p>
    </section>
  );
}

export function MlbTeamPayrollTable({ abbrev }: { abbrev: string }) {
  const payroll = useQuery({
    queryKey: ["mlb-team-payroll", abbrev],
    queryFn: () => fetchMlbTeamPayroll(abbrev),
    staleTime: 60 * 60_000,
    retry: 1,
  });

  if (payroll.isPending) {
    return <p className="text-chalk-dim animate-pulse text-[12px]">Loading salaries…</p>;
  }
  if (!payroll.data?.rows.length) return null;
  const p = payroll.data;

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div>
          <h3 className="text-[15px] font-semibold text-white">Salaries & contracts</h3>
          <p className="text-chalk-dim mt-0.5 text-[11px]">
            {p.season} payroll
            {p.payrollTotalDisplay ? (
              <>
                {" "}
                · <span className="numeral text-cream">{p.payrollTotalDisplay}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-2 py-2 font-medium">SrvTm</th>
              <th className="px-2 py-2 font-medium">Yrs</th>
              <th className="px-2 py-2 font-medium">Acquired</th>
              <th className="px-2 py-2 text-right font-medium">{p.season}</th>
              <th className="px-4 py-2 font-medium">Contract</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((row) => (
              <tr key={`${row.name}-${row.bbrefId ?? row.salary}`} className="border-t border-white/[0.05]">
                <td className="px-4 py-2 font-medium text-white">{row.name}</td>
                <td className="numeral px-2 py-2 text-white/70">{row.serviceTime ?? "—"}</td>
                <td className="numeral px-2 py-2 text-white/70">{row.experience ?? "—"}</td>
                <td className="px-2 py-2 text-white/55">{row.acquired ?? "—"}</td>
                <td className="numeral px-2 py-2 text-right text-white">
                  {row.salary ?? "—"}
                </td>
                <td className="max-w-[14rem] truncate px-4 py-2 text-white/55" title={row.contractStatus ?? ""}>
                  {row.contractStatus ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LeaderCard({
  card,
  accent,
}: {
  card: MlbTeamLeaderCard;
  accent: string;
}) {
  const top = card.leaders[0];
  if (!top) return null;
  const rest = card.leaders.slice(1);

  return (
    <article className="overflow-hidden rounded-xl border border-white/15 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
      <div className="relative min-h-[9.5rem] px-4 pb-3 pt-3" style={{ background: accent }}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/85">
          {card.category}
        </p>
        <p className="numeral mt-1 text-[34px] leading-none text-white">{top.value}</p>
        <div className="mt-2 max-w-[58%]">
          <Link
            to={`/sports/mlb/player/${top.id}`}
            className="text-[14px] font-semibold text-white hover:underline"
          >
            {top.name}
          </Link>
          <p className="mt-0.5 text-[11px] text-white/75">
            {[top.position, top.number ? `#${top.number}` : null].filter(Boolean).join(" · ") ||
              "—"}
          </p>
        </div>
        <img
          src={leaderHeadshot(top.id)}
          alt=""
          className="pointer-events-none absolute bottom-0 right-0 h-[9.25rem] w-auto object-contain object-bottom"
          loading="lazy"
        />
      </div>
      <ul className="bg-white">
        {rest.map((r) => (
          <li
            key={`${card.category}-${r.id}`}
            className="flex items-center gap-2.5 border-t border-black/5 px-3 py-2"
          >
            <img
              src={leaderHeadshot(r.id)}
              alt=""
              className="h-8 w-8 rounded-full object-cover object-top"
              loading="lazy"
            />
            <Link
              to={`/sports/mlb/player/${r.id}`}
              className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#1a1a1a] hover:underline"
            >
              {r.shortName}
            </Link>
            <span className="numeral text-[13px] font-bold text-[#111]">{r.value}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function MlbTeamLeadersSection({
  teamId,
  accent,
}: {
  teamId: number;
  accent: string;
}) {
  const leaders = useQuery({
    queryKey: ["mlb-team-leader-cards", teamId],
    queryFn: () => fetchMlbTeamLeaderCards(teamId),
    staleTime: 120_000,
  });

  const groups = useMemo(() => {
    const all = leaders.data ?? [];
    return (
      [
        { id: "hitting" as const, label: "Hitting" },
        { id: "pitching" as const, label: "Pitching" },
        { id: "fielding" as const, label: "Fielding" },
      ]
        .map((group) => ({
          ...group,
          cards: all.filter((c) => c.group === group.id).slice(0, 6),
        }))
        .filter((group) => group.cards.length > 0)
    );
  }, [leaders.data]);

  return (
    <section>
      <div className="mb-4">
        <h3 className="text-[22px] font-bold tracking-tight text-white">Team Leaders</h3>
      </div>
      {leaders.isPending ? (
        <p className="text-chalk-dim animate-pulse text-[12px]">Loading leaders…</p>
      ) : groups.length === 0 ? (
        <p className="text-chalk-dim text-[12px]">Leaders unavailable.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.id}>
              <h4 className="text-chalk-dim mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]">
                {group.label}
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.cards.map((card) => (
                  <LeaderCard key={`${card.group}-${card.category}`} card={card} accent={accent} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
