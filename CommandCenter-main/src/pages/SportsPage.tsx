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
