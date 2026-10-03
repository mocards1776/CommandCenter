import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, ChevronRight, Loader2 } from "lucide-react";
import NhlThreeStars from "@/components/sports/NhlThreeStars";
import TeamResultBadge from "@/components/sports/TeamResultBadge";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import {
  fetchNhlGameDetail,
  fetchNhlTeamPage,
  fetchNhlThreeStars,
  liftTeamColor,
  nhlHeadshot,
  type NhlScheduleItem,
  type NhlTeamPage,
} from "@/lib/nhl";
import { cn, formatSportsDate } from "@/lib/utils";

const LEADER_SHORT: Record<string, string> = { goals: "G", assists: "A", points: "PTS", saves: "SV" };

function shortDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** ESPN pregame shortDetail reads "10/3 - 9:00 PM EDT"; keep the clock. */
function puckDrop(detail: string | null): string | null {
  const time = detail?.split(" - ")[1]?.trim();
  return time || null;
}

function finalTag(detail: string | null): string {
  const m = /\/(OT|SO|\dOT)/i.exec(detail ?? "");
  return m ? `Final/${m[1].toUpperCase()}` : "Final";
}

export default function NhlTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));

  const team = useQuery({
    queryKey: ["nhl-team-v2", teamId],
    queryFn: () => fetchNhlTeamPage(teamId!),
    enabled: Boolean(teamId),
    staleTime: 120_000,
  });

  if (!teamId) return <p className="text-alert p-6 text-[13px]">Missing team id</p>;

  const t = team.data;
  const accent = liftTeamColor(`#${(t?.color ?? "002f87").replace(/^#/, "")}`);
  const schedule = t?.schedule ?? [];
  const finished = schedule.filter((g) => g.state === "post");
  const lastGame = finished[finished.length - 1] ?? null;
  const liveGame = schedule.find((g) => g.state === "in") ?? null;
  const upcoming = schedule.filter((g) => g.state === "pre").slice(0, 6);
  const recent = finished.slice(-6).reverse();

  return (
    <div ref={swipeRef} className="mx-auto max-w-6xl space-y-5 p-4 md:p-7">
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

          {liveGame ? <NextGameRow team={t} game={liveGame} live /> : null}

          <div className={cn("grid items-start gap-4", lastGame && "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]")}>
            {lastGame ? <LastGameCard team={t} game={lastGame} accent={accent} /> : null}
            <div className="space-y-4">
              {!liveGame && upcoming[0] ? <NextGameRow team={t} game={upcoming[0]} /> : null}
              <ScheduleList title="Upcoming" games={upcoming.slice(liveGame ? 0 : 1)} teamAbbrev={t.abbrev} />
              <ScheduleList title="Recent" games={recent} teamAbbrev={t.abbrev} />
            </div>
          </div>

          <SeasonStats team={t} accent={accent} />

          <PlayerLeaders team={t} accent={accent} />

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

function TeamHero({ team, accent }: { team: NhlTeamPage; accent: string }) {
  const chips: { label: string; value: string; tone?: string }[] = [
    { label: "Record", value: team.record ?? "—" },
    { label: "Points", value: team.points != null ? String(team.points) : "—" },
    team.streak
      ? {
          label: "Streak",
          value: team.streak,
          tone: team.streak.startsWith("W") ? "text-emerald-300" : "text-red-300",
        }
      : null,
    team.goalDiff != null
      ? {
          label: "Goal diff",
          value: team.goalDiff > 0 ? `+${team.goalDiff}` : String(team.goalDiff),
          tone: team.goalDiff > 0 ? "text-emerald-300" : team.goalDiff < 0 ? "text-red-300" : undefined,
        }
      : null,
    team.homeRecord ? { label: "Home", value: team.homeRecord } : null,
    team.roadRecord ? { label: "Road", value: team.roadRecord } : null,
  ].filter((c): c is { label: string; value: string; tone?: string } => Boolean(c));

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#07101f]">
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(140deg, #07101f 0%, ${accent}40 50%, #07101f 100%)` }}
      />
      {team.logo ? (
        <img
          src={team.logo}
          alt=""
          className="pointer-events-none absolute -right-10 -top-8 h-64 w-64 object-contain opacity-[0.08] sm:h-80 sm:w-80"
        />
      ) : null}
      <div className="h-1 w-full" style={{ background: accent }} />
      <div className="relative z-10 p-5 sm:p-7">
        <div className="flex items-center gap-4 sm:gap-6">
          {team.logo ? (
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10 sm:h-28 sm:w-28"
              style={{ boxShadow: `0 12px 40px ${accent}40` }}
            >
              <img
                src={team.logo}
                alt=""
                className="h-16 w-16 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.5)] sm:h-24 sm:w-24"
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
              NHL{team.standing ? ` · ${team.standing}` : ""}
            </p>
            <h1 className="font-display text-cream mt-1 text-[32px] leading-[0.95] sm:text-[46px]">{team.name}</h1>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {chips.map((c) => (
            <div
              key={c.label}
              className="rounded-lg border border-white/[0.08] bg-black/25 px-2.5 py-2 text-center backdrop-blur-sm"
            >
              <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">{c.label}</dt>
              <dd className={cn("numeral text-cream mt-1 text-[18px] leading-none sm:text-[20px]", c.tone)}>
                {c.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#a8b0c2]">
          {team.coachName ? (
            <span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">Head coach </span>
              {team.coachId ? (
                <Link
                  to={`/sports/nhl/coach/${team.coachId}?team=${team.id}`}
                  className="text-cream font-medium underline decoration-white/25 underline-offset-2 hover:decoration-white"
                >
                  {team.coachName}
                </Link>
              ) : (
                <span className="text-cream font-medium">{team.coachName}</span>
              )}
            </span>
          ) : null}
          {team.venueName ? (
            <span>{[team.venueName, team.venueCity].filter(Boolean).join(" · ")}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function NextGameRow({ team, game, live = false }: { team: NhlTeamPage; game: NhlScheduleItem; live?: boolean }) {
  const opp = game.opponent;
  return (
    <Link
      to={`/sports/nhl/game/${game.id}`}
      className="bg-panel hover:border-accent/40 flex items-center gap-3 rounded-xl border border-white/[0.08] px-4 py-3.5 transition"
    >
      {live ? (
        <span className="bg-alert h-2 w-2 shrink-0 animate-pulse rounded-full" />
      ) : (
        <Calendar size={16} className="text-accent shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.14em]",
            live ? "text-alert" : "text-[#8b93a7]",
          )}
        >
          {live ? "Live now" : "Next game"}
        </p>
        <p className="text-cream flex items-center gap-2 truncate text-[14px] font-medium">
          <span className="text-chalk-dim text-[12px]">{game.homeAway === "away" ? "@" : "vs"}</span>
          {opp?.logo ? <img src={opp.logo} alt="" className="h-6 w-6 object-contain" /> : null}
          {opp?.name ?? game.label}
          {live && game.teamScore != null && game.oppScore != null ? (
            <span className="numeral text-cream ml-1">
              {team.abbrev} {game.teamScore}–{game.oppScore}
            </span>
          ) : null}
        </p>
      </div>
      <span className="text-chalk-dim shrink-0 text-right text-[11.5px] leading-tight">
        {live ? (
          game.detail
        ) : (
          <>
            {shortDay(game.date)}
            {puckDrop(game.detail) ? <span className="block">{puckDrop(game.detail)}</span> : null}
          </>
        )}
      </span>
      <ChevronRight size={15} className="shrink-0 text-[#6f778a]" />
    </Link>
  );
}

function LastGameCard({ team, game, accent }: { team: NhlTeamPage; game: NhlScheduleItem; accent: string }) {
  const detail = useQuery({
    queryKey: ["nhl-game", game.id],
    queryFn: () => fetchNhlGameDetail(game.id),
    staleTime: 300_000,
  });
  const g = detail.data;
  const stars = useQuery({
    queryKey: ["nhl-three-stars", game.id],
    queryFn: () => fetchNhlThreeStars(g!),
    enabled: Boolean(g),
    staleTime: 300_000,
    retry: 1,
  });

  const us = g ? (String(g.home.teamId) === team.id ? g.home : g.away) : null;
  const them = g && us ? (us === g.home ? g.away : g.home) : null;
  const opp = game.opponent;
  const periods = g ? Math.max(g.away.linescores.length, g.home.linescores.length, 3) : 0;
  const ourLeaders = g && us ? g.leaders.filter((l) => l.teamAbbrev === us.abbrev) : [];
  const topLeaders = [...new Map(ourLeaders.map((l) => [l.id, l])).values()].slice(0, 3);

  return (
    <section className="bg-panel relative overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="h-1 w-full" style={{ background: accent }} />
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">Last game</h3>
        <span className="text-[11px] text-[#8b93a7]">{shortDay(game.date)}</span>
      </div>

      <Link to={`/sports/nhl/game/${game.id}`} className="group block px-4 pb-4 pt-4 hover:bg-white/[0.02]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <ScoreSide logo={team.logo} abbrev={team.abbrev} score={game.teamScore} won={game.result === "W"} />
          <div className="text-center">
            {game.result ? <TeamResultBadge result={game.result} /> : null}
            <p className="text-chalk mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
              {finalTag(game.detail)}
            </p>
            <p className="text-chalk-dim mt-0.5 text-[10.5px]">
              {game.homeAway === "away" ? "@" : "vs"} {opp?.abbrev ?? ""}
            </p>
          </div>
          <ScoreSide
            logo={opp?.logo ?? null}
            abbrev={opp?.abbrev ?? "OPP"}
            score={game.oppScore}
            won={game.result != null && game.result !== "W"}
            align="right"
          />
        </div>

        {g && us && them ? (
          <table className="mt-4 w-full text-center text-[11.5px]">
            <thead>
              <tr className="text-[9.5px] uppercase tracking-[0.12em] text-[#8b93a7]">
                <th className="py-1 text-left font-medium"> </th>
                {Array.from({ length: periods }, (_, i) => (
                  <th key={i} className="py-1 font-medium">
                    {i < 3 ? i + 1 : i === 3 ? "OT" : `OT${i - 2}`}
                  </th>
                ))}
                <th className="py-1 font-medium">T</th>
              </tr>
            </thead>
            <tbody>
              {[g.away, g.home].map((side) => (
                <tr key={side.teamId} className="border-t border-white/[0.05]">
                  <td className={cn("py-1.5 text-left font-semibold", side === us ? "text-cream" : "text-white/60")}>
                    {side.abbrev}
                  </td>
                  {Array.from({ length: periods }, (_, i) => (
                    <td key={i} className="numeral py-1.5 text-white/75">
                      {side.linescores[i] ?? "—"}
                    </td>
                  ))}
                  <td className="numeral text-cream py-1.5 font-semibold">{side.score ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : detail.isPending ? (
          <p className="text-chalk-dim mt-4 flex items-center gap-2 text-[12px]">
            <Loader2 size={13} className="animate-spin" /> Loading box score…
          </p>
        ) : null}

        <p className="text-accent mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] group-hover:underline">
          Gamecast <ChevronRight size={12} />
        </p>
      </Link>

      {g && stars.data?.length ? (
        <div className="border-t border-white/[0.06] px-3 pb-3 pt-3">
          <p className="mb-2.5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            Three Stars
          </p>
          <NhlThreeStars stars={stars.data} away={g.away} home={g.home} boxGroups={g.boxGroups} compact />
        </div>
      ) : topLeaders.length > 0 ? (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            {team.abbrev} leaders
          </p>
          <ul className="space-y-2">
            {topLeaders.map((l) => (
              <li key={l.id}>
                <Link to={`/sports/nhl/player/${l.id}`} className="flex items-center gap-3 hover:underline">
                  <img
                    src={nhlHeadshot(l.id)}
                    alt=""
                    className="h-9 w-9 rounded-full bg-[#dfe6f2] object-cover object-top"
                    style={{ boxShadow: `0 0 0 2px ${accent}` }}
                  />
                  <span className="text-cream min-w-0 flex-1 truncate text-[13px] font-medium">{l.name}</span>
                  <span className="numeral text-chalk-dim text-[12px]">
                    {ourLeaders
                      .filter((x) => x.id === l.id)
                      .map((x) => `${x.value} ${LEADER_SHORT[x.category.trim().toLowerCase()] ?? x.category}`)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ScoreSide({
  logo,
  abbrev,
  score,
  won,
  align = "left",
}: {
  logo: string | null;
  abbrev: string;
  score: number | null;
  won: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("flex items-center gap-2.5", align === "right" && "flex-row-reverse")}>
      {logo ? (
        <img
          src={logo}
          alt=""
          className={cn("h-12 w-12 object-contain sm:h-14 sm:w-14", !won && "opacity-70")}
        />
      ) : null}
      <div className={cn(align === "right" && "text-right")}>
        <p className={cn("font-display text-[40px] leading-none sm:text-[48px]", won ? "text-cream" : "text-white/50")}>
          {score ?? "—"}
        </p>
        <p className="text-chalk-dim text-[11px] font-semibold uppercase tracking-[0.12em]">{abbrev}</p>
      </div>
    </div>
  );
}

function ScheduleList({
  title,
  games,
  teamAbbrev,
}: {
  title: string;
  games: NhlScheduleItem[];
  teamAbbrev: string;
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
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03]"
              >
                {g.result ? <TeamResultBadge result={g.result} className="w-9" /> : null}
                <span className="text-chalk-dim w-4 shrink-0 text-center text-[11px]">
                  {g.homeAway === "away" ? "@" : "vs"}
                </span>
                {g.opponent?.logo ? (
                  <img src={g.opponent.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
                ) : null}
                <span className="text-cream min-w-0 flex-1 truncate text-[13px] font-medium">
                  {g.opponent?.abbrev ?? g.label}
                </span>
                {g.state === "post" && g.teamScore != null && g.oppScore != null ? (
                  <span className="numeral shrink-0 text-right text-[13px] font-semibold leading-tight">
                    <span className={g.result === "W" ? "text-emerald-300" : g.result === "L" || g.result === "OTL" ? "text-red-300" : "text-cream"}>
                      <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/40">
                        {teamAbbrev}
                      </span>
                      {g.teamScore}
                    </span>
                    <span className="mx-1 text-white/30">–</span>
                    <span className="text-white/55">
                      {g.oppScore}
                      <span className="ml-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/35">
                        {g.opponent?.abbrev ?? ""}
                      </span>
                    </span>
                    {/OT|SO/i.test(g.detail ?? "") ? (
                      <span className="text-chalk-dim ml-1 text-[10px] font-normal">
                        {finalTag(g.detail).replace("Final/", "")}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                <span className="text-chalk-dim w-[5.5rem] shrink-0 text-right text-[11px] leading-tight">
                  {shortDay(g.date) || formatSportsDate(g.date)}
                  {g.state === "pre" && puckDrop(g.detail) ? (
                    <span className="block text-[10px] text-[#6f778a]">{puckDrop(g.detail)}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function num(map: Record<string, string>, key: string): number | null {
  const n = Number.parseFloat(map[key] ?? "");
  return Number.isFinite(n) ? n : null;
}

function SeasonStats({ team, accent }: { team: NhlTeamPage; accent: string }) {
  const m = team.statMap;
  const gp = num(m, "GP");
  const gf = num(m, "G");
  const ga = num(m, "GA");
  if (gp == null || !gp) return null;
  const perGame = (v: number | null) => (v == null ? "—" : (v / gp).toFixed(2));
  const hero = [
    { label: "Goals / game", value: perGame(gf) },
    { label: "Against / game", value: perGame(ga) },
    { label: "Save %", value: m["SV%"] ?? "—" },
    { label: "Shooting %", value: m.SPCT ? `${m.SPCT}%` : "—" },
  ];
  const minor = [
    { label: "Goals", value: m.G },
    { label: "Goals against", value: m.GA },
    { label: "Shots", value: m.S },
    { label: "Shots against", value: m.SA },
    { label: "PP goals", value: m.PPG },
    { label: "SH goals", value: m.SHG },
    { label: "Faceoff %", value: m["FO%"] ? `${m["FO%"]}%` : undefined },
    { label: "PIM", value: m.PIM },
  ].filter((s): s is { label: string; value: string } => Boolean(s.value));
  const total = (gf ?? 0) + (ga ?? 0);
  const share = total > 0 ? ((gf ?? 0) / total) * 100 : 50;

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">Team stats</h3>
        <span className="text-[10.5px] text-[#8b93a7]">
          {[team.seasonLabel, `${gp} GP`].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/[0.05] sm:grid-cols-4">
        {hero.map((s) => (
          <div key={s.label} className="bg-panel px-4 py-4">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">{s.label}</p>
            <p className="font-display text-cream mt-1.5 text-[32px] leading-none tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      {gf != null && ga != null ? (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.12em] text-[#8b93a7]">
            <span>
              <span className="numeral text-cream text-[13px]">{gf}</span> GF
            </span>
            <span>
              GA <span className="numeral text-cream text-[13px]">{ga}</span>
            </span>
          </div>
          <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            <span className="rounded-l-full" style={{ width: `${share}%`, background: accent }} />
            <span className="flex-1 rounded-r-full bg-white/20" />
          </div>
        </div>
      ) : null}
      {minor.length ? (
        <dl className="grid grid-cols-4 divide-x divide-y divide-white/[0.05] border-t border-white/[0.06] sm:grid-cols-8">
          {minor.map((s) => (
            <div key={s.label} className="px-2 py-3 text-center">
              <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8b93a7]">{s.label}</dt>
              <dd className="numeral text-cream mt-1 text-[16px] leading-none">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function PlayerLeaders({ team, accent }: { team: NhlTeamPage; accent: string }) {
  if (!team.playerTables.length) return null;
  const skaters = team.playerTables.find((t) => t.name === "Skaters");
  const top = (skaters?.rows ?? []).slice(0, 3);
  return (
    <section className="space-y-4">
      <h2 className="rule-head">Player stats</h2>
      {top.length ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {top.map((p, i) => (
            <Link
              key={p.id}
              to={`/sports/nhl/player/${p.id}`}
              className="bg-panel group relative overflow-hidden rounded-xl border border-white/[0.08] p-3 text-center transition hover:border-accent/40"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-20"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent}45, transparent 70%)` }}
              />
              <p className="relative text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                {i === 0 ? "Points leader" : `No. ${i + 1}`}
              </p>
              <img
                src={nhlHeadshot(p.id)}
                alt=""
                className="relative mx-auto mt-2 h-16 w-16 rounded-full bg-[#dfe6f2] object-cover object-top sm:h-20 sm:w-20"
                style={{ boxShadow: `0 0 0 2px ${accent}` }}
                loading="lazy"
              />
              <p className="text-cream relative mt-2 truncate text-[13px] font-semibold group-hover:underline">
                {p.name}
              </p>
              <p className="relative mt-1.5 flex items-baseline justify-center gap-2.5">
                <span>
                  <span className="font-display text-cream text-[22px] tabular-nums">{p.stats[2]}</span>
                  <span className="ml-0.5 text-[9px] font-semibold uppercase" style={{ color: accent }}>
                    PTS
                  </span>
                </span>
                <span className="numeral text-chalk-dim text-[11px]">
                  {p.stats[0]}G {p.stats[1]}A
                </span>
              </p>
            </Link>
          ))}
        </div>
      ) : null}
      {team.playerTables.map((table) => (
        <div key={table.name} className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">{table.name}</h3>
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
  );
}
