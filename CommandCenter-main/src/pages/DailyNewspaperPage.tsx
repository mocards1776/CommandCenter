import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw, Share } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  editionDateline,
  editionDay,
  editionIssue,
  editionNewsDay,
  msUntilNextEdition,
  romanNumeral,
} from "@/lib/newspaper";
import {
  buildGameWrapCards,
  buildTeamInfoboxes,
  enrichWrapBodies,
  matchWrapToFavorites,
  mergeStoryCards,
  promotePostseason,
  wireStoryCards,
  wrapFeedsForFavorites,
  type GameWrapCard,
  type TeamInfobox,
} from "@/lib/newspaper-sports";
import {
  enrichWireStories,
  fetchNewspaperWire,
  type WireGame,
} from "@/lib/newspaper-wire";
import { fetchRssFeed } from "@/lib/rss";
import {
  fetchTeamDetail,
  fetchTeamSnapshot,
  loadSportsLayout,
  visibleFavorites,
  type SportsFavorite,
  type TeamDetail,
} from "@/lib/sports";
import { cn } from "@/lib/utils";
import { fetchYesterdayRecap } from "@/lib/yesterday-recap";

/** How many stories get a full ESPN story pull rather than the wire stub. */
const DEEP_STORIES = 28;

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

/* ───────────────────────── nameplate ───────────────────────── */

function Nameplate({ day, folio, pages }: { day: string; folio: string; pages: number }) {
  const { volume, issue } = editionIssue(day);
  return (
    <header className="wsj-head">
      <h1 className="wsj-nameplate">The Thompson Times</h1>
      <div className="wsj-folio">
        <span className="wsj-folio-l">
          <em>Sports Desk</em>
          <span className="wsj-dots" aria-hidden="true" />
          <span>Wires &amp; ESPN</span>
        </span>
        <span className="wsj-folio-c">
          {editionDateline(day)} · VOL. {romanNumeral(volume)} NO. {issue}
        </span>
        <span className="wsj-folio-r">
          <span className="wsj-stars">★★★★</span>
          <span>
            {folio} of {pages}
          </span>
        </span>
      </div>
    </header>
  );
}

/* ───────────────────────── data band ───────────────────────── */

/** The markets strip, but for clubs: record, form, and what's next. */
function ScoreBand({ teams, wireCount }: { teams: TeamInfobox[]; wireCount: number }) {
  const active = teams.filter((t) => t.seasonState === "active");
  const cells = active.length ? active : teams;
  return (
    <div className="wsj-band">
      {cells.map((t) => {
        const last = t.snap.lastGame;
        const up = last?.won === true;
        const down = last?.won === false;
        return (
          <ExternalOrLink key={t.fav.key} href={t.href} className="wsj-band-cell wsj-a">
            <span className="wsj-band-lg">{t.fav.league}</span>
            <span className="wsj-band-team">{t.snap.shortName || t.fav.shortName}</span>
            <span className="wsj-band-val">{t.snap.record || t.snap.standing || "—"}</span>
            <span className={cn("wsj-band-move", up && "up", down && "down")}>
              {up ? "▲" : down ? "▼" : "·"}{" "}
              {last?.detail || last?.label || t.snap.nextGame?.label || "—"}
            </span>
          </ExternalOrLink>
        );
      })}
      <span className="wsj-band-cell wsj-band-count">
        <span className="wsj-band-lg">Wire</span>
        <span className="wsj-band-team">Games</span>
        <span className="wsj-band-val">{wireCount}</span>
        <span className="wsj-band-move">on the desk</span>
      </span>
    </div>
  );
}

/* ───────────────────────── copy helpers ───────────────────────── */

function proseParas(text: string, max = 40): string[] {
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
      .match(/.{1,340}(?:\s|$)/g)
      ?.map((s) => s.trim())
      .filter(Boolean)
      .slice(0, max) ?? [raw]
  );
}

