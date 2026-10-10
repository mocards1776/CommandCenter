import {
  composeWatchPage,
  preparePrintedWatch,
  watchClockState,
  watchContext,
  watchLeagueColor,
  watchLeagueLabel,
  watchLogo,
  watchStarters,
  watchTeamShort,
  type WatchGame,
  type WatchListing,
  type WatchNetwork,
  type WatchSide,
} from "@/lib/newspaper-watch";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./WatchGuide.css";

function Crest({ side, league, size }: { side: WatchSide; league: WatchListing["league"]; size: "lg" | "md" | "sm" }) {
  const src = watchLogo(side, league);
  return src ? (
    <img className={`tt-watch-crest ${size}`} src={src} alt="" loading="lazy" />
  ) : (
    <span className={`tt-watch-crest ${size} blank`}>{side.abbrev.slice(0, 3)}</span>
  );
}

function LeagueChip({ game }: { game: WatchListing }) {
  return (
    <span className="tt-watch-chip" style={{ background: watchLeagueColor(game.league) }}>
      {watchLeagueLabel(game)}
    </span>
  );
}

function Networks({ networks }: { networks: WatchNetwork[] }) {
  if (!networks.length) return null;
  return (
    <span className="tt-watch-nets">
      {networks.map((n, i) => (
        <span key={`${n.name}-${i}`} className={n.streaming ? "stream" : undefined}>
          {n.name}
        </span>
      ))}
    </span>
  );
}

function teamTitle(side: WatchSide): string {
  return side.rank ? `No. ${side.rank} ${watchTeamShort(side)}` : watchTeamShort(side);
}

function Feature({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  const showScore = clock.kind !== "pre";
  const starters = watchStarters(game);
  return (
    <section className="tt-tv-feature" aria-label="Game of the day" style={{ ["--tt-league" as string]: watchLeagueColor(game.league) }}>
      <p className="tt-tv-flag">
        <span>Game of the Day</span>
        <LeagueChip game={game} />
        <time dateTime={game.when ?? undefined}>{clock.kind === "pre" ? game.clock : clock.label}</time>
      </p>
      <div className="tt-tv-feature-match">
        {(["away", "home"] as const).map((align) => {
          const side = game[align];
          return (
            <p key={align} className={`tt-tv-feature-side ${align}`}>
              <Crest side={side} league={game.league} size="lg" />
              <span>
                <strong>{teamTitle(side)}</strong>
                <em>
                  {align === "away" ? "Away" : "Home"}
                  {side.record ? ` · ${side.record}` : ""}
                </em>
              </span>
              {showScore ? <b>{side.score ?? "–"}</b> : null}
            </p>
          );
        })}
        <i className="tt-tv-at">at</i>
      </div>
      <p className="tt-tv-feature-meta">
        {[game.networks.map((n) => n.name).join(" · "), game.venue, game.series, game.line].filter(Boolean).join(" · ")}
      </p>
      <p className="tt-tv-feature-why">
        {watchContext(game)}
        {starters ? ` ${starters}` : ""}
      </p>
    </section>
  );
}

function GameCard({ game, head }: { game: WatchListing; head?: ReactNode }) {
  const clock = watchClockState(game);
  const showScore = clock.kind !== "pre";
  const starters = watchStarters(game);
  return (
    <li className={`tt-tv-game ${game.tier}`} data-league={game.league} data-state={clock.kind} style={{ ["--tt-league" as string]: watchLeagueColor(game.league) }}>
      {head}
      <p className="tt-tv-game-top">
        <LeagueChip game={game} />
        <Networks networks={game.networks} />
      </p>
      {(["away", "home"] as const).map((align) => {
        const side = game[align];
        return (
          <p key={align} className="tt-tv-game-side">
            <Crest side={side} league={game.league} size="sm" />
            <strong>{teamTitle(side)}</strong>
            {side.record ? <em>{side.record}</em> : null}
            {showScore ? <b>{side.score ?? "–"}</b> : null}
          </p>
        );
      })}
      <p className="tt-tv-game-why">
        {watchContext(game)}
        {starters ? ` · ${starters}` : ""}
      </p>
    </li>
  );
}

/** One page: the game of the day, then a Central-time grid of every remaining game. */
export default function WatchGuide({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const page = composeWatchPage(preparePrintedWatch(games));
  const listed = page.slots.reduce((n, slot) => n + slot.listings.length, 0);

  return (
    <div className="tt-watch" data-density={page.density}>
      <header className="tt-watch-head">
        <p className="tt-watch-kicker">The Viewing Guide · {editionLabel}</p>
        <h2>Today&apos;s Games</h2>
        <p className="tt-watch-dek">
          Picked by RUWT — stakes, closeness and the clubs you care about — then set by the Central clock.
        </p>
      </header>

      {!page.feature ? (
        <p className="wsj-empty">Nothing left on the slate today. The guide returns with tomorrow’s games.</p>
      ) : (
        <>
          <Feature game={page.feature} />
          {page.slots.length ? (
            <div className={cn("tt-tv-timeline", listed <= 18 && "roomy")} aria-label="By the Central clock">
              {page.slots.map((slot) => (
                <section key={slot.clock} className="tt-tv-slot" aria-label={slot.clock}>
                  <ol>
                    {slot.listings.map((game, i) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        head={
                          i === 0 ? (
                            <h3>
                              {slot.clock}
                              <span>
                                {slot.listings.length} {slot.listings.length === 1 ? "game" : "games"}
                              </span>
                            </h3>
                          ) : null
                        }
                      />
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          ) : null}
          <p className="tt-watch-legend">Times in Central. Networks: national TV and streaming.</p>
        </>
      )}
    </div>
  );
}
