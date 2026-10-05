import { useQuery } from "@tanstack/react-query";
import { coachFactLines, fetchFavoriteCoachDesk, type FavoriteCoachTile } from "@/lib/newspaper-favorite-coaches";
import { editionDateline } from "@/lib/newspaper";

const TZ = "America/Chicago";

/**
 * Public fixture of the weekly Favorite Coaches desk at iPad width.
 * Not linked from nav. Used to proof the printed CFB page with live ESPN.
 */
export default function NewspaperCoachesPreviewPage() {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const desk = useQuery({
    queryKey: ["tt-favorite-coaches-preview", day],
    queryFn: () => fetchFavoriteCoachDesk({ day }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const tiles = desk.data?.tiles ?? [];
  const ready = desk.isSuccess || desk.isError;

  return (
    <div className="newspaper-root wsj-shell tt-watch-preview">
      <div className="wsj-page" data-coaches-preview="1" data-ready={ready ? "1" : "0"}>
        <div className="wsj-fit">
          <div className="wsj-sheet">
            <header className="wsj-sport-band">
              <span className="wsj-sport-code">CFB</span>
              <h3>
                College Football <em>Favorite Coaches</em>
              </h3>
              <p>
                {tiles.length
                  ? `${tiles.length} coaches · ${editionDateline(day)}`
                  : desk.isLoading
                    ? "Setting the desk…"
                    : "No coaches on file"}
              </p>
            </header>
            <div className="wsj-sport-solo">
              <CoachesPreview tiles={tiles} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoachesPreview({ tiles }: { tiles: FavoriteCoachTile[] }) {
  if (!tiles.length) return <p className="wsj-empty">No favorite coaches on file this week.</p>;
  return (
    <div className="tt-coaches" style={{ ["--cols" as string]: "2" }}>
      {tiles.map((tile) => {
        const face = tile.headshot || tile.teamLogo;
        const last = tile.lastGame;
        const next = tile.nextGame;
        const lastBits = last
          ? [last.result, last.score, last.homeAway && last.opponent ? `${last.homeAway} ${last.opponent}` : last.opponent, last.date]
              .filter(Boolean)
              .join(" · ")
          : null;
        const nextBits = next
          ? [
              next.homeAway && next.opponent ? `${next.homeAway} ${next.opponent}` : next.opponent,
              next.kickoff,
              next.tv,
              next.line,
            ]
              .filter(Boolean)
              .join(" · ")
          : null;
        const stat =
          tile.pointsForAvg || tile.pointsAgainstAvg
            ? [tile.pointsForAvg ? `${tile.pointsForAvg} PF` : null, tile.pointsAgainstAvg ? `${tile.pointsAgainstAvg} PA` : null]
                .filter(Boolean)
                .join(" · ")
            : null;
        return (
          <article key={`${tile.leaguePath}-${tile.coachId}`} className={tile.featured ? "tt-coach featured" : "tt-coach"}>
            <header>
              <span className="tt-coach-face">{face ? <img src={face} alt="" /> : null}</span>
              <span className="tt-coach-id">
                <em>{[tile.teamName, tile.rank != null ? `#${tile.rank}` : null, tile.standing].filter(Boolean).join(" · ")}</em>
                <strong>{tile.name}</strong>
                <span>
                  {[tile.record, tile.conferenceRecord ? `${tile.conferenceRecord} conf` : null].filter(Boolean).join(" · ") ||
                    "Record not posted"}
                </span>
              </span>
            </header>
            <div className="tt-coach-body">
              <div className="tt-coach-story">
                {lastBits ? (
                  <p className={`tt-coach-last${last?.result === "W" ? " w" : last?.result === "L" ? " l" : ""}`}>
                    {last?.opponentLogo ? <img src={last.opponentLogo} alt="" /> : null}
                    <span>{lastBits}</span>
                  </p>
                ) : null}
                {last?.summary ? <p className="tt-coach-sum">{last.summary}</p> : null}
                {nextBits ? (
                  <p className="tt-coach-next">
                    <b>Next</b> {nextBits}
                  </p>
                ) : null}
                {stat ? <p className="tt-coach-stat">{stat}</p> : null}
                {tile.featured ? null : <CoachPreviewFacts tile={tile} />}
              </div>
              {tile.featured ? (
                <aside className="tt-coach-aside">
                  {tile.teamLogo ? (
                    <span className="tt-coach-mark">
                      <img src={tile.teamLogo} alt="" />
                    </span>
                  ) : null}
                  <CoachSeasonStrip tile={tile} />
                  <CoachPreviewFacts tile={tile} />
                </aside>
              ) : null}
            </div>
            {tile.headlines.length ? (
              <ul className="tt-coach-hed">
                {tile.headlines.map((card) => (
                  <li key={card.id}>
                    <a href={card.wrapHref || card.gameHref || "#"}>{card.headline}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function CoachSeasonStrip({ tile }: { tile: FavoriteCoachTile }) {
  const chips = tile.seasonStrip ?? [];
  if (!chips.length) return null;
  return (
    <div className="tt-coach-strip">
      <b>{tile.seasonYear ?? "Season"}</b>
      {chips.map((chip) => (
        <i key={chip.id} className={chip.result === "W" ? "w" : chip.result === "L" ? "l" : undefined}>
          {chip.result}
          {chip.opponentRank != null ? ` #${chip.opponentRank}` : ""} {chip.opponent}
        </i>
      ))}
    </div>
  );
}

function CoachPreviewFacts({ tile }: { tile: FavoriteCoachTile }) {
  const bits = coachFactLines(tile);
  if (!bits.length && !tile.sourceLabel && !tile.statusNote) return null;
  return (
    <>
      {bits.length ? (
        <ul className="tt-coach-facts">
          {bits.map((bit) => (
            <li key={bit}>{bit}</li>
          ))}
        </ul>
      ) : null}
      {tile.statusNote ? <p className="tt-coach-status">{tile.statusNote}</p> : null}
      {tile.sourceLabel ? (
        <p className="tt-coach-src">
          {tile.sourceUrl ? (
            <a href={tile.sourceUrl} target="_blank" rel="noreferrer">
              Salary: {tile.sourceLabel}
            </a>
          ) : (
            `Salary: ${tile.sourceLabel}`
          )}
        </p>
      ) : null}
    </>
  );
}
