import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useSportsBack, useSwipeBack } from "@/hooks/useSwipeBack";
import { resolveMlbGamePkFromEspnEvent } from "@/lib/mlb";
import { looksLikeEspnMlbEventId } from "@/lib/mlb-espn-event-id";
import { MlbGameDetail } from "@/pages/MlbGamePage";
import { cn, dispatchReaderColumnClass } from "@/lib/utils";

/**
 * `/sports/mlb/game/:gamePk` entry. Finals/heat Mini App buttons historically
 * pass an ESPN event id here; resolve those to an MLB Stats `gamePk` before
 * loading the box score (otherwise Stats API returns Unknown / 0–0).
 */
export default function MlbGameRoutePage() {
  const { gamePk: routeId } = useParams<{ gamePk: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useSportsBack("/sports/mlb");
  const swipeRef = useSwipeBack(goBack);

  const espnFromQuery = searchParams.get("espn");
  const solo = searchParams.get("solo") === "1";
  const espnParam = looksLikeEspnMlbEventId(routeId);
  const espnEventId = espnParam
    ? routeId!
    : espnFromQuery && looksLikeEspnMlbEventId(espnFromQuery)
      ? espnFromQuery
      : null;

  const resolvedPk = useQuery({
    queryKey: ["mlb-gamepk-from-espn", routeId],
    queryFn: () => resolveMlbGamePkFromEspnEvent(routeId!),
    enabled: Boolean(routeId && espnParam),
    staleTime: 300_000,
    retry: 1,
  });

  useEffect(() => {
    if (!routeId || !espnParam || resolvedPk.data == null) return;
    const next = new URLSearchParams();
    if (solo) next.set("solo", "1");
    next.set("espn", routeId);
    const qs = next.toString();
    navigate(`/sports/mlb/game/${resolvedPk.data}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [routeId, espnParam, resolvedPk.data, navigate, solo]);

  if (!routeId) {
    return <p className="text-alert p-6 text-[13px]">Game not found</p>;
  }

  if (espnParam) {
    if (resolvedPk.isPending || resolvedPk.data != null) {
      return (
        <div className="text-chalk flex min-h-[50vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading box score…
        </div>
      );
    }
    return (
      <p className="text-alert p-6 text-[13px]">
        Could not resolve this ESPN game id to an MLB box score.
      </p>
    );
  }

  return (
    <div ref={swipeRef} className={cn(dispatchReaderColumnClass, "space-y-5 px-3 pb-4 pt-1.5 sm:p-4 md:p-7")}>
      <MlbGameDetail gamePk={routeId} espnEventId={espnEventId} />
    </div>
  );
}
