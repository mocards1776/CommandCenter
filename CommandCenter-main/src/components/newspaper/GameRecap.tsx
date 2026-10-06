/**
 * The recap every Times game wrap sets: banner, line, chips, photo, box.
 * Full for favorites and marquee games; compact for the rest of the desk.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EspnAgate, Face, Leaders, Linescore, MlbAgate, ScoreMast } from "@/components/newspaper/BoxScore";
import { ESPN_BOX_PATHS, fetchEspnBox } from "@/lib/newspaper-agate";
import { gameClock, type BoxGame } from "@/lib/newspaper-box";
import {
  boxGameFromPack,
  recapIsFull,
  recapPackFor,
  recapPhotoKind,
  type RecapCardBits,
  type RecapGamePack,
  type RecapLeader,
} from "@/lib/newspaper-recap";
import { cn } from "@/lib/utils";
import { PersonName } from "./PlayerPop";

export function recapBoxGame(card: RecapCardBits, game: BoxGame | null | undefined): BoxGame | null {
  const pack = recapPackFor(card, game ?? null);
  if (game) {
    if (!pack) return game;
    return {
      ...game,
      away: { ...game.away, color: pack.away.color, logo: pack.away.logo || game.away.logo },
      home: { ...game.home, color: pack.home.color, logo: pack.home.logo || game.home.logo },
      venue: game.venue || pack.venue,
      leaders: pack.leaders.length
        ? pack.leaders.map((l) => ({
            label: l.label,
            name: l.name,
            line: l.line,
            headshot: l.headshot,
            team: l.team,
            id: l.id,
          }))
        : game.leaders,
    };
  }
  return pack ? boxGameFromPack(pack, null) : null;
}

export function RecapChips({
  pack,
  path,
  compact,
}: {
  pack: RecapGamePack;
  path: string;
  compact?: boolean;
}) {
  if (!pack.leaders.length) return null;
  return (
    <ul className={cn("tt-recap-chips", compact && "compact")}>
      {pack.leaders.map((l) => (
        <li key={`${l.label}-${l.name}`}>
          {l.headshot ? <Face person={l} size={compact ? "sm" : "md"} /> : l.team || pack.away.logo ? (
            <img
              className={cn("tt-recap-chip-logo", compact && "sm")}
              src={l.headshot || teamLogoFor(pack, l) || ""}
              alt=""
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          ) : (
            <Face person={l} size={compact ? "sm" : "md"} />
          )}
          <span>
            <em>
              {l.label}
              {l.team ? ` · ${l.team}` : ""}
            </em>
            <b>
              <PersonName path={path} id={l.id} name={l.name} />
            </b>
            {l.line ? <i>{l.line}</i> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function teamLogoFor(pack: RecapGamePack, leader: RecapLeader): string | null {
  if (leader.team && leader.team === pack.home.abbrev) return pack.home.logo;
  if (leader.team && leader.team === pack.away.abbrev) return pack.away.logo;
  return pack.home.logo || pack.away.logo;
}

export function RecapPhoto({
  url,
  width,
  caption,
}: {
  url: string | null | undefined;
  width?: number | null;
  caption?: string | null;
}) {
  const [measured, setMeasured] = useState<number | null>(null);
  const native = typeof width === "number" && width > 0 ? width : measured;
  const kind = recapPhotoKind(url, native);
  if (kind === "none" || !url) return null;
  return (
    <figure
      className={cn("tt-recap-photo", kind)}
      style={native && kind === "fit" ? { maxWidth: native } : undefined}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          const w = e.currentTarget.naturalWidth;
          if (w > 0) setMeasured((prev) => (prev && prev <= w ? prev : w));
        }}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export function RecapChrome({
  card,
  game,
  compact,
  shortNames,
}: {
  card: RecapCardBits;
  game?: BoxGame | null;
  compact?: boolean;
  /** Narrow rails: print KC / LV, not Chiefs / Raiders, so the score never collides. */
  shortNames?: boolean;
}) {
  const pack = recapPackFor(card, game ?? null);
  const box = recapBoxGame(card, game);
  if (!box || (!box.final && !box.live)) return null;
  return (
    <section className={cn("tt-recap-chrome", compact && "compact")}>
      <ScoreMast game={box} shortNames={shortNames} />
      <header className="tt-recap-linehead">
        <b>{gameClock(box)}</b>
        <span>{[box.round, box.series, pack?.venue || box.venue].filter(Boolean).join(" · ")}</span>
      </header>
      <Linescore game={box} compact={compact} />
      {pack ? <RecapChips pack={pack} path={box.path} compact={compact} /> : <Leaders game={box} max={3} />}
    </section>
  );
}

export function RecapBox({
  card,
  game,
  compact,
  forceFull,
}: {
  card: RecapCardBits & { gameId?: string | null; leaguePath?: string | null };
  game?: BoxGame | null;
  compact?: boolean;
  forceFull?: boolean;
}) {
  const show = forceFull || recapIsFull(card);
  const path = game?.path ?? card.leaguePath ?? null;
  const eventId = game?.espnEventId ?? (card.gameId && /^\d{6,}$/.test(card.gameId) ? card.gameId : null);
  const espnBoxed = Boolean(show && eventId && path && ESPN_BOX_PATHS.has(path));
  const espnBox = useQuery({
    queryKey: ["tt-espn-box", path, eventId],
    queryFn: () => fetchEspnBox(path!, eventId!),
    enabled: espnBoxed,
    staleTime: game?.live ? 60_000 : 30 * 60_000,
  });
  const showMlb = Boolean(show && game?.path === "baseball/mlb" && game.gamePk && !espnBox.data);
  if (!show) return null;
  if (!espnBoxed && !showMlb) return null;
  return (
    <section className={cn("tt-recap-box", compact && "condensed")}>
      <h3>Box score</h3>
      {espnBox.data ? (
        <EspnAgate box={espnBox.data} path={espnBox.data.game.path} condensed={compact} />
      ) : showMlb && game ? (
        <MlbAgate game={game} />
      ) : espnBox.isLoading ? (
        <p className="tt-agate-wait">Setting the box…</p>
      ) : null}
    </section>
  );
}
