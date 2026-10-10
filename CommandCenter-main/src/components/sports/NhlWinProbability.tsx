import { useId, useMemo } from "react";
import { CfbWinProbBadge } from "@/components/sports/CfbWinProbability";
import { paintWinProbColor } from "@/lib/cfb-win-probability";
import {
  NHL_PERIOD_SEC,
  NHL_REGULATION_SEC,
  plotNhlWinProbability,
  type NhlWinProbPoint,
} from "@/lib/nhl-win-probability";
import type { NhlScoreSide } from "@/lib/nhl";

function teamHex(color: string | undefined, fallback = "334155"): string {
  const raw = (color || fallback).replace(/^#/, "");
  return `#${raw.length === 6 ? raw : fallback}`;
}

/**
 * Win-probability chart for an NHL game. Same shape as the football chart:
 * away color above the line, home color below, remaining time unfilled.
 * The series is the score/clock/strength model, not an ESPN probability feed.
 */
export default function NhlWinProbability({
  away,
  home,
  points,
}: {
  away: NhlScoreSide;
  home: NhlScoreSide;
  points: NhlWinProbPoint[];
}) {
  const clipId = useId().replace(/:/g, "");
  const plot = useMemo(() => (points.length ? plotNhlWinProbability(points) : null), [points]);
  if (!plot || !points.length) return null;

  const current = points[points.length - 1]!;
  const awayColor = paintWinProbColor(teamHex(away.color, "1e3a5f"), away.alternateColor);
  const homeColor = paintWinProbColor(teamHex(home.color, "7a1f1f"), home.alternateColor);
  const awayTeam = {
    abbrev: away.abbrev,
    color: awayColor.replace(/^#/, ""),
    alternateColor: away.alternateColor,
    logo: away.logo,
  };
  const homeTeam = {
    abbrev: home.abbrev,
    color: homeColor.replace(/^#/, ""),
    alternateColor: home.alternateColor,
    logo: home.logo,
  };
  const periods = ["1st", "2nd", "3rd"] as const;
  const showOt = plot.domain > NHL_REGULATION_SEC + 1;

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#07101d] shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
          Win probability
          <span className="ml-2 text-[9px] font-semibold tracking-[0.14em] text-white/35">Score · time</span>
        </h2>
        <CfbWinProbBadge homeWinPct={current.homeWinPct} away={awayTeam} home={homeTeam} />
      </div>

      <div className="px-3 pb-3">
        <div className="relative h-36 overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.28)]">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={`Win probability chart. ${home.abbrev} is the lower color, ${away.abbrev} the upper color. Remaining time is unfilled.`}
          >
            <defs>
              <clipPath id={`${clipId}-hist`}>
                <rect x="0" y="0" width={Math.max(0, plot.nowX)} height="100" />
              </clipPath>
            </defs>
            <rect width="100" height="100" fill="#0b1220" />
            <g clipPath={`url(#${clipId}-hist)`}>
              <rect width="100" height="100" fill={awayColor} />
              {plot.area ? <path d={plot.area} fill={homeColor} /> : null}
            </g>
            {plot.future && plot.last ? (
              <path
                d={`M${plot.last.x.toFixed(2)} ${plot.last.y.toFixed(2)} L100 ${plot.last.y.toFixed(2)}`}
                fill="none"
                stroke="#f7f4ee"
                strokeOpacity="0.35"
                strokeWidth="1.6"
                strokeDasharray="2.4 2.2"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {plot.future ? (
              <line
                x1={plot.nowX}
                y1="0"
                x2={plot.nowX}
                y2="100"
                stroke="#f7f4ee"
                strokeOpacity="0.45"
                strokeWidth="1.15"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke="white"
              strokeOpacity="0.28"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {plot.ticks.map((x) => (
              <line
                key={x}
                x1={x}
                y1="0"
                x2={x}
                y2="100"
                stroke="white"
                strokeOpacity="0.16"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {plot.line ? (
              <path
                d={plot.line}
                fill="none"
                stroke="#f7f4ee"
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          <span className="pointer-events-none absolute left-2 top-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]">
            {away.abbrev}
          </span>
          <span className="pointer-events-none absolute bottom-1.5 left-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]">
            {home.abbrev}
          </span>
          {plot.last ? (
            <span
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f7f4ee] shadow-[0_0_0_3px_rgba(0,0,0,0.28)]"
              style={{ left: `${plot.last.x}%`, top: `${plot.last.y}%` }}
            />
          ) : null}
        </div>
        <div className="relative mt-1.5 h-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
          {periods.map((label, i) => (
            <span
              key={label}
              className="absolute -translate-x-1/2"
              style={{ left: `${((i + 0.5) * NHL_PERIOD_SEC * 100) / plot.domain}%` }}
            >
              {label}
            </span>
          ))}
          {showOt ? (
            <span
              className="absolute -translate-x-1/2"
              style={{
                left: `${((NHL_REGULATION_SEC + plot.domain) / 2 / plot.domain) * 100}%`,
              }}
            >
              OT
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
