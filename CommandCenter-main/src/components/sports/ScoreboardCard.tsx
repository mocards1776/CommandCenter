import { memo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import AppleScoreCluster, { type MlbScoreNest } from "@/components/sports/AppleScoreCluster";
import CfbRankLabel, { CfbFpiCaption } from "@/components/sports/CfbRankLabel";
import { WsChampPct } from "@/components/sports/MlbWorldSeriesOdds";
import MlbLogoGlow from "@/components/sports/MlbLogoGlow";
import TeamLogoGlow from "@/components/sports/TeamLogoGlow";
import PlayoffSeriesLine from "@/components/sports/PlayoffSeriesLine";
import PossessionFootball from "@/components/sports/PossessionFootball";
import TeamMark from "@/components/sports/TeamMark";
import type { UnifiedRuwtItem } from "@/hooks/useRuwtSlate";
import type { CfbScoreGame } from "@/lib/cfb";
import type { GameBroadcast } from "@/lib/game-broadcasts";
import { mlbHeadshot, type MlbScoreGame } from "@/lib/mlb";
import type { MlbWsOddsBoard } from "@/lib/mlb-ws-odds";
import { wsPctFor } from "@/lib/mlb-ws-odds";
import type { NflScoreGame } from "@/lib/nfl";
import type { NhlScoreGame } from "@/lib/nhl";
import { ruwtWhyReasons } from "@/lib/ruwt-slate";
import { espnDarkLogo, RUWT_SPORT_LABEL } from "@/lib/ruwt-score-tab";
import type { SoccerScoreGame } from "@/lib/soccer";
import { cn } from "@/lib/utils";

/**
 * Shared multi-game scoreboard card. The layout follows the RUWT game cards
 * (status bar, two marks, score cluster, footers). RUWT itself keeps its own
 * cards so heat order and ranking stay untouched.
 * Logos sit on the card surface — no cream disc or filled plate.
 */

export function centralStartLabel(iso: string | null | undefined, fallback?: string | null): string {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      const time = d.toLocaleTimeString("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
      });
      return `${time} CT`;
    }
  }
  const text = (fallback ?? "").replace(/\s+[A-Z]{2,4}T$/, "").trim();
  return text || "TBD";
}

export function TeamLogo({
  src,
  color,
  alternateColor,
  dim = false,
  className,
}: {
  src: string | null | undefined;
  color?: string | null;
  alternateColor?: string | null;
  dim?: boolean;
  className?: string;
}) {
  const dark = src ? espnDarkLogo(src) : null;
  const [failedFor, setFailedFor] = useState<string | null>(null);
  if (!src) return null;
  const failedDark = failedFor === src;
  const shown = dark && !failedDark ? dark : src;
  return (
    <TeamLogoGlow primaryColor={color} alternateColor={alternateColor} spread={5.2} dim={dim}>
      <img
        src={shown}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("h-9 w-9 shrink-0 object-contain", className)}
        onError={() => {
          if (dark && !failedDark) setFailedFor(src);
        }}
      />
    </TeamLogoGlow>
  );
}

export type ScoreboardSide = {
  abbrev: string;
  logo: ReactNode;
  record?: string | null;
  /** Poll rank or other prefix rendered with the abbreviation. */
  rank?: ReactNode;
  caption?: ReactNode;
  hasBall?: boolean;
  muted?: boolean;
};

export type ScoreboardCardProps = {
  to?: string | null;
  live: boolean;
  final: boolean;
  status: string;
  away: ScoreboardSide;
  home: ScoreboardSide;
  awayScore: number | string | null;
  homeScore: number | string | null;
  detail?: string | null;
  preview?: string | null;
  mlb?: MlbScoreNest | null;
  emphasis?: "redzone" | "close" | null;
  headerExtra?: ReactNode;
  scoreNote?: ReactNode;
  /** Hockey strength chip, e.g. "PP", when the feed already says so. */
  strength?: string | null;
  children?: ReactNode;
};

