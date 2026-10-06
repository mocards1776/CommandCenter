/**
 * The recap every Times game wrap sets: banner, line, chips, photo, box.
 * Full for favorites and marquee games; compact for the rest of the desk.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EspnAgate, Face, KeyStats, Leaders, Linescore, MlbAgate, ScoreMast } from "@/components/newspaper/BoxScore";
import {
  compactScoringByPeriod,
  ESPN_BOX_PATHS,
  fetchEspnBox,
  flattenScoringRows,
  keyStats,
  scoringTail,
  type CompactScoringLine,
  type EspnBox,
  type FlatScoringRow,
  type ScoringFitKind,
  type ScoringPeriod,
} from "@/lib/newspaper-agate";
import { gameClock, type BoxGame } from "@/lib/newspaper-box";
import { folioFillBudget } from "@/lib/newspaper-page";
import {
  boxGameFromPack,
  recapIsFull,
  recapPackFor,
  recapPaint,
  recapPhotoKind,
  recapPullQuote,
  type RecapCardBits,
  type RecapGamePack,
  type RecapLeader,
} from "@/lib/newspaper-recap";
import type { GameWrapCard, TeamInfobox } from "@/lib/newspaper-sports";
import { cn } from "@/lib/utils";
import { PersonName } from "./PlayerPop";
import { useReader } from "./reader-context";

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

function RecapSplitArt({ pack, card }: { pack: RecapGamePack; card?: boolean }) {
  return (
    <figure className={cn("tt-recap-photo", "split", card ? "card" : "wide")} aria-hidden="true">
      <div className="tt-recap-split">
        {[pack.away, pack.home].map((side) => (
          <div
            key={side.abbrev || side.short}
            className="tt-recap-split-side"
            style={{ background: recapPaint(side.color) }}
          >
            {side.logo ? (
              <img src={side.logo} alt="" />
            ) : (
              <span className="tt-recap-split-ab">{side.abbrev || side.short}</span>
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}

export function RecapPhoto({
  url,
  width,
  caption,
  card,
  game,
  bits,
}: {
  url: string | null | undefined;
  width?: number | null;
  caption?: string | null;
  /** Sport-page cards always float a small cut, never a wide banner. */
  card?: boolean;
  game?: BoxGame | null;
  bits?: RecapCardBits;
}) {
  const pack = recapPackFor(bits ?? {}, game ?? null);
  if (!url) {
    return pack ? <RecapSplitArt pack={pack} card={card} /> : null;
  }
  const kind = card ? "card" : recapPhotoKind(url, width);
  if (kind === "none") return pack ? <RecapSplitArt pack={pack} card={card} /> : null;
  return (
    <figure className={cn("tt-recap-photo", kind)}>
      <img src={url} alt="" loading="lazy" decoding="async" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export function RecapChrome({
  card,
  game,
  compact,
  shortNames,
  slim,
}: {
  card: RecapCardBits;
  game?: BoxGame | null;
  compact?: boolean;
  /** Narrow rails: print KC / LV, not Chiefs / Raiders, so the score never collides. */
  shortNames?: boolean;
  slim?: boolean;
}) {
  const pack = recapPackFor(card, game ?? null);
  const box = recapBoxGame(card, game);
  if (!box || (!box.final && !box.live)) return null;
  const tight = Boolean(compact || slim);
  return (
    <section className={cn("tt-recap-chrome", compact && "compact", slim && "slim")}>
      <ScoreMast game={box} shortNames={shortNames} slim={slim} />
      {slim ? null : (
        <header className="tt-recap-linehead">
          <b>{gameClock(box)}</b>
          <span>{[box.round, box.series, pack?.venue || box.venue].filter(Boolean).join(" · ")}</span>
        </header>
      )}
      <Linescore game={box} compact={compact || slim} />
      {pack ? <RecapChips pack={pack} path={box.path} compact={tight} /> : <Leaders game={box} max={3} />}
    </section>
  );
}

export function RecapBox({
  card,
  game,
  compact,
  forceFull,
  hideScoring,
}: {
  card: RecapCardBits & { gameId?: string | null; leaguePath?: string | null };
  game?: BoxGame | null;
  compact?: boolean;
  forceFull?: boolean;
  /** Section A leftover already sets a fitted scoring table. */
  hideScoring?: boolean;
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
        <EspnAgate box={espnBox.data} path={espnBox.data.game.path} condensed={compact} hideScoring={hideScoring} />
      ) : showMlb && game ? (
        <MlbAgate game={game} />
      ) : espnBox.isLoading ? (
        <p className="tt-agate-wait">Setting the box…</p>
      ) : null}
    </section>
  );
}

