import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import LiveSituationStrip from "@/components/sports/LiveSituationStrip";
import TeamMark from "@/components/sports/TeamMark";
import {
  fetchPitcherSeasonLines,
  mlbHeadshot,
  teamPagePath,
  type MlbPitcherSeasonLine,
  type MlbScoreGame,
} from "@/lib/mlb";
import { cn } from "@/lib/utils";

export default function HeroGameCard({
  game,
  accent = "#d9515c",
  label = "Featured game",
}: {
  game: MlbScoreGame;
  accent?: string;
  label?: string;
}) {
  const navigate = useNavigate();
  const pregame = !game.final && !game.live;
  const pitcherIds = [game.away.probablePitcherId, game.home.probablePitcherId].filter(
    (id): id is number => id != null,
  );

  const pitcherLines = useQuery({
    queryKey: ["hero-pitcher-lines", game.id, pitcherIds.join(",")],
    queryFn: () => fetchPitcherSeasonLines(pitcherIds),
    enabled: pregame && pitcherIds.length > 0,
    staleTime: 120_000,
  });

  const awayLine = game.away.probablePitcherId
    ? pitcherLines.data?.get(game.away.probablePitcherId) ?? null
    : null;
  const homeLine = game.home.probablePitcherId
    ? pitcherLines.data?.get(game.home.probablePitcherId) ?? null
    : null;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/sports/mlb/game/${game.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/sports/mlb/game/${game.id}`);
        }
      }}
      className="group relative block cursor-pointer overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
    >
      <div className="absolute inset-0 bg-[#07101d]" />
      <div
        className="absolute inset-y-0 left-0 w-[55%] opacity-90"
        style={{
          background: `radial-gradient(ellipse at 18% 40%, #${game.away.primaryColor}99, transparent 62%)`,
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-[55%] opacity-90"
        style={{
          background: `radial-gradient(ellipse at 82% 40%, #${game.home.primaryColor}99, transparent 62%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><circle cx=%221%22 cy=%221%22 r=%221%22 fill=%22rgba(255,255,255,0.04)%22/></svg>')] opacity-60" />

      <div className="relative z-10 p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/55">
            {label}
          </p>
          <span
            className={cn(
              "rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
              game.live ? "bg-alert text-ink" : "bg-white/10 text-cream",
            )}
          >
            {game.live ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ink" />
                {game.inning || "Live"}
              </span>
            ) : game.final ? (
              "Final"
            ) : (
              "Preview"
            )}
          </span>
        </div>

        {pregame ? (
          <PregameLayout
            game={game}
            accent={accent}
            awayLine={awayLine}
            homeLine={homeLine}
          />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
              <HeroSide side={game.away} align="left" />
              <div className="text-center">
                <p className="font-display text-cream text-[40px] leading-none tabular-nums sm:text-[52px]">
                  {game.away.score ?? "–"}
                  <span className="mx-2 text-[22px] text-white/35 sm:mx-3">:</span>
                  {game.home.score ?? "–"}
                </p>
                {(game.away.hits != null || game.home.hits != null) && (
                  <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-white/45">
                    H {game.away.hits ?? "–"}–{game.home.hits ?? "–"}
                    {game.away.errors != null
                      ? ` · E ${game.away.errors}–${game.home.errors ?? 0}`
                      : ""}
                  </p>
                )}
              </div>
              <HeroSide side={game.home} align="right" />
            </div>

            {game.live && game.situation ? (
              <div className="mt-5 border-t border-white/10 pt-4">
                <LiveSituationStrip game={game} linkPlayers />
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4">
              <div className="min-w-0 text-[12px] text-white/55">
                {game.venue && <p className="truncate">{game.venue}</p>}
                {game.when && <p className="mt-0.5">{game.when}</p>}
              </div>
              <span
                className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream transition group-hover:translate-x-0.5"
                style={{ color: accent }}
              >
                Box & highlights →
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PregameLayout({
  game,
  accent,
  awayLine,
  homeLine,
}: {
  game: MlbScoreGame;
  accent: string;
  awayLine: MlbPitcherSeasonLine | null;
  homeLine: MlbPitcherSeasonLine | null;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <HeroSide side={game.away} align="left" />
        <div className="px-1 text-center">
          <p className="font-display text-cream text-[42px] leading-none tracking-tight sm:text-[56px]">
            {game.whenShort ?? "TBD"}
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            First pitch
          </p>
        </div>
        <HeroSide side={game.home} align="right" />
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-4 sm:px-5">
        <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
          Probable pitchers
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-4">
          <PitcherStack side={game.away} align="left" line={awayLine} />
          <span className="pb-6 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/35">
            vs
          </span>
          <PitcherStack side={game.home} align="right" line={homeLine} />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4">
        <div className="min-w-0 text-[12px] text-white/55">
          {game.venue && <p className="truncate">{game.venue}</p>}
          {game.when && <p className="mt-0.5">{game.when}</p>}
        </div>
        <span
          className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] transition group-hover:translate-x-0.5"
          style={{ color: accent }}
        >
          Preview →
        </span>
      </div>
    </div>
  );
}

function PitcherStack({
  side,
  align,
  line,
}: {
  side: MlbScoreGame["away"];
  align: "left" | "right";
  line: MlbPitcherSeasonLine | null;
}) {
  const name = side.probablePitcher ?? "TBD";
  const parts = name.split(" ");
  const last = parts.length > 1 ? parts[parts.length - 1] : name;
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const playerHref = side.probablePitcherId
    ? `/sports/mlb/player/${side.probablePitcherId}`
    : null;

  const body = (
    <>
      {side.probablePitcherId ? (
        <div className="relative h-[88px] w-[72px] overflow-hidden rounded-xl bg-[#dfe6f2] ring-2 ring-white/25 transition group-hover/pitcher:ring-white/45 sm:h-[104px] sm:w-[84px]">
          <img
            src={mlbHeadshot(side.probablePitcherId, 426)}
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.12] object-cover object-[center_12%]"
          />
        </div>
      ) : (
        <div className="grid h-[88px] w-[72px] place-items-center rounded-xl bg-white/10 text-[11px] text-white/40 sm:h-[104px] sm:w-[84px]">
          TBD
        </div>
      )}
      {first && (
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/55">{first}</p>
      )}
      <p className="font-display text-cream text-[22px] leading-none sm:text-[26px]">{last}</p>
      {line ? (
        <p className="numeral text-[11px] text-white/65">
          {line.wins}-{line.losses} · {line.era} ERA · {line.whip} WHIP
        </p>
      ) : null}
    </>
  );

  const stackClass = cn(
    "flex min-w-0 flex-col gap-2",
    align === "right" ? "items-end text-right" : "items-start text-left",
  );

  if (!playerHref) {
    return <div className={stackClass}>{body}</div>;
  }

  return (
    <Link
      to={playerHref}
      onClick={(e) => e.stopPropagation()}
      className={cn(stackClass, "group/pitcher transition hover:opacity-95")}
    >
      {body}
    </Link>
  );
}

function HeroSide({
  side,
  align,
}: {
  side: MlbScoreGame["away"];
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2.5",
        align === "right" && "sm:items-end",
        align === "left" && "sm:items-start",
      )}
    >
      <Link
        to={teamPagePath(side.teamId)}
        onClick={(e) => e.stopPropagation()}
        className="relative transition hover:scale-[1.03]"
      >
        <span
          className="pointer-events-none absolute -inset-4 rounded-full opacity-80 blur-2xl"
          style={{
            background: `radial-gradient(circle, #${side.primaryColor}cc, transparent 70%)`,
          }}
        />
        <TeamMark
          teamId={side.teamId}
          size="xl"
          className="relative shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
        />
      </Link>
      <div
        className={cn(
          "text-center",
          align === "right" && "sm:text-right",
          align === "left" && "sm:text-left",
        )}
      >
        <Link
          to={teamPagePath(side.teamId)}
          onClick={(e) => e.stopPropagation()}
          className="block text-[20px] font-bold tracking-wide text-white hover:underline sm:text-[24px]"
        >
          {side.abbrev}
        </Link>
        {side.record ? (
          <p className="numeral mt-1 text-[14px] font-medium text-white/75">{side.record}</p>
        ) : (
          <p className="mt-1 truncate text-[11px] text-white/45">{side.name}</p>
        )}
      </div>
    </div>
  );
}
