import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import CfbRankLabel from "@/components/sports/CfbRankLabel";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import {
  fetchCfbTeamPage,
  type CfbTeamPage,
  type CfbTeamScheduleGame,
  type CfbTeamWinTrendPoint,
} from "@/lib/cfb";
import { cn, formatSportsDate } from "@/lib/utils";

type TeamTab = "schedule" | "coaches" | "roster";

export default function CfbTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));
  const [tab, setTab] = useState<TeamTab>("schedule");

  const team = useQuery({
    queryKey: ["cfb-team-v2", teamId],
    queryFn: () => fetchCfbTeamPage(teamId!),
    enabled: Boolean(teamId),
    staleTime: 120_000,
  });

  if (!teamId) {
    return <p className="text-alert p-6 text-[13px]">Missing team id</p>;
  }

  const t = team.data;
  const accent = `#${(t?.color ?? "d9515c").replace(/^#/, "")}`;

  return (
    <div ref={swipeRef} className="mx-auto max-w-6xl space-y-0 p-0 md:p-7 md:space-y-5">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-0 md:pt-0">
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
          CFB board
        </Link>
      </div>

      {team.isPending ? (
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading team…
        </div>
      ) : team.isError || !t ? (
        <p className="text-alert px-4 text-[13px] md:px-0">
          {team.error instanceof Error ? team.error.message : "Couldn’t load this team."}
        </p>
      ) : (
        <>
          <TeamHero team={t} accent={accent} />

          <div
            className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0a1730]/95 backdrop-blur-md"
            style={{ borderBottomColor: `${accent}33` }}
          >
            <nav className="flex gap-0 overflow-x-auto px-2 md:px-0">
              {(
                [
                  ["schedule", "Schedule"],
                  ["coaches", "Coaches"],
                  ["roster", "Roster"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "relative shrink-0 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                    tab === id ? "text-cream" : "text-chalk hover:text-cream",
                  )}
                >
                  {label}
                  {tab === id ? (
                    <span
                      className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-sm"
                      style={{ background: accent }}
                    />
                  ) : null}
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-4 px-4 py-4 md:px-0 md:py-0">
            {tab === "schedule" && (
              <div className="space-y-4">
                <CfbWinTrendChart points={t.winTrend} accent={accent} />
                <SchedulePanel team={t} />
              </div>
            )}
            {tab === "coaches" && <CoachesPanel team={t} accent={accent} />}
            {tab === "roster" && <RosterPanel team={t} />}
          </div>
        </>
      )}
    </div>
  );
}

