import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PlayerHeadshot from "@/components/sports/PlayerHeadshot";
import {
  fetchMlbLiveMatchupExtras,
  type MlbBoxscore,
  type MlbLivePlayerCard,
  type MlbLiveSituation,
  type MlbPitchPlot,
} from "@/lib/mlb";
import { cn } from "@/lib/utils";

function BaseDiamond({
  onFirst,
  onSecond,
  onThird,
}: {
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
}) {
  const bag = (on: boolean) =>
    on ? "bg-cream shadow-[0_0_0_1px_rgba(255,255,255,0.35)]" : "bg-white/15";
  return (
    <div className="relative mx-auto h-9 w-9" aria-hidden>
      <span className={cn("absolute top-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45", bag(onSecond))} />
      <span className={cn("absolute top-1/2 left-0 h-2.5 w-2.5 -translate-y-1/2 rotate-45", bag(onThird))} />
      <span className={cn("absolute top-1/2 right-0 h-2.5 w-2.5 -translate-y-1/2 rotate-45", bag(onFirst))} />
    </div>
  );
}

function pitchFill(call: MlbPitchPlot["call"]): string {
  if (call === "B") return "#3b82f6";
  if (call === "S") return "#ef4444";
  if (call === "X") return "#eab308";
  return "#94a3b8";
}

/** Catcher's-view strike zone with pitch dots (pX/pZ in feet). */
function StrikeZonePlot({ pitches }: { pitches: MlbPitchPlot[] }) {
  const zoneTop = pitches[0]?.zoneTop ?? 3.5;
  const zoneBottom = pitches[0]?.zoneBottom ?? 1.5;
  const halfPlate = 0.708; // 17" plate / 2
  const padX = 1.15;
  const padY = 0.55;
  const minX = -halfPlate - padX;
  const maxX = halfPlate + padX;
  const minZ = zoneBottom - padY;
  const maxZ = zoneTop + padY;
  const vbW = 100;
  const vbH = 130;
  const toX = (pX: number) => ((pX - minX) / (maxX - minX)) * vbW;
  // Higher pZ is higher in the zone — flip for SVG y
  const toY = (pZ: number) => ((maxZ - pZ) / (maxZ - minZ)) * vbH;
  const zx1 = toX(-halfPlate);
  const zx2 = toX(halfPlate);
  const zy1 = toY(zoneTop);
  const zy2 = toY(zoneBottom);

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="mx-auto h-[7.5rem] w-[5.75rem]"
      role="img"
      aria-label="Strike zone pitch tracking"
    >
      <rect
        x={zx1}
        y={zy1}
        width={zx2 - zx1}
        height={zy2 - zy1}
        fill="rgba(255,255,255,0.04)"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1.4}
      />
      {/* 3×3 grid */}
      {[1, 2].map((i) => (
        <line
          key={`v${i}`}
          x1={zx1 + ((zx2 - zx1) * i) / 3}
          y1={zy1}
          x2={zx1 + ((zx2 - zx1) * i) / 3}
          y2={zy2}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={0.8}
        />
      ))}
      {[1, 2].map((i) => (
        <line
          key={`h${i}`}
          x1={zx1}
          y1={zy1 + ((zy2 - zy1) * i) / 3}
          x2={zx2}
          y2={zy1 + ((zy2 - zy1) * i) / 3}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={0.8}
        />
      ))}
      {pitches.map((p) => (
        <g key={p.number}>
          <circle
            cx={toX(p.pX)}
            cy={toY(p.pZ)}
            r={5.2}
            fill={pitchFill(p.call)}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={0.8}
          >
            <title>
              {[
                `#${p.number}`,
                p.pitchType,
                p.speed != null ? `${Math.round(p.speed)} mph` : null,
                p.callLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </title>
          </circle>
          <text
            x={toX(p.pX)}
            y={toY(p.pZ) + 1.6}
            textAnchor="middle"
            fill="#0b1220"
            fontSize={5.5}
            fontWeight={700}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {p.number}
          </text>
        </g>
      ))}
    </svg>
  );
}

