import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { UnifiedRuwtItem } from "@/hooks/useRuwtSlate";
import { useRuwtSlateSplit } from "@/hooks/useRuwtSlateSplit";
import { boardGameIsFavorite, selectBoardTopGames } from "@/lib/board-top-games";
import { ruwtWhyReasons } from "@/lib/ruwt-slate";
import LogoPlate from "@/components/sports/LogoPlate";
import {
  RUWT_SPORT_LABEL,
  toTab,
  type TabSide,
} from "@/lib/ruwt-score-tab";
import { cn } from "@/lib/utils";

function SlateLogo({ side }: { side: TabSide }) {
  return <LogoPlate src={side.logo} className="h-7 w-7" loading="lazy" />;
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

function BoardGameCard({ item, favorite }: { item: UnifiedRuwtItem; favorite: boolean }) {
  const tab = toTab(item);
  const showScore = tab.live || tab.final;
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
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <SportBadge item={item} />
          {favorite ? (
            <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-cream">
              Favorite
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide",
            tab.live ? "text-alert" : "text-chalk-dim",
          )}
        >
          {tab.live ? <span className="bg-alert inline-block h-1.5 w-1.5 animate-pulse rounded-full" /> : null}
          <span className="numeral normal-case">
            {tab.status[0]}
            {tab.status[1] ? ` · ${tab.status[1]}` : ""}
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map(({ side, rank }, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <SlateLogo side={side} />
            <span className="text-cream min-w-0 flex-1 truncate text-[14px] font-semibold group-hover:underline">
              {rank ? <span className="text-chalk-dim numeral mr-1 text-[11px]">{rank}</span> : null}
              {side.abbrev}
            </span>
            {showScore && side.score != null ? (
              <span className="numeral text-cream text-[18px] font-bold leading-none">{side.score}</span>
            ) : null}
          </div>
        ))}
      </div>
      <WhyLine item={item} />
    </Link>
  );
}

/**
 * Teams Board main list: favorite-team games, with RUWT heat filling the
 * remaining spots. Not the full live board, and not a link into RUWT.
 */
export default function SportsSlateSections({
  favoriteTeamKeys,
}: {
  favoriteTeamKeys: ReadonlySet<string>;
}) {
  const slate = useRuwtSlateSplit();
  const games = useMemo(
    () => selectBoardTopGames(slate.unified, (item) => boardGameIsFavorite(item, favoriteTeamKeys)),
    [slate.unified, favoriteTeamKeys],
  );

  if (slate.allPending) return null;
  if (games.length === 0) return null;

  const anyLive = games.some((item) => item.game.live && !item.game.final);

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="inline-flex items-center gap-2">
          {anyLive ? <span className="bg-alert inline-block h-2 w-2 animate-pulse rounded-full" /> : null}
          <span className="rule-head">Top games</span>
          <span className="text-chalk-dim numeral text-[11px]">({games.length})</span>
        </h2>
      </div>
      <p className="text-chalk-dim mb-3 text-[12px]">
        Every favorite team playing today, with the hottest other games around them.
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((item) => (
          <BoardGameCard
            key={item.id}
            item={item}
            favorite={boardGameIsFavorite(item, favoriteTeamKeys)}
          />
        ))}
      </div>
    </section>
  );
}
