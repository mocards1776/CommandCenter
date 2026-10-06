import { Fragment } from "react";
import { StandingsTable } from "@/components/newspaper/BoxScore";
import {
  cfbNetworkLabel,
  formatKickoffLine,
  footballWeekTitle,
  gameClock,
  isCfbDeskGame,
  looksLikeEspnZoneClock,
  secStandingsGroup,
  groupCfbGamesByDay,
  type BoxGame,
  type BoxSide,
  type CfbPollRow,
  type SectionBoard,
  type StandGroup,
} from "@/lib/newspaper-box";
import { attachHeismanLogos, type HeismanBoard } from "@/lib/newspaper-heisman";
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
  const days = groupCfbGamesByDay(games);
  const rowCount = Math.max(1, Math.ceil(games.length / 2) + days.length);
  return (
    <section className="tt-cfb-block">
      <h3 className="wsj-band-title">
        {title} <em>{games.length} {games.length === 1 ? "game" : "games"}</em>
      </h3>
      <ol className="tt-cfb-rows" style={{ ["--cfb-rows" as string]: String(rowCount) }}>
        {days.map((day) => (
          <Fragment key={day.key}>
            <li className="tt-cfb-day" aria-label={day.label}>
              {day.label}
            </li>
            {day.games.map((game, i) => (
              <li
                key={game.id}
                className="tt-cfb-row"
                data-kind={kind}
                data-tt-trim={(kind === "schedule" ? 70 : 40) + i}
              >
                <time dateTime={game.startIso ?? undefined}>{rowWhen(game, kind)}</time>
                <span className="tt-cfb-clubs">
                  {game.away.logo ? <img src={game.away.logo} alt="" /> : null}
                  {clubMark(game.away, kind === "results")}
                  <i>at</i>
                  {game.home.logo ? <img src={game.home.logo} alt="" /> : null}
                  {clubMark(game.home, kind === "results")}
                </span>
                {kind === "schedule" ? (
                  <>
                    <em className="tt-cfb-tv">{cfbNetworkLabel(game)}</em>
                    <span className="tt-cfb-watch" title="RUwT watchability">
                      <i>Watch</i>
                      {cfbWatch(game)}
                    </span>
                  </>
                ) : null}
              </li>
            ))}
          </Fragment>
        ))}
      </ol>
    </section>
  );
}

export function CfbFill({
  poll,
  standings,
  heisman,
  compact,
}: {
  poll: CfbPollRow[];
  standings: StandGroup[];
  heisman?: HeismanBoard | null;
  compact?: boolean;
}) {
  const sec = secStandingsGroup(standings);
  const pollRows = compact ? poll.slice(0, 10) : poll;
  const hints = [
    ...pollRows.map((row) => ({ name: row.name, abbrev: row.abbrev, logo: row.logo })),
    ...(sec?.rows ?? []).map((row) => ({ name: row.name, abbrev: row.abbrev, logo: row.logo })),
  ];
  const odds = !compact && heisman?.rows.length ? attachHeismanLogos(heisman, hints) : null;
  if (!pollRows.length && !sec && !odds) return null;
  const left = pollRows.length > 0 || odds != null;
  return (
    <div className={left && sec ? "tt-cfb-fill" : "tt-cfb-fill solo"}>
      {left ? (
        <div className="tt-cfb-fill-left">
          {pollRows.length ? (
            <section className="tt-cfb-poll" aria-label="AP Top 25">
              <h3 className="wsj-band-title">AP Top 25</h3>
              <ol>
                {pollRows.map((row, i) => (
                  <li key={`${row.rank}-${row.abbrev}`} {...(i >= 15 ? { "data-tt-trim": 90 + i } : {})}>
                    <i>#{row.rank}</i>
                    {row.logo ? <img src={row.logo} alt="" /> : null}
                    <b>{row.abbrev}</b>
                    <em>{row.record || ""}</em>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {odds ? (
            <section className="tt-cfb-heisman" aria-label="Heisman Trophy odds">
              <h3 className="wsj-band-title">Heisman Trophy</h3>
              <ol>
                {odds.rows.map((row, i) => (
                  <li key={row.ticker}>
                    <i>{i + 1}</i>
                    {row.logo ? <img src={row.logo} alt="" /> : <span className="tt-cfb-heisman-ph" />}
                    <span className="tt-cfb-heisman-who">
                      <b>{row.name}</b>
                      <em>{row.school}</em>
                    </span>
                    <strong>{row.pct}%</strong>
                  </li>
                ))}
              </ol>
              <p className="tt-cfb-heisman-credit">{odds.asOf}</p>
            </section>
          ) : null}
        </div>
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
  heisman = null,
}: {
  board?: SectionBoard | null;
  edition?: string;
  standings?: StandGroup[];
  poll?: CfbPollRow[];
  heisman?: HeismanBoard | null;
}) {
  const rawResults = board?.results.length ? board.results : (board?.prior ?? []);
  const results = rawResults.filter(isCfbDeskGame);
  const slate = (board?.slate ?? []).filter((g) => !g.final && !g.live && isCfbDeskGame(g));
  if (!results.length && !slate.length && !poll.length && !secStandingsGroup(standings) && !heisman?.rows.length) {
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
      <CfbFill poll={poll} standings={standings} heisman={heisman} />
    </div>
  );
}
