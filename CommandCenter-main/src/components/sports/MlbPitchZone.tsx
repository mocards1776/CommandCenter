import MlbHeatGrid from "@/components/sports/MlbHeatGrid";
import MlbPitchStatcastCard from "@/components/sports/MlbPitchStatcastCard";
import PlayerHeadshot from "@/components/sports/PlayerHeadshot";
import { batterBoxSide, matchupSide, type Hand } from "@/lib/mlb-batter-box";
import { heatZoneGrid } from "@/lib/mlb-pbp";
import {
  formatPitchMph,
  PITCH_LEGEND,
  PLOT_MARGIN_X,
  PLOT_MARGIN_Y,
  pitchResultFromPlot,
  pitchResultStyle,
  pitchTypeCode,
  pitchZonePosition,
  relaxPitchDots,
  zoneInsetPct,
} from "@/lib/mlb-pitch-zone";
import { pitchRowStats, type MlbLivePitch } from "@/lib/mlb-statcast";
import { cn } from "@/lib/utils";

/** Zone height ÷ width — matches the old hot-zone grid proportions. */
const ZONE_ASPECT = 0.92;

function pitchTitle(p: MlbLivePitch): string {
  return [
    `#${p.number}`,
    p.pitchType,
    p.speed != null ? `${formatPitchMph(p.speed)} mph` : null,
    p.callLabel,
  ]
    .filter(Boolean)
    .join(" · ");
}

function PitchDot({
  pitch,
  pos,
  latest,
}: {
  pitch: MlbLivePitch;
  pos: { leftPct: number; topPct: number };
  latest: boolean;
}) {
  const style = pitchResultStyle(pitchResultFromPlot(pitch));
  return (
    <span
      className="absolute grid h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold leading-none tabular-nums shadow-[0_1px_4px_rgba(0,0,0,0.55)] ring-1 ring-black/45 sm:h-5 sm:w-5 sm:text-[11px]"
      style={{
        left: `${pos.leftPct}%`,
        top: `${pos.topPct}%`,
        background: style.fill,
        color: style.text,
        zIndex: 10 + pitch.number,
      }}
      title={pitchTitle(pitch)}
    >
      {latest ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-[2px] animate-ping rounded-full border-2 opacity-70 [animation-duration:1.8s] motion-reduce:animate-none"
          style={{ borderColor: style.fill }}
        />
      ) : null}
      {pitch.number}
    </span>
  );
}

function PitchLegend() {
  return (
    <ul className="flex max-w-[19rem] flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[9px] font-medium text-[#8b93a7] sm:text-[10px]">
      {PITCH_LEGEND.map((r) => {
        const s = pitchResultStyle(r);
        return (
          <li key={r} className="flex items-center gap-1 whitespace-nowrap">
            <span
              className="inline-block h-2 w-2 rounded-full ring-1 ring-black/40"
              style={{ background: s.fill }}
            />
            {s.label}
          </li>
        );
      })}
    </ul>
  );
}

