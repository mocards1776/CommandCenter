import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, X } from "lucide-react";
import TeamMark from "@/components/sports/TeamMark";
import { fetchMlbPlayer, mlbHeadshot } from "@/lib/mlb";

/** Compact in-app player card so Dispatch doesn't lose the open article. */
export default function PlayerPeek({
  playerId,
  onClose,
}: {
  playerId: number;
  onClose: () => void;
}) {
  const player = useQuery({
    queryKey: ["mlb-player-v4", String(playerId)],
    queryFn: () => fetchMlbPlayer(playerId),
    staleTime: 120_000,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = player.data;
  const isPitcher =
    Boolean(p) &&
    ((p!.pitching.length > 0 && p!.position === "P") || p!.pitching.length > p!.hitting.length);
  const seasonStats = p ? (isPitcher ? p.pitching : p.hitting).slice(0, 6) : [];
  const accent = `#${p?.primaryColor ?? "d9515c"}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close player"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p?.name ?? "Player"}
        className="bg-panel border-white/10 relative z-10 flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <span className="label-caps text-chalk-dim">Player</span>
          <button
            type="button"
            onClick={onClose}
            className="text-chalk-dim hover:text-cream rounded-sm p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {player.isPending ? (
            <div className="text-chalk flex items-center justify-center gap-2 py-16 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Loading…
            </div>
          ) : player.isError || !p ? (
            <p className="text-alert py-10 text-center text-sm">
              {player.error instanceof Error ? player.error.message : "Player not found"}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="relative shrink-0">
                  <img
                    src={p.headshot || mlbHeadshot(p.id)}
                    alt=""
                    width={88}
                    height={88}
                    className="h-[88px] w-[88px] rounded-lg bg-[#dfe6f2] object-cover object-[center_12%]"
                  />
                  {p.teamId != null ? (
                    <span className="absolute -right-1.5 -bottom-1.5">
                      <TeamMark teamId={p.teamId} size="sm" />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  {p.teamName ? (
                    <p className="text-chalk-dim text-[11px] font-semibold uppercase tracking-[0.14em]">
                      {p.teamName}
                    </p>
                  ) : null}
                  <h3 className="font-display text-cream text-[28px] leading-none tracking-tight">
                    {p.lastName || p.name}
                  </h3>
                  <p className="text-chalk mt-1 text-[13px]">
                    {[p.firstName, p.number ? `#${p.number}` : null, p.position]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>

              {seasonStats.length > 0 ? (
                <div>
                  <div className="label-caps text-chalk-dim mb-2">{p.season} season</div>
                  <dl className="grid grid-cols-3 gap-2">
                    {seasonStats.map((s) => (
                      <div
                        key={s.label}
                        className="rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-2"
                      >
                        <dt className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
                          {s.label}
                        </dt>
                        <dd className="numeral text-cream mt-0.5 text-[18px] leading-none">
                          {s.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`/sports/mlb/player/${p.id}?solo=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cream inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
                  style={{ background: accent }}
                >
                  Full profile <ExternalLink size={12} />
                </a>
                <a
                  href={`https://www.mlb.com/player/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-chalk hover:text-cream inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 px-3 py-2.5 text-[11px] uppercase tracking-[0.14em]"
                >
                  MLB.com <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
