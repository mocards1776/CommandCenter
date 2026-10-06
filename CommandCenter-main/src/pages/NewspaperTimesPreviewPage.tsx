import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { DeskSnap, ScoreCard, ScoreStrip, SlateLine } from "@/components/newspaper/BoxScore";
import { RecapBox, RecapChrome, RecapPhoto } from "@/components/newspaper/GameRecap";
import {
  boxStoryCard,
  fetchSectionBoard,
  fetchSectionStandings,
  sportScoreBands,
  type BoxGame,
  type SectionBoard,
  type StandGroup,
} from "@/lib/newspaper-box";
import { isPrintableStoryBody, proseParas, sanitizeArticleBody } from "@/lib/newspaper-copy";
import { newspaperEspnGet } from "@/lib/newspaper-espn";
import { editionDateline, editionIssue, romanNumeral } from "@/lib/newspaper";
import {
  PAGE_CANVAS,
  groupByDay,
  pageHasBlankBand,
  planSchedulePages,
} from "@/lib/newspaper-page";
import { recapBodyForPage } from "@/lib/newspaper-recap";
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
  const standQ = useQuery({
    queryKey: ["tt-times-preview", "nfl-stand", EDITION_DAY],
    queryFn: () => fetchSectionStandings("football/nfl"),
    staleTime: 30 * 60_000,
    enabled: page === "nfl1" || page === "nfl-schedule",
  });

  const ready =
    boardQ.isFetched &&
    (page.startsWith("nfl") ? true : recapsQ.isFetched) &&
    (page === "nfl1" || page === "nfl-schedule" ? standQ.isFetched : true);
  const tables = favoriteTables(standQ.data ?? []);
  const board = boardQ.data ?? null;
  const recaps = recapsQ.data ?? [];
  const lions = recaps.find((r) => r.card.favoriteKey === "nfl-det") ?? null;
  const chiefs = recaps.find((r) => r.card.favoriteKey === "nfl-kc") ?? null;
  const cowboys = recaps.find((r) => r.card.favoriteKey === "nfl-dal") ?? null;
  const weekGames = boardFinals(board);
  const otherFinals = weekGames.filter((g) => !favoriteGame(g));
  const slate = (board?.slate ?? []).filter((g) => !g.final && !g.live);
  const schedulePacks = planSchedulePages(slate);

  const sheets =
    page === "a4"
      ? [
          <TimesChrome key="a4" folio="A4" kicker="The Essentials" desk="Lions">
            {lions ? (
              <div className="tt-section-front">
                <FullRecap recap={lions} grafs={5} box={false} />
                {chiefs ? <RailRecap recap={chiefs} grafs={1} /> : null}
              </div>
            ) : (
              <p className="wsj-empty">Setting the Lions recap…</p>
            )}
          </TimesChrome>,
        ]
      : page === "a-favorites"
        ? [
            <TimesChrome key="a-fav" folio="A2" kicker="The Essentials" desk="Favorite finals">
              {chiefs ? <RailRecap recap={chiefs} grafs={3} /> : null}
              {cowboys ? <RailRecap recap={cowboys} grafs={3} /> : null}
              {!chiefs && !cowboys ? <p className="wsj-empty">Setting favorite recaps…</p> : null}
            </TimesChrome>,
          ]
        : page === "nfl1"
          ? [
              <NflFront
                key="nfl1"
                board={board}
                recaps={recaps}
                games={weekGames}
                slate={slate}
                tables={tables}
              />,
            ]
          : page === "nfl2"
            ? [
                <TimesChrome key="nfl2" folio="NFL2" kicker="NFL" desk="Recaps">
                  <div className="tt-score-grid tt-score-fill" style={{ ["--cols" as string]: "3" }}>
                    {otherFinals.map((g) => (
                      <ScoreCard key={g.id} game={g} />
                    ))}
                  </div>
                </TimesChrome>,
              ]
            : page === "nfl-schedule"
              ? schedulePacks.map((pack, i) => (
                  <NflSchedule
                    key={`sched-${i}`}
                    games={pack}
                    folio={schedulePacks.length > 1 ? `NFL${7 + i}` : "NFL7"}
                    week={board?.slateWeekNumber ?? 5}
                    continued={i > 0}
                    fill={i === schedulePacks.length - 1 ? weekGames : []}
                    tables={tables}
                    allTables={standQ.data ?? []}
                  />
                ))
              : [
                  <A1Front key="a1" recaps={recaps} slate={slate} week={board?.slateWeekNumber ?? 5} />,
                ];

  return (
    <PlayerPopProvider people={[]}>
      <div
        className="newspaper-root wsj-shell tt-watch-preview tt-locked-page"
        data-times-preview={page}
        data-ready={ready ? "1" : "0"}
        data-canvas={`${PAGE_CANVAS.width}x${PAGE_CANVAS.height}`}
      >
        {sheets.map((sheet, i) => (
          <div className="wsj-page" key={i}>
            <div className="wsj-fit">
              <LockedSheet folio={sheet.key ?? String(i)}>{sheet}</LockedSheet>
            </div>
          </div>
        ))}
      </div>
    </PlayerPopProvider>
  );
}

