import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PlayerHeadshot from "@/components/sports/PlayerHeadshot";
import {
  batterGameLine,
  clampFieldPoint,
  fetchMlbBatterHeatZones,
  fetchMlbPlayByPlay,
  FIELD_HOME,
  FIELD_VB,
  flightArcHeight,
  flightPathD,
  heatZoneGrid,
  mapSprayToField,
  pitchChipKind,
  pitchTypeLabel,
  playHeadline,
  resolvePbpView,
  type MlbHeatTemp,
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

function heatFill(temp: MlbHeatTemp): { bg: string; fg: string } {
  if (temp === "hot") return { bg: "#d32f2f", fg: "#fff" };
  if (temp === "warm") return { bg: "#e08a90", fg: "#1a1220" };
  if (temp === "cold") return { bg: "#1e62d0", fg: "#fff" };
  if (temp === "cool") return { bg: "#7ea6e8", fg: "#102038" };
  return { bg: "#eceef4", fg: "#1a1d27" };
}

function BatterSilhouette({ side }: { side: "L" | "R" | "S" | null }) {
  const flip = side === "L";
  return (
    <svg
      viewBox="0 0 80 140"
      className={cn(
        "pointer-events-none absolute bottom-0 h-[92%] w-auto text-white/70",
        flip ? "right-[4%] -scale-x-100" : "left-[2%]",
      )}
      aria-hidden
    >
      <g fill="currentColor">
        <circle cx="36" cy="16" r="10" />
        <path d="M28 28c-6 4-10 16-9 28l6 4 3-14 8 16 10-2-7-18c3-8 4-16-1-20-3-2-7-2-10 0z" />
        <path d="M32 58 28 98l10 2 6-28 8 36h10l-10-48-8-4z" />
        <path d="M26 98h12l2 28H28z" />
        <path d="M48 104h11l3 22h-10z" />
        <rect x="54" y="8" width="3.2" height="62" rx="1.4" transform="rotate(18 56 40)" />
      </g>
    </svg>
  );
}

function HeatGrid({
  batterId,
  batSide,
  cells,
  pending,
}: {
  batterId: number | null;
  batSide: "L" | "R" | "S" | null;
  cells: ReturnType<typeof heatZoneGrid>;
  pending: boolean;
}) {
  return (
    <div className="relative mx-auto flex h-[220px] w-full max-w-[22rem] items-end justify-center sm:h-[240px]">
      <BatterSilhouette side={batSide} />
      <div
        key={batterId ?? "none"}
        className="relative z-[1] mb-7 grid grid-cols-3 gap-[3px] rounded-sm p-[3px]"
        role="img"
        aria-label="Batter strike-zone heat"
      >
        {cells.map((cell, i) => {
          const { bg, fg } = heatFill(cell.temp);
          return (
            <div
              key={cell.zone}
              className="mlb-pbp-cell-in flex h-[2.15rem] w-[2.55rem] items-center justify-center text-[11px] font-semibold tabular-nums sm:h-9 sm:w-[2.75rem] sm:text-[12px]"
              style={{
                background: pending ? "rgba(255,255,255,0.08)" : bg,
                color: pending ? "rgba(255,255,255,0.35)" : fg,
                animationDelay: `${80 + i * 45}ms`,
              }}
            >
              {pending ? "—" : cell.value}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OnBaseRow({ runners }: { runners: MlbPbpRunner[] }) {
  const at = (n: 1 | 2 | 3) => runners.find((r) => r.base === n);
  const bag = (on: boolean) =>
    on ? "bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.35)]" : "bg-white/15";
  const label = (n: 1 | 2 | 3) => {
    const r = at(n);
    return r ? `${n}B: ${r.shortName}` : `${n}B: empty`;
  };
  return (
    <div className="flex items-center gap-3 border-t border-white/[0.06] px-3 py-2.5 sm:px-4">
      <div className="relative h-8 w-8 shrink-0" aria-hidden>
        <span className={cn("absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45", bag(Boolean(at(2))))} />
        <span className={cn("absolute top-1/2 left-0 h-2 w-2 -translate-y-1/2 rotate-45", bag(Boolean(at(3))))} />
        <span className={cn("absolute top-1/2 right-0 h-2 w-2 -translate-y-1/2 rotate-45", bag(Boolean(at(1))))} />
      </div>
      <p className="min-w-0 text-[11px] leading-snug text-white/70">
        <span className="mr-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/40">ON BASE</span>
        {label(1)}
        <span className="mx-1.5 text-white/20">·</span>
        {label(2)}
        <span className="mx-1.5 text-white/20">·</span>
        {label(3)}
      </p>
    </div>
  );
}

function FieldDiamond({
  play,
}: {
  play: MlbPbpPlay | null;
}) {
  const landing = play?.hit
    ? clampFieldPoint(mapSprayToField(play.hit.coordX, play.hit.coordY))
    : null;
  const arc = flightArcHeight(play?.hit ?? null);
  const d = landing ? flightPathD(FIELD_HOME, landing, arc) : null;
  const flyKey = `${play?.atBatIndex ?? "x"}-${landing?.x.toFixed(1) ?? ""}-${landing?.y.toFixed(1) ?? ""}`;

  return (
    <svg
      viewBox={`0 0 ${FIELD_VB.w} ${FIELD_VB.h}`}
      className="mx-auto block h-auto w-full max-w-[22rem]"
      role="img"
      aria-label={play?.event ? `${play.event} trajectory` : "Baseball field"}
    >
      <defs>
        <linearGradient id="mlbPbpGrass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4caf62" />
          <stop offset="55%" stopColor="#3d9a52" />
          <stop offset="100%" stopColor="#2f7d42" />
        </linearGradient>
        <radialGradient id="mlbPbpDirt" cx="50%" cy="62%" r="42%">
          <stop offset="0%" stopColor="#c4a06a" />
          <stop offset="100%" stopColor="#a07c4a" />
        </radialGradient>
      </defs>
      <path
        d="M160 272 L274 168 L252 48 L160 16 L68 48 L46 168 Z"
        fill="url(#mlbPbpGrass)"
      />
      <path
        d="M160 258 L228 178 L160 112 L92 178 Z"
        fill="url(#mlbPbpDirt)"
        opacity="0.92"
      />
      <path
        d="M160 236 L204 178 L160 132 L116 178 Z"
        fill="#3f9a51"
      />
      <ellipse cx="160" cy="196" rx="11" ry="8" fill="#b89158" />
      <path
        d="M160 258 L228 178 M160 258 L92 178 M228 178 L160 112 L92 178"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.2"
      />
      {[
        [228, 178],
        [160, 112],
        [92, 178],
      ].map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x - 4}
          y={y - 4}
          width="8"
          height="8"
          fill="#f4f1e9"
          transform={`rotate(45 ${x} ${y})`}
        />
      ))}
      <path
        d="M154 262h12l6 6-12 7-12-7z"
        fill="#f4f1e9"
      />
      {d ? (
        <path
          key={flyKey}
          className="mlb-pbp-fly"
          d={d}
          fill="none"
          stroke="#111"
          strokeWidth="1.7"
          pathLength={1}
        />
      ) : null}
      {landing ? (
        <g key={`land-${flyKey}`} transform={`translate(${landing.x} ${landing.y})`}>
          <rect
            className="mlb-pbp-land"
            x={-4.5}
            y={-4.5}
            width="9"
            height="9"
            fill="#3b82f6"
            stroke="#0b1220"
            strokeWidth="0.8"
          />
        </g>
      ) : null}
    </svg>
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
                {kind === "inplay" ? "IN PLAY" : p.callLabel.toUpperCase()}
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
          <HeatGrid
            batterId={batterId}
            batSide={focus?.batSide ?? null}
            cells={grid}
            pending={zones.isPending && !zones.data}
          />
        ) : (
          <div className="px-2 pb-1 pt-1">
            <FieldDiamond play={focus ?? null} />
          </div>
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
