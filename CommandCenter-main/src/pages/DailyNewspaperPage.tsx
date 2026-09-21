import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { editionDateLabel, editionDateline, editionIssue } from "@/lib/newspaper";
import {
  buildGameWrapCards,
  buildTeamInfoboxes,
  chunkPages,
  favoriteTeamHref,
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

function Masthead({
  volume,
  issue,
  day,
  folio,
}: {
  volume: number;
  issue: number;
  day: string;
  folio: string;
}) {
  return (
    <header className="np-mast np-anim-mast">
      <div className="np-mast-top">
        <span>
          Vol. {volume} · No. {issue}
        </span>
        <span>{editionDateline(day)}</span>
        <span>{folio}</span>
      </div>
      <h1 className="np-flag">Thompson Times</h1>
      <div className="np-mast-sub">
        <span>Sports edition</span>
        <span className="flex-rule" aria-hidden />
        <span>{editionDateLabel(day)}</span>
        <span className="flex-rule" aria-hidden />
        <span>Digital desk</span>
      </div>
    </header>
  );
}

function TeamBoard({ teams }: { teams: TeamInfobox[] }) {
  if (!teams.length) {
    return (
      <div className="np-box">
        <p className="np-muted">No in-season teams on your board yet.</p>
      </div>
    );
  }
  return (
    <div className="np-team-board">
      {teams.map((t, i) => {
        const last = t.snap.lastGame;
        const next = t.snap.nextGame;
        const result =
          last?.won === true ? "W" : last?.won === false ? "L" : null;
        return (
          <article
            key={t.fav.key}
            className="np-infobox"
            style={{ animationDelay: `${0.04 + i * 0.03}s` }}
          >
            <div
              className="np-infobox-rule"
              style={{ background: t.snap.color ? `#${t.snap.color}` : "var(--np-accent)" }}
            />
            <div className="np-infobox-top">
              {t.snap.logo ? (
                <img src={t.snap.logo} alt="" className="np-infobox-logo" />
              ) : null}
              <div className="min-w-0">
                <ExternalOrLink href={t.href} className="np-infobox-name">
                  {t.snap.shortName || t.fav.shortName}
                </ExternalOrLink>
                <div className="np-infobox-meta">
                  {t.fav.league}
                  {t.snap.record ? ` · ${t.snap.record}` : ""}
                </div>
              </div>
            </div>
            {t.snap.standing ? (
              <p className="np-infobox-stand">{t.snap.standing}</p>
            ) : null}
            {last ? (
              <p className={cn("np-infobox-line", result === "W" && "w", result === "L" && "l")}>
                Last{result ? ` ${result}` : ""} · {last.label}
                {last.detail ? ` ${last.detail}` : ""}
              </p>
            ) : null}
            {next ? (
              <p className="np-infobox-line next">
                Next ·{" "}
                <ExternalOrLink
                  href={
                    t.detail?.upcoming[0]
                      ? favoriteTeamHref(t.fav)
                      : t.href
                  }
                  className="np-link"
                >
                  {next.label}
                </ExternalOrLink>
                {next.when ? ` · ${next.when}` : ""}
              </p>
            ) : null}
            {t.detail?.division?.length ? (
              <ul className="np-infobox-div">
                {t.detail.division.slice(0, 4).map((row) => (
                  <li key={`${t.fav.key}-${row.rank}-${row.team}`} className={cn(row.isMe && "me")}>
                    <span>
                      {row.rank}. {row.team}
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

function WrapArticle({
  card,
  feature = false,
}: {
  card: GameWrapCard;
  feature?: boolean;
}) {
  const href = card.gameHref || card.wrapHref || card.teamHref;
  return (
    <article className={cn("np-wrap", feature && "feature")}>
      <p className="np-kicker">
        {card.sportLabel}
        {card.won === true ? " · Win" : card.won === false ? " · Loss" : ""}
        {" · "}
        <ExternalOrLink href={card.teamHref} className="np-link">
          {card.teamName}
        </ExternalOrLink>
      </p>
      <h2 className={cn("np-headline", feature ? "lg" : "md")}>
        <ExternalOrLink href={href} className="np-link">
          {card.headline}
        </ExternalOrLink>
      </h2>
      {card.scoreLine ? <p className="np-scoreline">{card.scoreLine}</p> : null}
      {card.dek ? <p className={cn("np-dek", feature && "cols")}>{card.dek}</p> : null}
      <div className="np-wrap-meta">
        {card.when ? <span>{card.when}</span> : null}
        {card.gameHref ? (
          <ExternalOrLink href={card.gameHref} className="np-text-link">
            Game center →
          </ExternalOrLink>
        ) : null}
        {card.wrapHref && card.wrapHref !== card.gameHref ? (
          <ExternalOrLink href={card.wrapHref} className="np-text-link">
            Full wrap →
          </ExternalOrLink>
        ) : null}
      </div>
      {(card.stats.length > 0 || card.leaders.length > 0) && (
        <div className="np-wrap-rail">
          {card.stats.length > 0 ? (
            <div className="np-statbox">
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
          {card.leaders.length > 0 ? (
            <div className="np-statbox">
              <h3>Club marks</h3>
              <ul>
                {card.leaders.map((l) => (
                  <li key={`${l.name}-${l.line}`}>
                    {l.href ? (
                      <ExternalOrLink href={l.href} className="np-link">
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
        </div>
      )}
    </article>
  );
}

function LeadersRail({ teams }: { teams: TeamInfobox[] }) {
  const rows = teams
    .flatMap((t) => {
      const hit = (t.detail?.hittingLeaders ?? []).slice(0, 2).map((l) => ({
        team: t.fav.shortName,
        teamHref: t.href,
        name: l.name,
        line: l.line,
        href: l.id ? playerHref(t.fav.espnPath, l.id) : null,
        kind: "Bat",
      }));
      const pit = (t.detail?.pitchingLeaders ?? []).slice(0, 1).map((l) => ({
        team: t.fav.shortName,
        teamHref: t.href,
        name: l.name,
        line: l.line,
        href: l.id ? playerHref(t.fav.espnPath, l.id) : null,
        kind: "Arm",
      }));
      return [...hit, ...pit];
    })
    .slice(0, 8);

  if (!rows.length) return null;

  return (
    <aside className="np-box np-leaders-rail">
      <div className="np-sec-head">
        <h2>Notebook</h2>
        <span>Names to watch</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={`${r.team}-${r.name}-${r.kind}`}>
            <span className="kind">{r.kind}</span>
            <span className="body">
              {r.href ? (
                <ExternalOrLink href={r.href} className="np-link">
                  {r.name}
                </ExternalOrLink>
              ) : (
                r.name
              )}
              <span className="meta">
                {" "}
                ·{" "}
                <ExternalOrLink href={r.teamHref} className="np-link">
                  {r.team}
                </ExternalOrLink>
              </span>
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
  const { volume, issue } = editionIssue(day);
  const layout = useMemo(() => loadSportsLayout(), []);
  const teamFavs = useMemo(
    () => visibleFavorites(layout).filter((f) => f.kind === "team"),
    [layout],
  );

  const pagerRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const teamSnaps = useQuery({
    queryKey: ["tt-team-snaps", teamFavs.map((t) => t.key).join(",")],
    queryFn: async () => {
      const rows = await Promise.all(
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
      );
      return rows;
    },
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
      for (const feed of feeds) {
        for (const item of feed.items.slice(0, 24)) {
          const hit = matchWrapToFavorites(item, feed.url, inSeasonFavs.length ? inSeasonFavs : teamFavs);
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
    () =>
      buildTeamInfoboxes(
        teamFavs,
        teamSnaps.data ?? [],
        teamDetailsQ.data ?? [],
      ),
    [teamFavs, teamSnaps.data, teamDetailsQ.data],
  );

  const wrapCards = useMemo(
    () =>
      buildGameWrapCards({
        favs: inSeasonFavs.length ? inSeasonFavs : teamFavs,
        details: teamDetailsQ.data ?? [],
        recapGames: recap.data?.games ?? [],
        wraps: wrapsQ.data ?? [],
      }),
    [inSeasonFavs, teamFavs, teamDetailsQ.data, recap.data, wrapsQ.data],
  );

  const feature = wrapCards[0] ?? null;
  const restWraps = wrapCards.slice(1);
  const wrapPages = chunkPages(restWraps, 2);

  const pages = useMemo(() => {
    const out: ("front" | GameWrapCard[])[] = ["front"];
    for (const chunk of wrapPages) out.push(chunk);
    return out;
  }, [wrapPages]);

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
    wrapsQ.isFetching;

  async function onRefresh() {
    await Promise.all([
      teamSnaps.refetch(),
      teamDetailsQ.refetch(),
      recap.refetch(),
      wrapsQ.refetch(),
    ]);
  }

  return (
    <div className="newspaper-root">
      <div className="newspaper-toolbar print:hidden">
        <div>
          <p className="label-caps text-accent">Sports edition</p>
          <h1>Thompson Times</h1>
          <p className="text-chalk mt-2 max-w-xl text-[12px] leading-relaxed">
            Swipeable sports desk — your teams, game wraps, and box marks. Tap
            names and scores to open the full game.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="text-chalk hover:text-cream inline-flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition hover:border-accent/40"
          >
            <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
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
          if (page === "front") {
            return (
              <section key="front" className="np-page" aria-label={`Page ${pi + 1}`}>
                <Masthead volume={volume} issue={issue} day={day} folio={`A${pi + 1}`} />
                <div className="np-anim-body np-page-body">
                  <div className="np-sec-head">
                    <h2>My teams</h2>
                    <span>{teams.length} in season</span>
                  </div>
                  <TeamBoard teams={teams} />

                  <div className="np-front-grid">
                    <div className="np-front-main">
                      <div className="np-sec-head">
                        <h2>The wire</h2>
                        <span>Wraps &amp; finals</span>
                      </div>
                      {feature ? (
                        <WrapArticle card={feature} feature />
                      ) : (
                        <p className="np-muted">
                          Waiting on wraps for your clubs — check back after the
                          next final.
                        </p>
                      )}
                    </div>
                    <LeadersRail teams={teams} />
                  </div>
                </div>
                <footer className="np-folio">
                  Thompson Times · Sports · {editionDateline(day)} · A{pi + 1}
                </footer>
              </section>
            );
          }

          return (
            <section key={`wraps-${pi}`} className="np-page" aria-label={`Page ${pi + 1}`}>
              <Masthead volume={volume} issue={issue} day={day} folio={`A${pi + 1}`} />
              <div className="np-anim-body np-page-body">
                <div className="np-sec-head">
                  <h2>Game wraps</h2>
                  <span>Continued</span>
                </div>
                <div className="np-wrap-stack">
                  {page.map((card) => (
                    <WrapArticle key={card.id} card={card} />
                  ))}
                </div>
              </div>
              <footer className="np-folio">
                Thompson Times · Sports · {editionDateline(day)} · A{pi + 1}
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
