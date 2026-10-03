import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { UnifiedRuwtItem } from "@/hooks/useRuwtSlate";
import { useRuwtSlateSplit } from "@/hooks/useRuwtSlateSplit";
import { ruwtTodaysTop, ruwtWhyReasons } from "@/lib/ruwt-slate";
import {
  espnDarkLogo,
  kickoffLabel,
  RUWT_SPORT_LABEL,
  ruwtStartIso,
  toTab,
  type TabSide,
} from "@/lib/ruwt-score-tab";
import { cn } from "@/lib/utils";

const LIVE_LIMIT = 9;
const TOP_LIMIT = 6;

function SlateLogo({ side, size }: { side: TabSide; size: "sm" | "lg" }) {
  const dark = espnDarkLogo(side.logo);
  return (
    <img
      src={dark ?? side.logo}
      onError={(e) => {
        if (dark && e.currentTarget.src !== side.logo) e.currentTarget.src = side.logo;
      }}
      alt=""
      loading="lazy"
      className={cn("shrink-0 object-contain", size === "lg" ? "h-10 w-10" : "h-7 w-7")}
    />
  );
}

function SportBadge({ item }: { item: UnifiedRuwtItem }) {
  const label = item.sport === "soccer" ? item.game.league || "Soccer" : RUWT_SPORT_LABEL[item.sport];
  return (
    <span className="max-w-[10rem] truncate rounded-sm bg-white/[0.07] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#c5cce0]">
      {label}
    </span>
  );
}

function sideRank(item: UnifiedRuwtItem, which: "away" | "home"): number | null {
  if (item.sport !== "cfb") return null;
  const r = item.game[which].rank;
  return r != null && r >= 1 && r <= 25 ? r : null;
}

function WhyLine({ item }: { item: UnifiedRuwtItem }) {
  const why = ruwtWhyReasons(item.game.reasons, 2);
  if (why.length === 0) return null;
  return <p className="text-chalk-dim truncate text-[10.5px]">{why.join(" · ")}</p>;
}

function LiveCard({ item }: { item: UnifiedRuwtItem }) {
  const tab = toTab(item);
  const rows = [
    { side: tab.away, rank: sideRank(item, "away") },
    { side: tab.home, rank: sideRank(item, "home") },
  ];
  return (
    <Link
      to={tab.href}
      className="bg-panel group flex flex-col gap-2 rounded-lg border border-white/[0.08] p-3 transition hover:border-accent/35"
    >
      <div className="flex items-center justify-between gap-2">
        <SportBadge item={item} />
        <span className="text-alert inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide">
          <span className="bg-alert inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
          <span className="numeral normal-case">
            {tab.status[0]}
            {tab.status[1] ? ` · ${tab.status[1]}` : ""}
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map(({ side, rank }, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <SlateLogo side={side} size="sm" />
            <span className="text-cream min-w-0 flex-1 truncate text-[14px] font-semibold group-hover:underline">
              {rank ? <span className="text-chalk-dim numeral mr-1 text-[11px]">{rank}</span> : null}
              {side.abbrev}
            </span>
            <span className="numeral text-cream text-[18px] font-bold leading-none">
              {side.score ?? "–"}
            </span>
          </div>
        ))}
      </div>
      <WhyLine item={item} />
    </Link>
  );
}

