import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Linescore, MatchupCard, ScoreCard, ScoreMast, ScoreStrip } from "@/components/newspaper/BoxScore";
import { RecapBox, RecapChrome, RecapPhoto } from "@/components/newspaper/GameRecap";
import {
  boxStoryCard,
  fetchSectionBoard,
  sportScoreBands,
  type BoxGame,
  type SectionBoard,
} from "@/lib/newspaper-box";
import { isPrintableStoryBody, proseParas, sanitizeArticleBody } from "@/lib/newspaper-copy";
import { newspaperEspnGet } from "@/lib/newspaper-espn";
import { editionDateline, editionIssue, romanNumeral } from "@/lib/newspaper";
import type { GameWrapCard } from "@/lib/newspaper-sports";
import { PlayerPopProvider } from "@/components/newspaper/PlayerPop";

const EDITION_DAY = "2026-10-06";
const FAVORITES: { key: string; abbrev: string; name: string }[] = [
  { key: "nfl-det", abbrev: "DET", name: "Lions" },
  { key: "nfl-kc", abbrev: "KC", name: "Chiefs" },
  { key: "nfl-dal", abbrev: "DAL", name: "Cowboys" },
];

/**
 * Public iPad proof of the 2026-10-05-evening Times fixes, recomposed as
 * Tuesday morning. Not linked from nav.
 * `?page=a1|a4|a-favorites|nfl1|nfl2|nfl-schedule`
 */
export default function NewspaperTimesPreviewPage() {
  const [params] = useSearchParams();
  const page = params.get("page") || "a1";
  const boardQ = useQuery({
    queryKey: ["tt-times-preview", "nfl-board", EDITION_DAY],
    queryFn: () => fetchSectionBoard("football/nfl", EDITION_DAY),
    staleTime: 5 * 60_000,
  });
  const recapsQ = useQuery({
    queryKey: ["tt-times-preview", "fav-recaps", EDITION_DAY, boardQ.dataUpdatedAt],
    queryFn: () => favoriteRecaps(boardQ.data!),
    enabled: Boolean(boardQ.data),
    staleTime: 5 * 60_000,
  });

  const ready = boardQ.isFetched && (page.startsWith("nfl") ? true : recapsQ.isFetched);
  const board = boardQ.data ?? null;
  const recaps = recapsQ.data ?? [];
  const lions = recaps.find((r) => r.card.favoriteKey === "nfl-det") ?? null;
  const chiefs = recaps.find((r) => r.card.favoriteKey === "nfl-kc") ?? null;
  const cowboys = recaps.find((r) => r.card.favoriteKey === "nfl-dal") ?? null;
  const weekGames = boardFinals(board);
  const otherFinals = weekGames.filter((g) => !favoriteGame(g));

  return (
    <PlayerPopProvider people={[]}>
      <div className="newspaper-root wsj-shell tt-watch-preview" data-times-preview={page} data-ready={ready ? "1" : "0"}>
        <div className="wsj-page">
          <div className="wsj-fit">
            <div className="wsj-sheet">
              {page === "a4" ? (
                <TimesChrome folio="A4" kicker="The Essentials" desk="Lions">
                  {lions ? <FullRecap recap={lions} /> : <p className="wsj-empty">Setting the Lions recap…</p>}
                </TimesChrome>
              ) : page === "a-favorites" ? (
                <TimesChrome folio="A2" kicker="The Essentials" desk="Favorite finals">
                  {chiefs ? <FullRecap recap={chiefs} /> : null}
                  {cowboys ? <FullRecap recap={cowboys} /> : null}
                  {!chiefs && !cowboys ? <p className="wsj-empty">Setting favorite recaps…</p> : null}
                </TimesChrome>
              ) : page === "nfl1" ? (
                <NflFront board={board} recaps={recaps} games={weekGames} />
              ) : page === "nfl2" ? (
                <TimesChrome folio="NFL2" kicker="NFL" desk="Recaps">
                  <div className="tt-score-grid" style={{ ["--cols" as string]: "3" }}>
                    {otherFinals.map((g) => (
                      <ScoreCard key={g.id} game={g} />
                    ))}
                  </div>
                </TimesChrome>
              ) : page === "nfl-schedule" ? (
                <NflSchedule board={board} />
              ) : (
                <A1Front recaps={recaps} />
              )}
            </div>
          </div>
        </div>
      </div>
    </PlayerPopProvider>
  );
}

type FavRecap = { card: GameWrapCard; game: BoxGame };

