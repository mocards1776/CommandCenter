import type { CSSProperties } from "react";
import {
  composeWatchPage,
  preparePrintedWatch,
  watchClockState,
  watchContext,
  watchLeagueColor,
  watchLeagueLabel,
  watchLogo,
  watchStarters,
  watchTeamColor,
  watchTeamShort,
  watchTint,
  type WatchGame,
  type WatchListing,
  type WatchNetwork,
  type WatchSide,
} from "@/lib/newspaper-watch";
import { paperImgAttrs } from "@/lib/newspaper-img-attrs";
import "./WatchGuide.css";

function Crest({ side, league, size }: { side: WatchSide; league: WatchListing["league"]; size: "lg" | "md" | "sm" }) {
  const src = watchLogo(side, league);
  return src ? (
    <img className={`tt-watch-crest ${size}`} src={src} alt="" {...paperImgAttrs()} />
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

function BannerSide({
  side,
  league,
  align,
  showScore,
}: {
  side: WatchSide;
  league: WatchListing["league"];
  align: "away" | "home";
  showScore: boolean;
}) {
  return (
    <div
      className={`tt-watch-banner-side ${align}`}
      style={watchTint(watchTeamColor(side, league)) as CSSProperties}
    >
      {watchLogo(side, league) ? (
        <img className="tt-watch-ghost" src={watchLogo(side, league)!} alt="" aria-hidden="true" {...paperImgAttrs()} />
      ) : null}
      <span className="tt-watch-disc">
        <Crest side={side} league={league} size="lg" />
      </span>
      <span className="tt-watch-id">
        <em>{align === "away" ? "Away" : "Home"}</em>
        <strong>{teamTitle(side)}</strong>
        {side.record ? <i>{side.record}</i> : null}
      </span>
      {showScore ? <b className="tt-watch-score">{side.score ?? "–"}</b> : null}
    </div>
  );
}

function Feature({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  const showScore = clock.kind !== "pre";
  const starters = watchStarters(game);
  return (
    <section className="tt-watch-feature" aria-label="Game of the day">
      <p className="tt-watch-flag">
        <span>Game of the Day</span>
        <LeagueChip game={game} />
      </p>
      <div className="tt-watch-banner">
        <BannerSide side={game.away} league={game.league} align="away" showScore={showScore} />
        <BannerSide side={game.home} league={game.league} align="home" showScore={showScore} />
        <span className={`tt-watch-state ${clock.kind}`}>{clock.kind === "pre" ? game.clock : clock.label}</span>
      </div>
      <div className="tt-watch-meta">
        {game.networks.length ? (
          <span className="tv">{game.networks.map((n) => n.name).join(" · ")}</span>
        ) : null}
        {game.venue ? <span>{game.venue}</span> : null}
        {game.series ? <span>{game.series}</span> : null}
        {game.line ? <span>{game.line}</span> : null}
      </div>
      <p className="tt-watch-feature-why">{watchContext(game)}</p>
      {starters ? <p className="tt-watch-starters">{starters}</p> : null}
    </section>
  );
}

function GameCard({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  const showScore = clock.kind !== "pre";
  const starters = watchStarters(game);
  return (
    <li className={`tt-watch-card ${game.tier}`} data-league={game.league} data-state={clock.kind}>
      <div className="tt-watch-card-banner">
        {(["away", "home"] as const).map((align) => {
          const side = game[align];
          return (
            <div
              key={align}
              className={`tt-watch-card-side ${align}`}
              style={watchTint(watchTeamColor(side, game.league)) as CSSProperties}
            >
              <Crest side={side} league={game.league} size="md" />
              <span>
                <strong>{teamTitle(side)}</strong>
                {side.record ? <em>{side.record}</em> : null}
              </span>
              {showScore ? <b>{side.score ?? "–"}</b> : null}
            </div>
          );
        })}
      </div>
      <div className="tt-watch-card-foot">
        <div className="tt-watch-card-top">
          <LeagueChip game={game} />
          <time dateTime={game.when ?? undefined}>{clock.kind === "pre" ? game.clock : clock.label}</time>
          <Networks networks={game.networks} />
        </div>
        <p className="tt-watch-whyline">{watchContext(game)}</p>
        {starters ? <p className="tt-watch-card-starters">{starters}</p> : null}
      </div>
    </li>
  );
}

/** One page: the game of the day, then a Central-time grid of every remaining game. */
export default function WatchGuide({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const page = composeWatchPage(preparePrintedWatch(games));

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
            <div className="tt-watch-timeline" aria-label="By the Central clock">
              {page.slots.map((slot) => (
                <section key={slot.clock} className="tt-watch-slot" aria-label={slot.clock}>
                  <header className="tt-watch-slot-head">
                    <h3>{slot.clock}</h3>
                    <span>
                      {slot.listings.length} {slot.listings.length === 1 ? "game" : "games"}
                    </span>
                  </header>
                  <ol className="tt-watch-grid">
                    {slot.listings.map((game) => (
                      <GameCard key={game.id} game={game} />
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
