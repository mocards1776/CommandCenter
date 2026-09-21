import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { editionDateline, editionIssue } from "@/lib/newspaper";
import {
  buildGameWrapCards,
  buildTeamInfoboxes,
  enrichWrapBodies,
  favoriteGameHref,
  isTeamInSeason,
  matchWrapToFavorites,
  playerHref,
  wrapFeedsForFavorites,
  type GameWrapCard,
  type TeamInfobox,
} from "@/lib/newspaper-sports";
import { fetchRssFeed } from "@/lib/rss";
import {
  fetchTeamDetail,
  fetchTeamSnapshot,
  loadSportsLayout,
  visibleFavorites,
  type SportsFavorite,
  type TeamDetail,
} from "@/lib/sports";
import { cn, todayStr } from "@/lib/utils";
import { fetchYesterdayRecap } from "@/lib/yesterday-recap";

function ExternalOrLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

function Mast({ day, folio, pageLabel }: { day: string; folio: string; pageLabel: string }) {
  const { volume, issue } = editionIssue(day);
  return (
    <header className="tt-mast">
      <div className="tt-mast-brand">
        <span className="tt-mark">TT</span>
        <div>
          <h1>Thompson Times</h1>
          <p>Sports desk · {editionDateline(day)}</p>
        </div>
      </div>
      <div className="tt-mast-meta">
        <span>
          Vol {volume} · № {issue}
        </span>
        <span>{pageLabel}</span>
        <span>{folio}</span>
      </div>
    </header>
  );
}

function FormDots({ form }: { form: ("W" | "L" | "·")[] }) {
  if (!form.length) return null;
  return (
    <span className="tt-form" aria-label={`Form ${form.join("")}`}>
      {form.map((f, i) => (
        <i key={`${f}-${i}`} className={cn(f === "W" && "w", f === "L" && "l")} />
      ))}
    </span>
  );
}

