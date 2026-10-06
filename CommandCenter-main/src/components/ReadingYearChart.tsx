import { useMemo, useState } from "react";
import { cn, todayStr } from "@/lib/utils";
import {
  lastDayOfMonth,
  rolling12MonthStats,
  type RollingMonthPoint,
  type RollingYearSeries,
  type YearChartBook,
  type YearChartSession,
} from "@/lib/reading-year";

export type ReadingYearFocus = {
  kind: "pages" | "finished";
  label: string;
  from: string;
  to: string;
};

function niceMax(n: number, floor = 1): number {
  const v = Math.max(floor, n);
  const pow = 10 ** Math.floor(Math.log10(v));
  const scaled = v / pow;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * pow;
}

function compact(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) {
    const tenths = Math.round(n / 100) / 10;
    return Number.isInteger(tenths) ? `${tenths}k` : `${tenths.toFixed(1)}k`;
  }
  return String(n);
}

function monthFocus(point: RollingMonthPoint, kind: "finished" | "pages"): ReadingYearFocus {
  return {
    kind,
    label: `${point.label} · ${kind === "finished" ? "books finished" : "pages"}`,
    from: `${point.key}-01`,
    to: lastDayOfMonth(point.key),
  };
}

export default function ReadingYearChart({
  books,
  sessions,
  onBreakdown,
}: {
  books: YearChartBook[];
  sessions: YearChartSession[];
  onBreakdown?: (focus: ReadingYearFocus) => void;
}) {
  const series = useMemo(() => rolling12MonthStats(books, sessions, todayStr()), [books, sessions]);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const active = pinned ?? hover;
  const selected = series.months.find((m) => m.key === active) ?? null;
  const range = `${series.months[0]!.month} ${series.months[0]!.year} – ${series.months.at(-1)!.month} ${series.months.at(-1)!.year}`;

  const pinMonth = (key: string) => {
    setPinned((cur) => (cur === key ? null : key));
  };

  const openList = (kind: "finished" | "pages") => {
    if (!onBreakdown || !selected) return;
    onBreakdown(monthFocus(selected, kind));
  };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="rule-head">Last 12 months</h2>
        <p className="text-chalk-dim mt-1 text-[10.5px] tracking-[0.04em]">{range}</p>
      </div>

      <MonthBars
        title="Books finished"
        series={series}
        values={series.months.map((m) => m.booksFinished)}
        total={series.totalBooks}
        unit={(n) => (n === 1 ? "book" : "books")}
        fill="cream"
        floor={4}
        active={active}
        onHover={setHover}
        onPin={pinMonth}
        onOpenList={() => openList("finished")}
      />

      <MonthBars
        title="Pages"
        series={series}
        values={series.months.map((m) => m.pages)}
        total={series.totalPages}
        unit={() => "pages"}
        fill="accent"
        floor={100}
        active={active}
        onHover={setHover}
        onPin={pinMonth}
        onOpenList={() => openList("pages")}
      />

      {selected && (
        <div className="rounded-sm border border-white/10 bg-ink/80 px-3 py-2.5">
          <p className="text-cream text-[13px] font-medium">{selected.label}</p>
          <p className="text-chalk mt-1 text-[12px]">
            <span className="numeral text-cream">{selected.booksFinished}</span>{" "}
            {selected.booksFinished === 1 ? "book" : "books"}
            <span className="text-chalk-dim/50 mx-1.5">·</span>
            <span className="numeral text-accent">{selected.pages.toLocaleString()}</span> pages
            {selected.pagesEstimated > 0 && selected.pagesLogged > 0 && (
              <span className="text-chalk-dim">
                {" "}
                ({selected.pagesLogged.toLocaleString()} logged)
              </span>
            )}
            {selected.pagesEstimated > 0 && selected.pagesLogged === 0 && (
              <span className="text-chalk-dim"> estimated</span>
            )}
          </p>
          {onBreakdown && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openList("finished")}
                className="text-accent hover:text-cream text-[11px] uppercase tracking-[0.12em]"
              >
                Books that month
              </button>
              <button
                type="button"
                onClick={() => openList("pages")}
                className="text-accent hover:text-cream text-[11px] uppercase tracking-[0.12em]"
              >
                Pages that month
              </button>
            </div>
          )}
        </div>
      )}

      {!selected && (
        <p className="text-chalk-dim text-[10.5px]">Tap a month for the exact count.</p>
      )}

      <p
        className={cn(
          "text-chalk-dim text-[10.5px] leading-relaxed",
          series.totalEstimated === 0 && "sr-only",
        )}
      >
        {series.totalEstimated > 0
          ? `${series.totalLogged.toLocaleString()} pages logged · ${series.totalEstimated.toLocaleString()} estimated from page counts (finishes with no sessions).`
          : "Pages are summed from logged reading sessions. Empty months are zero."}
      </p>
    </section>
  );
}

