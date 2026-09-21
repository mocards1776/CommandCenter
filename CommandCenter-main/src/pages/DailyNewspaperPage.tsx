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

function Mast({ day, folio }: { day: string; folio: string }) {
  const { volume, issue } = editionIssue(day);
  return (
    <header className="tt-mast">
      <div className="tt-mast-l">
        <span className="tt-mark">TT</span>
        <h1>Thompson Times</h1>
        <span className="tt-mast-sep">Sports</span>
        <span>{editionDateline(day)}</span>
      </div>
      <div className="tt-mast-r">
        <span>
          Vol {volume} · № {issue}
        </span>
        <span>{folio}</span>
      </div>
    </header>
  );
}

function FormDots({ form }: { form: ("W" | "L" | "·")[] }) {
  if (!form.length) return <span className="tt-form-empty">—</span>;
  return (
    <span className="tt-form">
      {form.map((f, i) => (
        <i key={`${f}-${i}`} className={cn(f === "W" && "w", f === "L" && "l")} />
      ))}
    </span>
  );
}

/** Compact league board — every club is a tight row, no card chrome. */
function ClubBoard({ teams }: { teams: TeamInfobox[] }) {
  if (!teams.length) return <p className="tt-empty">No in-season clubs.</p>;
  return (
    <table className="tt-board">
      <thead>
        <tr>
          <th>Club</th>
          <th>Lg</th>
          <th>Rec</th>
          <th>Form</th>
          <th>Last</th>
          <th>Next</th>
          <th>Odds</th>
          <th>Mark</th>
        </tr>
      </thead>
      <tbody>
        {teams.map((t) => {
          const last = t.snap.lastGame;
          const next = t.snap.nextGame;
          const nextGame = t.detail?.upcoming[0];
          const nextHref =
            (nextGame ? favoriteGameHref(t.fav, nextGame.id) : null) || t.href;
          const result = last?.won === true ? "W" : last?.won === false ? "L" : "";
          const mark = t.teamStats
            .slice(0, 2)
            .map((s) => `${s.label} ${s.value}`)
            .join(" · ");
          return (
            <tr key={t.fav.key}>
              <td className="club">
                {t.snap.logo ? <img src={t.snap.logo} alt="" /> : null}
                <ExternalOrLink href={t.href} className="tt-a">
                  {t.snap.shortName || t.fav.shortName}
                </ExternalOrLink>
              </td>
              <td>{t.fav.league}</td>
              <td className="num">{t.snap.record || "—"}</td>
              <td>
                <FormDots form={t.form} />
              </td>
              <td className={cn(result === "W" && "win", result === "L" && "loss")}>
                {last
                  ? `${result} ${last.label}${last.detail ? ` ${last.detail}` : ""}`
                  : "—"}
              </td>
              <td>
                {next ? (
                  <ExternalOrLink href={nextHref} className="tt-a">
                    {next.label}
                    {next.when ? ` ${next.when}` : ""}
                  </ExternalOrLink>
                ) : (
                  "—"
                )}
              </td>
              <td className="num odds">{t.odds || "—"}</td>
              <td className="mark">{mark || t.snap.standing || "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function proseParas(text: string, max = 20): string[] {
  const raw = text.trim();
  if (!raw) return [];
  const byBreak = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byBreak.length > 1) return byBreak.slice(0, max);
  return (
    raw
      .replace(/\s+/g, " ")
      .match(/.{1,380}(?:\s|$)/g)
      ?.map((s) => s.trim())
      .filter(Boolean)
      .slice(0, max) ?? [raw]
  );
}

function LeadStory({ card }: { card: GameWrapCard }) {
  const href = card.gameHref || card.wrapHref || card.teamHref;
  const paras = proseParas(card.body || card.dek || "", 16);
  return (
    <article className="tt-lead">
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
      <div className="tt-prose tt-prose-fill">
        {paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="tt-inline-links">
        {card.gameHref ? (
          <ExternalOrLink href={card.gameHref} className="tt-a">
            Game center
          </ExternalOrLink>
        ) : null}
        {card.wrapHref ? (
          <ExternalOrLink href={card.wrapHref} className="tt-a">
            ESPN
          </ExternalOrLink>
        ) : null}
      </div>
    </article>
  );
}

function Brief({ card }: { card: GameWrapCard }) {
  const href = card.gameHref || card.wrapHref || card.teamHref;
  const dek = (card.body || card.dek || "").replace(/\s+/g, " ").trim().slice(0, 280);
  return (
    <article className="tt-brief">
      <p className="tt-kicker">
        {card.sportLabel} ·{" "}
        <ExternalOrLink href={card.teamHref} className="tt-a">
          {card.teamName}
        </ExternalOrLink>
      </p>
      <h3>
        <ExternalOrLink href={href} className="tt-a">
          {card.headline}
        </ExternalOrLink>
      </h3>
      {card.scoreLine ? <p className="tt-score sm">{card.scoreLine}</p> : null}
      {dek ? <p className="tt-brief-dek">{dek}{dek.length >= 280 ? "…" : ""}</p> : null}
    </article>
  );
}

function Rail({
  teams,
  cards,
}: {
  teams: TeamInfobox[];
  cards: GameWrapCard[];
}) {
  const standings = teams
    .filter((t) => t.detail?.division?.length)
    .slice(0, 3);
  const names = teams
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
    .slice(0, 14);

  return (
    <aside className="tt-rail">
      {cards.slice(1, 3).map((c) => (
        <Brief key={c.id} card={c} />
      ))}
      {standings.map((t) => (
        <div key={t.fav.key} className="tt-box">
          <h4>
            <ExternalOrLink href={t.href} className="tt-a">
              {t.fav.shortName}
            </ExternalOrLink>{" "}
            table
          </h4>
          <ul>
            {(t.detail?.division ?? []).slice(0, 6).map((r) => (
              <li key={`${t.fav.key}-${r.rank}-${r.team}`} className={cn(r.isMe && "me")}>
                <span>
                  {r.rank} {r.team}
                </span>
                <span>{r.record}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {names.length ? (
        <div className="tt-box">
          <h4>Notebook</h4>
          <ul>
            {names.map((r) => (
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
        </div>
      ) : null}
    </aside>
  );
}

function WrapPage({ card }: { card: GameWrapCard }) {
  const href = card.gameHref || card.wrapHref || card.teamHref;
  const paras = proseParas(card.body || card.dek || "", 24);
  return (
    <div className="tt-wrap-fill">
      <article className="tt-wrap-story">
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
        <div className="tt-prose tt-prose-fill cols-3">
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="tt-inline-links">
          {card.gameHref ? (
            <ExternalOrLink href={card.gameHref} className="tt-a">
              Game center
            </ExternalOrLink>
          ) : null}
          {card.wrapHref ? (
            <ExternalOrLink href={card.wrapHref} className="tt-a">
              ESPN wrap
            </ExternalOrLink>
          ) : null}
        </div>
      </article>
      <aside className="tt-wrap-side">
        {card.stats.length ? (
          <div className="tt-box">
            <h4>Box</h4>
            <ul>
              {card.stats.map((s) => (
                <li key={s.label}>
                  <span>{s.label}</span>
                  <span className="v">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {card.leaders.length ? (
          <div className="tt-box">
            <h4>Names</h4>
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
          <div className="tt-box">
            <h4>Club</h4>
            <ul>
              {card.teamStats.map((s) => (
                <li key={s.label}>
                  <span>{s.label}</span>
                  <span className="v">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {card.division.length ? (
          <div className="tt-box">
            <h4>Table</h4>
            <ul>
              {card.division.map((r) => (
                <li key={`${r.rank}-${r.team}`} className={cn(r.me && "me")}>
                  <span>
                    {r.rank} {r.team}
                  </span>
                  <span className="v">{r.record}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
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

  // Front uses first 3 cards; remaining each get a full page.
  const pages = useMemo(() => {
    const out: ({ kind: "front" } | { kind: "wrap"; card: GameWrapCard })[] = [
      { kind: "front" },
    ];
    for (const card of wrapCards.slice(1)) out.push({ kind: "wrap", card });
    // Always include lead wrap as page 2 if body is long enough to continue.
    if (wrapCards[0]) {
      out.splice(1, 0, { kind: "wrap", card: wrapCards[0]! });
    }
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

  const lead = wrapCards[0] ?? null;
  const below = wrapCards.slice(3, 6);

  return (
    <div className="newspaper-root tt-shell">
      <div className="tt-chrome print:hidden">
        <div className="tt-chrome-l">
          <strong>Thompson Times</strong>
          <span>Sports edition</span>
        </div>
        <div className="tt-chrome-c">
          <button
            type="button"
            className="np-pager-btn"
            aria-label="Previous page"
            disabled={pageIndex <= 0}
            onClick={() => goPage(pageIndex - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="np-pager-label">
            {pageIndex + 1}/{pages.length}
          </span>
          <button
            type="button"
            className="np-pager-btn"
            aria-label="Next page"
            disabled={pageIndex >= pages.length - 1}
            onClick={() => goPage(pageIndex + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="tt-chrome-refresh"
        >
          <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="newspaper-edition np-pager" ref={pagerRef}>
        {pages.map((page, pi) => {
          if (page.kind === "front") {
            return (
              <section key="front" className="np-page tt-page" aria-label={`Page ${pi + 1}`}>
                <Mast day={day} folio={`A${pi + 1}`} />
                <div className="tt-body tt-front">
                  <ClubBoard teams={teams} />
                  <div className="tt-pack">
                    <div className="tt-pack-main">
                      {lead ? (
                        <LeadStory card={lead} />
                      ) : (
                        <p className="tt-empty">Waiting on wraps for your clubs.</p>
                      )}
                      {below.length ? (
                        <div className="tt-below">
                          {below.map((c) => (
                            <Brief key={c.id} card={c} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Rail teams={teams} cards={wrapCards} />
                  </div>
                </div>
              </section>
            );
          }

          return (
            <section
              key={page.card.id}
              className="np-page tt-page"
              aria-label={`Page ${pi + 1}`}
            >
              <Mast day={day} folio={`A${pi + 1}`} />
              <div className="tt-body">
                <WrapPage card={page.card} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