async function favoriteRecaps(board: SectionBoard): Promise<FavRecap[]> {
  const games = boardFinals(board);
  const out: FavRecap[] = [];
  for (const fav of FAVORITES) {
    const game = games.find((g) => involvesAbbrev(g, fav.abbrev));
    if (!game) continue;
    const card = await recapCardFor(game, fav);
    out.push({ card, game });
  }
  return out;
}

async function recapCardFor(game: BoxGame, fav: (typeof FAVORITES)[number]): Promise<GameWrapCard> {
  const base = boxStoryCard(game);
  const eventId = game.espnEventId || game.id;
  let body = sanitizeArticleBody(base?.body);
  try {
    const sum = (await newspaperEspnGet(`football/nfl/summary?event=${eventId}`)) as {
      article?: { story?: string; headline?: string };
      news?: { articles?: { story?: string; headline?: string }[] };
    };
    const raws = [sum.article?.story, ...(sum.news?.articles ?? []).map((a) => a.story)].filter(Boolean);
    for (const raw of raws) {
      const text = sanitizeArticleBody(String(raw));
      if (isPrintableStoryBody(text) && text.length > (body?.length ?? 0)) body = text;
    }
  } catch {
    /* box wrap / scoreboard recap stays */
  }
  const headline = base?.headline && !/game highlights/i.test(base.headline)
    ? base.headline
    : `${game.away.short} ${game.away.score}, ${game.home.short} ${game.home.score}`;
  return {
    ...(base ?? emptyCard(game)),
    id: `fav-${fav.key}-${game.id}`,
    favoriteKey: fav.key,
    followed: true,
    teamName: fav.name,
    headline,
    body: body || base?.body || `${game.away.short} ${game.away.score}, ${game.home.short} ${game.home.score}.`,
    gameId: eventId,
    leaguePath: "football/nfl",
  };
}

function emptyCard(game: BoxGame): GameWrapCard {
  return {
    id: `box-${game.id}`,
    favoriteKey: "",
    teamName: game.home.short,
    teamHref: game.href ?? "/",
    sportLabel: "NFL",
    leaguePath: "football/nfl",
    headline: `${game.away.short} ${game.away.score}, ${game.home.short} ${game.home.score}`,
    dek: null,
    body: null,
    scoreLine: `${game.away.abbrev} ${game.away.score} · ${game.home.abbrev} ${game.home.score}`,
    when: game.startIso,
    won: null,
    gameHref: game.href,
    wrapHref: game.href,
    feedUrl: null,
    gameId: game.espnEventId || game.id,
    stats: [],
    leaders: [],
    teamStats: [],
    division: [],
  };
}

function boardFinals(board: SectionBoard | null): BoxGame[] {
  if (!board) return [];
  if (board.results.length) return board.results;
  if (board.week?.length) return board.week.filter((g) => g.final);
  return board.prior ?? [];
}

function involvesAbbrev(game: BoxGame, abbrev: string): boolean {
  return game.away.abbrev === abbrev || game.home.abbrev === abbrev;
}

function favoriteGame(game: BoxGame): boolean {
  return FAVORITES.some((f) => involvesAbbrev(game, f.abbrev));
}

function TimesChrome({
  folio,
  kicker,
  desk,
  children,
}: {
  folio: string;
  kicker: string;
  desk?: string;
  children: ReactNode;
}) {
  const { volume, issue } = editionIssue(EDITION_DAY);
  return (
    <div className="wsj-sport">
      <header className="wsj-mast">
        <div className="wsj-mast-row">
          <div className="wsj-ear">
            <strong>Sports Final</strong>
            <span>All the scores fit to print</span>
          </div>
          <h1 className="wsj-nameplate">The Thompson Times</h1>
          <div className="wsj-ear right">
            <strong>Morning Edition</strong>
            <span>Tuesday recompose</span>
          </div>
        </div>
        <div className="wsj-dateline-bar">
          <span>
            Vol. {romanNumeral(volume)} · No. {issue}
          </span>
          <span className="c">{editionDateline(EDITION_DAY)}</span>
          <span className="r">
            {kicker}
            {desk ? ` · ${desk}` : ""} · {folio}
          </span>
        </div>
      </header>
      <div className="wsj-sport-solo">{children}</div>
      <p className="wsj-folio" style={{ textAlign: "right", margin: "8px 0 0", fontSize: 11 }}>
        PAGE {folio}
      </p>
    </div>
  );
}

