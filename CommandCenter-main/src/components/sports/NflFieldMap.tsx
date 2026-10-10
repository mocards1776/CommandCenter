import { useId, useState } from "react";
import {
  cfbDriveStatLine,
  liveDriveForField,
  type CfbDriveGlance,
} from "@/lib/cfb-drive";
import type { NflScoreGame } from "@/lib/nfl";
import { footballMarks } from "@heat/field.ts";
import LogoPlate from "@/components/sports/LogoPlate";
import { NflScoreboardCard } from "@/components/sports/ScoreboardCard";
import { isBreakStatus } from "@/lib/apple-score";
import { cn } from "@/lib/utils";
import PossessionFootball from "@/components/sports/PossessionFootball";
import { teamGlowColor } from "@/lib/team-logo-glow";

/** Minimal shape for NFL / CFB live field maps on RUWT cards. */
export type FootballFieldGame = {
  away: {
    teamId: string | number;
    abbrev: string;
    color?: string;
    alternateColor?: string | null;
    logo?: string | null;
  };
  home: {
    teamId: string | number;
    abbrev: string;
    color?: string;
    alternateColor?: string | null;
    logo?: string | null;
  };
  situation?: {
    downDistanceText?: string | null;
    lastPlayText?: string | null;
  } | null;
};