/** Agate notes that tail a story so ruled columns always run full. */
function notesTail(card: GameWrapCard): string {
  const bits: string[] = [];
  if (card.leaders.length) {
    bits.push(
      `NOTES — ${card.leaders
        .slice(0, 6)
        .map((l) => `${l.name} ${l.line}`)
        .join("; ")}.`,
    );
  }
  if (card.teamStats.length) {
    bits.push(
      `Club marks: ${card.teamStats
        .slice(0, 8)
        .map((s) => `${s.label} ${s.value}`)
        .join(", ")}.`,
    );
  }
  if (card.division.length) {
    bits.push(
      `Standings: ${card.division
        .map((r) => `${r.rank}. ${r.team} ${r.record}`)
        .join("; ")}.`,
    );
  }
  // Every story closes on a glance line, so a short recap still runs its
  // column to the foot instead of stopping in a strip of white.
  const glance = [card.status, card.round, card.series].filter(Boolean).join(" · ");
  const records = card.boxScore?.find((r) => r.label === "Record");
  const parts = [
    glance,
    records ? `Records ${records.away} and ${records.home}` : "",
    card.scoreLine,
  ].filter(Boolean);
  if (parts.length) bits.push(`AT A GLANCE — ${parts.join(". ")}.`);
  return bits.join("\n\n");
}

