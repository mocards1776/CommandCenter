import { watchLeagueLabel, type WatchGame, type WatchSide } from "@/lib/newspaper-watch";

const TZ = "America/Chicago";

function clock(game: WatchGame): string {
  if (game.live) return "Live";
  if (!game.when) return "TBA";
  const d = new Date(game.when);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).replace(":00 ", " ");
}

function leagueTag(game: WatchGame): string {
  return watchLeagueLabel(game);
}

function Crest({ side, size }: { side: WatchSide; size: "lg" | "sm" }) {
  return side.logo ? (
    <img className={`tt-phone-crest ${size}`} src={side.logo} alt="" />
  ) : (
    <span className={`tt-phone-crest ${size} blank`}>{side.abbrev.slice(0, 3)}</span>
  );
}

function teamLine(side: WatchSide): string {
  return side.rank ? `No. ${side.rank} ${side.name}` : side.name;
}

/** Portrait iPhone watch card. Same RUWT slate as the paper's viewing guide. */
export function PhoneWatchCard({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const [feature, ...rest] = games;
  if (!feature) return null;
  const top = feature.heat || 1;

  return (
    <article className="tt-phone-card tt-phone-watch" aria-label="Best Games to Watch Today">
      <header className="tt-phone-mast">
        <p className="tt-phone-kicker">The Viewing Guide · {editionLabel}</p>
        <h1>Best Games to Watch Today</h1>
        <p className="tt-phone-dek">Ranked by RUWT — stakes, closeness, and the clubs you care about.</p>
      </header>

      <section className="tt-phone-feature" aria-label="Game of the day">
        <p className="tt-phone-flag">
          Game of the Day <span>{leagueTag(feature)}</span>
        </p>
        <div className="tt-phone-match">
          <div className="tt-phone-side">
            <Crest side={feature.away} size="lg" />
            <strong>{teamLine(feature.away)}</strong>
            {feature.away.record ? <em>{feature.away.record}</em> : null}
          </div>
          <div className="tt-phone-at">
            <b className={feature.live ? "live" : undefined}>{clock(feature)}</b>
            <span>at</span>
          </div>
          <div className="tt-phone-side">
            <Crest side={feature.home} size="lg" />
            <strong>{teamLine(feature.home)}</strong>
            {feature.home.record ? <em>{feature.home.record}</em> : null}
          </div>
        </div>
        <p className="tt-phone-meta">
          {feature.tv.length ? <span>{feature.tv.join(" · ")}</span> : null}
          {feature.venue ? <span>{feature.venue}</span> : null}
        </p>
        {feature.reasons.length ? (
          <ul className="tt-phone-why">
            {feature.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {rest.length ? (
        <section className="tt-phone-listings" aria-label="Also worth your time">
          <h2>Also worth your time</h2>
          <ol>
            {rest.map((game, i) => (
              <li key={game.id}>
                <span className="tt-phone-rank">{i + 2}</span>
                <span className={game.live ? "tt-phone-when live" : "tt-phone-when"}>{clock(game)}</span>
                <span className="tt-phone-listing">
                  <span className="tt-phone-teams">
                    <Crest side={game.away} size="sm" />
                    {game.away.abbrev}
                    <i>at</i>
                    <Crest side={game.home} size="sm" />
                    {game.home.abbrev}
                  </span>
                  <span className="tt-phone-sub">
                    <em>{leagueTag(game)}</em>
                    {game.tv.length ? ` · ${game.tv[0]}` : ""}
                    {game.reasons[0] ? ` · ${game.reasons[0]}` : ""}
                  </span>
                </span>
                <span
                  className="tt-phone-heat"
                  aria-label={`RUWT heat ${Math.round(game.heat)}`}
                >
                  <span style={{ width: `${Math.max(10, Math.round((game.heat / top) * 100))}%` }} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
