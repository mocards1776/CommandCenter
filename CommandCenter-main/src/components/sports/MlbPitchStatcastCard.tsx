import { pitchResultFromPlot, pitchResultStyle } from "@/lib/mlb-pitch-zone";
import {
  pitchTypeName,
  statcastHitChips,
  statcastPitchChips,
  type MlbLivePitch,
  type StatChip,
} from "@/lib/mlb-statcast";
import { cn } from "@/lib/utils";

function ChipGrid({ chips, className }: { chips: StatChip[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-3 gap-1.5", className)}>
      {chips.map((c) => (
        <div
          key={c.key}
          className="min-w-0 rounded-xl bg-white/[0.05] px-2 py-1.5 ring-1 ring-inset ring-white/[0.06]"
        >
          <dt className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8b93a7]">
            {c.label}
          </dt>
          <dd className="numeral mt-0.5 truncate text-[15px] font-semibold leading-tight text-cream">
            {c.value}
            {c.unit ? <span className="ml-0.5 text-[10px] font-medium text-white/50">{c.unit}</span> : null}
          </dd>
          {c.sub ? <dd className="truncate text-[9.5px] leading-tight text-[#8b93a7]">{c.sub}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/**
 * Big "latest pitch" Statcast card: pitch name, result, velo, spin, axis,
 * breaks, extension, release, zone — plus exit velo / launch angle / distance
 * when the ball was put in play. Fields the feed lacks are simply not shown.
 */
export default function MlbPitchStatcastCard({
  pitch,
  pitchHand,
}: {
  pitch: MlbLivePitch;
  pitchHand?: "L" | "R" | null;
}) {
  const result = pitchResultFromPlot(pitch);
  const style = pitchResultStyle(result);
  // In-play dots are white; use a blue accent so the card still has color.
  const accent = result === "inplay" ? "#60a5fa" : style.fill;
  const sc = pitch.statcast ?? null;
  const name = pitchTypeName(pitch) ?? "Pitch";
  const start = sc?.startSpeed ?? pitch.speed;
  const end = sc?.endSpeed ?? null;
  const pitchChips = statcastPitchChips(sc, pitchHand);
  const hitChips = statcastHitChips(sc?.hit);

  return (
    <section
      aria-label={`Latest pitch: ${name}, ${pitch.callLabel}`}
      className="relative overflow-hidden rounded-2xl bg-white/[0.035] p-3 ring-1 ring-inset ring-white/[0.08]"
      style={{ boxShadow: `inset 0 2px 0 ${accent}` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <p className="shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
          Latest pitch · #{pitch.number}
        </p>
        <span
          className="min-w-0 truncate rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
          style={{ color: accent, background: `${accent}1f`, boxShadow: `inset 0 0 0 1px ${accent}55` }}
        >
          {pitch.callLabel}
        </span>
      </div>
      <div className="relative mt-1.5 flex items-end justify-between gap-3">
        <p className="min-w-0 text-[17px] font-semibold leading-tight text-cream">{name}</p>
        {start != null ? (
          <div className="shrink-0 text-right">
            <p className="numeral text-[28px] font-semibold leading-none text-white">
              {start.toFixed(1)}
              <span className="ml-0.5 text-[11px] font-medium text-white/55">mph</span>
            </p>
            {end != null ? (
              <p className="numeral mt-0.5 text-[10px] text-[#8b93a7]">{end.toFixed(1)} at plate</p>
            ) : null}
          </div>
        ) : null}
      </div>
      {pitchChips.length > 0 ? <ChipGrid chips={pitchChips} className="relative mt-2.5" /> : null}
      {hitChips.length > 0 ? (
        <>
          <p
            className="relative mb-1.5 mt-3 text-[9.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: accent }}
          >
            Batted ball
          </p>
          <ChipGrid chips={hitChips} className="relative" />
        </>
      ) : null}
    </section>
  );
}
