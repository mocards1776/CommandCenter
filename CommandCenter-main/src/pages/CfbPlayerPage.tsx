import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { cfbHeadshot, fetchCfbPlayerProfile, type CfbPlayerProfile } from "@/lib/cfb";
import { cn } from "@/lib/utils";

export default function CfbPlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));
  const [seasonIdx, setSeasonIdx] = useState(0);

  const profile = useQuery({
    queryKey: ["cfb-player", playerId],
    queryFn: () => fetchCfbPlayerProfile(playerId!),
    enabled: Boolean(playerId),
    staleTime: 120_000,
  });

  if (!playerId) {
    return <p className="text-alert p-6 text-[13px]">Missing player id</p>;
  }

  const p = profile.data;
  const accent = `#${(p?.teamColor ?? "d9515c").replace(/^#/, "")}`;
  const splits = p?.seasonSplits?.length ? p.seasonSplits : p ? [{ season: "Season", categories: p.statCategories }] : [];
  const activeSplit = splits[Math.min(seasonIdx, Math.max(0, splits.length - 1))];

  return (
    <div ref={swipeRef} className="mx-auto max-w-6xl space-y-6 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports/cfb?solo=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          CFB hub
        </Link>
      </div>

      {profile.isPending ? (
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading player…
        </div>
      ) : profile.isError || !p ? (
        <p className="text-alert text-[13px]">Couldn’t load this player.</p>
      ) : (
        <>
          <PlayerHero player={p} accent={accent} />

          {p.seasonStats.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
                  Season key stats
                </h2>
              </div>
              <div className="grid grid-cols-2 divide-x divide-white/[0.06] sm:grid-cols-4">
                {p.seasonStats.slice(0, 8).map((s) => (
                  <div key={s.label} className="border-b border-white/[0.05] px-3 py-4 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                      {s.label}
                    </p>
                    <p className="numeral text-cream mt-1 text-[26px] leading-none sm:text-[28px]">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {splits.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
                  Stats
                </h2>
                {splits.length > 1 ? (
                  <div className="flex flex-wrap gap-1">
                    {splits.map((split, idx) => (
                      <button
                        key={split.season}
                        type="button"
                        onClick={() => setSeasonIdx(idx)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
                          idx === seasonIdx
                            ? "bg-white/10 text-cream"
                            : "text-chalk hover:text-cream",
                        )}
                      >
                        {split.season}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="divide-y divide-white/[0.06]">
                {(activeSplit?.categories ?? []).map((cat) => (
                  <div key={`${activeSplit?.season}-${cat.name}`} className="overflow-x-auto">
                    <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                        {cat.name}
                      </h3>
                    </div>
                    <table className="w-full min-w-[520px] text-center text-[12px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                          {cat.stats.map((s) => (
                            <th key={s.label} className="px-2 py-2 font-medium">
                              {s.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-white/[0.05]">
                          {cat.stats.map((s) => (
                            <td key={s.label} className="numeral text-cream px-2 py-2.5 text-[15px]">
                              {s.value}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          )}

          {p.gameLogCategories.some((c) => c.rows.length > 0) && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                  Game log
                </h3>
              </div>
              {p.gameLogCategories.map((cat) =>
                cat.rows.length === 0 ? null : (
                  <div key={cat.name} className="border-t border-white/[0.05] first:border-t-0">
                    <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-2">
                      <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                        {cat.name}
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-[12px]">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                            <th className="px-3 py-2 text-left font-medium">Date</th>
                            <th className="px-2 py-2 text-left font-medium">Opp</th>
                            <th className="px-2 py-2 text-center font-medium">Result</th>
                            {cat.labels.map((label) => (
                              <th key={label} className="px-2 py-2 text-center font-medium">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {cat.rows.map((row) => (
                            <tr
                              key={`${row.eventId ?? row.date}-${row.opponent}`}
                              className="border-t border-white/[0.05]"
                            >
                              <td className="text-chalk whitespace-nowrap px-3 py-2 text-left">
                                {row.date
                                  ? new Date(row.date).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : row.week != null
                                    ? `Wk ${row.week}`
                                    : "—"}
                              </td>
                              <td className="text-cream whitespace-nowrap px-2 py-2 text-left font-medium">
                                {row.atVs ? `${row.atVs} ` : ""}
                                {row.opponent}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <span
                                  className={cn(
                                    "numeral rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                                    row.result.startsWith("W")
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : row.result.startsWith("L")
                                        ? "bg-red-500/15 text-red-300"
                                        : "bg-white/10 text-[#c8cdd8]",
                                  )}
                                >
                                  {row.result}
                                </span>
                              </td>
                              {row.stats.map((s) => (
                                <td key={s.label} className="numeral text-cream px-2 py-2 text-center">
                                  {s.value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ),
              )}
            </section>
          )}

          {p.news.length > 0 && (
            <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
              <h3 className="rule-head mb-3">News</h3>
              <ul className="space-y-3">
                {p.news.map((n) => (
                  <li key={n.headline} className="flex gap-3">
                    {n.image && (
                      <img
                        src={n.image}
                        alt=""
                        className="h-14 w-20 shrink-0 rounded-md object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      {n.href ? (
                        <a
                          href={n.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cream hover:text-accent inline-flex items-start gap-1 text-[13.5px] font-medium leading-snug"
                        >
                          {n.headline}
                          <ExternalLink size={11} className="mt-1 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <p className="text-cream text-[13.5px] font-medium leading-snug">
                          {n.headline}
                        </p>
                      )}
                      {n.description && (
                        <p className="text-chalk mt-1 line-clamp-2 text-[12px] leading-relaxed">
                          {n.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
            <h3 className="rule-head mb-3">Bio</h3>
            <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
              <BioItem label="Class" value={p.classYear ?? "—"} />
              <BioItem label="Height" value={p.height ?? "—"} />
              <BioItem label="Weight" value={p.weight ?? "—"} />
              <BioItem label="Age" value={p.age != null ? String(p.age) : "—"} />
              <BioItem label="Birthplace" value={p.birthPlace ?? "—"} />
              <BioItem label="Status" value={p.status ?? "—"} />
            </dl>
            <a
              href={`https://www.espn.com/college-football/player/_/id/${p.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent mt-4 inline-flex items-center gap-1 text-[12px]"
            >
              ESPN player page <ExternalLink size={12} />
            </a>
          </section>
        </>
      )}
    </div>
  );
}

function BioItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
        {label}
      </dt>
      <dd className="text-cream mt-0.5 text-[14px]">{value}</dd>
    </div>
  );
}

function PlayerHero({ player, accent }: { player: CfbPlayerProfile; accent: string }) {
  const parts = player.name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : player.name;
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(145deg, #0a1428 0%, ${accent}40 42%, #07101f 100%)`,
        }}
      />
      <div className="relative z-10 flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:gap-8 lg:p-8">
        <div className="relative shrink-0">
          <div className="overflow-hidden rounded-xl bg-[#dfe6f2] p-1 ring-2 ring-white/30">
            <img
              src={player.headshot ?? cfbHeadshot(player.id)}
              alt=""
              className="aspect-square w-36 object-cover object-top sm:w-44"
            />
          </div>
          {player.teamLogo ? (
            <img
              src={player.teamLogo}
              alt=""
              className="absolute -bottom-2 -right-2 h-12 w-12 rounded-full bg-[#07101f] p-1 ring-2 ring-white/20"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            {player.teamName ?? "College Football"}
          </p>
          <h1 className="font-display text-cream mt-1 text-[42px] leading-none sm:text-[52px]">
            {lastName}
          </h1>
          {firstName ? (
            <p className="text-cream/80 mt-1 text-[18px] font-medium">{firstName}</p>
          ) : null}
          <p className="text-chalk mt-3 text-[13px]">
            {player.number ? `#${player.number} · ` : ""}
            {player.positionName ?? player.position ?? "Player"}
            {player.classYear ? ` · ${player.classYear}` : ""}
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px]">
            <HeroChip label="HT/WT" value={[player.height, player.weight ? `${player.weight} lbs` : null].filter(Boolean).join(", ") || "—"} />
            <HeroChip label="Birthplace" value={player.birthPlace ?? "—"} />
            <HeroChip label="Status" value={player.status ?? "Active"} />
          </dl>
        </div>
      </div>
    </article>
  );
}

function HeroChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </dt>
      <dd className="text-cream/90 mt-0.5 text-[13px]">{value}</dd>
    </div>
  );
}
