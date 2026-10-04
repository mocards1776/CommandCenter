import { useState } from "react";
import { Link } from "react-router-dom";
import {
  alignCfbOpenDriveToPossession,
  cfbDriveStatLine,
  syncCfbDriveStartToLabel,
  type CfbDriveGlance,
} from "@/lib/cfb-drive";
import type { NflScoreGame } from "@/lib/nfl";
import { fieldBallPctFromHomeYardLine } from "@/lib/nfl";
import { layoutDrivePlayDots } from "@/lib/field-play-dots";
import LogoPlate from "@/components/sports/LogoPlate";
import { isBreakStatus } from "@/lib/apple-score";
import { cn } from "@/lib/utils";
import PossessionFootball from "@/components/sports/PossessionFootball";

/** Minimal shape for NFL / CFB live field maps on RUWT cards. */
export type FootballFieldGame = {
  away: { teamId: string | number; abbrev: string; color?: string; logo?: string | null };
  home: { teamId: string | number; abbrev: string; color?: string; logo?: string | null };
  situation?: {
    downDistanceText?: string | null;
    lastPlayText?: string | null;
  } | null;
};

function teamHex(color: string | undefined, fallback = "888888"): string {
  const raw = (color || fallback).replace(/^#/, "");
  return `#${raw.length === 6 ? raw : fallback}`;
}

/** Yards-to-go from "2ND & 9", "1st & Goal", etc. */
function parseYardsToGo(text: string | null | undefined): number | null {
  if (!text) return null;
  if (/\bgoal\b/i.test(text)) return null;
  const m = text.match(/&\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Brown football with pointed tips + laces — flips with direction of attack. */
function FootballGlyph({
  facingRight,
  className,
}: {
  facingRight: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 16"
      className={className}
      aria-hidden
      style={{ transform: facingRight ? undefined : "scaleX(-1)" }}
    >
      <path
        d="M2 8 C2 3.2 7.5 1.2 16 1.2 C24.5 1.2 30 3.2 30 8 C30 12.8 24.5 14.8 16 14.8 C7.5 14.8 2 12.8 2 8 Z"
        fill="#6b3a14"
        stroke="#2a1508"
        strokeWidth="1.1"
      />
      <path
        d="M3.2 8 C3.2 4.2 8.2 2.6 16 2.6 C23.8 2.6 28.8 4.2 28.8 8 C28.8 11.8 23.8 13.4 16 13.4 C8.2 13.4 3.2 11.8 3.2 8 Z"
        fill="#8b4e1c"
      />
      <path d="M10 8 H22" stroke="#f5efe4" strokeWidth="1.2" strokeLinecap="round" />
      {[12, 14, 16, 18, 20].map((x) => (
        <path
          key={x}
          d={`M${x} 5.3 V10.7`}
          stroke="#f5efe4"
          strokeWidth="0.95"
          strokeLinecap="round"
        />
      ))}
      <ellipse cx="4.4" cy="8" rx="1.5" ry="2.3" fill="#2a1508" opacity="0.5" />
      <ellipse cx="27.6" cy="8" rx="1.5" ry="2.3" fill="#2a1508" opacity="0.5" />
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

/** Team-colored attack arrow. Away drives right, home drives left. */
function AttackArrow({ facingRight, color }: { facingRight: boolean; color: string }) {
  return (
    <svg viewBox="0 0 14 10" className="h-3 w-4" aria-hidden>
      <path
        d={facingRight ? "M1.2 1.2 L12.2 5 L1.2 8.8 Z" : "M12.8 1.2 L1.8 5 L12.8 8.8 Z"}
        fill={color}
        stroke="#fff"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Possession mark on the line of scrimmage. Logo when we have one; football if it fails. */
function LosPossessionMark({
  logo,
  facingRight,
  facingLeft,
  possColor,
}: {
  logo: string | null | undefined;
  facingRight: boolean;
  facingLeft: boolean;
  possColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const showArrow = facingLeft || facingRight;
  if (logo && !failed) {
    return (
      <span className="relative block h-7 w-7">
        {showArrow ? (
          <span
            className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2"
            title={facingRight ? "Driving right" : "Driving left"}
          >
            <AttackArrow facingRight={facingRight} color={possColor} />
          </span>
        ) : null}
        <img
          src={logo}
          alt=""
          onError={() => setFailed(true)}
          className="relative h-7 w-7 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
        />
      </span>
    );
  }
  return (
    <>
      <span
        className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-[3px]"
        style={{ backgroundColor: possColor }}
        aria-hidden
      />
      <FootballGlyph
        facingRight={facingRight || !facingLeft}
        className="relative h-[18px] w-8 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]"
      />
      {(facingLeft || facingRight) && (
        <span
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            ...(facingRight ? { left: "calc(100% + 3px)" } : { right: "calc(100% + 3px)" }),
            width: 0,
            height: 0,
            borderTop: "7px solid transparent",
            borderBottom: "7px solid transparent",
            ...(facingRight
              ? { borderLeft: `12px solid ${possColor}` }
              : { borderRight: `12px solid ${possColor}` }),
            filter: "drop-shadow(0 0 2px rgba(0,0,0,0.7))",
          }}
          aria-hidden
        />
      )}
    </>
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
 * `branded` is the chains both leagues use: possession logo on the line of
 * scrimmage (football if the logo fails) with a team-colored attack arrow,
 * a short bar to the sticks, and a yellow line at the first down. The line of
 * scrimmage stays an amber tick under the logo. Pass `drive` for the
 * drive-start marker, the current drive's play dots, and the ESPN stat line.
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
  /** Logo on the line of scrimmage, yellow sticks, end-zone logos. */
  branded?: boolean;
  /** Current ESPN drive. Marker, play dots, and stat line render only when this is set. */
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

  const awayColor = teamHex(game.away.color, "1e3a5f");
  const homeColor = teamHex(game.home.color, "7a1f1f");
  const possColor = homeHasBall ? homeColor : awayHasBall ? awayColor : "#f0e6c8";

  // Away left → home right. Away offense drives right; home offense drives left.
  const facingRight = awayHasBall;
  const facingLeft = homeHasBall;

  const rawPct = fieldBallPctFromHomeYardLine(homeYardLine);
  const ballPct = rawPct != null ? Math.max(0, Math.min(100, rawPct)) : null;

  const ddText = downDistanceText || game.situation?.downDistanceText || null;
  const yardsToGo = parseYardsToGo(ddText);
  const goalToGo = Boolean(ddText && /\bgoal\b/i.test(ddText));

  let firstDownPct: number | null = null;
  if (ballPct != null && (homeHasBall || awayHasBall)) {
    if (goalToGo) {
      firstDownPct = facingRight ? 100 : 0;
    } else if (yardsToGo != null) {
      firstDownPct = facingRight
        ? Math.max(0, Math.min(100, ballPct + yardsToGo))
        : Math.max(0, Math.min(100, ballPct - yardsToGo));
    }
  }

  const ticks = [10, 20, 30, 40, 50, 40, 30, 20, 10];

  // Percents are of the playing field (between the end zones), not the whole strip.
  const toGainLeft =
    ballPct != null && firstDownPct != null ? Math.min(ballPct, firstDownPct) : null;
  const toGainWidth =
    ballPct != null && firstDownPct != null ? Math.abs(firstDownPct - ballPct) : null;

  const openDrive = syncCfbDriveStartToLabel(
    alignCfbOpenDriveToPossession(drive, {
      possessionTeamId: poss,
      homeYardLine,
      away: { teamId: game.away.teamId, abbrev: game.away.abbrev },
      home: { teamId: game.home.teamId, abbrev: game.home.abbrev },
    }),
    game.home.abbrev,
    game.away.abbrev,
  );
  const startYard = openDrive?.startYardLine ?? null;
  // The midfield logo covers the 40s. A spot like WSH 46 is only four yards
  // off the 50, so the diamond carries the yard number when it sits on that logo.
  const startNum = openDrive?.startText?.trim().match(/(\d{1,2})$/)?.[1] ?? null;
  const startOnLogo =
    startYard != null && startYard >= 38 && startYard <= 62 && startNum != null && startNum !== "0";
  // Goal-line placeholders (0 / 100) sit in the end zone. A real drive start
  // is between them; the mapper replaces a stale kickoff 0 before this.
  const driveStartPct =
    startYard != null && startYard > 0 && startYard < 100
      ? fieldBallPctFromHomeYardLine(startYard)
      : null;
  const driveStats = openDrive ? cfbDriveStatLine(openDrive) : null;
  const driveDots = branded ? layoutDrivePlayDots(openDrive?.playSpots ?? []) : [];
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
          style={awayHasBall ? { backgroundColor: `${awayColor}cc` } : undefined}
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
          style={homeHasBall ? { backgroundColor: `${homeColor}cc` } : undefined}
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
          color={awayColor}
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

          {branded ? (
            <>
              {toGainLeft != null && toGainWidth != null && toGainWidth > 0.3 && (
                <div
                  className="absolute top-1/2 z-[3] h-1.5 -translate-y-1/2 bg-[#2f9bff] shadow-[0_0_8px_rgba(47,155,255,0.9)]"
                  style={{ left: `${toGainLeft}%`, width: `${toGainWidth}%` }}
                  title="Yards to the sticks"
                />
              )}
              {firstDownPct != null && (
                <div
                  className="absolute inset-y-0 z-[7] w-[3px] -translate-x-1/2 bg-[#ffe500] shadow-[0_0_8px_rgba(255,229,0,0.95)]"
                  style={{ left: `${firstDownPct}%` }}
                  title="First down"
                />
              )}
              {driveDots.map((dot, i) => (
                <span
                  key={`play-${i}`}
                  className="absolute z-[4] size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
                  style={{
                    left: `calc(${dot.pct}% + ${dot.x}px)`,
                    top: `calc(50% + ${dot.y}px)`,
                    backgroundColor: possColor,
                  }}
                  title="Play on this drive"
                />
              ))}
              {ballPct != null && (
                <div
                  className="absolute top-1/2 z-[8] h-10 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)]"
                  style={{ left: `${ballPct}%` }}
                  title="Line of scrimmage"
                />
              )}
              {ballPct != null && (
                <div
                  className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${ballPct}%` }}
                >
                  <LosPossessionMark
                    logo={homeHasBall ? game.home.logo : awayHasBall ? game.away.logo : null}
                    facingRight={facingRight}
                    facingLeft={facingLeft}
                    possColor={possColor}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {toGainLeft != null && toGainWidth != null && toGainWidth > 0.3 && (
                <div
                  className="absolute inset-y-0 z-[3] bg-amber-300/35"
                  style={{ left: `${toGainLeft}%`, width: `${toGainWidth}%` }}
                />
              )}
              {firstDownPct != null && (
                <div
                  className="absolute inset-y-0 z-[4] w-0.5 bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.7)]"
                  style={{ left: `${firstDownPct}%` }}
                  title="First down"
                />
              )}
              {ballPct != null && (
                <div
                  className="absolute inset-y-0 z-[5] w-0.5 bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.65)]"
                  style={{ left: `${ballPct}%` }}
                  title="Line of scrimmage"
                />
              )}
              {ballPct != null && (
                <div
                  className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${ballPct}%` }}
                >
                  <span
                    className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-[3px]"
                    style={{ backgroundColor: possColor }}
                    aria-hidden
                  />
                  <FootballGlyph
                    facingRight={facingRight || !facingLeft}
                    className="relative h-[18px] w-8 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]"
                  />
                  {(facingLeft || facingRight) && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2"
                      style={{
                        ...(facingRight
                          ? { left: "calc(100% + 3px)" }
                          : { right: "calc(100% + 3px)" }),
                        width: 0,
                        height: 0,
                        borderTop: "7px solid transparent",
                        borderBottom: "7px solid transparent",
                        ...(facingRight
                          ? { borderLeft: `12px solid ${possColor}` }
                          : { borderRight: `12px solid ${possColor}` }),
                        filter: "drop-shadow(0 0 2px rgba(0,0,0,0.7))",
                      }}
                      title={facingRight ? "Driving right" : "Driving left"}
                      aria-hidden
                    />
                  )}
                </div>
              )}
            </>
          )}

          {driveStartPct != null && (
            <div
              className="absolute inset-y-0 z-[6]"
              style={{ left: `${driveStartPct}%` }}
              title={driveStartTitle}
            >
              <span className="absolute inset-y-1 left-0 w-px -translate-x-1/2 border-l border-dashed border-white" />
              <span
                className="absolute top-1 left-0 h-2 w-2 -translate-x-1/2 rotate-45 border border-black/70 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                aria-hidden
              />
              {startOnLogo ? (
                <span className="absolute top-3.5 left-1.5 rounded-sm bg-black/80 px-0.5 text-[8px] font-black leading-none text-white tabular-nums shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {startNum}
                </span>
              ) : null}
              <span className="sr-only">{driveStartTitle}</span>
            </div>
          )}
        </div>
        <EndZoneMark
          abbrev={game.home.abbrev}
          color={homeColor}
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

/** @deprecated Prefer NflScoreRow — kept as alias for existing imports. */
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
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          {[game.away, game.home].map((side) => (
            <div key={side.teamId} className="flex items-center gap-2">
              {side.logo ? <LogoPlate src={side.logo} className="h-6 w-6" /> : null}
              <span className="text-cream min-w-0 flex-1 truncate text-[13px] font-medium">
                {side.abbrev}
              </span>
              <span className="numeral text-cream text-[18px]">{side.score ?? "—"}</span>
            </div>
          ))}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.14em]",
              game.live ? "text-alert" : "text-chalk-dim",
            )}
          >
            {game.live ? "Live" : game.final ? "Final" : game.whenShort ?? "Upcoming"}
          </p>
          <p className="text-chalk-dim mt-1 max-w-[7rem] text-[10px] leading-snug">
            {game.shortDetail}
          </p>
          {heat != null ? (
            <p className="mt-1.5 inline-flex items-center rounded-sm bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
              Heat {heat}
            </p>
          ) : null}
        </div>
      </div>
      {game.live && game.situation?.downDistanceText && (
        <p className="text-chalk mt-2 truncate text-[11px]">{game.situation.downDistanceText}</p>
      )}
      {reasons && reasons.length > 0 ? (
        <p className="text-chalk-dim mt-2 truncate text-[10px]">{reasons.join(" · ")}</p>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="bg-panel block rounded-xl border border-white/[0.08] p-3 transition hover:border-white/15 hover:bg-white/[0.03]"
      >
        {body}
      </Link>
    );
  }
  return <div className="bg-panel rounded-xl border border-white/[0.08] p-3">{body}</div>;
}