function cardCopy(card: GameWrapCard): string {
  if (card.body && card.body.trim().length >= 80) {
    const tail = notesTail(card);
    return tail ? `${card.body.trim()}\n\n${tail}` : card.body.trim();
  }
  const bits: string[] = [];
  if (card.dek) bits.push(card.dek.trim());
  if (card.scoreLine) bits.push(`${card.status || "Final"}: ${card.scoreLine}.`);
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

function kickerOf(card: GameWrapCard): string {
  const bits = [card.sportLabel];
  if (card.round) bits.push(card.round);
  else if (card.postseason) bits.push("Postseason");
  if (card.followed && card.teamName) bits.push(card.teamName);
  return bits.join(" · ");
}

/* ───────────────────────── story parts ───────────────────────── */

function Byline({ card }: { card: GameWrapCard }) {
  return (
    <p className="wsj-byline">
      <em>By</em> {card.sportLabel} Wire
      {card.followed ? ` · ${card.teamName} Desk` : ""}
    </p>
  );
}

function Prose({
  card,
  cols,
  max,
  drop,
}: {
  card: GameWrapCard;
  cols: 1 | 2 | 3 | 4;
  max?: number;
  drop?: boolean;
}) {
  const copy = cardCopy(card);
  const paras = proseParas(copy, max ?? 40);
  if (!paras.length) return null;
  return (
    <div className={cn("wsj-prose", `c${cols}`, drop && "drop")}>
      {paras.map((p, i) => (
        <p key={i}>
          {i === 0 && card.dateline ? <span className="wsj-dateline">{card.dateline} — </span> : null}
          {p}
        </p>
      ))}
    </div>
  );
}

function Jump({ card, page }: { card: GameWrapCard; page: number }) {
  const href = card.gameHref || card.wrapHref;
  if (!href) return null;
  return (
    <p className="wsj-jump">
      <ExternalOrLink href={href} className="wsj-a">
        Please turn to page A{page}
      </ExternalOrLink>
    </p>
  );
}

function Cut({ card }: { card: GameWrapCard }) {
  if (!card.photo) return null;
  return (
    <figure className="wsj-cut">
      <img src={card.photo} alt="" loading="lazy" />
      <figcaption>
        {card.caption}
        {card.series ? <span className="wsj-credit"> {card.series}</span> : null}
      </figcaption>
    </figure>
  );
}

function Headline({
  card,
  size,
}: {
  card: GameWrapCard;
  size: "xl" | "lg" | "md" | "sm";
}) {
  const href = card.gameHref || card.wrapHref || card.teamHref;
  return (
    <>
      <p className="wsj-kicker">{kickerOf(card)}</p>
      <h2 className={cn("wsj-hl", size)}>
        <ExternalOrLink href={href} className="wsj-a">
          {card.headline}
        </ExternalOrLink>
      </h2>
    </>
  );
}

/* ───────────────────────── What's News rail ───────────────────────── */

/**
 * "7 PM" out of an ISO stamp, in the reader's own zone. hour12 is forced
 * because a 24-hour locale would print a bare "19" once the :00 is dropped.
 */
function faceOff(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return t.replace(":00 ", " ");
}

function WhatsNews({
  cards,
  teams,
  postseason,
  tonight,
}: {
  cards: GameWrapCard[];
  teams: TeamInfobox[];
  postseason: string[];
  tonight: WireGame[];
}) {
  const closed = teams.filter((t) => t.seasonState === "complete");
  return (
    <aside className="wsj-news">
      <h3 className="wsj-news-head">What’s News</h3>
      <p className="wsj-news-sub">Around the Leagues</p>
      <ul className="wsj-news-list">
        {postseason.map((league) => (
          <li key={`post-${league}`}>
            <strong>{league} is in the postseason.</strong> Bracket games lead the
            wire until a champion is decided.
          </li>
        ))}
        {cards.slice(0, 7).map((c, i) => {
          const href = c.gameHref || c.wrapHref || c.teamHref;
          const lead = c.headline.split(/(?<=^[^.]{12,90})\s+/)[0] ?? c.headline;
          return (
            <li key={c.id}>
              <ExternalOrLink href={href} className="wsj-a">
                <strong>{lead}</strong>
              </ExternalOrLink>{" "}
              {c.scoreLine ? `${c.scoreLine}. ` : ""}
              {c.round ? `${c.round}. ` : ""}
              <span className="wsj-ref">A{Math.min(9, 2 + Math.floor(i / 2))}</span>
            </li>
          );
        })}
      </ul>
      {tonight.length ? (
        <>
          <p className="wsj-news-sub">Tonight</p>
          <ul className="wsj-news-list tight">
            {tonight.map((g) => (
              <li key={g.id}>
                <ExternalOrLink href={g.href} className="wsj-a">
                  <strong>
                    {g.away.short} at {g.home.short}
                  </strong>
                </ExternalOrLink>{" "}
                {g.league}
                {g.round ? `, ${g.round}` : ""}.{" "}
                <span className="wsj-ref">
                  {g.live ? g.statusDetail : faceOff(g.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {closed.length ? (
        <>
          <p className="wsj-news-sub">Season Complete</p>
          <ul className="wsj-news-list tight">
            {closed.map((t) => (
              <li key={t.fav.key}>
                <ExternalOrLink href={t.href} className="wsj-a">
                  <strong>{t.snap.shortName || t.fav.shortName}</strong>
                </ExternalOrLink>{" "}
                finished {t.snap.record || "—"}
                {t.snap.standing ? `, ${t.snap.standing}` : ""}.
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  );
}

/* ───────────────────────── agate boxes ───────────────────────── */

function AgateBox({
  title,
  rows,
  wide,
}: {
  title: string;
  rows: { left: ReactNode; right?: ReactNode; me?: boolean }[];
  wide?: boolean;
}) {
  if (!rows.length) return null;
  return (
    <div className={cn("wsj-box", wide && "wide")}>
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

/** Rows for whatever height is left over, so no box stretches into white. */
function deskAgate(teams: TeamInfobox[], skipKey?: string) {
  return teams
    .filter((t) => t.fav.key !== skipKey)
    .flatMap((t) => {
      const rows: { left: ReactNode; right?: ReactNode }[] = [
        {
          left: (
            <>
              <strong>{t.fav.shortName}</strong> <em>{t.fav.league}</em>
            </>
          ),
          right: t.snap.record || t.snap.standing || "—",
        },
      ];
      if (t.snap.nextGame) {
        rows.push({
          left: <em>Next {t.snap.nextGame.label}</em>,
          right: t.snap.nextGame.when || "—",
        });
      } else if (t.seasonState === "complete") {
        rows.push({ left: <em>Season complete</em>, right: t.snap.standing || "—" });
      }
      return rows;
    })
    .slice(0, 20);
}

function StoryRail({ card, teams }: { card: GameWrapCard; teams?: TeamInfobox[] }) {
  return (
    <aside className="wsj-rail">
      {card.boxScore?.length ? (
        <div className="wsj-box">
          <h4>Line score</h4>
          <ul>
            <li>
              <span>
                <strong>{card.scoreLine}</strong>
              </span>
              <span className="v">{card.status}</span>
            </li>
            {card.boxScore.map((r) => (
              <li key={r.label}>
                <span>{r.label}</span>
                <span className="v">
                  {r.away} / {r.home}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <AgateBox
          title="Box"
          rows={card.stats.map((s) => ({ left: s.label, right: s.value }))}
        />
      )}
      <AgateBox
        title="Names in the game"
        rows={card.leaders.map((l) => ({
          left: l.href ? (
            <ExternalOrLink href={l.href} className="wsj-a">
              {l.name}
            </ExternalOrLink>
          ) : (
            l.name
          ),
          right: l.line,
        }))}
      />
      <AgateBox
        title="Club"
        rows={card.teamStats.map((s) => ({ left: s.label, right: s.value }))}
      />
      <AgateBox
        title="Standings"
        rows={card.division.map((r) => ({
          left: `${r.rank} ${r.team}`,
          right: r.record,
          me: r.me,
        }))}
      />
      {teams?.length ? (
        <AgateBox title="Around the desk" rows={deskAgate(teams, card.favoriteKey)} />
      ) : null}
    </aside>
  );
}

/* ───────────────────────── briefs ───────────────────────── */

function Brief({ card, words = 190 }: { card: GameWrapCard; words?: number }) {
  const href = card.gameHref || card.wrapHref || card.teamHref;
  const dek = cardCopy(card).replace(/\s+/g, " ").trim().slice(0, words);
  return (
    <article className="wsj-brief">
      <p className="wsj-kicker">{kickerOf(card)}</p>
      <h3>
        <ExternalOrLink href={href} className="wsj-a">
          {card.headline}
        </ExternalOrLink>
      </h3>
      {card.scoreLine ? <p className="wsj-score">{card.scoreLine}</p> : null}
      {dek ? (
        <p className="wsj-brief-dek">
          {card.dateline ? <span className="wsj-dateline">{card.dateline} — </span> : null}
          {dek}
          {dek.length >= words ? "…" : ""}
        </p>
      ) : null}
    </article>
  );
}

function BriefRow({ cards, cols }: { cards: GameWrapCard[]; cols: number }) {
  if (!cards.length) return null;
  return (
    <div className="wsj-briefs" style={{ ["--cols" as string]: String(cols) }}>
      {cards.map((c) => (
        <Brief key={c.id} card={c} />
      ))}
    </div>
  );
}

/* ───────────────────────── front page ───────────────────────── */

function FrontPage({
  lead,
  second,
  third,
  briefs,
  teams,
  postseason,
  newsCards,
  tonight,
}: {
  lead: GameWrapCard | null;
  second: GameWrapCard | null;
  third: GameWrapCard | null;
  briefs: GameWrapCard[];
  teams: TeamInfobox[];
  postseason: string[];
  newsCards: GameWrapCard[];
  tonight: WireGame[];
}) {
  if (!lead) {
    return <p className="wsj-empty">The wire is quiet. Nothing has come in for your clubs.</p>;
  }
  return (
    <div className="wsj-front">
      {/* Top deck: What's News · art · lead story */}
      <div className="wsj-deck">
        <WhatsNews
          cards={newsCards}
          teams={teams}
          postseason={postseason}
          tonight={tonight}
        />

        <div className="wsj-art">
          <Cut card={lead} />
          {third ? (
            <article className="wsj-underart">
              <Headline card={third} size="md" />
              <Prose card={third} cols={2} max={8} />
            </article>
          ) : null}
        </div>

        <article className="wsj-lead">
          <Headline card={lead} size="xl" />
          {lead.series || lead.round ? (
            <p className="wsj-dek">{[lead.round, lead.series].filter(Boolean).join(" · ")}</p>
          ) : null}
          <Byline card={lead} />
          <Prose card={lead} cols={2} drop max={18} />
          <Jump card={lead} page={2} />
        </article>
      </div>

      {/* Second deck: stacked head · spanning feature */}
      {second ? (
        <div className="wsj-deck2">
          <div className="wsj-stack">
            <Headline card={second} size="lg" />
            <p className="wsj-stack-dek">
              {second.scoreLine}
              {second.status ? ` · ${second.status}` : ""}
            </p>
            <AgateBox
              title="Names"
              rows={second.leaders.slice(0, 2).map((l) => ({ left: l.name, right: l.line }))}
            />
          </div>
          <div className="wsj-feature">
            <Byline card={second} />
            <Prose card={second} cols={3} max={20} />
          </div>
        </div>
      ) : null}

      <ScoreBand teams={teams} wireCount={newsCards.length} />
      <BriefRow cards={briefs} cols={Math.min(5, Math.max(2, briefs.length))} />
    </div>
  );
}

/* ───────────────────────── inside pages ───────────────────────── */

function InsidePage({
  primary,
  secondary,
  briefs,
  teams,
  folioNext,
}: {
  primary: GameWrapCard;
  secondary?: GameWrapCard;
  briefs: GameWrapCard[];
  teams: TeamInfobox[];
  folioNext: number;
}) {
  return (
    <div className="wsj-inside">
      <div className={cn("wsj-inside-grid", secondary ? "two" : "one")}>
        <article className="wsj-story">
          {primary.photo ? <Cut card={primary} /> : null}
          <Headline card={primary} size={secondary ? "lg" : "xl"} />
          {primary.round || primary.series ? (
            <p className="wsj-dek">
              {[primary.round, primary.series].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <Byline card={primary} />
          <Prose card={primary} cols={secondary ? 2 : 3} max={30} />
          <Jump card={primary} page={folioNext} />
        </article>
        {secondary ? (
          <article className="wsj-story">
            <Headline card={secondary} size="md" />
            <Byline card={secondary} />
            <Prose card={secondary} cols={2} max={24} />
            <Jump card={secondary} page={folioNext} />
          </article>
        ) : null}
        <StoryRail card={primary} teams={teams} />
      </div>
      <BriefRow cards={briefs} cols={Math.min(5, Math.max(2, briefs.length))} />
    </div>
  );
}

/* ───────────────────────── paging ───────────────────────── */

type Page =
  | { kind: "front" }
  | {
      kind: "inside";
      primary: GameWrapCard;
      secondary?: GameWrapCard;
      briefs: GameWrapCard[];
    };

/** Stories the front page sets in full before the paper turns inside. */
const FRONT_STORIES = 3;

/**
 * Two full stories a page, with the next few games set as briefs along the foot.
 * The run is as long as the wire — no cap, so a 90-game Saturday prints a
 * 90-game paper.
 */
function paginate(cards: GameWrapCard[]): Page[] {
  const pages: Page[] = [{ kind: "front" }];
  const rest = cards.slice(FRONT_STORIES);
  const BRIEFS = 4;
  let i = 0;
  while (i < rest.length) {
    const primary = rest[i]!;
    const secondary = rest[i + 1];
    const briefs = rest.slice(i + 2, i + 2 + BRIEFS);
    pages.push({ kind: "inside", primary, secondary, briefs });
    i += 2 + briefs.length;
  }
  return pages;
}

/* ───────────────────────── page ───────────────────────── */

export default function DailyNewspaperPage() {
  const { user } = useAuth();
  const [day, setDay] = useState(() => editionDay());
  const layout = useMemo(() => loadSportsLayout(), []);
  const teamFavs = useMemo(
    () => visibleFavorites(layout).filter((f) => f.kind === "team"),
    [layout],
  );

  // The paper goes to press at 4 AM. An app left open on the counter rolls
  // itself over instead of showing yesterday's front until you reload.
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setDay(editionDay());
        schedule();
      }, msUntilNextEdition() + 2_000);
    };
    schedule();
    const onWake = () => setDay(editionDay());
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, []);

  const pagerRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const favKeys = teamFavs.map((t) => t.key).join(",");

  const teamSnaps = useQuery({
    queryKey: ["tt-team-snaps", day, favKeys],
    queryFn: async () =>
      Promise.all(
        teamFavs.map(async (fav) => {
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

  const teamDetailsQ = useQuery({
    queryKey: ["tt-team-details", day, favKeys],
    queryFn: async () => {
      const rows = await Promise.all(
        teamFavs.map(async (fav) => {
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
    enabled: teamFavs.length > 0,
    staleTime: 5 * 60_000,
  });

  const wireQ = useQuery({
    queryKey: ["tt-wire", day, favKeys],
    queryFn: async () => {
      const wire = await fetchNewspaperWire({ favs: teamFavs, day });
      const games = await enrichWireStories(wire.games, DEEP_STORIES);
      return { ...wire, games };
    },
    enabled: teamFavs.length > 0,
    staleTime: 5 * 60_000,
  });

  const recap = useQuery({
    queryKey: ["newspaper-yesterday-recap", day, user?.id],
    queryFn: () => fetchYesterdayRecap({ layout, userId: user?.id }),
    staleTime: 120_000,
  });

  const wrapFeedUrls = useMemo(() => wrapFeedsForFavorites(teamFavs), [teamFavs]);

  const wrapsQ = useQuery({
    queryKey: ["tt-wraps", day, wrapFeedUrls.join("|")],
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
          const hit = matchWrapToFavorites(item, feed.url, teamFavs);
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

  const teamCards = useMemo(
    () =>
      buildGameWrapCards({
        favs: teamFavs,
        details: teamDetailsQ.data ?? [],
        recapGames: recap.data?.games ?? [],
        wraps: wrapsQ.data ?? [],
      }),
    [teamFavs, teamDetailsQ.data, recap.data, wrapsQ.data],
  );

  const enrichedQ = useQuery({
    queryKey: [
      "tt-wrap-bodies",
      day,
      teamCards.map((c) => `${c.id}:${c.gameId}`).join("|"),
    ],
    queryFn: () => enrichWrapBodies(teamCards, teamFavs),
    enabled: teamCards.length > 0,
    staleTime: 10 * 60_000,
  });

  const stories = useMemo(() => {
    const wire = wireStoryCards({
      games: wireQ.data?.games ?? [],
      favs: teamFavs,
      details: teamDetailsQ.data ?? [],
    });
    const merged = mergeStoryCards(wire, enrichedQ.data ?? teamCards);
    return promotePostseason(merged, FRONT_STORIES);
  }, [wireQ.data, teamFavs, teamDetailsQ.data, enrichedQ.data, teamCards]);

  /**
   * A game still being played has no story to set, so it runs on the front the
   * way a paper runs it: a line in the rail rather than a bylined column.
   */
  const tonight = useMemo(() => {
    const games = wireQ.data?.games ?? [];
    return games
      .filter((g) => !g.final && !g.preseason)
      .sort((a, b) =>
        a.live === b.live
          ? String(a.startedAt).localeCompare(String(b.startedAt))
          : a.live
            ? -1
            : 1,
      )
      .slice(0, 8);
  }, [wireQ.data]);

  const pages = useMemo(() => paginate(stories), [stories]);

  const lead = stories[0] ?? null;
  const second = stories[1] ?? null;
  const third = stories[2] ?? null;
  const frontBriefs = stories.slice(FRONT_STORIES, FRONT_STORIES + 5);

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
    wireQ.isFetching ||
    recap.isFetching ||
    wrapsQ.isFetching ||
    enrichedQ.isFetching;

  async function onRefresh() {
    setDay(editionDay());
    await Promise.all([
      teamSnaps.refetch(),
      teamDetailsQ.refetch(),
      wireQ.refetch(),
      recap.refetch(),
      wrapsQ.refetch(),
      enrichedQ.refetch(),
    ]);
  }

  return (
    <div className="newspaper-root wsj-shell">
      <div className="wsj-chrome print:hidden">
        <div className="wsj-chrome-l">
          <strong>Thompson Times</strong>
          <span>
            Edition {day} · covers {editionNewsDay(day)} · presses 4 a.m. CT
          </span>
        </div>
        <div className="wsj-chrome-c">
          <button
            type="button"
            className="wsj-pager-btn"
            aria-label="Previous page"
            disabled={pageIndex <= 0}
            onClick={() => goPage(pageIndex - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="wsj-pager-label">
            {pageIndex + 1}/{pages.length}
          </span>
          <button
            type="button"
            className="wsj-pager-btn"
            aria-label="Next page"
            disabled={pageIndex >= pages.length - 1}
            onClick={() => goPage(pageIndex + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="wsj-chrome-r">
          <a href="/times.html" className="wsj-chrome-btn" title="Add to Home Screen">
            <Share size={12} />
            Home Screen
          </a>
          <button type="button" onClick={() => void onRefresh()} className="wsj-chrome-btn">
            <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      <div className="newspaper-edition wsj-pager" ref={pagerRef}>
        {pages.map((page, pi) => (
          <section
            key={page.kind === "front" ? "front" : `${page.primary.id}-${pi}`}
            className="wsj-page"
            aria-label={`Page A${pi + 1}`}
          >
            <span className="wsj-tab">A{pi + 1}</span>
            <Nameplate day={day} folio={`A${pi + 1}`} pages={pages.length} />
            <div className="wsj-body">
              {page.kind === "front" ? (
                <FrontPage
                  lead={lead}
                  second={second}
                  third={third}
                  briefs={frontBriefs}
                  teams={teams}
                  postseason={wireQ.data?.postseasonLeagues ?? []}
                  newsCards={stories}
                  tonight={tonight}
                />
              ) : (
                <InsidePage
                  primary={page.primary}
                  secondary={page.secondary}
                  briefs={page.briefs}
                  teams={teams}
                  folioNext={Math.min(pages.length, pi + 2)}
                />
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
