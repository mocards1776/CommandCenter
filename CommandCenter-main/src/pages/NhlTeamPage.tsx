import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { fetchNhlTeamPage, nhlHeadshot, type NhlTeamPage } from "@/lib/nhl";
import { formatSportsDate } from "@/lib/utils";

export default function NhlTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));

  const team = useQuery({
    queryKey: ["nhl-team", teamId],
    queryFn: () => fetchNhlTeamPage(teamId!),
    enabled: Boolean(teamId),
    staleTime: 120_000,
  });

  if (!teamId) return <p className="text-alert p-6 text-[13px]">Missing team id</p>;

  const t = team.data;
  const accent = `#${(t?.color ?? "002f87").replace(/^#/, "")}`;
  const upcoming = (t?.schedule ?? []).filter((g) => g.state !== "post").slice(0, 6);
  const recent = (t?.schedule ?? []).filter((g) => g.state === "post").slice(-6).reverse();

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
          to="/sports/nhl?solo=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          NHL board
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
              to={`/sports/nhl/game/${t.nextEvent.id}`}
              className="bg-panel hover:border-accent/40 flex items-center gap-3 rounded-xl border border-white/[0.08] px-4 py-3.5 transition"
            >
              <Calendar size={16} className="text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                  Next game
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

          {(upcoming.length > 0 || recent.length > 0) && (
            <section className="grid gap-4 lg:grid-cols-2">
              <ScheduleList title="Upcoming" games={upcoming} />
              <ScheduleList title="Recent" games={recent} />
            </section>
          )}

          {t.statGroups.length > 0 && (
            <div className="space-y-4">
              {t.seasonLabel ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                  Team stats · {t.seasonLabel}
                </p>
              ) : null}
              {t.statGroups.map((group) => (
                <section
                  key={group.name}
                  className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
                >
                  <div className="border-b border-white/[0.06] px-4 py-2.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                      {group.name}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] sm:grid-cols-3">
                    {group.stats.map((s) => (
                      <div key={s.label} className="px-3 py-4 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                          {s.label}
                        </p>
                        <p className="numeral text-cream mt-1 text-[22px] leading-none">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {t.playerTables.length > 0 && (
            <section className="space-y-4">
              <h2 className="rule-head">Player stats</h2>
              {t.playerTables.map((table) => (
                <div
                  key={table.name}
                  className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
                >
                  <div className="border-b border-white/[0.06] px-4 py-2.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                      {table.name}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-[12px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                          <th className="px-4 py-2 font-medium">Player</th>
                          {table.labels.map((lab) => (
                            <th key={lab} className="numeral px-2 py-2 text-right font-medium">
                              {lab}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row) => (
                          <tr key={`${table.name}-${row.id}`} className="border-t border-white/[0.05]">
                            <td className="px-4 py-2">
                              <Link
                                to={`/sports/nhl/player/${row.id}`}
                                className="text-cream inline-flex items-center gap-2 font-medium hover:underline"
                              >
                                <img
                                  src={nhlHeadshot(row.id)}
                                  alt=""
                                  className="h-7 w-7 rounded-full bg-[#dfe6f2] object-cover object-top"
                                  loading="lazy"
                                />
                                {row.name}
                              </Link>
                            </td>
                            {row.stats.map((val, i) => (
                              <td
                                key={`${row.id}-${table.labels[i] ?? i}`}
                                className="numeral px-2 py-2 text-right text-white/90"
                              >
                                {val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section>
            <h2 className="rule-head mb-3">Roster</h2>
            {t.roster.length === 0 ? (
              <p className="text-chalk-dim text-[13px]">Roster unavailable.</p>
            ) : (
              <div className="space-y-5">
                {groupRoster(t.roster).map((group) => (
                  <div key={group.name}>
                    <p className="text-chalk-dim mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                      {group.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {group.players.map((p) => (
                        <Link
                          key={p.id}
                          to={`/sports/nhl/player/${p.id}`}
                          className="bg-panel group overflow-hidden rounded-lg border border-white/[0.08] transition hover:border-accent/40"
                        >
                          <div className="aspect-[3/4] bg-[#dfe6f2]">
                            <img
                              src={p.headshot ?? nhlHeadshot(p.id)}
                              alt=""
                              className="h-full w-full object-cover object-[center_12%]"
                              loading="lazy"
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
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function groupRoster(roster: NhlTeamPage["roster"]) {
  const order = ["Centers", "Left Wings", "Right Wings", "Defense", "Goalies"];
  const map = new Map<string, NhlTeamPage["roster"]>();
  for (const p of roster) {
    const key = p.group || "Roster";
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  const names = [
    ...order.filter((n) => map.has(n)),
    ...[...map.keys()].filter((n) => !order.includes(n)),
  ];
  return names.map((name) => ({ name, players: map.get(name) ?? [] }));
}

function ScheduleList({
  title,
  games,
}: {
  title: string;
  games: NhlTeamPage["schedule"];
}) {
  return (
    <div className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">{title}</h3>
      </div>
      {games.length === 0 ? (
        <p className="text-chalk-dim px-4 py-3 text-[13px]">None on the schedule.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {games.map((g) => (
            <li key={g.id}>
              <Link
                to={`/sports/nhl/game/${g.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/[0.03]"
              >
                <span className="text-cream text-[13px] font-medium">{g.label}</span>
                <span className="text-chalk-dim shrink-0 text-right text-[11px]">
                  {g.date ? formatSportsDate(g.date) : ""}
                  {g.detail ? ` · ${g.detail}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamHero({ team, accent }: { team: NhlTeamPage; accent: string }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.1]">
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(145deg, #07101f 0%, ${accent}55 48%, #07101f 100%)` }}
      />
      <div className="relative z-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-7">
        {team.logo ? <img src={team.logo} alt="" className="h-20 w-20 object-contain" /> : null}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">NHL</p>
          <h1 className="font-display text-cream text-[36px] leading-none sm:text-[46px]">{team.name}</h1>
          <p className="text-cream/80 mt-2 text-[14px]">
            {team.record ?? "—"}
            {team.standing ? ` · ${team.standing}` : ""}
          </p>
          <p className="text-chalk mt-1 text-[12px]">
            {[team.coachName ? `Coach ${team.coachName}` : null, team.venueName, team.venueCity]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
    </article>
  );
}
