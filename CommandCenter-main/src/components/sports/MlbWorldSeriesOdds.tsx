import { Link } from "react-router-dom";
import TeamMark from "@/components/sports/TeamMark";
import { teamPagePath } from "@/lib/mlb";
import type { MlbWsOddsBoard } from "@/lib/mlb-ws-odds";
import { cn } from "@/lib/utils";

/** Horizontal World Series strip. Renders nothing when Kalshi has no board. */
export default function MlbWorldSeriesOdds({ board }: { board: MlbWsOddsBoard | null | undefined }) {
  if (!board?.teams.length) return null;

  return (
    <section
      aria-label="World Series odds"
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#07101d]"
    >
      <div className="flex items-baseline justify-between gap-3 px-3 pt-2.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
          World Series odds
        </h3>
        <p className="shrink-0 text-[10px] text-[#8b93a7]">
          <span className="font-semibold uppercase tracking-[0.14em]">Kalshi</span>
          <span className="mx-1 text-white/25">·</span>
          <span className="numeral">{board.asOfLabel}</span>
        </p>
      </div>
      <div className="flex gap-0.5 overflow-x-auto px-1.5 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {board.teams.map((team) => (
          <Link
            key={team.teamId}
            to={teamPagePath(team.teamId)}
            className="flex min-w-[4.15rem] flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition hover:bg-white/[0.04]"
          >
            <TeamMark teamId={team.teamId} size="sm" />
            <span className="text-[11px] font-semibold tracking-wide text-cream">{team.abbrev}</span>
            <span className="numeral text-[13px] font-semibold leading-none text-white">{team.pct}%</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Small World Series percent under a club on a score card or game header. */
export function WsChampPct({
  pct,
  muted = false,
  className,
}: {
  pct: number | null | undefined;
  muted?: boolean;
  className?: string;
}) {
  if (pct == null) return null;
  return (
    <p
      className={cn(
        "numeral text-[10px] font-medium tracking-wide",
        muted ? "text-white/25" : "text-white/55",
        className,
      )}
    >
      WS {pct}%
    </p>
  );
}
