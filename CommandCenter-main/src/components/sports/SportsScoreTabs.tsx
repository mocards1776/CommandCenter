import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useScoreStripItems } from "@/hooks/useScoreStripItems";
import { espnDarkLogo, toTab, type ScoreTab, type TabSide } from "@/lib/ruwt-score-tab";
import { cn } from "@/lib/utils";

const GAME_PATH = /^\/sports\/(mlb|nfl|nhl|cfb|soccer)\/game\/([^/?#]+)/;

function TabLogo({ side }: { side: TabSide }) {
  const dark = espnDarkLogo(side.logo);
  return (
    <img
      src={dark ?? side.logo}
      onError={(e) => {
        if (dark && e.currentTarget.src !== side.logo) e.currentTarget.src = side.logo;
      }}
      alt={side.abbrev}
      title={side.abbrev}
      loading="lazy"
      className="h-6 w-6 shrink-0 object-contain"
    />
  );
}

function ScorePill({ tab, lead }: { tab: ScoreTab; lead: boolean }) {
  const pregame = !tab.live && !tab.final;
  const a = Number(tab.away.score);
  const h = Number(tab.home.score);
  const awayLost = tab.final && Number.isFinite(a) && Number.isFinite(h) && a < h;
  const homeLost = tab.final && Number.isFinite(a) && Number.isFinite(h) && h < a;

  return (
    <Link
      to={tab.href}
      data-tab-key={tab.key}
      data-ribbon-lead={lead ? "true" : undefined}
      aria-label={`${tab.away.abbrev} at ${tab.home.abbrev}`}
      className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-[#1a2133] px-3 transition-colors hover:border-white/25"
    >
      <TabLogo side={tab.away} />
      {!pregame ? (
        <span
          className={cn(
            "numeral min-w-[1ch] text-[15px] font-bold",
            awayLost ? "text-chalk-dim" : "text-cream",
          )}
        >
          {tab.away.score ?? "–"}
        </span>
      ) : null}
      <span
        className={cn(
          "flex min-w-[3.25rem] flex-col items-center text-center leading-tight",
          tab.live ? "text-cream" : "text-chalk",
        )}
      >
        <span className="numeral whitespace-nowrap text-[11px] font-semibold">
          {tab.status[0]}
        </span>
        {tab.status[1] ? (
          <span className="whitespace-nowrap text-[10px] opacity-80">{tab.status[1]}</span>
        ) : null}
      </span>
      {!pregame ? (
        <span
          className={cn(
            "numeral min-w-[1ch] text-[15px] font-bold",
            homeLost ? "text-chalk-dim" : "text-cream",
          )}
        >
          {tab.home.score ?? "–"}
        </span>
      ) : null}
      <TabLogo side={tab.home} />
    </Link>
  );
}

/**
 * ESPN-style scrollable score capsules.
 * Live RUWT heat when any game is on. When the slate is all final, Today's
 * Top order. On a game page the open game is omitted — the page is that
 * game — and the strip leads with heat #1 (or Today's Top #1) instead of
 * scrolling the open game to center.
 */
export default function SportsScoreTabs() {
  const { pathname } = useLocation();
  const strip = useScoreStripItems();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const viewingKey = useMemo(() => {
    const m = pathname.match(GAME_PATH);
    return m ? `${m[1]}-${decodeURIComponent(m[2]!)}` : null;
  }, [pathname]);

  const tabs = useMemo(() => {
    const all = strip.items.map(toTab);
    if (!viewingKey) return all;
    return all.filter((tab) => tab.key !== viewingKey);
  }, [strip.items, viewingKey]);

  const leadKey = tabs[0]?.key ?? "";

  useEffect(() => {
    if (!viewingKey) return;
    scrollerRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [viewingKey, leadKey]);

  if (tabs.length === 0) return null;

  return (
    <div
      className="bg-ink relative z-10 border-b border-accent/10 print:hidden"
      data-score-strip={strip.source}
    >
      <div
        ref={scrollerRef}
        className="relative flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, index) => (
          <ScorePill key={tab.key} tab={tab} lead={index === 0} />
        ))}
      </div>
    </div>
  );
}
