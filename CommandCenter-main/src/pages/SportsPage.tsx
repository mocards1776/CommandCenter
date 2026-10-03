import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Settings2,
  Trophy,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import StarField from "@/components/StarField";
import GolfSidebar from "@/components/sports/GolfSidebar";
import { SportsPushBanner, SportsPushSettings } from "@/components/sports/SportsPushAlerts";
import HeroGameCard from "@/components/sports/HeroGameCard";
import SportsSlateSections from "@/components/sports/SportsSlateSections";
import {
  MlbTeamLeadersSection,
  MlbTeamOrgSummary,
  MlbTeamPayrollTable,
  MlbTeamRecordSplitsSection,
  MlbTeamWinTrend,
} from "@/components/sports/MlbTeamExtras";
import LogoPlate from "@/components/sports/LogoPlate";
import TeamMark from "@/components/sports/TeamMark";
import { useAuth } from "@/lib/auth-context";
import { fetchMlbFarmSystemRankings, fetchTeamCurrentGame, mlbHeadshot, teamPagePath } from "@/lib/mlb";
import { fetchMlbTeamStatLeagueRanks } from "@/lib/mlb-team-page";
import {
  DEFAULT_FAVORITES,
  ensureFavoriteTeamsSeeded,
  favoriteByKey,
  fetchTeamDetail,
  fetchTeamSnapshot,
  fetchTourSnapshot,
  loadSportsLayout,
  saveSportsLayout,
  visibleFavorites,
  type GameChip,
  type RosterPlayer,
  type ScheduleGame,
  type SportsFavorite,
  type SportsLayout,
  type TeamDetail,
  type TeamSnapshot,
  type TourSnapshot,
} from "@/lib/sports";
import {
  BOARD_TIER,
  isoDayOffset,
  rankBoardFavorites,
  teamBoardTier,
  tourBoardTier,
  type BoardTier,
} from "@/lib/sports-board";
import { cn } from "@/lib/utils";
import { boardFavoriteTeamKeys } from "@/lib/board-top-games";
import { fetchChampionshipPromotionOdds } from "@/lib/soccer";
import { fetchYesterdayRecap, type YesterdayRecap } from "@/lib/yesterday-recap";

const CARDINALS_MLB_ID = 138;

function ordinalSuffixLocal(n: number): string {
  const v = Math.abs(n) % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (v % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function SoccerRosterList({ roster }: { roster: RosterPlayer[] }) {
  const groups = useMemo(() => {
    const order = ["Goalkeeper", "Defender", "Midfielder", "Forward", "Other"];
    const map = new Map<string, RosterPlayer[]>();
    for (const p of roster) {
      const g = p.positionGroup || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(p);
    }
    return order
      .filter((g) => map.has(g))
      .concat([...map.keys()].filter((g) => !order.includes(g)))
      .map((g) => ({ name: g, players: map.get(g)! }));
  }, [roster]);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.name}>
          <p className="text-chalk-dim mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
            {g.name}
            <span className="text-chalk-dim/70 ml-1.5 font-normal normal-case tracking-normal">
              {g.players.length}
            </span>
          </p>
          <ul className="bg-panel divide-y divide-white/[0.05] rounded border border-white/[0.07]">
            {g.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                {p.headshot ? (
                  <img
                    src={p.headshot}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover bg-white/5"
                    loading="lazy"
                  />
                ) : (
                  <span className="bg-white/5 text-chalk-dim grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px]">
                    {p.position ?? "?"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-cream truncate text-[12.5px]">
                    {p.number ? (
                      <span className="text-chalk-dim numeral mr-1.5 text-[11px]">#{p.number}</span>
                    ) : null}
                    {p.name}
                  </p>
                  <p className="text-chalk-dim truncate text-[10px]">
                    {[p.position, p.nationality, p.age != null ? `Age ${p.age}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GameLine({
  label,
  game,
}: {
  label: string;
  game: GameChip | null;
}) {
  if (!game) {
    return (
      <div className="flex justify-between gap-3 text-[11.5px]">
        <span className="text-chalk-dim">{label}</span>
        <span className="text-chalk-dim">—</span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
      <span className="text-chalk-dim shrink-0">{label}</span>
      <span className="min-w-0 text-right">
        <span
          className={cn(
            "text-cream",
            game.won === true && "text-turf",
            game.won === false && "text-alert",
            game.live && "text-cream",
          )}
        >
          {game.label}
          {game.detail ? ` · ${game.detail}` : ""}
          {game.live ? (
            <span className="text-alert ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
              <span className="bg-alert inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
              Live
            </span>
          ) : null}
        </span>
        {game.when && (
          <span className="text-chalk-dim mt-0.5 block text-[10.5px]">{game.when}</span>
        )}
      </span>
    </div>
  );
}

function TeamCard({
  snap,
  accent,
  mlbTeamId,
  onOpen,
  promotionLine,
  farmRank,
}: {
  snap: TeamSnapshot;
  accent?: string;
  mlbTeamId?: number;
  onOpen: () => void;
  /** e.g. "Promotion 86% (−614)" for Championship clubs. */
  promotionLine?: string | null;
  /** Pipeline Top-100 farm system rank, e.g. 4. */
  farmRank?: number | null;
}) {
  const bar = accent ? `#${accent}` : "var(--color-accent)";
  const logo =
    snap.logo ||
    (mlbTeamId
      ? `https://www.mlbstatic.com/team-logos/${mlbTeamId}.svg`
      : null);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-panel group relative w-full overflow-hidden rounded border border-white/[0.07] text-left transition hover:border-accent/35 hover:shadow-[0_0_0_1px_rgba(190,10,20,0.12)]"
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: bar }} />
      <div className="flex items-start gap-3.5 p-4 pt-5">
        {logo ? (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white p-1.5 shadow-sm">
            <img src={logo} alt="" className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="bg-field grid h-16 w-16 shrink-0 place-items-center rounded-full">
            <Trophy size={20} className="text-chalk-dim" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-cream text-[20px] leading-tight group-hover:underline">
            {snap.shortName}
          </h3>
          <p className="text-chalk-dim mt-0.5 text-[10.5px] uppercase tracking-[0.14em]">
            {snap.name}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {snap.record && (
              <span className="numeral text-accent text-[22px] leading-none">{snap.record}</span>
            )}
            {snap.standing && (
              <span className="text-chalk text-[11.5px]">{snap.standing}</span>
            )}
          </div>
          {farmRank != null && farmRank > 0 ? (
            <p className="mt-1.5 text-[11px] font-medium tracking-wide text-emerald-300/90">
              Farm #{farmRank}
            </p>
          ) : null}
          {promotionLine ? (
            <p className="text-accent/90 mt-1.5 text-[11px] font-medium tracking-wide">
              {promotionLine}
            </p>
          ) : null}
        </div>
        <span className="text-chalk-dim group-hover:text-accent shrink-0 self-center text-[10px] uppercase tracking-[0.14em] opacity-0 transition group-hover:opacity-100">
          Open
        </span>
      </div>
      <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-2">
        <GameLine label="Last" game={snap.lastGame} />
        <GameLine label="Next" game={snap.nextGame} />
      </div>
    </button>
  );
}
