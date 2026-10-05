import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Linescore, ScoreMast, ScoreStrip } from "@/components/newspaper/BoxScore";
import { PlayoffBracket } from "@/components/newspaper/PlayoffBracket";
import { fetchMlbPlayoffTree } from "@/lib/mlb";
import {
  fetchLeagueLeaders,
  fetchSectionBoard,
  type BoxGame,
  type LeagueLeaderGroup,
  type SectionBoard,
} from "@/lib/newspaper-box";
import { newspaperEspnGet } from "@/lib/newspaper-espn";
import { editionNewsDay, pressEdition } from "@/lib/newspaper";

/**
 * Public iPad proof of the sport-section work. Not linked from nav.
 * `?page=mlb-front|mlb-playoffs|mlb-leaders|nfl-front`
 */
export default function NewspaperSportPreviewPage() {
  const [params] = useSearchParams();
  const page = params.get("page") || "mlb-front";
  const press = pressEdition();
  const mlbBoard = useQuery({
    queryKey: ["tt-sport-preview", "mlb-board", press.day],
    queryFn: () => fetchSectionBoard("baseball/mlb", press.day),
    staleTime: 5 * 60_000,
    enabled: page === "mlb-front",
  });
  const nflBoard = useQuery({
    queryKey: ["tt-sport-preview", "nfl-board", press.day],
    queryFn: () => fetchSectionBoard("football/nfl", press.day),
    staleTime: 5 * 60_000,
    enabled: page === "nfl-front",
  });
  const mlbNews = useQuery({
    queryKey: ["tt-sport-preview", "mlb-news"],
    queryFn: () => fetchPreviewNews("baseball/mlb"),
    staleTime: 5 * 60_000,
    enabled: page === "mlb-front",
  });
  const nflNews = useQuery({
    queryKey: ["tt-sport-preview", "nfl-news"],
    queryFn: () => fetchPreviewNews("football/nfl"),
    staleTime: 5 * 60_000,
    enabled: page === "nfl-front",
  });
  const mlbLeaders = useQuery({
    queryKey: ["tt-sport-preview", "mlb-leaders"],
    queryFn: () => fetchLeagueLeaders("baseball/mlb"),
    staleTime: 5 * 60_000,
    enabled: page === "mlb-leaders",
  });
  const playoffs = useQuery({
    queryKey: ["tt-sport-preview", "mlb-playoffs"],
    queryFn: () => fetchMlbPlayoffTree(),
    staleTime: 5 * 60_000,
    enabled: page === "mlb-playoffs",
  });

  const ready =
    page === "mlb-front"
      ? mlbBoard.isFetched
      : page === "nfl-front"
        ? nflBoard.isFetched
        : page === "mlb-leaders"
          ? mlbLeaders.isFetched
          : playoffs.isFetched;

  return (
    <div className="newspaper-root wsj-shell tt-watch-preview" data-sport-preview={page} data-ready={ready ? "1" : "0"}>
      <div className="wsj-page">
        <div className="wsj-fit">
          <div className="wsj-sheet">
            {page === "mlb-playoffs" ? (
              <SportChrome
                code="MLB"
                title="Major League Baseball"
                desk="Playoffs"
                blurb={playoffs.data ? `${playoffs.data.season} postseason bracket` : "Postseason bracket"}
                folio="MLB4"
              >
                {playoffs.data ? <PlayoffBracket tree={playoffs.data} /> : <p className="wsj-empty">Setting the bracket…</p>}
              </SportChrome>
            ) : page === "mlb-leaders" ? (
              <SportChrome
                code="MLB"
                title="Major League Baseball"
                desk={mlbLeaders.data?.some((g) => g.seasonType === 3) ? "Postseason Leaders" : "League Leaders"}
                blurb={
                  mlbLeaders.data?.length
                    ? `${mlbLeaders.data.length} categories · the top five in each · postseason`
                    : "League leaders"
                }
                folio="MLB5"
              >
                <LeadersPreview groups={mlbLeaders.data ?? []} />
              </SportChrome>
            ) : page === "nfl-front" ? (
              <FrontPreview
                code="NFL"
                title="National Football League"
                games={boardFinals(nflBoard.data)}
                stories={nflNews.data ?? []}
                newsDay={editionNewsDay(press.day)}
              />
            ) : (
              <FrontPreview
                code="MLB"
                title="Major League Baseball"
                games={boardFinals(mlbBoard.data)}
                stories={mlbNews.data ?? []}
                newsDay={editionNewsDay(press.day)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type PreviewStory = { id: string; headline: string; dek: string | null; photo: string | null };

async function fetchPreviewNews(path: string): Promise<PreviewStory[]> {
  const data = (await newspaperEspnGet(`${path}/news?limit=20`).catch(() => null)) as {
    articles?: { id?: string; headline?: string; description?: string; images?: { url?: string }[] }[];
  } | null;
  return (data?.articles ?? []).flatMap((article, i) => {
    const headline = article.headline?.trim();
    if (!headline) return [];
    return [
      {
        id: String(article.id ?? `news-${i}`),
        headline,
        dek: article.description ?? null,
        photo: article.images?.[0]?.url ?? null,
      },
    ];
  });
}

function boardFinals(board?: SectionBoard): BoxGame[] {
  if (!board) return [];
  if (board.results.length) return board.results;
  if (board.prior?.length) return board.prior;
  return (board.week ?? []).filter((g) => g.final);
}

function SportChrome({
  code,
  title,
  desk,
  blurb,
  folio,
  children,
}: {
  code: string;
  title: string;
  desk?: string;
  blurb: string;
  folio: string;
  children: ReactNode;
}) {
  return (
    <div className={desk ? "wsj-sport" : "wsj-sport focus-front"}>
      {desk ? (
        <header className="wsj-sport-band">
          <span className="wsj-sport-code">{code}</span>
          <h3>
            {title} <em>{desk}</em>
          </h3>
          <p>{blurb}</p>
        </header>
      ) : (
        <header className="wsj-sport-hero">
          <div className="wsj-sport-hero-mark">
            <span className="wsj-sport-code">{code}</span>
            <div>
              <h3>{title}</h3>
              <p>{blurb}</p>
            </div>
          </div>
        </header>
      )}
      <div className="wsj-sport-solo">{children}</div>
      <p className="wsj-folio" style={{ textAlign: "right", margin: "8px 0 0", fontSize: 11 }}>
        PAGE {folio}
      </p>
    </div>
  );
}

function FrontPreview({
  code,
  title,
  games,
  stories,
  newsDay,
}: {
  code: string;
  title: string;
  games: BoxGame[];
  stories: PreviewStory[];
  newsDay: string;
}) {
  const lead = games.find((g) => g.recap?.photo) ?? games.find((g) => g.recap) ?? games[0] ?? null;
  const seconds = [
    ...games.filter((g) => g !== lead && g.recap).map((g) => ({
      id: g.id,
      headline: g.recap?.headline || `${g.away.short} ${g.away.score}, ${g.home.short} ${g.home.score}`,
      photo: g.recap?.photo ?? null,
    })),
    ...stories
      .filter((s) => s.photo)
      .map((s) => ({ id: s.id, headline: s.headline, photo: s.photo })),
  ]
    .filter((s, i, all) => all.findIndex((x) => x.headline === s.headline) === i)
    .slice(0, 4);
  return (
    <SportChrome
      code={code}
      title={title}
      blurb={`${games.length} ${games.length === 1 ? "final" : "finals"} · ${newsDay} board`}
      folio={`${code}1`}
    >
      {lead ? (
        <div className="tt-section-front">
          <div className={`tt-front-grid${seconds.length || games.length ? " with-side" : ""}`}>
            <div className="tt-front-lead">
              {lead.recap?.photo ? (
                <figure className="wsj-story-art">
                  <img src={lead.recap.photo} alt="" style={{ width: "100%", display: "block" }} />
                </figure>
              ) : null}
              <p className="wsj-kicker">{lead.round || lead.series || lead.league}</p>
              <h2 className="wsj-hl xl">{lead.recap?.headline || `${lead.away.short} ${lead.away.score}, ${lead.home.short} ${lead.home.score}`}</h2>
              {lead.recap?.blurb ? <p className="wsj-dek">{lead.recap.blurb}</p> : null}
              <div className="tt-front-banner">
                <ScoreMast game={lead} />
                <Linescore game={lead} compact />
              </div>
            </div>
            <div className="tt-front-side">
              {seconds.length ? (
                <div className="wsj-sport-seconds">
                  {seconds.map((story) => (
                    <article key={story.id} className="wsj-story art-top">
                      {story.photo ? (
                        <div className="wsj-story-art">
                          <img src={story.photo} alt="" />
                        </div>
                      ) : null}
                      <h3 className="wsj-hl md">{story.headline}</h3>
                    </article>
                  ))}
                </div>
              ) : null}
              {games.length ? (
                <section className="tt-front-rail" aria-label="Scores">
                  <h3 className="wsj-band-title">Last night’s scores</h3>
                  <ScoreStrip games={games.slice(0, 10)} />
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="wsj-empty">Setting the section front…</p>
      )}
    </SportChrome>
  );
}

function LeadersPreview({ groups }: { groups: LeagueLeaderGroup[] }) {
  if (!groups.length) return <p className="wsj-empty">The league has not posted its leaders.</p>;
  const post = groups.some((g) => g.seasonType === 3);
  return (
    <section className="tt-lleaders tt-lleaders-desk" aria-label={post ? "Postseason leaders" : "League leaders"}>
      <div className="tt-lleaders-grid">
        {groups.map((group) => (
          <div key={group.category} className="tt-lleaders-cat">
            <h4>{group.category}</h4>
            <ol>
              {group.rows.map((row, i) => (
                <li key={`${group.category}-${row.name}-${i}`}>
                  <i>{i + 1}</i>
                  {row.headshot ? <img src={row.headshot} alt="" /> : <span className="tt-lleaders-ph" />}
                  <span className="tt-lleaders-who">
                    <strong>{row.name}</strong>
                    <em>{row.team}</em>
                  </span>
                  <span className="tt-lleaders-val">
                    <b>{row.line}</b>
                    {row.note ? <em>{row.note}</em> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