function FullRecap({ recap }: { recap: FavRecap }) {
  const paras = proseParas(recap.card.body ?? "", 12);
  return (
    <article className="wsj-inside-story first">
      <p className="wsj-kicker">{recap.card.teamName} · NFL</p>
      <h2 className="wsj-hl xl">{recap.card.headline}</h2>
      <RecapChrome card={recap.card} game={recap.game} />
      <RecapPhoto url={recap.card.photo} width={recap.card.photoWidth} caption={recap.card.caption} />
      <div className="wsj-prose">
        {paras.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </div>
      <RecapBox card={recap.card} game={recap.game} forceFull />
    </article>
  );
}

function A1Front({ recaps }: { recaps: FavRecap[] }) {
  const lead = recaps.find((r) => r.card.favoriteKey === "nfl-dal") ?? recaps[0] ?? null;
  const seconds = recaps.filter((r) => r !== lead);
  return (
    <TimesChrome folio="A1" kicker="The Essentials">
      {lead ? (
        <div className="tt-section-front">
          <div className={`tt-front-grid${seconds.length ? " with-side" : ""}`}>
            <div className="tt-front-lead">
              <p className="wsj-kicker">{lead.card.teamName} · NFL</p>
              <h2 className="wsj-hl xl">{lead.card.headline}</h2>
              <RecapChrome card={lead.card} game={lead.game} />
              <RecapPhoto url={lead.card.photo} width={lead.card.photoWidth} caption={lead.card.caption} />
              <div className="wsj-prose">
                {proseParas(lead.card.body ?? "", 4).map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            </div>
            <div className="tt-front-side">
              {seconds.map((r) => (
                <article key={r.card.id} className="wsj-story art-top">
                  <p className="wsj-kicker">{r.card.teamName}</p>
                  <h3 className="wsj-hl md">{r.card.headline}</h3>
                  <div className="tt-front-banner">
                    <ScoreMast game={r.game} />
                    <Linescore game={r.game} compact />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="wsj-empty">Setting the front…</p>
      )}
    </TimesChrome>
  );
}

function NflFront({
  board,
  recaps,
  games,
}: {
  board: SectionBoard | null;
  recaps: FavRecap[];
  games: BoxGame[];
}) {
  const strips = sportScoreBands("football/nfl", board, EDITION_DAY);
  const lead = recaps.find((r) => r.card.favoriteKey === "nfl-kc") ?? recaps[0] ?? null;
  const seconds = recaps.filter((r) => r !== lead).slice(0, 2);
  return (
    <TimesChrome folio="NFL1" kicker="NFL" desk="National Football League">
      {lead ? (
        <div className="tt-section-front">
          <div className="tt-front-grid with-side">
            <div className="tt-front-lead">
              <p className="wsj-kicker">NFL · {lead.card.teamName}</p>
              <h2 className="wsj-hl xl">{lead.card.headline}</h2>
              {lead.card.body ? <p className="wsj-dek">{proseParas(lead.card.body, 1)[0]}</p> : null}
              <div className="tt-front-banner">
                <ScoreMast game={lead.game} />
                <Linescore game={lead.game} compact />
              </div>
            </div>
            <div className="tt-front-side">
              {seconds.map((r) => (
                <article key={r.card.id} className="wsj-story">
                  <h3 className="wsj-hl md">{r.card.headline}</h3>
                </article>
              ))}
              {strips.map((strip) => (
                <section className="tt-front-rail" aria-label={strip.title} key={strip.title}>
                  <h3 className="wsj-band-title">
                    {strip.title} <em>{strip.games.length} games</em>
                  </h3>
                  <ScoreStrip games={strip.games} />
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : games.length ? (
        <section className="tt-front-rail" aria-label="Week scores">
          <h3 className="wsj-band-title">
            Week 4 finals <em>{games.length} games</em>
          </h3>
          <ScoreStrip games={games} />
        </section>
      ) : (
        <p className="wsj-empty">Setting the NFL front…</p>
      )}
    </TimesChrome>
  );
}

function NflSchedule({ board }: { board: SectionBoard | null }) {
  const games = (board?.slate ?? []).filter((g) => !g.final && !g.live);
  const days = new Map<string, BoxGame[]>();
  for (const g of games) {
    const list = days.get(g.day) ?? [];
    list.push(g);
    days.set(g.day, list);
  }
  return (
    <TimesChrome folio="NFL7" kicker="NFL" desk="Schedule">
      <div className="tt-schedule tt-schedule-fill">
        {[...days.entries()].map(([day, list]) => (
          <section key={day}>
            <h3 className="wsj-band-title">
              {day} <em>{list.length} {list.length === 1 ? "game" : "games"}</em>
            </h3>
            <div className="tt-matchups" style={{ ["--cols" as string]: "2" }}>
              {list.map((g) => (
                <MatchupCard key={g.id} game={g} />
              ))}
            </div>
          </section>
        ))}
        {!games.length ? <p className="wsj-empty">Setting the Week 5 slate…</p> : null}
      </div>
    </TimesChrome>
  );
}