function ScoringPlayTable({
  rows,
  game,
  compact,
}: {
  rows: FlatScoringRow[] | CompactScoringLine[];
  game: BoxGame;
  compact?: boolean;
}) {
  const scoreHead = `${game.away.abbrev}-${game.home.abbrev}`;
  if (compact) {
    const lines = rows as CompactScoringLine[];
    return (
      <table className="tt-recap-fill-score compact">
        <thead>
          <tr>
            <th />
            <th className="n" colSpan={3}>
              Plays
            </th>
            <th>{scoreHead}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={`${line.label}-${i}`}>
              <td className="per">{line.label}</td>
              <td className="n play" colSpan={3}>
                {line.plays}
              </td>
              <td>{line.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const plays = rows as FlatScoringRow[];
  return (
    <table className="tt-recap-fill-score">
      <thead>
        <tr>
          <th />
          <th>Time</th>
          <th className="n">Team</th>
          <th className="n">Play</th>
          <th>{scoreHead}</th>
        </tr>
      </thead>
      <tbody>
        {plays.map((row, i) => (
          <tr key={`${row.period}-${row.clock}-${i}`}>
            <td className="per">{row.period}</td>
            <td>{row.clock}</td>
            <td className="n">{row.team}</td>
            <td className="n play">{row.play}</td>
            <td>{row.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function tableHost(host: HTMLElement): HTMLElement | null {
  return (host.closest(".tt-recap-fill-tables") as HTMLElement | null) ?? (host.closest(".tt-recap-fill") as HTMLElement | null);
}

function scoringBudget(host: HTMLElement): number {
  const slot = host.closest(".tt-recap-slot") as HTMLElement | null;
  const fill = host.closest(".tt-recap-fill") as HTMLElement | null;
  const room = folioFillBudget(host);
  if (slot && fill?.classList.contains("scoring")) {
    return Math.max(0, Math.min(room, Math.floor(slot.clientHeight * 0.42)));
  }
  if (!fill) return Math.min(host.clientHeight, room);
  // Whole rows first: spend leftover on scoring, leave a key-stats strip when
  // team stats sit in the same pane. Photos live in extras and take the rest.
  const hasStats = Boolean(fill.querySelector(".tt-recap-stats"));
  return Math.max(0, Math.min(room, Math.floor(fill.clientHeight - (hasStats ? 88 : 0))));
}

function statsBudget(host: HTMLElement): number {
  const tables = tableHost(host);
  if (!tables) return host.clientHeight;
  let used = 0;
  for (const child of Array.from(tables.children) as HTMLElement[]) {
    if (child === host || child.dataset.scoringMeasure || child.dataset.statsMeasure) continue;
    used += child.offsetHeight;
  }
  return Math.max(0, tables.clientHeight - used);
}

/**
 * Only whole scoring rows. Full play-by-play when it fits; otherwise a
 * by-period summary (or the last N complete plays) and a Full story link.
 * Never paints a half-row into the folio.
 */
function RecapScoringFit({
  periods,
  game,
  card,
  density = "card",
}: {
  periods: ScoringPeriod[];
  game: BoxGame;
  card: GameWrapCard;
  density?: "card" | "page";
}) {
  const open = useReader();
  const hostRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const compactRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const moreRef = useRef<HTMLParagraphElement>(null);
  const flat = useMemo(() => flattenScoringRows(periods), [periods]);
  const compact = useMemo(() => compactScoringByPeriod(periods), [periods]);
  const [fit, setFit] = useState<{ kind: ScoringFitKind; n: number }>({ kind: "compact", n: compact.length });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const apply = () => {
      const budget = scoringBudget(host);
      const fullH = fullRef.current?.offsetHeight ?? Number.POSITIVE_INFINITY;
      const compactH = compactRef.current?.offsetHeight ?? Number.POSITIVE_INFINITY;
      const rowH = Math.max(14, rowRef.current?.offsetHeight ?? 16);
      const moreH = moreRef.current?.offsetHeight ?? 16;
      const headH = Math.max(20, compactH - compact.length * rowH);
      if (fullH <= budget + 1) {
        setFit({ kind: "full", n: flat.length });
        return;
      }
      const n = Math.floor((budget - headH - moreH) / rowH);
      if (n >= 2) {
        setFit({ kind: "tail", n });
        return;
      }
      if (compactH <= budget + 1) {
        setFit({ kind: "compact", n: compact.length });
        return;
      }
      if (n >= 1) setFit({ kind: "tail", n });
      else setFit({ kind: "link", n: 0 });
    };
    const tables = tableHost(host);
    const fill = host.closest(".tt-recap-fill");
    const slot = host.closest(".tt-recap-slot");
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    if (tables) ro.observe(tables);
    if (fill) ro.observe(fill);
    if (slot) ro.observe(slot);
    apply();
    return () => ro.disconnect();
  }, [flat.length, compact.length, density]);

  if (!flat.length) return null;
  const truncated = fit.kind !== "full";
  const shownRows = fit.kind === "tail" ? scoringTail(flat, fit.n) : flat;
  return (
    <div className="tt-recap-fill-block tt-recap-scoring" ref={hostRef}>
      <div className="tt-recap-scoring-measure" data-scoring-measure="1" aria-hidden>
        <div ref={fullRef}>
          <h4>Scoring</h4>
          <ScoringPlayTable rows={flat} game={game} />
        </div>
        <div ref={compactRef}>
          <h4>Scoring</h4>
          <ScoringPlayTable rows={compact} game={game} compact />
          <p className="tt-recap-scoring-more">Full scoring in Full story ›</p>
        </div>
        <table className="tt-recap-fill-score">
          <tbody>
            <tr ref={rowRef}>
              <td className="per">4th Q</td>
              <td>0:00</td>
              <td className="n">KC</td>
              <td className="n play">Measure</td>
              <td>0-0</td>
            </tr>
          </tbody>
        </table>
        <p className="tt-recap-scoring-more" ref={moreRef}>
          Full scoring in Full story ›
        </p>
      </div>
      {fit.kind === "link" ? null : (
        <>
          <h4>Scoring</h4>
          {fit.kind === "compact" ? (
            <ScoringPlayTable rows={compact} game={game} compact />
          ) : (
            <ScoringPlayTable rows={shownRows} game={game} />
          )}
        </>
      )}
      {truncated ? (
        <p className="tt-recap-scoring-more">
          <button type="button" className="wsj-a wsj-story-link" onClick={() => open({ card, game })}>
            Full scoring in Full story <span aria-hidden="true">›</span>
          </button>
        </p>
      ) : null}
    </div>
  );
}

function TeamStatTable({
  box,
  rows,
}: {
  box: EspnBox;
  rows: EspnBox["teamStats"];
}) {
  if (!rows.length) return null;
  return (
    <>
      <h4>Team stats</h4>
      <table className="tt-recap-fill-stats">
        <thead>
          <tr>
            <th className="n" />
            <th>{box.game.away.abbrev}</th>
            <th>{box.game.home.abbrev}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.label} className={s.sub ? "sub" : undefined}>
              <td className="n">{s.label}</td>
              <td>{s.away}</td>
              <td>{s.home}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function RecapShots({ box }: { box: EspnBox }) {
  if (!box.shots) return null;
  return (
    <div className="tt-recap-fill-block">
      <h4>Shots on goal</h4>
      <table className="tt-recap-fill-stats">
        <thead>
          <tr>
            <th className="n" />
            {box.shots.periods.map((p) => (
              <th key={p}>{p}</th>
            ))}
            <th>T</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="n">{box.game.away.short}</td>
            {box.shots.away.map((v, i) => (
              <td key={i}>{v == null ? "–" : v}</td>
            ))}
            <td>{box.shots.awayTotal}</td>
          </tr>
          <tr>
            <td className="n">{box.game.home.short}</td>
            {box.shots.home.map((v, i) => (
              <td key={i}>{v == null ? "–" : v}</td>
            ))}
            <td>{box.shots.homeTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type StatsFitKind = "full" | "key" | "tail" | "link";

function statsHead(rows: EspnBox["teamStats"], n: number): EspnBox["teamStats"] {
  if (n >= rows.length) return rows;
  const cut = rows.slice(0, Math.max(0, n));
  while (cut.length && cut[0]?.sub) cut.shift();
  return cut;
}

/** Whole team-stat rows only. Full table when it fits; otherwise key numbers, a short tail, or Full story. */
function RecapTeamStats({
  box,
  card,
  density,
}: {
  box: EspnBox;
  card: GameWrapCard;
  density: "card" | "page";
}) {
  const open = useReader();
  const hostRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const moreRef = useRef<HTMLParagraphElement>(null);
  const shotsRef = useRef<HTMLDivElement>(null);
  const keys = useMemo(() => keyStats(box), [box]);
  const all = box.teamStats;
  const preferred = density === "card" && keys.length ? keys : all;
  const [fit, setFit] = useState<{ kind: StatsFitKind; n: number; shots: boolean }>({
    kind: preferred === keys && keys.length ? "key" : "full",
    n: preferred.length,
    shots: Boolean(box.shots),
  });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const apply = () => {
      const budget = statsBudget(host);
      const fullH = fullRef.current?.offsetHeight ?? Number.POSITIVE_INFINITY;
      const keyH = keyRef.current?.offsetHeight ?? Number.POSITIVE_INFINITY;
      const rowH = Math.max(14, rowRef.current?.offsetHeight ?? 16);
      const moreH = moreRef.current?.offsetHeight ?? 16;
      const shotsH = shotsRef.current?.offsetHeight ?? 0;
      const headH = Math.max(20, (Number.isFinite(fullH) ? fullH : keyH) - preferred.length * rowH - shotsH);
      const withShots = (h: number) => h + (box.shots ? shotsH : 0);
      if (withShots(fullH) <= budget + 1) {
        setFit({ kind: "full", n: all.length, shots: Boolean(box.shots) });
        return;
      }
      if (fullH <= budget + 1) {
        setFit({ kind: "full", n: all.length, shots: false });
        return;
      }
      if (keys.length && withShots(keyH) <= budget + 1) {
        setFit({ kind: "key", n: keys.length, shots: Boolean(box.shots) });
        return;
      }
      if (keys.length && keyH <= budget + 1) {
        setFit({ kind: "key", n: keys.length, shots: false });
        return;
      }
      const n = Math.floor((budget - headH - moreH) / rowH);
      if (n >= 1) setFit({ kind: "tail", n, shots: false });
      else setFit({ kind: "link", n: 0, shots: false });
    };
    const tables = tableHost(host);
    const fill = host.closest(".tt-recap-fill");
    const slot = host.closest(".tt-recap-slot");
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    if (tables) ro.observe(tables);
    if (fill) ro.observe(fill);
    if (slot) ro.observe(slot);
    apply();
    return () => ro.disconnect();
  }, [all.length, box.shots, keys.length, preferred.length]);

  if (!all.length && !box.shots) return null;
  const rows = fit.kind === "key" ? keys : fit.kind === "tail" ? statsHead(preferred, fit.n) : all;
  const truncated = fit.kind !== "full" || (Boolean(box.shots) && !fit.shots);
  return (
    <div className="tt-recap-fill-block tt-recap-stats" ref={hostRef}>
      <div className="tt-recap-stats-measure" data-stats-measure="1" aria-hidden>
        <div ref={fullRef}>
          <TeamStatTable box={box} rows={all} />
        </div>
        <div ref={keyRef}>
          {keys.length ? <TeamStatTable box={box} rows={keys} /> : <KeyStats box={box} />}
        </div>
        <table className="tt-recap-fill-stats">
          <tbody>
            <tr ref={rowRef}>
              <td className="n">Measure</td>
              <td>0</td>
              <td>0</td>
            </tr>
          </tbody>
        </table>
        <div ref={shotsRef}>{box.shots ? <RecapShots box={box} /> : null}</div>
        <p className="tt-recap-scoring-more" ref={moreRef}>
          Full team stats in Full story ›
        </p>
      </div>
      {fit.kind === "link" ? null : density === "card" && fit.kind === "key" && keys.length ? (
        <KeyStats box={box} />
      ) : (
        <TeamStatTable box={box} rows={rows} />
      )}
      {fit.shots ? <RecapShots box={box} /> : null}
      {truncated ? (
        <p className="tt-recap-scoring-more">
          <button type="button" className="wsj-a wsj-story-link" onClick={() => open({ card, game: box.game })}>
            Full team stats in Full story <span aria-hidden="true">›</span>
          </button>
        </p>
      ) : null}
    </div>
  );
}

function nextFromTeam(team: TeamInfobox | null | undefined): { label: string; when: string | null; tv: string | null; line: string | null } | null {
  if (!team) return null;
  const chip = team.snap.nextGame;
  const up = team.detail?.upcoming?.[0];
  const label = chip?.label || up?.label;
  if (!label) return null;
  return {
    label,
    when: chip?.when || up?.when || null,
    tv: chip?.detail || up?.detail || null,
    line: team.odds,
  };
}

/**
 * Leftover recap matter, in order: box tables, second photo, pull quote,
 * next game + standings, related headlines. Grows to fill the card or page
 * so a folio never ends on an empty band.
 */
export function RecapFill({
  card,
  game,
  team,
  density = "card",
  skipBox,
  only = "all",
}: {
  card: GameWrapCard;
  game?: BoxGame | null;
  team?: TeamInfobox | null;
  density?: "card" | "page";
  /** RecapBox already sets team stats / shots; scoring still fits here. */
  skipBox?: boolean;
  /** Section A splits scoring (first) from leftover matter (after the box). */
  only?: "all" | "scoring" | "matter";
}) {
  const path = game?.path ?? card.leaguePath ?? null;
  const eventId = game?.espnEventId ?? (card.gameId && /^\d{6,}$/.test(card.gameId) ? card.gameId : null);
  const wantBox = Boolean(eventId && path && ESPN_BOX_PATHS.has(path));
  const espnBox = useQuery({
    queryKey: ["tt-espn-box", path, eventId],
    queryFn: () => fetchEspnBox(path!, eventId!),
    enabled: wantBox,
    staleTime: game?.live ? 60_000 : 30 * 60_000,
  });
  const box = espnBox.data ?? null;
  const quote = recapPullQuote(card.body ?? "");
  const photo2 = (box?.photos ?? []).find((p) => p.url && p.url !== card.photo) ?? null;
  const next = nextFromTeam(team);
  const nextLine = next ? [next.label, next.when, next.tv, next.line].filter(Boolean).join(" · ") : box?.nextUp ?? null;
  const standings = (
    card.division?.length
      ? card.division.map((r) => ({ team: r.team, record: r.record, me: r.me }))
      : (team?.detail?.division ?? []).map((r) => ({ team: r.team, record: r.record, me: r.isMe }))
  ).slice(0, 6);
  const related = card.related ?? [];
  const showScoring = only !== "matter" && Boolean(box?.scoring.length);
  const showStats = only !== "scoring" && Boolean(!skipBox && box && (keyStats(box).length || box.teamStats.length || box.shots));
  const showExtra = only !== "scoring" && Boolean(photo2 || quote || nextLine || standings.length || related.length);
  const hasMatter = Boolean(showScoring || showStats || showExtra);
  const fillRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    const apply = () => {
      el.style.maxHeight = `${folioFillBudget(el, true)}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el.closest(".wsj-sheet") ?? el);
    return () => ro.disconnect();
  }, [hasMatter, showScoring, showStats, showExtra, density, only]);
  if (!hasMatter) return null;
  return (
    <div ref={fillRef} className={cn("tt-recap-fill", density, only !== "all" && only)}>
      {showScoring || showStats ? (
        <div className="tt-recap-fill-tables">
          {showScoring && box ? <RecapScoringFit periods={box.scoring} game={box.game} card={card} density={density} /> : null}
          {showStats && box ? <RecapTeamStats box={box} card={card} density={density} /> : null}
        </div>
      ) : null}
      {showExtra ? (
        <RecapFillExtras
          card={card}
          photo2={photo2}
          quote={quote}
          nextLine={nextLine}
          standings={standings}
          related={related}
        />
      ) : null}
    </div>
  );
}

function RecapFillExtras({
  card,
  photo2,
  quote,
  nextLine,
  standings,
  related,
}: {
  card: GameWrapCard;
  photo2: { url: string; caption: string | null } | null;
  quote: string | null;
  nextLine: string | null;
  standings: { team: string; record: string; me?: boolean }[];
  related: NonNullable<GameWrapCard["related"]>;
}) {
  const open = useReader();
  const hostRef = useRef<HTMLDivElement>(null);
  const order = [photo2 ? "photo" : null, quote ? "quote" : null, nextLine ? "next" : null, standings.length ? "standings" : null, related.length ? "related" : null].filter(
    (k): k is "photo" | "quote" | "next" | "standings" | "related" => Boolean(k),
  );
  const [drop, setDrop] = useState(0);

  useLayoutEffect(() => {
    setDrop(0);
  }, [photo2?.url, quote, nextLine, standings.length, related.length]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !order.length) return;
    const apply = () => {
      if (host.clientHeight < 8) return;
      if (host.scrollHeight > host.clientHeight + 2 && drop < order.length) {
        setDrop((n) => n + 1);
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => ro.disconnect();
  }, [drop, order.length]);

  if (!order.length || drop >= order.length) return null;
  const shown = new Set(order.slice(0, order.length - drop));
  const photo = shown.has("photo");
  const showQuote = shown.has("quote");
  const showNext = shown.has("next");
  const showStand = shown.has("standings");
  const showRelated = shown.has("related");
  return (
    <div className="tt-recap-fill-extras" ref={hostRef}>
      {photo && photo2 ? (
        <figure className="tt-recap-fill-photo">
          <img src={photo2.url} alt="" loading="lazy" decoding="async" />
          {photo2.caption ? <figcaption>{photo2.caption}</figcaption> : null}
        </figure>
      ) : null}
      {showQuote && quote ? <blockquote className="tt-recap-fill-quote">{quote}</blockquote> : null}
      {showNext && nextLine ? (
        <aside className="tt-recap-fill-next">
          <h4>Next</h4>
          <p>{nextLine}</p>
        </aside>
      ) : null}
      {showStand ? (
        <div className="tt-recap-fill-block">
          <h4>Standings</h4>
          <table className="tt-recap-fill-stats">
            <tbody>
              {standings.map((row) => (
                <tr key={row.team} className={row.me ? "me" : undefined}>
                  <td className="n">{row.team}</td>
                  <td>{row.record}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {showRelated ? (
        <ul className="tt-recap-fill-related">
          {related.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="wsj-a wsj-story-link"
                onClick={() =>
                  open({
                    card: {
                      ...card,
                      id: item.id,
                      headline: item.headline,
                      dek: item.source,
                      body: null,
                      wrapHref: item.href,
                      feedUrl: item.href,
                      recapGame: null,
                      photo: null,
                      related: undefined,
                    },
                  })
                }
              >
                {item.source ? <em>{item.source}</em> : null}
                {item.headline}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