function SideColumn({ side, align }: { side: ScoreboardSide; align: "left" | "right" }) {
  const ball =
    side.hasBall ? <PossessionFootball className="h-3 w-5 shrink-0" title="Possession" /> : null;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-1",
        align === "left" ? "sm:items-start" : "sm:items-end",
        side.muted && "opacity-60",
      )}
    >
      {side.logo}
      <p
        className={cn(
          "inline-flex max-w-full items-center gap-1 text-[15px] font-bold tracking-wide text-white",
          side.hasBall && "text-cream",
        )}
      >
        {align === "right" ? ball : null}
        <span className="min-w-0 truncate">
          {side.rank}
          {side.abbrev}
        </span>
        {align === "left" ? ball : null}
      </p>
      {side.record ? (
        <p className="numeral text-[12px] font-medium text-white/70">{side.record}</p>
      ) : null}
      {side.caption}
    </div>
  );
}

function ScoreboardCardInner({
  to,
  live,
  final,
  status,
  away,
  home,
  awayScore,
  homeScore,
  detail,
  preview,
  mlb,
  emphasis,
  headerExtra,
  scoreNote,
  strength,
  children,
}: ScoreboardCardProps) {
  const shell = cn(
    "relative block overflow-hidden rounded-lg border bg-[#07101d] text-left transition hover:border-accent/40",
    live ? "border-alert/45" : "border-white/[0.08]",
    emphasis === "redzone" &&
      "border-red-500/70 shadow-[0_0_0_1px_rgba(239,68,68,0.55),0_0_28px_rgba(239,68,68,0.38)]",
    emphasis === "close" &&
      "border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.45),0_0_24px_rgba(251,191,36,0.3)]",
  );
  const body = (
    <>
      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-cream">
          {live ? (
            <span className="text-alert">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-alert" />
              {status || "Live"}
            </span>
          ) : (
            status
          )}
          {strength ? (
            <span className="ml-1.5 rounded-sm bg-amber-300/15 px-1 py-0.5 text-[9px] font-bold tracking-[0.12em] text-amber-100">
              {strength}
            </span>
          ) : null}
        </span>
        {headerExtra ? (
          <span className="flex min-w-0 shrink items-center justify-end gap-1.5 text-[10.5px] text-[#8b93a7]">
            {headerExtra}
          </span>
        ) : null}
      </div>
      <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-3.5">
        <SideColumn side={away} align="left" />
        <div className="flex flex-col items-center">
          <AppleScoreCluster
            away={awayScore}
            home={homeScore}
            detail={detail ?? null}
            live={live}
            final={final}
            face="sans"
            preview={preview}
            awayDim={away.muted}
            homeDim={home.muted}
            mlb={mlb}
          />
          {scoreNote}
        </div>
        <SideColumn side={home} align="right" />
      </div>
      {children}
    </>
  );
  const label = `${away.abbrev} at ${home.abbrev}`;
  if (!to) return <div className={shell}>{body}</div>;
  if (/^https?:/i.test(to)) {
    return (
      <a href={to} target="_blank" rel="noreferrer" aria-label={label} className={shell}>
        {body}
      </a>
    );
  }
  return (
    <Link to={to} aria-label={label} className={shell}>
      {body}
    </Link>
  );
}

export const ScoreboardCard = memo(ScoreboardCardInner);

export function ScoreboardBroadcasts({ broadcasts }: { broadcasts?: GameBroadcast[] | null }) {
  if (!broadcasts?.length) return null;
  return (
    <div className="relative z-10 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] px-3 py-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">TV</span>
      {broadcasts.map((b) => {
        const isSvg = Boolean(b.logo && /\.svg(\?|$)/i.test(b.logo));
        return (
          <span
            key={`${b.market ?? "x"}-${b.name}`}
            className="inline-flex h-5 max-w-[9rem] items-center gap-1 rounded-sm bg-white/[0.07] px-1.5 text-[10px] text-[#c5cce0]"
            title={b.market ? `${b.name} (${b.market})` : b.name}
          >
            {b.logo ? (
              <img
                src={b.logo}
                alt=""
                loading="lazy"
                decoding="async"
                className={
                  isSvg
                    ? "h-3.5 w-3.5 object-contain"
                    : "h-3.5 w-auto max-w-[2.75rem] object-contain brightness-0 invert"
                }
              />
            ) : null}
            <span className="truncate">{b.name}</span>
          </span>
        );
      })}
    </div>
  );
}