function teamHex(color: string | undefined, fallback = "888888"): string {
  const raw = (color || fallback).replace(/^#/, "");
  return `#${raw.length === 6 ? raw : fallback}`;
}

/** Circular Apple Sports LOS football. One gradient id per mark so RUWT cards do not clash. */
function CircularLosFootball({ className }: { className?: string }) {
  const rawId = useId();
  const gid = `losBall${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <defs>
        <radialGradient id={gid} cx="35%" cy="32%" r="68%">
          <stop offset="0" stopColor="#f3ead8" />
          <stop offset="45%" stopColor="#c4a574" />
          <stop offset="100%" stopColor="#5c3a16" />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="9.2" fill={`url(#${gid})`} stroke="#5c4320" strokeWidth="0.8" />
      <path d="M4.6 10 H15.4" stroke="#f5efe4" strokeWidth="1.15" strokeLinecap="round" />
      {[6.4, 8.2, 10, 11.8, 13.6].map((x) => (
        <path
          key={x}
          d={`M${x} 7.2 V12.8`}
          stroke="#f5efe4"
          strokeWidth="0.85"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function EndZoneMark({
  abbrev,
  color,
  logo,
  branded,
  side,
}: {
  abbrev: string;
  color: string;
  logo?: string | null;
  branded: boolean;
  side: "away" | "home";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden"
      style={{ background: color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.22)" }}
      aria-hidden
    >
      {branded && logo && !failed ? (
        <img
          src={logo}
          alt=""
          className="size-7 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] @md:size-10 @lg:size-12"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={cn(
            "text-[8px] font-black tracking-wider text-white/80",
            side === "away" ? "-rotate-90" : "rotate-90",
          )}
        >
          {abbrev}
        </span>
      )}
    </div>
  );
}

function MidfieldLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="pointer-events-none absolute left-1/2 top-1/2 z-[2] h-[70%] w-auto max-w-[26%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] @md:max-w-[18%]"
    />
  );
}

/**
 * Horizontal football field with team-colored end zones.
 * The field canvas (grass, end zones, midfield logo, yard lines) stays put.
 * On top: an Apple Sports drive capsule from the first snap to the LOS, a
 * circular football at the ball, and a thin yellow first-down stick.
 * Pass `drive` for start-spot semantics and the ESPN stat line.
 * `midfieldLogo` replaces the home club at midfield — overseas NFL passes the
 * league shield.
 */
export default function NflFieldMap({
  game,
  /** ESPN situation.yardLine — yards from the home end zone (0–100). */
  homeYardLine,
  possessionTeamId,
  downDistanceText,
  branded = false,
  drive = null,
  midfieldLogo,
  omitLastPlay = false,
  className,
}: {
  game: FootballFieldGame;
  homeYardLine: number | null;
  possessionTeamId: string | null;
  downDistanceText?: string | null;
  /** End-zone logos and a slightly taller field. Drive marks use the same capsule either way. */
  branded?: boolean;
  /** Current ESPN drive. Capsule start and the stat line render only when this is set. */
  drive?: CfbDriveGlance | null;
  /**
   * Midfield image. Undefined uses the home club when `branded`. Null hides it.
   * Overseas NFL passes the league shield.
   */
  midfieldLogo?: string | null;
  /** Game detail prints the same sentence under the field. Skip the copy here. */
  omitLastPlay?: boolean;
  className?: string;
}) {
  const poss = possessionTeamId;
  const homeHasBall = poss != null && String(poss) === String(game.home.teamId);
  const awayHasBall = poss != null && String(poss) === String(game.away.teamId);

  const awayChip = teamHex(game.away.color, "1e3a5f");
  const homeChip = teamHex(game.home.color, "7a1f1f");
  const awayZone = teamHex(teamGlowColor(game.away.color, game.away.alternateColor), "1e3a5f");
  const homeZone = teamHex(teamGlowColor(game.home.color, game.home.alternateColor), "7a1f1f");

  const ddText = downDistanceText || game.situation?.downDistanceText || null;
  const ticks = [10, 20, 30, 40, 50, 40, 30, 20, 10];

  const openDrive = liveDriveForField(drive, {
    possessionTeamId: poss,
    homeYardLine,
    away: { teamId: game.away.teamId, abbrev: game.away.abbrev },
    home: { teamId: game.home.teamId, abbrev: game.home.abbrev },
  });
  const startYard = openDrive?.startYardLine ?? null;
  const marks = footballMarks({
    yardLine: homeYardLine,
    possessionTeamId: poss,
    awayId: String(game.away.teamId),
    homeId: String(game.home.teamId),
    downDistanceText: ddText,
    driveStartYardLine: startYard,
  });
  const driveStats = openDrive ? cfbDriveStatLine(openDrive) : null;
  const driveStartTitle = openDrive?.startText
    ? `Drive started at ${openDrive.startText}`
    : "Drive start";
  const midfieldSrc = midfieldLogo === undefined ? (branded ? game.home.logo : null) : midfieldLogo;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-emerald-700/35 bg-[#0a1f12]", className)}>
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5",
            awayHasBall ? "text-white" : "text-white/45",
          )}
          style={awayHasBall ? { backgroundColor: `${awayChip}cc`, color: "#fff" } : undefined}
        >
          {game.away.abbrev}
          {awayHasBall ? <PossessionFootball className="h-2.5 w-4" /> : null}
        </span>
        <span className="text-emerald-200/70">
          {ddText && !isBreakStatus(ddText) ? ddText : "Field"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5",
            homeHasBall ? "text-white" : "text-white/45",
          )}
          style={homeHasBall ? { backgroundColor: `${homeChip}cc`, color: "#fff" } : undefined}
        >
          {homeHasBall ? <PossessionFootball className="h-2.5 w-4" /> : null}
          {game.home.abbrev}
        </span>
      </div>

      <div
        className={cn(
          "@container mx-2 mb-3 mt-2 grid overflow-hidden rounded-md border border-white/10 bg-gradient-to-b from-[#1a5c34] to-[#0d3d22]",
          branded
            ? "h-[5.6rem] grid-cols-[minmax(2.55rem,11%)_1fr_minmax(2.55rem,11%)]"
            : "h-[4.5rem] grid-cols-[8%_1fr_8%]",
        )}
      >
        <EndZoneMark
          abbrev={game.away.abbrev}
          color={awayZone}
          logo={game.away.logo}
          branded={branded}
          side="away"
        />
        <div className="relative min-w-0">
          {midfieldSrc ? <MidfieldLogo src={midfieldSrc} /> : null}
          {ticks.map((n, i) => (
            <div
              key={`${n}-${i}`}
              className="absolute inset-y-0 z-0 border-l border-white/25"
              style={{ left: `${((i + 1) / 10) * 100}%` }}
            >
              <span className="absolute bottom-1 left-0.5 -translate-x-1/2 text-[8px] font-bold text-white/55">
                {n}
              </span>
            </div>
          ))}

          {marks.capsule ? (
            <div
              className="absolute top-1/2 z-[5] h-2.5 min-w-4 -translate-y-1/2 rounded-full border border-white shadow-[0_1px_3px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.95)]"
              style={{
                left: `${marks.capsule.leftPct}%`,
                width: `${marks.capsule.widthPct}%`,
                background: "linear-gradient(180deg, #f7f8fb, #dce3ee)",
              }}
              title={driveStartTitle}
            >
              <span className="sr-only">{driveStartTitle}</span>
            </div>
          ) : null}
          {marks.firstDownPct != null ? (
            <div
              className="absolute top-1/2 z-[7] h-7 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffe500] shadow-[0_0_6px_rgba(255,229,0,0.9)]"
              style={{ left: `${marks.firstDownPct}%` }}
              title="First down"
            />
          ) : null}
          {marks.ballPct != null ? (
            <div
              className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${marks.ballPct}%` }}
              title="Line of scrimmage"
            >
              <CircularLosFootball className="h-5 w-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
            </div>
          ) : null}
        </div>
        <EndZoneMark
          abbrev={game.home.abbrev}
          color={homeZone}
          logo={game.home.logo}
          branded={branded}
          side="home"
        />
      </div>

      {driveStats ? (
        <p className="px-3 pb-2 text-[10px] font-semibold leading-snug tracking-[0.08em] text-white/75 uppercase">
          {driveStats}
        </p>
      ) : null}

      {!omitLastPlay && game.situation?.lastPlayText && (
        <p className="border-t border-white/[0.06] px-3 py-2 text-[11px] leading-snug text-white/70">
          {game.situation.lastPlayText}
        </p>
      )}
    </div>
  );
}

export function NflLiveStrip({ game }: { game: NflScoreGame }) {
  if (!game.live || !game.situation) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="text-alert text-[10px] font-semibold uppercase tracking-[0.14em]">
          Live
        </span>
        <span className="text-cream font-medium">
          {game.situation.downDistanceText ?? game.shortDetail}
        </span>
        {game.situation.possessionText && (
          <span className="text-chalk-dim">{game.situation.possessionText}</span>
        )}
      </div>
      {game.situation.lastPlayText && (
        <p className="text-chalk mt-1 text-[11px] leading-snug">{game.situation.lastPlayText}</p>
      )}
    </div>
  );
}

/** List row. Same card as the NFL board. */
export function NflScoreRow({
  game,
  to,
  heat,
  reasons,
}: {
  game: NflScoreGame;
  to?: string;
  heat?: number | null;
  reasons?: string[];
}) {
  return (
    <NflScoreboardCard
      game={game}
      to={to}
      heat={heat}
      reasons={reasons}
    />
  );
}
