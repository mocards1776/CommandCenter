import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { fetchNflTeamPage, nflHeadshot, type NflTeamPage } from "@/lib/nfl";
import { formatSportsDate } from "@/lib/utils";

export default function NflTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));

  const team = useQuery({
    queryKey: ["nfl-team", teamId],
    queryFn: () => fetchNflTeamPage(teamId!),
    enabled: Boolean(teamId),
    staleTime: 120_000,
  });

  if (!teamId) {
    return <p className="text-alert p-6 text-[13px]">Missing team id</p>;
  }

  const t = team.data;
  const accent = `#${(t?.color ?? "d9515c").replace(/^#/, "")}`;

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
          to="/sports/nfl?solo=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          NFL board
        </Link>
      </div>

      {team.isPending ? (
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading team…
        </div>
      ) : team.isError || !t ? (
        <p className="text-alert text-[13px]">
          {team.error instanceof Error ? team.error.message : "Couldn’t load this team."}
        </p>
      ) : (
        <>
          <TeamHero team={t} accent={accent} />

          {t.nextEvent && (
            <Link
              to={`/sports/nfl/game/${t.nextEvent.id}`}
              className="bg-panel hover:border-accent/40 flex items-center gap-3 rounded-xl border border-white/[0.08] px-4 py-3.5 transition"
            >
              <Calendar size={16} className="text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                  Next event
                </p>
                <p className="text-cream truncate text-[14px] font-medium">{t.nextEvent.name}</p>
              </div>
              {t.nextEvent.date && (
                <span className="text-chalk-dim shrink-0 text-[12px]">
                  {formatSportsDate(t.nextEvent.date)}
                </span>
              )}
            </Link>
          )}

          {t.statGroups.length > 0 && (
            <div className="space-y-4">
              {t.statGroups.slice(0, 4).map((group) => (
                <StatGroupCard key={group.name} name={group.name} stats={group.stats} accent={accent} />
              ))}
            </div>
          )}

          <section>
            <h2 className="rule-head mb-3">Roster</h2>
            {t.roster.length === 0 ? (
              <p className="text-chalk-dim text-[13px]">Roster unavailable.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {t.roster.map((p) => (
                  <Link
                    key={p.id}
                    to={`/sports/nfl/player/${p.id}`}
                    className="bg-panel group overflow-hidden rounded-lg border border-white/[0.08] transition hover:border-accent/40"
                  >
                    <div className="aspect-[3/4] bg-[#dfe6f2]">
                      <img
                        src={p.headshot ?? nflHeadshot(p.id, 200)}
                        alt=""
                        className="h-full w-full object-cover object-[center_12%]"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = nflHeadshot(p.id, 200);
                        }}
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="text-cream truncate text-[13px] font-semibold group-hover:underline">
                        {p.name}
                      </p>
                      <p className="text-chalk-dim mt-0.5 text-[10px] uppercase tracking-[0.12em]">
                        {[p.number ? `#${p.number}` : null, p.position].filter(Boolean).join(" · ") ||
                          "—"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TeamHero({ team, accent }: { team: NflTeamPage; accent: string }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      {team.venueImage ? (
        <img
          src={team.venueImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-45"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(145deg, #0a1428 0%, ${accent}50 45%, #07101f 100%)`,
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-[#07101f]/70 to-[#07101f]/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07101f]/90 via-transparent to-[#07101f]/50" />

      <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:gap-7 sm:p-8">
        {team.logo && (
          <div className="mx-auto grid h-28 w-28 shrink-0 place-items-center rounded-2xl bg-white p-3 shadow-2xl sm:mx-0 sm:h-32 sm:w-32">
            <img src={team.logo} alt="" className="h-full w-full object-contain" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
            NFL
            {team.standing ? ` · ${team.standing}` : ""}
          </p>
          <h1 className="font-display mt-1 text-[36px] leading-none text-white sm:text-[48px]">
            {team.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1 sm:justify-start">
            {team.record && (
              <span className="numeral text-[28px] leading-none text-white">{team.record}</span>
            )}
            {team.coachName && (
              <span className="text-[13px] text-white/75">
                HC {team.coachName}
                {team.coachExperience != null ? ` · Y${team.coachExperience + 1}` : ""}
              </span>
            )}
          </div>
          {(team.venueName || team.venueCity) && (
            <p className="mt-2 text-[12px] text-white/55">
              {[team.venueName, team.venueCity].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function StatGroupCard({
  name,
  stats,
  accent,
}: {
  name: string;
  stats: { label: string; value: string }[];
  accent: string;
}) {
  const featured = stats.slice(0, 4);
  const rest = stats.slice(4);

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
          {name}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {featured.map((s, i) => {
          const pct = parsePct(s.value);
          return (
            <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                {s.label}
              </p>
              <p className="numeral text-cream mt-1.5 text-[26px] leading-none">{s.value}</p>
              {pct != null && (
                <div className="bg-field mt-3 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(4, Math.min(100, pct))}%`,
                      background: accent,
                      opacity: 0.85 - i * 0.08,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div className="grid grid-cols-2 border-t border-white/[0.06] sm:grid-cols-3 md:grid-cols-5">
          {rest.map((s) => (
            <div
              key={s.label}
              className="border-b border-r border-white/[0.05] px-3 py-3 text-center"
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">{s.label}</p>
              <p className="numeral text-cream mt-1 text-[16px]">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function parsePct(value: string): number | null {
  const cleaned = value.replace(/%/g, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n * 100;
  if (n > 1 && n <= 100) return n;
  return null;
}
