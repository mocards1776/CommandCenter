import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Share, Users } from "lucide-react";
import toast from "react-hot-toast";
import StarField from "@/components/StarField";
import CfbRankLabel from "@/components/sports/CfbRankLabel";
import {
  fetchCfbConferenceStandings,
  fetchCfbConferences,
  fetchCfbLeaders,
  fetchCfbPolls,
  fetchCfbScoreboard,
  type CfbScoreGame,
} from "@/lib/cfb";
import { loadCfbTeamInterest, rankRuwtCfbGames } from "@/lib/ruwt";
import { markSportsSolo } from "@/lib/sports-home";
import { cn } from "@/lib/utils";

type CfbBoardView = "scores" | "conferences" | "polls" | "stats";

const VIEW_CARDS: {
  id: CfbBoardView;
  eyebrow: string;
  title: [string, string];
  blurb: string;
  seed: number;
}[] = [
  {
    id: "scores",
    eyebrow: "This week",
    title: ["Game", "day"],
    blurb: "Full FBS scoreboard with RUWT heat on every matchup.",
    seed: 11,
  },
  {
    id: "conferences",
    eyebrow: "Standings",
    title: ["Conference", "races"],
    blurb: "Pick a conference and scan overall + league records.",
    seed: 22,
  },
  {
    id: "polls",
    eyebrow: "Rankings",
    title: ["Poll", "board"],
    blurb: "AP Top 25 and coaches poll in one place.",
    seed: 33,
  },
  {
    id: "stats",
    eyebrow: "Leaders",
    title: ["Season", "stats"],
    blurb: "Passing, rushing, receiving, and more FBS leaders.",
    seed: 44,
  },
];

