import { Link } from "react-router-dom";
import type { NflScoreGame } from "@/lib/nfl";
import { fieldBallPctFromHomeYardLine } from "@/lib/nfl";
import { cn } from "@/lib/utils";

/** Horizontal football field with ball / line-of-scrimmage marker. */
export default function NflFieldMap({
  game,
  /** ESPN situation.yardLine — yards from the home end zone (0–100). */
  homeYardLine,
  possessionTeamId,
  downDistanceText,
  className,
}: {
  game: NflScoreGame;
  homeYardLine: number | null;
  possessionTeamId: string | null;
  downDistanceText?: string | null;
  className?: string;
}) {
  const poss = possessionTeamId;
  const homeHasBall = poss != null && String(poss) === String(game.home.teamId);
  const awayHasBall = poss != null && String(poss) === String(game.away.teamId);

  const rawPct = fieldBallPctFromHomeYardLine(homeYardLine);
  const ballPct = rawPct != null ? Math.max(2, Math.min(98, rawPct)) : null;

  const ticks = [10, 20, 30, 40, 50, 40, 30, 20, 10];

  return (
    <div className={cn("overflow-hidden rounded-xl border border-emerald-700/35 bg-[#0a1f12]", className)}>
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
        <span className={cn(awayHasBall ? "text-cream" : "text-white/45")}>
          {game.away.abbrev}
          {awayHasBall ? " ●" : ""}
        </span>
        <span className="text-emerald-200/70">
          {downDistanceText || game.situation?.downDistanceText || "Field"}
        </span>
        <span className={cn(homeHasBall ? "text-cream" : "text-white/45")}>
          {homeHasBall ? "● " : ""}
          {game.home.abbrev}
        </span>
      </div>

      <div className="relative mx-2 mb-3 mt-2 h-16 overflow-hidden rounded-md border border-white/10 bg-gradient-to-b from-[#1a5c34] to-[#0d3d22]">
        {/* End zones */}
        <div
          className="absolute inset-y-0 left-0 w-[8%] opacity-90"
          style={{ background: `#${game.away.color || "333"}88` }}
        />
        <div
          className="absolute inset-y-0 right-0 w-[8%] opacity-90"
          style={{ background: `#${game.home.color || "333"}88` }}
        />

        {/* Yard lines */}
        <div className="absolute inset-y-0 left-[8%] right-[8%]">
          {ticks.map((n, i) => (
            <div
              key={`${n}-${i}`}
              className="absolute inset-y-0 border-l border-white/25"
              style={{ left: `${((i + 1) / 10) * 100}%` }}
            >
              <span className="absolute bottom-1 left-0.5 -translate-x-1/2 text-[8px] font-bold text-white/50">
                {n}
              </span>
            </div>
          ))}
        </div>

        {ballPct != null && (
          <div
            className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${8 + ballPct * 0.84}%` }}
          >
            <span className="block h-3.5 w-3.5 rounded-full bg-[#f0e6c8] shadow-[0_0_0_2px_rgba(0,0,0,0.35),0_0_12px_rgba(240,230,200,0.55)]" />
          </div>
        )}
      </div>

      {game.situation?.lastPlayText && (
        <p className="border-t border-white/[0.06] px-3 py-2 text-[11px] leading-snug text-white/70">
          {game.situation.lastPlayText}
        </p>
      )}
    </div>
  );
}

export function NflLiveStrip({ game }: { game: NflScoreGame }) {
  if (!game.live || !game.situation) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="text-alert text-[10px] font-semibold uppercase tracking-[0.14em]">
          Live
        </span>
        <span className="text-cream font-medium">
          {game.situation.downDistanceText ?? game.shortDetail}
        </span>
        {game.situation.possessionText && (
          <span className="text-chalk-dim">{game.situation.possessionText}</span>
        )}
      </div>
      {game.situation.lastPlayText && (
        <p className="text-chalk mt-1 text-[11px] leading-snug">{game.situation.lastPlayText}</p>
      )}
    </div>
  );
}

export function NflScoreRow({
  game,
  to,
  heat,
  reasons,
}: {
  game: NflScoreGame;
  to?: string;
  heat?: number | null;
  reasons?: string[];
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          {[game.away, game.home].map((side) => (
            <div key={side.teamId} className="flex items-center gap-2">
              {side.logo ? (
                <img src={side.logo} alt="" className="h-6 w-6 object-contain" />
              ) : null}
              <span className="text-cream min-w-0 flex-1 truncate text-[13px] font-medium">
                {side.abbrev}
              </span>
              <span className="numeral text-cream text-[18px]">{side.score ?? "—"}</span>
            </div>
          ))}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.14em]",
              game.live ? "text-alert" : "text-chalk-dim",
            )}
          >
            {game.live ? "Live" : game.final ? "Final" : game.whenShort ?? "Upcoming"}
          </p>
          <p className="text-chalk-dim mt-1 max-w-[7rem] text-[10px] leading-snug">
            {game.shortDetail}
          </p>
          {heat != null ? (
            <p className="mt-1.5 text-[10.5px] font-semibold text-[#8b93a7]">Heat {heat}</p>
          ) : null}
        </div>
      </div>
      {game.live && game.situation?.downDistanceText && (
        <p className="text-chalk mt-2 truncate text-[11px]">{game.situation.downDistanceText}</p>
      )}
      {reasons && reasons.length > 0 ? (
        <p className="text-chalk-dim mt-2 truncate text-[10px]">{reasons.join(" · ")}</p>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="bg-panel block rounded-xl border border-white/[0.08] p-3 transition hover:border-white/15 hover:bg-white/[0.03]"
      >
        {body}
      </Link>
    );
  }
  return <div className="bg-panel rounded-xl border border-white/[0.08] p-3">{body}</div>;
}