function FootLine({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <p
      className={cn(
        "relative z-10 truncate border-t border-white/[0.06] px-3 py-1.5 text-center",
        strong ? "text-[12px] font-semibold text-cream" : "text-[11px] text-white/70",
      )}
    >
      {children}
    </p>
  );
}

function HeatMeta({
  heat,
  extra,
}: {
  heat?: number | null;
  extra?: ReactNode;
}) {
  if (heat == null && !extra) return null;
  return (
    <>
      {extra}
      {heat != null ? <span className="numeral shrink-0 font-semibold">Heat {heat}</span> : null}
    </>
  );
}

function loserMuted(final: boolean, away: number | null, home: number | null, which: "away" | "home") {
  if (!final || away == null || home == null || away === home) return false;
  return which === "away" ? away < home : home < away;
}

function hockeyStrength(status: string | null | undefined, detail: string | null | undefined): string | null {
  const blob = `${status ?? ""} ${detail ?? ""}`;
  if (/\bpower\s*play\b/i.test(blob) || /\bPP\b/.test(blob)) return "PP";
  return null;
}

function footballEmphasis(
  live: boolean,
  away: number | null,
  home: number | null,
  detail: string,
  redZone: boolean,
  period?: number | null,
): "redzone" | "close" | null {
  if (!live) return null;
  if (redZone) return "redzone";
  if (away == null || home == null) return null;
  const diff = Math.abs(away - home);
  const text = detail.toLowerCase();
  const inOt = (period != null && period >= 5) || /\bot\b|overtime/.test(text);
  const fourth = period === 4 || /\b4th\b/.test(text);
  if (diff <= 8 && (fourth || inOt)) return "close";
  return null;
}

function PitcherColumn({
  side,
  align,
}: {
  side: MlbScoreGame["away"];
  align: "left" | "right";
}) {
  const name = side.probablePitcher ?? "TBD";
  const parts = name.split(" ");
  const last = parts.length > 1 ? parts[parts.length - 1] : name;
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        align === "right" ? "items-end text-right" : "items-start text-left",
      )}
    >
      {side.probablePitcherId ? (
        <div className="relative h-[72px] w-[58px] overflow-hidden rounded-lg bg-[#dfe6f2] ring-2 ring-white/25">
          <img
            src={mlbHeadshot(side.probablePitcherId, 213)}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-[1.12] object-cover object-[center_12%]"
          />
        </div>
      ) : (
        <div className="grid h-[72px] w-[58px] place-items-center rounded-lg bg-white/10 text-[10px] text-white/40">
          TBD
        </div>
      )}
      {first ? (
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-white/55">
          {first}
        </p>
      ) : null}
      <p className="font-display truncate text-[16px] leading-none text-cream">{last}</p>
    </div>
  );
}

function mlbSide(
  side: MlbScoreGame["away"],
  muted: boolean,
  wsBoard: MlbWsOddsBoard | null | undefined,
): ScoreboardSide {
  return {
    abbrev: side.abbrev,
    muted,
    record: side.record,
    caption: <WsChampPct pct={wsPctFor(wsBoard, side.teamId)} muted={muted} />,
    logo: side.teamId ? (
      <MlbLogoGlow teamId={side.teamId} primaryColor={side.primaryColor} spread={5.2} dim={muted}>
        <TeamMark teamId={side.teamId} size="md" />
      </MlbLogoGlow>
    ) : null,
  };
}

