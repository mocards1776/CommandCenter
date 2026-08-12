import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, X } from "lucide-react";
import TeamMark from "@/components/sports/TeamMark";
import { fetchMlbPlayer, mlbHeadshot } from "@/lib/mlb";

/** Near-fullscreen player bio card for Dispatch (keeps the article underneath). */
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const p = player.data;
  const isPitcher =
    Boolean(p) &&
    ((p!.pitching.length > 0 && p!.position === "P") || p!.pitching.length > p!.hitting.length);
  const seasonStats = p ? (isPitcher ? p.pitching : p.hitting).slice(0, 12) : [];
  const accent = `#${p?.primaryColor ?? "d9515c"}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-3">
      <button
        type="button"
        aria-label="Close player"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p?.name ?? "Player"}
        className="bg-panel border-white/10 relative z-10 flex h-[min(96dvh,100%)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:h-[min(94dvh,920px)] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <span className="label-caps text-chalk-dim">Player card</span>
          <button
            type="button"
            onClick={onClose}
            className="text-chalk-dim hover:text-cream rounded-sm p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {player.isPending ? (
            <div className="text-chalk flex items-center justify-center gap-2 py-24 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Loading…
            </div>
          ) : player.isError || !p ? (
            <p className="text-alert py-16 text-center text-sm">
              {player.error instanceof Error ? player.error.message : "Player not found"}
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <img
                    src={p.headshot || mlbHeadshot(p.id, 426)}
                    alt=""
                    width={120}
                    height={120}
                    className="h-[112px] w-[112px] rounded-xl bg-[#dfe6f2] object-cover object-[center_12%] sm:h-[128px] sm:w-[128px]"
                  />
                  {p.teamId != null ? (
                    <span className="absolute -right-1.5 -bottom-1.5">
                      <TeamMark teamId={p.teamId} size="sm" />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  {p.teamName ? (
                    <p className="text-chalk-dim text-[11px] font-semibold uppercase tracking-[0.14em]">
                      {p.teamName}
                    </p>
                  ) : null}
                  <h3 className="font-display text-cream text-[34px] leading-none tracking-tight sm:text-[40px]">
                    {p.lastName || p.name}
                  </h3>
                  <p className="text-chalk mt-1.5 text-[14px]">
                    {[p.firstName, p.number ? `#${p.number}` : null, p.position]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {(p.bats || p.throws || p.height || p.weight) && (
                    <p className="text-chalk-dim mt-2 text-[12px]">
                      {[
                        p.bats ? `Bats ${p.bats}` : null,
                        p.throws ? `Throws ${p.throws}` : null,
                        p.height,
                        p.weight ? `${p.weight} lb` : null,
                        p.age != null ? `Age ${p.age}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {seasonStats.length > 0 ? (
                <div>
                  <div className="label-caps text-chalk-dim mb-2">Season</div>
                  <dl className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {seasonStats.map((s) => (
                      <div
                        key={s.label}
                        className="rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-2.5"
                      >
                        <dt className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
                          {s.label}
                        </dt>
                        <dd className="numeral text-cream mt-0.5 text-[20px] leading-none">
                          {s.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {(p.birthPlace || p.mlbDebut || p.draft?.display) && (
                <div>
                  <div className="label-caps text-chalk-dim mb-2">Bio</div>
                  <ul className="space-y-1.5 text-[14px] leading-relaxed text-[#c8cdd8]">
                    {p.birthPlace ? <li>From {p.birthPlace}</li> : null}
                    {p.mlbDebut ? <li>MLB debut {p.mlbDebut}</li> : null}
                    {p.draft?.display ? <li>Draft {p.draft.display}</li> : null}
                    {p.school ? <li>{p.school}</li> : null}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  to={`/sports/mlb/player/${p.id}`}
                  onClick={onClose}
                  className="text-cream inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em]"
                  style={{ background: accent }}
                >
                  Full profile
                </Link>
                <a
                  href={`https://www.mlb.com/player/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-chalk hover:text-cream inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 px-3 py-3 text-[11px] uppercase tracking-[0.14em]"
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
