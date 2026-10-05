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

function teamAbbrev(side: WatchSide): string {
  return side.rank ? `${side.rank} ${side.abbrev}` : side.abbrev;
}

function Heat({ n }: { n: number }) {
  const pct = watchHeatPct(n);
  return (
    <span className="tt-phone-heat">
      Heat {pct}
      <i style={{ ["--tt-heat"]: `${pct}%` } as CSSProperties}>
        <b />
      </i>
    </span>
  );
}

function ClockMid({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  if (clock.kind === "pre") {
    return (
      <div className="tt-phone-mid pre">
        <p className="tt-phone-mid-clock">{game.clock}</p>
        {game.networks[0] ? <span className="tt-phone-tv">{game.networks.map((n) => n.name).join(" · ")}</span> : null}
      </div>
    );
  }
  return (
    <div className={`tt-phone-mid ${clock.kind}`}>
      <b>{game.away.score ?? "–"}</b>
      <span className={clock.kind === "live" ? "live" : undefined}>
        {clock.kind === "live" ? (
          <>
            Live{clock.label && !/^live$/i.test(clock.label) ? ` · ${clock.label}` : ""}
          </>
        ) : (
          clock.label
        )}
      </span>
      <b>{game.home.score ?? "–"}</b>
      {game.networks[0] ? <em>{game.networks.map((n) => n.name).join(" · ")}</em> : null}
    </div>
  );
}

function TeamCol({
  side,
  league,
  align,
}: {
  side: WatchSide;
  league: WatchGame["league"];
  align: "away" | "home";
}) {
  return (
    <div className={`tt-phone-team ${align}`}>
      <span className="tt-phone-swatch" style={{ background: watchTeamColor(side, league) }} aria-hidden />
      <Crest side={side} league={league} size="sm" />
      <span>
        <strong>{teamAbbrev(side)}</strong>
        {side.record ? <em>{side.record}</em> : null}
        {side.place ? <small>{side.place}</small> : null}
      </span>
    </div>
  );
}

function Arm({ side, league, align }: { side: WatchSide; league: WatchGame["league"]; align: "away" | "home" }) {
  const name = side.starter?.trim();
  if (!name) return <div className={`tt-phone-arm ${align} empty`} />;
  const { first, last } = watchPersonName(name);
  const src = watchHeadshot(side, league);
  return (
    <div className={`tt-phone-arm ${align}`}>
      {src ? <img src={src} alt="" /> : <span className="blank">{last.slice(0, 1)}</span>}
      {first ? <em>{first}</em> : null}
      <strong>{last}</strong>
      {side.starterLine ? <small>{side.starterLine}</small> : null}
    </div>
  );
}

function PhoneCard({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  const series = watchSeriesDisplay(game);
  return (
    <li className={`tt-phone-row ${game.tier}`} data-state={clock.kind}>
      <div className="tt-phone-row-top">
        <span className="tt-phone-chip" style={{ background: watchLeagueColor(game.league) }}>
          {watchLeagueLabel(game)}
        </span>
        <Heat n={game.heat} />
      </div>
      <div className="tt-phone-match">
        <TeamCol side={game.away} league={game.league} align="away" />
        <ClockMid game={game} />
        <TeamCol side={game.home} league={game.league} align="home" />
      </div>
      {series ? <p className="tt-phone-row-series">{series}</p> : null}
    </li>
  );
}

/** Portrait iPhone watch card. RUWT face-off on newsprint, no empty band. */
export function PhoneWatchCard({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const page = composeWatchPage(games);
  const feature = page.feature;
  if (!feature) return null;
  const { series, why } = watchFeatureCopy(feature);
  const hasArms = Boolean(feature.away.starter || feature.home.starter);

  return (
    <article className="tt-phone-card tt-phone-watch" aria-label="Best Games to Watch Today">
      <header className="tt-phone-mast">
        <p className="tt-phone-kicker">The Viewing Guide · {editionLabel}</p>
        <h1>Today&apos;s Games</h1>
        <p className="tt-phone-dek">Ranked by RUWT — stakes, closeness, and the clubs you care about.</p>
      </header>

      <section className="tt-phone-lead" aria-label="Game of the day">
        <p className="tt-phone-flag">
          Game of the Day
          <span className="tt-phone-chip" style={{ background: watchLeagueColor(feature.league) }}>
            {watchLeagueLabel(feature)}
          </span>
          <Heat n={feature.heat} />
        </p>
        {why ? <p className="tt-phone-feature-why">{why}</p> : null}
        <div className="tt-phone-lead-match">
          <TeamCol side={feature.away} league={feature.league} align="away" />
          <ClockMid game={feature} />
          <TeamCol side={feature.home} league={feature.league} align="home" />
        </div>
        {hasArms ? (
          <div className="tt-phone-arms">
            <Arm side={feature.away} league={feature.league} align="away" />
            <span>vs</span>
            <Arm side={feature.home} league={feature.league} align="home" />
          </div>
        ) : null}
        <p className="tt-phone-meta">
          {feature.venue ? <span>{feature.venue}</span> : null}
          {series ? <span>{series}</span> : null}
        </p>
      </section>

      {page.slate.length ? (
        <section className="tt-phone-listings" aria-label="Also on">
          <h2>Also on</h2>
          <ol>
            {page.slate.map((game) => (
              <PhoneCard key={game.id} game={game} />
            ))}
          </ol>
        </section>
      ) : null}

      {page.preseason.length ? (
        <section className="tt-phone-pre" aria-label="Preseason">
          <h2>Preseason</h2>
          <ol>
            {page.preseason.map((game) => {
              const clock = watchClockState(game);
              return (
                <li key={game.id}>
                  <Crest side={game.away} league={game.league} size="sm" />
                  <strong>{game.away.abbrev}</strong>
                  <span>at</span>
                  <Crest side={game.home} league={game.league} size="sm" />
                  <strong>{game.home.abbrev}</strong>
                  <time>{clock.kind === "pre" ? game.clock : clock.label}</time>
                  {game.networks[0] ? <em>{game.networks.map((n) => n.name).join(" · ")}</em> : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <p className="tt-phone-legend">Times in Central. Networks: national TV and streaming.</p>
    </article>
  );
}
