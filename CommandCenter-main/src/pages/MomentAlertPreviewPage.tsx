import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import GameMomentAlert from "@/components/sports/GameMomentAlert";
import {
  DEMO_MOMENT_KINDS,
  demoMoment,
  latestMoment,
  type GameMoment,
  type GameMomentKind,
} from "@/lib/game-moments";
import { toMlbBoxMomentSnapshot, toNhlMomentSnapshot } from "@/lib/game-moment-sources";
import { chicagoToday, fetchMlbBoxscore, fetchMlbScoreboard } from "@/lib/mlb";
import { fetchNhlGameDetail, fetchNhlScoreboard } from "@/lib/nhl";

/**
 * Public overlay preview so screenshots do not need a session.
 * `?kind=goal` fires that demo on load. Replay uses game-detail score data
 * (MLB boxscore / NHL summary) — not the rejected 2D PBP panel.
 */
export default function MomentAlertPreviewPage() {
  const [params] = useSearchParams();
  const initial = (params.get("kind") as GameMomentKind | null) ?? null;
  const [moment, setMoment] = useState<GameMoment | null>(() =>
    initial && DEMO_MOMENT_KINDS.includes(initial) ? demoMoment(initial) : demoMoment("goal"),
  );

  const pick = useQuery({
    queryKey: ["moment-alert-preview-pick"],
    queryFn: async () => {
      const today = chicagoToday();
      const y = new Date(`${today}T12:00:00-05:00`);
      y.setDate(y.getDate() - 1);
      const yesterday = y.toISOString().slice(0, 10);
      const [mlbToday, mlbY, nhl] = await Promise.all([
        fetchMlbScoreboard(today),
        fetchMlbScoreboard(yesterday),
        fetchNhlScoreboard(today).catch(() => []),
      ]);
      const mlb = [...mlbToday, ...mlbY];
      const mlbLive = mlb.find((g) => g.live);
      const nhlLive = nhl.find((g) => g.live);
      return {
        mlbPk: String(mlbLive?.id ?? [...mlb].reverse().find((g) => g.final)?.id ?? ""),
        nhlId: String(nhlLive?.id ?? [...nhl].reverse().find((g) => g.final)?.id ?? ""),
      };
    },
    staleTime: 30_000,
  });

  const replayHint = useMemo(() => {
    if (!pick.data) return "Picking a live or recent game…";
    const bits = [
      pick.data.mlbPk ? `MLB ${pick.data.mlbPk}` : null,
      pick.data.nhlId ? `NHL ${pick.data.nhlId}` : null,
    ].filter(Boolean);
    return bits.length ? bits.join(" · ") : "No recent MLB/NHL game on the board.";
  }, [pick.data]);

  const fireReplay = async (sport: "mlb" | "nhl") => {
    if (sport === "mlb" && pick.data?.mlbPk) {
      const box = await fetchMlbBoxscore(pick.data.mlbPk);
      const next = latestMoment(toMlbBoxMomentSnapshot(box));
      if (next) {
        setMoment({ ...next, id: `${next.id}:replay:${Date.now()}` });
        return;
      }
    }
    if (sport === "nhl" && pick.data?.nhlId) {
      const g = await fetchNhlGameDetail(pick.data.nhlId);
      const next = latestMoment(toNhlMomentSnapshot(g));
      if (next) {
        setMoment({ ...next, id: `${next.id}:replay:${Date.now()}` });
        return;
      }
    }
    setMoment(demoMoment(sport === "nhl" ? "goal" : "run"));
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#05070c] px-3 py-6 sm:px-4">
      <header className="mb-5 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
          Game detail
        </p>
        <h1 className="text-xl font-semibold text-[#f4f1e9]">Moment alerts</h1>
        <p className="text-[12px] leading-relaxed text-[#9aa3b8]">
          Shared overlay for score changes, MLB runs, NHL goals, and football scores.
          Attaches to game-detail polls — not the 2D PBP panel. {replayHint}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {DEMO_MOMENT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setMoment(demoMoment(kind))}
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-white/75"
          >
            {kind.replace("_", " ").toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void fireReplay("mlb")}
          className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-white"
        >
          REPLAY MLB
        </button>
        <button
          type="button"
          onClick={() => void fireReplay("nhl")}
          className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-white"
        >
          REPLAY NHL
        </button>
      </div>

      <section className="mt-8 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-[12px] leading-relaxed text-white/50">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-white/35">TAXONOMY</p>
        <p className="mt-2">
          Wired on game detail: MLB run / home run (boxscore score + HR totals) · NHL goal ·
          NFL/CFB touchdown, field goal, safety, generic score. First poll is a seed — only
          new scoring after you arrive fires the overlay.
        </p>
      </section>

      <GameMomentAlert moment={moment} onDismiss={() => setMoment(null)} />
    </div>
  );
}
