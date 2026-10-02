import type { WatchGame, WatchSide } from "@/lib/newspaper-watch";

const TZ = "America/Chicago";

function clock(game: WatchGame): string {
  if (game.live) return "Live";
  if (!game.when) return "TBA";
  const d = new Date(game.when);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).replace(":00 ", " ");
}

function leagueTag(game: WatchGame): string {
  return game.league === "Soccer" ? game.competition || "Soccer" : game.league;
}

function Crest({ side, size }: { side: WatchSide; size: "lg" | "sm" }) {
  return side.logo ? (
    <img className={`tt-watch-crest ${size}`} src={side.logo} alt="" loading="lazy" />
  ) : (
    <span className={`tt-watch-crest ${size} blank`}>{side.abbrev.slice(0, 3)}</span>
  );
}

function teamLine(side: WatchSide): string {
  return side.rank ? `No. ${side.rank} ${side.name}` : side.name;
}

/** Heat as a bar against the best game on the page, so the listings read at a glance. */
function Heat({ heat, top }: { heat: number; top: number }) {
  const pct = top > 0 ? Math.max(8, Math.round((heat / top) * 100)) : 0;
  return (
    <span className="tt-watch-heat" aria-label={`RUWT heat ${Math.round(heat)}`}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/** One page: the game of the day, then the listings, then the night by the clock. */
export default function WatchGuide({ games, editionLabel }: { games: WatchGame[]; editionLabel: string }) {
  const [feature, ...rest] = games;
  const top = feature?.heat ?? 0;
  const byClock = [...games].sort(
    (a, b) => Number(b.live) - Number(a.live) || String(a.when ?? "~").localeCompare(String(b.when ?? "~")),
  );

  return (
    <div className="tt-watch">
      <header className="tt-watch-head">
        <p className="tt-watch-kicker">The Viewing Guide · {editionLabel}</p>
        <h2>Best Games to Watch Today</h2>
        <p className="tt-watch-dek">
          Ranked by RUWT — Are You Watching This? — on stakes, closeness and the clubs you care about.
        </p>
      </header>

      {!feature ? (
        <p className="wsj-empty">Nothing left on the slate today. The guide returns with tomorrow’s games.</p>
      ) : (
        <>
          <section className="tt-watch-feature" aria-label="Game of the day">
            <p className="tt-watch-flag">
              Game of the Day <span>{leagueTag(feature)}</span>
            </p>
            <div className="tt-watch-match">
              <div className="tt-watch-team">
                <Crest side={feature.away} size="lg" />
                <strong>{teamLine(feature.away)}</strong>
                {feature.away.record ? <em>{feature.away.record}</em> : null}
              </div>
              <div className="tt-watch-at">
                <b className={feature.live ? "live" : undefined}>{clock(feature)}</b>
                <span>at</span>
              </div>
              <div className="tt-watch-team">
                <Crest side={feature.home} size="lg" />
                <strong>{teamLine(feature.home)}</strong>
                {feature.home.record ? <em>{feature.home.record}</em> : null}
              </div>
            </div>
            <div className="tt-watch-meta">
              {feature.tv.length ? <span className="tv">{feature.tv.join(" · ")}</span> : null}
              {feature.venue ? <span>{feature.venue}</span> : null}
              {feature.live && feature.status ? <span className="live">{feature.status}</span> : null}
            </div>
            {feature.reasons.length ? (
              <ul className="tt-watch-why">
                {feature.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </section>

          {rest.length ? (
            <section className="tt-watch-list" aria-label="Also worth your time">
              <h3 className="wsj-band-title">Also worth your time</h3>
              <ol>
                {rest.map((game, i) => (
                  <li key={game.id}>
                    <span className="tt-watch-rank">{i + 2}</span>
                    <span className={game.live ? "tt-watch-time live" : "tt-watch-time"}>{clock(game)}</span>
                    <span className="tt-watch-row">
                      <span className="tt-watch-teams">
                        <Crest side={game.away} size="sm" />
                        {game.away.abbrev}
                        <i>at</i>
                        <Crest side={game.home} size="sm" />
                        {game.home.abbrev}
                      </span>
                      <span className="tt-watch-sub">
                        <em>{leagueTag(game)}</em>
                        {game.tv.length ? ` · ${game.tv.join(", ")}` : ""}
                        {game.reasons[0] ? ` · ${game.reasons[0]}` : ""}
                      </span>
                    </span>
                    <Heat heat={game.heat} top={top} />
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="tt-watch-clock" aria-label="By the clock">
            <h3 className="wsj-band-title">By the clock</h3>
            <div>
              {byClock.map((game) => (
                <span key={game.id} className={game.live ? "live" : undefined}>
                  <b>{clock(game)}</b>
                  {game.away.abbrev}–{game.home.abbrev}
                </span>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
