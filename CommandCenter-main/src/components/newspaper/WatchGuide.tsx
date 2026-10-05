import type { CSSProperties } from "react";
import {
  composeWatchPage,
  watchClockState,
  watchFeatureCopy,
  watchListingWhy,
  watchLeagueColor,
  watchLeagueLabel,
  watchLogo,
  watchStarters,
  watchTeamColor,
  watchTeamShort,
  type WatchGame,
  type WatchListing,
  type WatchNetwork,
  type WatchSide,
} from "@/lib/newspaper-watch";
import "./WatchGuide.css";

function Crest({ side, league, size }: { side: WatchSide; league: WatchListing["league"]; size: "lg" | "md" }) {
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

function washStyle(game: WatchListing): CSSProperties {
  return {
    ["--tt-away"]: watchTeamColor(game.away, game.league),
    ["--tt-home"]: watchTeamColor(game.home, game.league),
  } as CSSProperties;
}

function Heat({ n }: { n: number }) {
  return <span className="tt-watch-heat">Heat {Math.round(n)}</span>;
}

function ScoreMid({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  if (clock.kind === "pre") {
    return <p className="tt-watch-mid-clock">{game.clock}</p>;
  }
  return (
    <div className={`tt-watch-mid ${clock.kind}`}>
      <b>{game.away.score ?? "–"}</b>
      <span>{clock.label}</span>
      <b>{game.home.score ?? "–"}</b>
    </div>
  );
}

function TeamCol({
  side,
  league,
  align,
}: {
  side: WatchSide;
  league: WatchListing["league"];
  align: "away" | "home";
}) {
  return (
    <div className={`tt-watch-team ${align}`}>
      <Crest side={side} league={league} size="lg" />
      <strong>{teamTitle(side)}</strong>
      {side.record ? <em>{side.record}</em> : null}
    </div>
  );
}

function Feature({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  const starters = watchStarters(game);
  const { series, why } = watchFeatureCopy(game);
  return (
    <section className="tt-watch-feature" aria-label="Game of the day" style={washStyle(game)}>
      <p className="tt-watch-flag">
        <span>Game of the Day</span>
        <LeagueChip game={game} />
        <Heat n={game.heat} />
      </p>
      <div className="tt-watch-lead">
        <TeamCol side={game.away} league={game.league} align="away" />
        <div className="tt-watch-lead-mid">
          <ScoreMid game={game} />
          {clock.kind === "pre" && game.networks.length ? (
            <span className="tt-watch-lead-tv">{game.networks.map((n) => n.name).join(" · ")}</span>
          ) : null}
        </div>
        <TeamCol side={game.home} league={game.league} align="home" />
      </div>
      <div className="tt-watch-meta">
        {clock.kind !== "pre" && game.networks.length ? (
          <span className="tv">{game.networks.map((n) => n.name).join(" · ")}</span>
        ) : null}
        {game.venue ? <span>{game.venue}</span> : null}
        {series ? <span>{series}</span> : null}
        {game.line ? <span>{game.line}</span> : null}
      </div>
      {why ? <p className="tt-watch-feature-why">{why}</p> : null}
      {starters ? <p className="tt-watch-starters">{starters}</p> : null}
    </section>
  );
}

function GameRow({ game, away }: { game: WatchListing; away: boolean }) {
  const side = away ? game.away : game.home;
  const clock = watchClockState(game);
  const showScore = clock.kind !== "pre";
  return (
    <div className="tt-watch-side">
      <Crest side={side} league={game.league} size="md" />
      <span>
        <strong>{teamTitle(side)}</strong>
        {side.record ? <em>{side.record}</em> : null}
      </span>
      {showScore ? <b>{side.score ?? "–"}</b> : null}
    </div>
  );
}

function GameCard({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  const starters = watchStarters(game);
  const why = watchListingWhy(game);
  return (
    <li className={`tt-watch-card ${game.tier}`} data-league={game.league} data-state={clock.kind} style={washStyle(game)}>
      <div className="tt-watch-card-top">
        <LeagueChip game={game} />
        {game.favoriteLabel ? <span className="tt-watch-fav">{game.favoriteLabel}</span> : null}
        <time dateTime={game.when ?? undefined} className={clock.kind === "live" ? "live" : undefined}>
          {clock.kind === "pre" ? game.clock : clock.label}
        </time>
        <Networks networks={game.networks} />
        <Heat n={game.heat} />
      </div>
      <div className="tt-watch-sides">
        <GameRow game={game} away />
        <GameRow game={game} away={false} />
      </div>
      {why ? <p className="tt-watch-whyline">{why}</p> : null}
      {starters ? <p className="tt-watch-card-starters">{starters}</p> : null}
    </li>
  );
}

/** One page: the game of the day, then every remaining game in Central-time order. */
export default function WatchGuide({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const page = composeWatchPage(games);
  const rest = page.slots.flatMap((s) => s.listings);

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
          {rest.length ? (
            <section className="tt-watch-slate" aria-label="By the Central clock">
              <h3>Also on</h3>
              <ol className="tt-watch-grid">
                {rest.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </ol>
            </section>
          ) : null}
          <p className="tt-watch-legend">Times in Central. Networks: national TV and streaming.</p>
        </>
      )}
    </div>
  );
}