function TeamHero({ team, accent }: { team: CfbTeamPage; accent: string }) {
  return (
    <article
      className="relative overflow-hidden border-y border-white/[0.08] md:rounded-2xl md:border"
      style={{
        background: `linear-gradient(160deg, #07101f 0%, ${accent}66 42%, #0a1428 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-transparent to-[#07101f]/35" />
      <div className="relative z-10 flex items-end gap-4 px-4 py-6 sm:gap-6 sm:px-7 sm:py-8">
        {team.logo ? (
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-white p-2.5 shadow-2xl sm:h-24 sm:w-24">
            <img src={team.logo} alt="" className="h-full w-full object-contain" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 pb-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            {[team.conference, team.standing].filter(Boolean).join(" · ") || "College football"}
            {team.fpiRank != null ? (
              <>
                {" · "}
                <CfbRankLabel pollRank={null} fpiRank={team.fpiRank} />
              </>
            ) : null}
          </p>
          <h1 className="font-display mt-1 text-[28px] leading-none text-white sm:text-[40px]">
            {team.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {team.record ? (
              <span className="numeral text-[26px] leading-none text-white">{team.record}</span>
            ) : null}
            {team.coaches[0] ? (
              <span className="text-[13px] text-white/75">HC {team.coaches[0].name}</span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function SchedulePanel({ team }: { team: CfbTeamPage }) {
  const groups = useMemo(() => {
    const byWeek = new Map<string, CfbTeamScheduleGame[]>();
    for (const g of team.schedule) {
      const key =
        g.week != null ? `Week ${g.week}` : g.final ? "Final" : g.live ? "Live" : "Upcoming";
      const list = byWeek.get(key) ?? [];
      list.push(g);
      byWeek.set(key, list);
    }
    return [...byWeek.entries()];
  }, [team.schedule]);

  if (team.schedule.length === 0) {
    return <p className="text-chalk-dim text-[13px]">Schedule unavailable.</p>;
  }

  return (
    <div className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      {groups.map(([label, games]) => (
        <div key={label}>
          <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              {label}
            </p>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {games.map((g) => (
              <ScheduleRow key={g.id} game={g} teamAbbrev={team.abbrev} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ScheduleRow({
  game,
  teamAbbrev,
}: {
  game: CfbTeamScheduleGame;
  teamAbbrev: string;
}) {
  const resultLabel = game.final
    ? game.won === true
      ? "W"
      : game.won === false
        ? "L"
        : "T"
    : game.live
      ? game.shortDetail || "Live"
      : game.shortDetail || game.dateLabel || "TBD";

  return (
    <li>
      <Link
        to={`/sports/cfb/game/${game.id}`}
        className="hover:bg-white/[0.03] grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 transition sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,0.9fr)]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {game.oppLogo ? (
              <img src={game.oppLogo} alt="" className="h-8 w-8 object-contain" loading="lazy" />
            ) : (
              <span className="h-8 w-8 rounded-full bg-white/10" />
            )}
            <div className="min-w-0">
              <p className="text-cream truncate text-[14px] font-semibold">
                <span className="text-chalk-dim mr-1.5 text-[11px] font-medium uppercase tracking-[0.12em]">
                  {game.home ? "vs" : "@"}
                </span>
                <CfbRankLabel pollRank={game.oppRank} fpiRank={null} />
                {game.oppName}
              </p>
              <p className="text-chalk-dim text-[11px]">
                {game.date ? formatSportsDate(game.date) : game.dateLabel || "Date TBD"}
              </p>
            </div>
          </div>
        </div>

        <div className="text-right sm:text-center">
          {game.live || game.final ? (
            <p className="font-display text-cream text-[22px] tabular-nums leading-none">
              <span className={cn(game.won === false && game.final && "text-white/45")}>
                {game.teamScore ?? "—"}
              </span>
              <span className="mx-1 text-[13px] text-white/30">-</span>
              <span className={cn(game.won === true && game.final && "text-white/45")}>
                {game.oppScore ?? "—"}
              </span>
            </p>
          ) : (
            <p className="text-cream text-[13px] font-medium">{game.shortDetail || "TBD"}</p>
          )}
          <p className="text-chalk-dim mt-1 text-[10px] uppercase tracking-[0.12em]">
            {teamAbbrev}
          </p>
        </div>

        <div className="hidden text-right sm:block">
          <p
            className={cn(
              "text-[12px] font-semibold uppercase tracking-[0.12em]",
              game.live
                ? "text-alert"
                : game.final && game.won === true
                  ? "text-turf"
                  : game.final && game.won === false
                    ? "text-alert"
                    : "text-chalk",
            )}
          >
            {resultLabel}
          </p>
          {game.dateLabel ? (
            <p className="text-chalk-dim mt-1 text-[11px]">{game.dateLabel}</p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function CfbWinTrendChart({
  points,
  accent,
}: {
  points: CfbTeamWinTrendPoint[];
  accent: string;
}) {
  if (!points.length) return null;
  const maxWins = Math.max(12, ...points.map((r) => r.wins));

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-[15px] font-semibold text-white">5-Year Win Trend</h3>
        <p className="text-chalk-dim mt-0.5 text-[11px] uppercase tracking-[0.14em]">
          Regular season wins
        </p>
      </div>
      <ul className="flex flex-col gap-2.5 px-4 py-4">
        {points.map((r) => (
          <li key={r.season} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2">
            <span className="numeral text-chalk text-[12px]">{r.season}</span>
            <div className="h-3.5 overflow-hidden rounded-sm bg-white/[0.06]">
              <div
                className="h-full rounded-sm transition-[width] duration-500"
                style={{
                  width: `${Math.max(4, (r.wins / maxWins) * 100)}%`,
                  background: accent,
                }}
                title={`${r.wins}-${r.losses}`}
              />
            </div>
            <span className="numeral min-w-[3.5rem] text-right text-[13px] font-semibold text-white">
              {r.wins}-{r.losses}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CoachesPanel({ team, accent }: { team: CfbTeamPage; accent: string }) {
  if (team.coaches.length === 0) {
    return <p className="text-chalk-dim text-[13px]">Coaching staff unavailable.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-chalk-dim text-[12px] leading-relaxed">
        Head coach from ESPN
        {team.staffSource
          ? `; assistants from ${team.staffSource}.`
          : "; assistants when the season staff listing is available."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {team.coaches.map((c) => {
          const inner = (
            <>
              {c.headshot ? (
                <img
                  src={c.headshot}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl bg-[#dfe6f2] object-cover object-top"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "grid";
                  }}
                />
              ) : null}
              <div
                className={cn(
                  "grid h-16 w-16 shrink-0 place-items-center rounded-xl text-[18px] font-semibold text-white",
                  c.headshot ? "hidden" : "",
                )}
                style={{ background: `${accent}99` }}
              >
                {c.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                  {c.title}
                </p>
                <p className="text-cream truncate text-[16px] font-semibold group-hover:underline">
                  {c.name}
                </p>
                <p className="text-chalk-dim mt-0.5 text-[12px]">{team.name}</p>
              </div>
            </>
          );

          if (c.linkable) {
            return (
              <Link
                key={c.id}
                to={`/sports/cfb/coach/${c.id}`}
                className="bg-panel hover:border-accent/40 group flex items-center gap-4 rounded-xl border border-white/[0.08] p-4 transition"
              >
                {inner}
              </Link>
            );
          }
          return (
            <div
              key={c.id}
              className="bg-panel flex items-center gap-4 rounded-xl border border-white/[0.08] p-4"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RosterPanel({ team }: { team: CfbTeamPage }) {
  if (team.roster.length === 0) {
    return <p className="text-chalk-dim text-[13px]">Roster unavailable.</p>;
  }

  return (
    <div className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <ul className="divide-y divide-white/[0.05]">
        {team.roster.map((p) => (
          <li key={p.id}>
            <Link
              to={`/sports/cfb/player/${p.id}`}
              className="hover:bg-white/[0.03] flex items-center gap-3 px-4 py-2.5 transition"
            >
              {p.headshot ? (
                <img
                  src={p.headshot}
                  alt=""
                  className="h-10 w-10 rounded-full bg-white/10 object-cover object-top"
                  loading="lazy"
                />
              ) : (
                <span className="h-10 w-10 rounded-full bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-cream truncate text-[13px] font-medium">{p.name}</p>
                <p className="text-chalk-dim text-[11px]">
                  {[p.number ? `#${p.number}` : null, p.position].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
