import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Flame, Loader2, Star } from "lucide-react";
import toast from "react-hot-toast";
import TeamMark from "@/components/sports/TeamMark";
import SportsNotesPanel from "@/components/sports/SportsNotesPanel";
import {
  fetchMlbManagerDetail,
  teamPagePath,
} from "@/lib/mlb";
import {
  addFavoriteManager,
  isFavoriteManager,
  removeFavoriteManager,
} from "@/lib/favorite-managers";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function heatTone(rank: number): string {
  if (rank <= 5) return "text-alert";
  if (rank <= 12) return "text-amber-300";
  if (rank <= 20) return "text-[#c8cdd8]";
  return "text-emerald-300";
}

export default function MlbManagerPage() {
  const { managerId } = useParams<{ managerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["mlb-manager-v9", managerId],
    queryFn: () => fetchMlbManagerDetail(managerId!),
    enabled: Boolean(managerId),
    staleTime: 180_000,
  });

  const favQuery = useQuery({
    queryKey: ["favorite-manager", user?.id, managerId],
    queryFn: () => isFavoriteManager(user!.id, managerId!),
    enabled: Boolean(user?.id && managerId),
  });

  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!user?.id || !detail.data) throw new Error("Not signed in");
      if (favQuery.data) {
        await removeFavoriteManager(user.id, String(detail.data.id));
        return false;
      }
      await addFavoriteManager({
        userId: user.id,
        managerId: String(detail.data.id),
        managerName: detail.data.name,
        teamName: detail.data.teamName,
        teamId: String(detail.data.teamId),
      });
      return true;
    },
    onSuccess: (nowFav) => {
      void qc.invalidateQueries({ queryKey: ["favorite-manager", user?.id, managerId] });
      void qc.invalidateQueries({ queryKey: ["favorite-managers", user?.id] });
      void qc.invalidateQueries({ queryKey: ["favorite-players", user?.id] });
      toast.success(nowFav ? "Manager favorited" : "Removed from favorites");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update favorite"),
  });

  if (detail.isPending) {
    return (
      <div className="text-chalk flex min-h-[50vh] items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading manager…
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-alert text-[13px]">
          {detail.error instanceof Error ? detail.error.message : "Manager not found"}
        </p>
      </div>
    );
  }

  const m = detail.data;
  const accent = `#${m.primaryColor}`;
  const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(m.name.replace(/\s+/g, "_"))}`;
  const career = m.career;
  const isFavorite = Boolean(favQuery.data);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports/mlb/managers"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          All managers
        </Link>
      </div>

      <article className="relative overflow-hidden rounded-2xl border border-white/[0.1]">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, #081228 0%, ${accent}55 55%, #0a1730 100%)`,
          }}
        />
        <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          <img
            src={m.headshot}
            alt=""
            width={140}
            height={140}
            className="mx-auto h-[128px] w-[128px] rounded-xl bg-[#0c1a2e] object-cover object-top ring-2 ring-white/20 shadow-xl sm:mx-0"
            onError={(e) => {
              const el = e.currentTarget;
              const mlb = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_426,q_auto:best/v1/people/${m.id}/headshot/67/current`;
              if (!el.dataset.fallback) {
                el.dataset.fallback = "1";
                if (!el.src.includes("mlbstatic")) {
                  el.src = mlb;
                  return;
                }
              }
              el.style.visibility = "hidden";
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <TeamMark teamId={m.teamId} size="sm" />
                  <Link
                    to={teamPagePath(m.teamId)}
                    className="text-[13px] font-medium text-white/80 transition hover:text-white"
                  >
                    {m.teamName}
                  </Link>
                </div>
                <h1 className="font-display text-[34px] leading-[0.95] text-white sm:text-[42px]">
                  {m.name}
                </h1>
                <p className="mt-1.5 text-[13px] text-white/75">
                  {m.isInterim ? "Interim manager" : m.shortLeash ? "Manager (short leash)" : "Manager"}
                  {" · "}
                  {m.teamAbbrev} · {m.yearsWithTeam} season
                  {m.yearsWithTeam === 1 ? "" : "s"} with club
                </p>
              </div>
              {m.age != null && (
                <div className="shrink-0 rounded-md border border-white/25 bg-black/35 px-3 py-2 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Age
                  </p>
                  <p className="numeral text-[28px] leading-none text-white">{m.age}</p>
                </div>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px] sm:grid-cols-4">
              <Meta label="This year" value={m.record} />
              <Meta
                label="Career"
                value={career ? `${career.wins}-${career.losses}` : "—"}
              />
              <Meta label="Career pct" value={career?.pct ?? "—"} />
              <Meta
                label="Playoff %"
                value={m.playoffOdds != null ? `${m.playoffOdds.toFixed(1)}%` : "—"}
              />
              <Meta label="Div titles" value={career ? String(career.divisionTitles) : "—"} />
              <Meta
                label="Postseason"
                value={
                  career
                    ? `${career.postseasonAppearances} (${career.postWins}-${career.postLosses})`
                    : "—"
                }
              />
              <Meta
                label="World Series"
                value={career ? String(career.worldSeriesAppearances) : "—"}
              />
              <Meta label="Mgr of Year" value={career ? String(career.managerOfYear) : "—"} />
            </dl>

            <button
              type="button"
              onClick={() => toggleFav.mutate()}
              disabled={!user || toggleFav.isPending}
              className={cn(
                "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-50 sm:w-auto",
                isFavorite
                  ? "border border-white/30 bg-white/10 text-white"
                  : "text-cream",
              )}
              style={isFavorite ? undefined : { background: accent }}
            >
              <Star size={14} className={isFavorite ? "fill-current text-accent" : ""} />
              {isFavorite ? "Favorited" : "Favorite manager"}
            </button>
          </div>
        </div>
      </article>

      {career && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Career résumé</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip label="Record" value={`${career.wins}-${career.losses}`} />
            <StatChip label="Seasons" value={String(career.seasons)} />
            <StatChip label="Division titles" value={String(career.divisionTitles)} />
            <StatChip label="Postseason" value={String(career.postseasonAppearances)} />
            <StatChip label="Playoff W-L" value={`${career.postWins}-${career.postLosses}`} />
            <StatChip label="World Series" value={String(career.worldSeriesAppearances)} />
            <StatChip label="Mgr of the Year" value={String(career.managerOfYear)} />
            <StatChip label="Win %" value={career.pct} />
          </div>
          {m.awards.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3">
              {m.awards.map((a) => (
                <li key={`${a.season}-${a.name}`} className="text-[13px] text-[#c8cdd8]">
                  <span className="numeral text-accent mr-2">{a.season}</span>
                  {a.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Flame size={16} className={heatTone(m.hotSeatRank)} />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
            Hot seat
          </h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className={cn("numeral text-[42px] leading-none", heatTone(m.hotSeatRank))}>
              #{m.hotSeatRank}
            </p>
            <p className="mt-1 text-[12px] text-[#8b93a7]">of 30 managers</p>
          </div>
          <div>
            <p className="numeral text-cream text-[28px] leading-none">{m.hotSeatScore.toFixed(1)}</p>
            <p className="mt-1 text-[12px] text-[#8b93a7]">heat score</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
          {m.heatFactors.map((f) => (
            <li key={f.key} className="flex items-start justify-between gap-3 text-[12.5px]">
              <div className="min-w-0">
                <p className="text-[#e8e4d9]">{f.label}</p>
                <p className="text-[11px] text-[#8b93a7]">{f.detail}</p>
              </div>
              <span
                className={cn(
                  "numeral shrink-0",
                  f.points > 0 ? "text-alert" : f.points < 0 ? "text-emerald-300" : "text-[#8b93a7]",
                )}
              >
                {f.points > 0 ? "+" : ""}
                {f.points.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <h2 className="rule-head mb-2">Contract</h2>
        {m.contractNote ? (
          <p className="text-cream text-[14px] leading-relaxed">{m.contractNote}</p>
        ) : (
          <p className="text-chalk-dim text-[13px]">
            No published manager contract terms found yet.
          </p>
        )}
        {m.firedOddsAmerican && (
          <p className="mt-3 text-[12.5px] text-[#c8cdd8]">
            Market:{" "}
            <span className="numeral font-semibold text-amber-200">{m.firedOddsAmerican}</span>
            {m.firedOddsPct != null ? ` · ~${m.firedOddsPct}% next fired` : ""}
            <span className="text-[#8b93a7]"> (weighted into heat)</span>
          </p>
        )}
      </section>

      {m.rumors.length > 0 && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Hot-seat chatter</h2>
          <p className="mb-3 text-[12px] text-[#8b93a7]">
            MLB manager job-security hits from news and social (X / Reddit / Bluesky).
          </p>
          <ul className="space-y-3">
            {m.rumors.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block text-[13.5px] leading-snug text-[#e8e4d9] hover:text-white"
                >
                  {r.title}
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[#8b93a7] group-hover:text-accent">
                    {r.channel === "social" ? "Social · " : ""}
                    {r.source} <ExternalLink size={11} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SportsNotesPanel entityType="manager" entityId={m.id} entityName={m.name} />

      {m.stints.length > 0 && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Managerial stops</h2>
          <ul className="space-y-4">
            {[...m.stints].reverse().map((s, idx) => {
              const current = idx === 0;
              return (
                <li
                  key={`${s.team}-${s.start}-${s.end}`}
                  className="border-l-2 border-accent/45 pl-3"
                >
                  <p className="text-[15px] font-semibold text-[#e8e4d9]">
                    {s.team}{" "}
                    <span className="numeral text-[13px] font-normal text-[#8b93a7]">
                      {s.start}
                      {s.end !== s.start ? `–${s.end}` : ""}
                    </span>
                    {current && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="numeral mt-0.5 text-[13px] text-[#c8cdd8]">
                    {s.wins}-{s.losses} ({s.pct})
                  </p>
                  {!current && s.departure && (
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#a8b0c2]">
                      {s.departureUrl ? (
                        <a
                          href={s.departureUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-start gap-1 hover:text-cream hover:underline"
                        >
                          {s.departure}
                          <ExternalLink size={11} className="mt-0.5 shrink-0" />
                        </a>
                      ) : (
                        s.departure
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
        <div className="border-b border-white/[0.06] px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
            Season-by-season record
          </h2>
        </div>
        {m.seasonRecords.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-[#8b93a7]">
            Season-by-season managerial record unavailable right now.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 font-medium">Tm</th>
                  <th className="px-3 py-2 font-medium">W-L</th>
                  <th className="px-3 py-2 font-medium">Pct</th>
                  <th className="px-3 py-2 font-medium">Div</th>
                  <th className="px-3 py-2 font-medium">Post</th>
                </tr>
              </thead>
              <tbody>
                {m.seasonRecords.map((row) => (
                  <tr key={`${row.season}-${row.team}`} className="border-t border-white/[0.05]">
                    <td className="numeral text-cream px-3 py-2">{row.season}</td>
                    <td className="px-3 py-2 text-[#c8cdd8]">{row.team}</td>
                    <td className="numeral text-cream px-3 py-2">
                      {row.wins}-{row.losses}
                    </td>
                    <td className="numeral px-3 py-2 text-[#c8cdd8]">{row.pct}</td>
                    <td className="numeral px-3 py-2 text-[#c8cdd8]">
                      {row.divisionRank ?? "—"}
                    </td>
                    <td className="numeral px-3 py-2 text-[#c8cdd8]">
                      {row.postWins + row.postLosses > 0
                        ? `${row.postWins}-${row.postLosses}`
                        : "—"}
                    </td>
                  </tr>
                ))}
                {career && (
                  <tr className="border-t border-white/[0.12] bg-white/[0.03]">
                    <td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e8e4d9]">
                      Career
                    </td>
                    <td className="px-3 py-2.5 text-[#8b93a7]">—</td>
                    <td className="numeral text-cream px-3 py-2.5 font-semibold">
                      {career.wins}-{career.losses}
                    </td>
                    <td className="numeral px-3 py-2.5 text-[#e8e4d9]">{career.pct}</td>
                    <td className="numeral px-3 py-2.5 text-[#c8cdd8]">
                      {career.divisionTitles} titles
                    </td>
                    <td className="numeral px-3 py-2.5 text-[#c8cdd8]">
                      {career.postWins}-{career.postLosses}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {m.bbrefUrl && (
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <a
              href={m.bbrefUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] hover:underline"
            >
              Baseball Reference <ExternalLink size={11} />
            </a>
          </div>
        )}
      </section>

      {m.wikiExtract && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Profile</h2>
          <p className="font-display text-[16px] leading-relaxed text-[#e8e4d9]">{m.wikiExtract}</p>
          <a
            href={wikiUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] hover:underline"
          >
            Wikipedia <ExternalLink size={11} />
          </a>
        </section>
      )}

      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <h2 className="rule-head mb-3">Snapshot</h2>
        <ul className="space-y-2">
          {m.careerNotes.map((line) => (
            <li
              key={line}
              className="border-l-2 border-accent/45 pl-3 text-[13px] leading-relaxed text-[#c8cdd8]"
            >
              {line}
            </li>
          ))}
        </ul>
      </section>

      {m.timeline.length > 0 && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Transaction history</h2>
          <ul className="space-y-3">
            {[...m.timeline].reverse().map((t) => (
              <li key={`${t.date}-${t.text}`} className="text-[13px] leading-relaxed">
                <span className="numeral text-accent mr-2 text-[12px]">{t.date}</span>
                <span className="text-[#c8cdd8]">{t.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {m.playingCareer.length > 0 && (
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
              Playing career
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 font-medium">G</th>
                  <th className="px-3 py-2 font-medium">Line</th>
                </tr>
              </thead>
              <tbody>
                {[...m.playingCareer].reverse().map((row) => (
                  <tr key={`${row.season}-${row.team}`} className="border-t border-white/[0.05]">
                    <td className="numeral text-cream px-3 py-2">{row.season}</td>
                    <td className="px-3 py-2 text-[#c8cdd8]">{row.team}</td>
                    <td className="numeral text-cream px-3 py-2">{row.games}</td>
                    <td className="px-3 py-2 text-[#a8b0c2]">{row.summary || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</dt>
      <dd className="mt-0.5 text-white">{value}</dd>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">{label}</p>
      <p className="numeral text-cream mt-1 text-[18px] leading-none">{value}</p>
    </div>
  );
}