function LockedSheet({ folio, children }: { folio: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [sparse, setSparse] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      setOverflow(el.scrollHeight > PAGE_CANVAS.height + 1);
      const box = el.getBoundingClientRect();
      const folio = el.querySelector(".wsj-folio");
      const foot = folio ? folio.getBoundingClientRect().top - box.top : PAGE_CANVAS.height;
      const ink = [...el.querySelectorAll(".tt-section-front, .tt-slate-desk, .tt-front-side")]
        .flatMap((node) => [...node.children])
        .filter((node) => node.getBoundingClientRect().height > 2);
      const bottoms = ink.map((node) => node.getBoundingClientRect().bottom);
      const contentBottom = bottoms.length ? Math.max(...bottoms) - box.top : 0;
      const gaps: number[] = [];
      const bands = [...el.querySelectorAll(".tt-slate-desk > section, .tt-slate-desk > h2, .tt-front-side > *")];
      for (let i = 1; i < bands.length; i++) {
        const gap = bands[i]!.getBoundingClientRect().top - bands[i - 1]!.getBoundingClientRect().bottom;
        if (gap > 1) gaps.push(Math.round(gap));
      }
      setSparse(
        pageHasBlankBand({
          contentBottomPx: Math.round(contentBottom),
          canvasHeight: Math.round(foot),
          internalGapsPx: gaps,
        }),
      );
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const node of el.querySelectorAll("img")) {
      node.addEventListener("load", check);
    }
    return () => {
      ro.disconnect();
      for (const node of el.querySelectorAll("img")) {
        node.removeEventListener("load", check);
      }
    };
  }, [children]);
  return (
    <div
      ref={ref}
      className="wsj-sheet"
      data-folio={folio}
      data-overflow={overflow ? "1" : "0"}
      data-sparse={sparse ? "1" : "0"}
      data-canvas={`${PAGE_CANVAS.width}x${PAGE_CANVAS.height}`}
    >
      {children}
    </div>
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

type SummaryArt = { url?: string; href?: string; width?: number };

async function recapCardFor(game: BoxGame, fav: (typeof FAVORITES)[number]): Promise<GameWrapCard> {
  const base = boxStoryCard(game);
  const eventId = game.espnEventId || game.id;
  let body = sanitizeArticleBody(base?.body);
  let photo = base?.photo ?? game.recap?.photo ?? null;
  let photoWidth = base?.photoWidth ?? null;
  try {
    const sum = (await newspaperEspnGet(`football/nfl/summary?event=${eventId}`)) as {
      article?: { story?: string; headline?: string; images?: SummaryArt[] };
      news?: { articles?: { story?: string; headline?: string; images?: SummaryArt[] }[] };
    };
    const raws = [sum.article?.story, ...(sum.news?.articles ?? []).map((a) => a.story)].filter(Boolean);
    for (const raw of raws) {
      const text = sanitizeArticleBody(String(raw));
      if (isPrintableStoryBody(text) && text.length > (body?.length ?? 0)) body = text;
    }
    // Recap art only — news-rail galleries (history cuts, etc.) are not the game photo.
    const art = pickSummaryPhoto(sum.article?.images ?? []);
    if (art) {
      photo = art.url;
      photoWidth = art.width ?? photoWidth;
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
    photo,
    photoWidth,
    caption: base?.caption ?? `${game.away.name} at ${game.home.name}${game.venue ? `, ${game.venue}` : ""}.`,
  };
}

function pickSummaryPhoto(images: SummaryArt[]): { url: string; width: number | null } | null {
  let best: { url: string; width: number | null } | null = null;
  for (const img of images) {
    const url = img.url || img.href;
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const width = typeof img.width === "number" ? img.width : null;
    if (!best || (width ?? 0) > (best.width ?? 0)) best = { url, width };
  }
  return best;
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

function scheduleDayLabel(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return new Date(`${day}T17:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

function pageParas(body: string | null | undefined, max: number): string[] {
  return proseParas(recapBodyForPage(body ?? ""), max);
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

function FullRecap({ recap, grafs = 4, box = false }: { recap: FavRecap; grafs?: number; box?: boolean }) {
  const paras = pageParas(recap.card.body, grafs);
  return (
    <article className="wsj-inside-story first">
      <p className="wsj-kicker">{recap.card.teamName} · NFL</p>
      <h2 className="wsj-hl xl">{recap.card.headline}</h2>
      <RecapChrome card={recap.card} game={recap.game} compact />
      <RecapPhoto url={recap.card.photo} width={Math.max(recap.card.photoWidth ?? 1200, 1200)} caption={recap.card.caption} />
      <div className="wsj-prose">
        {paras.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </div>
      {box ? <RecapBox card={recap.card} game={recap.game} compact forceFull /> : null}
    </article>
  );
}

function RailRecap({ recap, grafs = 2 }: { recap: FavRecap; grafs?: number }) {
  const paras = pageParas(recap.card.body, grafs);
  return (
    <article className="tt-rail-recap">
      <p className="wsj-kicker">{recap.card.teamName} · NFL</p>
      <h3 className="wsj-hl md">{recap.card.headline}</h3>
      <RecapChrome card={recap.card} game={recap.game} compact shortNames />
      {paras.map((p) => (
        <p key={p.slice(0, 40)} className="wsj-dek">
          {p}
        </p>
      ))}
    </article>
  );
}

function WeekPreview({
  games,
  week,
  take,
  className,
  cols = 2,
}: {
  games: BoxGame[];
  week: number;
  take?: number;
  className?: string;
  cols?: 1 | 2;
}) {
  if (!games.length) return null;
  const list = take ? games.slice(0, take) : games;
  return (
    <section className={className ?? "tt-front-under tt-week-fill"} aria-label="This week">
      <h3 className="wsj-band-title">
        Week {week} <em>kickoffs · CT</em>
      </h3>
      <div className={cols === 1 ? "tt-slate-list cols-1" : "tt-slate-list cols-2"}>
        {list.map((g) => (
          <SlateLine key={g.id} game={g} />
        ))}
      </div>
    </section>
  );
}

function favoriteTables(groups: StandGroup[]): StandGroup[] {
  const want = [/afc west/i, /nfc north/i, /nfc east/i];
  return want.flatMap((re) => groups.filter((g) => re.test(g.name))).slice(0, 3);
}

function byeAbbrevs(slate: BoxGame[], tables: StandGroup[]): string[] {
  const playing = new Set(slate.flatMap((g) => [g.away.abbrev, g.home.abbrev]));
  const all = tables.flatMap((g) => g.rows.map((r) => r.abbrev));
  return [...new Set(all.filter((a) => a && !playing.has(a)))];
}

function DeskTables({ tables }: { tables: StandGroup[] }) {
  return <DeskSnap tables={tables} />;
}

function A1Front({
  recaps,
  slate,
  week,
}: {
  recaps: FavRecap[];
  slate: BoxGame[];
  week: number;
}) {
  const lead = recaps.find((r) => r.card.favoriteKey === "nfl-dal") ?? recaps[0] ?? null;
  const seconds = recaps.filter((r) => r !== lead);
  const paras = lead ? pageParas(lead.card.body, 4) : [];
  return (
    <TimesChrome folio="A1" kicker="The Essentials">
      {lead ? (
        <div className="tt-section-front">
          <div className={`tt-front-grid${seconds.length ? " with-side" : ""}`}>
            <div className="tt-front-lead">
              <p className="wsj-kicker">{lead.card.teamName} · NFL</p>
              <h2 className="wsj-hl xl">{lead.card.headline}</h2>
              <RecapPhoto url={lead.card.photo} width={Math.max(lead.card.photoWidth ?? 1200, 1200)} caption={lead.card.caption} />
              <RecapChrome card={lead.card} game={lead.game} compact />
              <div className="wsj-prose">
                {paras.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            </div>
            <div className="tt-front-side">
              {seconds.map((r) => (
                <RailRecap key={r.card.id} recap={r} grafs={1} />
              ))}
            </div>
          </div>
          <WeekPreview games={slate} week={week} take={4} />
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
  slate,
  tables,
}: {
  board: SectionBoard | null;
  recaps: FavRecap[];
  games: BoxGame[];
  slate: BoxGame[];
  tables: StandGroup[];
}) {
  const strips = sportScoreBands("football/nfl", board, EDITION_DAY);
  const lead = recaps.find((r) => r.card.favoriteKey === "nfl-kc") ?? recaps[0] ?? null;
  const seconds = recaps.filter((r) => r !== lead).slice(0, 2);
  const paras = lead ? pageParas(lead.card.body, 2) : [];
  return (
    <TimesChrome folio="NFL1" kicker="NFL" desk="National Football League">
      {lead ? (
        <div className="tt-section-front">
          <div className="tt-front-grid with-side">
            <div className="tt-front-lead">
              <p className="wsj-kicker">NFL · {lead.card.teamName}</p>
              <h2 className="wsj-hl xl">{lead.card.headline}</h2>
              <RecapPhoto url={lead.card.photo} width={Math.max(lead.card.photoWidth ?? 1200, 1200)} caption={lead.card.caption} />
              <RecapChrome card={lead.card} game={lead.game} compact />
              <div className="wsj-prose">
                {paras.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
              {seconds.length ? (
                <div className="tt-front-under">
                  {seconds.map((r) => (
                    <article key={r.card.id} className="tt-under-story">
                      <p className="wsj-kicker">{r.card.teamName}</p>
                      <h3 className="wsj-hl md">{r.card.headline}</h3>
                      {pageParas(r.card.body, 1).map((p) => (
                        <p key={p.slice(0, 40)} className="wsj-dek">
                          {p}
                        </p>
                      ))}
                    </article>
                  ))}
                </div>
              ) : (
                <WeekPreview games={slate} week={board?.slateWeekNumber ?? 5} />
              )}
            </div>
            <div className="tt-front-side">
              {strips.map((strip) => (
                <section className="tt-front-rail" aria-label={strip.title} key={strip.title}>
                  <h3 className="wsj-band-title">
                    {strip.title} <em>{strip.games.length} games</em>
                  </h3>
                  <ScoreStrip games={strip.games} />
                </section>
              ))}
              {slate.length ? (
                <WeekPreview games={slate} week={board?.slateWeekNumber ?? 5} className="tt-side-fill" cols={1} />
              ) : (
                <DeskTables tables={tables} />
              )}
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

function NflSchedule({
  games,
  folio,
  week,
  continued,
  fill,
  tables,
  allTables,
}: {
  games: BoxGame[];
  folio: string;
  week: number;
  continued?: boolean;
  fill?: BoxGame[];
  tables?: StandGroup[];
  allTables?: StandGroup[];
}) {
  const days = groupByDay(games);
  const byes = byeAbbrevs(games, allTables ?? tables ?? []);
  return (
    <TimesChrome folio={folio} kicker="NFL" desk={continued ? `Schedule · continued` : "Schedule"}>
      <div className="tt-schedule tt-schedule-fill tt-slate-desk">
        <h2 className="wsj-band-title">
          Week {week} {continued ? "schedule, continued" : "schedule"} <em>{games.length} games · times CT</em>
        </h2>
        {days.map(([day, list]) => (
          <section key={day} className={list.length >= 6 ? "tt-slate-heavy" : undefined}>
            <h3 className="wsj-band-title">
              {scheduleDayLabel(day)}{" "}
              <em>
                {list.length} {list.length === 1 ? "game" : "games"}
              </em>
            </h3>
            <div className="tt-slate-list">
              {list.map((g) => (
                <SlateLine key={g.id} game={g} clockOnly />
              ))}
            </div>
          </section>
        ))}
        <div className="tt-slate-fill">
          <DeskTables tables={(allTables ?? tables ?? []).length ? (allTables ?? tables ?? []) : []} />
          {byes.length ? (
            <p className="tt-bye-line">
              On bye <em>{byes.join(" · ")}</em>
            </p>
          ) : null}
          {fill?.length ? (
            <section aria-label="Last week">
              <h3 className="wsj-band-title">
                Week {Math.max(week - 1, 1)} finals <em>{fill.length} games</em>
              </h3>
              <ScoreStrip games={fill} />
            </section>
          ) : null}
        </div>
        {!games.length ? <p className="wsj-empty">Setting the Week 5 slate…</p> : null}
      </div>
    </TimesChrome>
  );
}
