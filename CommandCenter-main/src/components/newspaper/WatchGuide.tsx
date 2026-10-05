import type { CSSProperties } from "react";
import {
  composeWatchPage,
  watchClockState,
  watchFeatureCopy,
  watchHeadshot,
  watchHeatPct,
  watchLeagueColor,
  watchLeagueLabel,
  watchLogo,
  watchPersonName,
  watchSeriesDisplay,
  watchTeamColor,
  type WatchGame,
  type WatchListing,
  type WatchNetwork,
  type WatchSide,
} from "@/lib/newspaper-watch";
import "./WatchGuide.css";

function Crest({ side, league, size }: { side: WatchSide; league: WatchListing["league"]; size: "lg" | "md" | "sm" }) {
  const src = watchLogo(side, league);
  return src ? (
    <img className={`tt-watch-crest ${size}`} src={src} alt="" loading="lazy" />
  ) : (
    <span className={`tt-watch-crest ${size} blank`}>{side.abbrev.slice(0, 3)}</span>
  );
}

function Swatch({ side, league }: { side: WatchSide; league: WatchListing["league"] }) {
  return <span className="tt-watch-swatch" style={{ background: watchTeamColor(side, league) }} aria-hidden />;
}

function LeagueChip({ game }: { game: WatchListing }) {
  return (
    <span className="tt-watch-chip" style={{ background: watchLeagueColor(game.league) }}>
      {watchLeagueLabel(game)}
    </span>
  );
}

function Heat({ n }: { n: number }) {
  const pct = watchHeatPct(n);
  return (
    <span className="tt-watch-heat">
      Heat {pct}
      <i style={{ ["--tt-heat"]: `${pct}%` } as CSSProperties}>
        <b />
      </i>
    </span>
  );
}

function TvChips({ networks }: { networks: WatchNetwork[] }) {
  if (!networks.length) return null;
  return (
    <span className="tt-watch-tv">
      {networks.map((n) => (
        <span key={n.name} className={n.streaming ? "stream" : undefined}>
          {n.name}
        </span>
      ))}
    </span>
  );
}

function teamAbbrev(side: WatchSide): string {
  return side.rank ? `${side.rank} ${side.abbrev}` : side.abbrev;
}

function ClockMid({ game, large }: { game: WatchListing; large?: boolean }) {
  const clock = watchClockState(game);
  if (clock.kind === "pre") {
    return (
      <div className={`tt-watch-mid pre ${large ? "lg" : ""}`}>
        <p className="tt-watch-mid-clock">{game.clock}</p>
        <TvChips networks={game.networks} />
      </div>
    );
  }
  return (
    <div className={`tt-watch-mid ${clock.kind} ${large ? "lg" : ""}`}>
      <b>{game.away.score ?? "–"}</b>
      <span className={clock.kind === "live" ? "live" : undefined}>
        {clock.kind === "live" ? (
          <>
            <i className="tt-watch-live-dot" />
            Live{clock.label && !/^live$/i.test(clock.label) ? ` · ${clock.label}` : ""}
          </>
        ) : (
          clock.label
        )}
      </span>
      <b>{game.home.score ?? "–"}</b>
      <TvChips networks={game.networks} />
    </div>
  );
}

function TeamCol({
  side,
  league,
  align,
  large,
}: {
  side: WatchSide;
  league: WatchListing["league"];
  align: "away" | "home";
  large?: boolean;
}) {
  return (
    <div className={`tt-watch-team ${align} ${large ? "lg" : ""}`}>
      <Swatch side={side} league={league} />
      <Crest side={side} league={league} size={large ? "lg" : "md"} />
      <span>
        <strong>{teamAbbrev(side)}</strong>
        {side.record ? <em>{side.record}</em> : null}
        {side.place ? <small>{side.place}</small> : null}
      </span>
    </div>
  );
}

