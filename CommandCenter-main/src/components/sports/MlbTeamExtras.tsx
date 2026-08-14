import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMlbTeamBbrefSummary,
  fetchMlbTeamLeaderCards,
  fetchMlbTeamPayroll,
  leaderHeadshot,
  type MlbTeamLeaderCard,
} from "@/lib/mlb-team-page";
import { cn } from "@/lib/utils";

export function MlbTeamOrgSummary({
  abbrev,
  accent,
  playoffOdds,
  wildCardOdds,
  season = new Date().getFullYear(),
}: {
  abbrev: string;
  accent: string;
  playoffOdds?: string | null;
  wildCardOdds?: string | null;
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
      <p className="text-chalk-dim animate-pulse text-[12px]">Loading team overview…</p>
    );
  }
  if (!s) return null;

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: "Record",
      value: (
        <span>
          <span className="numeral text-[18px] font-semibold" style={{ color: accent }}>
            {s.record ?? "—"}
          </span>
          {s.standing ? (
            <span className="text-chalk ml-2 text-[12px]">{s.standing}</span>
          ) : null}
        </span>
      ),
    },
  ];
  if (playoffOdds) {
    rows.push({
      label: "Playoff odds",
      value: (
        <span className="text-cream text-[13px]">
          Make postseason {playoffOdds}
          {wildCardOdds ? ` · WC ${wildCardOdds}` : ""}
        </span>
      ),
    });
  }
  if (s.manager) {
    rows.push({
      label: "Manager",
      value: (
        <span className="text-cream text-[13px]">
          {s.manager.name}
          {s.manager.record ? ` (${s.manager.record})` : ""}
        </span>
      ),
    });
  }
  if (s.president) rows.push({ label: "President", value: s.president });
  if (s.farmDirector) rows.push({ label: "Farm Director", value: s.farmDirector });
  if (s.scoutingDirector) rows.push({ label: "Scouting Director", value: s.scoutingDirector });
  if (s.ballpark) rows.push({ label: "Ballpark", value: s.ballpark });
  if (s.attendance) rows.push({ label: "Attendance", value: s.attendance });
  if (s.parkFactors.multiYear || s.parkFactors.oneYear) {
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
          <span className="text-chalk-dim mt-0.5 block text-[11px]">{s.parkFactors.note}</span>
        </span>
      ),
    });
  }
  if (s.pythagorean.record) {
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

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c]">
      <div className="flex items-end justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div>
          <h3 className="text-[15px] font-semibold text-white">{season} Statistics</h3>
          <p className="text-chalk-dim mt-0.5 text-[11px] uppercase tracking-[0.14em]">
            Baseball-Reference overview
          </p>
        </div>
        <a
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] uppercase tracking-[0.12em] text-white/55 underline underline-offset-2 hover:text-white"
        >
          Source
        </a>
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
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
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
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] uppercase tracking-[0.12em] text-white/55 underline underline-offset-2 hover:text-white"
        >
          Baseball-Reference
        </a>
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
  const [tab, setTab] = useState<"hitting" | "pitching" | "fielding">("hitting");
  const leaders = useQuery({
    queryKey: ["mlb-team-leader-cards", teamId],
    queryFn: () => fetchMlbTeamLeaderCards(teamId),
    staleTime: 120_000,
  });

  const cards = useMemo(
    () => (leaders.data ?? []).filter((c) => c.group === tab).slice(0, 6),
    [leaders.data, tab],
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[22px] font-bold tracking-tight text-white">Team Leaders</h3>
          <span className="text-[12px] text-white/50 underline underline-offset-2">Sortable Stats</span>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["hitting", "pitching", "fielding"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[12px] font-semibold capitalize tracking-[0.04em] transition",
              tab === id
                ? "border-white bg-white text-[#1a1a1a]"
                : "border-white/30 bg-transparent text-white hover:border-white/60",
            )}
          >
            {id}
          </button>
        ))}
      </div>
      {leaders.isPending ? (
        <p className="text-chalk-dim animate-pulse text-[12px]">Loading leaders…</p>
      ) : cards.length === 0 ? (
        <p className="text-chalk-dim text-[12px]">Leaders unavailable.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <LeaderCard key={`${card.group}-${card.category}`} card={card} accent={accent} />
          ))}
        </div>
      )}
    </section>
  );
}
