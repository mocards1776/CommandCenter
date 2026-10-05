import type { CSSProperties } from "react";
import {
  composeWatchPage,
  printClock,
  printNetworks,
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
  type WatchSide,
} from "@/lib/newspaper-watch";

function Crest({ side, league, size }: { side: WatchSide; league: WatchGame["league"]; size: "lg" | "sm" }) {
  const src = watchLogo(side, league);
  return src ? (
    <img className={`tt-phone-crest ${size}`} src={src} alt="" />
  ) : (
    <span className={`tt-phone-crest ${size} blank`}>{side.abbrev.slice(0, 3)}</span>
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
  league: WatchGame["league"];
  align: "away" | "home";
  showScore: boolean;
}) {
  return (
    <div className={`tt-phone-banner-side ${align}`} style={watchTint(watchTeamColor(side, league)) as CSSProperties}>
      <Crest side={side} league={league} size="lg" />
      <strong>{teamTitle(side)}</strong>
      {side.record ? <em>{side.record}</em> : null}
      {showScore ? <b>{side.score ?? "–"}</b> : null}
    </div>
  );
}

function PhoneCard({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  const showScore = clock.kind !== "pre";
  const nets = game.networks.length ? game.networks : printNetworks(game.tv);
  const starters = watchStarters(game);
  return (
    <li className={`tt-phone-game ${game.tier}`} data-state={clock.kind}>
      <div className="tt-phone-game-banner">
        {(["away", "home"] as const).map((align) => {
          const side = game[align];
          return (
            <div key={align} className={`tt-phone-game-side ${align}`} style={watchTint(watchTeamColor(side, game.league)) as CSSProperties}>
              <Crest side={side} league={game.league} size="sm" />
              <span>
                <strong>{teamTitle(side)}</strong>
                {side.record ? <em>{side.record}</em> : null}
              </span>
              {showScore ? <b>{side.score ?? "–"}</b> : null}
            </div>
          );
        })}
      </div>
      <p className="tt-phone-game-meta">
        <span className="tt-phone-chip" style={{ background: watchLeagueColor(game.league) }}>
          {watchLeagueLabel(game)}
        </span>
        <time className={clock.kind === "live" ? "live" : undefined} dateTime={game.when ?? undefined}>
          {clock.kind === "pre" ? game.clock : clock.label}
        </time>
        {nets[0] ? <span className="tt-phone-net">{nets.map((n) => n.name).join(" · ")}</span> : null}
      </p>
      <p className="tt-phone-game-why">{watchContext(game)}</p>
      {starters ? <p className="tt-phone-game-starters">{starters}</p> : null}
    </li>
  );
}

/** Portrait iPhone watch card. Same recap language as the paper's viewing guide. */
export function PhoneWatchCard({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const page = composeWatchPage(games);
  const feature = page.feature;
  if (!feature) return null;
  const clock = watchClockState(feature);
  const showScore = clock.kind !== "pre";
  const rest = page.slots.flatMap((s) => s.listings);
  const starters = watchStarters(feature);

  return (
    <article className="tt-phone-card tt-phone-watch" aria-label="Best Games to Watch Today">
      <header className="tt-phone-mast">
        <p className="tt-phone-kicker">The Viewing Guide · {editionLabel}</p>
        <h1>Today&apos;s Games</h1>
        <p className="tt-phone-dek">Ranked by RUWT — stakes, closeness, and the clubs you care about.</p>
      </header>

      <section className="tt-phone-feature" aria-label="Game of the day">
        <p className="tt-phone-flag">
          Game of the Day
          <span className="tt-phone-chip" style={{ background: watchLeagueColor(feature.league) }}>
            {watchLeagueLabel(feature)}
          </span>
        </p>
        <div className="tt-phone-banner">
          <BannerSide side={feature.away} league={feature.league} align="away" showScore={showScore} />
          <BannerSide side={feature.home} league={feature.league} align="home" showScore={showScore} />
          <span className={`tt-phone-state ${clock.kind}`}>
            {clock.kind === "pre" ? printClock(feature.when) : clock.label}
          </span>
        </div>
        <p className="tt-phone-meta">
          {feature.networks.length ? <span>{feature.networks.map((n) => n.name).join(" · ")}</span> : null}
          {feature.venue ? <span>{feature.venue}</span> : null}
        </p>
        <p className="tt-phone-feature-why">{watchContext(feature)}</p>
        {starters ? <p className="tt-phone-game-starters">{starters}</p> : null}
      </section>

      {rest.length ? (
        <section className="tt-phone-listings" aria-label="Also on">
          <h2>Also on</h2>
          <ol>
            {rest.map((game) => (
              <PhoneCard key={game.id} game={game} />
            ))}
          </ol>
        </section>
      ) : null}

      <p className="tt-phone-legend">Times in Central. Networks: national TV and streaming.</p>
    </article>
  );
}