export const MlbScoreboardCard = memo(function MlbScoreboardCard({
  game,
  heat,
  wsBoard,
  headerExtra,
  footer,
}: {
  game: MlbScoreGame;
  heat?: number | null;
  wsBoard?: MlbWsOddsBoard | null;
  headerExtra?: ReactNode;
  footer?: ReactNode;
}) {
  const pregame = !game.live && !game.final;
  const awayMuted = loserMuted(game.final, game.away.score, game.home.score, "away");
  const homeMuted = loserMuted(game.final, game.away.score, game.home.score, "home");
  const sit = game.live ? game.situation : null;
  const matchup =
    sit && (sit.pitcher || sit.batter)
      ? [sit.pitcher ? `P ${sit.pitcher.name}` : null, sit.batter ? `B ${sit.batter.name}` : null]
          .filter(Boolean)
          .join(" · ")
      : null;
  const hits =
    game.away.hits != null || game.home.hits != null
      ? `H ${game.away.hits ?? "–"}–${game.home.hits ?? "–"}`
      : null;
  return (
    <ScoreboardCard
      to={`/sports/mlb/game/${game.id}`}
      live={game.live}
      final={game.final}
      status={game.live ? game.inning || "Live" : game.final ? "Final" : "Preview"}
      away={mlbSide(game.away, awayMuted, wsBoard)}
      home={mlbSide(game.home, homeMuted, wsBoard)}
      awayScore={pregame ? null : game.away.score}
      homeScore={pregame ? null : game.home.score}
      detail={game.live ? game.inning : game.final ? "Final" : null}
      preview={pregame ? centralStartLabel(game.gameDate, game.whenShort) : null}
      mlb={
        sit
          ? {
              balls: sit.balls,
              strikes: sit.strikes,
              outs: sit.outs,
              onFirst: sit.onFirst,
              onSecond: sit.onSecond,
              onThird: sit.onThird,
            }
          : null
      }
      headerExtra={<HeatMeta heat={heat} extra={headerExtra} />}
      scoreNote={
        hits && !pregame ? (
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-white/45">{hits}</p>
        ) : null
      }
    >
      {matchup ? <FootLine strong>{matchup}</FootLine> : null}
      {pregame && (game.away.probablePitcher || game.home.probablePitcher) ? (
        <div className="relative z-10 border-t border-white/[0.06] px-3 py-2.5">
          <p className="mb-2 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Probable pitchers
          </p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
            <PitcherColumn side={game.away} align="left" />
            <span className="pb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              vs
            </span>
            <PitcherColumn side={game.home} align="right" />
          </div>
        </div>
      ) : null}
      <ScoreboardBroadcasts broadcasts={game.broadcasts} />
      <PlayoffSeriesLine
        line={game.seriesLine}
        className="relative z-10 border-t border-white/[0.06] px-3 py-1.5 text-center"
      />
      {!pregame && game.venue ? <FootLine>{game.venue}</FootLine> : null}
      {footer}
    </ScoreboardCard>
  );
});

function ballOn(teamId: string | number | null | undefined, possession: string | null | undefined) {
  return possession != null && String(possession) === String(teamId);
}

export const NflScoreboardCard = memo(function NflScoreboardCard({
  game,
  to,
  heat,
  reasons,
  headerExtra,
  footer,
}: {
  game: NflScoreGame;
  to?: string | null;
  heat?: number | null;
  reasons?: string[];
  headerExtra?: ReactNode;
  footer?: ReactNode;
}) {
  const pregame = !game.live && !game.final;
  const detail = `${game.shortDetail ?? ""} ${game.status ?? ""}`;
  const poss = game.situation?.possessionTeamId;
  const why = reasons?.filter(Boolean).join(" · ");
  return (
    <ScoreboardCard
      to={to === undefined ? `/sports/nfl/game/${game.id}` : to}
      live={game.live}
      final={game.final}
      status={game.live ? game.shortDetail || "Live" : game.final ? game.shortDetail || "Final" : "Preview"}
      emphasis={footballEmphasis(
        game.live,
        game.away.score,
        game.home.score,
        detail,
        Boolean(game.situation?.isRedZone),
      )}
      away={{
        abbrev: game.away.abbrev,
        record: game.away.record,
        hasBall: Boolean(game.live && ballOn(game.away.teamId, poss)),
        muted: loserMuted(game.final, game.away.score, game.home.score, "away"),
        logo: (
          <TeamLogo
            src={game.away.logo}
            color={game.away.color}
            alternateColor={game.away.alternateColor}
            dim={loserMuted(game.final, game.away.score, game.home.score, "away")}
          />
        ),
      }}
      home={{
        abbrev: game.home.abbrev,
        record: game.home.record,
        hasBall: Boolean(game.live && ballOn(game.home.teamId, poss)),
        muted: loserMuted(game.final, game.away.score, game.home.score, "home"),
        logo: (
          <TeamLogo
            src={game.home.logo}
            color={game.home.color}
            alternateColor={game.home.alternateColor}
            dim={loserMuted(game.final, game.away.score, game.home.score, "home")}
          />
        ),
      }}
      awayScore={pregame ? null : game.away.score}
      homeScore={pregame ? null : game.home.score}
      detail={pregame ? null : game.shortDetail}
      preview={pregame ? centralStartLabel(game.startIso, game.whenShort) : null}
      headerExtra={<HeatMeta heat={heat} extra={headerExtra} />}
    >
      {game.live && (game.situation?.downDistanceText || game.situation?.possessionText) ? (
        <div className="relative z-10 border-t border-white/[0.06] px-3 py-2 text-center">
          {game.situation.downDistanceText ? (
            <p className="text-[12px] font-semibold text-cream">{game.situation.downDistanceText}</p>
          ) : null}
          {game.situation.possessionText ? (
            <p className="mt-0.5 truncate text-[11px] text-white/60">{game.situation.possessionText}</p>
          ) : null}
        </div>
      ) : null}
      <ScoreboardBroadcasts broadcasts={game.broadcasts} />
      <PlayoffSeriesLine
        line={game.seriesLine}
        className="relative z-10 border-t border-white/[0.06] px-3 py-1.5 text-center"
      />
      {!pregame && game.venue ? <FootLine>{game.venue}</FootLine> : null}
      {why ? <FootLine>{why}</FootLine> : null}
      {footer}
    </ScoreboardCard>
  );
});

