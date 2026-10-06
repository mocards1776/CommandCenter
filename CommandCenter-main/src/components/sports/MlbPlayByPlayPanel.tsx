import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import MlbBaseDiamond from "@/components/sports/MlbBaseDiamond";
import MlbHeatGrid from "@/components/sports/MlbHeatGrid";
import PlayerHeadshot from "@/components/sports/PlayerHeadshot";
import {
  batterGameLine,
  fetchMlbBatterHeatZones,
  fetchMlbPlayByPlay,
  heatZoneGrid,
  pitchCallShort,
  pitchChipKind,
  pitchTypeLabel,
  playHeadline,
  resolvePbpView,
  shouldRenderPbpFieldMap,
  type MlbPbpPitch,
  type MlbPbpPlay,
  type MlbPbpRunner,
  type MlbPbpState,
  type MlbPbpView,
} from "@/lib/mlb-pbp";
import { mlbTeamLogo, type MlbBoxscore } from "@/lib/mlb";
import { cn } from "@/lib/utils";

function CountDots({
  label,
  filled,
  total,
  hot,
}: {
  label: string;
  filled: number;
  total: number;
  hot?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold tracking-[0.16em] text-white/45">{label}</span>
      <span className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const on = i < filled;
          return (
            <span
              key={i}
              className={cn(
                "inline-block h-[7px] w-[7px] rounded-full",
                on
                  ? cn(hot ? "bg-[#ff4d55]" : "bg-white/90", "mlb-pbp-chip-in")
                  : "bg-transparent shadow-[inset_0_0_0_1.2px_rgba(255,255,255,0.28)]",
              )}
            />
          );
        })}
      </span>
    </div>
  );
}

function OnBaseRow({ runners }: { runners: MlbPbpRunner[] }) {
  const at = (n: 1 | 2 | 3) => runners.find((r) => r.base === n);
  const names = ([1, 2, 3] as const)
    .map((n) => {
      const r = at(n);
      return r ? `${n}B: ${r.shortName}` : null;
    })
    .filter((bit): bit is string => Boolean(bit));
  return (
    <div className="flex items-center gap-3 border-t border-white/[0.06] px-3 py-3 sm:px-4">
      <MlbBaseDiamond
        onFirst={Boolean(at(1))}
        onSecond={Boolean(at(2))}
        onThird={Boolean(at(3))}
        className="mx-0 shrink-0"
      />
      <p className="min-w-0 text-[12px] leading-snug text-white/75">
        <span className="mr-2 text-[10px] font-semibold tracking-[0.14em] text-white/40">
          ON BASE
        </span>
        {names.length ? names.join(" · ") : null}
      </p>
    </div>
  );
}

function PlayResultLabel({ play }: { play: MlbPbpPlay | null }) {
  const event = play?.event?.trim();
  if (!event && !play?.description) return null;
  return (
    <div className="px-4 py-5 text-center">
      {event ? (
        <p className="text-[18px] font-semibold tracking-tight text-white">{event}</p>
      ) : null}
      {play?.description ? (
        <p className="mt-1.5 text-[13px] leading-snug text-white/55">{play.description}</p>
      ) : null}
    </div>
  );
}

