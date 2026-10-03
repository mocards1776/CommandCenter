import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useScoreStripItems } from "@/hooks/useScoreStripItems";
import LogoPlate from "@/components/sports/LogoPlate";
import { toTab, type ScoreTab, type TabSide } from "@/lib/ruwt-score-tab";
import { cn } from "@/lib/utils";

const GAME_PATH = /^\/sports\/(mlb|nfl|nhl|cfb|soccer)\/game\/([^/?#]+)/;

function TabLogo({ side }: { side: TabSide }) {
  return (
    <LogoPlate
      src={side.logo}
      alt={side.abbrev}
      className="h-6 w-6"
      loading="lazy"
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
      data-tab-key-end
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
              {tab.away.score ?? "\u2013"}
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
              {tab.home.score ?? "\u2013"}
            </span>
          ) : null}
        </>
      )}
      <TabLogo side={tab.home} />
    </Link>
  );
}