function Pitcher({ side, league, align }: { side: WatchSide; league: WatchListing["league"]; align: "away" | "home" }) {
  const name = side.starter?.trim();
  if (!name) return <div className={`tt-watch-arm ${align} empty`} />;
  const { first, last } = watchPersonName(name);
  const src = watchHeadshot(side, league);
  return (
    <div className={`tt-watch-arm ${align}`}>
      {src ? <img src={src} alt="" /> : <span className="blank">{last.slice(0, 1)}</span>}
      {first ? <em>{first}</em> : null}
      <strong>{last}</strong>
      {side.starterLine ? <small>{side.starterLine}</small> : null}
    </div>
  );
}

function Feature({ game }: { game: WatchListing }) {
  const { series, why } = watchFeatureCopy(game);
  const hasArms = Boolean(game.away.starter || game.home.starter);
  return (
    <section className="tt-watch-feature" aria-label="Game of the day">
      <p className="tt-watch-flag">
        <span>Game of the Day</span>
        <LeagueChip game={game} />
        <Heat n={game.heat} />
      </p>
      {why ? <p className="tt-watch-feature-why">{why}</p> : null}
      <div className="tt-watch-lead">
        <TeamCol side={game.away} league={game.league} align="away" large />
        <ClockMid game={game} large />
        <TeamCol side={game.home} league={game.league} align="home" large />
      </div>
      {hasArms ? (
        <div className="tt-watch-arms">
          <Pitcher side={game.away} league={game.league} align="away" />
          <span>vs</span>
          <Pitcher side={game.home} league={game.league} align="home" />
        </div>
      ) : null}
      <div className="tt-watch-meta">
        {game.venue ? <span>{game.venue}</span> : null}
        {series ? <span>{series}</span> : null}
        {game.line ? <span>{game.line}</span> : null}
      </div>
    </section>
  );
}

function GameCard({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  const series = watchSeriesDisplay(game);
  return (
    <li className={`tt-watch-card ${game.tier}`} data-league={game.league} data-state={clock.kind}>
      <div className="tt-watch-card-top">
        <LeagueChip game={game} />
        {game.favoriteLabel ? <span className="tt-watch-fav">{game.favoriteLabel}</span> : null}
        <Heat n={game.heat} />
      </div>
      <div className="tt-watch-match">
        <TeamCol side={game.away} league={game.league} align="away" />
        <ClockMid game={game} />
        <TeamCol side={game.home} league={game.league} align="home" />
      </div>
      {series ? <p className="tt-watch-card-series">{series}</p> : null}
    </li>
  );
}

function PreseasonStrip({ games }: { games: WatchListing[] }) {
  if (!games.length) return null;
  return (
    <section className="tt-watch-pre" aria-label="Preseason">
      <h3>Preseason</h3>
      <ol>
        {games.map((game) => {
          const clock = watchClockState(game);
          return (
            <li key={game.id}>
              <span className="tt-watch-chip" style={{ background: watchLeagueColor(game.league) }}>
                {watchLeagueLabel(game)}
              </span>
              <Crest side={game.away} league={game.league} size="sm" />
              <strong>{game.away.abbrev}</strong>
              <span className="at">at</span>
              <Crest side={game.home} league={game.league} size="sm" />
              <strong>{game.home.abbrev}</strong>
              <time dateTime={game.when ?? undefined}>{clock.kind === "pre" ? game.clock : clock.label}</time>
              {game.networks[0] ? <em>{game.networks.map((n) => n.name).join(" · ")}</em> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** One page: the game of the day, then RUWT-style cards, then a preseason strip. */
export default function WatchGuide({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const page = composeWatchPage(games);

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
          {page.slate.length ? (
            <section className="tt-watch-slate" aria-label="Also on">
              <h3>Also on</h3>
              <ol className="tt-watch-grid">
                {page.slate.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </ol>
            </section>
          ) : null}
          <PreseasonStrip games={page.preseason} />
          <p className="tt-watch-legend">Times in Central. Networks: national TV and streaming.</p>
        </>
      )}
    </div>
  );
}
