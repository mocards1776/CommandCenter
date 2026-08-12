import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, X } from "lucide-react";
import TeamMark from "@/components/sports/TeamMark";
import {
  buildPlayerPerformanceSummary,
  fetchMlbPlayer,
  fetchMlbPlayerGameLog,
  fetchMlbPlayerRecent,
  fetchPlayerBrief,
  fetchPlayerContract,
  mlbHeadshot,
  teamPagePath,
} from "@/lib/mlb";

/** Full-screen player bio sheet for Dispatch — same card as the player page, kept over the article. */
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

  const p = player.data;
  const isPitcher =
    Boolean(p) &&
    ((p!.pitching.length > 0 && p!.position === "P") || p!.pitching.length > p!.hitting.length);
  const splitGroup = isPitcher ? "pitching" : "hitting";
  const seasonStats = p ? (isPitcher ? p.pitching : p.hitting).slice(0, 12) : [];
  const accent = `#${p?.primaryColor ?? "d9515c"}`;

  const brief = useQuery({
    queryKey: ["mlb-player-brief-v1", p?.name],
    queryFn: () => fetchPlayerBrief(p!.name),
    enabled: Boolean(p?.name),
    staleTime: 300_000,
    retry: 1,
  });

  const contract = useQuery({
    queryKey: ["mlb-player-contract-v8", p?.name, p?.useName, p?.firstName, p?.lastName],
    queryFn: () =>
      fetchPlayerContract(p!.name, {
        useName: p!.useName,
        firstName: p!.firstName,
        lastName: p!.lastName,
      }),
    enabled: Boolean(p?.name),
    staleTime: 24 * 60 * 60_000,
    gcTime: 7 * 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const latestGame = useQuery({
    queryKey: ["mlb-player-latest-game", String(playerId), splitGroup, p?.season],
    queryFn: () => fetchMlbPlayerGameLog(p!.id, splitGroup, 1, p!.season),
    enabled: Boolean(p),
    staleTime: 120_000,
  });

  const last5 = useQuery({
    queryKey: ["mlb-player-last5", String(playerId), splitGroup, p?.season],
    queryFn: () => fetchMlbPlayerRecent(p!.id, splitGroup, 5, p!.season),
    enabled: Boolean(p),
    staleTime: 120_000,
  });

  const performance =
    p &&
    buildPlayerPerformanceSummary({
      isPitcher,
      latest: latestGame.data?.[0],
      last5: last5.data,
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

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center">
      <button
        type="button"
        aria-label="Close player"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p?.name ?? "Player"}
        className="bg-[#07101f] border-white/10 relative z-10 flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden border-x shadow-2xl sm:my-2 sm:h-[min(98dvh,960px)] sm:rounded-2xl sm:border"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <span className="label-caps text-chalk-dim">Player page</span>
          <button
            type="button"
            onClick={onClose}
            className="text-chalk-dim hover:text-cream rounded-sm p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
            <div className="space-y-5 p-4 pb-10 sm:p-5">
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.1]">
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(145deg, #0a1428 0%, ${accent}38 45%, #07101f 100%)`,
                  }}
                />
                {p.heroBackdrop ? (
                  <img
                    src={p.heroBackdrop}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-[center_18%] opacity-[0.22]"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-[#07101f]/55 to-transparent" />
                <div className="relative z-10 flex items-end gap-4 p-4 sm:p-5">
                  <div className="relative shrink-0">
                    <img
                      src={p.headshot || mlbHeadshot(p.id, 426)}
                      alt=""
                      width={128}
                      height={128}
                      className="h-[112px] w-[112px] rounded-xl bg-[#dfe6f2] object-cover object-[center_12%] ring-2 ring-white/25 sm:h-[128px] sm:w-[128px]"
                    />
                    {p.teamId != null ? (
                      <span className="absolute -right-1.5 -bottom-1.5">
                        <TeamMark teamId={p.teamId} size="sm" />
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-0.5">
                    {p.teamId != null && p.teamName ? (
                      <Link
                        to={teamPagePath(p.teamId)}
                        onClick={onClose}
                        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70 hover:text-white"
                      >
                        {p.teamName}
                      </Link>
                    ) : p.teamName ? (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                        {p.teamName}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[12px] uppercase tracking-[0.08em] text-white/65">
                      {p.firstName}
                    </p>
                    <h3 className="font-display text-[34px] leading-none tracking-tight text-white sm:text-[40px]">
                      {p.lastName || p.name}
                    </h3>
                    <p className="mt-1.5 text-[13px] text-white/75">
                      {[p.number ? `#${p.number}` : null, p.position].filter(Boolean).join(" · ")}
                    </p>
                    {(p.bats || p.throws || p.height || p.weight || p.age != null) && (
                      <p className="mt-2 text-[12px] text-white/60">
                        {[
                          p.bats && p.throws ? `${p.bats}/${p.throws}` : p.bats || p.throws,
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
              </div>

              {(brief.data?.story || brief.data?.headline || brief.isPending) && (
                <section className="rounded-xl border border-white/[0.08] bg-black/20">
                  <div className="border-b border-white/[0.06] px-3.5 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                      Status
                    </p>
                  </div>
                  <div className="px-3.5 py-3">
                    {brief.isPending ? (
                      <p className="text-chalk-dim flex items-center gap-2 text-[13px]">
                        <Loader2 size={14} className="animate-spin" /> Loading note…
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {brief.data?.headline ? (
                          <p className="text-cream text-[15px] font-medium leading-snug">
                            {brief.data.headline}
                          </p>
                        ) : null}
                        {brief.data?.story ? (
                          <p className="text-[14px] leading-relaxed text-[#c8cdd8]">
                            {brief.data.story}
                          </p>
                        ) : null}
                        {brief.data?.published ? (
                          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8b93a7]">
                            {brief.data.published}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {performance ? (
                <section className="rounded-xl border border-white/[0.08] bg-black/20">
                  <div className="border-b border-white/[0.06] px-3.5 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                      Form
                    </p>
                  </div>
                  <div className="grid gap-0 sm:grid-cols-2">
                    <div className="border-b border-white/[0.06] px-3.5 py-3 sm:border-r sm:border-b-0">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
                        {performance.latestTitle}
                      </p>
                      <p className="text-cream mt-1 text-[14px] leading-relaxed">
                        {performance.latestLine}
                      </p>
                    </div>
                    <div className="px-3.5 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
                        {performance.recentTitle}
                      </p>
                      <p className="text-cream mt-1 text-[14px] leading-relaxed">
                        {performance.recentLine}
                      </p>
                    </div>
                  </div>
                </section>
              ) : null}

              {seasonStats.length > 0 ? (
                <div>
                  <div className="label-caps text-chalk-dim mb-2">{p.season} Season</div>
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

              {(contract.data || contract.isPending) && (
                <section className="rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                    Contract
                  </p>
                  {contract.isPending ? (
                    <p className="text-chalk-dim mt-2 flex items-center gap-2 text-[13px]">
                      <Loader2 size={14} className="animate-spin" /> Looking up…
                    </p>
                  ) : contract.data ? (
                    <p className="text-cream mt-1.5 text-[14px] leading-relaxed">
                      {[
                        contract.data.currentSalary?.display,
                        contract.data.currentSalary?.year &&
                        contract.data.currentSalary.year !== "Total"
                          ? contract.data.currentSalary.year
                          : null,
                        contract.data.totalValue &&
                        contract.data.totalValue !== contract.data.currentSalary?.display
                          ? `Total ${contract.data.totalValue}`
                          : null,
                        contract.data.contractStatus,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Details on full profile"}
                    </p>
                  ) : (
                    <p className="text-chalk-dim mt-1.5 text-[13px]">No contract line found.</p>
                  )}
                </section>
              )}

              {(p.birthPlace || p.mlbDebut || p.draft?.display || p.school) && (
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
                  className="text-cream inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
                  style={{ background: accent }}
                >
                  Open full page
                </Link>
                <a
                  href={`https://www.mlb.com/player/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-chalk hover:text-cream inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 px-3 py-3.5 text-[11px] uppercase tracking-[0.14em]"
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