function MonthBars({
  title,
  series,
  values,
  total,
  unit,
  fill,
  floor,
  active,
  onHover,
  onPin,
  onOpenList,
}: {
  title: string;
  series: RollingYearSeries;
  values: number[];
  total: number;
  unit: (n: number) => string;
  fill: "cream" | "accent";
  floor: number;
  active: string | null;
  onHover: (key: string | null) => void;
  onPin: (key: string) => void;
  onOpenList: () => void;
}) {
  const max = niceMax(Math.max(...values), floor);
  const W = 640;
  const H = 148;
  const padL = 34;
  const padR = 12;
  const padT = 10;
  const padB = 6;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const colW = innerW / series.months.length;
  const barW = Math.min(26, colW * 0.52);
  const gradId = fill === "accent" ? "ry-fill-accent" : "ry-fill-cream";
  const grid = [0, 0.5, 1];

  const x = (i: number) => padL + colW * i + colW / 2;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-chalk text-[10px] font-semibold uppercase tracking-[0.18em]">{title}</h3>
        <p>
          <span
            className={cn(
              "numeral text-[20px] leading-none",
              fill === "accent" ? "text-accent" : "text-cream",
            )}
          >
            {total.toLocaleString()}
          </span>
          <span className="text-chalk-dim ml-1.5 text-[11px]">{unit(total)}</span>
        </p>
      </div>

      <div className="relative overflow-hidden rounded-sm border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="pointer-events-none block h-auto w-full"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="ry-fill-accent" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--color-accent-dark)" />
              <stop offset="55%" stopColor="var(--color-accent-deep)" />
              <stop offset="100%" stopColor="var(--color-accent)" />
            </linearGradient>
            <linearGradient id="ry-fill-cream" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#c9c4b6" />
              <stop offset="100%" stopColor="var(--color-cream)" />
            </linearGradient>
          </defs>

          {grid.map((t) => {
            const y = padT + innerH * (1 - t);
            return (
              <g key={t}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={y}
                  y2={y}
                  stroke="rgba(237,239,245,0.08)"
                  strokeWidth={t === 0 ? 1.25 : 1}
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="rgba(237,239,245,0.32)"
                  fontSize="9"
                  fontFamily="var(--font-body)"
                >
                  {t === 0 ? "0" : compact(max * t)}
                </text>
              </g>
            );
          })}

          {series.months.map((m, i) => {
            const value = values[i] ?? 0;
            const barH = Math.max(2, (value / max) * innerH);
            const isOn = active === m.key;
            return (
              <rect
                key={m.key}
                x={x(i) - barW / 2}
                y={padT + innerH - barH}
                width={barW}
                height={barH}
                rx={2}
                fill={`url(#${gradId})`}
                opacity={active && !isOn ? 0.35 : value === 0 ? 0.22 : 0.95}
              />
            );
          })}
        </svg>

        <div
          className="absolute inset-0"
          style={{
            paddingLeft: `${(padL / W) * 100}%`,
            paddingRight: `${(padR / W) * 100}%`,
            paddingTop: `${(padT / H) * 100}%`,
            paddingBottom: `${(padB / H) * 100}%`,
          }}
        >
          <div className="flex h-full">
            {series.months.map((m, i) => {
              const value = values[i] ?? 0;
              return (
                <button
                  key={m.key}
                  type="button"
                  className="h-full min-w-0 flex-1 touch-manipulation rounded-sm focus-visible:bg-white/[0.06] focus-visible:outline-none [-webkit-touch-callout:none]"
                  aria-pressed={active === m.key}
                  aria-label={`${m.label}: ${value.toLocaleString()} ${unit(value)}`}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") onHover(m.key);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === "mouse") onHover(null);
                  }}
                  onClick={() => onPin(m.key)}
                  onDoubleClick={onOpenList}
                />
              );
            })}
          </div>
        </div>

        <div
          className="pointer-events-none flex pb-2"
          style={{
            paddingLeft: `${(padL / W) * 100}%`,
            paddingRight: `${(padR / W) * 100}%`,
          }}
        >
          {series.months.map((m) => (
            <span
              key={m.key}
              className={cn(
                "min-w-0 flex-1 text-center text-[9px] leading-none sm:text-[10px]",
                active === m.key ? "text-cream" : "text-chalk-dim",
              )}
            >
              <span className="sm:hidden">{m.month[0]}</span>
              <span className="hidden sm:inline">{m.tick}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