function periodTag(index: number): string {
  if (index < 3) return String(index + 1);
  if (index === 3) return "OT";
  return `OT${index - 2}`;
}

export const NhlScoreboardCard = memo(function NhlScoreboardCard({
  game,
  heat,
  headerExtra,
  footer,
}: {
  game: NhlScoreGame;
  heat?: number | null;
  headerExtra?: ReactNode;
  footer?: ReactNode;
}) {
  const pregame = !game.live && !game.final;
  const detail = `${game.shortDetail ?? ""} ${game.status ?? ""}`;
  const diff =
    game.away.score != null && game.home.score != null
      ? Math.abs(game.away.score - game.home.score)
      : null;
  const inOt = /\bot\b|overtime|shootout|\bso\b/i.test(detail);
  const close = Boolean(game.live && diff != null && diff <= 1 && (/\b3rd\b/i.test(detail) || inOt));
  const periods = Math.max(game.away.linescores.length, game.home.linescores.length);
  return (
    <ScoreboardCard
      to={`/sports/nhl/game/${game.id}`}
      live={game.live}
      final={game.final}
      status={game.live ? game.shortDetail || "Live" : game.final ? game.shortDetail || "Final" : "Preview"}
      strength={game.live ? hockeyStrength(game.status, game.shortDetail) : null}
      emphasis={close ? "close" : null}
      away={{
        abbrev: game.away.abbrev,
        record: game.away.record,
        muted: loserMuted(game.final, game.away.score, game.home.score, "away"),
        logo: (
          <TeamLogo
            src={game.away.logo}
            color={game.away.color}
            alternateColor={game.away.alternateColor}
            dim={loserMuted(game.final, game.away.score, game.home.score, "away")}
          />
        ),
      }}
      home={{
        abbrev: game.home.abbrev,
        record: game.home.record,
        muted: loserMuted(game.final, game.away.score, game.home.score, "home"),
        logo: (
          <TeamLogo
            src={game.home.logo}
            color={game.home.color}
            alternateColor={game.home.alternateColor}
            dim={loserMuted(game.final, game.away.score, game.home.score, "home")}
          />
        ),
      }}
      awayScore={pregame ? null : game.away.score}
      homeScore={pregame ? null : game.home.score}
      detail={pregame ? null : game.shortDetail}
      preview={pregame ? centralStartLabel(game.startIso, game.whenShort) : null}
      headerExtra={<HeatMeta heat={heat} extra={headerExtra} />}
    >
      {periods > 0 ? (
        <div className="relative z-10 flex justify-center gap-3 overflow-x-auto border-t border-white/[0.06] px-3 py-1.5 text-[11px]">
          {Array.from({ length: periods }, (_, i) => (
            <span key={i} className="text-center">
              <span className="block text-[9px] uppercase tracking-[0.12em] text-white/40">
                {periodTag(i)}
              </span>
              <span className="numeral text-white/80">
                {game.away.linescores[i] ?? "–"}–{game.home.linescores[i] ?? "–"}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      <ScoreboardBroadcasts broadcasts={game.broadcasts} />
      <PlayoffSeriesLine
        line={game.seriesLine}
        className="relative z-10 border-t border-white/[0.06] px-3 py-1.5 text-center"
      />
      {!pregame && game.venue ? <FootLine>{game.venue}</FootLine> : null}
      {footer}
    </ScoreboardCard>
  );
});

function cfbRank(side: CfbScoreGame["away"]) {
  return <CfbRankLabel pollRank={side.rank} fpiRank={null} />;
}

export const CfbScoreboardCard = memo(function CfbScoreboardCard({
  game,
  heat,
  headerExtra,
  footer,
}: {
  game: CfbScoreGame;
  heat?: number | null;
  headerExtra?: ReactNode;
  footer?: ReactNode;
}) {
  const pregame = !game.live && !game.final;
  const detail = `${game.shortDetail ?? ""} ${game.status ?? ""}`;
  const poss = game.situation?.possessionTeamId;
  const line =
    game.odds?.details ||
    (game.odds?.overUnder != null ? `O/U ${game.odds.overUnder}` : null);
  return (
    <ScoreboardCard
      to={`/sports/cfb/game/${game.id}`}
      live={game.live}
      final={game.final}
      status={game.live ? game.shortDetail || "Live" : game.final ? game.shortDetail || "Final" : "Preview"}
      emphasis={footballEmphasis(
        game.live,
        game.away.score,
        game.home.score,
        detail,
        Boolean(game.situation?.isRedZone),
        game.period,
      )}
      away={{
        abbrev: game.away.abbrev,
        record: game.away.record,
        rank: cfbRank(game.away),
        caption: <CfbFpiCaption pollRank={game.away.rank} fpiRank={game.away.fpiRank} />,
        hasBall: Boolean(game.live && ballOn(game.away.teamId, poss)),
        muted: loserMuted(game.final, game.away.score, game.home.score, "away"),
        logo: (
          <TeamLogo
            src={game.away.logo}
            color={game.away.color}
            alternateColor={game.away.alternateColor}
            dim={loserMuted(game.final, game.away.score, game.home.score, "away")}
          />
        ),
      }}
      home={{
        abbrev: game.home.abbrev,
        record: game.home.record,
        rank: cfbRank(game.home),
        caption: <CfbFpiCaption pollRank={game.home.rank} fpiRank={game.home.fpiRank} />,
        hasBall: Boolean(game.live && ballOn(game.home.teamId, poss)),
        muted: loserMuted(game.final, game.away.score, game.home.score, "home"),
        logo: (
          <TeamLogo
            src={game.home.logo}
            color={game.home.color}
            alternateColor={game.home.alternateColor}
            dim={loserMuted(game.final, game.away.score, game.home.score, "home")}
          />
        ),
      }}
      awayScore={pregame ? null : game.away.score}
      homeScore={pregame ? null : game.home.score}
      detail={pregame ? null : game.shortDetail}
      preview={pregame ? centralStartLabel(game.startIso, game.whenShort) : null}
      headerExtra={<HeatMeta heat={heat} extra={headerExtra} />}
    >
      {game.live && (game.situation?.downDistanceText || game.situation?.possessionText) ? (
        <div className="relative z-10 border-t border-white/[0.06] px-3 py-2 text-center">
          {game.situation.downDistanceText ? (
            <p className="text-[12px] font-semibold text-cream">{game.situation.downDistanceText}</p>
          ) : null}
          {game.situation.possessionText ? (
            <p className="mt-0.5 truncate text-[11px] text-white/60">{game.situation.possessionText}</p>
          ) : null}
        </div>
      ) : null}
      {line ? <FootLine>{line}</FootLine> : null}
      <ScoreboardBroadcasts broadcasts={game.broadcasts} />
      {!pregame && game.venue ? <FootLine>{game.venue}</FootLine> : null}
      {footer}
    </ScoreboardCard>
  );
});

export const SoccerScoreboardCard = memo(function SoccerScoreboardCard({
  game,
  heat,
  headerExtra,
  footer,
}: {
  game: SoccerScoreGame;
  heat?: number | null;
  headerExtra?: ReactNode;
  footer?: ReactNode;
}) {
  const pregame = !game.live && !game.final;
  const awayN = game.away.score == null ? null : Number(game.away.score);
  const homeN = game.home.score == null ? null : Number(game.home.score);
  return (
    <ScoreboardCard
      to={`/sports/soccer/game/${game.id}`}
      live={game.live}
      final={game.final}
      status={
        game.live
          ? game.shortDetail || game.status || "Live"
          : game.final
            ? game.shortDetail || "Final"
            : "Preview"
      }
      away={{
        abbrev: game.away.abbrev,
        record: game.away.record,
        muted: loserMuted(game.final, Number.isFinite(awayN) ? awayN : null, Number.isFinite(homeN) ? homeN : null, "away"),
        logo: (
          <TeamLogo
            src={game.away.logo}
            color={game.away.color}
            alternateColor={game.away.alternateColor}
            dim={loserMuted(game.final, Number.isFinite(awayN) ? awayN : null, Number.isFinite(homeN) ? homeN : null, "away")}
          />
        ),
      }}
      home={{
        abbrev: game.home.abbrev,
        record: game.home.record,
        muted: loserMuted(game.final, Number.isFinite(awayN) ? awayN : null, Number.isFinite(homeN) ? homeN : null, "home"),
        logo: (
          <TeamLogo
            src={game.home.logo}
            color={game.home.color}
            alternateColor={game.home.alternateColor}
            dim={loserMuted(game.final, Number.isFinite(awayN) ? awayN : null, Number.isFinite(homeN) ? homeN : null, "home")}
          />
        ),
      }}
      awayScore={pregame ? null : game.away.score}
      homeScore={pregame ? null : game.home.score}
      detail={pregame ? null : game.shortDetail || game.status}
      preview={pregame ? centralStartLabel(game.startIso, game.shortDetail || game.status) : null}
      headerExtra={
        <HeatMeta
          heat={heat}
          extra={
            headerExtra ?? (
              <span className="max-w-[7rem] truncate">{game.league}</span>
            )
          }
        />
      }
    >
      <ScoreboardBroadcasts broadcasts={game.broadcasts} />
      {!pregame && game.venue ? <FootLine>{game.venue}</FootLine> : null}
      {footer}
    </ScoreboardCard>
  );
});

function sportChip(label: string, favorite: boolean) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="max-w-[6.5rem] truncate rounded-sm bg-white/[0.07] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#c5cce0]">
        {label}
      </span>
      {favorite ? (
        <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-cream">
          Favorite
        </span>
      ) : null}
    </span>
  );
}

function whyFooter(reasons: string[] | undefined) {
  const why = ruwtWhyReasons(reasons, 2);
  if (!why.length) return null;
  return <FootLine>{why.join(" · ")}</FootLine>;
}

/** Top-games board. Heat order stays with the slate; this is only the card. */
export const SlateScoreboardCard = memo(function SlateScoreboardCard({
  item,
  favorite,
  wsBoard,
}: {
  item: UnifiedRuwtItem;
  favorite: boolean;
  wsBoard?: MlbWsOddsBoard | null;
}) {
  const label = item.sport === "soccer" ? item.game.league || "Soccer" : RUWT_SPORT_LABEL[item.sport];
  const chip = sportChip(label, favorite);
  const footer = whyFooter(item.game.reasons);
  if (item.sport === "mlb") {
    return (
      <MlbScoreboardCard game={item.game} heat={item.score} wsBoard={wsBoard} headerExtra={chip} footer={footer} />
    );
  }
  if (item.sport === "nfl") {
    return <NflScoreboardCard game={item.game} heat={item.score} headerExtra={chip} footer={footer} />;
  }
  if (item.sport === "nhl") {
    return <NhlScoreboardCard game={item.game} heat={item.score} headerExtra={chip} footer={footer} />;
  }
  if (item.sport === "cfb") {
    return <CfbScoreboardCard game={item.game} heat={item.score} headerExtra={chip} footer={footer} />;
  }
  return <SoccerScoreboardCard game={item.game} heat={item.score} headerExtra={chip} footer={footer} />;
});
