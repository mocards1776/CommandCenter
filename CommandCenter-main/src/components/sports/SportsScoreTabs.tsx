import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ruwtItemHref, useRuwtSlate, type UnifiedRuwtItem } from "@/hooks/useRuwtSlate";
import { cfbTeamLogo } from "@/lib/cfb";
import { nflTeamLogo } from "@/lib/nfl";
import { nhlTeamLogo } from "@/lib/nhl";
import { soccerTeamLogo } from "@/lib/soccer";
import { cn } from "@/lib/utils";

type TabSide = { abbrev: string; logo: string; score: string | null };

type ScoreTab = {
  key: string;
  href: string;
  away: TabSide;
  home: TabSide;
  status: [string, string | null];
  live: boolean;
  final: boolean;
};

const GAME_PATH = /^\/sports\/(mlb|nfl|nhl|cfb|soccer)\/game\/([^/?#]+)/;

function scoreText(n: number | string | null | undefined): string | null {
  return n == null || n === "" ? null : String(n);
}

function kickoffLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "12:20 - 2nd" → ["12:20", "2nd"]; ESPN-style two-line clock. */
function splitStatus(label: string): [string, string | null] {
  const parts = label.split(/\s+-\s+/);
  if (parts.length >= 2) return [parts[0]!, parts.slice(1).join(" ")];
  return [label, null];
}

function toTab(item: UnifiedRuwtItem): ScoreTab {
  const base = { key: item.id, href: ruwtItemHref(item), live: item.game.live, final: item.game.final };
  const pregame = !item.game.live && !item.game.final;

  if (item.sport === "mlb") {
    const g = item.game;
    const logo = (id: number) => `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${id}.svg`;
    const label = g.live ? g.inning || "Live" : g.final ? "Final" : g.whenShort || "Today";
    return {
      ...base,
      away: { abbrev: g.away.abbrev, logo: logo(g.away.teamId), score: scoreText(g.away.score) },
      home: { abbrev: g.home.abbrev, logo: logo(g.home.teamId), score: scoreText(g.home.score) },
      status: splitStatus(label),
    };
  }

  const g = item.game;
  const logoFor = (side: typeof g.away): string => {
    if (side.logo) return side.logo;
    switch (item.sport) {
      case "nfl":
        return nflTeamLogo(side.abbrev);
      case "nhl":
        return nhlTeamLogo(side.abbrev);
      case "cfb":
        return cfbTeamLogo(side.teamId);
      default:
        return soccerTeamLogo(side.teamId);
    }
  };
  const when = "whenShort" in g ? g.whenShort : null;
  const label = pregame
    ? when || kickoffLabel(g.startIso) || g.shortDetail || "Today"
    : g.final
      ? g.shortDetail || "Final"
      : g.shortDetail || g.status || "Live";
  return {
    ...base,
    away: { abbrev: g.away.abbrev, logo: logoFor(g.away), score: scoreText(g.away.score) },
    home: { abbrev: g.home.abbrev, logo: logoFor(g.home), score: scoreText(g.home.score) },
    status: splitStatus(label),
  };
}

function TabLogo({ side }: { side: TabSide }) {
  return (
    <img
      src={side.logo}
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

/** ESPN-style scrollable score capsules for today's slate, in RUWT order. */
export default function SportsScoreTabs() {
  const { pathname } = useLocation();
  const { unified } = useRuwtSlate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const centeredKeyRef = useRef<string | null>(null);

  const tabs = useMemo(() => {
    const open = unified.filter((i) => !i.game.final);
    const finals = unified.filter((i) => i.game.final);
    return [...open, ...finals].map(toTab);
  }, [unified]);

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
    <div className="bg-ink relative z-10 border-b border-accent/10 print:hidden">
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
