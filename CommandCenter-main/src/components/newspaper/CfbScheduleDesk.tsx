import { StandingsTable } from "@/components/newspaper/BoxScore";
import {
  formatKickoffLine,
  footballWeekTitle,
  gameClock,
  isCfbDeskGame,
  looksLikeEspnZoneClock,
  secStandingsGroup,
  type BoxGame,
  type BoxSide,
  type CfbPollRow,
  type SectionBoard,
  type StandGroup,
} from "@/lib/newspaper-box";
import { getCfbTeamInterestRating } from "@/lib/ruwt";

function cfbWatch(game: BoxGame): number {
  const away = game.away.id ? getCfbTeamInterestRating(game.away.id) : 0;
  const home = game.home.id ? getCfbTeamInterestRating(game.home.id) : 0;
  return away + home;
}

function clubMark(side: BoxSide, scores: boolean) {
  return (
    <b>
      {side.rank ? <span className="tt-cfb-rank">#{side.rank} </span> : null}
      {side.abbrev}
      {scores && side.score != null ? <i className="tt-cfb-score">{side.score}</i> : null}
    </b>
  );
}

function rowWhen(game: BoxGame, kind: "results" | "schedule"): string {
  if (kind === "results") {
    if (game.live) return looksLikeEspnZoneClock(game.status) ? "Live" : gameClock(game);
    return "Final";
  }
  return formatKickoffLine(game.startIso) || gameClock(game);
}

function CfbBlock({
  games,
  kind,
  title,
}: {
  games: BoxGame[];
  kind: "results" | "schedule";
  title: string;
}) {
  const ranked = [...games].sort(
    (a, b) => cfbWatch(b) - cfbWatch(a) || String(a.startIso).localeCompare(String(b.startIso)),
  );
  return (
    <section className="tt-cfb-block">
      <h3 className="wsj-band-title">
        {title} <em>{ranked.length} {ranked.length === 1 ? "game" : "games"}</em>
      </h3>
      <ol className="tt-cfb-rows">
        {ranked.map((game) => (
          <li key={game.id} className="tt-cfb-row" data-kind={kind}>
            <time dateTime={game.startIso ?? undefined}>{rowWhen(game, kind)}</time>
            <span className="tt-cfb-clubs">
              {game.away.logo ? <img src={game.away.logo} alt="" /> : null}
              {clubMark(game.away, kind === "results")}
              <i>at</i>
              {game.home.logo ? <img src={game.home.logo} alt="" /> : null}
              {clubMark(game.home, kind === "results")}
            </span>
            <em>
              {kind === "schedule"
                ? game.broadcasts.filter(Boolean).join(" · ") || game.venue || ""
                : ""}
            </em>
            {kind === "schedule" ? (
              <span className="tt-cfb-watch" title="RUwT watchability">
                <i>Watch</i>
                {cfbWatch(game)}
              </span>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CfbFill({ poll, standings }: { poll: CfbPollRow[]; standings: StandGroup[] }) {
  const sec = secStandingsGroup(standings);
  if (!poll.length && !sec) return null;
  return (
    <div className="tt-cfb-fill">
      {poll.length ? (
        <section className="tt-cfb-poll" aria-label="AP Top 25">
          <h3 className="wsj-band-title">AP Top 25</h3>
          <ol>
            {poll.map((row) => (
              <li key={`${row.rank}-${row.abbrev}`}>
                <i>#{row.rank}</i>
                {row.logo ? <img src={row.logo} alt="" /> : null}
                <b>{row.abbrev}</b>
                <em>{row.record || ""}</em>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {sec ? (
        <section className="tt-cfb-sec" aria-label="SEC standings">
          <StandingsTable group={sec} mine={() => false} />
        </section>
      ) : null}
    </div>
  );
}

/** CFB5 — week results, week slate, then AP poll / SEC tables so the page does not go empty. */
export function CfbScheduleDesk({
  board,
  edition,
  standings = [],
  poll = [],
}: {
  board?: SectionBoard | null;
  edition?: string;
  standings?: StandGroup[];
  poll?: CfbPollRow[];
}) {
  const rawResults = board?.results.length ? board.results : (board?.prior ?? []);
  const results = rawResults.filter(isCfbDeskGame);
  const slate = (board?.slate ?? []).filter((g) => !g.final && !g.live && isCfbDeskGame(g));
  if (!results.length && !slate.length && !poll.length && !secStandingsGroup(standings)) {
    return <p className="wsj-empty">The college slate is quiet.</p>;
  }
  return (
    <div className="tt-schedule tt-schedule-fill tt-cfb-desk">
      {results.length ? (
        <CfbBlock
          games={results}
          kind="results"
          title={footballWeekTitle("results", board?.resultsWeekNumber ?? board?.priorWeekNumber, results)}
        />
      ) : null}
      {slate.length ? (
        <CfbBlock
          games={slate}
          kind="schedule"
          title={footballWeekTitle("schedule", board?.slateWeekNumber ?? board?.weekNumber, slate)}
        />
      ) : null}
      <CfbFill poll={poll} standings={standings} />
    </div>
  );
}
