import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw, Share } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  editionCovers,
  editionDateline,
  editionDay,
  editionIssue,
  editionNewsDay,
  msUntilNextEdition,
  romanNumeral,
} from "@/lib/newspaper";
import { fetchLeagueArticles, fetchTeamArticles } from "@/lib/newspaper-news";
import {
  buildGameWrapCards,
  buildTeamInfoboxes,
  enrichWrapBodies,
  leaguePathFromEspn,
  matchWrapToFavorites,
  mergeStoryCards,
  playerHref,
  wireStoryCards,
  wrapFeedsForFavorites,
  type GameWrapCard,
  type TeamInfobox,
} from "@/lib/newspaper-sports";
import {
  buildEdition,
  type ClubDesk,
  type EditionPage,
  type EditionSection,
} from "@/lib/newspaper-sections";
import {
  enrichWireStories,
  espnTeamLogo,
  fetchLeagueClubs,
  fetchLeagueSlate,
  fetchNewspaperWire,
  markFavoriteClubs,
  type LeagueClub,
  type LeagueSlateGame,
  type WireGame,
} from "@/lib/newspaper-wire";
import { fetchMlbPlayoffTree, type MlbPlayoffTree } from "@/lib/mlb";
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
const DEEP_STORIES = 48;

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

function TeamLogo({
  src,
  alt,
  size = "md",
}: {
  src: string | null | undefined;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  if (!src) {
    return <span className={cn("wsj-logo", size, "empty")} aria-hidden="true" />;
  }
  return (
    <img
      src={src}
      alt={alt ?? ""}
      className={cn("wsj-logo", size)}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

/* ───────────────────────── nameplate ───────────────────────── */

function Nameplate({
  day,
  page,
}: {
  day: string;
  page: EditionPage;
}) {
  const { volume, issue } = editionIssue(day);
  return (
    <header className="wsj-head">
      <h1 className="wsj-nameplate">The Thompson Times</h1>
      <div className="wsj-folio">
        <span className="wsj-folio-l">
          <em>{page.sectionTitle}</em>
          <span className="wsj-dots" aria-hidden="true" />
          <span>Wires &amp; ESPN</span>
        </span>
        <span className="wsj-folio-c">
          {editionDateline(day)} · VOL. {romanNumeral(volume)} NO. {issue}
        </span>
        <span className="wsj-folio-r">
          <span className="wsj-stars">★★★★</span>
          <span>
            {page.folio} · {page.sectionPage} of {page.sectionCount}
          </span>
        </span>
      </div>
      <p className="wsj-section-rule">
        <span>Section {page.section}</span>
        <span>
          {page.kind === "sport-front"
            ? page.focus === "news"
              ? "News"
              : page.focus === "recaps"
                ? "Recaps"
                : page.focus === "teams"
                  ? "All Teams"
                  : page.focus === "schedule"
                    ? "Schedule"
                    : page.focus === "playoffs"
                      ? "Playoffs"
                      : "Club Form"
            : page.kind === "sport-inside"
              ? "Stories"
              : page.kind === "favorites-clubs"
                ? "Your Clubs"
                : page.kind === "favorites-form"
                  ? "Club Form"
                  : page.kind === "favorites-inside"
                    ? "Stories"
                    : "Favorite Teams"}
        </span>
      </p>
    </header>
  );
}

/* ───────────────────────── data band ───────────────────────── */

/** Full-page club desk — large cells that fill the sheet. */
function ClubsDesk({ teams, onTurn }: { teams: TeamInfobox[]; onTurn?: (folio: string) => void }) {
  const cells = teams.length ? teams : [];
  return (
    <div className="wsj-clubs-desk">
      <header className="wsj-clubs-desk-head">
        <h3>Your clubs</h3>
        <p>{cells.length} followed · records, form, standings, and what’s next</p>
        {onTurn ? (
          <button type="button" className="wsj-jump-btn" onClick={() => onTurn("A2")}>
            Full clubs page A2
          </button>
        ) : null}
      </header>
      <ul className="wsj-clubs-desk-grid">
        {cells.map((t) => {
          const next = t.snap.nextGame;
          const closed = t.seasonState === "complete";
          const table = tableWindow(
            (t.detail?.division ?? []).map((row) => ({
              rank: row.rank,
              team: row.team,
              record: row.record,
              gb: row.gb,
              me: row.isMe,
            })),
          ).slice(0, 5);
          const leaders = [
            ...(t.detail?.hittingLeaders ?? []),
            ...(t.detail?.pitchingLeaders ?? []),
          ].slice(0, 3);
          return (
            <li key={t.fav.key}>
              <ExternalOrLink href={t.href} className="wsj-clubs-card wsj-a">
                <div className="wsj-clubs-card-top">
                  <TeamLogo src={t.snap.logo || t.detail?.logo} size="lg" />
                  <div className="wsj-clubs-card-body">
                    <span className="wsj-clubs-card-lg">{t.fav.league}</span>
                    <strong>{t.snap.shortName || t.fav.shortName}</strong>
                    <em>{clubRecord(t) || "—"}</em>
                    <span className="wsj-clubs-standing">{t.snap.standing || "—"}</span>
                    <span>
                      {next
                        ? `Next ${next.label}${next.when ? ` · ${next.when}` : ""}`
                        : closed
                          ? `Season over${t.snap.standing ? ` · ${t.snap.standing}` : ""}`
                          : "—"}
                    </span>
                    {t.form.length ? (
                      <span className="wsj-clubs-form">{t.form.join(" ")}</span>
                    ) : null}
                  </div>
                </div>
                {table.length ? (
                  <ul className="wsj-clubs-mini-table">
                    {table.map((row) => (
                      <li key={`${t.fav.key}-${row.rank}-${row.team}`} className={cn(row.me && "me")}>
                        <span>
                          {row.rank} {row.team}
                        </span>
                        <strong>{row.record}</strong>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {leaders.length ? (
                  <ul className="wsj-clubs-leaders">
                    {leaders.map((leader) => (
                      <li key={`${t.fav.key}-${leader.name}`}>
                        <span>{leader.name}</span>
                        <em>{leader.line}</em>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </ExternalOrLink>
            </li>
          );
        })}
      </ul>
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

function gameState(status: string | null | undefined): string | null {
  if (!status) return null;
  if (/^(story|headlinenews|media|preview|recap|news)$/i.test(status.trim())) return null;
  return status;
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
  const glance = [gameState(card.status), card.round, card.series].filter(Boolean).join(" · ");
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

function Jump({ folio, onTurn }: { folio?: string; onTurn: (folio: string) => void }) {
  if (!folio) return null;
  return (
    <p className="wsj-jump">
      <button type="button" className="wsj-jump-btn" onClick={() => onTurn(folio)}>
        Please turn to page {folio}
      </button>
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
  teams,
  postseason,
  tonight,
  comingUp,
  sections,
  onTurn,
}: {
  teams: TeamInfobox[];
  postseason: string[];
  tonight: WireGame[];
  comingUp: { id: string; team: string; label: string; when: string | null }[];
  sections: EditionSection[];
  onTurn: (folio: string) => void;
}) {
  const closed = teams.filter((t) => t.seasonState === "complete");
  const sports = sections.filter((s) => s.code !== "A");
  return (
    <aside className="wsj-news">
      <h3 className="wsj-news-head">What’s News</h3>
      {sports.length ? (
        <>
          <p className="wsj-news-sub">In this edition</p>
          <ul className="wsj-section-pages">
            {sports.map((s) => (
              <li key={s.code}>
                <button type="button" className="wsj-section-page" onClick={() => onTurn(s.folio)}>
                  <span className="wsj-section-page-code">{s.code}</span>
                  <span className="wsj-section-page-meta">
                    <strong>{s.title}</strong>
                    <em>
                      {s.pages} pages ·{" "}
                      {s.stories
                        ? `${s.stories} ${s.stories === 1 ? "story" : "stories"}`
                        : "standings & schedule"}{" "}
                      · {s.folio}
                    </em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="wsj-news-sub">Your clubs</p>
      <ul className="wsj-club-grid">
        {teams.map((t) => (
          <li key={t.fav.key}>
            <ExternalOrLink href={t.href} className="wsj-club-chip wsj-a">
              <TeamLogo src={t.snap.logo || t.detail?.logo} size="md" />
              <span className="wsj-club-meta">
                <strong>{t.snap.shortName || t.fav.shortName}</strong>
                <em>{clubRecord(t) || t.snap.standing || t.fav.league}</em>
              </span>
            </ExternalOrLink>
          </li>
        ))}
      </ul>
      <ul className="wsj-news-list">
        {postseason.map((league) => (
          <li key={`post-${league}`}>
            <strong>{league} is in the postseason.</strong> Bracket games lead the
            wire until a champion is decided.
          </li>
        ))}
        {teams
          .filter((t) => t.seasonState !== "complete")
          .map((t) => (
            <li key={`line-${t.fav.key}`}>
              <ExternalOrLink href={t.href} className="wsj-a">
                <strong>{t.snap.shortName || t.fav.shortName}</strong>
              </ExternalOrLink>{" "}
              {clubRecord(t) || "—"}
              {t.snap.standing ? `, ${t.snap.standing}` : ""}.
            </li>
          ))}
      </ul>
      {tonight.length ? (
        <>
          <p className="wsj-news-sub">Live</p>
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
      {comingUp.length ? (
        <>
          <p className="wsj-news-sub">Coming up</p>
          <ul className="wsj-news-list tight">
            {comingUp.map((game) => (
              <li key={game.id}>
                <strong>{game.team}</strong> {game.label}.{" "}
                <span className="wsj-ref">{game.when || "TBD"}</span>
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
  tonight,
  comingUp,
  sections,
  folioOf,
  onTurn,
  jumpFolio,
}: {
  lead: GameWrapCard | null;
  second: GameWrapCard | null;
  third: GameWrapCard | null;
  briefs: GameWrapCard[];
  teams: TeamInfobox[];
  postseason: string[];
  tonight: WireGame[];
  comingUp: { id: string; team: string; label: string; when: string | null }[];
  sections: EditionSection[];
  folioOf: (card: GameWrapCard) => string;
  onTurn: (folio: string) => void;
  jumpFolio?: string;
}) {
  const news = (
    <WhatsNews
      teams={teams}
      postseason={postseason}
      tonight={tonight}
      comingUp={comingUp}
      sections={sections}
      onTurn={onTurn}
    />
  );
  if (!lead) {
    return (
      <div className="wsj-front">
        <div className="wsj-deck">
          {news}
          <div className="wsj-art wsj-quiet">
            <p className="wsj-empty">
              No fresh copy on your clubs. Turn to A2 for the clubs desk, then each sport section.
            </p>
          </div>
        </div>
        <ClubsDesk teams={teams} onTurn={onTurn} />
      </div>
    );
  }
  return (
    <div className="wsj-front">
      {/* Top deck: What's News · art · lead story */}
      <div className="wsj-deck">
        {news}

        <div className="wsj-art">
          <Cut card={lead} />
          {third ? (
            <article className="wsj-underart">
              <Headline card={third} size="md" />
              <p className="wsj-brief-dek">{recapDek(third)}</p>
              <Prose card={third} cols={1} max={8} />
              <Jump
                folio={folioOf(third) === "A1" ? undefined : folioOf(third)}
                onTurn={onTurn}
              />
            </article>
          ) : null}
        </div>

        <article className="wsj-lead">
          <Headline card={lead} size="xl" />
          {lead.series || lead.round ? (
            <p className="wsj-dek">{[lead.round, lead.series].filter(Boolean).join(" · ")}</p>
          ) : lead.dek ? (
            <p className="wsj-dek">{lead.dek}</p>
          ) : null}
          <Byline card={lead} />
          <Prose card={lead} cols={2} drop max={40} />
          <Jump folio={jumpFolio} onTurn={onTurn} />
        </article>
      </div>

      {second ? (
        <div className="wsj-deck2">
          <div className="wsj-stack">
            <Headline card={second} size="lg" />
            <AgateBox
              title="Names"
              rows={second.leaders.slice(0, 4).map((l) => ({ left: l.name, right: l.line }))}
            />
          </div>
          <div className="wsj-feature">
            <Byline card={second} />
            <Prose card={second} cols={3} max={28} />
            <Jump
              folio={folioOf(second) === "A1" ? undefined : folioOf(second)}
              onTurn={onTurn}
            />
          </div>
        </div>
      ) : (
        <ClubsDesk teams={teams} onTurn={onTurn} />
      )}

      <BriefRow cards={briefs} cols={Math.min(5, Math.max(3, briefs.length || 3))} />
      <p className="wsj-page-trail">
        <button type="button" className="wsj-jump-btn" onClick={() => onTurn("A2")}>
          Please turn to page A2 for the clubs desk
        </button>
      </p>
    </div>
  );
}

/* ───────────────────────── inside pages ───────────────────────── */

function InsidePage({
  primary,
  secondary,
  briefs,
  teams,
  jumpFolio,
  onTurn,
}: {
  primary: GameWrapCard;
  secondary?: GameWrapCard;
  briefs: GameWrapCard[];
  teams: TeamInfobox[];
  jumpFolio?: string;
  onTurn: (folio: string) => void;
}) {
  return (
    <div className="wsj-inside">
      <div className={cn("wsj-inside-grid", secondary ? "two" : "one")}>
        <article className="wsj-story">
          {primary.photo ? <Cut card={primary} /> : null}
          <Headline card={primary} size={secondary ? "lg" : "xl"} />
          {primary.round || primary.series || primary.scoreLine ? (
            <p className="wsj-dek">
              {[primary.round, primary.series, primary.scoreLine].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <Byline card={primary} />
          <Prose card={primary} cols={secondary ? 2 : 3} max={36} />
          {primary.stats.length || primary.leaders.length ? (
            <div className="wsj-sport-tables" style={{ marginTop: "0.35rem" }}>
              <AgateBox
                title="Box"
                rows={primary.stats.slice(0, 6).map((s) => ({ left: s.label, right: s.value }))}
              />
              <AgateBox
                title="Names"
                rows={primary.leaders.slice(0, 6).map((l) => ({ left: l.name, right: l.line }))}
              />
            </div>
          ) : null}
          <Jump folio={jumpFolio} onTurn={onTurn} />
        </article>
        {secondary ? (
          <article className="wsj-story">
            {secondary.photo ? <Cut card={secondary} /> : null}
            <Headline card={secondary} size="md" />
            {secondary.scoreLine ? <p className="wsj-dek">{secondary.scoreLine}</p> : null}
            <Byline card={secondary} />
            <Prose card={secondary} cols={2} max={28} />
            {secondary.leaders.length ? (
              <AgateBox
                title="Names"
                rows={secondary.leaders.slice(0, 5).map((l) => ({ left: l.name, right: l.line }))}
              />
            ) : null}
            <Jump folio={jumpFolio} onTurn={onTurn} />
          </article>
        ) : null}
        <StoryRail card={primary} teams={teams} />
      </div>
      <BriefRow cards={briefs} cols={Math.min(5, Math.max(2, briefs.length))} />
    </div>
  );
}

/* ───────────────────────── sport section front ───────────────────────── */

function recapDek(card: GameWrapCard): string {
  const raw = (card.body || card.dek || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const sentence = raw.split(/(?<=[.!?])\s/)[0] ?? raw;
  return sentence.length > 220 ? `${sentence.slice(0, 217)}…` : sentence;
}

function clubRecord(team: TeamInfobox): string | null {
  const row = team.detail?.division?.find((r) => r.isMe);
  return row?.record || team.snap.record || null;
}

function tableWindow<T extends { me: boolean }>(rows: T[]): T[] {
  if (rows.length <= 8) return rows;
  const me = rows.findIndex((row) => row.me);
  const start = me < 0 ? 0 : Math.max(0, Math.min(me - 3, rows.length - 8));
  return rows.slice(start, start + 8);
}

function tableTitle(standing: string | null): string {
  const place = standing?.match(/\bin\s+(.+)$/i)?.[1]?.trim();
  return place || "Table";
}

function SportHero({
  page,
  leagueClubs,
  blurb,
}: {
  page: Extract<EditionPage, { kind: "sport-front" }>;
  leagueClubs: LeagueClub[];
  blurb: string;
}) {
  return (
    <header className="wsj-sport-hero">
      <div className="wsj-sport-hero-mark">
        <span className="wsj-sport-code">{page.section}</span>
        <div>
          <h3>{page.sectionTitle}</h3>
          <p>{blurb}</p>
        </div>
      </div>
      <div className="wsj-sport-hero-rail" aria-hidden="true">
        {leagueClubs.slice(0, 28).map((club) => (
          <TeamLogo key={club.id} src={club.logo} size="sm" />
        ))}
      </div>
    </header>
  );
}

function SportFront({
  page,
  leagueClubs,
  slate,
  playoffs,
  onTurn,
}: {
  page: Extract<EditionPage, { kind: "sport-front" }>;
  leagueClubs: LeagueClub[];
  slate: LeagueSlateGame[];
  playoffs: MlbPlayoffTree | null;
  onTurn: (folio: string) => void;
}) {
  const tables = new Set<string>();
  const groups = useMemo(() => {
    const map = new Map<string, LeagueClub[]>();
    for (const club of leagueClubs) {
      const key = club.group || "League";
      const list = map.get(key) ?? [];
      list.push(club);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [leagueClubs]);

  if (page.focus === "teams") {
    return (
      <div className="wsj-sport focus-teams">
        <SportHero
          page={page}
          leagueClubs={leagueClubs}
          blurb={`${leagueClubs.length || page.clubs.length} clubs · full league desk · page ${page.folio}`}
        />
        <div className="wsj-sport-solo">
          {groups.length ? (
            groups.map(([group, rows]) => (
              <div key={group} className="wsj-team-group">
                {group && group !== "League" ? <p className="wsj-team-group-label">{group}</p> : null}
                <ul className="wsj-team-wall dense">
                  {rows.map((club) => (
                    <li key={club.id} className={cn(club.favorite && "me")}>
                      <TeamLogo src={club.logo} size="md" />
                      <span className="wsj-team-wall-meta">
                        <strong>{club.abbrev}</strong>
                        <em>{club.record || "—"}</em>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="wsj-empty">League roster loading…</p>
          )}
          <div className="wsj-sport-tables">
            {page.clubs.map((club) => {
              const signature = club.division.map((row) => row.team).join("|");
              const showTable = Boolean(signature) && !tables.has(signature);
              if (!showTable) return null;
              tables.add(signature);
              return (
                <AgateBox
                  key={`table-${club.key}`}
                  title={`${club.shortName} · ${tableTitle(club.standing)}`}
                  rows={club.division.map((row) => ({
                    left: (
                      <span className="wsj-club-inline">
                        <TeamLogo src={row.logo} size="xs" />
                        <span>
                          {row.rank} {row.team}
                        </span>
                      </span>
                    ),
                    right: row.gb && row.gb !== "-" ? `${row.record} ${row.gb}` : row.record,
                    me: row.me,
                  }))}
                />
              );
            })}
          </div>
        </div>
        <p className="wsj-page-trail">
          <button type="button" className="wsj-jump-btn" onClick={() => onTurn(`${page.section}4`)}>
            Please turn to page {page.section}4 for the schedule
          </button>
        </p>
      </div>
    );
  }

  if (page.focus === "schedule") {
    const nextFocus = page.path === "baseball/mlb" ? "playoffs" : "club form";
    return (
      <div className="wsj-sport focus-schedule">
        <SportHero
          page={page}
          leagueClubs={leagueClubs}
          blurb={
            slate.length
              ? `${slate.length} games on the board · probables where filed · page ${page.folio}`
              : `League slate · page ${page.folio}`
          }
        />
        <div className="wsj-sport-solo">
          {slate.length ? (
            <div className="wsj-slate-board">
              {slate.map((game) => (
                <article key={game.id} className={cn("wsj-slate-card", game.live && "live")}>
                  <div className="wsj-slate-card-top">
                    <span>
                      {game.round || (game.final ? "Final" : game.live ? "Live" : "Today")}
                      {game.venue ? ` · ${game.venue}` : ""}
                    </span>
                    <strong>{game.live ? game.status : game.final ? "Final" : game.when || game.status}</strong>
                  </div>
                  <div className="wsj-slate-row">
                    <TeamLogo src={game.away.logo} size="sm" />
                    <div>
                      <strong>{game.away.abbrev}</strong>
                      {game.away.record ? <em>{game.away.record}</em> : null}
                    </div>
                    <span className="score">{game.away.score ?? "—"}</span>
                  </div>
                  <div className="wsj-slate-row">
                    <TeamLogo src={game.home.logo} size="sm" />
                    <div>
                      <strong>{game.home.abbrev}</strong>
                      {game.home.record ? <em>{game.home.record}</em> : null}
                    </div>
                    <span className="score">{game.home.score ?? "—"}</span>
                  </div>
                  {(game.away.pitcher || game.home.pitcher) && !game.final ? (
                    <p className="wsj-slate-pitch">
                      <b>Probables</b>{" "}
                      {game.away.pitcher || "TBD"} vs {game.home.pitcher || "TBD"}
                    </p>
                  ) : game.final ? (
                    <p className="wsj-slate-pitch">
                      <b>{game.away.abbrev}</b> {game.away.score} · <b>{game.home.abbrev}</b>{" "}
                      {game.home.score}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : page.clubs.some((club) => club.upcoming.length) ? (
            <div className="wsj-schedule-grid">
              {page.clubs.map((club) =>
                club.upcoming.length ? (
                  <div key={club.key} className="wsj-schedule-col">
                    <p className="wsj-kicker wsj-club-inline">
                      <TeamLogo src={club.logo} size="md" />
                      {club.shortName}
                    </p>
                    <ul className="wsj-slate graphic">
                      {club.upcoming.map((game) => (
                        <li key={game.id} className="me">
                          <span className="wsj-matchup">
                            <strong>{game.label}</strong>
                          </span>
                          <span className="wsj-match-meta">
                            {game.detail ? <em>{game.detail}</em> : <em />}
                            <strong>{game.when || "TBD"}</strong>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <p className="wsj-empty">No league games on today’s board.</p>
          )}
        </div>
        <p className="wsj-page-trail">
          <button type="button" className="wsj-jump-btn" onClick={() => onTurn(`${page.section}5`)}>
            Please turn to page {page.section}5 for {nextFocus}
          </button>
        </p>
      </div>
    );
  }

  if (page.focus === "playoffs") {
    return (
      <div className="wsj-sport focus-playoffs">
        <SportHero
          page={page}
          leagueClubs={leagueClubs}
          blurb={
            playoffs
              ? `${playoffs.season} postseason bracket · page ${page.folio}`
              : `Postseason bracket · page ${page.folio}`
          }
        />
        <div className="wsj-sport-solo">
          <PlayoffDesk tree={playoffs} />
        </div>
      </div>
    );
  }

  if (page.focus === "form") {
    return (
      <div className="wsj-sport focus-form">
        <SportHero
          page={page}
          leagueClubs={leagueClubs}
          blurb={`${leagueClubs.length || page.clubs.length} clubs · full league form · page ${page.folio}`}
        />
        <div className="wsj-sport-solo">
          {leagueClubs.length ? (
            <LeagueFormGrid clubs={leagueClubs} />
          ) : (
            <ClubFormGrid clubs={page.clubs} />
          )}
        </div>
      </div>
    );
  }

  // News + recaps — capped cards, no overlapping equal-height rows
  const isRecaps = page.focus === "recaps";
  const nextFolio = isRecaps ? `${page.section}3` : `${page.section}2`;
  const nextLabel = isRecaps ? "all teams" : "recaps";
  return (
    <div className={cn("wsj-sport", isRecaps ? "focus-recaps" : "focus-news")}>
      <SportHero
        page={page}
        leagueClubs={leagueClubs}
        blurb={
          page.articles.length
            ? `${page.articles.length} ${isRecaps ? "recaps" : "stories"} · turn to ${nextFolio} for ${nextLabel}`
            : `Wire quiet · turn to ${nextFolio} for ${nextLabel}`
        }
      />
      <div className="wsj-sport-solo news">
        {page.articles.length ? (
          <div className="wsj-news-grid fill">
            {page.articles.map(({ card, folio }) => {
              const href = card.gameHref || card.wrapHref || card.teamHref;
              const dek = recapDek(card);
              const crest =
                page.clubs.find((c) => c.key === card.favoriteKey)?.logo ||
                leagueClubs.find(
                  (c) =>
                    (c.favorite && card.teamName?.includes(c.short)) ||
                    card.teamName?.toLowerCase().includes(c.short.toLowerCase()),
                )?.logo;
              return (
                <article
                  key={card.id}
                  className={cn("wsj-recap graphic packed", card.photo && "has-thumb")}
                >
                  {card.photo ? (
                    <img src={card.photo} alt="" className="wsj-recap-thumb" loading="lazy" />
                  ) : crest ? (
                    <TeamLogo src={crest} size="md" />
                  ) : null}
                  <div className="wsj-recap-copy">
                    <p className="wsj-kicker">
                      {card.teamName || card.sportLabel}
                      {card.scoreLine ? ` · ${card.scoreLine}` : ""}
                    </p>
                    <h3>
                      <ExternalOrLink href={href} className="wsj-a">
                        {card.headline}
                      </ExternalOrLink>
                    </h3>
                    {dek ? <p className="wsj-brief-dek">{dek}</p> : null}
                    {!dek ? <Prose card={card} cols={1} max={6} /> : null}
                    {card.leaders.length ? (
                      <p className="wsj-slate-pitch">
                        <b>Names</b>{" "}
                        {card.leaders
                          .slice(0, 3)
                          .map((l) => `${l.name} ${l.line}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                    <Jump folio={folio === page.folio ? undefined : folio} onTurn={onTurn} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : leagueClubs.length ? (
          <LeagueFormGrid clubs={leagueClubs} />
        ) : (
          <ClubFormGrid clubs={page.clubs} />
        )}
      </div>
      <p className="wsj-page-trail">
        <button type="button" className="wsj-jump-btn" onClick={() => onTurn(nextFolio)}>
          Please turn to page {nextFolio} for {nextLabel}
        </button>
      </p>
    </div>
  );
}

function LeagueFormGrid({ clubs }: { clubs: LeagueClub[] }) {
  const groups = new Map<string, LeagueClub[]>();
  for (const club of clubs) {
    const key = club.group || "League";
    const list = groups.get(key) ?? [];
    list.push(club);
    groups.set(key, list);
  }
  return (
    <div className="wsj-sport-solo" style={{ gap: "0.45rem" }}>
      {[...groups.entries()].map(([group, rows]) => (
        <div key={group}>
          {group && group !== "League" ? <p className="wsj-team-group-label">{group}</p> : null}
          <div className="wsj-league-form-grid">
            {rows.map((club) => (
              <div key={club.id} className={cn("wsj-league-form-card", club.favorite && "me")}>
                <TeamLogo src={club.logo} size="md" />
                <div>
                  <strong>{club.abbrev}</strong>
                  <em>
                    {club.record || "—"}
                    {club.rank ? ` · ${club.rank}` : ""}
                  </em>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayoffDesk({ tree }: { tree: MlbPlayoffTree | null }) {
  if (!tree || !tree.rounds.some((r) => r.series.length)) {
    return <p className="wsj-empty">Postseason bracket isn’t published yet.</p>;
  }
  return (
    <div className="wsj-playoff-desk">
      {tree.rounds.map((round) =>
        round.series.length ? (
          <section key={round.id} className="wsj-playoff-round">
            <h4>{round.label}</h4>
            <div className="wsj-playoff-grid">
              {round.series.map((series) => {
                const aW = series.away.wins;
                const hW = series.home.wins;
                return (
                  <article key={series.id} className="wsj-playoff-card">
                    <header>
                      <span>{series.label}</span>
                      <span>{series.seriesStatus || `Best of ${series.gamesInSeries}`}</span>
                    </header>
                    <div className={cn("wsj-playoff-side", aW > hW && "winner")}>
                      <TeamLogo
                        src={
                          series.away.teamId
                            ? `https://www.mlbstatic.com/team-logos/${series.away.teamId}.svg`
                            : null
                        }
                        size="sm"
                      />
                      <strong>{series.away.abbrev || series.away.name}</strong>
                      <span className="wins">{aW}</span>
                    </div>
                    <div className={cn("wsj-playoff-side", hW > aW && "winner")}>
                      <TeamLogo
                        src={
                          series.home.teamId
                            ? `https://www.mlbstatic.com/team-logos/${series.home.teamId}.svg`
                            : null
                        }
                        size="sm"
                      />
                      <strong>{series.home.abbrev || series.home.name}</strong>
                      <span className="wins">{hW}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}

function ClubFormGrid({ clubs }: { clubs: ClubDesk[] }) {
  if (!clubs.length) return <p className="wsj-empty">No clubs filed in this section yet.</p>;
  return (
    <div className="wsj-sport-form fill">
      {clubs.map((club) => (
        <article key={club.key} className="wsj-sport-form-card">
          <header className="wsj-sport-form-head">
            <TeamLogo src={club.logo} size="lg" />
            <div>
              <strong>{club.shortName}</strong>
              <em>
                {club.record || "—"}
                {club.standing ? ` · ${club.standing}` : ""}
              </em>
            </div>
          </header>
          {club.division.length ? (
            <AgateBox
              title={tableTitle(club.standing)}
              rows={club.division.map((row) => ({
                left: (
                  <span className="wsj-club-inline">
                    <TeamLogo src={row.logo} size="xs" />
                    <span>
                      {row.rank} {row.team}
                    </span>
                  </span>
                ),
                right: row.gb && row.gb !== "-" ? `${row.record} ${row.gb}` : row.record,
                me: row.me,
              }))}
            />
          ) : null}
          {club.stats.length ? (
            <AgateBox
              title="Season"
              rows={club.stats.slice(0, 6).map((s) => ({ left: s.label, right: s.value }))}
            />
          ) : null}
          {club.leaders.length ? (
            <AgateBox
              title="Names"
              rows={club.leaders.slice(0, 5).map((l) => ({ left: l.name, right: l.line }))}
            />
          ) : null}
          {club.upcoming.length ? (
            <ul className="wsj-slate graphic">
              {club.upcoming.map((game) => (
                <li key={game.id} className="me">
                  <span className="wsj-matchup">
                    <strong>{game.label}</strong>
                  </span>
                  <span className="wsj-match-meta">
                    {game.detail ? <em>{game.detail}</em> : <em />}
                    <strong>{game.when || "TBD"}</strong>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wsj-brief-dek">Nothing left on the calendar.</p>
          )}
        </article>
      ))}
    </div>
  );
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

  const newsQ = useQuery({
    queryKey: ["tt-news", day, favKeys],
    queryFn: () => fetchTeamArticles(teamFavs, day),
    enabled: teamFavs.length > 0,
    staleTime: 5 * 60_000,
  });

  const clubs = useMemo<ClubDesk[]>(
    () =>
      // teams already sorted by desk weight (Cardinals / Blues / Mizzou → Lions → Chiefs → soccer).
      teams.map((team) => {
        const path = leaguePathFromEspn(team.fav.espnPath);
        const upcoming = (team.detail?.upcoming ?? []).slice(0, 4).map((game) => ({
          id: `${team.fav.key}-${game.id}`,
          label: game.label,
          when: game.when,
          detail: game.detail,
        }));
        if (!upcoming.length && team.snap.nextGame && team.seasonState === "active") {
          upcoming.push({
            id: `${team.fav.key}-next`,
            label: team.snap.nextGame.label,
            when: team.snap.nextGame.when,
            detail: team.snap.nextGame.detail,
          });
        }
        const namedLeaders = [
          ...(team.detail?.hittingLeaders ?? []),
          ...(team.detail?.pitchingLeaders ?? []),
        ]
          .slice(0, 4)
          .map((leader) => ({
            name: leader.name,
            line: leader.line,
            href: leader.id ? playerHref(team.fav.espnPath, leader.id) : null,
          }));
        const division = tableWindow(
          (team.detail?.division ?? []).map((row) => ({
            rank: row.rank,
            team: row.team,
            record: row.record,
            gb: row.gb,
            me: row.isMe,
            teamId: row.teamId,
            logo: path ? espnTeamLogo(path, row.teamId) : null,
          })),
        );
        return {
          key: team.fav.key,
          shortName: team.snap.shortName || team.fav.shortName,
          logo: team.snap.logo || team.detail?.logo || null,
          leaguePath: path,
          record: clubRecord(team),
          standing: team.snap.standing,
          division,
          stats: team.teamStats,
          leaders: namedLeaders,
          upcoming,
        };
      }),
    [teams],
  );

  const sportPaths = useMemo(
    () =>
      [...new Set(clubs.map((c) => c.leaguePath).filter(Boolean) as string[])].sort(),
    [clubs],
  );

  const leagueNewsQ = useQuery({
    queryKey: ["tt-league-news", day, sportPaths.join("|")],
    queryFn: () => fetchLeagueArticles(sportPaths, day),
    enabled: sportPaths.length > 0,
    staleTime: 5 * 60_000,
  });

  const stories = useMemo(() => {
    const wire = wireStoryCards({
      games: wireQ.data?.games ?? [],
      favs: teamFavs,
      details: teamDetailsQ.data ?? [],
    });
    const clubCopy = mergeStoryCards(
      mergeStoryCards(wire, enrichedQ.data ?? teamCards),
      newsQ.data ?? [],
    );
    return mergeStoryCards(clubCopy, leagueNewsQ.data ?? []);
  }, [
    wireQ.data,
    teamFavs,
    teamDetailsQ.data,
    enrichedQ.data,
    teamCards,
    newsQ.data,
    leagueNewsQ.data,
  ]);

  const leagueClubsQ = useQuery({
    queryKey: ["tt-league-clubs", day, sportPaths.join("|")],
    queryFn: async () => {
      const entries = await Promise.all(
        sportPaths.map(async (path) => {
          const rows = await fetchLeagueClubs(path);
          return [path, markFavoriteClubs(rows, teamFavs, path)] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, LeagueClub[]>;
    },
    enabled: sportPaths.length > 0,
    staleTime: 30 * 60_000,
  });

  const leagueSlateQ = useQuery({
    queryKey: ["tt-league-slate", day, sportPaths.join("|")],
    queryFn: async () => {
      const entries = await Promise.all(
        sportPaths.map(async (path) => [path, await fetchLeagueSlate(path, day)] as const),
      );
      return Object.fromEntries(entries) as Record<string, LeagueSlateGame[]>;
    },
    enabled: sportPaths.length > 0,
    staleTime: 3 * 60_000,
  });

  const mlbPlayoffsQ = useQuery({
    queryKey: ["tt-mlb-playoffs", day],
    queryFn: () => fetchMlbPlayoffTree(),
    enabled: sportPaths.includes("baseball/mlb"),
    staleTime: 10 * 60_000,
  });

  /**
   * Only a game still being played on this edition's night belongs in the rail.
   * Next week's kickoff is the schedule, not tonight.
   */
  const tonight = useMemo(() => {
    const games = wireQ.data?.games ?? [];
    return games
      .filter(
        (g) =>
          g.live &&
          !g.preseason &&
          g.favoriteKeys.length > 0 &&
          editionCovers(g.startedAt, day),
      )
      .slice(0, 6);
  }, [wireQ.data, day]);

  const edition = useMemo(
    () => buildEdition({ stories, clubs, edition: day }),
    [stories, clubs, day],
  );
  const comingUp = useMemo(
    () =>
      clubs.flatMap((club) =>
        club.upcoming.slice(0, 1).map((game) => ({
          id: game.id,
          team: club.shortName,
          label: game.label,
          when: game.when,
        })),
      ),
    [clubs],
  );
  const pages = edition.pages;

  function folioOf(card: GameWrapCard): string {
    return edition.sportFolioByStory[card.id] ?? edition.favoriteFolioByStory[card.id] ?? "A1";
  }

  function goPage(idx: number) {
    const el = pagerRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(pages.length - 1, idx));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setPageIndex(next);
    const folio = pages[next]?.folio;
    if (folio && typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${folio}`);
    }
  }

  function goFolio(folio: string) {
    const idx = pages.findIndex((p) => p.folio === folio);
    if (idx >= 0) goPage(idx);
  }

  function goSection(code: string) {
    const section = edition.sections.find((s) => s.code === code);
    if (section) goPage(section.index);
  }

  useEffect(() => {
    if (!pages.length) return;
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (!hash) return;
    const idx = pages.findIndex((p) => p.folio === hash);
    if (idx >= 0) {
      const el = pagerRef.current;
      if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: "auto" });
      setPageIndex(idx);
    }
  }, [pages]);

  useEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      const idx = Math.round(el.scrollLeft / w);
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      setPageIndex(next);
      const folio = pages[next]?.folio;
      if (folio && typeof window !== "undefined" && window.location.hash !== `#${folio}`) {
        window.history.replaceState(null, "", `#${folio}`);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pages]);

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
    leagueClubsQ.isFetching ||
    leagueSlateQ.isFetching ||
    mlbPlayoffsQ.isFetching ||
    recap.isFetching ||
    wrapsQ.isFetching ||
    enrichedQ.isFetching ||
    newsQ.isFetching;

  async function onRefresh() {
    setDay(editionDay());
    await Promise.all([
      teamSnaps.refetch(),
      teamDetailsQ.refetch(),
      wireQ.refetch(),
      leagueClubsQ.refetch(),
      leagueSlateQ.refetch(),
      mlbPlayoffsQ.refetch(),
      recap.refetch(),
      wrapsQ.refetch(),
      enrichedQ.refetch(),
      newsQ.refetch(),
    ]);
  }

  const current = pages[pageIndex];
  const sectionIdx = edition.sections.findIndex((s) => s.code === current?.section);

  return (
    <div className="newspaper-root wsj-shell">
      <div className="wsj-chrome print:hidden">
        <div className="wsj-chrome-l">
          <strong>Thompson Times</strong>
          <span>
            {current
              ? `Section ${current.section} · ${current.sectionTitle} · ${current.folio}`
              : `Edition ${day}`}
          </span>
        </div>
        <div className="wsj-chrome-c">
          <button
            type="button"
            className="wsj-pager-btn"
            aria-label="Previous section"
            disabled={sectionIdx <= 0}
            onClick={() => {
              const prev = edition.sections[sectionIdx - 1];
              if (prev) goSection(prev.code);
            }}
            title="Previous section"
          >
            <ChevronLeft size={14} />
            <ChevronLeft size={14} className="-ml-2 opacity-60" />
          </button>
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
            {current?.folio ?? "A1"}
            <em>{current ? `${current.sectionPage}/${current.sectionCount}` : ""}</em>
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
          <button
            type="button"
            className="wsj-pager-btn"
            aria-label="Next section"
            disabled={sectionIdx < 0 || sectionIdx >= edition.sections.length - 1}
            onClick={() => {
              const next = edition.sections[sectionIdx + 1];
              if (next) goSection(next.code);
            }}
            title="Next section"
          >
            <ChevronRight size={14} className="-mr-2 opacity-60" />
            <ChevronRight size={14} />
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
        {pages.map((page) => (
          <section key={page.folio} className="wsj-page" aria-label={`Page ${page.folio}`}>
            <span className="wsj-tab">{page.folio}</span>
            <Nameplate day={day} page={page} />
            <div className="wsj-body">
              {page.kind === "favorites-front" ? (
                <FrontPage
                  lead={page.lead}
                  second={page.second}
                  third={page.third}
                  briefs={page.briefs}
                  teams={teams}
                  postseason={wireQ.data?.postseasonLeagues ?? []}
                  tonight={tonight}
                  comingUp={comingUp}
                  sections={edition.sections}
                  folioOf={folioOf}
                  onTurn={goFolio}
                  jumpFolio={page.jumpFolio}
                />
              ) : page.kind === "favorites-clubs" ? (
                <ClubsDesk teams={teams} />
              ) : page.kind === "favorites-form" ? (
                <div className="wsj-clubs-desk">
                  <header className="wsj-clubs-desk-head">
                    <h3>Club form</h3>
                    <p>
                      {page.clubs.length} clubs · standings, names, and what’s next · page {page.folio}
                    </p>
                  </header>
                  <ClubFormGrid clubs={page.clubs} />
                </div>
              ) : page.kind === "favorites-inside" ? (
                <InsidePage
                  primary={page.primary}
                  secondary={page.secondary}
                  briefs={page.briefs}
                  teams={teams}
                  jumpFolio={page.jumpFolio}
                  onTurn={goFolio}
                />
              ) : page.kind === "sport-front" ? (
                <SportFront
                  page={page}
                  leagueClubs={leagueClubsQ.data?.[page.path] ?? []}
                  slate={leagueSlateQ.data?.[page.path] ?? []}
                  playoffs={page.path === "baseball/mlb" ? mlbPlayoffsQ.data ?? null : null}
                  onTurn={goFolio}
                />
              ) : (
                <InsidePage
                  primary={page.primary}
                  secondary={page.secondary}
                  briefs={[]}
                  teams={teams.filter((t) => t.fav.espnPath.startsWith(`${page.path}/`))}
                  jumpFolio={page.jumpFolio}
                  onTurn={goFolio}
                />
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