function TopCard({ item, rank, finals }: { item: UnifiedRuwtItem; rank: number; finals: boolean }) {
  const tab = toTab(item);
  const start = kickoffLabel(ruwtStartIso(item)) ?? tab.status[0];
  const why = ruwtWhyReasons(item.game.reasons, 3);
  const tv = (item.game.broadcasts ?? []).slice(0, 2).map((b) => b.name);
  const pitchers =
    item.sport === "mlb" && !finals
      ? [item.game.away.probablePitcher, item.game.home.probablePitcher]
      : null;
  const side = (s: TabSide, r: number | null) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <SlateLogo side={s} size="lg" />
      <span className="text-cream w-full truncate text-[13.5px] font-semibold leading-tight group-hover:underline">
        {r ? <span className="text-chalk-dim numeral mr-1 text-[11px]">{r}</span> : null}
        {s.name}
      </span>
      {finals ? (
        <span className="numeral text-cream text-[20px] font-bold leading-none">{s.score ?? "–"}</span>
      ) : null}
    </div>
  );

  return (
    <Link
      to={tab.href}
      className="bg-panel group relative flex flex-col overflow-hidden rounded-lg border border-white/[0.08] transition hover:border-accent/35"
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-accent/70" />
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="numeral text-accent text-[13px] font-bold">#{rank}</span>
          <SportBadge item={item} />
        </span>
        <span className="numeral text-cream shrink-0 text-[13px] font-semibold">
          {finals ? "Final" : start}
        </span>
      </div>
      <div className="flex items-start gap-2 px-3.5 py-3">
        {side(tab.away, sideRank(item, "away"))}
        <span className="text-chalk-dim mt-3 shrink-0 text-[11px] uppercase tracking-[0.14em]">at</span>
        {side(tab.home, sideRank(item, "home"))}
      </div>
      {pitchers && (pitchers[0] || pitchers[1]) ? (
        <p className="text-chalk truncate px-3.5 pb-2 text-center text-[11px]">
          {pitchers[0] ?? "TBD"} vs {pitchers[1] ?? "TBD"}
        </p>
      ) : null}
      {why.length > 0 || tv.length > 0 ? (
        <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] px-3.5 py-2">
          {why.map((r) => (
            <span
              key={r}
              className="rounded-sm bg-accent/12 px-1.5 py-0.5 text-[10px] font-medium text-[#f0d6d8]"
            >
              {r}
            </span>
          ))}
          {tv.length > 0 ? (
            <span className="text-chalk-dim ml-auto truncate text-[10px]">{tv.join(" · ")}</span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

function SectionHead({ title, count, live }: { title: string; count?: number; live?: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="inline-flex items-center gap-2">
        {live ? <span className="bg-alert inline-block h-2 w-2 animate-pulse rounded-full" /> : null}
        <span className="rule-head">{title}</span>
        {count != null && count > 0 ? (
          <span className="text-chalk-dim numeral text-[11px]">({count})</span>
        ) : null}
      </h2>
      <Link
        to="/sports/ruwt"
        className="text-chalk hover:text-cream inline-flex items-center gap-0.5 text-[10.5px] uppercase tracking-[0.14em]"
      >
        RUWT
        <ChevronRight size={13} />
      </Link>
    </div>
  );
}

/** Sports home: games in progress, then today's best not-yet-started games, both in RUWT order. */
export default function SportsSlateSections() {
  const slate = useRuwtSlateSplit();
  const top = ruwtTodaysTop(slate, TOP_LIMIT);

  if (slate.allPending) return null;
  if (slate.live.length === 0 && top.items.length === 0) return null;

  const liveShown = slate.live.slice(0, LIVE_LIMIT);
  const liveMore = slate.live.length - liveShown.length;
  const nextUp = slate.upcoming[0];
  const nextStart = nextUp ? kickoffLabel(ruwtStartIso(nextUp)) : null;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionHead title="Live" count={slate.live.length} live={slate.live.length > 0} />
        {liveShown.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {liveShown.map((item) => (
              <LiveCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="text-chalk-dim text-[12.5px]">
            Nothing live right now{nextStart ? ` · next game ${nextStart}` : ""}.
          </p>
        )}
        {liveMore > 0 ? (
          <Link
            to="/sports/ruwt"
            className="text-chalk hover:text-cream mt-2 inline-block text-[11px] uppercase tracking-[0.14em]"
          >
            +{liveMore} more live
          </Link>
        ) : null}
      </section>

      {top.items.length > 0 ? (
        <section>
          <SectionHead title={top.mode === "finals" ? "Today’s Top · Finals" : "Today’s Top"} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {top.items.map((item, i) => (
              <TopCard key={item.id} item={item} rank={i + 1} finals={top.mode === "finals"} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
