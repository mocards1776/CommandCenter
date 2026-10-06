import type { MlbPlayoffRoundId, MlbPlayoffSeries, MlbPlayoffSide, MlbPlayoffTree } from "@/lib/mlb";
import { formatSeriesGameLine } from "@/lib/newspaper-playoff-dates";
import { cn } from "@/lib/utils";

const ROUND_NAMES: Record<MlbPlayoffRoundId, string> = {
  wc: "Wild Card",
  ds: "Division Series",
  lcs: "Championship Series",
  ws: "World Series",
};

function logo(side: MlbPlayoffSide): string | null {
  return side.teamId && !side.placeholder ? `https://www.mlbstatic.com/team-logos/${side.teamId}.svg` : null;
}

function leader(series: MlbPlayoffSeries): "away" | "home" | null {
  if (series.away.wins === series.home.wins) return null;
  return series.away.wins > series.home.wins ? "away" : "home";
}

function seriesLine(series: MlbPlayoffSeries): string {
  const lead = leader(series);
  const hi = Math.max(series.away.wins, series.home.wins);
  const lo = Math.min(series.away.wins, series.home.wins);
  if (series.completed && lead) return `${series[lead].abbrev} wins, ${hi}-${lo}`;
  const next = series.games.find((g) => !g.final);
  if (next?.live) return `Game ${next.gameNumber} · ${next.status}`;
  if (lead) return `${series[lead].abbrev} leads ${hi}-${lo}`;
  if (hi > 0) return `Tied ${hi}-${lo}`;
  if (series.away.placeholder || series.home.placeholder) return `Best of ${series.gamesInSeries}`;
  return next?.when ? `Game ${next.gameNumber} · ${next.when}` : `Best of ${series.gamesInSeries}`;
}

function Club({
  side,
  state,
  big,
}: {
  side: MlbPlayoffSide;
  state: "won" | "lost" | "open";
  big?: boolean;
}) {
  const src = logo(side);
  return (
    <div className={cn("tt-br-club", state, big && "big")}>
      <span className="tt-br-disc">
        {src ? <img src={src} alt="" loading="lazy" /> : <i>{side.abbrev.split("/").join(" / ") || "TBD"}</i>}
      </span>
      <b>{side.placeholder ? "TBD" : side.abbrev}</b>
      <em>{side.placeholder ? "" : side.wins}</em>
    </div>
  );
}

function SeriesNode({ series, big }: { series: MlbPlayoffSeries; big?: boolean }) {
  const lead = leader(series);
  const state = (who: "away" | "home") =>
    series.completed ? (lead === who ? "won" : "lost") : ("open" as const);
  return (
    <article className={cn("tt-br-node", series.completed && "done", big && "big")}>
      <Club side={series.away} state={state("away")} big={big} />
      <Club side={series.home} state={state("home")} big={big} />
      <p>{seriesLine(series)}</p>
    </article>
  );
}

function teamsOf(series: MlbPlayoffSeries): string[] {
  return [series.away, series.home].flatMap((s) => s.abbrev.split("/")).filter(Boolean);
}

/** Put each wild-card series beside the division series its winner feeds. */
function feedOrder(wc: MlbPlayoffSeries[], ds: MlbPlayoffSeries[]): MlbPlayoffSeries[] {
  const left = [...wc];
  const out: MlbPlayoffSeries[] = [];
  for (const d of ds) {
    const names = teamsOf(d);
    const i = left.findIndex((w) => teamsOf(w).some((t) => names.includes(t)));
    if (i >= 0) out.push(...left.splice(i, 1));
  }
  return [...out, ...left];
}

