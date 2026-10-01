import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw, Share } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  editionCovers,
  editionDateline,
  editionDay,
  editionIssue,
  msUntilNextEdition,
  instantDay,
  isNewsMuted,
  romanNumeral,
  splitStoryCopy,
} from "@/lib/newspaper";
import { fetchLeagueArticles, fetchTeamArticles } from "@/lib/newspaper-news";
import {
  boxStoryCard,
  fetchSectionBoard,
  gameClock,
  fetchSectionStandings,
  type BoxGame,
  type SectionBoard,
  type StandGroup,
} from "@/lib/newspaper-box";
import { proseParas, tidy } from "@/lib/newspaper-copy";
import {
  MatchupCard,
  ScoreCard,
  ScoreStrip,
  StandingsTable,
  Decisions,
  Goals,
  Leaders,
  Linescore,
  MlbAgate,
} from "@/components/newspaper/BoxScore";
import { ReaderProvider } from "@/components/newspaper/PaperReader";
import { useReader } from "@/components/newspaper/reader-context";
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
  storyBodyForJump,
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
import { fetchRssArticle, fetchRssFeed, firstContentImageUrl, type RssArticle } from "@/lib/rss";
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

type ComingUp = {
  id: string;
  team: string;
  label: string;
  when: string | null;
  logo: string | null;
  color: string | null;
};

function ExternalOrLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className} style={style}>
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
  size?: "xs" | "sm" | "md" | "lg" | "xl";
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

/* ───────────────────────── color + copy helpers ───────────────────────── */

