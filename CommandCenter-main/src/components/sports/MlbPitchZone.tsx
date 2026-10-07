import MlbHeatGrid from "@/components/sports/MlbHeatGrid";
import type { MlbPitchPlot } from "@/lib/mlb";
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
import { cn } from "@/lib/utils";

/** Zone height ÷ width — matches the old hot-zone grid proportions. */
const ZONE_ASPECT = 0.92;

function pitchTitle(p: MlbPitchPlot): string {
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
  pitch: MlbPitchPlot;
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

function PitchList({ pitches }: { pitches: MlbPitchPlot[] }) {
  const lastNumber = pitches[pitches.length - 1]?.number;
  return (
    <div className="w-[10.5rem] min-w-0 text-[11px] sm:w-[11rem]">
      <div className="grid grid-cols-[1.1rem_1.6rem_1.5rem_minmax(0,1fr)] gap-x-1.5 border-b border-white/[0.08] pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6f778a]">
        <span>#</span>
        <span>Type</span>
        <span className="text-right">Mph</span>
        <span>Result</span>
      </div>
      <ol className="mt-0.5">
        {pitches.map((p) => {
          const s = pitchResultStyle(pitchResultFromPlot(p));
          const latest = p.number === lastNumber;
          return (
            <li
              key={p.number}
              className={cn(
                "grid grid-cols-[1.1rem_1.6rem_1.5rem_minmax(0,1fr)] items-center gap-x-1.5 rounded-[3px] py-[3px] leading-tight",
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
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Live strike zone: faded batter hot zones + the current at-bat's pitches as
 * numbered dots at their plate location (catcher's view), with a pitch list.
 * No pitches yet → the plain hot-zone grid at full strength.
 */
export default function MlbPitchZone({
  batterId,
  cells,
  pending,
  pitches,
}: {
  batterId: number | null;
  cells: ReturnType<typeof heatZoneGrid>;
  pending: boolean;
  pitches: MlbPitchPlot[];
}) {
  const hasPitches = pitches.length > 0;
  const inset = zoneInsetPct();
  const latestNumber = pitches[pitches.length - 1]?.number;
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
    <div className="flex max-w-full flex-col items-center justify-center gap-x-5 gap-y-3 lg:flex-row">
      <div className="flex flex-col items-center gap-2.5">
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
      {hasPitches ? <PitchList pitches={pitches} /> : null}
    </div>
  );
}
