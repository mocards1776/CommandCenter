import { useCallback, useEffect, useRef, useState } from "react";
import {
  diffGameMoments,
  type GameMoment,
  type GameMomentSnapshot,
} from "@/lib/game-moments";

function snapshotKey(snapshot: GameMomentSnapshot | null | undefined): string {
  if (!snapshot) return "";
  const plays = [...snapshot.scoringPlays, ...snapshot.recentScoring].map((p) => p.id).join(",");
  return [
    snapshot.sport,
    snapshot.gameId,
    snapshot.away.score,
    snapshot.home.score,
    snapshot.signals?.homeRuns ?? "",
    plays,
  ].join(":");
}

/**
 * Seed on first snapshot (no historical celebrations), then queue new moments
 * as live polls advance the score / scoring-play list.
 */
export function useGameMomentAlerts(
  snapshot: GameMomentSnapshot | null | undefined,
  detect: typeof diffGameMoments = diffGameMoments,
): { moment: GameMoment | null; dismiss: () => void; pending: number } {
  const prevRef = useRef<GameMomentSnapshot | null>(null);
  const seededRef = useRef(false);
  const seenRef = useRef(new Set<string>());
  const detectRef = useRef(detect);
  detectRef.current = detect;
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  const [queue, setQueue] = useState<GameMoment[]>([]);
  const [active, setActive] = useState<GameMoment | null>(null);
  const key = snapshotKey(snapshot);

  useEffect(() => {
    const snap = snapRef.current;
    if (!snap) return;
    if (!seededRef.current) {
      prevRef.current = snap;
      seededRef.current = true;
      return;
    }
    const found = detectRef.current(prevRef.current, snap);
    prevRef.current = snap;
    const fresh = found.filter((m) => !seenRef.current.has(m.id));
    for (const m of fresh) seenRef.current.add(m.id);
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [key]);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActive(next ?? null);
    setQueue(rest);
  }, [active, queue]);

  const dismiss = useCallback(() => setActive(null), []);

  return { moment: active, dismiss, pending: queue.length };
}
