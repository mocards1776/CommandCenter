import { Link } from "react-router-dom";
import type { MlbScoreGame } from "@/lib/mlb";
import { cn } from "@/lib/utils";

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
}

export function BaseDiamond({
  onFirst,
  onSecond,
  onThird,
  size = "md",
}: {
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  size?: "sm" | "md";
}) {
  const bag = (on: boolean) =>
    on ? "bg-cream shadow-[0_0_0_1px_rgba(255,255,255,0.35)]" : "bg-white/15";
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const sq = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <div className={cn("relative", dim)} aria-hidden>
      <span
        className={cn("absolute top-0 left-1/2 -translate-x-1/2 rotate-45", sq, bag(onSecond))}
      />
      <span
        className={cn("absolute top-1/2 left-0 -translate-y-1/2 rotate-45", sq, bag(onThird))}
      />
      <span
        className={cn("absolute top-1/2 right-0 -translate-y-1/2 rotate-45", sq, bag(onFirst))}
      />
    </div>
  );
}

/** Compact live strip: batter/pitcher + bases + count. */
export default function LiveSituationStrip({
  game,
  linkPlayers = false,
  compact = false,
}: {
  game: MlbScoreGame;
  linkPlayers?: boolean;
  compact?: boolean;
}) {
  const sit = game.situation;
  if (!sit) return null;

  const person = (
    role: string,
    p: { id: number; name: string } | null,
  ) => {
    if (!p) return null;
    const label = (
      <>
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {role}{" "}
        </span>
        {shortName(p.name)}
      </>
    );
    if (linkPlayers && p.id) {
      return (
        <Link
          to={`/sports/mlb/player/${p.id}`}
          onClick={(e) => e.stopPropagation()}
          className="block truncate hover:underline"
        >
          {label}
        </Link>
      );
    }
    return <p className="truncate">{label}</p>;
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        compact ? "text-[11px]" : "text-[12px]",
      )}
    >
      <div className="min-w-0 space-y-0.5 text-white/80">
        {person("Batter", sit.batter)}
        {person("Pitcher", sit.pitcher)}
      </div>
      <div className="flex items-center gap-3">
        <BaseDiamond
          onFirst={sit.onFirst}
          onSecond={sit.onSecond}
          onThird={sit.onThird}
          size={compact ? "sm" : "md"}
        />
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
            {game.inning || "Live"}
          </p>
          <p className="numeral mt-0.5 text-[14px] text-cream">
            {sit.balls}-{sit.strikes}
            <span className="mx-1 text-white/30">·</span>
            {sit.outs} out{sit.outs === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}
