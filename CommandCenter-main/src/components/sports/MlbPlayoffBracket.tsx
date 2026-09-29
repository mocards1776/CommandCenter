import { Link } from "react-router-dom";
import TeamMark from "@/components/sports/TeamMark";
import { teamPagePath, type MlbPlayoffSeries, type MlbPlayoffSide, type MlbPlayoffTree } from "@/lib/mlb";
import { cn } from "@/lib/utils";

export default function MlbPlayoffBracket({ tree }: { tree: MlbPlayoffTree }) {
  const hasAny = tree.rounds.some((r) => r.series.length > 0);
  if (!hasAny) {
    return (
      <p className="text-chalk-dim text-[13px]">
        Postseason bracket for {tree.season} isn’t published yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-chalk text-[13px]">
        {tree.season} MLB postseason — Wild Card through World Series.
      </p>
      {tree.rounds.map((round) =>
        round.series.length === 0 ? null : (
          <section key={round.id} className="space-y-3">
            <h3 className="rule-head">{round.label}</h3>
            <div
              className={cn(
                "grid gap-3",
                round.id === "ws"
                  ? "grid-cols-1 max-w-xl"
                  : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-2",
              )}
            >
              {round.series.map((series) => (
                <SeriesCard key={series.id} series={series} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}

function SeriesCard({ series }: { series: MlbPlayoffSeries }) {
  const need = Math.ceil(series.gamesInSeries / 2);
  const liveGame = series.games.find((g) => g.live);
  const nextGame = series.games.find((g) => !g.final && !g.live);

  return (
    <article
      className={cn(
        "bg-panel overflow-hidden rounded-xl border border-white/[0.08]",
        liveGame && "border-alert/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e8e4d9]">
            {series.label}
          </p>
          <p className="text-chalk-dim mt-0.5 text-[10px]">
            Best of {series.gamesInSeries}
            {series.seriesStatus ? ` · ${series.seriesStatus}` : ""}
          </p>
        </div>
        {liveGame ? (
          <span className="text-alert text-[10px] font-semibold uppercase tracking-[0.14em]">
            <span className="bg-alert mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
            Live G{liveGame.gameNumber}
          </span>
        ) : series.completed ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/90">
            Series over
          </span>
        ) : nextGame ? (
          <span className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
            G{nextGame.gameNumber}
            {nextGame.when ? ` · ${nextGame.when}` : ""}
          </span>
        ) : null}
      </div>

      <div className="space-y-1 px-3 py-3">
        <SeriesTeamRow
          side={series.away}
          wins={series.away.wins}
          need={need}
          leading={series.away.wins > series.home.wins}
          winner={series.completed && series.away.wins > series.home.wins}
        />
        <SeriesTeamRow
          side={series.home}
          wins={series.home.wins}
          need={need}
          leading={series.home.wins > series.away.wins}
          winner={series.completed && series.home.wins > series.away.wins}
        />
      </div>

      {series.games.length > 0 ? (
        <div className="border-t border-white/[0.06] px-2 py-2">
          <div className="flex flex-wrap gap-1.5">
            {series.games.map((g) => {
              const href = g.gamePk > 0 ? `/sports/mlb/game/${g.gamePk}` : undefined;
              const label =
                g.final || g.live
                  ? `G${g.gameNumber} ${g.awayScore ?? "—"}-${g.homeScore ?? "—"}`
                  : `G${g.gameNumber}${g.when ? ` ${g.when}` : ""}`;
              const className = cn(
                "inline-flex items-center rounded-md border px-2 py-1 text-[10px] tabular-nums transition",
                g.live
                  ? "border-alert/40 text-alert"
                  : g.final
                    ? "border-white/[0.08] text-cream/80"
                    : "border-white/[0.06] text-chalk-dim",
                href && "hover:border-accent/40 hover:text-cream",
              );
              return href ? (
                <Link key={g.gamePk || g.gameNumber} to={href} className={className}>
                  {label}
                </Link>
              ) : (
                <span key={g.gameNumber} className={className}>
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function SeriesTeamRow({
  side,
  wins,
  need,
  leading,
  winner,
}: {
  side: MlbPlayoffSide;
  wins: number;
  need: number;
  leading: boolean;
  winner: boolean;
}) {
  const inner = (
    <>
      {side.teamId != null && !side.placeholder ? (
        <TeamMark teamId={side.teamId} size="sm" />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[9px] font-bold text-white/50">
          {side.abbrev.slice(0, 3)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13px] font-semibold",
            winner ? "text-cream" : leading ? "text-cream" : "text-cream/75",
          )}
        >
          {side.abbrev}
          {side.placeholder ? (
            <span className="text-chalk-dim ml-1.5 text-[10px] font-normal uppercase tracking-[0.12em]">
              TBD
            </span>
          ) : null}
        </span>
        {!side.placeholder && side.name !== side.abbrev ? (
          <span className="text-chalk-dim block truncate text-[10px]">{side.name}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "numeral text-[16px] font-semibold",
          winner ? "text-accent" : leading ? "text-cream" : "text-white/50",
        )}
        title={`First to ${need}`}
      >
        {wins}
      </span>
    </>
  );

  if (side.teamId != null && !side.placeholder) {
    return (
      <Link
        to={teamPagePath(side.teamId)}
        className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition hover:bg-white/[0.03]"
      >
        {inner}
      </Link>
    );
  }

  return <div className="flex items-center gap-2.5 px-1 py-1.5">{inner}</div>;
}