function SideCard({
  card,
  role,
  align,
}: {
  card: MlbLivePlayerCard | null;
  role: "pitcher" | "batter";
  align: "left" | "right";
}) {
  if (!card) {
    return (
      <div className={cn("min-w-0 text-[12px] text-[#8b93a7]", align === "right" && "text-right")}>
        {role === "pitcher" ? "Pitcher TBD" : "Batter TBD"}
      </div>
    );
  }
  const posBit = card.position ? `(${card.position})` : role === "pitcher" ? "(P)" : "";
  const numBit = card.number ? `#${card.number}` : "";
  const meta = [card.teamAbbrev, card.hand].filter(Boolean).join(" · ");
  const seasonLine =
    role === "pitcher"
      ? [
          card.wins != null && card.losses != null ? `${card.wins}-${card.losses}` : null,
          card.era && card.era !== "-.--" ? `${card.era} ERA` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : [
          card.avg,
          card.hr != null ? `${card.hr} HR` : null,
          card.rbi != null ? `${card.rbi} RBI` : null,
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <Link
      to={`/sports/mlb/player/${card.id}`}
      className={cn(
        "flex min-w-0 items-start gap-2.5 transition hover:opacity-95",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <PlayerHeadshot
        playerId={card.id}
        size={213}
        className="h-14 w-14 shrink-0 rounded-full ring-1 ring-white/20"
        alt=""
      />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-cream">
          {card.shortName} {posBit}
          {numBit ? ` ${numBit}` : ""}
        </p>
        {meta ? <p className="mt-0.5 text-[11px] text-[#8b93a7]">{meta}</p> : null}
        {seasonLine ? (
          <p className="numeral mt-1 text-[11px] font-medium text-white/75">
            {role === "pitcher" ? <span className="text-[#8b93a7]">SEASON </span> : null}
            {seasonLine}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/** ESPN-style live pitcher / strike zone / batter panel with pitch tracking. */
export default function MlbLiveMatchupPanel({
  game,
  situation,
}: {
  game: MlbBoxscore;
  situation: MlbLiveSituation;
}) {
  const pitcher = situation.pitcherCard;
  const batter = situation.batterCard;
  const extras = useQuery({
    queryKey: [
      "mlb-live-matchup-extras",
      batter?.id,
      pitcher?.id,
      pitcher?.hand,
    ],
    queryFn: () =>
      fetchMlbLiveMatchupExtras(batter!.id, pitcher!.id, pitcher?.hand ?? null),
    enabled: Boolean(batter?.id && pitcher?.id),
    staleTime: 60_000,
  });

  const vsBits: string[] = [];
  if (extras.data?.vsPitcher && pitcher) {
    const v = extras.data.vsPitcher;
    vsBits.push(
      `vs ${pitcher.shortName}: ${v.hits}-${v.atBats} ${v.avg} AVG`,
    );
  }
  if (extras.data?.vsHandAvg && extras.data.vsHandLabel) {
    vsBits.push(`${extras.data.vsHandLabel} ${extras.data.vsHandAvg} AVG`);
  }

  return (
    <div className="relative z-10 border-t border-white/[0.08] bg-[#050b14]/80 px-3 py-3.5 sm:px-5">
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
        <SideCard card={pitcher} role="pitcher" align="left" />

        <div className="flex flex-col items-center gap-1.5">
          <StrikeZonePlot pitches={situation.pitches} />
          <p className="numeral text-[15px] font-semibold tracking-wide text-cream">
            {situation.balls}-{situation.strikes}
            <span className="mx-1.5 text-white/30">·</span>
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/70">
              {situation.outs} out{situation.outs === 1 ? "" : "s"}
            </span>
          </p>
          <BaseDiamond
            onFirst={situation.onFirst}
            onSecond={situation.onSecond}
            onThird={situation.onThird}
          />
          {vsBits.length > 0 ? (
            <p className="max-w-[16rem] text-center text-[10px] leading-snug text-[#8b93a7]">
              {vsBits.join(" · ")}
            </p>
          ) : null}
        </div>

        <SideCard card={batter} role="batter" align="right" />
      </div>

      {(game.venue || game.when) && (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 border-t border-white/[0.06] pt-2.5 text-center text-[10px] text-[#8b93a7]">
          {game.inning || game.status}
          {game.when ? <span>· {game.when}</span> : null}
          {game.venue ? <span>· {game.venue}</span> : null}
        </p>
      )}
    </div>
  );
}
