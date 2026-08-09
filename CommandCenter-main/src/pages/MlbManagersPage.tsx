import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Flame } from "lucide-react";
import {
  fetchMlbManagers,
  mlbTeamLogo,
  teamPagePath,
  type MlbManager,
} from "@/lib/mlb";
import { cn } from "@/lib/utils";

function heatTone(rank: number): string {
  if (rank <= 5) return "text-alert";
  if (rank <= 12) return "text-amber-300";
  if (rank <= 20) return "text-[#c8cdd8]";
  return "text-emerald-300";
}

function heatLabel(rank: number): string {
  if (rank <= 5) return "Blazing";
  if (rank <= 12) return "Warm";
  if (rank <= 20) return "Cool";
  return "Safe";
}

export default function MlbManagersPage() {
  const managers = useQuery({
    queryKey: ["mlb-managers-v2"],
    queryFn: fetchMlbManagers,
    staleTime: 180_000,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-7">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">MLB</p>
        <h1 className="font-display text-cream text-[34px] leading-none sm:text-[40px]">
          Managers
        </h1>
        <p className="text-chalk max-w-xl text-[13.5px] leading-relaxed">
          Every big-league skipper, ranked by hot seat. Press or hover a rank to see the
          scoring breakdown. Open a manager for year-by-year records and contract terms.
        </p>
      </header>

      {managers.isPending && (
        <p className="text-chalk-dim flex items-center gap-2 text-[13px]">
          <Loader2 size={16} className="animate-spin" /> Loading managers…
        </p>
      )}
      {managers.isError && (
        <p className="text-alert text-[13px]">
          {managers.error instanceof Error ? managers.error.message : "Couldn't load managers"}
        </p>
      )}

      {managers.data && (
        <>
          <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <Flame size={16} className="text-alert" />
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                Hot seat ranking
              </h2>
            </div>
            <ol className="divide-y divide-white/[0.05]">
              {managers.data.map((m) => (
                <ManagerRow key={m.id} manager={m} />
              ))}
            </ol>
          </section>

          <p className="text-[11px] leading-relaxed text-[#8b93a7]">
            Heat scores win percentage, games back, playoff odds, division place, and long
            tenure while losing. Contract security adjusts the score on each manager’s detail
            page.
          </p>
        </>
      )}
    </div>
  );
}

function ManagerRow({ manager: m }: { manager: MlbManager }) {
  const navigate = useNavigate();
  const title = m.heatFactors
    .map((f) => `${f.label}: ${f.points >= 0 ? "+" : ""}${f.points.toFixed(1)} — ${f.detail}`)
    .join("\n");

  return (
    <li>
      <div
        role="link"
        tabIndex={0}
        className="flex cursor-pointer items-center gap-3 px-3 py-3 transition hover:bg-white/[0.03] sm:gap-4 sm:px-4"
        onClick={() => navigate(`/sports/mlb/managers/${m.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(`/sports/mlb/managers/${m.id}`);
          }
        }}
      >
        <details
          className="relative shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <summary
            className={cn(
              "numeral list-none text-center text-[18px] font-semibold marker:content-none",
              heatTone(m.hotSeatRank),
            )}
            title={title}
          >
            <span className="inline-flex w-8 flex-col items-center">
              {m.hotSeatRank}
              <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#8b93a7]">
                why
              </span>
            </span>
          </summary>
          <div className="bg-panel absolute top-full left-0 z-20 mt-2 w-[260px] rounded-lg border border-white/15 p-3 shadow-2xl sm:w-[300px]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e8e4d9]">
              Hot seat #{m.hotSeatRank} · {m.hotSeatScore.toFixed(1)}
            </p>
            <ul className="space-y-2">
              {m.heatFactors.map((f) => (
                <li key={f.key} className="text-[11.5px] leading-snug">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[#c8cdd8]">{f.label}</span>
                    <span
                      className={cn(
                        "numeral",
                        f.points > 0 ? "text-alert" : f.points < 0 ? "text-emerald-300" : "text-[#8b93a7]",
                      )}
                    >
                      {f.points > 0 ? "+" : ""}
                      {f.points.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-[#8b93a7]">{f.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </details>

        <img
          src={m.headshot}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-md bg-[#0c1a2e] object-cover object-top ring-1 ring-white/10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-cream truncate text-[15px] font-semibold">{m.name}</span>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.14em]",
                heatTone(m.hotSeatRank),
              )}
            >
              {heatLabel(m.hotSeatRank)}
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[12px] text-[#a8b0c2]">
            <Link
              to={teamPagePath(m.teamId)}
              className="inline-flex items-center gap-1.5 hover:text-cream hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={mlbTeamLogo(m.teamId)} alt="" className="h-4 w-4 object-contain" />
              {m.teamAbbrev}
            </Link>
            <span className="numeral">{m.record}</span>
            <span>
              {m.yearsWithTeam} yr{m.yearsWithTeam === 1 ? "" : "s"}
            </span>
            <span>{m.gb === "—" ? "—" : `${m.gb} GB`}</span>
            {m.playoffOdds != null && <span>{m.playoffOdds.toFixed(0)}% PO</span>}
          </div>
        </div>
        <span className="numeral hidden text-[12px] text-[#8b93a7] sm:inline">
          {m.hotSeatScore.toFixed(1)}
        </span>
      </div>
    </li>
  );
}
