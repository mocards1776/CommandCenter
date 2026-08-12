import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import TeamMark from "@/components/sports/TeamMark";
import { fetchMlbStandings, teamPagePath } from "@/lib/mlb";
import { cn } from "@/lib/utils";

const STL_TEAM_ID = 138;

/** Compact NL Central table for the Dispatch reader notes column. */
export default function NlCentralStandingsCard() {
  const standings = useQuery({
    queryKey: ["mlb-standings"],
    queryFn: () => fetchMlbStandings(),
    staleTime: 15 * 60_000,
  });

  const table = (standings.data ?? []).find((t) => t.shortName === "NL Central");

  return (
    <section className="border-white/[0.08] mt-8 border-t pt-5">
      <div className="rule-head mb-3">NL Central</div>
      {standings.isPending ? (
        <p className="label-caps font-body animate-pulse text-[11px]">Loading standings</p>
      ) : standings.isError || !table ? (
        <p className="text-chalk font-body text-[12px] leading-relaxed">
          Couldn’t load standings.
        </p>
      ) : (
        <table className="w-full text-left text-[12px]">
          <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
            <tr>
              <th className="pb-2 pr-1 font-medium">Team</th>
              <th className="numeral pb-2 px-1 font-medium">W</th>
              <th className="numeral pb-2 px-1 font-medium">L</th>
              <th className="numeral pb-2 px-1 font-medium">GB</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => {
              const isStl = r.teamId === STL_TEAM_ID;
              return (
                <tr
                  key={r.teamId || r.team}
                  className={cn(
                    "border-t border-white/[0.05]",
                    isStl && "bg-accent/10",
                  )}
                >
                  <td className="py-1.5 pr-1">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="text-chalk-dim numeral w-3 shrink-0 text-[11px]">
                        {r.rank}
                      </span>
                      {r.teamId ? <TeamMark teamId={r.teamId} size="xs" /> : null}
                      <Link
                        to={teamPagePath(r.teamId)}
                        className={cn(
                          "truncate hover:underline",
                          isStl ? "text-cream font-semibold" : "text-cream/90 hover:text-accent",
                        )}
                      >
                        {r.abbrev || r.team}
                      </Link>
                    </span>
                  </td>
                  <td className="numeral text-cream px-1 py-1.5">{r.wins}</td>
                  <td className="numeral text-chalk px-1 py-1.5">{r.losses}</td>
                  <td className="numeral text-chalk px-1 py-1.5">{r.gb}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
