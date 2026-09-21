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

/** Prefer ESPN body; otherwise stitch dek + box into readable copy so the well never sits empty. */
function cardCopy(card: GameWrapCard): string {
  if (card.body && card.body.trim().length >= 80) return card.body.trim();
  const bits: string[] = [];
  if (card.dek) bits.push(card.dek.trim());
  if (card.scoreLine) bits.push(`Final: ${card.scoreLine}.`);
  if (card.leaders.length) {
    bits.push(
      `Names: ${card.leaders
        .slice(0, 5)
        .map((l) => `${l.name} (${l.line})`)
        .join("; ")}.`,
    );
  }
  if (card.teamStats.length) {
    bits.push(
      `Club marks: ${card.teamStats
        .slice(0, 6)
        .map((s) => `${s.label} ${s.value}`)
        .join(", ")}.`,
    );
  }
  if (card.division.length) {
    bits.push(
      `Table: ${card.division
        .slice(0, 6)
        .map((r) => `${r.rank}. ${r.team} ${r.record}`)
        .join("; ")}.`,
    );
  }
  return bits.join(" ").trim();
}

function StoryHead({ card, level = 2 }: { card: GameWrapCard; level?: 2 | 3 }) {
  const href = card.gameHref || card.wrapHref || card.teamHref;
  const Title = level === 2 ? "h2" : "h3";
  return (
    <>
      <p className="tt-kicker">
        {card.sportLabel}
        {card.won === true ? " · Win" : card.won === false ? " · Loss" : ""}
        {" · "}
        <ExternalOrLink href={card.teamHref} className="tt-a">
          {card.teamName}
        </ExternalOrLink>
      </p>
      <Title>
        <ExternalOrLink href={href} className="tt-a">
          {card.headline}
        </ExternalOrLink>
      </Title>
      {card.scoreLine ? <p className="tt-score">{card.scoreLine}</p> : null}
    </>
  );
}

function StoryLinks({ card }: { card: GameWrapCard }) {
  return (
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
  );
}

function LeadStory({ card }: { card: GameWrapCard }) {
  const copy = cardCopy(card);
  const paras = proseParas(copy, 18);
  return (
    <article className="tt-lead">
      <StoryHead card={card} />
      {paras.length ? (
        <div className="tt-prose">
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}
      <StoryLinks card={card} />
    </article>
  );
}

function Brief({ card }: { card: GameWrapCard }) {
  const href = card.gameHref || card.wrapHref || card.teamHref;
  const dek = cardCopy(card).replace(/\s+/g, " ").trim().slice(0, 220);
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
      {dek ? <p className="tt-brief-dek">{dek}{dek.length >= 220 ? "…" : ""}</p> : null}
    </article>
  );
}

/** Dense wire column — fills leftover height with stacked briefs (no empty well). */
function WireStack({ cards }: { cards: GameWrapCard[] }) {
  if (!cards.length) return null;
  return (
    <div className="tt-wire">
      {cards.map((c) => (
        <Brief key={c.id} card={c} />
      ))}
    </div>
  );
}