function LeagueHalf({ tree, league, side }: { tree: MlbPlayoffTree; league: "AL" | "NL"; side: "l" | "r" }) {
  const of = (id: MlbPlayoffRoundId) =>
    tree.rounds.find((r) => r.id === id)?.series.filter((s) => s.league === league) ?? [];
  const ds = of("ds");
  const wc = feedOrder(of("wc"), ds);
  const lcs = of("lcs");
  const cols = [
    { id: "wc" as const, list: wc },
    { id: "ds" as const, list: ds },
    { id: "lcs" as const, list: lcs },
  ];
  const ordered = side === "l" ? cols : [...cols].reverse();
  return (
    <div className={cn("tt-br-half", side)}>
      <h4 className="tt-br-league">{league === "AL" ? "American League" : "National League"}</h4>
      <div className="tt-br-cols">
        {ordered.map((col) => (
          <div key={col.id} className={cn("tt-br-col", col.id)}>
            <span className="tt-br-round">{col.id === "lcs" ? `${league}CS` : ROUND_NAMES[col.id]}</span>
            <div className={cn("tt-br-stack", col.list.length > 1 && "pair")}>
              {col.list.length ? (
                col.list.map((s) => <SeriesNode key={s.id} series={s} />)
              ) : (
                <p className="tt-br-empty">To be set</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Every series with games on the board: the line so far and each game's result or first pitch. */
function SeriesLog({ tree }: { tree: MlbPlayoffTree }) {
  const series = tree.rounds
    .flatMap((r) => r.series)
    .filter((s) => s.games.length && !s.away.placeholder && !s.home.placeholder)
    .sort((a, b) => Number(a.completed) - Number(b.completed));
  if (!series.length) return null;
  return (
    <section className="tt-br-log" data-tt-flow="">
      <h4 className="wsj-band-title">Series by series</h4>
      <div className="tt-br-log-grid">
        {series.map((s) => (
          <article key={s.id} className={cn("tt-br-log-card", s.completed && "done")}>
            <header>
              <span>
                {s.league !== "MLB" ? `${s.league} ` : ""}
                {ROUND_NAMES[s.round]}
              </span>
              <b>{seriesLine(s)}</b>
            </header>
            <p className="tt-br-log-teams">
              {[s.away, s.home].map((side, i) => (
                <span key={i} className={cn(s.completed && leader(s) === (i === 0 ? "away" : "home") && "won")}>
                  {logo(side) ? <img src={logo(side)!} alt="" loading="lazy" /> : null}
                  {side.name}
                </span>
              ))}
            </p>
            <ol>
              {s.games.map((g) => (
                <li key={g.gamePk} className={cn(g.live && "live")}>
                  <span>{formatSeriesGameLine(g, s.away.abbrev, s.home.abbrev)}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PlayoffBracket({ tree }: { tree: MlbPlayoffTree }) {
  const ws = tree.rounds.find((r) => r.id === "ws")?.series[0] ?? null;
  const champ = ws?.completed ? ws[leader(ws) ?? "home"] : null;
  return (
    <div className="tt-bracket">
      <header className="tt-br-head">
        <span>{tree.season}</span>
        <h3>Postseason Picture</h3>
        <span>{tree.active ? "Series in progress" : champ ? `${champ.name}, champions` : "Bracket"}</span>
      </header>
      <div className="tt-br-scroll">
        <div className="tt-br-board">
          <LeagueHalf tree={tree} league="AL" side="l" />
          <div className="tt-br-center">
            <span className="tt-br-trophy" aria-hidden="true">
              <svg viewBox="0 0 64 64">
                <path d="M18 8h28v10a14 14 0 0 1-28 0V8Z" />
                <path d="M18 12H9v4a9 9 0 0 0 9 9M46 12h9v4a9 9 0 0 1-9 9" fill="none" strokeWidth="3" />
                <path d="M28 32h8v10h-8zM20 46h24v6H20zM16 52h32v4H16z" />
              </svg>
            </span>
            <span className="tt-br-round">World Series</span>
            {ws ? <SeriesNode series={ws} big /> : <p className="tt-br-empty">AL champion vs. NL champion</p>}
            {champ ? <p className="tt-br-champ">{champ.name}</p> : null}
          </div>
          <LeagueHalf tree={tree} league="NL" side="r" />
        </div>
      </div>
      <SeriesLog tree={tree} />
    </div>
  );
}
