import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MlbGameDetail } from "@/pages/MlbGamePage";
import { chicagoToday, fetchMlbScoreboard } from "@/lib/mlb";

/**
 * Public live-header preview so screenshots do not need a session.
 * Renders the same game-detail matchup / heat panel.
 * Not linked from nav. Query `?game=gamePk` to pin a game.
 */
export default function MlbPbpPreviewPage() {
  const [params] = useSearchParams();
  const pinned = params.get("game") || params.get("gamePk") || "";

  const pick = useQuery({
    queryKey: ["mlb-pbp-preview-pick", pinned],
    queryFn: async () => {
      if (pinned) return pinned;
      const today = chicagoToday();
      const y = new Date(`${today}T12:00:00-05:00`);
      y.setDate(y.getDate() - 1);
      const yesterday = y.toISOString().slice(0, 10);
      const [board, prior] = await Promise.all([
        fetchMlbScoreboard(today),
        fetchMlbScoreboard(yesterday),
      ]);
      const all = [...board, ...prior];
      const live = all.find((g) => g.live);
      if (live) return live.id;
      const final = [...all].reverse().find((g) => g.final);
      return final?.id ?? all[0]?.id ?? "";
    },
    staleTime: 30_000,
  });

  const gamePk = pick.data || "";

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#05070c] px-3 py-6 sm:px-4">
      <header className="mb-4 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
          MLB game detail
        </p>
        <h1 className="text-xl font-semibold text-[#f4f1e9]">Live matchup</h1>
        <p className="text-[12px] leading-relaxed text-[#9aa3b8]">
          Same header as <code className="text-white/70">/sports/mlb/game/:gamePk</code>
          — pitcher / large heat / batter, no EMPTY text, no mid-game loser fade.
          {gamePk ? ` Game ${gamePk}.` : " Picking a live or recent game…"}
        </p>
      </header>
      {gamePk ? (
        <MlbGameDetail gamePk={gamePk} />
      ) : (
        <p className="text-[13px] text-white/45">No MLB game on the board.</p>
      )}
    </div>
  );
}