export default function CfbPage() {
  const [view, setView] = useState<CfbBoardView>("scores");
  const [conferenceId, setConferenceId] = useState<string | null>(null);
  const [pollId, setPollId] = useState<string | null>(null);
  const [statId, setStatId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("solo") === "1") markSportsSolo();
    const v = params.get("view");
    if (v === "conferences" || v === "polls" || v === "stats" || v === "scores") {
      setView(v);
    }
  }, []);

  const scoreboard = useQuery({
    queryKey: ["cfb-scoreboard-fbs"],
    queryFn: () => fetchCfbScoreboard(),
    refetchInterval: view === "scores" ? 30_000 : false,
    staleTime: 15_000,
  });

  const conferences = useQuery({
    queryKey: ["cfb-conferences"],
    queryFn: fetchCfbConferences,
    staleTime: 30 * 60_000,
    enabled: view === "conferences",
  });

  useEffect(() => {
    if (!conferenceId && conferences.data?.[0]?.id) {
      setConferenceId(conferences.data[0].id);
    }
  }, [conferenceId, conferences.data]);

  const standings = useQuery({
    queryKey: ["cfb-standings", conferenceId],
    queryFn: () => fetchCfbConferenceStandings(conferenceId!),
    enabled: view === "conferences" && Boolean(conferenceId),
    staleTime: 5 * 60_000,
  });

  const polls = useQuery({
    queryKey: ["cfb-polls"],
    queryFn: fetchCfbPolls,
    staleTime: 10 * 60_000,
    enabled: view === "polls",
  });

  useEffect(() => {
    if (!pollId && polls.data?.[0]?.id) setPollId(polls.data[0].id);
  }, [pollId, polls.data]);

  const leaders = useQuery({
    queryKey: ["cfb-leaders"],
    queryFn: () => fetchCfbLeaders(),
    staleTime: 30 * 60_000,
    enabled: view === "stats",
  });

  useEffect(() => {
    if (!statId && leaders.data?.categories[0]?.id) {
      setStatId(leaders.data.categories[0].id);
    }
  }, [statId, leaders.data]);

  const games = scoreboard.data ?? [];
  const interest = useMemo(() => loadCfbTeamInterest(), []);

  const ranked = useMemo(
    () => rankRuwtCfbGames(games, interest, Math.max(games.length, 1)),
    [games, interest],
  );

  const heatById = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of ranked) map.set(String(g.id), g.score);
    return map;
  }, [ranked]);

  const live = useMemo(() => games.filter((g) => g.live), [games]);
  const upcoming = useMemo(() => games.filter((g) => !g.live && !g.final), [games]);
  const finals = useMemo(() => games.filter((g) => g.final), [games]);

  const activePoll = polls.data?.find((p) => p.id === pollId) ?? polls.data?.[0] ?? null;
  const activeStat =
    leaders.data?.categories.find((c) => c.id === statId) ?? leaders.data?.categories[0] ?? null;

  const refresh = () => {
    const jobs: Promise<unknown>[] = [];
    if (view === "scores") jobs.push(scoreboard.refetch());
    if (view === "conferences") {
      jobs.push(conferences.refetch());
      if (conferenceId) jobs.push(standings.refetch());
    }
    if (view === "polls") jobs.push(polls.refetch());
    if (view === "stats") jobs.push(leaders.refetch());
    void Promise.all(jobs).then(() => toast.success("College football updated"));
  };

  const refreshing =
    scoreboard.isFetching ||
    conferences.isFetching ||
    standings.isFetching ||
    polls.isFetching ||
    leaders.isFetching;

  return (
    <div className="flex min-h-0 flex-col gap-5 p-4 md:p-7">
      <div className="relative overflow-hidden rounded-lg border border-accent/25 bg-gradient-to-br from-hero-lift to-hero p-5 sm:p-7">
        <StarField count={28} seed={42} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="rule-head mb-2">NCAA Football</div>
            <h2 className="font-display text-cream text-[28px] leading-tight sm:text-[34px]">
              College <span className="text-accent">football</span>
            </h2>
            <p className="text-chalk mt-2 max-w-lg text-[13px] leading-relaxed">
              Pick <span className="text-accent">conferences</span>,{" "}
              <span className="text-accent">polls</span>, or{" "}
              <span className="text-accent">stats</span> below — same board language as the
              scoreboard.{" "}
              <Link to="/sports/ruwt?solo=1&sport=cfb" className="text-accent hover:underline">
                RUWT
              </Link>{" "}
              and the{" "}
              <Link to="/sports/hot-seat?solo=1&sport=cfb" className="text-accent hover:underline">
                hot seat
              </Link>{" "}
              stay one hop away.
            </p>
            {live.length > 0 && view === "scores" && (
              <p className="text-alert mt-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                <span className="bg-alert mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
                {live.length} live now
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href="/sports.html"
              title="Home Screen"
              aria-label="Home Screen"
              className="text-chalk hover:text-cream inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 transition hover:border-accent/40"
            >
              <Share size={14} />
            </a>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              title="Refresh"
              aria-label="Refresh"
              className="text-chalk hover:text-cream inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 transition hover:border-accent/40 disabled:opacity-40"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
            <Link
              to="/sports?solo=1"
              title="My teams"
              aria-label="My teams"
              className="from-accent-deep to-accent-dark text-cream inline-flex h-9 w-9 items-center justify-center rounded-sm bg-gradient-to-b"
            >
              <Users size={14} />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {VIEW_CARDS.map((card) => {
          const active = view === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setView(card.id)}
              className={cn(
                "relative overflow-hidden rounded-lg border p-4 text-left transition",
                active
                  ? "border-accent/50 bg-gradient-to-br from-hero-lift to-hero shadow-[0_0_0_1px_rgba(217,81,92,0.25)]"
                  : "border-white/[0.08] bg-gradient-to-br from-hero-lift/80 to-hero/70 hover:border-accent/35",
              )}
            >
              <StarField count={18} seed={card.seed} />
              <div className="relative z-10">
                <div className="rule-head mb-2">{card.eyebrow}</div>
                <h3 className="font-display text-cream text-[22px] leading-tight">
                  {card.title[0]} <span className="text-accent">{card.title[1]}</span>
                </h3>
                <p className="text-chalk mt-2 text-[12px] leading-relaxed">{card.blurb}</p>
                {active ? (
                  <span className="text-accent mt-3 inline-block text-[10px] font-semibold uppercase tracking-[0.16em]">
                    Selected
                  </span>
                ) : (
                  <span className="text-chalk-dim mt-3 inline-block text-[10px] font-semibold uppercase tracking-[0.16em]">
                    Open
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {view === "scores" && (
        <>
          {scoreboard.isPending ? (
            <p className="text-chalk flex items-center gap-2 text-[13px]">
              <Loader2 size={14} className="animate-spin" /> Loading college football…
            </p>
          ) : scoreboard.isError ? (
            <p className="text-alert text-[13px]">Couldn’t load the college football scoreboard.</p>
          ) : games.length === 0 ? (
            <p className="text-chalk-dim text-[13px]">No games this week.</p>
          ) : (
            <>
              {live.length > 0 && (
                <GameSection title="In progress" games={live} heatById={heatById} />
              )}
              {upcoming.length > 0 && (
                <GameSection title="Upcoming" games={upcoming} heatById={heatById} />
              )}
              {finals.length > 0 && (
                <GameSection title="Final" games={finals} heatById={heatById} dimmed />
              )}
            </>
          )}
        </>
      )}

      {view === "conferences" && (
        <section className="space-y-4">
          {conferences.isPending ? (
            <p className="text-chalk flex items-center gap-2 text-[13px]">
              <Loader2 size={14} className="animate-spin" /> Loading conferences…
            </p>
          ) : conferences.isError ? (
            <p className="text-alert text-[13px]">Couldn’t load conferences.</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(conferences.data ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setConferenceId(c.id)}
                    className={cn(
                      "shrink-0 rounded-sm border px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition",
                      conferenceId === c.id
                        ? "border-accent/50 bg-accent text-cream"
                        : "border-white/10 text-chalk hover:border-accent/40 hover:text-cream",
                    )}
                  >
                    {c.abbreviation}
                  </button>
                ))}
              </div>
              {standings.isPending ? (
                <p className="text-chalk flex items-center gap-2 text-[13px]">
                  <Loader2 size={14} className="animate-spin" /> Loading standings…
                </p>
              ) : standings.isError || !standings.data ? (
                <p className="text-alert text-[13px]">Couldn’t load standings.</p>
              ) : (
                <div className="bg-panel overflow-hidden rounded-lg border border-white/[0.08]">
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    <h3 className="font-display text-cream text-[20px]">
                      {standings.data.conference.name}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-[12px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                          <th className="px-4 py-2 font-medium">Team</th>
                          <th className="px-2 py-2 text-right font-medium">Conf</th>
                          <th className="px-2 py-2 text-right font-medium">Overall</th>
                          <th className="px-2 py-2 text-right font-medium">PF</th>
                          <th className="px-2 py-2 text-right font-medium">PA</th>
                          <th className="px-4 py-2 text-right font-medium">Strk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.data.rows.map((row, i) => (
                          <tr key={row.teamId} className="border-t border-white/[0.05]">
                            <td className="px-4 py-2.5">
                              <Link
                                to={`/sports/cfb/team/${row.teamId}`}
                                className="text-cream inline-flex items-center gap-2 font-medium hover:underline"
                              >
                                <span className="text-chalk-dim w-4 tabular-nums text-[11px]">
                                  {i + 1}
                                </span>
                                {row.logo ? (
                                  <img src={row.logo} alt="" className="h-6 w-6 object-contain" />
                                ) : null}
                                <span className="truncate">{row.name}</span>
                              </Link>
                            </td>
                            <td className="numeral px-2 py-2.5 text-right text-white/90">
                              {row.conference ?? "—"}
                            </td>
                            <td className="numeral px-2 py-2.5 text-right text-white/90">
                              {row.overall ?? "—"}
                            </td>
                            <td className="numeral px-2 py-2.5 text-right text-white/70">
                              {row.pointsFor ?? "—"}
                            </td>
                            <td className="numeral px-2 py-2.5 text-right text-white/70">
                              {row.pointsAgainst ?? "—"}
                            </td>
                            <td className="numeral px-4 py-2.5 text-right text-white/70">
                              {row.streak ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {view === "polls" && (
        <section className="space-y-4">
          {polls.isPending ? (
            <p className="text-chalk flex items-center gap-2 text-[13px]">
              <Loader2 size={14} className="animate-spin" /> Loading polls…
            </p>
          ) : polls.isError ? (
            <p className="text-alert text-[13px]">Couldn’t load rankings.</p>
          ) : !polls.data?.length ? (
            <p className="text-chalk-dim text-[13px]">No polls published yet.</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {polls.data.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPollId(p.id)}
                    className={cn(
                      "shrink-0 rounded-sm border px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition",
                      (pollId ?? polls.data[0]?.id) === p.id
                        ? "border-accent/50 bg-accent text-cream"
                        : "border-white/10 text-chalk hover:border-accent/40 hover:text-cream",
                    )}
                  >
                    {p.shortName}
                  </button>
                ))}
              </div>
              {activePoll && (
                <div className="bg-panel overflow-hidden rounded-lg border border-white/[0.08]">
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    <h3 className="font-display text-cream text-[20px]">{activePoll.name}</h3>
                  </div>
                  <ul className="divide-y divide-white/[0.05]">
                    {activePoll.entries.map((e) => (
                      <li key={`${activePoll.id}-${e.teamId}`}>
                        <Link
                          to={`/sports/cfb/team/${e.teamId}`}
                          className="hover:bg-white/[0.03] flex items-center gap-3 px-4 py-3 transition"
                        >
                          <span className="font-display text-accent w-8 text-[22px] tabular-nums">
                            {e.rank}
                          </span>
                          {e.logo ? (
                            <img src={e.logo} alt="" className="h-8 w-8 object-contain" />
                          ) : (
                            <span className="h-8 w-8 rounded-full bg-white/10" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-cream truncate text-[14px] font-semibold">{e.name}</p>
                            <p className="text-chalk-dim text-[11px]">
                              {[e.record, e.points != null ? `${Math.round(e.points)} pts` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          {e.trend ? (
                            <span
                              className={cn(
                                "text-[11px] font-semibold tabular-nums",
                                e.trend.startsWith("+")
                                  ? "text-turf"
                                  : e.trend.startsWith("-") && e.trend !== "-"
                                    ? "text-alert"
                                    : "text-chalk-dim",
                              )}
                            >
                              {e.trend === "0" ? "—" : e.trend}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {view === "stats" && (
        <section className="space-y-4">
          {leaders.isPending ? (
            <p className="text-chalk flex items-center gap-2 text-[13px]">
              <Loader2 size={14} className="animate-spin" /> Loading leaders…
            </p>
          ) : leaders.isError ? (
            <p className="text-alert text-[13px]">Couldn’t load season stats.</p>
          ) : !leaders.data?.categories.length ? (
            <p className="text-chalk-dim text-[13px]">
              Season leaders aren’t published yet — check back after Week 1.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-chalk-dim text-[11px] uppercase tracking-[0.14em]">
                  {leaders.data.season} season
                </p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {leaders.data.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setStatId(c.id)}
                    className={cn(
                      "shrink-0 rounded-sm border px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition",
                      (statId ?? leaders.data.categories[0]?.id) === c.id
                        ? "border-accent/50 bg-accent text-cream"
                        : "border-white/10 text-chalk hover:border-accent/40 hover:text-cream",
                    )}
                  >
                    {c.displayName}
                  </button>
                ))}
              </div>
              {activeStat && (
                <div className="bg-panel overflow-hidden rounded-lg border border-white/[0.08]">
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    <h3 className="font-display text-cream text-[20px]">{activeStat.displayName}</h3>
                  </div>
                  <ul className="divide-y divide-white/[0.05]">
                    {activeStat.leaders.map((row) => (
                      <li key={`${activeStat.id}-${row.athleteId}`}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <span className="text-chalk-dim w-5 text-[12px] tabular-nums">
                            {row.rank}
                          </span>
                          {row.athleteHeadshot ? (
                            <img
                              src={row.athleteHeadshot}
                              alt=""
                              className="h-9 w-9 rounded-full bg-white/10 object-cover object-top"
                              loading="lazy"
                            />
                          ) : (
                            <span className="h-9 w-9 rounded-full bg-white/10" />
                          )}
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/sports/cfb/player/${row.athleteId}`}
                              className="text-cream truncate text-[14px] font-semibold hover:underline"
                            >
                              {row.athleteName}
                            </Link>
                            <p className="text-chalk-dim text-[11px]">
                              {[row.position, row.teamAbbrev].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {row.teamId ? (
                            <Link to={`/sports/cfb/team/${row.teamId}`} className="shrink-0">
                              {row.teamLogo ? (
                                <img src={row.teamLogo} alt="" className="h-7 w-7 object-contain" />
                              ) : null}
                            </Link>
                          ) : null}
                          <span className="font-display text-cream text-[20px] tabular-nums">
                            {row.value}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function GameSection({
  title,
  games,
  heatById,
  dimmed,
}: {
  title: string;
  games: CfbScoreGame[];
  heatById: Map<string, number>;
  dimmed?: boolean;
}) {
  return (
    <section className={cn(dimmed && "opacity-80")}>
      <h3 className="rule-head mb-3">{title}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => (
          <CfbScoreRow key={g.id} game={g} heat={heatById.get(String(g.id))} />
        ))}
      </div>
    </section>
  );
}

function CfbScoreRow({ game, heat }: { game: CfbScoreGame; heat?: number }) {
  return (
    <div
      className={cn(
        "bg-panel relative overflow-hidden rounded-lg border transition hover:border-accent/40",
        game.live ? "border-alert/45" : "border-white/[0.08]",
      )}
    >
      <Link
        to={`/sports/cfb/game/${game.id}`}
        className="absolute inset-0 z-0"
        aria-label={`${game.away.abbrev} at ${game.home.abbrev}`}
      />
      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2 pointer-events-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cream">
          {game.live ? (
            <span className="text-alert">
              <span className="bg-alert mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
              {game.shortDetail || "Live"}
            </span>
          ) : game.final ? (
            "Final"
          ) : (
            game.whenShort ?? "Scheduled"
          )}
        </span>
        {heat != null && heat > 0 ? (
          <span className="text-[10px] text-[#8b93a7]">Heat {heat}</span>
        ) : null}
      </div>
      <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
        <TeamSide side={game.away} align="start" />
        <Link
          to={`/sports/cfb/game/${game.id}`}
          className="font-display relative z-10 text-center text-[24px] tabular-nums text-cream"
        >
          {game.live || game.final ? (
            <>
              {game.away.score ?? "—"}
              <span className="mx-1 text-[14px] text-white/30">-</span>
              {game.home.score ?? "—"}
            </>
          ) : (
            <span className="text-[18px]">{game.whenShort ?? "TBD"}</span>
          )}
        </Link>
        <TeamSide side={game.home} align="end" />
      </div>
    </div>
  );
}

function TeamSide({
  side,
  align,
}: {
  side: CfbScoreGame["away"];
  align: "start" | "end";
}) {
  return (
    <Link
      to={`/sports/cfb/team/${side.teamId}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "relative z-10 flex min-w-0 flex-col gap-1 hover:opacity-90",
        align === "end" ? "items-end text-right" : "items-start",
      )}
    >
      {side.logo ? (
        <img src={side.logo} alt="" className="h-8 w-8 object-contain" loading="lazy" />
      ) : null}
      <p className="text-cream text-[14px] font-semibold">
        <CfbRankLabel pollRank={side.rank} fpiRank={side.fpiRank} />
        {side.abbrev}
      </p>
      {side.record ? <p className="text-chalk-dim text-[10px]">{side.record}</p> : null}
    </Link>
  );
}
