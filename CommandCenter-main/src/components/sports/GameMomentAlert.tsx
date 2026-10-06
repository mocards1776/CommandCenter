import { useEffect, useState } from "react";
import LogoPlate from "@/components/sports/LogoPlate";
import { useGameMomentAlerts } from "@/hooks/useGameMomentAlerts";
import {
  diffGameMoments,
  momentAccent,
  momentDurationMs,
  type GameMoment,
  type GameMomentSnapshot,
} from "@/lib/game-moments";
import { cn } from "@/lib/utils";

export type { GameMoment };

function Motif({ kind }: { kind: GameMoment["kind"] }) {
  const stroke = "currentColor";
  if (kind === "goal") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <ellipse cx="32" cy="32" rx="26" ry="16" fill="none" stroke={stroke} strokeWidth="1.2" />
        <circle cx="32" cy="32" r="5.5" fill="none" stroke={stroke} strokeWidth="1.4" />
        <path d="M6 32h52" fill="none" stroke={stroke} strokeWidth="0.8" opacity="0.55" />
      </svg>
    );
  }
  if (kind === "touchdown" || kind === "field_goal" || kind === "safety" || kind === "score") {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
        <ellipse cx="32" cy="32" rx="22" ry="13" fill="none" stroke={stroke} strokeWidth="1.3" />
        <path d="M18 32h28M28 24.5v15M36 24.5v15" fill="none" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
      <path
        d="M32 54 L54 32 L32 10 L10 32 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="1.3"
        className="gm-alert-line"
      />
      <circle cx="32" cy="32" r="2.2" fill="currentColor" />
    </svg>
  );
}

/**
 * Fixed, pointer-light overlay. Apple-esque: dark glass, faded team mark
 * (no cream disc), hairline draw, restrained motion.
 */
export default function GameMomentAlert({
  moment,
  onDismiss,
}: {
  moment: GameMoment | null;
  onDismiss: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setLeaving(false);
    if (!moment) return;
    const hold = window.setTimeout(() => setLeaving(true), momentDurationMs(moment.kind) - 280);
    const done = window.setTimeout(onDismiss, momentDurationMs(moment.kind));
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(done);
    };
  }, [moment, onDismiss]);

  if (!moment) return null;

  const accent = momentAccent(moment.kind, moment.team?.color);
  const score = moment.score;

  return (
    <div
      className={cn("gm-alert-root", leaving && "gm-alert-root-out")}
      role="status"
      aria-live="polite"
      aria-label={`${moment.headline}${moment.subhead ? ` — ${moment.subhead}` : ""}`}
    >
      <button
        type="button"
        className="gm-alert-veil"
        aria-label="Dismiss moment"
        onClick={onDismiss}
      />
      <article
        className={cn(
          "gm-alert-card",
          moment.intensity === "high" ? "gm-alert-card-high" : "gm-alert-card-med",
        )}
        style={{ ["--gm-accent" as string]: accent }}
        onClick={onDismiss}
      >
        {moment.team?.logo ? (
          <LogoPlate
            src={moment.team.logo}
            alt=""
            className="gm-alert-mark pointer-events-none absolute -right-3 -top-4 h-36 w-36 opacity-[0.16] drop-shadow-[0_0_1px_rgba(255,255,255,0.9)]"
          />
        ) : null}

        <div className="relative flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0">
            {moment.player?.headshot ? (
              <img
                src={moment.player.headshot}
                alt=""
                className="h-12 w-12 rounded-full object-cover ring-1 ring-white/15"
              />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.06] text-[var(--gm-accent)]">
                <span className="h-7 w-7">
                  <Motif kind={moment.kind} />
                </span>
              </span>
            )}
            <span className="gm-alert-ring" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-white/45">
              {moment.headline}
            </p>
            <p className="truncate text-[22px] font-semibold tracking-tight text-white">
              {moment.subhead ?? moment.team?.abbrev ?? "—"}
            </p>
            {moment.periodLabel ? (
              <p className="mt-0.5 text-[11px] tracking-[0.08em] text-white/40">
                {moment.periodLabel}
                {moment.team?.abbrev ? ` · ${moment.team.abbrev}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <svg className="gm-alert-rule mt-3.5 h-[2px] w-full" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden>
          <line
            className="gm-alert-line"
            x1="0"
            y1="1"
            x2="100"
            y2="1"
            stroke="var(--gm-accent)"
            strokeWidth="1.4"
            pathLength={1}
          />
        </svg>

        {score ? (
          <div className="gm-alert-score mt-3 flex items-baseline justify-center gap-3 tabular-nums">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-white/40">
              {score.awayAbbrev}
            </span>
            <span className="text-[28px] font-semibold tracking-tight text-white">
              {score.away}
            </span>
            <span className="text-[13px] text-white/25">–</span>
            <span className="text-[28px] font-semibold tracking-tight text-white">
              {score.home}
            </span>
            <span className="text-[11px] font-semibold tracking-[0.14em] text-white/40">
              {score.homeAbbrev}
            </span>
          </div>
        ) : null}

        {moment.detail ? (
          <p className="mt-2 line-clamp-2 text-center text-[12px] leading-snug text-white/45">
            {moment.detail}
          </p>
        ) : null}
      </article>
    </div>
  );
}

export function GameMomentLayer({
  snapshot,
}: {
  snapshot: GameMomentSnapshot | null | undefined;
}) {
  const { moment, dismiss } = useGameMomentAlerts(snapshot, diffGameMoments);
  return <GameMomentAlert moment={moment} onDismiss={dismiss} />;
}
