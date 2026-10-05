import { mlbPlaybugLabel, type MlbCountLamps, type MlbHeroInstrument } from "@heat/mlb-hero.ts";
import { cn } from "@/lib/utils";

const BALL = "#f5c14a";
const STRIKE = "#ef5b5b";

export function MlbHeroDiamond({
  onFirst,
  onSecond,
  onThird,
  size = "md",
}: {
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "lg" ? "h-[3.4rem] w-[3.4rem]" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const bag = size === "lg" ? "h-3 w-3" : size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const onBag = "bg-[#f4f1e9] shadow-[0_0_10px_rgba(244,241,233,0.5)]";
  const offBag = "bg-white/20";
  return (
    <div className={cn("relative shrink-0", box)} aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 40 40">
        <path
          d="M20 33 L8 20 L20 7 L32 20 Z"
          fill="#3a2718"
          fillOpacity="0.55"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.2"
        />
        <path
          d="M20 33 L5 16"
          fill="none"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M20 33 L35 16"
          fill="none"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <polygon points="20,36 16.6,31.2 20,29.2 23.4,31.2" fill="#f4f1e9" />
      </svg>
      <span
        className={cn(
          "absolute top-[3px] left-1/2 -translate-x-1/2 rotate-45",
          bag,
          onSecond ? onBag : offBag,
        )}
      />
      <span
        className={cn(
          "absolute top-1/2 left-[3px] -translate-y-1/2 rotate-45",
          bag,
          onThird ? onBag : offBag,
        )}
      />
      <span
        className={cn(
          "absolute top-1/2 right-[3px] -translate-y-1/2 rotate-45",
          bag,
          onFirst ? onBag : offBag,
        )}
      />
    </div>
  );
}

function LampRow({
  label,
  filled,
  total,
  color,
  compact,
}: {
  label: string;
  filled: number;
  total: number;
  color: string;
  compact?: boolean;
}) {
  const dot = compact ? "h-1.5 w-1.5" : "h-2 w-2";
  return (
    <div className="flex items-center gap-1">
      <span
        className={cn(
          "font-bold text-white/45",
          compact ? "w-2 text-[8px]" : "w-2.5 text-[9px]",
        )}
      >
        {label}
      </span>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn("block rounded-full", dot)}
          style={{ background: i < filled ? color : "rgba(255,255,255,0.18)" }}
        />
      ))}
    </div>
  );
}

export function MlbCountLamps({
  lamps,
  compact = false,
}: {
  lamps: MlbCountLamps;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1")}>
      <LampRow label="B" filled={lamps.balls} total={3} color={BALL} compact={compact} />
      <LampRow label="S" filled={lamps.strikes} total={2} color={STRIKE} compact={compact} />
      <LampRow label="O" filled={lamps.outs} total={3} color={STRIKE} compact={compact} />
    </div>
  );
}

/** Diamond + B/S/O lamps — the live nest between the tall scores. */
export function MlbPlaybug({
  hero,
  size = "card",
}: {
  hero: MlbHeroInstrument;
  size?: "card" | "header";
}) {
  if (!hero.livePlay || !hero.lamps) return null;
  const header = size === "header";
  return (
    <div
      className={cn(
        "flex items-center rounded-2xl bg-[#10281f]/45",
        header ? "gap-2.5 px-2.5 py-1.5" : "gap-1.5 px-1.5 py-1",
      )}
      aria-label={mlbPlaybugLabel(hero)}
    >
      <MlbHeroDiamond
        onFirst={hero.onFirst}
        onSecond={hero.onSecond}
        onThird={hero.onThird}
        size={header ? "lg" : "sm"}
      />
      <MlbCountLamps lamps={hero.lamps} compact={!header} />
    </div>
  );
}

/** Inning chip + win-probability bar under the scores. Count lives in the playbug. */
export default function MlbLiveInstrument({
  hero,
  awayAbbrev,
  homeAbbrev,
  awayColor,
  homeColor,
  showInning = true,
  compact = false,
}: {
  hero: MlbHeroInstrument;
  awayAbbrev?: string | null;
  homeAbbrev?: string | null;
  awayColor?: string | null;
  homeColor?: string | null;
  showInning?: boolean;
  compact?: boolean;
}) {
  const inning = showInning ? hero.inning : null;
  if (!inning && hero.homeShare == null) return null;
  const awayPaint = awayColor ? `#${awayColor.replace(/^#/, "")}` : "#94a3b8";
  const homePaint = homeColor ? `#${homeColor.replace(/^#/, "")}` : "#e2e8f0";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0c1624]/90",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
      )}
    >
      {inning ? (
        <span
          className={cn(
            "shrink-0 rounded-lg bg-[#10281f] font-semibold uppercase tracking-[0.12em] text-emerald-100",
            compact ? "px-2 py-1 text-[9px]" : "px-2.5 py-1.5 text-[11px]",
          )}
        >
          {inning}
        </span>
      ) : null}
      {hero.homeShare != null ? (
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.12em]">
            <span style={{ color: awayPaint }}>{awayAbbrev}</span>
            <span className="text-emerald-100/90">{hero.winChip}</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
            <span
              className="h-full opacity-55"
              style={{ width: `${100 - hero.homeShare}%`, background: awayPaint }}
            />
            <span className="h-full" style={{ width: `${hero.homeShare}%`, background: homePaint }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