function PitchChips({ pitches }: { pitches: MlbPbpPitch[] }) {
  if (!pitches.length) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="h-8 w-8 rounded-full bg-white/10" aria-hidden />
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-white/40">NO PITCHES</p>
          <p className="text-[11px] text-white/25">—</p>
        </div>
      </div>
    );
  }
  const shown = [...pitches].reverse();
  return (
    <div className="flex gap-3 overflow-x-auto px-3 py-3 sm:px-4">
      {shown.map((p, i) => {
        const kind = pitchChipKind(p.call);
        const ring =
          kind === "ball"
            ? "bg-[#3b82f6] text-white"
            : kind === "inplay"
              ? "bg-[#22c55e] text-[#082014]"
              : kind === "strike"
                ? "bg-[#ef4444] text-white"
                : "bg-white/20 text-white";
        return (
          <div
            key={p.number}
            className="mlb-pbp-chip-in flex min-w-[6.5rem] items-center gap-2.5"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold tabular-nums",
                ring,
              )}
            >
              {p.number}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold tracking-[0.08em] text-white/80">
                {pitchCallShort(p)}
              </p>
              <p className="truncate text-[10px] tracking-[0.08em] text-white/40">
                {pitchTypeLabel(p)}
                {p.speed != null ? ` · ${Math.round(p.speed)} MPH` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniLinescore({ state }: { state: MlbPbpState }) {
  const innings = state.innings.length ? state.innings : [];
  if (!innings.length) return null;
  const cell = "numeral px-1.5 py-1.5 text-[11px] text-white/75";
  return (
    <div className="overflow-x-auto border-t border-white/[0.06]">
      <p className="px-4 pt-3 text-[12px] font-medium text-white/55">Scoring Summary</p>
      <table className="mt-1 w-full min-w-[20rem] text-center">
        <thead>
          <tr className="text-[10px] text-white/35">
            <th className="px-3 py-1 text-left font-medium"> </th>
            {innings.map((i) => (
              <th key={i.num} className="numeral px-1.5 py-1 font-medium">
                {i.num}
              </th>
            ))}
            <th className="numeral px-1.5 py-1 font-semibold text-white/55">R</th>
            <th className="numeral px-1.5 py-1 font-medium">H</th>
            <th className="numeral px-1.5 py-1 font-medium">E</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["away", state.away],
              ["home", state.home],
            ] as const
          ).map(([which, side]) => (
            <tr key={which} className="border-t border-white/[0.05]">
              <td className="px-3 py-1.5 text-left">
                <span className="inline-flex items-center gap-2">
                  <img
                    src={mlbTeamLogo(side.teamId)}
                    alt=""
                    className="h-4 w-4 object-contain drop-shadow-[0_0_1px_rgba(255,255,255,0.85)]"
                  />
                  <span className="text-[12px] font-semibold tracking-wide text-white/85">
                    {side.abbrev}
                  </span>
                </span>
              </td>
              {innings.map((i) => (
                <td key={i.num} className={cell}>
                  {i[which] ?? "—"}
                </td>
              ))}
              <td className="numeral px-1.5 py-1.5 text-[11px] font-semibold text-white">
                {side.runs}
              </td>
              <td className={cell}>{side.hits}</td>
              <td className={cell}>{side.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayHero({
  play,
  view,
  gameLine,
  teamId,
}: {
  play: MlbPbpPlay | null;
  view: MlbPbpView;
  gameLine: string | null;
  teamId: number | null;
}) {
  const batter = play?.batter;
  const title = playHeadline(play, view);
  const sub =
    view === "batter"
      ? gameLine
      : play?.description || null;
  return (
    <div className="relative overflow-hidden px-3 py-3.5 sm:px-4">
      {teamId ? (
        <img
          src={mlbTeamLogo(teamId)}
          alt=""
          className="pointer-events-none absolute -top-6 -right-4 h-36 w-36 object-contain opacity-[0.16] drop-shadow-[0_0_1px_rgba(255,255,255,0.9)]"
        />
      ) : null}
      <div className="relative flex items-center gap-3">
        {batter ? (
          <Link to={`/sports/mlb/player/${batter.id}`} className="shrink-0">
            <PlayerHeadshot
              playerId={batter.id}
              size={213}
              className="h-12 w-12 rounded-full object-cover ring-1 ring-white/15"
              alt=""
            />
          </Link>
        ) : (
          <span className="h-12 w-12 rounded-full bg-white/10" />
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-white/45">{title}</p>
          <p className="truncate text-[20px] font-semibold tracking-tight text-white">
            {batter ? batter.shortName.toUpperCase() : "—"}
          </p>
          {sub ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/50">{sub}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Apple-esque 2D MLB play-by-play on the sports game detail page. */
export default function MlbPlayByPlayPanel({
  gamePk,
  box,
}: {
  gamePk: number | string;
  box?: MlbBoxscore | null;
}) {
  const pbp = useQuery({
    queryKey: ["mlb-pbp-live", String(gamePk)],
    queryFn: () => fetchMlbPlayByPlay(gamePk),
    enabled: Boolean(gamePk),
    staleTime: 6_000,
    refetchInterval: (q) => (q.state.data?.live ? 8_000 : false),
  });

  const state = pbp.data ?? null;
  const [prefer, setPrefer] = useState<MlbPbpView | null>(null);
  const currentKey = `${state?.current?.atBatIndex ?? ""}-${state?.lastComplete?.atBatIndex ?? ""}`;

  useEffect(() => {
    setPrefer(null);
  }, [currentKey]);

  const view = resolvePbpView(state, prefer);
  const focus = view === "play" ? state?.lastComplete ?? state?.current : state?.current;
  const batterId = focus?.batter?.id ?? state?.current?.batter?.id ?? null;

  const zones = useQuery({
    queryKey: ["mlb-pbp-heat", batterId],
    queryFn: () => fetchMlbBatterHeatZones(batterId!),
    enabled: Boolean(batterId) && view === "batter",
    staleTime: 10 * 60_000,
  });

  const grid = useMemo(() => heatZoneGrid(zones.data), [zones.data]);
  const allBatters = useMemo(
    () => [...(box?.away.batters ?? []), ...(box?.home.batters ?? [])],
    [box],
  );
  const gameLine = batterGameLine(allBatters, batterId);

  if (pbp.isPending) {
    return (
      <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#05070c] px-4 py-8 text-center text-[12px] text-white/40">
        Loading play-by-play…
      </section>
    );
  }
  if (!state || (!state.current && !state.lastComplete)) return null;
  if (box?.pregame && !state.live) return null;

  const teamId = focus?.batter?.teamId ?? state.current?.batter?.teamId ?? null;
  const showField = shouldRenderPbpFieldMap(focus ?? null);
  const canToggle = Boolean(state.current && state.lastComplete);

  return (
    <section
      className="mlb-pbp-card-in overflow-hidden rounded-xl border border-white/[0.1] bg-[#05070c] shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
      aria-label="MLB play by play"
    >
      <PlayHero play={focus ?? null} view={view} gameLine={gameLine} teamId={teamId} />

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-1 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <CountDots label="BALLS" filled={state.balls} total={4} />
          <CountDots label="STRIKES" filled={state.strikes} total={3} />
          <CountDots label="OUTS" filled={state.outs} total={3} hot />
        </div>
        {canToggle ? (
          <div className="flex rounded-full bg-white/[0.06] p-0.5 text-[10px] font-semibold tracking-[0.12em]">
            <button
              type="button"
              onClick={() => setPrefer("batter")}
              className={cn(
                "rounded-full px-2.5 py-1",
                view === "batter" ? "bg-white/15 text-white" : "text-white/40",
              )}
            >
              AT BAT
            </button>
            <button
              type="button"
              onClick={() => setPrefer("play")}
              className={cn(
                "rounded-full px-2.5 py-1",
                view === "play" ? "bg-white/15 text-white" : "text-white/40",
              )}
            >
              LAST PLAY
            </button>
          </div>
        ) : null}
      </div>

      <div key={`${view}-${focus?.atBatIndex ?? "x"}`} className="mlb-pbp-card-in">
        {view === "batter" ? (
          <div className="flex justify-center px-3 py-3">
            <MlbHeatGrid
              batterId={batterId}
              cells={grid}
              pending={zones.isPending && !zones.data}
            />
          </div>
        ) : showField ? null : (
          <PlayResultLabel play={focus ?? null} />
        )}
      </div>

      {view === "batter" ? <OnBaseRow runners={state.runners} /> : null}

      <div className="border-t border-white/[0.06]">
        <PitchChips pitches={focus?.pitches ?? []} />
      </div>

      <MiniLinescore state={state} />
    </section>
  );
}
