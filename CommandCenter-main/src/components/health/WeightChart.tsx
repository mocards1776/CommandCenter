import { useMemo } from "react";
import {
  addDays,
  chartDayRange,
  daysBetween,
  goalSeries,
  goalWeightLb,
  smoothWeights,
  type WeightSample,
} from "@/lib/health-math";

type Props = {
  samples: WeightSample[];
  today: string;
};

const W = 360;
const H = 220;
const PAD_L = 42;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;

function polyline(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

export default function WeightChart({ samples, today }: Props) {
  const model = useMemo(() => {
    const sorted = [...samples].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    const range = chartDayRange(sorted, today);
    const span = Math.max(1, daysBetween(range.start, range.end));
    const trend = smoothWeights(sorted);
    const goals = goalSeries(range.start, range.end);
    const ys = [
      ...sorted.map((s) => s.lb),
      ...trend,
      ...goals.map((g) => g.lb),
      goalWeightLb(today),
    ];
    const minY = Math.min(...ys) - 2;
    const maxY = Math.max(...ys) + 2;
    const ySpan = Math.max(1, maxY - minY);
    const xOf = (day: string) => PAD_L + (daysBetween(range.start, day) / span) * (W - PAD_L - PAD_R);
    const yOf = (lb: number) => PAD_T + ((maxY - lb) / ySpan) * (H - PAD_T - PAD_B);
    const ticks: number[] = [];
    const step = ySpan > 20 ? 5 : 2;
    const firstTick = Math.ceil(minY / step) * step;
    for (let t = firstTick; t <= maxY; t += step) ticks.push(t);
    return {
      range,
      xOf,
      yOf,
      ticks,
      actual: sorted.map((s) => ({ ...s, x: xOf(s.day), y: yOf(s.lb) })),
      trend: sorted.map((s, i) => ({ x: xOf(s.day), y: yOf(trend[i] ?? s.lb) })),
      goal: goals.filter((_, i) => i % 2 === 0 || i === goals.length - 1).map((g) => ({
        x: xOf(g.day),
        y: yOf(g.lb),
      })),
      todayX: xOf(today),
    };
  }, [samples, today]);

  const monthTicks = useMemo(() => {
    const out: { day: string; x: number }[] = [];
    let cursor = model.range.start.slice(0, 7) + "-01";
    if (cursor < model.range.start) cursor = addDays(cursor, 32).slice(0, 7) + "-01";
    while (cursor <= model.range.end) {
      if (cursor >= model.range.start) out.push({ day: cursor, x: model.xOf(cursor) });
      cursor = addDays(cursor, 32).slice(0, 7) + "-01";
    }
    return out;
  }, [model]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Weight trend, smoothed line, and one pound per week goal"
      className="h-[220px] w-full md:h-[280px]"
    >
      {model.ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={model.yOf(tick)}
            y2={model.yOf(tick)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          <text
            x={PAD_L - 6}
            y={model.yOf(tick) + 3}
            textAnchor="end"
            fill="rgba(238,242,247,0.55)"
            fontSize="9"
            fontFamily='"IBM Plex Mono", ui-monospace, monospace'
          >
            {tick}
          </text>
        </g>
      ))}
      <line
        x1={model.todayX}
        x2={model.todayX}
        y1={PAD_T}
        y2={H - PAD_B}
        stroke="rgba(255,255,255,0.16)"
        strokeDasharray="2 3"
      />
      <path
        d={polyline(model.goal)}
        fill="none"
        stroke="#ff5c67"
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />
      {model.trend.length > 1 ? (
        <path d={polyline(model.trend)} fill="none" stroke="#e7c45a" strokeWidth="2.4" />
      ) : null}
      {model.actual.map((p) => (
        <g key={p.day}>
          <circle cx={p.x} cy={p.y} r="3.4" fill="#f4f7fb" stroke="#ff5c67" strokeWidth="1.4" />
        </g>
      ))}
      {monthTicks.map((tick) => (
        <text
          key={tick.day}
          x={tick.x}
          y={H - 8}
          textAnchor="middle"
          fill="rgba(238,242,247,0.45)"
          fontSize="9"
          fontFamily='"IBM Plex Mono", ui-monospace, monospace'
        >
          {tick.day.slice(5)}
        </text>
      ))}
    </svg>
  );
}
