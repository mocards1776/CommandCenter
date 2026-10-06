import { useMemo, useState } from "react";
import { cn, todayStr } from "@/lib/utils";
import {
  lastDayOfMonth,
  rolling12MonthStats,
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
  const [active, setActive] = useState<string | null>(null);

  const pageMax = niceMax(Math.max(...series.months.map((m) => m.pages)), 100);
  const bookMax = niceMax(Math.max(...series.months.map((m) => m.booksFinished)), 4);

  const W = 640;
  const H = 212;
  const padL = 36;
  const padR = 28;
  const padT = 14;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const colW = innerW / series.months.length;
  const barW = Math.min(22, colW * 0.46);

  const x = (i: number) => padL + colW * i + colW / 2;
  const yBooks = (n: number) => padT + innerH - (n / bookMax) * innerH;

  const line = series.months
    .map((m, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${yBooks(m.booksFinished).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(series.months.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const selected = series.months.find((m) => m.key === active) ?? null;
  const selectedIdx = selected ? series.months.indexOf(selected) : -1;
  const tipLeft =
    selectedIdx < 0 ? 50 : Math.min(86, Math.max(14, ((selectedIdx + 0.5) / series.months.length) * 100));

  const openMonth = (key: string, kind: "finished" | "pages") => {
    if (!onBreakdown) return;
    const point = series.months.find((m) => m.key === key);
    if (!point) return;
    onBreakdown({
      kind,
      label: `${point.label} · ${kind === "finished" ? "books finished" : "pages"}`,
      from: `${key}-01`,
      to: lastDayOfMonth(key),
    });
  };

  const grid = [0, 0.5, 1];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="rule-head">Last 12 months</h2>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>
              <span className="numeral text-cream text-[22px] leading-none">
                {series.totalBooks.toLocaleString()}
              </span>
              <span className="text-chalk-dim ml-1.5 text-[11px]">
                {series.totalBooks === 1 ? "book" : "books"}
              </span>
            </span>
            <span className="text-chalk-dim/40">·</span>
            <span>
              <span className="numeral text-accent text-[22px] leading-none">
                {series.totalPages.toLocaleString()}
              </span>
              <span className="text-chalk-dim ml-1.5 text-[11px]">pages</span>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.14em]">
          <span className="text-chalk flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-full bg-cream ring-1 ring-cream/40" />
            Books
          </span>
          <span className="text-chalk flex items-center gap-1.5">
            <i className="from-accent-deep to-accent inline-block h-2.5 w-2 rounded-[1px] bg-gradient-to-t" />
            Pages
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-sm border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Last 12 months: ${series.totalBooks} books finished, ${series.totalPages.toLocaleString()} pages`}
        >
          <defs>
            <linearGradient id="ry-bar" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--color-accent-dark)" />
              <stop offset="55%" stopColor="var(--color-accent-deep)" />
              <stop offset="100%" stopColor="var(--color-accent)" />
            </linearGradient>
            <linearGradient id="ry-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-cream)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-cream)" stopOpacity="0" />
            </linearGradient>
            <filter id="ry-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
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
                  {t === 0 ? "0" : compact(pageMax * t)}
                </text>
                {t > 0 && (
                  <text
                    x={W - padR + 6}
                    y={y + 3}
                    textAnchor="start"
                    fill="rgba(244,241,233,0.36)"
                    fontSize="9"
                    fontFamily="var(--font-body)"
                  >
                    {Math.round(bookMax * t)}
                  </text>
                )}
              </g>
            );
          })}

          <path d={area} fill="url(#ry-area)" />
          <path
            d={line}
            fill="none"
            stroke="var(--color-cream)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#ry-glow)"
          />

          {series.months.map((m, i) => {
            const cx = x(i);
            const barH = Math.max(m.pages > 0 ? 3 : 0, ((m.pages / pageMax) * innerH));
            const by = padT + innerH - barH;
            const isOn = active === m.key;
            return (
              <g key={m.key}>
                <rect
                  x={cx - barW / 2}
                  y={by}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill="url(#ry-bar)"
                  opacity={active && !isOn ? 0.45 : m.pages === 0 ? 0 : 0.92}
                />
                <circle
                  cx={cx}
                  cy={yBooks(m.booksFinished)}
                  r={isOn ? 4.2 : 3.2}
                  fill={m.booksFinished > 0 ? "var(--color-cream)" : "var(--color-field)"}
                  stroke="var(--color-cream)"
                  strokeWidth={m.booksFinished > 0 ? 1.25 : 1}
                  opacity={active && !isOn ? 0.45 : 1}
                />
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  fill={isOn ? "var(--color-cream)" : "rgba(237,239,245,0.38)"}
                  fontSize="9"
                  fontFamily="var(--font-body)"
                >
                  {m.tick}
                </text>
              </g>
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
            {series.months.map((m) => (
              <button
                key={m.key}
                type="button"
                className="h-full min-w-0 flex-1 rounded-sm focus-visible:bg-white/[0.06] focus-visible:outline-none"
                aria-label={`${m.label}: ${m.booksFinished} ${m.booksFinished === 1 ? "book" : "books"}, ${m.pages.toLocaleString()} pages`}
                onPointerEnter={() => setActive(m.key)}
                onPointerLeave={() => setActive((cur) => (cur === m.key ? null : cur))}
                onFocus={() => setActive(m.key)}
                onBlur={() => setActive((cur) => (cur === m.key ? null : cur))}
                onClick={() => {
                  setActive(m.key);
                  openMonth(m.key, "finished");
                }}
              />
            ))}
          </div>
        </div>

        {selected && (
          <div
            className="pointer-events-none absolute top-3 z-10 w-[11.5rem] -translate-x-1/2 rounded-sm border border-white/10 bg-ink/95 px-3 py-2 shadow-xl backdrop-blur-sm"
            style={{ left: `${tipLeft}%` }}
          >
            <p className="text-cream text-[12px] font-medium">{selected.label}</p>
            <p className="text-chalk mt-1 text-[12px]">
              <span className="numeral text-cream">{selected.booksFinished}</span>{" "}
              {selected.booksFinished === 1 ? "book" : "books"}
            </p>
            <p className="text-chalk text-[12px]">
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
          </div>
        )}
      </div>

      <p
        className={cn(
          "text-chalk-dim mt-2 text-[10.5px] leading-relaxed",
          series.totalEstimated === 0 && "sr-only",
        )}
      >
        {series.totalEstimated > 0
          ? `${series.totalLogged.toLocaleString()} pages from logged sessions; ${series.totalEstimated.toLocaleString()} estimated from page counts on finishes with no sessions (imported history).`
          : "Pages are summed from logged reading sessions. Empty months are zero."}
      </p>
    </div>
  );
}