function hexColor(color: string | null | undefined): string | null {
  const c = (color ?? "").replace(/^#/, "").trim();
  return /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : null;
}

function teamColor(team: TeamInfobox | null | undefined): string | null {
  return hexColor(team?.snap.color) ?? hexColor(team?.fav.color);
}

/** Ink that reads on a panel of `color` — gold and yellow clubs take black. */
function inkOn(color: string): string {
  const n = Number.parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.36 ? "#14161b" : "#ffffff";
}

function tint(color: string | null | undefined): CSSProperties | undefined {
  if (!color) return undefined;
  return { ["--tt-team" as string]: color, ["--tt-on" as string]: inkOn(color) } as CSSProperties;
}

function squash(text: string | null | undefined): string {
  return (text ?? "").replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function gameState(status: string | null | undefined): string | null {
  if (!status) return null;
  if (/^(story|headlinenews|media|preview|recap|news)$/i.test(status.trim())) return null;
  return status;
}

function cardCopy(card: GameWrapCard): string {
  if (card.body && card.body.trim().length >= 40) return card.body.trim();
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
  return bits.join(" ").trim();
}

/** Copy that says more than the headline already does. */
function substantive(card: GameWrapCard, text: string): string {
  const t = squash(text);
  if (!t || t === squash(card.headline)) return "";
  return text;
}

function recapDek(card: GameWrapCard, sentences = 1): string {
  const raw = tidy((card.body || card.dek || "").replace(/\s+/g, " "));
  if (!raw || squash(raw) === squash(card.headline)) return "";
  const parts = raw.split(/(?<=[.!?])\s(?=["“A-Z0-9])/).slice(0, sentences);
  const out = parts.join(" ");
  return out.length > 260 ? `${out.slice(0, 257).trimEnd()}…` : out;
}

function dekFor(card: GameWrapCard, copy: string): string | null {
  const bracket = [card.round, card.series].filter(Boolean).join(" · ");
  if (bracket) return bracket;
  const dek = card.dek ? tidy(card.dek) : "";
  if (!dek) return null;
  const d = squash(dek);
  if (d === squash(card.headline)) return null;
  if (squash(copy).startsWith(d.slice(0, 48))) return null;
  return dek;
}

function kickerOf(card: GameWrapCard): string {
  const bits = [card.sportLabel];
  if (card.round) bits.push(card.round);
  else if (card.postseason) bits.push("Postseason");
  if (card.teamName) bits.push(card.teamName);
  return bits.join(" · ");
}

function clubRecord(team: TeamInfobox | null | undefined): string | null {
  if (!team) return null;
  const row = team.detail?.division?.find((r) => r.isMe);
  return row?.record || team.snap.record || null;
}

function tableWindow<T extends { me: boolean }>(rows: T[], size = 8): T[] {
  if (rows.length <= size) return rows;
  const me = rows.findIndex((row) => row.me);
  const start = me < 0 ? 0 : Math.max(0, Math.min(me - Math.floor(size / 2), rows.length - size));
  return rows.slice(start, start + size);
}

function tableTitle(standing: string | null): string {
  const place = standing?.match(/\bin\s+(.+)$/i)?.[1]?.trim();
  return place || "Table";
}

function teamLeaders(team: TeamInfobox | null | undefined) {
  return [...(team?.detail?.hittingLeaders ?? []), ...(team?.detail?.pitchingLeaders ?? [])].map(
    (l) => ({ name: l.name, line: l.line }),
  );
}

function teamForCard(teams: TeamInfobox[], card: GameWrapCard): TeamInfobox | null {
  return teams.find((t) => t.fav.key === card.favoriteKey) ?? null;
}

/**
 * Column count that leaves the fewest empty cells in the last row; the
 * earliest option wins ties, so pass the preferred count first.
 */
function balancedCols(n: number, options: number[]): number {
  if (n <= 0) return options[0] ?? 1;
  let best = options[0] ?? 1;
  let bestEmpty = Infinity;
  for (const c of options) {
    if (c > n) continue;
    const empty = (c - (n % c)) % c;
    if (empty < bestEmpty) {
      best = c;
      bestEmpty = empty;
    }
  }
  return bestEmpty === Infinity ? Math.max(1, n) : best;
}

/** How many leading cards take a double cell so the grid's last row closes. */
function doubleWide(n: number, cols: number): number {
  if (cols < 2) return 0;
  const empty = (cols - (n % cols)) % cols;
  return Math.min(empty, n);
}

function daysUntilIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

/** Clubs with no slate, or next tip more than six weeks out, print compact. */
function clubIsOffseason(team: TeamInfobox): boolean {
  const hasSlate = Boolean(team.snap.nextGame) || (team.detail?.upcoming?.length ?? 0) > 0;
  if (hasSlate) {
    const soon =
      team.detail?.upcoming?.find((g) => g.startIso)?.startIso ??
      team.detail?.upcoming?.[0]?.startIso ??
      null;
    const days = daysUntilIso(soon);
    // Only shelve when we know the wait is long — missing ISO keeps the full card.
    return days != null && days > 45;
  }
  return team.seasonState === "complete" || team.seasonState === "upcoming";
}

function clubCountdown(team: TeamInfobox): string {
  const next = team.detail?.upcoming?.[0] ?? null;
  const chip = team.snap.nextGame;
  const days = daysUntilIso(next?.startIso);
  if (days != null && days > 0) {
    const label = next?.label || chip?.label || "next tip";
    if (days === 1) return `Opens tomorrow · ${label}`;
    if (days < 14) return `${days} days · ${label}`;
    if (days < 60) return `${Math.round(days / 7)} weeks · ${label}`;
    return `${Math.round(days / 30)} months · ${label}`;
  }
  if (chip) return `Next ${chip.label}${chip.when ? ` · ${chip.when}` : ""}`;
  if (next) return `Next ${next.label}${next.when ? ` · ${next.when}` : ""}`;
  return "Offseason";
}

function nextLine(team: TeamInfobox): string {
  if (team.seasonState === "complete") return "Season complete";
  const chip = team.snap.nextGame;
  if (chip) return `${chip.label}${chip.when ? ` · ${chip.when}` : ""}`;
  const next = team.detail?.upcoming?.[0];
  if (next) return `${next.label}${next.when ? ` · ${next.when}` : ""}`;
  return team.snap.standing || "Offseason";
}

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

function pageLabel(page: EditionPage): string {
  switch (page.kind) {
    case "sport-front":
      return {
        news: "News",
        recaps: "Scores",
        teams: "Standings",
        schedule: "Schedule",
        playoffs: "Playoffs",
        form: "Club Form",
      }[page.focus];
    case "sport-inside":
    case "favorites-inside":
      return "Stories";
    case "favorites-clubs":
      return "Your Clubs";
    case "favorites-form":
      return "Club Form";
    case "favorites-continue":
      return "Continued";
    default:
      return "Front Page";
  }
}

/* ───────────────────────── mastheads ───────────────────────── */

function Masthead({
  day,
  page,
  clubs,
  live,
}: {
  day: string;
  page: EditionPage;
  clubs: number;
  live: number;
}) {
  const { volume, issue } = editionIssue(day);
  return (
    <header className="wsj-mast">
      <div className="wsj-mast-row">
        <div className="wsj-ear">
          <strong>Sports Final</strong>
          <span>All the scores fit to print</span>
        </div>
        <h1 className="wsj-nameplate">The Thompson Times</h1>
        <div className="wsj-ear right">
          <strong>{live ? `${live} live now` : "Late City Edition"}</strong>
          <span>{clubs} clubs on the desk</span>
        </div>
      </div>
      <div className="wsj-dateline-bar">
        <span>
          Vol. {romanNumeral(volume)} · No. {issue}
        </span>
        <span className="c">{editionDateline(day)}</span>
        <span className="r">
          Section {page.section} · {page.folio}
        </span>
      </div>
    </header>
  );
}

function RunningHead({ day, page }: { day: string; page: EditionPage }) {
  return (
    <header className="wsj-run">
      <span className="wsj-run-plate">The Thompson Times</span>
      <span className="wsj-run-section">
        <b>{page.section}</b>
        <span>{page.sectionTitle}</span>
        <em>{pageLabel(page)}</em>
      </span>
      <span className="wsj-run-folio">
        {editionDateline(day)}
        <b>{page.folio}</b>
      </span>
    </header>
  );
}

/* ───────────────────────── story parts ───────────────────────── */

function Kicker({ card }: { card: GameWrapCard }) {
  return <p className="wsj-kicker">{kickerOf(card)}</p>;
}

/** Finds the box score behind a story, so the reader can set it with the copy. */
const GameLookup = createContext<(card: GameWrapCard) => BoxGame | null>(() => null);

/** A headline opens the story in the paper's reader, never the publisher's site. */
function StoryLink({
  card,
  game,
  color,
  className,
  children,
}: {
  card: GameWrapCard;
  game?: BoxGame | null;
  color?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const open = useReader();
  const lookup = useContext(GameLookup);
  return (
    <button
      type="button"
      className={cn("wsj-a wsj-story-link", className)}
      onClick={() => open({ card, game: game ?? lookup(card), color })}
    >
      {children}
    </button>
  );
}

function Headline({
  card,
  size,
  game,
}: {
  card: GameWrapCard;
  size: "xl" | "lg" | "md" | "sm";
  game?: BoxGame | null;
}) {
  return (
    <>
      <Kicker card={card} />
      <h2 className={cn("wsj-hl", size)}>
        <StoryLink card={card} game={game}>
          {card.headline}
        </StoryLink>
      </h2>
    </>
  );
}

function ReadOn({ card, game, label = "Read the full story" }: { card: GameWrapCard; game?: BoxGame | null; label?: string }) {
  return (
    <p className="wsj-jump">
      <StoryLink card={card} game={game} className="wsj-jump-btn">
        {label} <span aria-hidden="true">→</span>
      </StoryLink>
    </p>
  );
}

function Byline({ card }: { card: GameWrapCard }) {
  return (
    <p className="wsj-byline">
      <em>By</em> {card.sportLabel} Wire
      {card.followed || card.favoriteKey ? ` · ${card.teamName} Desk` : ""}
    </p>
  );
}

function ScoreBug({ card }: { card: GameWrapCard }) {
  if (!card.scoreLine || !/\d/.test(card.scoreLine)) return null;
  const state = gameState(card.status);
  return (
    <p className="wsj-scorebug">
      {state ? <b>{state}</b> : null}
      <span>{card.scoreLine}</span>
    </p>
  );
}

function Prose({
  card,
  text,
  cols,
  drop,
  max,
}: {
  card: GameWrapCard;
  text: string;
  cols: 1 | 2 | 3;
  drop?: boolean;
  max?: number;
}) {
  const paras = proseParas(text, max);
  if (!paras.length) return null;
  const length = paras.reduce((n, p) => n + p.length, 0);
  // Short copy never splits into slivers of two-line columns.
  const fit = Math.max(1, Math.min(cols, Math.floor(length / 360))) as 1 | 2 | 3;
  return (
    <div className={cn("wsj-prose", `c${fit}`, drop && "drop")}>
      {paras.map((p, i) => (
        <p key={i}>
          {i === 0 && card.dateline ? <span className="wsj-dateline">{card.dateline} — </span> : null}
          {p}
        </p>
      ))}
    </div>
  );
}

function Jump({
  folio,
  onTurn,
  label,
}: {
  folio?: string;
  onTurn?: (folio: string) => void;
  label?: string;
}) {
  if (!folio || !onTurn) return null;
  return (
    <p className="wsj-jump">
      <button type="button" className="wsj-jump-btn" onClick={() => onTurn(folio)}>
        {label ?? `Continued on page ${folio}`} <span aria-hidden="true">→</span>
      </button>
    </p>
  );
}

function Cut({ card, shape = "wide" }: { card: GameWrapCard; shape?: "wide" | "tall" | "square" }) {
  if (!card.photo) return null;
  const caption =
    card.caption && squash(card.caption) !== squash(card.teamName) ? card.caption : null;
  return (
    <figure className={cn("wsj-cut", shape)}>
      <img src={card.photo} alt="" loading="lazy" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * The club's numbers, set as a team-colored poster. It stands in for the
 * photograph when the wire sends none, so it prints once per page at most.
 */
function StatPoster({
  team,
  card,
  layout = "block",
}: {
  team: TeamInfobox | null;
  card?: GameWrapCard | null;
  layout?: "block" | "band";
}) {
  const logo = team?.snap.logo || team?.detail?.logo || null;
  const stats = (card?.teamStats.length ? card.teamStats : team?.teamStats ?? []).slice(
    0,
    layout === "band" ? 8 : 6,
  );
  const leaders = (card?.leaders.length ? card.leaders : teamLeaders(team)).slice(
    0,
    layout === "band" ? 5 : 4,
  );
  if (!team && !stats.length) return null;
  const name = team?.snap.shortName || team?.fav.shortName || card?.teamName || "";
  const record = clubRecord(team);
  return (
    <figure className={cn("wsj-poster", layout)} style={tint(teamColor(team))}>
      {logo ? <img className="wsj-poster-mark" src={logo} alt="" aria-hidden="true" /> : null}
      <div className="wsj-poster-id">
        {logo ? (
          <span className="wsj-poster-disc">
            <img src={logo} alt="" />
          </span>
        ) : null}
        <div>
          <span className="wsj-poster-lg">
            {team?.fav.league}
            {team?.seasonState === "complete" ? " · Season complete" : ""}
          </span>
          <strong>{name}</strong>
          <em>
            {record || "—"}
            {team?.snap.standing ? ` · ${team.snap.standing}` : ""}
          </em>
        </div>
      </div>
      {stats.length ? (
        <dl className="wsj-poster-stats">
          {stats.map((s) => (
            <div key={`${s.label}-${s.value}`}>
              <dd>{s.value}</dd>
              <dt>{s.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      {leaders.length ? (
        <ul className="wsj-poster-names">
          {leaders.map((l) => (
            <li key={l.name}>
              <strong>{l.name}</strong>
              <span>{l.line}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

type ArtMode = "top" | "side" | "none";

/** Photo when the wire has one; the club poster when asked; otherwise type only. */
function Story({
  card,
  team,
  text,
  size,
  cols = 1,
  art = "top",
  poster,
  drop,
  jump,
  onTurn,
  max,
  className,
  readOn,
  game,
}: {
  card: GameWrapCard;
  team?: TeamInfobox | null;
  text?: string;
  size: "xl" | "lg" | "md" | "sm";
  cols?: 1 | 2 | 3;
  art?: ArtMode;
  poster?: boolean;
  drop?: boolean;
  jump?: string;
  onTurn?: (folio: string) => void;
  max?: number;
  className?: string;
  /** Offer the whole story in the reader when this page sets only part of it. */
  readOn?: boolean;
  game?: BoxGame | null;
}) {
  const copy = substantive(card, text ?? cardCopy(card));
  const dek = dekFor(card, copy);
  const artNode =
    art === "none" ? null : card.photo ? (
      <Cut card={card} shape={art === "side" && copy.length > 450 ? "square" : "wide"} />
    ) : poster ? (
      <StatPoster team={team ?? null} card={card} />
    ) : null;
  return (
    <article
      className={cn(
        "wsj-story",
        artNode ? `art-${art}` : "art-none",
        artNode && !copy && !dek && "bare",
        className,
      )}
      style={tint(teamColor(team))}
    >
      {artNode ? <div className="wsj-story-art">{artNode}</div> : null}
      <div className="wsj-story-copy">
        <Headline card={card} size={size} game={game} />
        {dek ? <p className="wsj-dek">{dek}</p> : null}
        <ScoreBug card={card} />
        <Byline card={card} />
        {copy ? <Prose card={card} text={copy} cols={cols} drop={drop} max={max} /> : null}
        <Jump folio={jump} onTurn={onTurn} />
        {readOn && !(jump && onTurn) ? <ReadOn card={card} game={game} /> : null}
      </div>
    </article>
  );
}

/** Wide photo for long copy; photo beside the type when the copy is short. */
function artFor(card: GameWrapCard, text: string): { art: ArtMode; cols: 1 | 2 | 3 } {
  const len = text.length;
  if (!card.photo) return { art: "top", cols: len > 1400 ? 3 : len > 500 ? 2 : 1 };
  if (len > 1400) return { art: "top", cols: 3 };
  return { art: "side", cols: len > 700 ? 2 : 1 };
}

/* ───────────────────────── briefs ───────────────────────── */

function Brief({
  card,
  featured,
  folio,
  onTurn,
  crest,
  color,
}: {
  card: GameWrapCard;
  featured?: boolean;
  folio?: string;
  onTurn?: (folio: string) => void;
  crest?: string | null;
  color?: string | null;
}) {
  const dek = recapDek(card, featured ? 2 : 1);
  return (
    <article
      className={cn("wsj-brief", featured && "featured", (card.photo || crest) && "has-art")}
      style={tint(color)}
    >
      {card.photo ? (
        <img className="wsj-brief-photo" src={card.photo} alt="" loading="lazy" />
      ) : crest ? (
        <span className="wsj-brief-crest">
          <img src={crest} alt="" loading="lazy" />
        </span>
      ) : null}
      <div className="wsj-brief-copy">
        <Kicker card={card} />
        <h3>
          <StoryLink card={card} color={color}>
            {card.headline}
          </StoryLink>
        </h3>
        <ScoreBug card={card} />
        {dek ? <p className="wsj-brief-dek">{dek}</p> : null}
        <Jump folio={folio} onTurn={onTurn} label={folio ? `Page ${folio}` : undefined} />
      </div>
    </article>
  );
}

function BriefGrid({
  cards,
  title,
  folios,
  here,
  onTurn,
  crestFor,
  colorFor,
  maxCols = 4,
}: {
  cards: GameWrapCard[];
  title?: string;
  folios?: Record<string, string>;
  here?: string;
  onTurn?: (folio: string) => void;
  crestFor?: (card: GameWrapCard) => string | null | undefined;
  colorFor?: (card: GameWrapCard) => string | null | undefined;
  maxCols?: number;
}) {
  if (!cards.length) return null;
  const cols = Math.min(maxCols, cards.length);
  // A lone brief sets across the page, photo beside the type.
  const wide = cards.length === 1 ? 1 : doubleWide(cards.length, cols);
  return (
    <section className="wsj-briefs-wrap">
      {title ? <h3 className="wsj-band-title">{title}</h3> : null}
      <div className="wsj-briefs" style={{ ["--cols" as string]: String(cols) }}>
        {cards.map((c, i) => {
          const folio = folios?.[c.id];
          return (
            <Brief
              key={c.id}
              card={c}
              featured={i < wide}
              folio={folio && folio !== here ? folio : undefined}
              onTurn={onTurn}
              crest={crestFor?.(c)}
              color={colorFor?.(c)}
            />
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── club strips ───────────────────────── */

function FormDots({ form }: { form: TeamInfobox["form"] }) {
  if (!form.length) return null;
  return (
    <span className="wsj-form" aria-label={`Last ${form.length}: ${form.join(" ")}`}>
      {form.slice(-5).map((f, i) => (
        <i key={i} className={f === "W" ? "w" : f === "L" ? "l" : ""} />
      ))}
    </span>
  );
}

/** Closes a club grid's short last row with a turn to the clubs desk. */
function DeskFiller({
  count,
  cols,
  onTurn,
}: {
  count: number;
  cols: number;
  onTurn?: (folio: string) => void;
}) {
  const empty = (cols - (count % cols)) % cols;
  if (!empty || !onTurn) return null;
  return (
    <li className="wsj-filler" style={{ gridColumn: `span ${empty}` }}>
      <button type="button" onClick={() => onTurn("A2")}>
        <strong>The clubs desk</strong>
        <span>
          Slates, tables &amp; leaders · <b>Page A2 →</b>
        </span>
      </button>
    </li>
  );
}

/** The front's scoreboard: every club, its record, its last five. */
function ClubTicker({ teams, onTurn }: { teams: TeamInfobox[]; onTurn?: (folio: string) => void }) {
  if (!teams.length) return null;
  const cols = balancedCols(teams.length, [6, 5, 4, 7, 3]);
  return (
    <ul className="wsj-ticker" style={{ ["--cols" as string]: String(cols) }}>
      {teams.map((t) => (
        <li key={t.fav.key} style={tint(teamColor(t))}>
          <ExternalOrLink href={t.href} className="wsj-ticker-cell wsj-a">
            <TeamLogo src={t.snap.logo || t.detail?.logo} size="sm" />
            <span className="wsj-ticker-id">
              <strong>{t.fav.shortName}</strong>
              <em>{t.snap.standing || t.fav.league}</em>
            </span>
            <span className="wsj-ticker-rec">
              <b>{clubRecord(t) || "—"}</b>
              <FormDots form={t.form} />
            </span>
          </ExternalOrLink>
        </li>
      ))}
      <DeskFiller count={teams.length} cols={cols} onTurn={onTurn} />
    </ul>
  );
}

/** Foot-of-page board so an inside folio always closes on the clubs. */
function DeskBoard({
  teams,
  title = "Around the desk",
  onTurn,
}: {
  teams: TeamInfobox[];
  title?: string;
  onTurn?: (folio: string) => void;
}) {
  if (!teams.length) return null;
  const cols = teams.length < 4 ? 4 : balancedCols(teams.length, [6, 5, 4, 3, 2]);
  return (
    <section className="wsj-deskboard">
      <h3 className="wsj-band-title">{title}</h3>
      <ul style={{ ["--cols" as string]: String(cols) }}>
        {teams.map((t) => (
          <li key={t.fav.key} style={tint(teamColor(t))}>
            <ExternalOrLink href={t.href} className="wsj-desk-tile wsj-a">
              <TeamLogo src={t.snap.logo || t.detail?.logo} size="sm" />
              <strong className="wsj-desk-name">{t.fav.shortName}</strong>
              <em className="wsj-desk-lg">{t.fav.league}</em>
              <b className="wsj-desk-rec">{clubRecord(t) || "—"}</b>
              <span className="wsj-desk-next">{nextLine(t)}</span>
            </ExternalOrLink>
          </li>
        ))}
        <DeskFiller count={teams.length} cols={cols} onTurn={onTurn} />
      </ul>
    </section>
  );
}

/* ───────────────────────── agate ───────────────────────── */

function AgateBox({
  title,
  rows,
  color,
}: {
  title: ReactNode;
  rows: { left: ReactNode; right?: ReactNode; me?: boolean }[];
  color?: string | null;
}) {
  if (!rows.length) return null;
  return (
    <div className="wsj-box" style={tint(color)}>
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

/* ───────────────────────── front page ───────────────────────── */

function FrontRail({
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
  comingUp: ComingUp[];
  sections: EditionSection[];
  onTurn: (folio: string) => void;
}) {
  const sports = sections.filter((s) => s.code !== "A");
  const closed = teams.filter((t) => t.seasonState === "complete");
  const tables = teams
    .filter((t) => t.seasonState !== "complete" && (t.detail?.division?.length ?? 0) > 1)
    .slice(0, 2);
  return (
    <aside className="wsj-rail">
      {sports.length ? (
        <section className="wsj-rail-block ink">
          <h3>Inside Today</h3>
          <ul className="wsj-index">
            {sports.map((s) => (
              <li key={s.code}>
                <button type="button" onClick={() => onTurn(s.folio)}>
                  <span className="code">{s.code}</span>
                  <span className="t">
                    <strong>{s.title}</strong>
                    <em>
                      {s.stories
                        ? `${s.stories} ${s.stories === 1 ? "story" : "stories"}`
                        : "Standings & schedule"}{" "}
                      · {s.pages} pp.
                    </em>
                  </span>
                  <span className="f">{s.folio}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {postseason.length || tonight.length ? (
        <section className="wsj-rail-block">
          <h3>
            <span className="wsj-live-dot" aria-hidden="true" />
            {tonight.length ? "Live" : "Postseason"}
          </h3>
          <ul className="wsj-rail-list">
            {postseason.map((league) => (
              <li key={`post-${league}`}>
                <strong>{league}</strong> is in the postseason — bracket games lead the wire.
              </li>
            ))}
            {tonight.map((g) => (
              <li key={g.id}>
                <ExternalOrLink href={g.href} className="wsj-a">
                  <strong>
                    {g.away.short} at {g.home.short}
                  </strong>
                </ExternalOrLink>{" "}
                <span className="wsj-ref">{g.live ? g.statusDetail : faceOff(g.startedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {comingUp.length ? (
        <section className="wsj-rail-block">
          <h3>Coming Up</h3>
          <ul className="wsj-upcoming">
            {comingUp.map((g) => (
              <li key={g.id} style={tint(g.color)}>
                <TeamLogo src={g.logo} size="xs" />
                <span className="t">
                  <strong>{g.team}</strong> {g.label}
                </span>
                <em>{g.when || "TBD"}</em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tables.map((t) => (
        <AgateBox
          key={`table-${t.fav.key}`}
          color={teamColor(t)}
          title={`${t.fav.shortName} · ${tableTitle(t.snap.standing)}`}
          rows={tableWindow(
            (t.detail?.division ?? []).map((row) => ({
              rank: row.rank,
              team: row.team,
              record: row.record,
              me: row.isMe,
            })),
            6,
          ).map((row) => ({ left: `${row.rank}. ${row.team}`, right: row.record, me: row.me }))}
        />
      ))}

      {closed.length ? (
        <section className="wsj-rail-block">
          <h3>Season Complete</h3>
          <ul className="wsj-rail-list">
            {closed.map((t) => (
              <li key={t.fav.key}>
                <ExternalOrLink href={t.href} className="wsj-a">
                  <strong>{t.fav.shortName}</strong>
                </ExternalOrLink>{" "}
                finished {t.snap.record || "—"}
                {t.snap.standing ? `, ${t.snap.standing}` : ""}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

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
  folios,
  onTurn,
  leadContinue,
  secondContinue,
  thirdContinue,
  leadTeaser,
  secondTeaser,
  thirdTeaser,
}: {
  lead: GameWrapCard | null;
  second: GameWrapCard | null;
  third: GameWrapCard | null;
  briefs: GameWrapCard[];
  teams: TeamInfobox[];
  postseason: string[];
  tonight: WireGame[];
  comingUp: ComingUp[];
  sections: EditionSection[];
  folios: Record<string, string>;
  onTurn: (folio: string) => void;
  leadContinue?: string;
  secondContinue?: string;
  thirdContinue?: string;
  leadTeaser?: string;
  secondTeaser?: string;
  thirdTeaser?: string;
}) {
  const rail = (
    <FrontRail
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
        <ClubTicker teams={teams} onTurn={onTurn} />
        <div className="wsj-front-grid">
          <div className="wsj-front-main">
            <p className="wsj-empty">
              No fresh copy on your clubs this morning. The clubs desk is on page A2, and every
              sport section follows.
            </p>
            {teams[0] ? <StatPoster team={teams[0]} /> : null}
          </div>
          {rail}
        </div>
        <DeskBoard teams={teams} onTurn={onTurn} />
      </div>
    );
  }

  const copyOf = (card: GameWrapCard, teaser?: string) =>
    teaser || storyBodyForJump(card) || cardCopy(card);

  // The club poster stands in for a missing photo, once per club on the page.
  const postered = new Set<string>();
  const wantsPoster = (card: GameWrapCard | null) => {
    if (!card || card.photo) return false;
    const team = teamForCard(teams, card);
    if (!team || postered.has(team.fav.key)) return false;
    postered.add(team.fav.key);
    return true;
  };
  const leadPoster = wantsPoster(lead);
  const secondPoster = wantsPoster(second);
  const thirdPoster = wantsPoster(third);
  const thin = (card: GameWrapCard | null, teaser: string | undefined, poster: boolean) =>
    Boolean(card && !card.photo && !poster && !substantive(card, copyOf(card, teaser)));
  const stack =
    Boolean(second && third) &&
    (thin(second, secondTeaser, secondPoster) || thin(third, thirdTeaser, thirdPoster));

  return (
    <div className="wsj-front">
      <ClubTicker teams={teams} onTurn={onTurn} />
      <div className="wsj-front-grid">
        <div className="wsj-front-main">
          <Story
            className="lead"
            card={lead}
            team={teamForCard(teams, lead)}
            text={copyOf(lead, leadTeaser)}
            size="xl"
            cols={2}
            art="top"
            poster={leadPoster}
            drop
            jump={leadContinue}
            onTurn={onTurn}
          />
          {second || third ? (
            <div className={cn("wsj-front-row", stack ? "stack" : second && third ? "two" : "one")}>
              {second ? (
                <Story
                  card={second}
                  team={teamForCard(teams, second)}
                  text={copyOf(second, secondTeaser)}
                  size="lg"
                  cols={second.photo || secondPoster ? 1 : 2}
                  art={stack ? "side" : "top"}
                  poster={secondPoster}
                  jump={secondContinue}
                  onTurn={onTurn}
                />
              ) : null}
              {third ? (
                <Story
                  card={third}
                  team={teamForCard(teams, third)}
                  text={copyOf(third, thirdTeaser)}
                  size="md"
                  cols={stack ? 2 : 1}
                  art={stack ? "side" : "top"}
                  poster={thirdPoster}
                  jump={thirdContinue}
                  onTurn={onTurn}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        {rail}
      </div>
      <BriefGrid
        cards={briefs}
        title="More from your clubs"
        folios={folios}
        here="A1"
        onTurn={onTurn}
        crestFor={(c) => {
          const t = teamForCard(teams, c);
          return t?.snap.logo || t?.detail?.logo;
        }}
        colorFor={(c) => teamColor(teamForCard(teams, c))}
      />
      <TurnBar onTurn={onTurn} folio="A2" label="The clubs desk — every slate, table and leader" />
    </div>
  );
}

function TurnBar({
  onTurn,
  folio,
  label,
}: {
  onTurn: (folio: string) => void;
  folio: string;
  label: string;
}) {
  return (
    <p className="wsj-page-trail">
      <button type="button" className="wsj-jump-btn" onClick={() => onTurn(folio)}>
        <span>{label}</span>
        <b>
          Page {folio} <span aria-hidden="true">→</span>
        </b>
      </button>
    </p>
  );
}

/* ───────────────────────── clubs desk ───────────────────────── */

function ClubsDesk({ teams }: { teams: TeamInfobox[] }) {
  const active = teams.filter((t) => !clubIsOffseason(t));
  const shelved = teams.filter((t) => clubIsOffseason(t));
  const cols = balancedCols(active.length, [5, 4, 3, 6, 2]);
  return (
    <div className="wsj-clubs-desk">
      <header className="wsj-desk-head">
        <h2>Your Clubs</h2>
        <p>
          {active.length} in season · {shelved.length} between seasons · next games, tables and
          leaders
        </p>
      </header>
      {active.length ? (
        <ul className="wsj-clubs-grid" style={{ ["--cols" as string]: String(cols) }}>
          {active.map((t) => {
            const slate = (t.detail?.upcoming ?? []).slice(0, 4);
            const table = tableWindow(
              (t.detail?.division ?? []).map((row) => ({
                rank: row.rank,
                team: row.team,
                record: row.record,
                me: row.isMe,
              })),
              5,
            );
            const leaders = teamLeaders(t).slice(0, 3);
            return (
              <li key={t.fav.key}>
                <ExternalOrLink href={t.href} className="wsj-club-card wsj-a" style={tint(teamColor(t))}>
                  <header className="wsj-club-card-head">
                    <span className="wsj-disc">
                      <TeamLogo src={t.snap.logo || t.detail?.logo} size="md" />
                    </span>
                    <span className="wsj-club-card-id">
                      <em>{t.fav.league}</em>
                      <strong>{t.fav.shortName}</strong>
                    </span>
                    <b>{clubRecord(t) || "—"}</b>
                  </header>
                  <div className="wsj-club-card-body">
                    <p className="wsj-club-card-standing">
                      <span>{t.snap.standing || "—"}</span>
                      <FormDots form={t.form} />
                    </p>
                    {slate.length || t.snap.nextGame ? (
                      <div className="wsj-club-card-sec">
                        <h4>Next up</h4>
                        <ul className="wsj-club-slate">
                          {(slate.length
                            ? slate
                            : [{ id: "next", when: t.snap.nextGame!.when, label: t.snap.nextGame!.label, detail: null }]
                          ).map((game, i) => (
                            <li key={game.id || `${t.fav.key}-u-${i}`}>
                              <strong>{game.label}</strong>
                              <span>{game.when || "TBD"}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {table.length ? (
                      <div className="wsj-club-card-sec">
                        <h4>{tableTitle(t.snap.standing)}</h4>
                        <ul className="wsj-club-table">
                          {table.map((row) => (
                            <li key={`${row.rank}-${row.team}`} className={cn(row.me && "me")}>
                              <span>
                                {row.rank}. {row.team}
                              </span>
                              <b>{row.record}</b>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {leaders.length ? (
                      <div className="wsj-club-card-sec">
                        <h4>Leaders</h4>
                        <ul className="wsj-club-table">
                          {leaders.map((leader) => (
                            <li key={leader.name}>
                              <span>{leader.name}</span>
                              <em>{leader.line}</em>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </ExternalOrLink>
              </li>
            );
          })}
        </ul>
      ) : null}
      {shelved.length ? (
        <section>
          <h3 className="wsj-band-title">Between seasons</h3>
          <ul
            className="wsj-shelved"
            style={{ ["--cols" as string]: String(balancedCols(shelved.length, [4, 3, 5, 2])) }}
          >
            {shelved.map((t) => (
              <li key={t.fav.key} style={tint(teamColor(t))}>
                <ExternalOrLink href={t.href} className="wsj-shelved-card wsj-a">
                  <TeamLogo src={t.snap.logo || t.detail?.logo} size="lg" />
                  <span>
                    <strong>{t.fav.shortName}</strong>
                    <span>
                      {t.seasonState === "complete" ? "Final" : t.fav.league} · {clubRecord(t) || "—"}
                      {t.snap.standing ? ` · ${t.snap.standing}` : ""}
                    </span>
                    <em>{clubCountdown(t)}</em>
                  </span>
                </ExternalOrLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ───────────────────────── inside pages ───────────────────────── */

function InsidePage({
  primary,
  secondary,
  briefs,
  teams,
  folios,
  here,
  onTurn,
  notebooks = [],
}: {
  primary: GameWrapCard;
  secondary?: GameWrapCard;
  briefs: GameWrapCard[];
  teams: TeamInfobox[];
  folios?: Record<string, string>;
  here: string;
  onTurn: (folio: string) => void;
  /** The club's numbers, printed on the first page that club appears. */
  notebooks?: TeamInfobox[];
}) {
  const stories = ([primary, secondary].filter(Boolean) as GameWrapCard[]).sort(
    (a, b) => substantive(b, cardCopy(b)).length - substantive(a, cardCopy(a)).length,
  );
  const lookup = useContext(GameLookup);
  return (
    <div className="wsj-inside">
      {stories.map((card, i) => {
        const team = teamForCard(teams, card);
        const text = cardCopy(card);
        const { art, cols } = artFor(card, text);
        const game = lookup(card);
        return (
          <div key={card.id} className="wsj-inside-story">
            <Story
              className={cn(i === 0 ? "primary" : "secondary")}
              card={card}
              team={team}
              text={text}
              size={i === 0 ? "xl" : "lg"}
              cols={cols}
              art={art}
              drop={i === 0}
              game={game}
            />
            {game ? <GameBox game={game} /> : null}
          </div>
        );
      })}
      <BriefGrid
        cards={briefs}
        title="In brief"
        folios={folios}
        here={here}
        onTurn={onTurn}
        crestFor={(c) => {
          const t = teamForCard(teams, c);
          return t?.snap.logo || t?.detail?.logo;
        }}
        colorFor={(c) => teamColor(teamForCard(teams, c))}
      />
      {notebooks.map((team) => (
        <StatPoster key={team.fav.key} team={team} layout="band" />
      ))}
    </div>
  );
}

/** Destination of a front-page jump — the rest of the article. */
function ContinuePage({
  jumps,
  continuedFrom,
  teams,
  notebooks,
  onTurn,
}: {
  jumps: { card: GameWrapCard; rest: string }[];
  continuedFrom: string;
  teams: TeamInfobox[];
  notebooks: TeamInfobox[];
  onTurn: (folio: string) => void;
}) {
  const lookup = useContext(GameLookup);
  return (
    <div className="wsj-continue">
      {jumps.map(({ card, rest }, i) => {
        const game = lookup(card);
        return (
          <div key={card.id} className="wsj-inside-story">
            <p className="wsj-continued-from">
              <button type="button" className="wsj-jump-btn" onClick={() => onTurn(continuedFrom)}>
                <span aria-hidden="true">←</span> Continued from page {continuedFrom}
              </button>
            </p>
            <Story
              className={i === 0 ? "primary" : "secondary"}
              card={card}
              team={teamForCard(teams, card)}
              text={rest}
              size={i === 0 ? "xl" : "lg"}
              cols={rest.length > 1400 ? 3 : rest.length > 500 ? 2 : 1}
              art="none"
              game={game}
            />
            {game ? <GameBox game={game} /> : null}
          </div>
        );
      })}
      {notebooks.map((team) => (
        <StatPoster key={team.fav.key} team={team} layout="band" />
      ))}
    </div>
  );
}

/** Linescore, decisions and the agate under a club story. */
function GameBox({ game, agate = true }: { game: BoxGame; agate?: boolean }) {
  return (
    <section className="tt-gamebox">
      <header>
        <b>{gameClock(game)}</b>
        <span>{[game.round, game.series, game.venue].filter(Boolean).join(" · ")}</span>
      </header>
      <div className="tt-gamebox-top">
        <Linescore game={game} />
        <div className="tt-gamebox-names">
          <Decisions game={game} faces />
          <Leaders game={game} max={3} />
          <Goals game={game} />
        </div>
      </div>
      {agate && game.path === "baseball/mlb" ? <MlbAgate game={game} /> : null}
    </section>
  );
}

/* ───────────────────────── sport section front ───────────────────────── */

type SportFrontPage = Extract<EditionPage, { kind: "sport-front" }>;

const FOCUS_TITLES: Record<SportFrontPage["focus"], string> = {
  news: "News",
  recaps: "Scores",
  teams: "Standings",
  schedule: "Schedule",
  playoffs: "Playoffs",
  form: "Club Form",
};

/** Section flag: big on the section front, a slim band on the desk pages behind it. */
function SportHero({
  page,
  leagueClubs,
  blurb,
}: {
  page: SportFrontPage;
  leagueClubs: LeagueClub[];
  blurb: string;
}) {
  if (page.focus !== "news") {
    return (
      <header className="wsj-sport-band">
        <span className="wsj-sport-code">{page.section}</span>
        <h3>
          {page.sectionTitle} <em>{FOCUS_TITLES[page.focus]}</em>
        </h3>
        <p>{blurb}</p>
      </header>
    );
  }
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
        {leagueClubs.slice(0, 32).map((club) => (
          <TeamLogo key={club.id} src={club.logo} size="sm" />
        ))}
      </div>
    </header>
  );
}

function involvesClub(game: BoxGame, clubs: ClubDesk[]): boolean {
  const names = clubs.map((c) => squash(c.shortName)).filter(Boolean);
  return [game.away, game.home].some((side) => {
    const s = squash(side.short);
    return names.some((n) => s === n || s.includes(n) || n.includes(s));
  });
}

/** League news front: last night's board, then the stories with their art. */
function SportNewsDesk({
  page,
  board,
  leagueClubs,
  onTurn,
}: {
  page: SportFrontPage;
  board: SectionBoard | null;
  leagueClubs: LeagueClub[];
  onTurn: (folio: string) => void;
}) {
  const open = useReader();
  const results = board?.results ?? [];
  const recent = page.path.startsWith("soccer/") || page.path.startsWith("football/") ? [...results].reverse() : results;
  const gameById = new Map<string, BoxGame>();
  // Recaps of games your clubs played run in Section A; the league desk takes the rest.
  const recapCards = recent
    .filter((g) => !involvesClub(g, page.clubs))
    .map((g) => {
      const card = boxStoryCard(g);
      if (card) gameById.set(card.id, g);
      return card;
    })
    .filter((c): c is GameWrapCard => Boolean(c && (c.photo || (c.body?.length ?? 0) > 300)));
  // The wire's rewrite of a game the box already carries is the same story twice.
  const covered = recent.filter((g) => g.recap);
  const retold = (card: GameWrapCard) => {
    const t = squash(card.teamName);
    const head = squash(card.headline);
    return covered.some((g) => {
      const [a, b] = [squash(g.away.short), squash(g.home.short)];
      const isA = Boolean(t && a && (t.includes(a) || a.includes(t)));
      const isB = Boolean(t && b && (t.includes(b) || b.includes(t)));
      if (!isA && !isB) return false;
      const other = isA ? b : a;
      return head.includes(other) || /\d+-\d+/.test(card.headline);
    });
  };
  const stories = dedupeByHead([
    ...recapCards,
    ...page.articles.map((a) => a.card).filter((c) => !retold(c)),
  ]);
  const folios = Object.fromEntries(page.articles.map((a) => [a.card.id, a.folio]));
  const withArt = stories.filter((c) => c.photo);
  const lead = withArt[0] ?? stories[0] ?? null;
  const seconds = stories.filter((c) => c !== lead && c.photo).slice(0, 2);
  const briefs = stories.filter((c) => c !== lead && !seconds.includes(c)).slice(0, 8);
  const crestFor = (card: GameWrapCard) =>
    leagueClubs.find((c) => c.short && card.teamName?.toLowerCase().includes(c.short.toLowerCase()))?.logo ?? null;

  return (
    <div className="wsj-sport-news">
      {recent.length ? (
        <section className="tt-strip-wrap">
          <h3 className="wsj-band-title">
            {page.path.startsWith("football/") ? "This week’s finals" : "Last night’s scores"}
            <button type="button" className="tt-band-link" onClick={() => onTurn(`${page.section}2`)}>
              Box scores, page {page.section}2 →
            </button>
          </h3>
          <ScoreStrip
            games={recent.slice(0, 16)}
            onOpen={(g) => {
              const card = boxStoryCard(g);
              if (card) open({ card, game: g });
              else onTurn(`${page.section}2`);
            }}
          />
        </section>
      ) : null}
      {lead ? (
        <div className={cn("wsj-sport-lead-grid", seconds.length ? "with-side" : "solo")}>
          <Story
            className="lead"
            card={lead}
            text={splitStoryCopy(cardCopy(lead), seconds.length ? 1500 : 1000).teaser}
            size="xl"
            cols={2}
            art="top"
            drop
            readOn
            game={gameById.get(lead.id) ?? null}
            jump={folios[lead.id] && folios[lead.id] !== page.folio ? folios[lead.id] : undefined}
            onTurn={onTurn}
          />
          {seconds.length ? (
            <div className="wsj-sport-seconds">
              {seconds.map((card) => (
                <Story
                  key={card.id}
                  card={card}
                  text={recapDek(card, 2)}
                  size="md"
                  art="top"
                  readOn
                  game={gameById.get(card.id) ?? null}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="wsj-empty">The league wire is quiet. Scores, tables and the slate follow.</p>
      )}
      <BriefGrid
        cards={briefs}
        title={briefs.length ? "Around the league" : undefined}
        folios={folios}
        here={page.folio}
        onTurn={onTurn}
        crestFor={crestFor}
      />
    </div>
  );
}

function dedupeByHead(cards: GameWrapCard[]): GameWrapCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    const k = squash(c.headline).slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Box scores: the best game set large with its recap, the rest in agate. */
function ScoresDesk({ page, board, active }: { page: SportFrontPage; board: SectionBoard | null; active: boolean }) {
  const open = useReader();
  const results = board?.results ?? [];
  const games = page.path.startsWith("soccer/") || page.path.startsWith("football/") ? [...results].reverse() : results;
  if (!board) return <p className="wsj-empty">Setting the box scores…</p>;
  if (!games.length) return <p className="wsj-empty">No finals on the board — the schedule is on page {page.section}4.</p>;
  const featured =
    games.find((g) => g.recap?.photo && !involvesClub(g, page.clubs)) ?? games.find((g) => g.recap) ?? games[0]!;
  const rest = games.filter((g) => g !== featured).slice(0, 18);
  const card = boxStoryCard(featured);
  const isMlb = page.path === "baseball/mlb";
  return (
    <div className="tt-scores">
      <article className="tt-feature">
        {featured.recap?.photo ? (
          <figure className="tt-feature-photo">
            <img src={featured.recap.photo} alt="" loading="lazy" />
            <figcaption>
              {featured.away.name} at {featured.home.name}
              {featured.venue ? `, ${featured.venue}` : ""}.
            </figcaption>
          </figure>
        ) : null}
        <div className="tt-feature-copy">
          <p className="wsj-kicker">
            {[featured.league, featured.round, featured.series].filter(Boolean).join(" · ")}
          </p>
          <h2 className="wsj-hl lg">
            {card ? (
              <button type="button" className="wsj-a wsj-story-link" onClick={() => open({ card, game: featured })}>
                {featured.recap!.headline}
              </button>
            ) : (
              `${featured.away.short} ${featured.away.score ?? ""}, ${featured.home.short} ${featured.home.score ?? ""}`
            )}
          </h2>
          {featured.recap?.blurb ? <p className="wsj-dek">{featured.recap.blurb}</p> : null}
          <Linescore game={featured} />
          <Decisions game={featured} faces />
          <Leaders game={featured} max={4} />
          <Goals game={featured} />
          {card ? (
            <p className="wsj-jump">
              <button type="button" className="wsj-jump-btn" onClick={() => open({ card, game: featured })}>
                Read the story <span aria-hidden="true">→</span>
              </button>
            </p>
          ) : null}
        </div>
      </article>
      {isMlb ? <MlbAgate game={featured} enabled={active} /> : null}
      {rest.length ? (
        <>
          <h3 className="wsj-band-title">{isMlb ? "Box scores" : "Results"}</h3>
          <div className={cn("tt-score-grid", isMlb && "agate")}>
            {rest.map((g) => (
              <ScoreCard
                key={g.id}
                game={g}
                agate={isMlb}
                agateEnabled={active}
                onOpen={(game) => {
                  const c = boxStoryCard(game);
                  if (c) open({ card: c, game });
                }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function dayHeading(day: string, edition: string): string {
  if (day === edition) return "Today";
  const d = new Date(`${day}T12:00:00Z`);
  const t = new Date(`${edition}T12:00:00Z`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}

function ScheduleDesk({
  page,
  board,
  slate,
  edition,
}: {
  page: SportFrontPage;
  board: SectionBoard | null;
  slate: LeagueSlateGame[];
  edition: string;
}) {
  const games = board?.slate ?? [];
  if (games.length) {
    const days = new Map<string, BoxGame[]>();
    for (const g of games.slice(0, 24)) {
      const list = days.get(g.day) ?? [];
      list.push(g);
      days.set(g.day, list);
    }
    return (
      <div className="tt-schedule">
        {[...days.entries()].map(([day, list]) => (
          <section key={day}>
            <h3 className="wsj-band-title">
              {dayHeading(day, edition)} <em>{list.length} {list.length === 1 ? "game" : "games"}</em>
            </h3>
            <div className="tt-matchups" style={{ ["--cols" as string]: String(balancedCols(list.length, [3, 2, 4])) }}>
              {list.map((g) => (
                <MatchupCard key={g.id} game={g} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }
  if (slate.length) {
    return (
      <div className="wsj-slate-board">
        {slate.map((game) => (
          <article key={game.id} className={cn("wsj-slate-card", game.live && "live")}>
            <div className="wsj-slate-card-top">
              <span>{game.round || game.venue || "Today"}</span>
              <strong>{game.live ? game.status : game.when || game.status}</strong>
            </div>
            {[game.away, game.home].map((side, i) => (
              <div key={i} className="wsj-slate-row">
                <TeamLogo src={side.logo} size="sm" />
                <div>
                  <strong>{side.abbrev}</strong>
                  {side.record ? <em>{side.record}</em> : null}
                </div>
                <span className="score">{side.score ?? ""}</span>
              </div>
            ))}
          </article>
        ))}
      </div>
    );
  }
  const clubs = page.clubs.filter((c) => c.upcoming.length);
  if (!clubs.length) return <p className="wsj-empty">Nothing on the league calendar this week.</p>;
  return (
    <div className="wsj-schedule-grid">
      {clubs.map((club) => (
        <div key={club.key} className="wsj-schedule-col" style={tint(club.color)}>
          <p className="wsj-schedule-head">
            <TeamLogo src={club.logo} size="md" />
            <strong>{club.shortName}</strong>
            <em>{club.record || ""}</em>
          </p>
          <ul className="wsj-club-slate">
            {club.upcoming.map((game) => (
              <li key={game.id}>
                <strong>{game.label}</strong>
                <span>{game.when || "TBD"}</span>
                {game.detail ? <em>{game.detail}</em> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StandingsDesk({
  page,
  standings,
  leagueClubs,
}: {
  page: SportFrontPage;
  standings: StandGroup[];
  leagueClubs: LeagueClub[];
}) {
  if (!standings.length) {
    return leagueClubs.length ? <LeagueFormGrid clubs={leagueClubs} /> : <ClubFormGrid clubs={page.clubs} />;
  }
  const favIds = new Set(leagueClubs.filter((c) => c.favorite).map((c) => c.id));
  const favNames = page.clubs.map((c) => squash(c.shortName));
  const mine = (row: { id: string; name: string }) =>
    favIds.has(row.id) || favNames.some((n) => n && squash(row.name) === n);
  const single = standings.length === 1;
  return (
    <div className={cn("tt-stand-grid", single && "single")}>
      {standings.map((group) => (
        <StandingsTable key={group.name} group={group} mine={mine} />
      ))}
    </div>
  );
}

function SportFront({
  page,
  leagueClubs,
  board,
  standings,
  slate,
  playoffs,
  edition,
  active,
  onTurn,
}: {
  page: SportFrontPage;
  leagueClubs: LeagueClub[];
  board: SectionBoard | null;
  standings: StandGroup[];
  slate: LeagueSlateGame[];
  playoffs: MlbPlayoffTree | null;
  edition: string;
  active: boolean;
  onTurn: (folio: string) => void;
}) {
  const isMlb = page.path === "baseball/mlb";
  const results = board?.results.length ?? 0;
  const upcoming = board?.slate.length ?? slate.length;
  const next: Record<SportFrontPage["focus"], { folio: string; label: string } | null> = {
    news: { folio: `${page.section}2`, label: "Scores and box scores" },
    recaps: { folio: `${page.section}3`, label: "The standings" },
    teams: { folio: `${page.section}4`, label: "The schedule" },
    schedule: { folio: `${page.section}5`, label: isMlb ? "The playoff bracket" : "Club form" },
    playoffs: null,
    form: null,
  };
  const blurb = {
    news: `${page.articles.length + results} stories and finals · ${leagueClubs.length || page.clubs.length} clubs`,
    recaps: results ? `${results} ${results === 1 ? "final" : "finals"} · lines, decisions and the agate` : "Box scores",
    teams: standings.length ? `${standings.length} ${standings.length === 1 ? "table" : "tables"} · your clubs marked` : "League tables",
    schedule: upcoming ? `${upcoming} games ahead · probables, TV and venues` : "League calendar",
    playoffs: playoffs ? `${playoffs.season} postseason bracket` : "Postseason bracket",
    form: `${page.clubs.length} followed ${page.clubs.length === 1 ? "club" : "clubs"} · tables, numbers, leaders`,
  }[page.focus];
  const turn = next[page.focus];

  return (
    <div className={cn("wsj-sport", `focus-${page.focus}`)}>
      <SportHero page={page} leagueClubs={leagueClubs} blurb={blurb} />
      <div className="wsj-sport-solo">
        {page.focus === "news" ? (
          <SportNewsDesk page={page} board={board} leagueClubs={leagueClubs} onTurn={onTurn} />
        ) : page.focus === "recaps" ? (
          <ScoresDesk page={page} board={board} active={active} />
        ) : page.focus === "teams" ? (
          <StandingsDesk page={page} standings={standings} leagueClubs={leagueClubs} />
        ) : page.focus === "schedule" ? (
          <ScheduleDesk page={page} board={board} slate={slate} edition={edition} />
        ) : page.focus === "playoffs" ? (
          <PlayoffDesk tree={playoffs} />
        ) : page.clubs.length ? (
          <ClubFormGrid clubs={page.clubs} />
        ) : (
          <LeagueFormGrid clubs={leagueClubs} />
        )}
      </div>
      {turn ? <TurnBar onTurn={onTurn} folio={turn.folio} label={turn.label} /> : null}
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
    <div className="wsj-team-groups">
      {[...groups.entries()].map(([group, rows]) => (
        <div key={group} className="wsj-team-group">
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
                    {[
                      { side: series.away, won: aW > hW, wins: aW },
                      { side: series.home, won: hW > aW, wins: hW },
                    ].map(({ side, won, wins }, i) => (
                      <div key={i} className={cn("wsj-playoff-side", won && "winner")}>
                        <TeamLogo
                          src={
                            side.teamId ? `https://www.mlbstatic.com/team-logos/${side.teamId}.svg` : null
                          }
                          size="sm"
                        />
                        <strong>{side.abbrev || side.name}</strong>
                        <span className="wins">{wins}</span>
                      </div>
                    ))}
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
    <div
      className="wsj-form-grid"
      style={{ ["--cols" as string]: String(balancedCols(clubs.length, [3, 2, 4])) }}
    >
      {clubs.map((club) => (
        <article key={club.key} className="wsj-form-card" style={tint(club.color)}>
          <header className="wsj-club-card-head">
            <span className="wsj-disc">
              <TeamLogo src={club.logo} size="md" />
            </span>
            <span className="wsj-club-card-id">
              <em>{club.standing || "—"}</em>
              <strong>{club.shortName}</strong>
            </span>
            <b>{club.record || "—"}</b>
          </header>
          <div className="wsj-form-card-body">
            {club.division.length ? (
              <AgateBox
                color={club.color}
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
              <dl className="wsj-form-stats">
                {club.stats.slice(0, 8).map((s) => (
                  <div key={`${s.label}-${s.value}`}>
                    <dd>{s.value}</dd>
                    <dt>{s.label}</dt>
                  </div>
                ))}
              </dl>
            ) : null}
            {club.leaders.length ? (
              <AgateBox
                color={club.color}
                title="Leaders"
                rows={club.leaders.slice(0, 5).map((l) => ({ left: l.name, right: l.line }))}
              />
            ) : null}
            {club.upcoming.length ? (
              <AgateBox
                color={club.color}
                title="Next up"
                rows={club.upcoming.map((game) => ({ left: game.label, right: game.when || "TBD" }))}
              />
            ) : (
              <p className="wsj-brief-dek">Nothing left on the calendar.</p>
            )}
          </div>
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
        const upcoming = (team.detail?.upcoming ?? []).slice(0, 5).map((game) => ({
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
          color: teamColor(team),
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

  const rawStories = useMemo(() => {
    const wire = wireStoryCards({
      games: wireQ.data?.games ?? [],
      favs: teamFavs,
      details: teamDetailsQ.data ?? [],
    });
    const clubCopy = mergeStoryCards(
      mergeStoryCards(wire, enrichedQ.data ?? teamCards),
      newsQ.data ?? [],
    );
    return mergeStoryCards(clubCopy, leagueNewsQ.data ?? []).filter((card) => !isNewsMuted(card));
  }, [
    wireQ.data,
    teamFavs,
    teamDetailsQ.data,
    enrichedQ.data,
    teamCards,
    newsQ.data,
    leagueNewsQ.data,
  ]);

  // Club feeds send a headline and a link. Dispatch's extractor sets the story
  // (and its photo) so Section A prints copy instead of a crest.
  const extractUrls = useMemo(
    () =>
      rawStories
        .filter(
          (card) =>
            (card.favoriteKey || card.followed) &&
            card.wrapHref &&
            /^https?:\/\//i.test(card.wrapHref) &&
            !/espn\.com\/.+\/(?:game|recap|preview|match)\b/i.test(card.wrapHref) &&
            ((card.body?.trim().length ?? 0) < 600 || !card.photo),
        )
        .map((card) => card.wrapHref!)
        .slice(0, 16),
    [rawStories],
  );
  const queryClient = useQueryClient();
  const extractsQ = useQuery({
    queryKey: ["tt-extracts", day, extractUrls.join("|")],
    queryFn: async () => {
      const out: Record<string, RssArticle> = {};
      let next = 0;
      const worker = async () => {
        while (next < extractUrls.length) {
          const url = extractUrls[next++]!;
          try {
            out[url] = await queryClient.fetchQuery({
              queryKey: ["rss-article-v3", url],
              queryFn: () => fetchRssArticle(url),
              staleTime: 10 * 60_000,
            });
          } catch {
            /* the brief runs as filed */
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      return out;
    },
    enabled: extractUrls.length > 0,
    staleTime: 10 * 60_000,
  });

  const stories = useMemo(() => {
    const extracts = extractsQ.data;
    if (!extracts) return rawStories;
    return rawStories.map((card) => {
      const hit = card.wrapHref ? extracts[card.wrapHref] : undefined;
      if (!hit) return card;
      const text = hit.contentText?.trim() ?? "";
      const body = text.length > (card.body?.trim().length ?? 0) + 120 ? text : card.body;
      return { ...card, body, photo: card.photo || hit.image || firstContentImageUrl(hit.contentHtml) };
    });
  }, [rawStories, extractsQ.data]);

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

  const boardQ = useQuery({
    queryKey: ["tt-board", day, sportPaths.join("|")],
    queryFn: async () => {
      const entries = await Promise.all(
        sportPaths.map(async (path) => {
          try {
            return [path, await fetchSectionBoard(path, day)] as const;
          } catch {
            return [path, { results: [], slate: [] }] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, SectionBoard>;
    },
    enabled: sportPaths.length > 0,
    staleTime: 3 * 60_000,
  });

  const standingsQ = useQuery({
    queryKey: ["tt-standings", day, sportPaths.join("|")],
    queryFn: async () => {
      const entries = await Promise.all(
        sportPaths.map(async (path) => [path, await fetchSectionStandings(path)] as const),
      );
      return Object.fromEntries(entries) as Record<string, StandGroup[]>;
    },
    enabled: sportPaths.length > 0,
    staleTime: 30 * 60_000,
  });

  /** Pairs a club story with the game it reports, so the reader can set the box. */
  const findGame = useCallback(
    (card: GameWrapCard): BoxGame | null => {
      const board = card.leaguePath ? boardQ.data?.[card.leaguePath] : undefined;
      if (!board) return null;
      const games = [...board.results, ...board.slate];
      if (card.gameId) {
        const hit = games.find(
          (g) => g.espnEventId === card.gameId || (g.gamePk != null && String(g.gamePk) === card.gameId),
        );
        if (hit) return hit;
      }
      const team = squash(card.teamName);
      if (!team || !card.when) return null;
      const day = instantDay(card.when);
      return (
        board.results.find(
          (g) =>
            [g.away, g.home].some((s) => {
              const n = squash(s.short);
              return n === team || n.includes(team) || team.includes(n);
            }) &&
            (g.day === day || Math.abs(new Date(g.startIso ?? 0).getTime() - new Date(card.when!).getTime()) < 30 * 3_600_000),
        ) ?? null
      );
    },
    [boardQ.data],
  );

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
  const comingUp = useMemo<ComingUp[]>(
    () =>
      clubs.flatMap((club) =>
        club.upcoming.slice(0, 1).map((game) => ({
          id: game.id,
          team: teams.find((t) => t.fav.key === club.key)?.fav.shortName || club.shortName,
          label: game.label,
          when: game.when,
          logo: club.logo,
          color: club.color ?? null,
        })),
      ),
    [clubs, teams],
  );
  const pages = edition.pages;
  // A club's numbers print once in Section A — on the first story page it owns.
  const notebookByFolio = useMemo(() => {
    const seen = new Set<string>();
    const out: Record<string, TeamInfobox[]> = {};
    for (const page of pages) {
      const cards =
        page.kind === "favorites-continue"
          ? page.jumps.map((j) => j.card)
          : page.kind === "favorites-inside"
            ? [page.primary, page.secondary].filter((c): c is GameWrapCard => Boolean(c))
            : [];
      for (const card of cards) {
        const team = teamForCard(teams, card);
        if (!team || seen.has(team.fav.key)) continue;
        seen.add(team.fav.key);
        (out[page.folio] ??= []).push(team);
      }
    }
    return out;
  }, [pages, teams]);

  function goPage(idx: number) {
    const el = pagerRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(pages.length - 1, idx));
    const sheet = el.children[next] as HTMLElement | undefined;
    if (sheet && next !== pageIndex) sheet.scrollTop = 0;
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
    boardQ.isFetching ||
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
      boardQ.refetch(),
      newsQ.refetch(),
    ]);
  }

  const current = pages[pageIndex];
  const sectionIdx = edition.sections.findIndex((s) => s.code === current?.section);

  return (
    <div className="newspaper-root wsj-shell">
      <GameLookup.Provider value={findGame}>
      <ReaderProvider>
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
        {pages.map((page, index) => (
          <section key={page.folio} className="wsj-page" aria-label={`Page ${page.folio}`}>
            <div className="wsj-sheet">
            {page.kind === "favorites-front" ? (
              <Masthead day={day} page={page} clubs={teams.length} live={tonight.length} />
            ) : (
              <RunningHead day={day} page={page} />
            )}
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
                  folios={edition.favoriteFolioByStory}
                  onTurn={goFolio}
                  leadContinue={page.leadContinue}
                  secondContinue={page.secondContinue}
                  thirdContinue={page.thirdContinue}
                  leadTeaser={page.leadTeaser}
                  secondTeaser={page.secondTeaser}
                  thirdTeaser={page.thirdTeaser}
                />
              ) : page.kind === "favorites-clubs" ? (
                <ClubsDesk teams={teams} />
              ) : page.kind === "favorites-form" ? (
                <div className="wsj-clubs-desk">
                  <header className="wsj-desk-head">
                    <h2>Club Form</h2>
                    <p>{page.clubs.length} clubs · standings, numbers, leaders and what’s next</p>
                  </header>
                  <ClubFormGrid clubs={page.clubs} />
                </div>
              ) : page.kind === "favorites-continue" ? (
                <ContinuePage
                  jumps={page.jumps}
                  continuedFrom={page.continuedFrom}
                  teams={teams}
                  notebooks={notebookByFolio[page.folio] ?? []}
                  onTurn={goFolio}
                />
              ) : page.kind === "favorites-inside" ? (
                <InsidePage
                  primary={page.primary}
                  secondary={page.secondary}
                  briefs={page.briefs}
                  teams={teams}
                  folios={edition.favoriteFolioByStory}
                  here={page.folio}
                  onTurn={goFolio}
                  notebooks={notebookByFolio[page.folio]}
                />
              ) : page.kind === "sport-front" ? (
                <SportFront
                  page={page}
                  leagueClubs={leagueClubsQ.data?.[page.path] ?? []}
                  board={boardQ.data?.[page.path] ?? null}
                  standings={standingsQ.data?.[page.path] ?? []}
                  slate={leagueSlateQ.data?.[page.path] ?? []}
                  playoffs={page.path === "baseball/mlb" ? mlbPlayoffsQ.data ?? null : null}
                  edition={day}
                  active={Math.abs(index - pageIndex) <= 1}
                  onTurn={goFolio}
                />
              ) : (
                <InsidePage
                  primary={page.primary}
                  secondary={page.secondary}
                  briefs={[]}
                  teams={[]}
                  here={page.folio}
                  onTurn={goFolio}
                />
              )}
            </div>
            </div>
          </section>
        ))}
      </div>
      </ReaderProvider>
      </GameLookup.Provider>
    </div>
  );
}