function TeamMatrix({ teams }: { teams: TeamInfobox[] }) {
  if (!teams.length) {
    return <p className="tt-empty">No in-season clubs on your board.</p>;
  }
  return (
    <div className="tt-matrix">
      {teams.map((t) => {
        const last = t.snap.lastGame;
        const next = t.snap.nextGame;
        const nextGame = t.detail?.upcoming[0];
        const nextHref =
          (nextGame ? favoriteGameHref(t.fav, nextGame.id) : null) || t.href;
        const result = last?.won === true ? "W" : last?.won === false ? "L" : null;
        return (
          <article key={t.fav.key} className="tt-cell">
            <div
              className="tt-cell-accent"
              style={{ background: t.snap.color ? `#${t.snap.color}` : "var(--tt-accent)" }}
            />
            <div className="tt-cell-head">
              {t.snap.logo ? <img src={t.snap.logo} alt="" /> : null}
              <div className="min-w-0">
                <ExternalOrLink href={t.href} className="tt-cell-name">
                  {t.snap.shortName || t.fav.shortName}
                </ExternalOrLink>
                <div className="tt-cell-sub">
                  <span>{t.fav.league}</span>
                  {t.snap.record ? <span>{t.snap.record}</span> : null}
                  <FormDots form={t.form} />
                </div>
              </div>
              {t.odds ? <span className="tt-odds">{t.odds}</span> : null}
            </div>
            {t.snap.standing ? <p className="tt-cell-stand">{t.snap.standing}</p> : null}
            <div className="tt-cell-lines">
              {last ? (
                <p className={cn(result === "W" && "win", result === "L" && "loss")}>
                  <span>Last</span>
                  <span>
                    {result ? `${result} ` : ""}
                    {last.label}
                    {last.detail ? ` ${last.detail}` : ""}
                  </span>
                </p>
              ) : null}
              {next ? (
                <p>
                  <span>Next</span>
                  <ExternalOrLink href={nextHref} className="tt-a">
                    {next.label}
                    {next.when ? ` · ${next.when}` : ""}
                  </ExternalOrLink>
                </p>
              ) : null}
            </div>
            {t.teamStats.length ? (
              <dl className="tt-mini-stats">
                {t.teamStats.map((s) => (
                  <div key={s.label}>
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {t.detail?.division?.length ? (
              <ul className="tt-div">
                {t.detail.division.slice(0, 5).map((row) => (
                  <li key={`${t.fav.key}-${row.rank}-${row.team}`} className={cn(row.isMe && "me")}>
                    <span>
                      {row.rank} {row.team}
                    </span>
                    <span>{row.record}</span>
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

function ScoreStrip({ cards }: { cards: GameWrapCard[] }) {
  const finals = cards.filter((c) => c.scoreLine).slice(0, 8);
  if (!finals.length) return null;
  return (
    <div className="tt-strip">
      {finals.map((c) => (
        <ExternalOrLink
          key={c.id}
          href={c.gameHref || c.teamHref}
          className={cn("tt-strip-item", c.won === true && "win", c.won === false && "loss")}
        >
          <span className="lg">{c.sportLabel}</span>
          <strong>{c.teamName}</strong>
          <span className="sc">{c.scoreLine}</span>
        </ExternalOrLink>
      ))}
    </div>
  );
}

function WrapPage({ card }: { card: GameWrapCard }) {
  const href = card.gameHref || card.wrapHref || card.teamHref;
  const body = card.body || card.dek || "";
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const prose =
    paras.length > 1
      ? paras
      : body
          .replace(/\s+/g, " ")
          .match(/.{1,420}(?:\s|$)/g)
          ?.map((s) => s.trim())
          .filter(Boolean) ?? [body];

  return (
    <article className="tt-wrap">
      <div className="tt-wrap-main">
        <p className="tt-kicker">
          {card.sportLabel}
          {card.won === true ? " · Win" : card.won === false ? " · Loss" : ""}
          {" · "}
          <ExternalOrLink href={card.teamHref} className="tt-a">
            {card.teamName}
          </ExternalOrLink>
        </p>
        <h2>
          <ExternalOrLink href={href} className="tt-a">
            {card.headline}
          </ExternalOrLink>
        </h2>
        {card.scoreLine ? <p className="tt-score">{card.scoreLine}</p> : null}
        <div className="tt-prose">
          {prose.slice(0, 14).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="tt-wrap-links">
          {card.gameHref ? (
            <ExternalOrLink href={card.gameHref} className="tt-chip">
              Game center
            </ExternalOrLink>
          ) : null}
          {card.wrapHref ? (
            <ExternalOrLink href={card.wrapHref} className="tt-chip">
              ESPN wrap
            </ExternalOrLink>
          ) : null}
        </div>
      </div>
      <aside className="tt-wrap-rail">
        {card.stats.length ? (
          <div className="tt-panel">
            <h3>Box</h3>
            <dl>
              {card.stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        {card.leaders.length ? (
          <div className="tt-panel">
            <h3>Names</h3>
            <ul>
              {card.leaders.map((l) => (
                <li key={`${l.name}-${l.line}`}>
                  {l.href ? (
                    <ExternalOrLink href={l.href} className="tt-a">
                      {l.name}
                    </ExternalOrLink>
                  ) : (
                    <span>{l.name}</span>
                  )}
                  <span className="v">{l.line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {card.teamStats.length ? (
          <div className="tt-panel">
            <h3>Club marks</h3>
            <dl>
              {card.teamStats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        {card.division.length ? (
          <div className="tt-panel">
            <h3>Table</h3>
            <ul className="tt-table">
              {card.division.map((r) => (
                <li key={`${r.rank}-${r.team}`} className={cn(r.me && "me")}>
                  <span>
                    {r.rank} {r.team}
                  </span>
                  <span>{r.record}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </article>
  );
}

function Notebook({ teams }: { teams: TeamInfobox[] }) {
  const rows = teams
    .flatMap((t) => {
      const people = [
        ...(t.detail?.hittingLeaders ?? []).slice(0, 2),
        ...(t.detail?.pitchingLeaders ?? []).slice(0, 1),
      ];
      return people.map((l) => ({
        team: t.fav.shortName,
        teamHref: t.href,
        name: l.name,
        line: l.line,
        href: l.id ? playerHref(t.fav.espnPath, l.id) : null,
      }));
    })
    .slice(0, 12);
  if (!rows.length) return null;
  return (
    <aside className="tt-panel tt-notebook">
      <h3>Notebook</h3>
      <ul>
        {rows.map((r) => (
          <li key={`${r.team}-${r.name}-${r.line}`}>
            <span>
              {r.href ? (
                <ExternalOrLink href={r.href} className="tt-a">
                  {r.name}
                </ExternalOrLink>
              ) : (
                r.name
              )}
              <em>
                {" "}
                ·{" "}
                <ExternalOrLink href={r.teamHref} className="tt-a">
                  {r.team}
                </ExternalOrLink>
              </em>
            </span>
            <span className="v">{r.line}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function DailyNewspaperPage() {
  const { user } = useAuth();
  const day = todayStr();
  const layout = useMemo(() => loadSportsLayout(), []);
  const teamFavs = useMemo(
    () => visibleFavorites(layout).filter((f) => f.kind === "team"),
    [layout],
  );

  const pagerRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const teamSnaps = useQuery({
    queryKey: ["tt-team-snaps", teamFavs.map((t) => t.key).join(",")],
    queryFn: async () =>
      Promise.all(
        teamFavs.slice(0, 16).map(async (fav) => {
          try {
            return await fetchTeamSnapshot(fav);
          } catch {
            return {
              key: fav.key,
              name: fav.name,
              shortName: fav.shortName,
              abbreviation: fav.shortName.slice(0, 3).toUpperCase(),
              logo: null,
              color: fav.color ?? null,
              record: null,
              standing: null,
              nextGame: null,
              lastGame: null,
            };
          }
        }),
      ),
    staleTime: 120_000,
  });

  const inSeasonFavs = useMemo(() => {
    const keys = new Set((teamSnaps.data ?? []).filter(isTeamInSeason).map((s) => s.key));
    return teamFavs.filter((f) => keys.has(f.key));
  }, [teamFavs, teamSnaps.data]);

  const teamDetailsQ = useQuery({
    queryKey: ["tt-team-details", inSeasonFavs.map((f) => f.key).join(",")],
    queryFn: async () => {
      const rows = await Promise.all(
        inSeasonFavs.slice(0, 12).map(async (fav) => {
          try {
            const detail = await fetchTeamDetail(fav);
            return { fav, detail } as { fav: SportsFavorite; detail: TeamDetail };
          } catch {
            return null;
          }
        }),
      );
      return rows.filter(Boolean) as { fav: SportsFavorite; detail: TeamDetail }[];
    },
    enabled: inSeasonFavs.length > 0,
    staleTime: 5 * 60_000,
  });

  const recap = useQuery({
    queryKey: ["newspaper-yesterday-recap", user?.id],
    queryFn: () => fetchYesterdayRecap({ layout, userId: user?.id }),
    staleTime: 120_000,
  });

  const wrapFeedUrls = useMemo(
    () => wrapFeedsForFavorites(inSeasonFavs.length ? inSeasonFavs : teamFavs),
    [inSeasonFavs, teamFavs],
  );

  const wrapsQ = useQuery({
    queryKey: ["tt-wraps", wrapFeedUrls.join("|")],
    queryFn: async () => {
      const feeds = await Promise.all(
        wrapFeedUrls.map(async (url) => {
          try {
            const feed = await fetchRssFeed(url);
            return { url, items: feed.items ?? [] };
          } catch {
            return { url, items: [] };
          }
        }),
      );
      const matched = [];
      const seen = new Set<string>();
      const pool = inSeasonFavs.length ? inSeasonFavs : teamFavs;
      for (const feed of feeds) {
        for (const item of feed.items.slice(0, 20)) {
          const hit = matchWrapToFavorites(item, feed.url, pool);
          if (!hit) continue;
          const key = hit.item.link || hit.item.id;
          if (seen.has(key)) continue;
          seen.add(key);
          matched.push(hit);
        }
      }
      return matched;
    },
    enabled: wrapFeedUrls.length > 0,
    staleTime: 90_000,
  });

  const teams = useMemo(
    () => buildTeamInfoboxes(teamFavs, teamSnaps.data ?? [], teamDetailsQ.data ?? []),
    [teamFavs, teamSnaps.data, teamDetailsQ.data],
  );

  const baseCards = useMemo(
    () =>
      buildGameWrapCards({
        favs: inSeasonFavs.length ? inSeasonFavs : teamFavs,
        details: teamDetailsQ.data ?? [],
        recapGames: recap.data?.games ?? [],
        wraps: wrapsQ.data ?? [],
      }),
    [inSeasonFavs, teamFavs, teamDetailsQ.data, recap.data, wrapsQ.data],
  );

  const enrichedQ = useQuery({
    queryKey: [
      "tt-wrap-bodies",
      baseCards.map((c) => `${c.id}:${c.gameId}:${c.wrapHref}`).join("|"),
    ],
    queryFn: () =>
      enrichWrapBodies(baseCards, inSeasonFavs.length ? inSeasonFavs : teamFavs),
    enabled: baseCards.length > 0,
    staleTime: 10 * 60_000,
  });

  const wrapCards = enrichedQ.data ?? baseCards;

  const pages = useMemo(() => {
    const out: ({ kind: "front" } | { kind: "wrap"; card: GameWrapCard })[] = [{ kind: "front" }];
    for (const card of wrapCards) out.push({ kind: "wrap", card });
    return out;
  }, [wrapCards]);

  function goPage(idx: number) {
    const el = pagerRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(pages.length - 1, idx));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setPageIndex(next);
  }

  useEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      const idx = Math.round(el.scrollLeft / w);
      setPageIndex(Math.max(0, Math.min(pages.length - 1, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pages.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goPage(pageIndex + 1);
      if (e.key === "ArrowLeft") goPage(pageIndex - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const refreshing =
    teamSnaps.isFetching ||
    teamDetailsQ.isFetching ||
    recap.isFetching ||
    wrapsQ.isFetching ||
    enrichedQ.isFetching;

  async function onRefresh() {
    await Promise.all([
      teamSnaps.refetch(),
      teamDetailsQ.refetch(),
      recap.refetch(),
      wrapsQ.refetch(),
      enrichedQ.refetch(),
    ]);
  }

  const feature = wrapCards[0] ?? null;

  return (
    <div className="newspaper-root">
      <div className="newspaper-toolbar print:hidden">
        <div>
          <p className="label-caps text-accent">Sports desk</p>
          <h1>Thompson Times</h1>
          <p className="text-chalk mt-2 max-w-xl text-[12px] leading-relaxed">
            Dense digital edition — your clubs, full ESPN wraps, and live links.
            Swipe pages left / right.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="text-chalk hover:text-cream inline-flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition hover:border-accent/40"
        >
          <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="np-pager-chrome print:hidden">
        <button
          type="button"
          className="np-pager-btn"
          aria-label="Previous page"
          disabled={pageIndex <= 0}
          onClick={() => goPage(pageIndex - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="np-pager-dots" role="tablist" aria-label="Edition pages">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === pageIndex}
              className={cn("np-pager-dot", i === pageIndex && "on")}
              onClick={() => goPage(i)}
            >
              <span className="np-visually-hidden">Page {i + 1}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="np-pager-btn"
          aria-label="Next page"
          disabled={pageIndex >= pages.length - 1}
          onClick={() => goPage(pageIndex + 1)}
        >
          <ChevronRight size={18} />
        </button>
        <span className="np-pager-label">
          {pageIndex + 1} / {pages.length}
        </span>
      </div>

      <div className="newspaper-edition np-pager" ref={pagerRef}>
        {pages.map((page, pi) => {
          if (page.kind === "front") {
            return (
              <section key="front" className="np-page tt-page" aria-label={`Page ${pi + 1}`}>
                <Mast day={day} folio={`A${pi + 1}`} pageLabel="Clubs" />
                <div className="tt-body">
                  <div className="tt-sec">
                    <h2>My teams</h2>
                    <span>{teams.length} live</span>
                  </div>
                  <TeamMatrix teams={teams} />
                  <div className="tt-sec">
                    <h2>Wire</h2>
                    <span>Followed finals</span>
                  </div>
                  <ScoreStrip cards={wrapCards} />
                  <div className="tt-front-split">
                    {feature ? (
                      <div className="tt-feature">
                        <p className="tt-kicker">
                          {feature.sportLabel} ·{" "}
                          <ExternalOrLink href={feature.teamHref} className="tt-a">
                            {feature.teamName}
                          </ExternalOrLink>
                        </p>
                        <h3>
                          <ExternalOrLink
                            href={feature.gameHref || feature.wrapHref || feature.teamHref}
                            className="tt-a"
                          >
                            {feature.headline}
                          </ExternalOrLink>
                        </h3>
                        {feature.scoreLine ? <p className="tt-score">{feature.scoreLine}</p> : null}
                        <div className="tt-prose compact">
                          {(feature.body || feature.dek || "")
                            .split(/\n{2,}/)
                            .map((p) => p.trim())
                            .filter(Boolean)
                            .slice(0, 4)
                            .map((p, i) => (
                              <p key={i}>{p}</p>
                            ))}
                          {!feature.body && feature.dek ? <p>{feature.dek}</p> : null}
                        </div>
                        {feature.gameHref ? (
                          <ExternalOrLink href={feature.gameHref} className="tt-chip">
                            Continue on page {Math.min(2, pages.length)} →
                          </ExternalOrLink>
                        ) : null}
                      </div>
                    ) : (
                      <p className="tt-empty">Wraps load after the next final.</p>
                    )}
                    <Notebook teams={teams} />
                  </div>
                </div>
                <footer className="tt-folio">
                  Thompson Times · A{pi + 1} · swipe for wraps
                </footer>
              </section>
            );
          }

          return (
            <section
              key={page.card.id}
              className="np-page tt-page"
              aria-label={`Page ${pi + 1}`}
            >
              <Mast day={day} folio={`A${pi + 1}`} pageLabel="Wrap" />
              <div className="tt-body">
                <WrapPage card={page.card} />
              </div>
              <footer className="tt-folio">
                Thompson Times · {page.card.teamName} · A{pi + 1}
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
