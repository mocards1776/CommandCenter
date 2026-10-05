import {
  composeWatchPage,
  watchLeagueColor,
  watchLeagueLabel,
  type WatchGame,
  type WatchListing,
  type WatchNetwork,
  type WatchSide,
} from "@/lib/newspaper-watch";
import "./WatchGuide.css";

function recordBit(side: WatchSide): string | null {
  if (side.record) return side.record;
  if (side.rank) return `No. ${side.rank}`;
  return null;
}

function mustSub(game: WatchListing): string {
  const bits = [recordBit(game.away), recordBit(game.home)].filter(Boolean);
  if (game.reason) bits.push(game.reason);
  return bits.join(" · ");
}

function Crest({ side, size }: { side: WatchSide; size: "lg" | "md" | "sm" }) {
  return side.logo ? (
    <img className={`tt-watch-crest ${size}`} src={side.logo} alt="" loading="lazy" />
  ) : (
    <span className={`tt-watch-crest ${size} blank`}>{side.abbrev.slice(0, 3)}</span>
  );
}

function teamLine(side: WatchSide): string {
  return side.rank ? `No. ${side.rank} ${side.name}` : side.name;
}

function leagueTag(game: WatchListing): string {
  return watchLeagueLabel(game);
}

function Networks({ networks }: { networks: WatchNetwork[] }) {
  if (!networks.length) return <span className="tt-watch-nets" />;
  return (
    <span className="tt-watch-nets">
      {networks.map((n, i) => (
        <span key={`${n.name}-${i}`} className={n.streaming ? "stream" : undefined}>
          {n.name}
          {n.streaming ? <i>stream</i> : null}
        </span>
      ))}
    </span>
  );
}

function MustRow({ game }: { game: WatchListing }) {
  return (
    <li className="tt-watch-row must" data-league={game.league}>
      <time className="tt-watch-time" dateTime={game.when ?? undefined}>
        {game.clock}
      </time>
      <div className="tt-watch-copy">
        <p className="tt-watch-teams">
          <Crest side={game.away} size="md" />
          <b>{teamLine(game.away)}</b>
          <i>at</i>
          <Crest side={game.home} size="md" />
          <b>{teamLine(game.home)}</b>
        </p>
        {mustSub(game) ? <p className="tt-watch-whyline">{mustSub(game)}</p> : null}
      </div>
      <Networks networks={game.networks} />
    </li>
  );
}

function WorthRow({ game }: { game: WatchListing }) {
  return (
    <li className="tt-watch-row worth" data-league={game.league}>
      <time className="tt-watch-time" dateTime={game.when ?? undefined}>
        {game.clock}
      </time>
      <p className="tt-watch-teams">
        <Crest side={game.away} size="sm" />
        {game.away.abbrev}
        <i>at</i>
        <Crest side={game.home} size="sm" />
        {game.home.abbrev}
      </p>
      <Networks networks={game.networks} />
    </li>
  );
}

function AroundRow({ game }: { game: WatchListing }) {
  return (
    <li className="tt-watch-row around" data-league={game.league}>
      <time className="tt-watch-time" dateTime={game.when ?? undefined}>
        {game.clock}
      </time>
      <p className="tt-watch-teams text">
        {game.away.abbrev}–{game.home.abbrev}
      </p>
      <Networks networks={game.networks} />
    </li>
  );
}

function Listing({ game }: { game: WatchListing }) {
  if (game.tier === "must") return <MustRow game={game} />;
  if (game.tier === "worth") return <WorthRow game={game} />;
  return <AroundRow game={game} />;
}

/** One page: the game of the day, then a Central-time timetable. */
export default function WatchGuide({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const page = composeWatchPage(games);
  const feature = page.feature;

  return (
    <div className="tt-watch">
      <header className="tt-watch-head">
        <p className="tt-watch-kicker">The Viewing Guide · {editionLabel}</p>
        <h2>Today&apos;s Games</h2>
        <p className="tt-watch-dek">
          Picked by RUWT — stakes, closeness and the clubs you care about — then set by the Central clock.
        </p>
      </header>

      {!feature ? (
        <p className="wsj-empty">Nothing left on the slate today. The guide returns with tomorrow’s games.</p>
      ) : (
        <>
          <section className="tt-watch-feature" aria-label="Game of the day">
            <p className="tt-watch-flag">
              Game of the Day{" "}
              <span data-league={feature.league} style={{ color: watchLeagueColor(feature.league) }}>
                {leagueTag(feature)}
              </span>
            </p>
            <div className="tt-watch-match">
              <div className="tt-watch-team">
                <Crest side={feature.away} size="lg" />
                <strong>{teamLine(feature.away)}</strong>
                {feature.away.record ? <em>{feature.away.record}</em> : null}
              </div>
              <div className="tt-watch-at">
                <b>{feature.clock}</b>
                <span>at</span>
              </div>
              <div className="tt-watch-team">
                <Crest side={feature.home} size="lg" />
                <strong>{teamLine(feature.home)}</strong>
                {feature.home.record ? <em>{feature.home.record}</em> : null}
              </div>
            </div>
            <div className="tt-watch-meta">
              {feature.networks.length ? (
                <span className="tv">
                  {feature.networks.map((n) => (n.streaming ? `${n.name} (stream)` : n.name)).join(" · ")}
                </span>
              ) : null}
              {feature.venue ? <span>{feature.venue}</span> : null}
            </div>
            {feature.reason ? <p className="tt-watch-feature-why">{feature.reason}</p> : null}
          </section>

          {page.blocks.length ? (
            <div className="tt-watch-timeline" aria-label="By the Central clock">
              {page.blocks.map((block) => (
                <section key={block.id} className="tt-watch-block" aria-label={`${block.label}, ${block.hours}`}>
                  <header className="tt-watch-block-head">
                    <span className="tt-watch-mark">{block.mark}</span>
                    <h3>
                      {block.label} <em>{block.hours}</em>
                    </h3>
                  </header>
                  {block.listings.length ? (
                    <ol className="tt-watch-cols">
                      {block.listings.map((game) => (
                        <Listing key={game.id} game={game} />
                      ))}
                    </ol>
                  ) : null}
                  {block.alsoOn.length ? (
                    <p className="tt-watch-also">
                      <span>Also on:</span>{" "}
                      {block.alsoOn.map((row, i) => (
                        <span key={row.id}>
                          {i ? " · " : ""}
                          {row.match} {row.clock}
                          {row.network ? ` ${row.network}` : ""}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
