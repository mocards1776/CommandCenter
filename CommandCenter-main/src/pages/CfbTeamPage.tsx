import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import CfbRankLabel from "@/components/sports/CfbRankLabel";
import TeamResultBadge from "@/components/sports/TeamResultBadge";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import {
  fetchCfbGameWrap,
  fetchCfbTeamPage,
  fetchCfbTeamSeasonHistory,
  type CfbTeamPage,
  type CfbTeamScheduleGame,
  type CfbTeamWinTrendPoint,
} from "@/lib/cfb";
import {
  cfbResultsFromFinals,
  cfbRivalryName,
  cfbStreakLabel,
} from "@/lib/cfb-team-profile";
import {
  cfbInterestFloorForTeam,
  getCfbTeamInterestRating,
  loadCfbTeamInterest,
  setCfbTeamInterestRating,
} from "@/lib/ruwt";
import { cn, formatSportsDate } from "@/lib/utils";

type TeamTab = "schedule" | "coaches" | "roster";

export default function CfbTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));
  const [tab, setTab] = useState<TeamTab>("schedule");

  const team = useQuery({
    queryKey: ["cfb-team-v5", teamId],
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
          <SeasonLeaders team={t} />

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
                <CfbWinTrendChart
                  teamId={t.id}
                  teamAbbrev={t.abbrev}
                  points={t.winTrend}
                  accent={accent}
                />
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

/** Tiny RUWT interest slider for a school home — same storage as Rank teams. */
function CfbRuwtInterestControl({ teamId }: { teamId: string }) {
  const floor = cfbInterestFloorForTeam(teamId);
  const [value, setValue] = useState(() => getCfbTeamInterestRating(teamId));

  return (
    <label
      className="mt-2.5 inline-flex max-w-full items-center gap-1.5 text-white/45"
      title="RUWT interest — how much this school boosts Are You Watching This"
    >
      <span className="shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.16em]">
        RUWT
      </span>
      <input
        type="range"
        min={floor}
        max={10}
        step={1}
        value={value}
        aria-label="RUWT interest rating"
        onChange={(e) => {
          const next = Number(e.target.value);
          const saved = setCfbTeamInterestRating(loadCfbTeamInterest(), Number(teamId), next);
          setValue(saved[String(teamId)] ?? floor);
        }}
        className="h-1 w-[4.5rem] cursor-pointer appearance-none rounded-full bg-white/20 accent-white/70 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/80"
      />
      <span className="numeral w-3.5 shrink-0 text-right text-[10px] tabular-nums text-white/55">
        {value}
      </span>
    </label>
  );
}

function nextUpGame(team: CfbTeamPage): CfbTeamScheduleGame | null {
  return team.schedule.find((g) => g.live) ?? team.schedule.find((g) => !g.final) ?? null;
}

function TeamHero({ team, accent }: { team: CfbTeamPage; accent: string }) {
  const next = nextUpGame(team);
  const marks = cfbResultsFromFinals(team.schedule);
  const streak = cfbStreakLabel(marks);
  const form = marks.slice(-5);
  const stats = team.seasonStats;
  const tiles = [
    stats.ppg ? { label: "PPG", value: stats.ppg } : null,
    stats.oppPpg ? { label: "Allowed", value: stats.oppPpg } : null,
    stats.ypg ? { label: "Yds/G", value: stats.ypg } : null,
    stats.oppYpg ? { label: "Yds allwd", value: stats.oppYpg } : null,
  ].filter((tile): tile is { label: string; value: string } => Boolean(tile));

  return (
    <article
      className="relative overflow-hidden border-y border-white/[0.08] md:rounded-2xl md:border"
      style={{
        background: `linear-gradient(145deg, #07101f 0%, ${accent}88 38%, #0a1428 78%)`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-[#07101f]/25 to-transparent" />
      {team.logo ? (
        <img
          src={team.logo}
          alt=""
          className="pointer-events-none absolute -right-6 -top-8 h-48 w-48 object-contain opacity-[0.12] sm:h-64 sm:w-64"
        />
      ) : null}
      <div className="h-1 w-full" style={{ background: accent }} />
      <div className="relative z-10 grid gap-5 px-4 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_18.5rem] lg:items-stretch">
        <div className="flex items-end gap-4 sm:gap-6">
          {team.logo ? (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white p-2.5 shadow-2xl sm:h-28 sm:w-28">
              <img src={team.logo} alt="" className="h-full w-full object-contain" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              {[team.conference, team.standing].filter(Boolean).join(" · ") || "College football"}
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
            <div className="mt-3 flex flex-wrap gap-1.5">
              {team.rank != null ? <RankChip label={`AP #${team.rank}`} tone="ap" /> : null}
              {team.cfpRank != null ? <RankChip label={`CFP #${team.cfpRank}`} tone="cfp" /> : null}
              {team.sosRank != null ? <RankChip label={`SOS #${team.sosRank}`} tone="sos" /> : null}
              {team.fpiRank != null ? <RankChip label={`FPI #${team.fpiRank}`} tone="sos" /> : null}
              {streak ? (
                <RankChip label={streak} tone={streak.startsWith("W") ? "win" : "loss"} />
              ) : null}
            </div>
            <CfbRuwtInterestControl teamId={team.id} />
          </div>
        </div>
        {next ? <NextUpCard team={team} game={next} accent={accent} /> : null}
      </div>
      {tiles.length > 0 || form.length > 0 ? (
        <div className="relative z-10 grid grid-cols-2 gap-2 px-4 pb-5 sm:grid-cols-5 sm:px-7">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 backdrop-blur-sm"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">
                {tile.label}
              </p>
              <p className="numeral mt-1 text-[20px] leading-none text-white">{tile.value}</p>
            </div>
          ))}
          {form.length > 0 ? (
            <div className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 backdrop-blur-sm">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Form
              </p>
              <div className="mt-1.5 flex gap-1">
                {form.map((mark, i) => (
                  <span
                    key={`${mark}-${i}`}
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded text-[10px] font-bold",
                      mark === "W"
                        ? "bg-emerald-400/20 text-emerald-300"
                        : mark === "L"
                          ? "bg-red-400/20 text-red-300"
                          : "bg-white/10 text-white/70",
                    )}
                  >
                    {mark}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function RankChip({
  label,
  tone,
}: {
  label: string;
  tone: "ap" | "cfp" | "sos" | "win" | "loss";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ring-1",
        tone === "ap" && "bg-white/15 text-white ring-white/25",
        tone === "cfp" && "bg-amber-300/15 text-amber-100 ring-amber-200/40",
        tone === "sos" && "bg-black/30 text-white/80 ring-white/15",
        tone === "win" && "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30",
        tone === "loss" && "bg-red-400/15 text-red-200 ring-red-300/30",
      )}
    >
      {label}
    </span>
  );
}

function NextUpCard({
  team,
  game,
  accent,
}: {
  team: CfbTeamPage;
  game: CfbTeamScheduleGame;
  accent: string;
}) {
  const when = game.live
    ? game.shortDetail || "Live"
    : game.shortDetail || (game.date ? formatSportsDate(game.date) : "TBD");
  return (
    <Link
      to={`/sports/cfb/game/${game.id}`}
      className="flex flex-col justify-between rounded-xl border border-white/15 bg-black/35 p-3.5 shadow-lg backdrop-blur-sm transition hover:bg-black/45"
      style={{ boxShadow: `0 12px 40px ${accent}33` }}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.16em]",
          game.live ? "text-red-300" : "text-white/55",
        )}
      >
        {game.live ? "Live now" : "Next up"}
      </p>
      <div className="mt-2 flex items-center gap-2.5">
        {game.oppLogo ? (
          <img src={game.oppLogo} alt="" className="h-10 w-10 object-contain" />
        ) : null}
        <div className="min-w-0">
          <p className="text-cream truncate text-[15px] font-semibold">
            <span className="mr-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white/50">
              {game.home ? "vs" : "@"}
            </span>
            <CfbRankLabel pollRank={game.oppRank} fpiRank={null} />
            {game.oppName}
          </p>
          <p className="mt-0.5 text-[12px] text-white/65">{when}</p>
        </div>
      </div>
      {game.live && game.teamScore != null && game.oppScore != null ? (
        <p className="numeral mt-3 text-[18px] leading-none text-white">
          {team.abbrev} {game.teamScore}
          <span className="mx-1 text-white/35">–</span>
          {game.oppScore} {game.oppAbbrev}
        </p>
      ) : (
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {game.date ? formatSportsDate(game.date) : "Date TBD"}
        </p>
      )}
    </Link>
  );
}

function SeasonLeaders({ team }: { team: CfbTeamPage }) {
  if (team.leaders.length === 0) return null;
  return (
    <section className="px-4 pt-4 md:px-0">
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
        Season leaders
      </h2>
      <ul className="grid gap-2 sm:grid-cols-3">
        {team.leaders.map((leader) => {
          const inner = (
            <>
              {leader.headshot ? (
                <img
                  src={leader.headshot}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full bg-[#dfe6f2] object-cover object-top"
                />
              ) : (
                <span className="h-12 w-12 shrink-0 rounded-full bg-white/10" />
              )}
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                  {leader.label}
                  {leader.position ? ` · ${leader.position}` : ""}
                </span>
                <span className="text-cream block truncate text-[14px] font-semibold">
                  {leader.name}
                </span>
                <span className="numeral mt-0.5 block truncate text-[12px] text-white/70">
                  {leader.line}
                </span>
              </span>
            </>
          );
          return (
            <li key={leader.key}>
              {leader.athleteId ? (
                <Link
                  to={`/sports/cfb/player/${leader.athleteId}`}
                  className="bg-panel hover:border-accent/40 flex items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5 transition"
                >
                  {inner}
                </Link>
              ) : (
                <div className="bg-panel flex items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SchedulePanel({ team }: { team: CfbTeamPage }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = useMemo(() => {
    const byWeek = new Map<string, CfbTeamScheduleGame[]>();
    for (const g of team.schedule) {
      const key = g.bowl
        ? g.bowlName || g.weekLabel || "Bowl"
        : g.weekLabel ||
          (g.week != null ? `Week ${g.week}` : g.final ? "Final" : g.live ? "Live" : "Upcoming");
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
              <ScheduleRow
                key={g.id}
                game={g}
                team={team}
                open={openId === g.id}
                onToggle={() => setOpenId((prev) => (prev === g.id ? null : g.id))}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ScheduleRow({
  game,
  team,
  open,
  onToggle,
}: {
  game: CfbTeamScheduleGame;
  team: CfbTeamPage;
  open: boolean;
  onToggle: () => void;
}) {
  const result = game.final ? (game.won === true ? "W" : game.won === false ? "L" : "T") : null;
  const rivalry = cfbRivalryName(team.id, game.oppId);
  const wrap = useQuery({
    queryKey: ["cfb-game-wrap", game.id, team.id],
    queryFn: () => fetchCfbGameWrap(game.id, team.id),
    enabled: game.final || game.live,
    staleTime: 5 * 60_000,
  });
  const passer = wrap.data?.leaders.find((l) => l.key === "pass");
  const rusher = wrap.data?.leaders.find((l) => l.key === "rush");

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "hover:bg-white/[0.03] grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-[3px] px-3 py-3 text-left transition",
          result === "W" && "border-emerald-400",
          result === "L" && "border-red-400",
          result === "T" && "border-amber-300",
          !result && game.live && "border-red-400",
          !result && !game.live && "border-transparent",
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {game.oppLogo ? (
              <img src={game.oppLogo} alt="" className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
            ) : (
              <span className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
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
              {rivalry || game.oppRank != null || game.bowl ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {rivalry ? <GameBadge label={rivalry} /> : null}
                  {game.oppRank != null ? <GameBadge label={`AP #${game.oppRank}`} /> : null}
                  {game.bowl ? <GameBadge label={game.bowlName || "Bowl"} /> : null}
                </div>
              ) : null}
              {(game.final || game.live) && (passer || rusher) ? (
                <p className="text-chalk mt-1 truncate text-[11px]">
                  {[shortLeader(passer, "pass"), shortLeader(rusher, "rush")].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result ? (
            <TeamResultBadge result={result} solid />
          ) : game.live ? (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-500/20 text-[9px] font-black uppercase tracking-[0.08em] text-red-300 ring-1 ring-red-400/50">
              Live
            </span>
          ) : null}
          <ScoreStack
            teamAbbrev={team.abbrev}
            oppAbbrev={game.oppAbbrev}
            teamScore={game.teamScore}
            oppScore={game.oppScore}
            showScores={game.final || game.live}
            won={game.won}
            fallback={game.shortDetail || game.dateLabel || "TBD"}
          />
          <ChevronRight
            size={14}
            className={cn("text-white/30 transition", open && "rotate-90")}
          />
        </div>
      </button>
      {open ? (
        <GameWrap
          game={game}
          team={team}
          pending={wrap.isPending && (game.final || game.live)}
          wrap={wrap.data ?? null}
        />
      ) : null}
    </li>
  );
}

function shortLeader(
  leader: { name: string; line: string } | undefined,
  kind: "pass" | "rush",
): string | null {
  if (!leader) return null;
  const cleaned = leader.name.replace(/,?\s+(Jr\.?|Sr\.?|III|II|IV)$/i, "").trim();
  const last = cleaned.split(/\s+/).slice(-1)[0] ?? cleaned;
  const yds = leader.line.match(/([\d,.]+)\s*YDS/i)?.[1];
  return `${last} ${yds ? `${yds} ${kind} yds` : leader.line}`;
}

function GameBadge({ label }: { label: string }) {
  return (
    <span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-100 ring-1 ring-amber-200/30">
      {label}
    </span>
  );
}

function ScoreStack({
  teamAbbrev,
  oppAbbrev,
  teamScore,
  oppScore,
  showScores,
  won,
  fallback,
}: {
  teamAbbrev: string;
  oppAbbrev: string;
  teamScore: number | null;
  oppScore: number | null;
  showScores: boolean;
  won: boolean | null;
  fallback: string;
}) {
  if (!showScores) {
    return (
      <p className="text-cream max-w-[7.5rem] text-right text-[12px] font-medium leading-tight">
        {fallback}
      </p>
    );
  }
  const lead =
    teamScore != null && oppScore != null && teamScore !== oppScore
      ? teamScore > oppScore
      : won;
  const ours = lead === true ? "text-emerald-300" : lead === false ? "text-red-300" : "text-cream";
  return (
    <div className="text-right">
      <p className="flex items-baseline justify-end gap-1.5 leading-none">
        <span className={cn("text-[11px] font-bold uppercase tracking-[0.08em]", ours)}>
          {teamAbbrev}
        </span>
        <span className={cn("font-display text-[26px] font-black tabular-nums", ours)}>
          {teamScore ?? "—"}
        </span>
      </p>
      <p className="mt-1 flex items-baseline justify-end gap-1.5 leading-none">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">
          {oppAbbrev}
        </span>
        <span className="font-display text-[16px] font-semibold tabular-nums text-white/40">
          {oppScore ?? "—"}
        </span>
      </p>
    </div>
  );
}

function GameWrap({
  game,
  team,
  pending,
  wrap,
}: {
  game: CfbTeamScheduleGame;
  team: CfbTeamPage;
  pending: boolean;
  wrap: Awaited<ReturnType<typeof fetchCfbGameWrap>> | null;
}) {
  return (
    <div className="border-t border-white/[0.05] bg-black/20 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-white">
          <span className={game.won === false ? "text-red-300" : game.won === true ? "text-emerald-300" : "text-white"}>
            {team.abbrev} {game.teamScore ?? "—"}
          </span>
          <span className="mx-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white/35">
            {game.oppAbbrev}
          </span>
          <span className="text-white/55">{game.oppScore ?? "—"}</span>
        </p>
        <Link
          to={`/sports/cfb/game/${game.id}`}
          className="text-accent text-[10.5px] font-semibold uppercase tracking-[0.14em] hover:underline"
        >
          Gamecast
        </Link>
      </div>
      {pending ? (
        <p className="text-chalk-dim mt-2 flex items-center gap-2 text-[12px]">
          <Loader2 size={13} className="animate-spin" /> Loading wrap…
        </p>
      ) : wrap && (wrap.leaders.length > 0 || wrap.plays.length > 0) ? (
        <div className="mt-2 space-y-2">
          {wrap.yards || wrap.oppYards ? (
            <p className="text-[12px] text-white/70">
              Yards {team.abbrev} {wrap.yards ?? "—"}
              <span className="mx-1 text-white/30">·</span>
              {game.oppAbbrev} {wrap.oppYards ?? "—"}
            </p>
          ) : null}
          {wrap.leaders.length > 0 ? (
            <ul className="space-y-1">
              {wrap.leaders.map((leader) => (
                <li key={leader.key} className="text-[12px] text-white/80">
                  <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b93a7]">
                    {leader.key === "pass" ? "Pass" : leader.key === "rush" ? "Rush" : "Rec"}
                  </span>
                  {leader.athleteId ? (
                    <Link to={`/sports/cfb/player/${leader.athleteId}`} className="hover:underline">
                      {leader.name}
                    </Link>
                  ) : (
                    leader.name
                  )}
                  <span className="numeral text-white/55"> · {leader.line}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {wrap.plays.length > 0 ? (
            <ul className="space-y-1 border-t border-white/[0.05] pt-2">
              {wrap.plays.map((play) => (
                <li key={play.id} className="text-[12px] leading-snug text-white/75">
                  <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8b93a7]">
                    {[play.quarter, play.clock, play.teamAbbrev].filter(Boolean).join(" ")}
                  </span>
                  {play.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-chalk-dim mt-2 text-[12px]">
          {game.final || game.live ? "No play log from ESPN yet." : game.shortDetail || "Kickoff time TBD."}
        </p>
      )}
    </div>
  );
}

function CfbWinTrendChart({
  teamId,
  teamAbbrev,
  points,
  accent,
}: {
  teamId: string;
  teamAbbrev: string;
  points: CfbTeamWinTrendPoint[];
  accent: string;
}) {
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  const history = useQuery({
    queryKey: ["cfb-team-season-history-v3", teamId, selectedSeason],
    queryFn: () => fetchCfbTeamSeasonHistory(teamId, selectedSeason!),
    enabled: selectedSeason != null,
    staleTime: 10 * 60_000,
  });

  if (!points.length) return null;
  const maxWins = Math.max(12, ...points.map((r) => r.wins));
  // Newest season first for scanning.
  const ordered = [...points].sort((a, b) => b.season - a.season);

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h3 className="text-[15px] font-semibold text-white">10-Year Win Trend</h3>
        <p className="text-chalk-dim mt-0.5 text-[11px] uppercase tracking-[0.14em]">
          Includes bowls · tap a year for games and the coach
        </p>
      </div>
      <ul className="flex flex-col gap-2.5 px-4 py-4">
        {ordered.map((r) => {
          const active = selectedSeason === r.season;
          return (
            <li key={r.season}>
              <button
                type="button"
                onClick={() =>
                  setSelectedSeason((prev) => (prev === r.season ? null : r.season))
                }
                className={cn(
                  "grid w-full grid-cols-[3rem_1fr_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left transition",
                  active ? "bg-white/[0.06] ring-1 ring-white/15" : "hover:bg-white/[0.03]",
                )}
                aria-pressed={active}
              >
                <span
                  className={cn(
                    "numeral text-[12px] font-semibold underline-offset-2",
                    active ? "text-cream underline" : "text-chalk hover:text-cream",
                  )}
                >
                  {r.season}
                </span>
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
              </button>
            </li>
          );
        })}
      </ul>

      {selectedSeason != null && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          {history.isPending ? (
            <p className="text-chalk flex items-center gap-2 text-[13px]">
              <Loader2 size={14} className="animate-spin" /> Loading {selectedSeason}…
            </p>
          ) : history.isError || !history.data ? (
            <p className="text-alert text-[13px]">
              Couldn’t load the {selectedSeason} season.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                    {selectedSeason} season
                  </p>
                  <p className="text-cream mt-1 text-[14px] font-semibold">
                    {history.data.coach ? (
                      history.data.coach.id ? (
                        <Link
                          to={`/sports/cfb/coach/${history.data.coach.id}`}
                          className="hover:underline"
                        >
                          HC {history.data.coach.name}
                        </Link>
                      ) : (
                        <>HC {history.data.coach.name}</>
                      )
                    ) : (
                      "Head coach unavailable"
                    )}
                  </p>
                </div>
                {history.data.record ? (
                  <p className="numeral text-cream text-[18px] font-semibold">
                    {history.data.record}
                  </p>
                ) : null}
              </div>

              {history.data.games.length === 0 ? (
                <p className="text-chalk-dim text-[13px]">No games for this season.</p>
              ) : (
                <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-lg border border-white/[0.06]">
                  {history.data.games.map((g) => (
                    <SeasonHistoryRow key={g.id} game={g} teamId={teamId} teamAbbrev={teamAbbrev} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SeasonHistoryRow({
  game,
  teamId,
  teamAbbrev,
}: {
  game: CfbTeamScheduleGame;
  teamId: string;
  teamAbbrev: string;
}) {
  const result = game.final ? (game.won === true ? "W" : game.won === false ? "L" : "T") : null;
  const rivalry = cfbRivalryName(teamId, game.oppId);
  return (
    <li>
      <Link
        to={`/sports/cfb/game/${game.id}`}
        className={cn(
          "hover:bg-white/[0.03] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-[3px] px-3 py-2.5 transition",
          result === "W" && "border-emerald-400",
          result === "L" && "border-red-400",
          result === "T" && "border-amber-300",
          !result && "border-transparent",
        )}
      >
        <div className="min-w-0">
          <p className="text-cream truncate text-[13px] font-medium">
            <span className="text-chalk-dim mr-1.5 text-[10px] font-medium uppercase tracking-[0.12em]">
              {game.home ? "vs" : "@"}
            </span>
            <CfbRankLabel pollRank={game.oppRank} fpiRank={null} />
            {game.oppName}
          </p>
          <p className="text-chalk-dim text-[11px]">
            {game.date ? formatSportsDate(game.date) : game.dateLabel || "Date TBD"}
            {rivalry ? ` · ${rivalry}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result ? <TeamResultBadge result={result} solid /> : null}
          <ScoreStack
            teamAbbrev={teamAbbrev}
            oppAbbrev={game.oppAbbrev}
            teamScore={game.teamScore}
            oppScore={game.oppScore}
            showScores={game.final || game.live}
            won={game.won}
            fallback={game.shortDetail || "TBD"}
          />
        </div>
      </Link>
    </li>
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

          return (
            <Link
              key={c.id}
              to={`/sports/cfb/coach/${encodeURIComponent(c.id)}`}
              className="bg-panel hover:border-accent/40 group flex items-center gap-4 rounded-xl border border-white/[0.08] p-4 transition"
            >
              {inner}
            </Link>
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
