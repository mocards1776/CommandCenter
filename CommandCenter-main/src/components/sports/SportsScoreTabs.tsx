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

function ScorePill({ tab, active }: { tab: ScoreTab; active: boolean }) {
  const pregame = !tab.live && !tab.final;
  const a = Number(tab.away.score);
  const h = Number(tab.home.score);
  const awayLost = tab.final && Number.isFinite(a) && Number.isFinite(h) && a < h;
  const homeLost = tab.final && Number.isFinite(a) && Number.isFinite(h) && h < a;

  return (
    <Link
      to={tab.href}
      data-tab-key={tab.key}
      aria-current={active ? "page" : undefined}
      aria-label={`${tab.away.abbrev} at ${tab.home.abbrev}`}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#1a2133] px-3 transition-colors",
        active
          ? "border-2 border-white"
          : "border border-white/[0.08] hover:border-white/25",
      )}
    >
      <TabLogo side={tab.away} />
      {active ? (
        <span className="text-chalk px-1 text-[13px]">@</span>
      ) : (
        <>
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
        </>
      )}
      <TabLogo side={tab.home} />
    </Link>
  );
}

/**
 * ESPN-style scrollable score capsules.
 * Live games when any are on, otherwise Today's Top / upcoming, otherwise
 * recent finals (yesterday preferred, favorite clubs first). Hidden only
 * when every bucket is empty — an empty live list does not unmount the strip.
 */
export default function SportsScoreTabs() {
  const { pathname } = useLocation();
  const strip = useScoreStripItems();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const centeredKeyRef = useRef<string | null>(null);

  const tabs = useMemo(() => strip.items.map(toTab), [strip.items]);

  const activeKey = useMemo(() => {
    const m = pathname.match(GAME_PATH);
    return m ? `${m[1]}-${decodeURIComponent(m[2]!)}` : null;
  }, [pathname]);

  const activePresent = activeKey != null && tabs.some((t) => t.key === activeKey);

  useEffect(() => {
    if (!activeKey) {
      centeredKeyRef.current = null;
      return;
    }
    if (!activePresent || centeredKeyRef.current === activeKey) return;
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(activeKey)}"]`);
    if (!scroller || !el) return;
    const smooth = centeredKeyRef.current != null;
    centeredKeyRef.current = activeKey;
    scroller.scrollTo({
      left: el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2,
      behavior: smooth ? "smooth" : "auto",
    });
  }, [activeKey, activePresent]);

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
        {tabs.map((tab) => (
          <ScorePill key={tab.key} tab={tab} active={tab.key === activeKey} />
        ))}
      </div>
    </div>
  );
}