function StatBox({
  title,
  rows,
}: {
  title: string;
  rows: { left: ReactNode; right?: ReactNode; me?: boolean }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="tt-box">
      <h4>{title}</h4>
      <ul>
        {rows.map((r, i) => (
          <li key={i} className={cn(r.me && "me")}>
            <span>{r.left}</span>
            {r.right != null ? <span className="v">{r.right}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Rail({
  teams,
  cards,
}: {
  teams: TeamInfobox[];
  cards: GameWrapCard[];
}) {
  const standings = teams.filter((t) => t.detail?.division?.length).slice(0, 4);
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
    .slice(0, 16);

  const recent = teams
    .flatMap((t) =>
      t.recentLines.slice(0, 2).map((g) => ({
        team: t.fav.shortName,
        ...g,
      })),
    )
    .slice(0, 10);

  return (
    <aside className="tt-rail">
      {cards.slice(0, 2).map((c) => (
        <Brief key={c.id} card={c} />
      ))}
      {standings.map((t) => (
        <StatBox
          key={t.fav.key}
          title={`${t.fav.shortName} table`}
          rows={(t.detail?.division ?? []).slice(0, 6).map((r) => ({
            left: `${r.rank} ${r.team}`,
            right: r.record,
            me: r.isMe,
          }))}
        />
      ))}
      {recent.length ? (
        <StatBox
          title="Results"
          rows={recent.map((g) => ({
            left: (
              <>
                <strong>{g.team}</strong> {g.label}
              </>
            ),
            right: g.won === true ? "W" : g.won === false ? "L" : "·",
          }))}
        />
      ) : null}
      {names.length ? (
        <StatBox
          title="Notebook"
          rows={names.map((r) => ({
            left: (
              <>
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
              </>
            ),
            right: r.line,
          }))}
        />
      ) : null}
    </aside>
  );
}

function WrapSide({ card }: { card: GameWrapCard }) {
  return (
    <aside className="tt-wrap-side">
      <StatBox
        title="Box"
        rows={card.stats.map((s) => ({ left: s.label, right: s.value }))}
      />
      <StatBox
        title="Names"
        rows={card.leaders.map((l) => ({
          left: l.href ? (
            <ExternalOrLink href={l.href} className="tt-a">
              {l.name}
            </ExternalOrLink>
          ) : (
            l.name
          ),
          right: l.line,
        }))}
      />
      <StatBox
        title="Club"
        rows={card.teamStats.map((s) => ({ left: s.label, right: s.value }))}
      />
      <StatBox
        title="Table"
        rows={card.division.map((r) => ({
          left: `${r.rank} ${r.team}`,
          right: r.record,
          me: r.me,
        }))}
      />
    </aside>
  );
}

/** One story cell inside a packed folio — prose + side box share the cell. */
function FolioStory({ card, compact }: { card: GameWrapCard; compact?: boolean }) {
  const copy = cardCopy(card);
  const paras = proseParas(copy, compact ? 10 : 16);
  return (
    <div className={cn("tt-folio-story", compact && "compact")}>
      <article className="tt-wrap-story">
        <StoryHead card={card} level={compact ? 3 : 2} />
        {paras.length ? (
          <div className={cn("tt-prose", !compact && "cols-2")}>
            {paras.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}
        <StoryLinks card={card} />
      </article>
      <WrapSide card={card} />
    </div>
  );
}

/** Inside page: two stories stacked/side-by-side plus a wire strip — no blank cream. */
function InsidePage({
  primary,
  secondary,
  wire,
  teams,
}: {
  primary: GameWrapCard;
  secondary?: GameWrapCard;
  wire: GameWrapCard[];
  teams: TeamInfobox[];
}) {
  const team = teams.find((t) => t.fav.key === primary.favoriteKey);
  return (
    <div className="tt-inside">
      <div className={cn("tt-inside-grid", secondary ? "two" : "one")}>
        <FolioStory card={primary} compact={Boolean(secondary)} />
        {secondary ? <FolioStory card={secondary} compact /> : null}
      </div>
      <div className="tt-inside-foot">
        {wire.length ? <WireStack cards={wire} /> : null}
        {team?.recentLines.length ? (
          <StatBox
            title={`${team.fav.shortName} recent`}
            rows={team.recentLines.map((g) => ({
              left: g.label,
              right: g.won === true ? "W" : g.won === false ? "L" : "·",
            }))}
          />
        ) : null}
        {teams
          .filter((t) => t.fav.key !== primary.favoriteKey)
          .slice(0, 2)
          .map((t) => (
            <StatBox
              key={t.fav.key}
              title={t.fav.shortName}
              rows={[
                { left: "Record", right: t.snap.record || "—" },
                { left: "Next", right: t.snap.nextGame?.label || "—" },
                ...t.teamStats.slice(0, 3).map((s) => ({ left: s.label, right: s.value })),
              ]}
            />
          ))}
      </div>
    </div>
  );
}

function chunkPairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
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

  const wrapCards = useMemo(() => {
    const cards = [...(enrichedQ.data ?? baseCards)];
    // Lead = longest usable copy so A1 never opens on a thin score line.
    cards.sort((a, b) => cardCopy(b).length - cardCopy(a).length);
    return cards;
  }, [enrichedQ.data, baseCards]);

  const lead = wrapCards[0] ?? null;
  // Rail takes 1–2; main column wire takes the rest after lead.
  const railCards = wrapCards.slice(1, 3);
  const mainWire = wrapCards.slice(3);
  const insidePairs = useMemo(() => chunkPairs(wrapCards), [wrapCards]);

  const pages = useMemo(() => {
    const out: (
      | { kind: "front" }
      | {
          kind: "inside";
          primary: GameWrapCard;
          secondary?: GameWrapCard;
          wire: GameWrapCard[];
        }
    )[] = [{ kind: "front" }];
    for (let i = 0; i < insidePairs.length; i++) {
      const pair = insidePairs[i]!;
      const used = new Set(pair.map((c) => c.id));
      const wire = wrapCards.filter((c) => !used.has(c.id)).slice(0, 4);
      out.push({
        kind: "inside",
        primary: pair[0]!,
        secondary: pair[1],
        wire,
      });
    }
    return out;
  }, [insidePairs, wrapCards]);

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
                      {mainWire.length ? (
                        <WireStack cards={mainWire} />
                      ) : (
                        <div className="tt-wire tt-wire-fill">
                          {teams.slice(0, 6).map((t) => (
                            <article key={t.fav.key} className="tt-brief">
                              <p className="tt-kicker">
                                {t.fav.league} ·{" "}
                                <ExternalOrLink href={t.href} className="tt-a">
                                  {t.fav.shortName}
                                </ExternalOrLink>
                              </p>
                              <h3>
                                <ExternalOrLink href={t.href} className="tt-a">
                                  {t.snap.standing || t.snap.record || t.fav.name}
                                </ExternalOrLink>
                              </h3>
                              <p className="tt-brief-dek">
                                {[
                                  t.snap.lastGame
                                    ? `Last: ${t.snap.lastGame.label}${t.snap.lastGame.detail ? ` ${t.snap.lastGame.detail}` : ""}`
                                    : null,
                                  t.snap.nextGame
                                    ? `Next: ${t.snap.nextGame.label}${t.snap.nextGame.when ? ` ${t.snap.nextGame.when}` : ""}`
                                    : null,
                                  t.teamStats
                                    .slice(0, 3)
                                    .map((s) => `${s.label} ${s.value}`)
                                    .join(" · ") || null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                    <Rail teams={teams} cards={railCards} />
                  </div>
                </div>
              </section>
            );
          }

          return (
            <section
              key={`${page.primary.id}-${page.secondary?.id ?? "solo"}`}
              className="np-page tt-page"
              aria-label={`Page ${pi + 1}`}
            >
              <Mast day={day} folio={`A${pi + 1}`} />
              <div className="tt-body">
                <InsidePage
                  primary={page.primary}
                  secondary={page.secondary}
                  wire={page.wire}
                  teams={teams}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