function PitchList({ pitches }: { pitches: MlbLivePitch[] }) {
  const lastNumber = pitches[pitches.length - 1]?.number;
  const cols = "grid grid-cols-[1.1rem_1.7rem_1.6rem_minmax(0,1fr)] gap-x-1.5";
  return (
    <div className="w-full min-w-0 text-[11px]">
      <div
        className={cn(
          cols,
          "border-b border-white/[0.08] px-1 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6f778a]",
        )}
      >
        <span>#</span>
        <span>Type</span>
        <span className="text-right">Mph</span>
        <span>Result</span>
      </div>
      <ol className="mt-0.5">
        {pitches.map((p) => {
          const s = pitchResultStyle(pitchResultFromPlot(p));
          const latest = p.number === lastNumber;
          const stats = pitchRowStats(p.statcast);
          return (
            <li
              key={p.number}
              className={cn(
                cols,
                "items-center rounded-[4px] px-1 py-[3px] leading-tight",
                latest && "bg-white/[0.06]",
              )}
              title={pitchTitle(p)}
            >
              <span
                className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold tabular-nums"
                style={{ background: s.fill, color: s.text }}
              >
                {p.number}
              </span>
              <span className="font-semibold text-cream">{pitchTypeCode(p.pitchType) ?? "—"}</span>
              <span className="numeral text-right text-white/80">{formatPitchMph(p.speed)}</span>
              <span className="truncate text-white/70">{p.callLabel}</span>
              {stats.length > 0 ? (
                <span className="numeral col-span-3 col-start-2 truncate text-[9.5px] leading-snug text-[#8b93a7]">
                  {stats.join(" · ")}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export type MlbZoneBatter = {
  id: number | null;
  /** Short display name, e.g. "T. Hernández". */
  name: string | null;
  /** Side this PA (`matchup.batSide.code`); null hides the capsules. */
  batSide: Hand | null;
  /** Batting team accent, hex without "#". */
  color?: string | null;
};

/**
 * Slim pill in one batter's-box margin of the catcher's-view plot. The active
 * side carries the headshot, R/L and "BATS RIGHT/LEFT"; the empty box is a
 * faint dashed outline. Sized to sit inside the existing plot margin.
 */
function BatterCapsule({
  side,
  inset,
  batter,
}: {
  side: "left" | "right";
  inset: { x: number; y: number };
  batter: MlbZoneBatter | null;
}) {
  const x = {
    [side]: `${inset.x / 2}%`,
    transform: `translateX(${side === "left" ? "-50%" : "50%"})`,
  } as const;
  if (!batter?.batSide) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute w-[26px] rounded-full border border-dashed border-white/[0.12] sm:w-[30px]"
        style={{ ...x, top: `${inset.y}%`, bottom: `${inset.y}%` }}
      />
    );
  }
  const c = `#${(batter.color || "60a5fa").replace(/^#/, "")}`;
  const right = batter.batSide === "R";
  return (
    <div
      role="img"
      aria-label={`${batter.name ?? "Batter"} bats ${right ? "right" : "left"}`}
      className="pointer-events-none absolute flex w-[26px] flex-col items-center gap-1 overflow-hidden rounded-full pt-0.5 sm:w-[30px] sm:gap-[5px]"
      style={{
        ...x,
        top: `${Math.max(0, inset.y - 6)}%`,
        bottom: `${inset.y}%`,
        background: `linear-gradient(180deg, ${c}70, ${c}1c 72%, transparent)`,
        boxShadow: `inset 0 0 0 1px ${c}99`,
      }}
    >
      {batter.id ? (
        <PlayerHeadshot
          playerId={batter.id}
          size={213}
          className="h-[22px] w-[22px] shrink-0 rounded-full bg-[#dfe6f2] ring-[1.5px] ring-white/75 sm:h-[26px] sm:w-[26px]"
          alt=""
        />
      ) : null}
      <span className="text-[12px] font-extrabold leading-none text-white sm:text-[13px]">
        {batter.batSide}
      </span>
      <span className="rotate-180 whitespace-nowrap text-[8px] font-bold tracking-[0.16em] text-white/75 [writing-mode:vertical-rl] sm:text-[8.5px]">
        BATS {right ? "RIGHT" : "LEFT"}
      </span>
    </div>
  );
}

function HandChip({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-full bg-white/[0.07] px-1.5 py-px text-[9px] font-bold tracking-[0.08em] text-[#dfe5f1]">
      {children}
    </span>
  );
}

/** "RHP T. Mahle → T. Hernández RHB · same side"; parts hide when unknown. */
function MatchupLine({
  pitcherName,
  pitchHand,
  batter,
}: {
  pitcherName: string | null;
  pitchHand: Hand | null;
  batter: MlbZoneBatter | null;
}) {
  const batSide = batter?.batSide ?? null;
  if (!pitchHand && !batSide) return null;
  const rel = matchupSide(batSide, pitchHand);
  return (
    <p className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight text-[#a8b0c2]">
      <span className="inline-flex min-w-0 items-center gap-1">
        {pitchHand ? <HandChip>{`${pitchHand}HP`}</HandChip> : null}
        {pitcherName ? <span className="max-w-[7.5rem] truncate">{pitcherName}</span> : null}
      </span>
      <span className="text-[#5d6578]" aria-hidden>
        →
      </span>
      <span className="inline-flex min-w-0 items-center gap-1">
        {batter?.name ? <span className="max-w-[7.5rem] truncate">{batter.name}</span> : null}
        {batSide ? <HandChip>{`${batSide}HB`}</HandChip> : null}
      </span>
      {rel ? <span className="text-[#6f778a]">· {rel}</span> : null}
    </p>
  );
}

/**
 * Live strike zone: faded batter hot zones + the current at-bat's pitches as
 * numbered dots at their plate location (catcher's view), the batter's-box
 * capsule on the side he is hitting from (RHB left, LHB right), a latest-pitch
 * Statcast card and a pitch list (pitches without coordinates are list-only).
 * No pitches yet → the plain hot-zone grid at full strength.
 */
export default function MlbPitchZone({
  batterId,
  cells,
  pending,
  pitches,
  pitchHand = null,
  batter = null,
  pitcherName = null,
}: {
  batterId: number | null;
  cells: ReturnType<typeof heatZoneGrid>;
  pending: boolean;
  pitches: MlbLivePitch[];
  /** Pitcher's throwing hand, for arm / glove-side break. */
  pitchHand?: "L" | "R" | null;
  /** Current batter + handedness for the batter's-box capsule. */
  batter?: MlbZoneBatter | null;
  pitcherName?: string | null;
}) {
  const boxSide = batterBoxSide(batter?.batSide);
  const hasPitches = pitches.length > 0;
  const inset = zoneInsetPct();
  const latest = pitches[pitches.length - 1] ?? null;
  const latestNumber = latest?.number;
  const aspect = (1 + 2 * PLOT_MARGIN_X) / ((1 + 2 * PLOT_MARGIN_Y) * ZONE_ASPECT);
  // True plate spots, then nudge overlapping dots apart so every number reads.
  const dots = relaxPitchDots(
    pitches.flatMap((p) => {
      const pos = pitchZonePosition(p);
      return pos ? [{ leftPct: pos.leftPct, topPct: pos.topPct, pitch: p }] : [];
    }),
    { aspect },
  );

  return (
    <div className="flex w-full max-w-full flex-col items-center justify-center gap-x-5 gap-y-3 lg:flex-row lg:items-start">
      <div className="flex max-w-full flex-col items-center gap-2.5">
        <MatchupLine pitcherName={pitcherName} pitchHand={pitchHand} batter={batter} />
        <div
          className="relative w-[15.5rem] max-w-full sm:w-[17rem] lg:w-[18rem]"
          style={{ aspectRatio: String(aspect) }}
          role="group"
          aria-label={
            hasPitches
              ? `Strike zone, ${pitches.length} pitch${pitches.length === 1 ? "" : "es"} this at-bat`
              : "Strike zone"
          }
        >
          <div
            className="absolute"
            style={{ left: `${inset.x}%`, right: `${inset.x}%`, top: `${inset.y}%`, bottom: `${inset.y}%` }}
          >
            <MlbHeatGrid batterId={batterId} cells={cells} pending={pending} fill faded={hasPitches} />
            {hasPitches ? (
              <div className="pointer-events-none absolute inset-0 z-[2] rounded-[2px] border border-white/55" />
            ) : null}
          </div>
          {boxSide ? (
            <>
              <BatterCapsule side="left" inset={inset} batter={boxSide === "left" ? batter : null} />
              <BatterCapsule side="right" inset={inset} batter={boxSide === "right" ? batter : null} />
            </>
          ) : null}
          {dots.map((d) => (
            <PitchDot
              key={d.pitch.number}
              pitch={d.pitch}
              pos={d}
              latest={d.pitch.number === latestNumber}
            />
          ))}
        </div>
        {hasPitches ? <PitchLegend /> : null}
      </div>
      {hasPitches ? (
        <div className="flex w-full min-w-0 max-w-[22rem] flex-col gap-2.5 lg:w-[18.5rem]">
          {latest ? <MlbPitchStatcastCard pitch={latest} pitchHand={pitchHand} /> : null}
          <PitchList pitches={pitches} />
        </div>
      ) : null}
    </div>
  );
}
