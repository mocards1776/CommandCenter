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

function washStyle(game: WatchListing): CSSProperties {
  return {
    ["--tt-away"]: watchTeamColor(game.away, game.league),
    ["--tt-home"]: watchTeamColor(game.home, game.league),
  } as CSSProperties;
}

function ScoreMid({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  if (clock.kind === "pre") {
    return <p className="tt-phone-mid-clock">{game.clock}</p>;
  }
  return (
    <div className={`tt-phone-mid ${clock.kind}`}>
      <b>{game.away.score ?? "–"}</b>
      <span>{clock.label}</span>
      <b>{game.home.score ?? "–"}</b>
    </div>
  );
}

function PhoneRow({ game }: { game: WatchListing }) {
  const clock = watchClockState(game);
  const showScore = clock.kind !== "pre";
  const nets = game.networks;
  const why = watchListingWhy(game);
  return (
    <li className={`tt-phone-row ${game.tier}`} data-state={clock.kind} style={washStyle(game)}>
      <div className="tt-phone-row-top">
        <span className="tt-phone-chip" style={{ background: watchLeagueColor(game.league) }}>
          {watchLeagueLabel(game)}
        </span>
        <time className={clock.kind === "live" ? "live" : undefined} dateTime={game.when ?? undefined}>
          {clock.kind === "pre" ? game.clock : clock.label}
        </time>
        {nets[0] ? <span className="tt-phone-net">{nets.map((n) => n.name).join(" · ")}</span> : null}
        <span className="tt-phone-heat">Heat {Math.round(game.heat)}</span>
      </div>
      {(["away", "home"] as const).map((align) => {
        const side = game[align];
        return (
          <div key={align} className="tt-phone-row-side">
            <Crest side={side} league={game.league} size="sm" />
            <span>
              <strong>{teamTitle(side)}</strong>
              {side.record ? <em>{side.record}</em> : null}
            </span>
            {showScore ? <b>{side.score ?? "–"}</b> : null}
          </div>
        );
      })}
      {why ? <p className="tt-phone-row-why">{why}</p> : null}
    </li>
  );
}

/** Portrait iPhone watch card. RUWT logos and heat, newsprint ink, no empty band. */
export function PhoneWatchCard({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const page = composeWatchPage(games);
  const feature = page.feature;
  if (!feature) return null;
  const clock = watchClockState(feature);
  const rest = page.slots.flatMap((s) => s.listings);
  const starters = watchStarters(feature);
  const { series, why } = watchFeatureCopy(feature);

  return (
    <article className="tt-phone-card tt-phone-watch" aria-label="Best Games to Watch Today">
      <header className="tt-phone-mast">
        <p className="tt-phone-kicker">The Viewing Guide · {editionLabel}</p>
        <h1>Today&apos;s Games</h1>
        <p className="tt-phone-dek">Ranked by RUWT — stakes, closeness, and the clubs you care about.</p>
      </header>

      <section className="tt-phone-lead" aria-label="Game of the day" style={washStyle(feature)}>
        <p className="tt-phone-flag">
          Game of the Day
          <span className="tt-phone-chip" style={{ background: watchLeagueColor(feature.league) }}>
            {watchLeagueLabel(feature)}
          </span>
          <span className="tt-phone-heat">Heat {Math.round(feature.heat)}</span>
        </p>
        <div className="tt-phone-lead-match">
          <div className="tt-phone-lead-team away">
            <Crest side={feature.away} league={feature.league} size="lg" />
            <strong>{teamTitle(feature.away)}</strong>
            {feature.away.record ? <em>{feature.away.record}</em> : null}
          </div>
          <div className="tt-phone-lead-mid">
            <ScoreMid game={feature} />
            {clock.kind === "pre" && feature.networks.length ? (
              <span className="tt-phone-lead-tv">{feature.networks.map((n) => n.name).join(" · ")}</span>
            ) : null}
          </div>
          <div className="tt-phone-lead-team home">
            <Crest side={feature.home} league={feature.league} size="lg" />
            <strong>{teamTitle(feature.home)}</strong>
            {feature.home.record ? <em>{feature.home.record}</em> : null}
          </div>
        </div>
        <p className="tt-phone-meta">
          {clock.kind !== "pre" && feature.networks.length ? (
            <span>{feature.networks.map((n) => n.name).join(" · ")}</span>
          ) : null}
          {feature.venue ? <span>{feature.venue}</span> : null}
          {series ? <span>{series}</span> : null}
        </p>
        {why ? <p className="tt-phone-feature-why">{why}</p> : null}
        {starters ? <p className="tt-phone-game-starters">{starters}</p> : null}
      </section>

      {rest.length ? (
        <section className="tt-phone-listings" aria-label="Also on">
          <h2>Also on</h2>
          <ol>
            {rest.map((game) => (
              <PhoneRow key={game.id} game={game} />
            ))}
          </ol>
        </section>
      ) : null}

      <p className="tt-phone-legend">Times in Central. Networks: national TV and streaming.</p>
    </article>
  );
}
