import {
  createContext,
  Fragment,
  memo,
  startTransition,
  Suspense,
  use,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useQuery as useQueryBase,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { Bookmark, ChevronLeft, ChevronRight, Share } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  editionCovers,
  editionDateline,
  editionIssue,
  editionNewsDay,
  fileMissouriItems,
  missouriItemInEdition,
  msUntilNextPress,
  parsePressId,
  pressEdition,
  previousPressId,
  isDeskPress,
  romanNumeral,
  splitStoryCopy,
  storyReadKeys,
} from "@/lib/newspaper";
import {
  applyTableStandings,
  boxStoryCard,
  fetchCfbApPoll,
  fetchLeagueLeaders,
  fetchSectionBoard,
  formatFixtureWhen,
  gameClock,
  gameMatchesRecap,
  fetchSectionStandings,
  leaderCategoryLabel,
  leaderGroupHasValidData,
  rankStandings,
  sportScoreBands,
  type BoxGame,
  type BoxPerson,
  type CfbPollRow,
  type LeagueLeaderGroup,
  type SectionBoard,
  type StandGroup,
} from "@/lib/newspaper-box";
import { cleanStoryCopy, proseParas, tidy, truncateAtSentence } from "@/lib/newspaper-copy";
import { TimesCommitBoundary } from "@/components/newspaper/TimesCommitBoundary";
import { recapBodyForPage, recapDropLead, recapIsScoreOnly, recapPhotoKind, recapShouldDropCap, splitApDateline } from "@/lib/newspaper-recap";
import {
  Face,
  MatchupCard,
  ScoreCard,
  ScoreMast,
  ScoreStrip,
  StandingsTable,
  Decisions,
  Goals,
  Leaders,
  Linescore,
  MlbAgate,
  SlateLine,
  DeskSnap,
  ScheduleAgate,
} from "@/components/newspaper/BoxScore";
import { RecapBox, RecapChrome, RecapPhoto } from "@/components/newspaper/GameRecap";
import { clubFormIsThin, clubOpensLabel, clubTickerRecord, formStatColumns, frontPageLeftover, groupByDay, planSchedulePages, printableFormStat } from "@/lib/newspaper-page";
import { ReaderProvider } from "@/components/newspaper/PaperReader";
import { useReader } from "@/components/newspaper/reader-context";
import { CfbFill, CfbScheduleDesk } from "@/components/newspaper/CfbScheduleDesk";
import { HeadlineSave } from "@/components/newspaper/SaveMark";
import { SavedDrawer } from "@/components/newspaper/SavedDrawer";
import { SavedProvider } from "@/components/newspaper/saved-context";
import { fetchHeismanOdds, type HeismanBoard } from "@/lib/newspaper-heisman";
import { PlayoffBracket } from "@/components/newspaper/PlayoffBracket";
import { NamedText, PlayerName, PlayerPopProvider } from "@/components/newspaper/PlayerPop";
import { fetchClubSheet, type ClubSheet } from "@/lib/newspaper-clubsheet";
import { enrichMissouriItems, fetchMissouriDesk, fetchMissouriScout } from "@/lib/newspaper-missouri-fetch";
import type { MoItem } from "@/lib/newspaper-missouri";
import type { Person } from "@/lib/newspaper-people";
import type { PlayerFile } from "@/lib/newspaper-subjects";
import { fetchMarshfieldWeather, type MarshfieldWeather } from "@/lib/newspaper-weather";
import { WeatherReport, WeatherStrip } from "@/components/newspaper/WeatherReport";
import { storySource } from "@/lib/newspaper-source";
import {
  daysUntil,
  fetchOpener,
  openerDate,
  openerDay,
  openerMatchup,
  openerTime,
  type Opener,
} from "@/lib/newspaper-openers";
import { playerPageHref, rankNights, type PlayerNight } from "@/lib/newspaper-players";
import {
  asFavoriteCoachDesk,
  coachFactLines,
  fetchFavoriteCoachDesk,
  slateLine,
  type FavoriteCoachTile,
} from "@/lib/newspaper-favorite-coaches";
import { sportPathsOf } from "@/lib/newspaper-compose";
import {
  listLocalIssues,
  peekProofIssue,
  readCacheUserId,
  readLocalIssue,
  writeLocalIssue,
  type PrintedIssue,
} from "@/lib/newspaper-issue";
import {
  listRecentIssues,
  readRemoteIssue,
  readRemoteIssueShell,
  readRemoteQueries,
  subscribeReadyIssues,
  writeDesk,
} from "@/lib/newspaper-issue-remote";
import { mergeQueries, queryDeskName } from "@/lib/newspaper-payload";
import {
  cacheTimesShell,
  prefetchFiledEdition,
  postTimesPrecache,
  registerTimesWorker,
  timesShellUrlsFromPerformance,
} from "@/lib/newspaper-offline";
import {
  backEditionNote,
  editionFolioLine,
  editionPickerLabel,
  filterRecentFiledIssues,
  isIssueWithinLookback,
  uniqueEditionStand,
  type FiledIssueMeta,
} from "@/lib/newspaper-editions";
import {
  COMPANION_WAIT_MS,
  ISSUE_POLL_MS,
  queryNamed,
  waitForPrintedReveal,
  withDeadline,
} from "@/lib/newspaper-document";
import { ElectionEar } from "@/components/newspaper/ElectionEar";
import { electionEar } from "@/lib/newspaper-election";
import { TimesHold, TimesHoldShell } from "@/components/newspaper/TimesHold";
import { fetchWatchList, WATCH_PAGE_GAMES } from "@/lib/newspaper-watch";
import WatchGuide from "@/components/newspaper/WatchGuide";
import DayAhead from "@/components/newspaper/DayAhead";
import { insertDayAhead, scheduleDateFor, type DaySchedule } from "@/lib/newspaper-day-ahead";
import { fetchDaySchedule } from "@/lib/newspaper-day-ahead-fetch";
import BeezPage from "@/components/newspaper/BeezPage";
import { asBeezDesk, insertBeez, type BeezDesk } from "@/lib/newspaper-beez";
import { readTimesBeez } from "@/lib/newspaper-beez-fetch";
import RacesPage from "@/components/newspaper/RacesPage";
import { insertRaceBriefs, sampleRaceBriefs, type RaceBriefsDesk } from "@/lib/newspaper-races";
import { fetchRaceBriefs } from "@/lib/newspaper-races-fetch";
import {
  asNationalDesk,
  sampleNationalDesk,
  type NationalDesk,
  type NationalStory,
} from "@/lib/newspaper-national";
import { readTimesNationalNews } from "@/lib/newspaper-national-fetch";
import {
  buildTeamInfoboxes,
  collectWrapFeeds,
  leaguePathFromEspn,
  playerHref,
  storyMatchesFavorite,
  wrapFeedsForFavorites,
  type GameWrapCard,
  type MatchedWrap,
  type TeamInfobox,
} from "@/lib/newspaper-sports";
import { espnThumbUrl, isNarrowStoryImage, rewriteEspnThumbs } from "@/lib/newspaper-images";
import { useStoryImage } from "@/components/newspaper/StoryImage";
import {
  buildEdition,
  dropEmptyFolios,
  essentialsFromDesks,
  a1ComingUp,
  isA1Muted,
  isGameWrap,
  isRecapStory,
  isSingleGameRecap,
  missouriStoryCard,
  nationalStoryCard,
  paginateEditionDesks,
  standColumns,
  pickFrontUnderLead,
  sortComingUp,
  sportInSeason,
  storyBodyForJump,
  type ClubDesk,
  type EditionPage,
  type EditionSection,
} from "@/lib/newspaper-sections";
import {
  favoriteKeyForGame,
  alreadyOnSectionA,
  groupSportRecaps,
  lastMatchCardFromChip,
  orderSportSectionFront,
  preferFrontCard,
  relatedFitsSection,
  sameGameStory,
  storyFitsSection,
  wrapBriefCopy,
} from "@/lib/newspaper-sport-desk";
import {
  enrichWireStories,
  espnTeamLogo,
  fetchLeagueClubs,
  fetchLeagueSlate,
  fetchNewspaperWire,
  postseasonRailGames,
  markFavoriteClubs,
  type LeagueClub,
  type LeagueSlateGame,
  type WireGame,
} from "@/lib/newspaper-wire";
import { fetchMlbPlayoffTree, type MlbPlayoffTree } from "@/lib/mlb";
import { fillMlbPlayoffPlaceholders } from "@/lib/newspaper-playoff-tree";
import { fetchRssFeed, fetchRssReads, markRssReadMany } from "@/lib/rss";
import {
  DEFAULT_FAVORITES,
  fetchTeamDetail,
  fetchTeamSnapshot,
  loadSportsLayout,
  visibleFavorites,
  type SportsFavorite,
  type TeamDetail,
  type TeamSnapshot,
} from "@/lib/sports";
import { cn } from "@/lib/utils";
import { prefersNewspaperHome } from "@/lib/newspaper-home";
import { pageGeometry } from "@/lib/newspaper-page-size";
import { packSheet } from "@/lib/newspaper-pack";

/** Desk data is observed already rewritten to ESPN combiner thumbs. */
function useQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> {
  const select = options.select;
  return useQueryBase({
    ...options,
    select: (data: TQueryFnData) =>
      rewriteEspnThumbs(select ? select(data) : (data as unknown as TData)) as TData,
  });
}

/** A desk as the edition filed it: read from the seeded cache, never fetched by the reader. */
function useFiledQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, "enabled">,
): UseQueryResult<TData, TError> {
  return useQuery({ ...options, enabled: false });
}

/** How many stories get a full ESPN story pull rather than the wire stub. */
const DEEP_STORIES = 48;

type ComingUp = {
  id: string;
  team: string;
  label: string;
  when: string | null;
  startIso?: string | null;
  favoriteKey?: string | null;
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
      src={espnThumbUrl(src) ?? src}
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
  const body = cleanStoryCopy(card.body).text;
  if (body.length >= 40) return body;
  const bits: string[] = [];
  const dek = cleanStoryCopy(card.dek).text;
  if (dek) bits.push(dek);
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

function a1PointerLine(card: GameWrapCard): string {
  const hed = card.headline.replace(/^No\.\s*\d+\s+/i, "").replace(/\s+/g, " ").trim();
  const short = hed.split(/ to |,| — | – /)[0]?.replace(/\s+\d+\s*[–-]\s*\d+\s*$/, "").trim() || hed;
  return card.favoriteKey === "cfb-mizzou" ? short.replace(/^Missouri\b/i, "Mizzou") : short;
}

function recapDek(card: GameWrapCard, sentences = 1): string {
  const raw = recapBodyForPage(tidy((card.body || card.dek || "").replace(/\s+/g, " ")));
  if (!raw || squash(raw) === squash(card.headline)) return "";
  const parts = raw.split(/(?<=[.!?])\s(?=["“A-Z0-9])/).slice(0, sentences);
  const out = parts.join(" ");
  return truncateAtSentence(out, 260);
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
  if (card.wrapKind === "box" || card.caption === "Times box wrap") return "Times box wrap";
  const bits = [card.sportLabel];
  if (card.round) bits.push(card.round);
  else if (card.postseason) bits.push("Postseason");
  if (card.sec && card.leaguePath === "football/college-football") bits.push("SEC");
  if (card.teamName && squash(card.teamName) !== squash(card.sportLabel)) bits.push(card.teamName);
  return bits.join(" · ");
}

function blankRecord(r: string | null | undefined): boolean {
  return !r || /^0-0(-0)?$/.test(r.trim());
}

function zeroStat(value: string): boolean {
  return /^[+-]?0(\.0+)?$/.test(value.trim());
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

const OpenerContext = createContext<Map<string, Opener>>(new Map());

function useOpener(key: string | null | undefined): Opener | null {
  const openers = useContext(OpenerContext);
  return key ? (openers.get(key) ?? null) : null;
}

/** Days to a club's first game, set big; `line` is the one-row rail version. */
function Countdown({
  opener,
  name,
  logo,
  color,
  variant = "card",
}: {
  opener: Opener;
  name?: string;
  logo?: string | null;
  color?: string | null;
  variant?: "card" | "line" | "poster";
}) {
  const days = daysUntil(opener.iso, Date.now(), opener.timeValid);
  const big = days <= 0 ? "Today" : days === 1 ? "1" : String(days);
  const unit = days <= 0 ? "" : days === 1 ? "day" : "days";
  return (
    <div className={cn("tt-count", variant)} style={tint(color ?? null)}>
      <p className="tt-count-num">
        <b>{big}</b>
        {unit ? <span>{unit}</span> : null}
      </p>
      <div className="tt-count-copy">
        <em>
          {name ? `${name} · ` : ""}
          {opener.billing}
        </em>
        <strong>
          {logo ? <img src={logo} alt="" aria-hidden="true" /> : null}
          {openerMatchup(opener)}
          {opener.opponentLogo ? <img src={opener.opponentLogo} alt="" aria-hidden="true" /> : null}
        </strong>
        <span>
          {openerDate(opener)}
          {opener.venue && variant !== "line" ? ` · ${opener.venue}` : ""}
        </span>
      </div>
    </div>
  );
}

/** Clubs with no slate, or next tip more than six weeks out, print compact. */
function clubIsOffseason(team: TeamInfobox, opener?: Opener | null): boolean {
  if (opener && daysUntil(opener.iso, Date.now(), opener.timeValid) > 7) return true;
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

function sameHead(a: string, b: string): boolean {
  return a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();
}

function pageLabel(page: EditionPage): string {
  switch (page.kind) {
    case "sport-front":
      return {
        front: "",
        news: "News",
        recaps: "Recaps",
        teams: "Standings",
        leaders: "Leaders",
        schedule: "Schedule",
        playoffs: "Playoffs",
        form: "Club Form",
        players: "Your Players",
        opener: "Countdown",
        coaches: "Favorite Coaches",
      }[page.focus];
    case "national":
      return page.sectionPage === 1 ? "National News" : "More National News";
    case "missouri":
      return page.sectionPage === 1 ? "Statehouse" : "Around the State";
    case "sport-inside":
    case "favorites-inside":
      return "Stories";
    case "favorites-clubs":
      return page.weatherPart === "today" ? "Weather" : "Your Clubs";
    case "favorites-form":
      return "Club Form";
    case "favorites-continue":
      return "Continued";
    case "favorites-watch":
      return "What to Watch";
    case "favorites-day":
      return "The Day Ahead";
    case "favorites-beez":
      return "The Beez";
    case "favorites-races":
      return page.continued ? "More Races" : "Races We're Tracking";
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
  editionLabel,
  weather,
  weatherFolio,
  onTurn,
  editions,
  selectedId,
  onSelectEdition,
  readingNote,
}: {
  day: string;
  page: EditionPage;
  clubs: number;
  live: number;
  editionLabel: string;
  weather: MarshfieldWeather | null | undefined;
  weatherFolio: string | null;
  onTurn: (folio: string) => void;
  editions: FiledIssueMeta[];
  selectedId: string;
  onSelectEdition: (id: string) => void;
  readingNote: string | null;
}) {
  const { volume, issue } = editionIssue(day);
  const ballot = electionEar(day);
  const stand = uniqueEditionStand(editions);
  const others = stand.filter((row) => row.id !== selectedId);
  return (
    <header className="wsj-mast">
      <div className="wsj-mast-row">
        {ballot ? (
          <ElectionEar day={day} />
        ) : (
          <div className="wsj-ear">
            <strong>Sports Final</strong>
            <span>All the scores fit to print</span>
          </div>
        )}
        <h1 className="wsj-nameplate">The Thompson Times</h1>
        <div className="wsj-ear right">
          <strong>{live ? `${live} live now` : editionLabel}</strong>
          <span>{clubs} clubs on the desk</span>
        </div>
      </div>
      <nav className="tt-editions" aria-label="Edition">
        <span className="tt-editions-label">Edition</span>
        <span className="tt-editions-current">{editionFolioLine(selectedId)}</span>
        {others.length ? (
          <details className="tt-editions-more">
            <summary>More</summary>
            <div className="tt-editions-menu">
              {others.map((row) => (
                <button key={row.id} type="button" onClick={() => onSelectEdition(row.id)}>
                  {editionPickerLabel(row.id, stand)}
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </nav>
      {readingNote ? <p className="tt-reading-note">{readingNote}</p> : null}
      <div className="wsj-dateline-bar">
        <span>
          Vol. {romanNumeral(volume)} · No. {issue}
        </span>
        <span className="c">{editionDateline(day)}</span>
        <span className="r">
          Section {page.section} · {page.folio}
        </span>
      </div>
      {weather?.days?.length ? (
        <WeatherStrip
          weather={weather}
          folio={weatherFolio}
          onOpen={weatherFolio ? () => onTurn(weatherFolio) : undefined}
        />
      ) : null}
    </header>
  );
}

function RunningHead({ day, page }: { day: string; page: EditionPage }) {
  const desk = pageLabel(page);
  const dup = Boolean(desk && sameHead(desk, page.sectionTitle));
  return (
    <header className="wsj-run">
      <span className="wsj-run-plate">The Thompson Times</span>
      <span className="wsj-run-section">
        <b>{page.section}</b>
        <span>{page.sectionTitle}</span>
        {desk && !dup ? <em>{desk}</em> : null}
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
        <HeadlineSave card={card}>
          <StoryLink card={card} game={game}>
            {card.headline}
          </StoryLink>
        </HeadlineSave>
      </h2>
    </>
  );
}

function ReadOn({
  card,
  game,
  label = "Read the full story",
  whenCut,
}: {
  card: GameWrapCard;
  game?: BoxGame | null;
  label?: string;
  /** Held invisible unless the page cuts this story's copy short. */
  whenCut?: boolean;
}) {
  return (
    <p className={cn("wsj-jump", whenCut && "when-cut")}>
      <StoryLink card={card} game={game} className="wsj-jump-btn">
        {label} <span aria-hidden="true">→</span>
      </StoryLink>
    </p>
  );
}

function Byline({ card }: { card: GameWrapCard }) {
  const author = cleanStoryCopy(card.body).author;
  const source = storySource(card) ?? `${card.sportLabel} Wire`;
  return (
    <p className="wsj-byline">
      <em>By</em> {author ? `${author} · ` : ""}
      {source}
      {card.followed || card.favoriteKey ? <span> · {card.teamName} desk</span> : null}
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
  dress,
  color,
  inset,
  ended,
  more,
}: {
  card: GameWrapCard;
  text: string;
  /** The rest of the story, set hidden; the page lets it run on when a column has room. */
  more?: string;
  cols: 1 | 2 | 3;
  drop?: boolean;
  max?: number;
  /** Long inside-page copy: a pull quote and run-in subheads break the gray. */
  dress?: boolean;
  color?: string | null;
  /** A panel set into the columns (the story's players), so it travels with the copy. */
  inset?: ReactNode;
  /** The whole story is set here: close it with an end mark. */
  ended?: boolean;
}) {
  const paras = proseParas(text, max);
  if (!paras.length) return null;
  const length = paras.reduce((n, p) => n + p.length, 0);
  // Short copy never splits into slivers of two-line columns.
  const fit = Math.max(1, Math.min(cols, Math.floor(length / 360))) as 1 | 2 | 3;
  const seen = new Set<string>();
  const quote = dress && length > 1600 ? pullQuote(paras) : null;
  const quoteAt = quote ? Math.max(2, Math.floor(paras.length * 0.45)) : -1;
  let insetAt = inset ? (paras.length <= 2 ? paras.length : Math.max(1, Math.round(paras.length * 0.6))) : -1;
  if (insetAt === quoteAt) insetAt += 1;
  return (
    <div className={cn("wsj-prose", `c${fit}`, length >= 420 && "measure", drop && "drop", dress && "dressed", ended && "ended")}>
      {paras.map((p, i) => (
        <Fragment key={i}>
          {i === insetAt ? inset : null}
          {i === quoteAt && quote ? (
            <blockquote className="wsj-pull" style={tint(color)}>
              <p>
                {quote}
              </p>
            </blockquote>
          ) : null}
          {dress && i > 0 && i % 5 === 0 ? (
            <p className="wsj-runin">
              <b>{runIn(p)[0]}</b> <NamedText text={runIn(p)[1]} seen={seen} />
            </p>
          ) : (
            <p>
              {i === 0 && drop
                ? (() => {
                    const lead = recapDropLead(card.dateline, p);
                    if (!lead) return <NamedText text={p} seen={seen} />;
                    return (
                      <>
                        <span className="wsj-drop">{lead.letter}</span>
                        {lead.datelineRest != null ? <span className="wsj-dateline">{lead.datelineRest} — </span> : null}
                        <NamedText text={lead.body} seen={seen} />
                      </>
                    );
                  })()
                : i === 0
                  ? (() => {
                      const split = splitApDateline(p);
                      const city = card.dateline || split.dateline;
                      return (
                        <>
                          {city ? <span className="wsj-dateline">{city} — </span> : null}
                          <NamedText text={split.body} seen={seen} />
                        </>
                      );
                    })()
                  : <NamedText text={p} seen={seen} />}
            </p>
          )}
        </Fragment>
      ))}
      {insetAt >= paras.length ? inset : null}
      {more
        ? proseParas(more).map((p, i) => (
            <p key={`more-${i}`} data-tt-more="">
              <NamedText text={p} seen={seen} />
            </p>
          ))
        : null}
    </div>
  );
}

function pullQuote(paras: string[]): string | null {
  const body = paras.slice(1).join(" ");
  const quotes = [...body.matchAll(/[“"]([^”"]{50,180})[”"]/g)].map((m) => m[1]!.trim());
  if (quotes.length) return `“${quotes.sort((a, b) => b.length - a.length)[0]!.replace(/[,.]$/, "")}.”`;
  const lines = body
    .split(/(?<=[.!?])\s+(?=[A-Z“"])/)
    .map((t) => t.trim())
    .filter((t) => t.length > 70 && t.length < 170 && !/^(but|and|so|he|she|it|they)\b/i.test(t));
  return lines[Math.floor(lines.length / 2)] ?? null;
}

/** A paragraph's opening words, split off to be set as a bold small-caps run-in. */
function runIn(text: string): [string, string] {
  const words = text.split(/\s+/);
  const n = Math.min(4, Math.max(1, words.length - 1));
  return [words.slice(0, n).join(" "), words.slice(n).join(" ")];
}

function Cut({ card, shape = "wide" }: { card: GameWrapCard; shape?: "wide" | "tall" | "square" }) {
  const [measured, setMeasured] = useState<number | null>(null);
  const photo = useStoryImage(card.photo);
  if (!card.photo || photo.hidden) return null;
  const caption =
    card.caption && squash(card.caption) !== squash(card.teamName) ? card.caption : null;
  const native = typeof card.photoWidth === "number" && card.photoWidth > 0 ? card.photoWidth : measured;
  const kind = recapPhotoKind(card.photo, native);
  return (
    <figure
      className={cn("wsj-cut", shape, kind === "fit" && "fit", card.photoStyle === "cutout" && "cutout")}
    >
      <img
        src={photo.src}
        alt=""
        loading="lazy"
        onError={photo.onError}
        onLoad={(e) => {
          const w = e.currentTarget.naturalWidth;
          if (w > 0) setMeasured((prev) => (prev && prev <= w ? prev : w));
        }}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/** The club's place in its league for one stat line, set under the label. */
function StatRank({ stat }: { stat: { rank?: string | null; rankIn?: string | null } }) {
  if (!stat.rank) return null;
  return (
    <span className="tt-stat-rank">
      {stat.rank}
      {stat.rankIn ? <i> in {stat.rankIn}</i> : null}
    </span>
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
  const stats = (card?.teamStats.length ? card.teamStats : team?.teamStats ?? [])
    .filter((s) => !zeroStat(String(s.value)))
    .slice(0, layout === "band" ? 8 : 6);
  const leaders = (card?.leaders.length ? card.leaders : teamLeaders(team)).slice(
    0,
    layout === "band" ? 5 : 4,
  );
  const opener = useOpener(team?.fav.key);
  if (!team && !stats.length) return null;
  const name = team?.snap.shortName || team?.fav.shortName || card?.teamName || "";
  const record = clubRecord(team);
  return (
    <figure className={cn("wsj-poster", layout, opener && "counting")} style={tint(teamColor(team))}>
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
              <dt>
                {s.label}
                <StatRank stat={s} />
              </dt>
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
      {opener ? <Countdown opener={opener} variant="poster" /> : null}
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
  dress,
  inset,
  trim,
  chrome,
  compactBox,
  showDek = true,
  yieldArt,
}: {
  card: GameWrapCard;
  team?: TeamInfobox | null;
  text?: string;
  size: "xl" | "lg" | "md" | "sm";
  cols?: 1 | 2 | 3;
  art?: ArtMode;
  /** The club poster stands in for a missing photo; "band" sets it full width over the story. */
  poster?: boolean | "band";
  drop?: boolean;
  jump?: string;
  onTurn?: (folio: string) => void;
  max?: number;
  className?: string;
  /**
   * Offer the whole story in the reader. Defaults to on when this page sets only
   * part of the copy; a page that sets all of it ends on an end mark instead.
   */
  readOn?: boolean;
  game?: BoxGame | null;
  dress?: boolean;
  /** Set into the story's columns (see `Prose`); after the copy when there is none. */
  inset?: ReactNode;
  /** Higher drops first when the folio runs past the 1040×1480 canvas. */
  trim?: number;
  /** False skips the recap box when a banner already carries the score. */
  chrome?: boolean;
  compactBox?: boolean;
  /** False leaves the dek off, as on a page's smaller stories. */
  showDek?: boolean;
  /** The photo leaves the page before the story does. */
  yieldArt?: boolean;
}) {
  const full = cardCopy(card);
  const copy = substantive(card, text ?? full);
  const recap =
    isSingleGameRecap(card) &&
    Boolean((card.scoreLine && /\d/.test(card.scoreLine)) || card.recapGame || game);
  const storyCopy = recap ? recapBodyForPage(copy) : copy;
  const partial = readOn ?? Boolean(jump || (storyCopy && storyCopy.length < full.length * 0.9));
  // A story that continues on another page stops at its teaser, as a printed jump does.
  const continues = Boolean(jump && onTurn);
  const dek = dekFor(card, storyCopy);
  const useDrop = Boolean(drop && storyCopy && recapShouldDropCap(storyCopy));
  const photoKind = recapPhotoKind(card.photo, card.photoWidth);
  const narrowArt =
    photoKind === "fit" || (Boolean(card.photo) && isNarrowStoryImage(card.photo));
  const artNode =
    art === "none"
      ? null
      : card.photo
        ? recap
          ? <RecapPhoto url={card.photo} width={card.photoWidth} caption={card.caption} />
          : <Cut card={card} shape={art === "side" && copy.length > 450 ? "square" : "wide"} />
        : poster
          ? <StatPoster team={team ?? null} card={card} layout={poster === "band" ? "band" : "block"} />
          : null;
  const artMode =
    !artNode ? "none" : narrowArt && !className?.includes("lead") ? "side" : art;
  return (
    <article
      className={cn(
        "wsj-story",
        artNode ? `art-${artMode}` : "art-none",
        artNode && !copy && !dek && "bare",
        className,
      )}
      style={tint(teamColor(team))}
      data-tt-keys={storyReadKeys(card).join("|")}
      data-tt-title={card.headline}
      {...(className?.split(" ").includes("lead") ? { "data-tt-lead": "" } : {})}
      {...(trim != null ? { "data-tt-trim": trim } : {})}
    >
      {artNode ? (
        <div className="wsj-story-art" {...(yieldArt ? { "data-tt-yield": "" } : {})}>
          {artNode}
        </div>
      ) : null}
      <div className="wsj-story-copy">
        <Headline card={card} size={size} game={game} />
        {showDek && dek && (!recap || chrome === false) ? (
          <p className="wsj-dek">
            {dek}
          </p>
        ) : null}
        {recap ? null : <ScoreBug card={card} />}
        <Byline card={card} />
        {recap && chrome !== false ? <RecapChrome card={card} game={game ?? null} compact={compactBox} /> : null}
        {storyCopy ? (
          <Prose
            card={card}
            text={storyCopy}
            cols={cols}
            drop={useDrop}
            max={max}
            dress={dress}
            color={teamColor(team)}
            inset={inset}
            ended={!partial}
            more={partial && !continues ? restOfCopy(full, storyCopy) : undefined}
          />
        ) : (
          inset
        )}
        {continues ? (
          <p className="wsj-jump wsj-cont">
            <button type="button" className="wsj-jump-btn" onClick={() => onTurn!(jump!)}>
              Continued on page {jump} <span aria-hidden="true">→</span>
            </button>
          </p>
        ) : storyCopy || jump ? (
          <ReadOn card={card} game={game} label="Click for full story" whenCut={!partial} />
        ) : null}
      </div>
    </article>
  );
}

/** What follows `shown` in the full story, when the page set a straight cut of it. */
function restOfCopy(full: string, shown: string): string | undefined {
  const a = full.replace(/\s+/g, " ").trim();
  const b = shown.replace(/\s+/g, " ").trim();
  if (!b || a.length <= b.length + 40 || !a.startsWith(b)) return undefined;
  // Enough to fill a column to the foot; the reader holds the rest.
  return splitStoryCopy(a.slice(b.length).trim(), 2400).teaser || undefined;
}

/** Wide photo for long copy; photo beside the type when the copy is short. */
function artFor(card: GameWrapCard, text: string): { art: ArtMode; cols: 1 | 2 | 3 } {
  const len = text.length;
  if (!card.photo) return { art: "top", cols: len > 1400 ? 3 : len > 500 ? 2 : 1 };
  if (isNarrowStoryImage(card.photo)) return { art: "side", cols: len > 700 ? 2 : 1 };
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
  trim,
}: {
  card: GameWrapCard;
  featured?: boolean;
  folio?: string;
  onTurn?: (folio: string) => void;
  crest?: string | null;
  color?: string | null;
  trim?: number;
}) {
  const dek = recapDek(card, featured ? 2 : 1);
  const photo = useStoryImage(card.photo);
  const showPhoto = Boolean(card.photo) && !photo.hidden;
  return (
    <article
      className={cn("wsj-brief", featured && "featured", (showPhoto || crest) && "has-art")}
      style={tint(color)}
      data-tt-keys={storyReadKeys(card).join("|")}
      data-tt-title={card.headline}
      {...(trim != null ? { "data-tt-trim": trim } : {})}
    >
      {showPhoto ? (
        <img className="wsj-brief-photo" src={photo.src} alt="" loading="lazy" onError={photo.onError} />
      ) : crest ? (
        <span className="wsj-brief-crest">
          <img src={crest} alt="" loading="lazy" />
        </span>
      ) : null}
      <div className="wsj-brief-copy">
        <Kicker card={card} />
        <h3>
          <HeadlineSave card={card}>
            <StoryLink card={card} color={color}>
              {card.headline}
            </StoryLink>
          </HeadlineSave>
        </h3>
        <ScoreBug card={card} />
        {dek ? (
          <p className="wsj-brief-dek">
            {dek}
          </p>
        ) : null}
        <ReadOn card={card} label="Click for full story" />
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
              trim={40 + i}
            />
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── broadsheet ───────────────────────── */

/**
 * A printed news page: the lead across four of six columns, a two-column rail
 * beside it, and a band of three columns under them. Every cell is a fixed
 * box, so the packer cuts each story on a line at its foot and the reader
 * holds the rest; stories with copy to spare run on into what room is left.
 */
function Broadsheet({
  cards,
  games,
  label,
}: {
  cards: GameWrapCard[];
  games?: Map<string, BoxGame>;
  label?: string;
}) {
  if (!cards.length) return null;
  const [lead, ...rest] = cards;
  const railN = rest.length >= 7 ? 3 : Math.min(2, rest.length);
  const rail = rest.slice(0, railN);
  const band = rest.slice(railN);
  const colN = Math.min(3, band.length);
  const cols: GameWrapCard[][] = Array.from({ length: colN }, () => []);
  band.forEach((card, i) => cols[i % colN]!.push(card));
  const teaser = (card: GameWrapCard, chars: number) => splitStoryCopy(cardCopy(card), chars).teaser;
  return (
    <div className={cn("tt-bs", !band.length && "no-band", !rail.length && "no-rail")} data-tt-pack="">
      <div className="tt-bs-lead">
        <Story
          className="lead"
          card={lead!}
          text={teaser(lead!, 1600)}
          size="xl"
          cols={3}
          art="top"
          drop
          readOn
          compactBox
          game={games?.get(lead!.id) ?? null}
        />
      </div>
      {rail.length ? (
        <div className="tt-bs-rail">
          {rail.map((card, i) => (
            <Story
              key={card.id}
              card={card}
              text={teaser(card, 700)}
              size={i === 0 ? "md" : "sm"}
              art={i === 0 ? "top" : "none"}
              readOn
              showDek={false}
              yieldArt
              game={games?.get(card.id) ?? null}
              trim={10 + i}
            />
          ))}
        </div>
      ) : null}
      {band.length ? (
        <div className="tt-bs-band" style={{ ["--tt-bs-cols" as string]: colN }}>
          {label ? <h3 className="wsj-band-title tt-bs-label">{label}</h3> : null}
          {cols.map((col, c) =>
            col.length ? (
              <div className="tt-bs-col" key={c}>
                {col.map((card, i) => (
                  <Story
                    key={card.id}
                    card={card}
                    text={teaser(card, 600)}
                    size="sm"
                    cols={2}
                    art={i === 0 ? "top" : "none"}
                    readOn
                    showDek={false}
                    yieldArt
                    game={games?.get(card.id) ?? null}
                    trim={20 + i * colN + c}
                  />
                ))}
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
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
  if (!empty) return null;
  const tile = (
    <>
      <strong>The clubs desk</strong>
      <span>
        Slates, tables &amp; leaders · <b>Page A2 →</b>
      </span>
    </>
  );
  return (
    <li className="wsj-filler" style={{ ["--tt-fill-span" as string]: String(empty) }}>
      {onTurn ? (
        <button type="button" onClick={() => onTurn("A2")}>
          {tile}
        </button>
      ) : (
        <span className="wsj-filler-static">{tile}</span>
      )}
    </li>
  );
}

/** The front's scoreboard: every club, its record, its last five. */
function ClubTicker({
  teams,
  editionDay,
  onTurn,
}: {
  teams: TeamInfobox[];
  editionDay: string;
  onTurn?: (folio: string) => void;
}) {
  const openers = useContext(OpenerContext);
  if (!teams.length) return null;
  const cols = balancedCols(teams.length, [5, 4, 3]);
  return (
    <ul className="wsj-ticker" data-tt-keep="" style={{ ["--cols" as string]: String(cols) }}>
      {teams.map((t, i) => {
        const path = leaguePathFromEspn(t.fav.espnPath);
        const inSeason = !path || sportInSeason(path, editionDay);
        const opener = openers.get(t.fav.key) ?? null;
        const opensLine = clubOpensLabel(opener?.iso, t.snap.nextGame?.when ?? t.detail?.upcoming?.[0]?.when);
        return (
          <li key={t.fav.key} style={tint(teamColor(t))} data-tt-trim={55 + i}>
            <ExternalOrLink href={t.href} className="wsj-ticker-cell wsj-a">
              <span className="wsj-ticker-id">
                <TeamLogo src={t.snap.logo || t.detail?.logo} size="sm" />
                <strong>{t.fav.shortName}</strong>
              </span>
              <span className="wsj-ticker-rec">
                <b>{clubTickerRecord(clubRecord(t), inSeason, opensLine)}</b>
                <FormDots form={inSeason ? t.form : []} />
              </span>
              <em className="wsj-ticker-place">{inSeason ? t.snap.standing || t.fav.league : t.fav.league}</em>
            </ExternalOrLink>
          </li>
        );
      })}
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
  // Rows of six at most: the page drops whole tiles from the end when the board runs long.
  const cols = Math.min(6, Math.max(4, teams.length));
  return (
    <section className="wsj-deskboard" data-tt-rows="">
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

function bracketWhen(game: WireGame): string {
  if (game.live) return game.statusDetail;
  if (game.final) {
    const a = game.away.score;
    const h = game.home.score;
    return a != null && h != null ? `Final ${a}–${h}` : "Final";
  }
  if (game.startedAt) {
    const when = formatFixtureWhen(game.startedAt);
    return when ? `${when} CT` : game.statusDetail;
  }
  return game.statusDetail;
}

function FrontRail({
  teams,
  tonight,
  bracket,
  comingUp,
  sections,
  onTurn,
}: {
  teams: TeamInfobox[];
  tonight: WireGame[];
  bracket: WireGame[];
  comingUp: ComingUp[];
  sections: EditionSection[];
  onTurn: (folio: string) => void;
}) {
  const openers = useContext(OpenerContext);
  const sports = sections.filter((s) => s.code !== "A");
  const closed = teams.filter((t) => t.seasonState === "complete");
  const waiting = teams
    .filter((t) => t.seasonState !== "complete" && openers.has(t.fav.key))
    .sort((a, b) => openers.get(a.fav.key)!.iso.localeCompare(openers.get(b.fav.key)!.iso));
  const tables = teams
    .filter((t) => t.seasonState !== "complete" && (t.detail?.division?.length ?? 0) > 1)
    .slice(0, 2);
  return (
    <aside className="wsj-rail">
      {sports.length ? (
        <section className="wsj-rail-block ink">
          <h3>Inside Today</h3>
          <ul className="wsj-index">
            {sports.map((s, i) => (
              <li key={s.code} {...(i >= 5 ? { "data-tt-flow": "" } : i >= 4 ? { "data-tt-trim": 12 + i } : {})}>
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

      {tonight.length || bracket.length ? (
        <section className="wsj-rail-block">
          <h3>
            <span className="wsj-live-dot" aria-hidden="true" />
            {tonight.length ? "Live" : "Postseason"}
          </h3>
          <ul className="wsj-rail-list">
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
            {bracket
              .filter((g) => !tonight.some((live) => live.id === g.id))
              .map((g) => (
                <li key={g.id}>
                  <ExternalOrLink href={g.href} className="wsj-a">
                    <strong>
                      {g.away.short} at {g.home.short}
                    </strong>
                  </ExternalOrLink>{" "}
                  <span className="wsj-ref">
                    {[g.round, g.series, bracketWhen(g)].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {comingUp.length ? (
        <section className="wsj-rail-block">
          <h3>Coming Up</h3>
          <ul className="wsj-upcoming">
            {comingUp.map((g, i) => (
              <li key={g.id} style={tint(g.color)} {...(i >= 4 ? { "data-tt-flow": "" } : { "data-tt-trim": 16 + i })}>
                <TeamLogo src={g.logo} size="xs" />
                <span className="t">
                  <strong>{g.team}</strong> {g.label}
                </span>
                <em>{g.startIso ? formatFixtureWhen(g.startIso) || g.when || "TBD" : g.when || "TBD"}</em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tables.map((t, i) => (
        <div key={`table-${t.fav.key}`} {...(i > 0 ? { "data-tt-flow": "" } : {})}>
        <AgateBox
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
        </div>
      ))}

      {waiting.length ? (
        <section className="wsj-rail-block" data-tt-flow="">
          <h3>Countdown</h3>
          <ul className="tt-count-list">
            {waiting.map((t) => (
              <li key={t.fav.key}>
                <Countdown
                  opener={openers.get(t.fav.key)!}
                  name={t.fav.shortName}
                  color={teamColor(t)}
                  variant="line"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {closed.length ? (
        <section className="wsj-rail-block">
          <h3>Season Complete</h3>
          <ul className="wsj-rail-list">
            {closed.map((t) => {
              const opener = openers.get(t.fav.key);
              return (
                <li key={t.fav.key} className={cn(opener && "counting")}>
                  <p>
                    <ExternalOrLink href={t.href} className="wsj-a">
                      <strong>{t.fav.shortName}</strong>
                    </ExternalOrLink>{" "}
                    finished {t.snap.record || "—"}
                    {t.snap.standing ? `, ${t.snap.standing}` : ""}.
                  </p>
                  {opener ? (
                    <Countdown opener={opener} color={teamColor(t)} logo={t.snap.logo || t.detail?.logo} variant="card" />
                  ) : null}
                </li>
              );
            })}
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
  news,
  teams,
  tonight,
  bracket,
  comingUp,
  sections,
  folios,
  clubsFolio = "A3",
  editionDay,
  onTurn,
  leadContinue,
  secondContinue,
  thirdContinue,
  leadTeaser,
  secondTeaser,
  thirdTeaser,
  scout,
}: {
  lead: GameWrapCard | null;
  second: GameWrapCard | null;
  third: GameWrapCard | null;
  briefs: GameWrapCard[];
  news?: GameWrapCard[];
  teams: TeamInfobox[];
  tonight: WireGame[];
  bracket: WireGame[];
  comingUp: ComingUp[];
  sections: EditionSection[];
  folios: Record<string, string>;
  clubsFolio?: string;
  editionDay: string;
  onTurn: (folio: string) => void;
  leadContinue?: string;
  secondContinue?: string;
  thirdContinue?: string;
  leadTeaser?: string;
  secondTeaser?: string;
  thirdTeaser?: string;
  scout?: MoItem | null;
}) {
  const moFolio = sections.find((s) => s.title === "Missouri")?.folio ?? null;
  const scoutBand = scout ? <ScoutBand item={scout} onTurn={onTurn} deskFolio={moFolio} /> : null;
  const rail = (
    <FrontRail
      teams={teams}
      tonight={tonight}
      bracket={bracket}
      comingUp={comingUp}
      sections={sections}
      onTurn={onTurn}
    />
  );

  const seenIds = new Set<string>();
  const pool = [lead, second, third, ...briefs, ...(news ?? [])].filter((card): card is GameWrapCard => {
    if (!card?.headline) return false;
    if (isA1Muted(card, editionDay)) return false;
    if (seenIds.has(card.id)) return false;
    seenIds.add(card.id);
    return true;
  });
  const pageLead = pool[0] ?? null;
  const pageSecond = pool[1] ?? null;
  const pageThird = pool[2] ?? null;
  const pageBriefs = pool.slice(3, 6);
  const elsewhere = (id?: string) => {
    const folio = folios[id ?? ""];
    return folio && folio !== "A1" ? folio : undefined;
  };
  const pageLeadContinue = pageLead && pageLead.id === lead?.id ? leadContinue : elsewhere(pageLead?.id);
  const pageSecondContinue = pageSecond && pageSecond.id === second?.id ? secondContinue : elsewhere(pageSecond?.id);
  const pageThirdContinue = pageThird && pageThird.id === third?.id ? thirdContinue : elsewhere(pageThird?.id);
  const pageLeadTeaser = pageLead && pageLead.id === lead?.id ? leadTeaser : undefined;
  const pageSecondTeaser = pageSecond && pageSecond.id === second?.id ? secondTeaser : undefined;
  const pageThirdTeaser = pageThird && pageThird.id === third?.id ? thirdTeaser : undefined;

  if (!pageLead) {
    return (
      <div className="wsj-front">
        <div className="wsj-front-grid">
          <div className="wsj-front-main">
            <ClubTicker teams={teams} editionDay={editionDay} onTurn={onTurn} />
            <TurnBar onTurn={onTurn} folio={clubsFolio} label="The clubs desk — every slate, table and leader" />
          </div>
          {rail}
        </div>
        {scoutBand}
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
  const leadPoster = wantsPoster(pageLead);
  const underCandidates = pool.filter((c) => c !== pageLead);
  const underLead = pickFrontUnderLead(pool, pageLead, editionDay) ?? pageSecond;
  const underContinue =
    underLead && underLead.id === second?.id
      ? pageSecondContinue
      : underLead && underLead.id === third?.id
        ? pageThirdContinue
        : elsewhere(underLead?.id);
  const underTeaser =
    underLead && underLead.id === second?.id
      ? pageSecondTeaser
      : underLead && underLead.id === third?.id
        ? pageThirdTeaser
        : undefined;
  const underPoster = wantsPoster(underLead);
  const flowed = underCandidates.filter((c) => c !== underLead);
  const flowCard = flowed[0] ?? null;
  const flowPoster = wantsPoster(flowCard);
  const flowContinue =
    flowCard && flowCard.id === third?.id
      ? pageThirdContinue
      : flowCard && flowCard.id === second?.id
        ? pageSecondContinue
        : elsewhere(flowCard?.id);
  const flowTeaser =
    flowCard && flowCard.id === third?.id
      ? pageThirdTeaser
      : flowCard && flowCard.id === second?.id
        ? pageSecondTeaser
        : undefined;

  return (
    <div className="wsj-front">
      <div className="wsj-front-grid">
        <div className="wsj-front-main">
          <Story
            className="lead"
            card={pageLead}
            team={teamForCard(teams, pageLead)}
            text={splitStoryCopy(copyOf(pageLead, pageLeadTeaser), 1100).teaser}
            size="xl"
            cols={2}
            art="top"
            poster={leadPoster}
            drop
            chrome={false}
            jump={pageLeadContinue}
            onTurn={onTurn}
          />
          {underLead ? (
            <div className="wsj-front-under" data-tt-keep="">
              <Story
                className="under-lead"
                card={underLead}
                team={teamForCard(teams, underLead)}
                text={
                  recapDek(underLead, 4) ||
                  wrapBriefCopy(underLead, 4) ||
                  splitStoryCopy(copyOf(underLead, underTeaser), 480).teaser
                }
                size="md"
                cols={1}
                art={underLead.photo || underPoster ? "side" : "none"}
                poster={underPoster}
                chrome={false}
                jump={underContinue}
                onTurn={onTurn}
              />
            </div>
          ) : null}
          {flowCard ? (
            <div className="wsj-front-row one" data-tt-flow="">
              <Story
                card={flowCard}
                team={teamForCard(teams, flowCard)}
                text={copyOf(flowCard, flowTeaser)}
                size="md"
                cols={1}
                art="top"
                poster={flowPoster}
                jump={flowContinue}
                onTurn={onTurn}
                trim={24}
                yieldArt
              />
            </div>
          ) : null}
        </div>
        {rail}
      </div>
      <ClubTicker teams={teams} editionDay={editionDay} onTurn={onTurn} />
      {scoutBand ? <div data-tt-flow="">{scoutBand}</div> : null}
      <div data-tt-flow="">
      <BriefGrid
        cards={pageBriefs}
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
      </div>
      <div data-tt-flow="">
        <TurnBar onTurn={onTurn} folio={clubsFolio} label="The clubs desk — every slate, table and leader" />
      </div>
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

function ClubsDesk({
  teams,
  offset = 0,
  limit,
}: {
  teams: TeamInfobox[];
  offset?: number;
  limit?: number;
}) {
  const openers = useContext(OpenerContext);
  const allActive = teams.filter((t) => !clubIsOffseason(t, openers.get(t.fav.key)));
  const active = allActive.slice(offset, limit != null ? offset + limit : undefined);
  const shelved = offset > 0 ? [] : teams.filter((t) => clubIsOffseason(t, openers.get(t.fav.key)));
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
          {active.map((t, i) => {
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
              <li key={t.fav.key} {...(i > 0 ? { "data-tt-flow": "" } : {})}>
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
                    {t.odds ? <p className="wsj-club-odds">Playoff odds {t.odds}</p> : null}
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
          <ul className="wsj-shelved" style={{ ["--cols" as string]: "2" }}>
            {shelved.map((t) => {
              const opener = openers.get(t.fav.key);
              return (
                <li key={t.fav.key} style={tint(teamColor(t))}>
                  <ExternalOrLink href={t.href} className={cn("wsj-shelved-card wsj-a", opener && "counting")}>
                    <TeamLogo src={t.snap.logo || t.detail?.logo} size="lg" />
                    <span>
                      <strong>{t.fav.shortName}</strong>
                      <span>
                        {t.seasonState === "complete" ? "Final" : t.fav.league} · {clubRecord(t) || "—"}
                        {t.snap.standing ? ` · ${t.snap.standing}` : ""}
                      </span>
                      {opener ? null : <em>{clubCountdown(t)}</em>}
                    </span>
                    {opener ? <Countdown opener={opener} variant="line" /> : null}
                  </ExternalOrLink>
                </li>
              );
            })}
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
  const noted = new Set(notebooks.map((t) => t.fav.key));
  return (
    <div className="wsj-inside">
      {stories.map((card, i) => {
        const team = teamForCard(teams, card);
        const text = cardCopy(card);
        const { art, cols } = artFor(card, text);
        const game = isSingleGameRecap(card) ? lookup(card) : null;
        // No photograph: the club's poster carries the art, unless its notebook already runs here.
        const poster = !card.photo && Boolean(team) && !noted.has(team!.fav.key);
        return (
          <div key={card.id} className={cn("wsj-inside-story", i === 0 && "first")} style={tint(teamColor(team))}>
            {i === 0 && !poster ? <InsideFlag card={card} team={team} /> : null}
            <Story
              className={cn(i === 0 ? "primary" : "secondary", poster && "postered")}
              card={card}
              team={team}
              text={text}
              size={i === 0 ? "xl" : "lg"}
              cols={poster ? (text.length > 2400 ? 3 : text.length > 700 ? 2 : 1) : cols}
              art={poster ? "top" : art}
              poster={poster ? "band" : false}
              drop
              dress
              game={game}
              inset={game ? null : <StoryNames card={card} />}
            />
            {game || (isSingleGameRecap(card) && card.recapGame) ? (
              <div data-tt-flow>
                <RecapBox card={card} game={game ?? null} compact />
              </div>
            ) : null}
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
        <div key={team.fav.key} data-tt-flow="">
          <StatPoster team={team} layout="band" />
        </div>
      ))}
    </div>
  );
}

/** The inside page's flag: the club's crest and colors over the lead story. */
function InsideFlag({ card, team }: { card: GameWrapCard; team: TeamInfobox | null }) {
  const logo = team?.snap.logo || team?.detail?.logo || null;
  return (
    <header className="wsj-inside-flag">
      {logo ? <img src={logo} alt="" aria-hidden="true" /> : null}
      <span>{team?.fav.shortName || card.teamName || card.sportLabel}</span>
      <em>{[card.sportLabel, team ? clubRecord(team) : null, team?.snap.standing].filter(Boolean).join(" · ")}</em>
    </header>
  );
}

const SubjectsContext = createContext<Record<string, PlayerFile[]>>({});

/**
 * The players the story is about — face, position, season line — boxed into the
 * story's columns when no box score runs. One name to a row, so it holds its
 * type at any count.
 */
function StoryNames({ card }: { card: GameWrapCard }) {
  const files = useContext(SubjectsContext)[card.id] ?? [];
  const stats = card.stats.slice(0, 6);
  if (!files.length && !stats.length) return null;
  return (
    <aside className="wsj-story-facts" aria-label="In this story">
      {stats.length ? (
        <dl>
          {stats.map((s) => (
            <div key={`${s.label}-${s.value}`}>
              <dd>{s.value}</dd>
              <dt>{s.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      {files.length ? (
        <section className="tt-files">
          <h4 className="tt-files-h">In this story</h4>
          <ul>
            {files.map((f) => (
              <li key={f.href}>
                <span className="tt-files-face">
                  {f.headshot ? <img src={f.headshot} alt="" loading="lazy" /> : <b>{initials(f.name)}</b>}
                </span>
                <span className="tt-files-copy">
                  <strong>
                    <PlayerName name={f.name} href={f.href} />
                  </strong>
                  <em>{[f.position, f.team].filter(Boolean).join(" · ")}</em>
                  {f.line ? (
                    <span>
                      {f.lineNote ? <i>{f.lineNote}: </i> : null}
                      {f.line}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
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
  // Every promised continuation sets before the club bands, so a full page gives those up first.
  return (
    <div className="wsj-continue">
      {jumps.map(({ card, rest }, i) => {
        const game = isSingleGameRecap(card) ? lookup(card) : null;
        const boxed = Boolean(game || (isSingleGameRecap(card) && card.recapGame));
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
              dress
              readOn={false}
              game={game}
              compactBox
              inset={boxed ? null : <StoryNames card={card} />}
            />
          </div>
        );
      })}
      {notebooks.map((team) => (
        <div key={team.fav.key} data-tt-flow="">
          <StatPoster team={team} layout="band" />
        </div>
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
  front: "Section Front",
  news: "News",
  recaps: "Recaps",
  teams: "Standings",
  leaders: "League Leaders",
  schedule: "Schedule",
  playoffs: "Playoffs",
  form: "Club Form",
  players: "Your Players",
  opener: "Countdown to Opening Night",
  coaches: "Favorite Coaches",
};

const TURN_LABELS: Record<SportFrontPage["focus"], string> = {
  front: "The section front",
  news: "League news",
  recaps: "Recaps",
  teams: "The standings",
  leaders: "League leaders",
  schedule: "The schedule",
  playoffs: "The playoff bracket",
  form: "Club form",
  players: "Your players — last night’s lines",
  opener: "Countdown to opening night",
  coaches: "Favorite coaches",
};

/** Offseason desk: days to each followed club's first game, then what follows it. */
function OpenerDesk({ page, onTurn }: { page: SportFrontPage; onTurn: (folio: string) => void }) {
  const openers = useContext(OpenerContext);
  const index = page.articles.filter((a) => a.card.headline).slice(0, rowsFor(page.clubs.length));
  const rows = page.clubs
    .map((club) => ({ club, opener: openers.get(club.key) ?? null }))
    .sort((a, b) => (a.opener?.iso ?? "9").localeCompare(b.opener?.iso ?? "9"));
  if (!rows.length) return <p className="wsj-empty">No followed clubs in this section.</p>;
  return (
    <div
      className={cn("tt-open-grid", rows.length === 1 && "single")}
      style={{ ["--cols" as string]: String(Math.min(3, rows.length)) }}
    >
      {rows.map(({ club, opener }) => {
        // A league that has rolled its tables over prints 0-0 everywhere; that isn't last season.
        const played = !blankRecord(club.record);
        const stats = played ? club.stats.filter((s) => !zeroStat(s.value)) : [];
        const table = club.division.some((r) => !blankRecord(r.record)) ? tableWindow(club.division, 6) : [];
        return (
          <article key={club.key} className="tt-open" style={tint(club.color ?? null)}>
            <header>
              {club.logo ? <img src={club.logo} alt="" aria-hidden="true" /> : null}
              <h4>{club.shortName}</h4>
              {played ? <span>Last season {club.record}</span> : null}
            </header>
            {opener ? (
              <Countdown opener={opener} logo={club.logo} color={club.color} variant="card" />
            ) : (
              <p className="wsj-empty">Opening date not yet posted.</p>
            )}
            <div className="tt-open-body">
              {opener && opener.slate.length > 1 ? (
                <section>
                  <h5 className="tt-open-h">The first {opener.slate.length} games</h5>
                  <ol className="tt-open-slate">
                    {opener.slate.map((g) => (
                      <li key={g.iso + g.opponentShort} className={g.home ? "home" : "away"}>
                        <b>{openerDay(g)}</b>
                        <span>
                          {g.opponentLogo ? <img src={g.opponentLogo} alt="" aria-hidden="true" /> : null}
                          {openerMatchup(g)}
                        </span>
                        <em>{openerTime(g)}</em>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
              {stats.length || table.length || club.leaders.length ? (
                <div className="tt-open-side">
                  {stats.length ? (
                    <section>
                      <h5 className="tt-open-h">Last season{club.standing ? ` · ${club.standing}` : ""}</h5>
                      <dl className="tt-open-stats">
                        {stats.slice(0, 4).map((s) => (
                          <div key={s.label}>
                            <dd>{s.value}</dd>
                            <dt>
                              {s.label}
                              <StatRank stat={s} />
                            </dt>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ) : null}
                  {table.length ? (
                    <table className="tt-open-table">
                      <tbody>
                        {table.map((r) => (
                          <tr key={r.team} className={cn(r.me && "me")}>
                            <td>{r.rank}</td>
                            <th scope="row">
                              <span>
                                {r.logo ? <img src={r.logo} alt="" aria-hidden="true" /> : null}
                                {r.team}
                              </span>
                            </th>
                            <td>{r.record}</td>
                            <td>{r.gb}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {club.leaders.length ? (
                    <ul className="tt-open-leaders">
                      {club.leaders.slice(0, 3).map((l) => (
                        <li key={`${l.name}-${l.line}`}>
                          <strong>{l.name}</strong>
                          <span>{l.line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
      {index.length ? (
        <section className="tt-open-index">
          <h3 className="wsj-band-title">In this section</h3>
          <ol>
            {index.map(({ card, folio }) => (
              <li key={card.id}>
                <Kicker card={card} />
                <h4>
                  <HeadlineSave card={card}>
                    <StoryLink card={card}>{card.headline}</StoryLink>
                  </HeadlineSave>
                </h4>
                {card.dek ? <p>{card.dek}</p> : null}
                <ReadOn card={card} label="Click for full story" />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/** One followed club leaves room on the page for the section's headlines. */
function rowsFor(clubs: number): number {
  return clubs <= 1 ? 6 : clubs === 2 ? 3 : 0;
}

/** Slim countdown band across an offseason section front. */
function OpenerBand({ page }: { page: SportFrontPage }) {
  const openers = useContext(OpenerContext);
  const rows = page.clubs
    .map((club) => ({ club, opener: openers.get(club.key) ?? null }))
    .filter((r): r is { club: ClubDesk; opener: Opener } => Boolean(r.opener))
    .sort((a, b) => a.opener.iso.localeCompare(b.opener.iso));
  if (!rows.length) return null;
  return (
    <section className="tt-open-band" aria-label="Countdown to opening night">
      <h3 className="wsj-band-title">Offseason · countdown to the opener</h3>
      <div className="tt-open-band-row">
        {rows.map(({ club, opener }) => (
          <Countdown key={club.key} opener={opener} name={club.shortName} logo={club.logo} color={club.color} variant="line" />
        ))}
      </div>
    </section>
  );
}

/** Section flag: big on the section front, a slim band on the desk pages behind it. */
function SportHero({
  page,
  leagueClubs,
  blurb,
  deskTitle,
}: {
  page: SportFrontPage;
  leagueClubs: LeagueClub[];
  blurb: string;
  deskTitle?: string;
}) {
  if (page.focus !== "front") {
    return (
      <header className="wsj-sport-band">
        <span className="wsj-sport-code">{page.section}</span>
        <h3>
          {page.sectionTitle}
          {deskTitle ?? FOCUS_TITLES[page.focus] ? (
            sameHead(deskTitle ?? FOCUS_TITLES[page.focus], page.sectionTitle) ? null : (
              <>
                {" "}
                <em>{deskTitle ?? FOCUS_TITLES[page.focus]}</em>
              </>
            )
          ) : null}
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
  return Boolean(
    favoriteKeyForGame(
      {
        away: { short: game.away.short, name: game.away.name, id: game.away.id, abbrev: game.away.abbrev },
        home: { short: game.home.short, name: game.home.name, id: game.home.id, abbrev: game.home.abbrev },
        path: game.path,
      },
      clubs,
    ),
  );
}

function stampBoardCard(game: BoxGame, clubs: ClubDesk[]): GameWrapCard | null {
  const card = boxStoryCard(game);
  if (!card) return null;
  const key = favoriteKeyForGame(game, clubs);
  return {
    ...card,
    favoriteKey: key || card.favoriteKey,
    followed: Boolean(key) || card.followed,
  };
}

function favoriteKeyFromCopy(card: GameWrapCard, clubs: ClubDesk[]): string {
  if (
    card.favoriteKey &&
    clubs.some(
      (c) =>
        c.key === card.favoriteKey && (!c.leaguePath || !card.leaguePath || c.leaguePath === card.leaguePath),
    )
  ) {
    return card.favoriteKey;
  }
  for (const club of clubs) {
    const fav = DEFAULT_FAVORITES.find((f) => f.key === club.key);
    if (fav && storyMatchesFavorite(card, fav)) return club.key;
  }
  return "";
}

function gameForCard(card: GameWrapCard, games: BoxGame[], clubs: ClubDesk[]): BoxGame | null {
  if (card.gameId) {
    const hit = games.find(
      (g) => g.espnEventId === card.gameId || (g.gamePk != null && String(g.gamePk) === card.gameId),
    );
    if (hit) return hit;
  }
  return (
    games.find((g) => {
      const stamped = stampBoardCard(g, clubs);
      return Boolean(stamped && (stamped.id === card.id || sameGameStory(stamped, card)));
    }) ??
    games.find((g) => gameMatchesRecap(g, card)) ??
    null
  );
}

function mergeFrontStories(
  page: SportFrontPage,
  board: SectionBoard | null,
  edition: string,
  fill?: {
    leftover?: GameWrapCard[];
    snaps?: TeamSnapshot[];
    coaches?: FavoriteCoachTile[];
  },
): GameWrapCard[] {
  const filed = page.articles
    .map((a) => a.card)
    .filter((c) => c.headline)
    .map((c) => {
      const key = favoriteKeyFromCopy(c, page.clubs);
      return key && key !== c.favoriteKey ? { ...c, favoriteKey: key, followed: true } : c;
    });
  const extras: GameWrapCard[] = frontPageLeftover(filed, fill?.leftover ?? [], page.path.includes("college-football") || page.path === "baseball/mlb" ? 4 : 2);
  if (board) {
    let added = 0;
    for (const g of [...(board.results ?? []), ...(board.prior ?? [])]) {
      const card = stampBoardCard(g, page.clubs);
      if (!card?.favoriteKey) continue;
      extras.push(card);
      if (++added >= 2) break;
    }
  }
  if (page.path.startsWith("soccer/")) {
    for (const tile of fill?.coaches ?? []) {
      extras.push(...tile.headlines.filter((c) => c.headline));
      const last = tile.lastGame;
      const club = page.clubs.find((c) => c.key === tile.teamAbbrev || squash(c.shortName) === squash(tile.teamName ?? tile.teamAbbrev));
      if (last && club) {
        extras.push(
          lastMatchCardFromChip({
            key: club.key,
            name: tile.teamName || club.shortName,
            shortName: club.shortName,
            logo: tile.teamLogo || club.logo,
            leaguePath: page.path,
            sportLabel: page.sectionTitle,
            last: {
              label: `${last.homeAway === "at" ? "@" : "vs"} ${last.opponent ?? "OPP"}`,
              detail: last.score,
              when: last.date,
              won: last.result === "W" ? true : last.result === "L" ? false : null,
            },
          }),
        );
      }
    }
    for (const snap of fill?.snaps ?? []) {
      if (!snap.lastGame) continue;
      extras.push(
        lastMatchCardFromChip({
          key: snap.key,
          name: snap.name,
          shortName: snap.shortName,
          logo: snap.logo,
          leaguePath: page.path,
          sportLabel: page.sectionTitle,
          last: snap.lastGame,
        }),
      );
    }
  }
  const pooled: GameWrapCard[] = [];
  for (const extra of [...filed, ...extras]) {
    if (!extra.headline) continue;
    const hit = pooled.findIndex((s) => s.id === extra.id || sameGameStory(s, extra));
    if (hit >= 0) pooled[hit] = preferFrontCard(pooled[hit]!, extra);
    else pooled.push(extra);
  }
  return orderSportSectionFront(pooled, page.path, edition);
}

/**
 * The front's score strip. Football turns the page on Thursday: from the
 * Thursday game through Monday night the strip is this week's slate, finals
 * filling in as they go; Tuesday and Wednesday it still carries last week.
 */
function weekdayName(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/Chicago",
  });
}

/** Yesterday’s college finals stand alone. The rest of the slate follows them. */
function finalsSplit(games: BoxGame[], edition: string): { yesterday: BoxGame[]; rest: BoxGame[]; title: string } {
  const yday = editionNewsDay(edition);
  const yesterday = games.filter((game) => game.final && game.day === yday);
  const seen = new Set(yesterday.map((game) => game.id));
  return {
    yesterday,
    rest: games.filter((game) => !seen.has(game.id)),
    title: `${weekdayName(yday)}’s finals`,
  };
}

function stripFor(path: string, board: SectionBoard | null, edition: string): { title: string; games: BoxGame[] }[] {
  const bands = sportScoreBands(path, board, edition);
  if (bands.length) return bands;
  if (!board) return [];
  if (board.slate.length) return [{ title: "Upcoming fixtures", games: board.slate }];
  if (board.prior?.length) return [{ title: "Recent results", games: [...board.prior].reverse() }];
  return [];
}

function boxGameKeys(game: {
  id?: string | null;
  espnEventId?: string | null;
  gamePk?: string | number | null;
  away?: { abbrev?: string | null };
  home?: { abbrev?: string | null };
  day?: string | null;
}): string[] {
  const pair = `${game.away?.abbrev ?? ""}-${game.home?.abbrev ?? ""}-${game.day ?? ""}`;
  return [
    ...new Set(
      [game.id, game.espnEventId, game.gamePk != null ? String(game.gamePk) : null, pair !== "--" ? pair : null].filter(
        (key): key is string => Boolean(key),
      ),
    ),
  ];
}

function boxGameKey(game: {
  id?: string | null;
  espnEventId?: string | null;
  gamePk?: string | number | null;
  away?: { abbrev?: string | null };
  home?: { abbrev?: string | null };
  day?: string | null;
}): string {
  return boxGameKeys(game)[0] ?? "";
}

function deskFolio(page: SportFrontPage, focus: SportFrontPage["focus"], fallback: string): string {
  return page.sectionDesks?.find((d) => d.focus === focus)?.folio ?? fallback;
}

/** Section front: flag already printed, then the lead, secondaries, and a scores rail. */
function SportSectionFront({
  page,
  board,
  leagueClubs,
  standings,
  edition,
  playoffs,
  leaders,
  leftover,
  snaps,
  coaches,
  heisman,
  poll,
  alreadyOnA1,
  onTurn,
}: {
  page: SportFrontPage;
  board: SectionBoard | null;
  leagueClubs: LeagueClub[];
  standings: StandGroup[];
  edition: string;
  playoffs: MlbPlayoffTree | null;
  leaders: LeagueLeaderGroup[];
  heisman?: HeismanBoard | null;
  poll: CfbPollRow[];
  leftover?: GameWrapCard[];
  snaps?: TeamSnapshot[];
  coaches?: FavoriteCoachTile[];
  alreadyOnA1?: GameWrapCard[];
  onTurn: (folio: string) => void;
}) {
  const open = useReader();
  const strips = stripFor(page.path, board, edition);
  const football = page.path.startsWith("football/");
  const soccer = page.path.startsWith("soccer/");
  const cfb = page.path.includes("college-football");
  const mlb = page.path === "baseball/mlb";
  const finals = football ? [...(board?.results ?? []), ...(board?.prior ?? [])] : board?.results ?? [];
  const recent = soccer || football ? [...finals].reverse() : finals;
  const stories = mergeFrontStories(page, board, edition, { leftover, snaps, coaches });
  const folios = Object.fromEntries(page.articles.map((a) => [a.card.id, a.folio]));
  const pointer = stories.find((c) => alreadyOnSectionA(c, alreadyOnA1 ?? [])) ?? null;
  const lead = stories.find((c) => !pointer || (c.id !== pointer.id && !sameGameStory(c, pointer))) ?? null;
  const rest = stories.filter((c) => c !== lead && c !== pointer);
  const underLead = rest.slice(0, cfb || mlb ? 2 : 1);
  const railSeconds = rest.slice(underLead.length, underLead.length + (cfb || mlb ? 1 : 3));
  const more = rest.slice(underLead.length + railSeconds.length, underLead.length + railSeconds.length + (cfb || mlb ? 3 : 5));
  const leadGame = lead ? gameForCard(lead, recent, page.clubs) : null;
  const recapsFolio = page.sectionDesks?.find((d) => d.focus === "recaps")?.folio ?? null;
  const crestFor = (card: GameWrapCard) =>
    leagueClubs.find((c) => c.short && card.teamName?.toLowerCase().includes(c.short.toLowerCase()))?.logo ?? null;
  const frontStrips = strips.slice(0, cfb || mlb ? 1 : 2).map((strip) => ({
    ...strip,
    games: strip.games.slice(0, cfb ? 12 : mlb ? 8 : 10),
  }));
  const railGames = frontStrips.flatMap((s) => s.games);
  const favIds = new Set(leagueClubs.filter((c) => c.favorite).map((c) => c.id));
  const mine = (row: { id: string; name: string }) => favIds.has(row.id);
  const mlbPost =
    mlb && Boolean(playoffs?.active || playoffs?.rounds.some((round) => round.series.length));
  const tables = mlbPost ? [] : rankStandings(standings).slice(0, 2);
  const stripIds = new Set(frontStrips.flatMap((strip) => strip.games.flatMap((g) => boxGameKeys(g))));
  const leadKeys = new Set(leadGame ? boxGameKeys(leadGame) : []);
  const otherScores = recent.filter((g) => {
    const keys = boxGameKeys(g);
    return keys.length > 0 && keys.every((key) => !leadKeys.has(key) && !stripIds.has(key));
  });
  const fixtures = (board?.slate ?? []).filter((g) => !g.final && !g.live);
  const printableLeaders = leaders.filter(leaderGroupHasValidData).slice(0, 4);
  const gameOf = (card: GameWrapCard) => gameForCard(card, recent, page.clubs);

  return (
    <div className="tt-section-front">
      {lead ? (
        <div className={cn("tt-front-grid", (underLead.length || railSeconds.length || railGames.length) && "with-side")}>
          <div className="tt-front-lead">
            {pointer ? (
              <p className="tt-section-pointer">
                <button type="button" className="wsj-a" onClick={() => onTurn("A1")}>
                  {a1PointerLine(pointer)}, page A1
                </button>
              </p>
            ) : null}
            <Story
              className="lead"
              card={lead}
              text={splitStoryCopy(cardCopy(lead), 640).teaser}
              size="xl"
              cols={1}
              art="top"
              drop
              readOn
              chrome={false}
              jump={folios[lead.id] && folios[lead.id] !== page.folio ? folios[lead.id] : undefined}
              onTurn={onTurn}
            />
            {leadGame && !isSingleGameRecap(lead) ? (
              <div className="tt-front-banner">
                <ScoreMast game={leadGame} />
                <Linescore game={leadGame} compact />
              </div>
            ) : null}
            {underLead.length ? (
              <div className="tt-front-under">
                {underLead.map((card, i) => (
                  <div key={card.id} {...(i === 0 ? { "data-tt-keep": "" } : { "data-tt-flow": "" })}>
                    <Story
                      card={card}
                      text={
                        recapDek(card, 4) ||
                        wrapBriefCopy(card, 4) ||
                        gameOf(card)?.recap?.blurb ||
                        recapDek(card, 2)
                      }
                      size="md"
                      art={i === 0 && card.photo ? "top" : "none"}
                      readOn
                      chrome={false}
                      jump={folios[card.id] && folios[card.id] !== page.folio ? folios[card.id] : undefined}
                      onTurn={onTurn}
                    />
                  </div>
                ))}
              </div>
            ) : football && !cfb && fixtures.length ? (
              <section className="tt-front-under" aria-label="This week">
                <h3 className="wsj-band-title">
                  {board?.slateWeekNumber ? `Week ${board.slateWeekNumber}` : "This week"} <em>kickoffs</em>
                </h3>
                <div className="tt-slate-list cols-2">
                  {fixtures.slice(0, 6).map((g) => (
                    <SlateLine key={g.id} game={g} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
          <div className="tt-front-side">
            {railSeconds.length ? (
              <div className="wsj-sport-seconds" data-tt-flow="">
                {railSeconds.map((card) => (
                  <Story
                    key={card.id}
                    card={card}
                    text={recapDek(card, 3)}
                    size="md"
                    art="top"
                    readOn
                    chrome={false}
                    jump={folios[card.id] && folios[card.id] !== page.folio ? folios[card.id] : undefined}
                    onTurn={onTurn}
                  />
                ))}
              </div>
            ) : null}
            {frontStrips.length ? (
              <div className="tt-front-rails">
                {frontStrips.map((strip) => (
                  <section className="tt-front-rail" aria-label={strip.title} key={strip.title}>
                    <h3 className="wsj-band-title">
                      {strip.title}
                      {recapsFolio ? (
                        <button type="button" className="tt-band-link" onClick={() => onTurn(recapsFolio)}>
                          Recaps, page {recapsFolio} →
                        </button>
                      ) : null}
                    </h3>
                    <ScoreStrip
                      games={strip.games}
                      onOpen={(g) => {
                        const card = stampBoardCard(g, page.clubs);
                        if (card) open({ card, game: g });
                        else if (recapsFolio) onTurn(recapsFolio);
                      }}
                    />
                  </section>
                ))}
              </div>
            ) : null}
            {cfb && (poll.length || standings.length) ? (
              <CfbFill poll={poll} standings={standings} heisman={heisman} compact />
            ) : null}
          </div>
        </div>
      ) : (
        <div className={cn("tt-front-grid", (railGames.length || tables.length) && "with-side")} data-tt-keep="">
          <div className="tt-front-lead">
            {mlbPost ? (
              <PlayoffDesk tree={playoffs} />
            ) : tables[0] ? (
              <StandingsTable group={tables[0]} mine={mine} />
            ) : (
              <p className="wsj-empty">The league wire is quiet. Scores, tables and the slate follow.</p>
            )}
          </div>
          {frontStrips.length || tables.length > 1 ? (
            <div className="tt-front-side">
              {frontStrips.length ? (
                <div className="tt-front-rails">
                  {frontStrips.map((strip) => (
                    <section className="tt-front-rail" aria-label={strip.title} key={strip.title}>
                      <h3 className="wsj-band-title">
                        {strip.title}
                        {recapsFolio ? (
                          <button type="button" className="tt-band-link" onClick={() => onTurn(recapsFolio)}>
                            Recaps, page {recapsFolio} →
                          </button>
                        ) : null}
                      </h3>
                      <ScoreStrip
                        games={strip.games}
                        onOpen={(g) => {
                          const card = stampBoardCard(g, page.clubs);
                          if (card) open({ card, game: g });
                          else if (recapsFolio) onTurn(recapsFolio);
                        }}
                      />
                    </section>
                  ))}
                </div>
              ) : null}
              {tables.slice(1).map((group) => (
                <StandingsTable key={group.name} group={group} mine={mine} />
              ))}
            </div>
          ) : null}
        </div>
      )}
      {mlbPost && lead ? (
        <div className="tt-front-fill">
          <PlayoffDesk tree={playoffs} compact />
        </div>
      ) : null}
      {more.length ? (
        <div data-tt-flow="">
          <BriefGrid
            cards={more}
            title="Also in this section"
            folios={folios}
            here={page.folio}
            onTurn={onTurn}
            crestFor={crestFor}
          />
        </div>
      ) : null}
      {cfb && !lead && (poll.length || standings.length) ? (
        <div data-tt-flow="">
          <CfbFill poll={poll} standings={standings} heisman={heisman} />
        </div>
      ) : null}
      {soccer || (mlb && otherScores.length) || (!cfb && !mlb && printableLeaders.length) ? (
      <div className="tt-front-fill">
        {mlb && otherScores.length ? (
          <section className="tt-front-rail" aria-label="Other scores" data-tt-flow="">
            <h3 className="wsj-band-title">
              The rest of the postseason
              <button type="button" className="tt-band-link" onClick={() => onTurn(deskFolio(page, "playoffs", `${page.section}2`))}>
                Bracket, page {deskFolio(page, "playoffs", `${page.section}2`)} →
              </button>
            </h3>
            <ScoreStrip
              games={otherScores.slice(0, 8)}
              onOpen={(g) => {
                const card = stampBoardCard(g, page.clubs);
                if (card) open({ card, game: g });
              }}
            />
          </section>
        ) : null}
        {soccer ? (
          <>
            {lead
              ? tables.slice(0, 1).map((group) => (
                  <div key={group.name} data-tt-flow="">
                    <StandingsTable group={group} mine={mine} />
                  </div>
                ))
              : null}
            {tables.length > 1 ? (
              <div data-tt-flow="">
                {tables.slice(1).map((group) => (
                  <StandingsTable key={group.name} group={group} mine={mine} />
                ))}
              </div>
            ) : null}
            {otherScores.length ? (
              <section className="tt-front-rail" aria-label="Recent results" data-tt-flow="">
                <h3 className="wsj-band-title">Recent results</h3>
                <ScoreStrip
                  games={otherScores.slice(0, 8)}
                  onOpen={(g) => {
                    const card = stampBoardCard(g, page.clubs);
                    if (card) open({ card, game: g });
                  }}
                />
              </section>
            ) : null}
            {fixtures.length ? (
              <section className="tt-front-fixtures" aria-label="Upcoming fixtures" data-tt-flow="">
                <h3 className="wsj-band-title">Upcoming fixtures</h3>
                <ul className="tt-fixture-dates">
                  {fixtures.slice(0, 8).map((g) => (
                    <li key={g.id}>
                      <time dateTime={g.startIso ?? undefined}>
                        {(g.startIso && formatFixtureWhen(g.startIso)) || g.status}
                      </time>
                      <b>
                        {g.away.abbrev} at {g.home.abbrev}
                      </b>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
        {!cfb && !mlb && printableLeaders.length ? (
          <section className="tt-lleaders tt-front-leaders" aria-label="League leaders" data-tt-flow="">
            <h3 className="wsj-band-title">Leaders</h3>
            <div className="tt-lleaders-grid">
              {printableLeaders.map((group) => (
                <div key={group.category} className="tt-lleaders-cat">
                  <h4>{leaderCategoryLabel(group.category)}</h4>
                  <ol>
                    {group.rows.slice(0, 10).map((row, i) => (
                      <li key={`${group.category}-${row.name}`} {...(i >= 5 ? { "data-tt-trim": 30 + i } : {})}>
                        {row.headshot ? <img src={row.headshot} alt="" /> : <span className="tt-lleaders-ph" />}
                        <span className="tt-lleaders-who">
                          <strong>{row.name}</strong>
                          <em>{row.team}</em>
                        </span>
                        <span className="tt-lleaders-val">
                          <b>{row.line}</b>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

/** League news desk: last night's board, then the stories with their art. */
function SportNewsDesk({
  page,
  board,
  edition,
  onTurn,
}: {
  page: SportFrontPage;
  board: SectionBoard | null;
  leagueClubs: LeagueClub[];
  edition: string;
  onTurn: (folio: string) => void;
}) {
  const open = useReader();
  const strips = stripFor(page.path, board, edition);
  const football = page.path.startsWith("football/");
  const finals = football ? [...(board?.results ?? []), ...(board?.prior ?? [])] : board?.results ?? [];
  const recent = page.path.startsWith("soccer/") || football ? [...finals].reverse() : finals;
  const gameById = new Map<string, BoxGame>();
  // Recaps of games your clubs played run in Section A; the league desk takes the rest.
  const newsContinue = (page.newsSlice?.offset ?? 0) > 0;
  const recapCards = newsContinue || page.path === "baseball/mlb"
    ? []
    : recent
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
  const withArt = stories.filter((c) => c.photo);
  const lead = withArt[0] ?? stories[0] ?? null;

  const showStrip = !page.path.includes("college-football");
  return (
    <div className="wsj-sport-news">
      {showStrip && strips.map((strip) =>
        strip.games.length ? (
          <section className="tt-strip-wrap" key={strip.title}>
            <h3 className="wsj-band-title">
              {strip.title}
              <button type="button" className="tt-band-link" onClick={() => onTurn(deskFolio(page, "recaps", `${page.section}2`))}>
                Box scores, page {deskFolio(page, "recaps", `${page.section}2`)} →
              </button>
            </h3>
            <ScoreStrip
              games={strip.games}
              onOpen={(g) => {
                const card = boxStoryCard(g);
                if (card) open({ card, game: g });
                else onTurn(deskFolio(page, "recaps", `${page.section}2`));
              }}
            />
          </section>
        ) : null,
      )}
      {lead ? (
        <Broadsheet cards={[lead, ...stories.filter((c) => c !== lead)]} games={gameById} label="Around the league" />
      ) : (
        <p className="wsj-empty">The league wire is quiet. Scores, tables and the slate follow.</p>
      )}
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

/** The final as a graphic: each club in its colors, the score set big. */
function ScoreHero({ game, size = "lg" }: { game: BoxGame; size?: "lg" | "md" }) {
  return (
    <div className={cn("tt-hero", size)}>
      {[game.away, game.home].map((side, i) => (
        <div
          key={i}
          className={cn("tt-hero-side", side.winner && "won", game.final && !side.winner && "lost")}
          style={tint(hexColor(side.color) ?? "#1f2a44")}
        >
          {side.logo ? <img className="tt-hero-ghost" src={side.logo} alt="" aria-hidden="true" /> : null}
          <span className="tt-hero-disc">
            <TeamLogo src={side.logo} size="lg" />
          </span>
          <span className="tt-hero-id">
            <em>{i === 0 ? "Away" : "Home"}</em>
            <strong>{side.short}</strong>
            {side.record ? <i>{side.record}</i> : null}
          </span>
          <b className="tt-hero-score">{side.score ?? "–"}</b>
        </div>
      ))}
      <span className="tt-hero-state">{gameClock(game)}</span>
    </div>
  );
}

type Star = { person: BoxPerson; label: string; team: string | null; game: BoxGame };

/** The night's best lines, one from each game before anyone gets a second. */
function starsOf(games: BoxGame[], max = 8): Star[] {
  const lists = games.map((g) => [
    ...g.decisions
      .filter((d) => d.label !== "L")
      .map((d) => ({ person: d.person, label: d.label === "W" ? "Winner" : "Save", team: null, game: g })),
    ...g.leaders.map((l) => ({ person: l as BoxPerson, label: l.label, team: l.team, game: g })),
  ]);
  const out: Star[] = [];
  const seen = new Set<string>();
  for (let round = 0; out.length < max && lists.some((l) => l.length > round); round++) {
    for (const list of lists) {
      const star = list[round];
      if (!star || !star.person.headshot || seen.has(star.person.name) || out.length >= max) continue;
      seen.add(star.person.name);
      out.push(star);
    }
  }
  return out;
}

function StarsBand({ games, title = "Stars of the night" }: { games: BoxGame[]; title?: string }) {
  const stars = starsOf(games);
  if (stars.length < 2) return null;
  return (
    <section className="tt-stars-wrap">
      <h3 className="wsj-band-title">{title}</h3>
      <ul className="tt-stars" style={{ ["--cols" as string]: String(balancedCols(stars.length, [4, 3, 5, 2])) }}>
        {stars.map((s) => (
          <li key={`${s.game.id}-${s.person.name}`}>
            <Face person={s.person} size="lg" />
            <span>
              <em>
                {s.label}
                {s.team ? ` · ${s.team}` : ` · ${s.game.away.abbrev}–${s.game.home.abbrev}`}
              </em>
              <strong>
                <PlayerName name={s.person.name} href={s.person.id ? playerPageHref(s.game.path, s.person.id) : null} />
              </strong>
              {s.person.line ? <i>{s.person.line}</i> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WrapPlayers({ card }: { card: GameWrapCard }) {
  const files = useContext(SubjectsContext)[card.id] ?? [];
  const stats = card.stats.slice(0, 6);
  const leaders = card.leaders.slice(0, 4);
  if (!files.length && !stats.length && !leaders.length) return null;
  return (
    <aside className="wsj-story-facts" aria-label="The box">
      {stats.length ? (
        <dl>
          {stats.map((s) => (
            <div key={`${s.label}-${s.value}`}>
              <dd>{s.value}</dd>
              <dt>{s.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      {files.length || leaders.length ? (
        <section className="tt-files">
          <h4 className="tt-files-h">The box</h4>
          <ul>
            {files.length
              ? files.slice(0, 4).map((f) => (
                  <li key={f.href}>
                    <span className="tt-files-face">
                      {f.headshot ? <img src={f.headshot} alt="" loading="lazy" /> : <b>{initials(f.name)}</b>}
                    </span>
                    <span className="tt-files-copy">
                      <strong>
                        <PlayerName name={f.name} href={f.href} />
                      </strong>
                      <em>{[f.position, f.team].filter(Boolean).join(" · ")}</em>
                      {f.line ? <span>{f.line}</span> : null}
                    </span>
                  </li>
                ))
              : leaders.map((l) => (
                  <li key={`${l.name}-${l.line}`}>
                    <span className="tt-files-face">
                      <b>{initials(l.name)}</b>
                    </span>
                    <span className="tt-files-copy">
                      <strong>
                        <PlayerName name={l.name} href={l.href} />
                      </strong>
                      <span>{l.line}</span>
                    </span>
                  </li>
                ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

function WrapBrief({
  card,
  trim,
  path,
  flow,
}: {
  card: GameWrapCard;
  trim?: number;
  path?: string;
  flow?: boolean;
}) {
  const lookup = useContext(GameLookup);
  const game = isSingleGameRecap(card) ? lookup(card) : null;
  const copy = wrapBriefCopy(card, 4);
  const recap =
    isSingleGameRecap(card) &&
    Boolean((card.scoreLine && /\d/.test(card.scoreLine)) || card.recapGame || game);
  const brief = recap && recapIsScoreOnly(copy) ? "" : recap ? recapBodyForPage(copy) : copy;
  return (
    <article
      className="tt-wrap-brief"
      data-tt-keys={storyReadKeys(card).join("|")}
      data-tt-title={card.headline}
      {...(trim != null ? { "data-tt-trim": trim } : {})}
      {...(flow ? { "data-tt-flow": "" } : {})}
    >
      <Kicker card={card} />
      <h3 className="wsj-hl sm">
        <HeadlineSave card={card}>
          <StoryLink card={card} game={game}>{card.headline}</StoryLink>
        </HeadlineSave>
      </h3>
      {recap ? <RecapChrome card={card} game={game} compact /> : <ScoreBug card={card} />}
      {brief ? (
        <p className="tt-wrap-copy">
          {brief}
        </p>
      ) : null}
      {recap ? null : <WrapPlayers card={card} />}
      {card.related?.length ? (
        <ul className="tt-wrap-related">
          {card.related
            .filter((item) => !path || relatedFitsSection(item, path))
            .map((item) => (
            <li key={item.id}>
              <em>{item.source || "Related"}</em>
              {item.headline}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function wrapColumnWeight(card: GameWrapCard): number {
  return 90 + Math.min(420, Math.floor((card.body?.length ?? 0) / 8)) + (card.photo ? 160 : 0);
}

function balanceWrapColumns(cards: GameWrapCard[], n = 3): GameWrapCard[][] {
  const cols = Array.from({ length: n }, () => [] as GameWrapCard[]);
  const weights = Array.from({ length: n }, () => 0);
  for (const card of cards) {
    let i = 0;
    for (let c = 1; c < n; c++) if ((weights[c] ?? 0) < (weights[i] ?? 0)) i = c;
    cols[i]!.push(card);
    weights[i] = (weights[i] ?? 0) + wrapColumnWeight(card);
  }
  return cols;
}

function WrapFlow({ cards, path }: { cards: GameWrapCard[]; path: string }) {
  if (!cards.length) return null;
  const shown: GameWrapCard[] = [];
  const notes: NonNullable<GameWrapCard["related"]> = [];
  for (const card of cards) {
    if (!storyFitsSection(card, path)) continue;
    if (shown.some((prev) => prev.id === card.id || sameGameStory(prev, card))) continue;
    for (const item of card.related ?? []) {
      if (path && !relatedFitsSection(item, path)) continue;
      if (notes.some((n) => n.id === item.id || n.headline === item.headline)) continue;
      notes.push(item);
    }
    shown.push({ ...card, related: undefined });
    if (shown.length >= 6) break;
  }
  const cols = balanceWrapColumns(shown, 3);
  const colNotes = cols.map(() => [] as typeof notes);
  const weights = cols.map((col) => col.reduce((sum, card) => sum + wrapColumnWeight(card), 0));
  for (const note of notes) {
    let i = 0;
    for (let c = 1; c < weights.length; c++) if ((weights[c] ?? 0) < (weights[i] ?? 0)) i = c;
    colNotes[i]!.push(note);
    weights[i] = (weights[i] ?? 0) + 40;
  }
  return (
    <div className="tt-wrap-flow">
      {cols.map((col, i) => (
        <div key={i} className="tt-wrap-col">
          {col.map((card, j) => (
            <WrapBrief key={card.id} card={card} path={path} trim={45 + i * 10 + j} flow={j > 1} />
          ))}
          {colNotes[i]!.length ? (
            <ul className="tt-wrap-related" data-tt-flow="">
              {colNotes[i]!.map((item) => (
                <li key={item.id}>
                  <em>{item.source || "Related"}</em>
                  {item.headline}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FeatureArt({ url, onGone }: { url: string; onGone: () => void }) {
  const photo = useStoryImage(url, onGone);
  if (photo.hidden) return null;
  return <img src={photo.src} alt="" loading="lazy" onError={photo.onError} />;
}

/** Box scores: the best game set large with its recap, the rest in agate. */
function ScoresDesk({
  page,
  board,
  active,
  edition,
}: {
  page: SportFrontPage;
  board: SectionBoard | null;
  active: boolean;
  edition: string;
}) {
  const open = useReader();
  const [featurePhotoDead, setFeaturePhotoDead] = useState(false);
  const filedWraps = page.articles
    .map((a) => a.card)
    .filter((c) => storyFitsSection(c, page.path) && (isGameWrap(c) || isRecapStory(c) || Boolean(c.scoreLine)));
  const football = page.path.startsWith("football/");
  const college = page.path.includes("college-football");
  const flip = football || page.path.startsWith("soccer/");
  const current = flip ? [...(board?.results ?? [])].reverse() : board?.results ?? [];
  const prior = football && !college ? [...(board?.prior ?? [])].reverse() : [];
  const games = current.length ? current : prior;
  const boardWraps = college
    ? games.flatMap((g) => {
        const card = boxStoryCard(g);
        if (!card || !storyFitsSection(card, page.path)) return [];
        if (filedWraps.some((prev) => prev.id === card.id || sameGameStory(prev, card))) return [];
        return [card];
      }).slice(0, Math.max(0, 6 - filedWraps.length))
    : [];
  const wrapCards = [...filedWraps, ...boardWraps];
  if (!board && !wrapCards.length) return <p className="wsj-empty">Setting the box scores…</p>;
  const behind = current.length ? prior : [];
  if (!games.length && !wrapCards.length) {
    return (
      <p className="wsj-empty">
        No finals on the board — the schedule is on page {deskFolio(page, "schedule", `${page.section}4`)}.
      </p>
    );
  }
  if (!games.length) {
    return (
      <div className="tt-scores">
        <WrapFlow cards={wrapCards} path={page.path} />
      </div>
    );
  }
  const collegeSplit = college ? finalsSplit(games, edition) : null;
  const featuredPool = collegeSplit?.yesterday.length ? collegeSplit.yesterday : games;
  const featured =
    featuredPool.find((g) => g.recap?.photo && !involvesClub(g, page.clubs)) ??
    featuredPool.find((g) => g.recap) ??
    featuredPool[0]!;
  const rest = collegeSplit ? [] : wrapCards.length ? games : games.filter((g) => g !== featured);
  const yesterdayRest = collegeSplit?.yesterday.filter((g) => g !== featured) ?? [];
  const weekRest = collegeSplit?.rest.filter((g) => g.final && g !== featured) ?? [];
  const card = boxStoryCard(featured);
  const isMlb = page.path === "baseball/mlb";
  const photo = featured.recap?.photo ?? null;
  const showFeaturePhoto = Boolean(photo) && !featurePhotoDead;
  const sparse = games.length < 7;
  const ahead = college
    ? []
    : (board?.slate ?? []).filter((g) => !g.final && !g.live).slice(0, sparse ? 6 : 0);
  const restTitle = football
    ? current.length
      ? `${board?.weekLabel ?? "This week"} results`
      : `${board?.priorLabel ?? "Last week"} results`
    : isMlb
      ? "Box scores"
      : "Results";
  return (
    <div className="tt-scores">
      {wrapCards.length ? <WrapFlow cards={wrapCards} path={page.path} /> : null}
      {!wrapCards.length ? (
      <article
        className={cn("tt-feature", !showFeaturePhoto && "graphic")}
        {...(card
          ? {
              "data-tt-keys": storyReadKeys(card).join("|"),
              "data-tt-title": card.headline,
            }
          : {})}
      >
        {showFeaturePhoto ? (
          <figure className="tt-feature-photo">
            <FeatureArt url={photo!} onGone={() => setFeaturePhotoDead(true)} />
            <figcaption>
              {featured.away.name} at {featured.home.name}
              {featured.venue ? `, ${featured.venue}` : ""}.
            </figcaption>
          </figure>
        ) : (
          <ScoreHero game={featured} />
        )}
        <div className="tt-feature-copy">
          <p className="wsj-kicker">
            {[featured.league, featured.round, featured.series].filter(Boolean).join(" · ") || "Game of the night"}
          </p>
          <h2 className="wsj-hl lg">
            {card ? (
              <HeadlineSave card={card}>
                <button type="button" className="wsj-a wsj-story-link" onClick={() => open({ card, game: featured })}>
                  {card.headline}
                </button>
              </HeadlineSave>
            ) : (
              `${featured.away.short} ${featured.away.score ?? ""}, ${featured.home.short} ${featured.home.score ?? ""}`
            )}
          </h2>
          {featured.recap?.blurb ? (
            <p className="wsj-dek">
              <NamedText text={featured.recap.blurb} />
            </p>
          ) : null}
          {showFeaturePhoto ? <ScoreHero game={featured} size="md" /> : null}
          <Linescore game={featured} />
          <Decisions game={featured} faces />
          <Leaders game={featured} max={4} />
          <Goals game={featured} />
          {card ? (
            <p className="wsj-jump">
              <button type="button" className="wsj-jump-btn" onClick={() => open({ card, game: featured })}>
                {featured.recap ? "Click for full story" : "Box score"} <span aria-hidden="true">→</span>
              </button>
            </p>
          ) : null}
        </div>
      </article>
      ) : null}
      {isMlb && !wrapCards.length ? <MlbAgate game={featured} enabled={active} /> : null}
      {[
        { title: collegeSplit?.title ?? "", rows: yesterdayRest, count: collegeSplit?.yesterday.length ?? 0 },
        { title: "Rest of the week", rows: weekRest, count: weekRest.length, flow: true },
      ].map((band) =>
        band.rows.length ? (
          <section className="tt-results" key={band.title} {...(band.flow ? { "data-tt-flow": "" } : {})}>
            <h3 className="wsj-band-title">
              {band.title} <em>{band.count} {band.count === 1 ? "game" : "games"}</em>
            </h3>
            <div
              className="tt-score-grid"
              style={{ ["--cols" as string]: String(balancedCols(band.rows.length, [3, 2, 4])) }}
            >
              {band.rows.map((g, i) => (
                <div key={g.id} data-tt-trim={50 + i}>
                  <ScoreCard
                    game={g}
                    onOpen={(game) => {
                      const c = boxStoryCard(game);
                      if (c) open({ card: c, game });
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null,
      )}
      {rest.length ? (
        <section className="tt-results" data-tt-flow="">
          <h3 className="wsj-band-title">
            {restTitle} <em>{games.length} {games.length === 1 ? "game" : "games"}</em>
          </h3>
          <div
            className={cn("tt-score-grid", isMlb && "agate", sparse && "roomy")}
            style={{ ["--cols" as string]: String(isMlb ? 2 : balancedCols(rest.length, [3, 2, 4])) }}
          >
            {rest.map((g, i) => (
              <div key={g.id} data-tt-trim={50 + i}>
                <ScoreCard
                  game={g}
                  agate={isMlb}
                  agateEnabled={active}
                  onOpen={(game) => {
                    const c = boxStoryCard(game);
                    if (c) open({ card: c, game });
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {sparse ? <StarsBand games={games} /> : null}
      {behind.length ? (
        <section className="tt-strip-wrap" data-tt-flow="">
          <h3 className="wsj-band-title">{board?.priorLabel ?? "Last week"} finals</h3>
          <ScoreStrip
            games={behind}
            onOpen={(g) => {
              const c = boxStoryCard(g);
              if (c) open({ card: c, game: g });
            }}
          />
        </section>
      ) : null}
      {ahead.length ? (
        <section className="tt-ahead" data-tt-flow="">
          <h3 className="wsj-band-title">Up next</h3>
          <div className="tt-matchups" style={{ ["--cols" as string]: String(balancedCols(ahead.length, [3, 2, 4])) }}>
            {ahead.map((g, i) => (
              <div key={g.id} data-tt-trim={60 + i}>
                <MatchupCard game={g} />
              </div>
            ))}
          </div>
        </section>
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
  standings,
  heisman,
}: {
  page: SportFrontPage;
  board: SectionBoard | null;
  slate: LeagueSlateGame[];
  edition: string;
  standings: StandGroup[];
  heisman?: HeismanBoard | null;
}) {
  const college = page.path.includes("college-football");
  const pollQ = useQuery({
    queryKey: ["tt-cfb-ap-poll", edition],
    queryFn: fetchCfbApPoll,
    staleTime: 30 * 60_000,
    enabled: college,
  });
  const games = board?.slate ?? [];
  const nfl = page.path === "football/nfl";
  if (college) {
    return (
      <CfbScheduleDesk
        board={board}
        edition={edition}
        standings={standings}
        poll={pollQ.data ?? []}
        heisman={heisman}
      />
    );
  }
  if (games.length) {
    const label = (day: string) => dayHeading(day, edition);
    if (nfl) {
      const finals = (board?.week ?? board?.results ?? []).filter((g) => g.final);
      return (
        <div className="tt-sched-desk">
          <ScheduleAgate games={[...finals, ...games]} dayLabel={label} columns={3} roomy />
          {standings.length ? (
            <section className="tt-sched-snap roomy" data-tt-flow="">
              <h3 className="wsj-band-title">The standings</h3>
              <DeskSnap tables={standings} />
            </section>
          ) : null}
        </div>
      );
    }
    return (
      <div className="tt-sched-desk">
        <ScheduleAgate games={games} dayLabel={label} columns={3} roomy={games.length <= 24} />
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
  board,
  edition,
  sheets,
  onTurn,
}: {
  page: SportFrontPage;
  standings: StandGroup[];
  leagueClubs: LeagueClub[];
  board: SectionBoard | null;
  edition: string;
  sheets: Record<string, ClubSheet>;
  onTurn: (folio: string) => void;
}) {
  const scheduleFolio = deskFolio(page, "schedule", `${page.section}${isDeskPress(edition) ? 3 : 4}`);
  const college = page.path.includes("college");
  const upcoming = (board?.slate ?? []).filter((g) => !g.final && !g.live);
  const ordered = rankStandings(standings);
  const slice = page.standSlice;
  const shown = slice ? ordered.slice(slice.offset, slice.offset + slice.count) : ordered;
  const last = !slice || slice.offset + slice.count >= ordered.length;
  const ownSchedule = page.sectionDesks?.some((d) => d.focus === "schedule") ?? false;
  const boxes = last && !page.offseason ? Math.min(3, page.clubs.filter((c) => !clubFormIsThin(c)).length) : 0;
  const slate = last && !college ? (ownSchedule ? upcoming.slice(0, boxes ? 12 : 16) : upcoming) : [];
  const band =
    boxes || slate.length ? (
      <div className="tt-stand-band">
        {boxes ? (
          <section className="tt-stand-form" style={{ gridColumn: `span ${boxes}` }}>
            <h3 className="wsj-band-title">
              Your clubs {boxes > 1 ? <em>numbers, leaders and what’s next</em> : null}
            </h3>
            <ClubFormGrid clubs={page.clubs} sheets={sheets} columns={boxes} />
          </section>
        ) : null}
        {slate.length ? (
          <section className="tt-stand-sched" style={{ gridColumn: boxes && boxes < 3 ? `span ${3 - boxes}` : "1 / -1" }}>
            <h3 className="wsj-band-title">
              {ownSchedule ? "On the schedule" : "The schedule"}
              {ownSchedule ? (
                <button type="button" className="tt-band-link" onClick={() => onTurn(scheduleFolio)}>
                  Every game, page {scheduleFolio} →
                </button>
              ) : null}
            </h3>
            <ScheduleAgate
              games={slate}
              dayLabel={(day) => dayHeading(day, edition)}
              columns={boxes === 1 ? 3 : boxes === 2 ? 1 : 4}
            />
          </section>
        ) : null}
      </div>
    ) : null;
  if (!shown.length) {
    return band ?? (leagueClubs.length ? <LeagueFormGrid clubs={leagueClubs} /> : <ClubFormGrid clubs={page.clubs} sheets={sheets} />);
  }
  const favIds = new Set(leagueClubs.filter((c) => c.favorite).map((c) => c.id));
  const favNames = page.clubs.map((c) => squash(c.shortName));
  const mine = (row: { id: string; name: string }) =>
    favIds.has(row.id) || favNames.some((n) => n && squash(row.name) === n);
  const cols = Math.min(standColumns(page.path), shown.length);
  return (
    <>
      <div className={cn("tt-stand-cols", cols === 1 && "single")} style={{ ["--stand-cols" as string]: String(cols) }}>
        {shown.map((group) => (
          <div key={group.name} data-tt-flow="">
            <StandingsTable group={group} mine={mine} />
          </div>
        ))}
      </div>
      {band}
    </>
  );
}

/** In the offseason only the tables holding a followed club are worth the ink. */
function offseasonTables(standings: StandGroup[], page: SportFrontPage, leagueClubs: LeagueClub[]): StandGroup[] {
  const favIds = new Set(leagueClubs.filter((c) => c.favorite).map((c) => c.id));
  const favNames = page.clubs.map((c) => squash(c.shortName)).filter(Boolean);
  const mine = standings.filter((g) =>
    g.rows.some((r) => favIds.has(r.id) || favNames.some((n) => squash(r.name) === n)),
  );
  return mine.length ? mine : standings.slice(0, 2);
}

/** Passing yards, home runs, points — the league list, not one club's leaders. Rule-filed from ESPN. */
function LeadersDesk({ groups }: { groups: LeagueLeaderGroup[] }) {
  const printable = groups.filter(leaderGroupHasValidData);
  if (!printable.length) return <p className="wsj-empty">The league has not posted its leaders.</p>;
  const post = printable.some((g) => g.seasonType === 3);
  return (
    <section className="tt-lleaders tt-lleaders-desk" aria-label={post ? "Postseason leaders" : "League leaders"}>
      <div className="tt-lleaders-grid">
        {printable.map((group) => (
          <div key={group.category} className="tt-lleaders-cat">
            <h4>{leaderCategoryLabel(group.category)}</h4>
            <ol>
              {group.rows.map((row, i) => (
                <li
                  key={`${group.category}-${row.name}-${i}`}
                  className={i === 0 ? "lead" : undefined}
                  {...(i > 0 ? { "data-tt-trim": 35 + i } : {})}
                >
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

function SportFront({
  page,
  leagueClubs,
  board,
  standings,
  slate,
  playoffs,
  edition,
  active,
  hasPlayers,
  nights,
  coaches,
  sheets,
  leaders,
  heisman,
  leftover,
  snaps,
  alreadyOnA1,
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
  hasPlayers: boolean;
  nights: PlayerNight[];
  coaches: FavoriteCoachTile[];
  sheets: Record<string, ClubSheet>;
  leaders: LeagueLeaderGroup[];
  heisman?: HeismanBoard | null;
  leftover?: GameWrapCard[];
  snaps?: TeamSnapshot[];
  alreadyOnA1?: GameWrapCard[];
  onTurn: (folio: string) => void;
}) {
  const pollQ = useQuery({
    queryKey: ["tt-cfb-ap-poll", edition],
    queryFn: fetchCfbApPoll,
    staleTime: 30 * 60_000,
    enabled: page.path.includes("college-football"),
  });
  const poll = pollQ.data ?? [];
  const results = (board?.results.length || board?.prior?.length) ?? 0;
  const upcoming = board?.slate.length ?? slate.length;
  const newsDay = editionNewsDay(edition);
  const played = nights.filter((n) => n.day === newsDay).length;
  const turnFocus = page.turn?.focus;
  const turn =
    page.turn && turnFocus && (turnFocus !== "players" || hasPlayers)
      ? {
          folio: page.turn.folio,
          label: turnFocus === "teams" && page.offseason ? "Last season’s final standings" : TURN_LABELS[turnFocus],
        }
      : null;
  const postLeaders = leaders.some((g) => g.seasonType === 3);
  const blurb = {
    front: page.articles.length
      ? `${page.articles.length} ${page.articles.length === 1 ? "story" : "stories"} · ${results || upcoming ? `${results || upcoming} on the board` : "the night’s desk"}`
      : results
        ? `${results} ${results === 1 ? "final" : "finals"} · the night’s board`
        : "The section front",
    news: `${page.articles.length + results} stories and finals · ${leagueClubs.length || page.clubs.length} clubs`,
    recaps: page.articles.length
      ? `${page.articles.length} ${page.articles.length === 1 ? "wrap" : "wraps"} · every final in the window`
      : results
        ? `${results} ${results === 1 ? "final" : "finals"} · lines, decisions and the agate`
        : "Box scores",
    teams: (page.standSlice?.count ?? standings.length)
      ? `${page.standSlice?.count ?? standings.length} ${
          (page.standSlice?.count ?? standings.length) === 1 ? "table" : "tables"
        }${standings.length > (page.standSlice?.count ?? standings.length) ? ` · ${standings.length} in all` : ""} · your clubs marked`
      : "League tables",
    leaders: leaders.length
      ? `${leaders.length} categories · the top ${Math.max(...leaders.map((g) => g.rows.length), 5)} in each${postLeaders ? " · postseason" : ""}`
      : postLeaders
        ? "Postseason leaders"
        : "League leaders",
    schedule: upcoming ? `${upcoming} games ahead · probables, TV and venues` : "League calendar",
    playoffs: playoffs ? `${playoffs.season} postseason bracket` : "Postseason bracket",
    form: `${page.clubs.length} followed ${page.clubs.length === 1 ? "club" : "clubs"} · numbers, leaders, the table`,
    players: `${nights.length} followed · ${played} played last night`,
    opener: `${page.clubs.length} followed ${page.clubs.length === 1 ? "club" : "clubs"} · days to the first game`,
    coaches: coaches.length
      ? `${coaches.length} ${coaches.length === 1 ? "coach" : "coaches"} · this week’s desk`
      : "Favorite coaches",
  }[page.focus];
  const offStandings = page.offseason ? offseasonTables(standings, page, leagueClubs) : standings;
  const offBlurb =
    page.offseason && page.focus === "teams"
      ? `Last season’s final ${offStandings.length === 1 ? "table" : "tables"} · your clubs marked`
      : page.offseason && page.focus === "news"
        ? `Offseason · ${page.articles.length} stories · ${page.clubs.length} followed ${page.clubs.length === 1 ? "club" : "clubs"}`
        : blurb;

  return (
    <div className={cn("wsj-sport", `focus-${page.focus}`, page.offseason && "offseason")}>
      <SportHero
        page={page}
        leagueClubs={leagueClubs}
        blurb={offBlurb}
        deskTitle={page.focus === "leaders" && postLeaders ? "Postseason Leaders" : undefined}
      />
      <div className="wsj-sport-solo">
        {page.focus === "news" && page.offseason ? <OpenerBand page={page} /> : null}
        {page.focus === "front" ? (
          <SportSectionFront
            page={page}
            board={board}
            standings={standings}
            leagueClubs={leagueClubs}
            edition={edition}
            playoffs={playoffs}
            leaders={leaders}
            heisman={heisman}
            poll={poll}
            leftover={leftover}
            snaps={snaps}
            coaches={coaches}
            alreadyOnA1={alreadyOnA1}
            onTurn={onTurn}
          />
        ) : page.focus === "news" ? (
          <SportNewsDesk page={page} board={board} leagueClubs={leagueClubs} edition={edition} onTurn={onTurn} />
        ) : page.focus === "opener" ? (
          <OpenerDesk page={page} onTurn={onTurn} />
        ) : page.focus === "recaps" ? (
          <ScoresDesk page={page} board={board} active={active} edition={edition} />
        ) : page.focus === "teams" ? (
          <StandingsDesk
            page={page}
            standings={offStandings}
            leagueClubs={leagueClubs}
            board={page.offseason ? null : board}
            edition={edition}
            sheets={sheets}
            onTurn={onTurn}
          />
        ) : page.focus === "leaders" ? (
          <LeadersDesk groups={leaders} />
        ) : page.focus === "schedule" ? (
          <ScheduleDesk page={page} board={board} slate={slate} edition={edition} standings={standings} heisman={heisman} />
        ) : page.focus === "playoffs" ? (
          <>
            <PlayoffDesk tree={playoffs} />
            {!page.sectionDesks?.some((d) => d.focus === "schedule") && board?.slate.length ? (
              <section className="tt-stand-sched">
                <h3 className="wsj-band-title">The schedule</h3>
                <ScheduleAgate games={board.slate} dayLabel={(day) => dayHeading(day, edition)} columns={4} />
              </section>
            ) : null}
          </>
        ) : page.focus === "players" ? (
          <PlayersDesk nights={nights} newsDay={newsDay} />
        ) : page.focus === "coaches" ? (
          <CoachesDesk tiles={coaches} />
        ) : page.clubs.length ? (
          <>
            <ClubFormGrid clubs={page.clubs} sheets={sheets} />
            {leagueClubs.length ? (
              <section className="wsj-form-league">
                <h3 className="wsj-band-title">Around the league</h3>
                <LeagueFormGrid clubs={leagueClubs} />
              </section>
            ) : null}
          </>
        ) : (
          <LeagueFormGrid clubs={leagueClubs} />
        )}
      </div>
      {turn ? <TurnBar onTurn={onTurn} folio={turn.folio} label={turn.label} /> : null}
    </div>
  );
}

function nightWhen(night: PlayerNight, newsDay: string): string {
  if (!night.day) return "No games logged this season";
  if (night.day === newsDay) return "Last night";
  const d = new Date(`${night.day}T12:00:00Z`);
  return `Last game · ${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}`;
}

/** Every followed or tagged player in the section, with the line from his last game. */
function PlayersDesk({ nights, newsDay }: { nights: PlayerNight[]; newsDay: string }) {
  if (!nights.length) return <p className="wsj-empty">Pulling your players’ game logs…</p>;
  const ranked = rankNights(nights, newsDay);
  const played = ranked.filter((n) => n.day === newsDay);
  const rest = ranked.filter((n) => n.day !== newsDay);
  const card = (n: PlayerNight, big: boolean) => {
    const href = playerPageHref(n.player.path, n.player.id);
    return (
      <article key={`${n.player.path}-${n.player.id}`} className={cn("tt-pl", big && "big", n.day === newsDay && "played")}>
        <header>
          <span className="tt-pl-face">
            {n.headshot ? <img src={n.headshot} alt="" loading="lazy" /> : null}
          </span>
          <span className="tt-pl-id">
            <em>
              {[n.player.position, n.player.team].filter(Boolean).join(" · ")}
              {n.player.source === "tagged" ? " · Tagged" : ""}
            </em>
            <strong>
              <PlayerName name={n.player.name} href={href} />
            </strong>
            <span>{nightWhen(n, newsDay)}</span>
          </span>
        </header>
        {n.opponent ? (
          <p className="tt-pl-opp">
            {n.opponentLogo ? <img src={n.opponentLogo} alt="" loading="lazy" /> : null}
            <span>
              {n.homeAway ?? "vs"} {n.opponent}
            </span>
            {n.result ? <b className={cn(/^W/.test(n.result) ? "w" : /^L/.test(n.result) ? "l" : "")}>{n.result}</b> : null}
          </p>
        ) : null}
        {n.line ? <p className="tt-pl-line">{n.line}</p> : null}
        {n.cells.length ? (
          <dl className="tt-pl-cells">
            {n.cells.map((c) => (
              <div key={c.label}>
                <dd>{c.value}</dd>
                <dt>{c.label}</dt>
              </div>
            ))}
          </dl>
        ) : null}
      </article>
    );
  };
  return (
    <div className="tt-players">
      {played.length ? (
        <section>
          <h3 className="wsj-band-title">
            Last night <em>{played.length} played</em>
          </h3>
          <div className="tt-pl-grid big" style={{ ["--cols" as string]: String(balancedCols(played.length, [3, 2, 4])) }}>
            {played.map((n) => card(n, true))}
          </div>
        </section>
      ) : (
        <p className="wsj-empty">None of your players saw action last night. Their latest lines follow.</p>
      )}
      {rest.length ? (
        <section>
          <h3 className="wsj-band-title">
            {played.length ? "The rest of your list" : "Their last outings"} <em>{rest.length}</em>
          </h3>
          <div
            className={cn("tt-pl-grid", !played.length && "big")}
            style={{
              ["--cols" as string]: String(
                played.length ? balancedCols(rest.length, [4, 3, 5, 2]) : balancedCols(rest.length, [2, 3]),
              ),
            }}
          >
            {rest.map((n) => card(n, !played.length))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function lastGameLine(tile: FavoriteCoachTile): string | null {
  const g = tile.lastGame;
  if (!g) return null;
  const bits = [
    g.result,
    g.score,
    g.homeAway && g.opponent ? `${g.homeAway} ${g.opponent}` : g.opponent,
    g.date,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

function nextGameLine(tile: FavoriteCoachTile): string | null {
  const g = tile.nextGame;
  if (!g) return null;
  const match = g.homeAway && g.opponent ? `${g.homeAway} ${g.opponent}` : g.opponent;
  const bits = [match, g.kickoff, g.tv, g.line].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

/** Weekly desk: one tile per favorite coach. Mizzou runs wide when he is on the list. */
function CoachesDesk({ tiles }: { tiles: FavoriteCoachTile[] }) {
  if (!tiles.length) return <p className="wsj-empty">No favorite coaches on file this week.</p>;
  return (
    <div className="tt-coaches" style={{ ["--cols" as string]: "2" }}>
      {tiles.map((tile) => {
        const last = lastGameLine(tile);
        const next = nextGameLine(tile);
        const stat =
          tile.pointsForAvg || tile.pointsAgainstAvg
            ? [tile.pointsForAvg ? `${tile.pointsForAvg} PF` : null, tile.pointsAgainstAvg ? `${tile.pointsAgainstAvg} PA` : null]
                .filter(Boolean)
                .join(" · ")
            : null;
        return (
          <article
            key={`${tile.leaguePath}-${tile.coachId}`}
            className={cn("tt-coach", tile.featured && "featured")}
            style={tile.teamColor ? tint(tile.teamColor) : undefined}
          >
            <header>
              <CoachShot tile={tile} />
              <span className="tt-coach-id">
                <em>
                  {[tile.teamName, tile.rank != null ? `#${tile.rank}` : null, tile.standing].filter(Boolean).join(" · ")}
                </em>
                <strong>{tile.name}</strong>
                <span>
                  {[tile.record, tile.conferenceRecord ? `${tile.conferenceRecord} conf` : null].filter(Boolean).join(" · ") ||
                    "Record not posted"}
                </span>
              </span>
            </header>
            <div className="tt-coach-body">
              <div className="tt-coach-story">
                {last ? (
                  <p className={cn("tt-coach-last", tile.lastGame?.result === "W" && "w", tile.lastGame?.result === "L" && "l")}>
                    {tile.lastGame?.opponentLogo ? <img src={tile.lastGame.opponentLogo} alt="" /> : null}
                    <span>{last}</span>
                  </p>
                ) : null}
                {tile.lastGame?.summary ? <p className="tt-coach-sum">{tile.lastGame.summary}</p> : null}
                {next ? (
                  <p className="tt-coach-next">
                    <b>Next</b> {next}
                  </p>
                ) : null}
                {stat ? <p className="tt-coach-stat">{stat}</p> : null}
                {tile.featured ? null : <CoachFacts tile={tile} />}
              </div>
              {tile.featured ? (
                <aside className="tt-coach-aside">
                  <div className="tt-coach-lead">
                    <CoachLeadMark tile={tile} />
                    <CoachSeasonStrip tile={tile} />
                  </div>
                  <CoachFacts tile={tile} />
                </aside>
              ) : null}
            </div>
            <CoachSlate tile={tile} />
          </article>
        );
      })}
    </div>
  );
}

function CoachShot({ tile }: { tile: FavoriteCoachTile }) {
  const photo = tile.headshot;
  const logo = tile.teamLogo;
  if (!photo && !logo) return null;
  return (
    <span className="tt-coach-shot">
      <img className={photo ? "portrait" : "portrait logo-only"} src={photo || logo || ""} alt="" />
      {photo && logo ? (
        <span className="tt-coach-badge">
          <img src={logo} alt="" />
        </span>
      ) : null}
    </span>
  );
}

function CoachLeadMark({ tile }: { tile: FavoriteCoachTile }) {
  if (!tile.teamLogo) return null;
  return (
    <span className="tt-coach-mark">
      <img src={tile.teamLogo} alt="" />
    </span>
  );
}

function CoachSeasonStrip({ tile }: { tile: FavoriteCoachTile }) {
  const chips = tile.seasonStrip ?? [];
  if (!chips.length) return null;
  return (
    <div className="tt-coach-strip">
      <b>{tile.seasonYear ?? "Season"}</b>
      {chips.map((chip) => (
        <i key={chip.id} className={chip.result === "W" ? "w" : chip.result === "L" ? "l" : undefined}>
          {chip.result}
          {chip.opponentRank != null ? ` #${chip.opponentRank}` : ""} {chip.opponent}
        </i>
      ))}
    </div>
  );
}

function CoachSlate({ tile }: { tile: FavoriteCoachTile }) {
  const games = tile.slate ?? [];
  if (!games.length) return null;
  const recent = games.filter((g) => g.kind === "final");
  const upcoming = games.filter((g) => g.kind === "upcoming");
  const cols = recent.length && upcoming.length;
  return (
    <div className={cols ? "tt-coach-slate" : "tt-coach-slate one"}>
      {recent.length ? (
        <div>
          <b>Recent</b>
          <ol className={cols ? undefined : "flat"}>
            {recent.map((g) => (
              <li key={g.id} className={g.result === "W" ? "w" : g.result === "L" ? "l" : undefined}>
                {slateLine(g)}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {upcoming.length ? (
        <div>
          <b>Upcoming</b>
          <ol className={cols ? undefined : "flat"}>
            {upcoming.map((g) => (
              <li key={g.id}>{slateLine(g)}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function CoachFacts({ tile }: { tile: FavoriteCoachTile }) {
  const bits = coachFactLines(tile);
  if (!bits.length && !tile.sourceLabel && !tile.statusNote) return null;
  return (
    <>
      {bits.length ? (
        <ul className="tt-coach-facts">
          {bits.map((bit) => (
            <li key={bit}>{bit}</li>
          ))}
        </ul>
      ) : null}
      {tile.statusNote ? <p className="tt-coach-status">{tile.statusNote}</p> : null}
      {tile.sourceLabel ? (
        <p className="tt-coach-src">
          {tile.sourceUrl ? (
            <a href={tile.sourceUrl} target="_blank" rel="noreferrer">
              Salary: {tile.sourceLabel}
            </a>
          ) : (
            `Salary: ${tile.sourceLabel}`
          )}
        </p>
      ) : null}
    </>
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

function PlayoffDesk({ tree, compact }: { tree: MlbPlayoffTree | null; compact?: boolean }) {
  if (!tree || !tree.rounds.some((r) => r.series.length)) {
    return <p className="wsj-empty">Postseason bracket isn’t published yet.</p>;
  }
  return <PlayoffBracket tree={fillMlbPlayoffPlaceholders(tree)} compact={compact} />;
}

function ClubFormGrid({
  clubs,
  sheets = {},
  columns,
}: {
  clubs: ClubDesk[];
  sheets?: Record<string, ClubSheet>;
  columns?: number;
}) {
  if (!clubs.length) return <p className="wsj-empty">No clubs filed in this section yet.</p>;
  const thin = clubs.filter((club) => clubFormIsThin(club));
  const full = clubs.filter((club) => !clubFormIsThin(club));
  const cols = columns ?? Math.min(3, Math.max(full.length, 1));
  return (
    <>
    {thin.length ? (
      <ul className="wsj-form-soon">
        {thin.map((club) => (
          <li key={club.key} style={tint(club.color)}>
            <TeamLogo src={club.logo} size="sm" />
            <strong>{club.shortName}</strong>
            <em>
              {club.upcoming[0]
                ? `${club.upcoming[0].label}${club.upcoming[0].when ? ` · ${club.upcoming[0].when}` : ""}`
                : "Season opens soon"}
            </em>
          </li>
        ))}
      </ul>
    ) : null}
    {full.length ? (
    <div className="tt-tboxes" style={{ ["--cols" as string]: String(cols) }}>
      {full.map((club, i) => {
        const sheet = sheets[club.key];
        const stats = (sheet?.stats.length ? sheet.stats : club.stats).filter(printableFormStat).slice(0, 6);
        const leaders = sheet?.leaders.length
          ? sheet.leaders.map((l) => ({
              key: `${l.category}-${l.id}`,
              label: l.category,
              name: l.name,
              line: l.line,
              href: club.leaguePath ? playerPageHref(club.leaguePath, l.id) : null,
            }))
          : club.leaders.map((l) => ({
              key: l.name,
              label: null,
              name: l.name,
              line: l.line,
              href: l.href && l.href.startsWith("/") ? l.href : null,
            }));
        return (
          <article key={club.key} className="tt-tbox" style={tint(club.color)} {...(i >= cols ? { "data-tt-flow": "" } : {})}>
            <header className="tt-tbox-head">
              <TeamLogo src={club.logo} size="sm" />
              <h3>{club.shortName}</h3>
              <b>{club.record || "—"}</b>
              <p>
                {club.standing || "—"}
                {club.odds ? ` · playoff odds ${club.odds}` : ""}
              </p>
            </header>
            {stats.length ? (
              <dl className="tt-tbox-stats">
                {stats.map((s) => (
                  <div key={`${s.label}-${s.value}`}>
                    <dd>{s.value}</dd>
                    <dt>
                      {s.label}
                      <StatRank stat={s} />
                    </dt>
                  </div>
                ))}
              </dl>
            ) : null}
            {leaders.length ? (
              <table className="tt-tbox-table leaders">
                <caption>{sheet?.season ? `${sheet.season} leaders` : "Leaders"}</caption>
                <tbody>
                  {leaders.slice(0, 4).map((l) => (
                    <tr key={l.key}>
                      {l.label ? <th>{l.label}</th> : null}
                      <td>
                        <strong>
                          <PlayerName name={l.name} href={l.href} />
                        </strong>{" "}
                        <i>{l.line}</i>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {club.division.length ? (
              <table className="tt-tbox-table">
                <caption>{tableTitle(club.standing)}</caption>
                <tbody>
                  {club.division.slice(0, 8).map((row) => (
                    <tr key={`${row.rank}-${row.team}`} className={cn(row.me && "me")}>
                      <th>
                        {row.rank} {row.team}
                      </th>
                      <td>{row.record}</td>
                      <td>{row.gb && row.gb !== "-" && row.gb !== "0" ? row.gb : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <table className="tt-tbox-table">
              <caption>Next up</caption>
              <tbody>
                {club.upcoming.length ? (
                  club.upcoming.slice(0, 4).map((game) => (
                    <tr key={game.id}>
                      <th>{game.label}</th>
                      <td colSpan={2}>{game.when || "TBD"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <th>Nothing left on the calendar</th>
                  </tr>
                )}
              </tbody>
            </table>
          </article>
        );
      })}
    </div>
    ) : null}
    </>
  );
}

/* ───────────────────────── National News ───────────────────────── */

type NationalEditionPage = Extract<EditionPage, { kind: "national" }>;

function natDate(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function natCard(story: NationalStory): GameWrapCard {
  return nationalStoryCard(story);
}

function NationalNewsDesk({
  page,
  onTurn,
}: {
  page: NationalEditionPage;
  onTurn: (folio: string) => void;
}) {
  if (!page.stories.length) return null;
  const more = page.jumpFolio ?? (page.sectionPage < page.sectionCount ? `${page.section}${page.sectionPage + 1}` : null);
  const front = page.sectionPage === 1;
  return (
    <div className="tt-nat">
      <header className="wsj-sport-hero tt-nat-hero">
        <div className="wsj-sport-hero-mark">
          <span className="wsj-sport-code">{page.section}</span>
          <div>
            <h3>National News</h3>
            <p>
              {front ? page.editionLabel : "Inside the desk"} · {natDate(page.day)} · {page.stories.length}{" "}
              {page.stories.length === 1 ? "story" : "stories"}
              {page.sectionCount > 1 ? ` · ${page.folio}` : ""}
            </p>
          </div>
        </div>
      </header>
      {front ? (
        <p className="tt-nat-byline">
          The Times national desk · {page.editionLabel} · {natDate(page.day)}
        </p>
      ) : (
        <p className="tt-nat-byline">Continued from B{page.sectionPage - 1} · news only</p>
      )}
      <Broadsheet cards={page.stories.map(natCard)} label={front ? "Also in the news" : "More from the desk"} />
      {more ? <TurnBar onTurn={onTurn} folio={more} label="More national news" /> : null}
    </div>
  );
}

/* ───────────────────────── Missouri ───────────────────────── */

type MissouriEditionPage = Extract<EditionPage, { kind: "missouri" }>;

/** A Missouri item set as a story card, so the reader can pull and set it. */
function moCard(item: MoItem): GameWrapCard {
  return missouriStoryCard(item);
}

function moWhen(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const hours = Math.round((Date.now() - t) / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hr ago`;
  return new Date(t).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/** Feed snippets stop mid-word; end them on a sentence, or at least a word. */
function cleanDek(text: string): string {
  return truncateAtSentence(text, 420);
}

function MoSource({ item }: { item: MoItem }) {
  return (
    <p className="tt-mo-src">
      <b>{item.source}</b>
      {item.also?.length ? <span> · also {item.also.join(", ")}</span> : null}
      {moWhen(item.when) ? <em> · {moWhen(item.when)}</em> : null}
    </p>
  );
}

function MoStory({ item, size, trim }: { item: MoItem; size: "xl" | "md" | "sm"; trim?: number }) {
  const open = useReader();
  const card = moCard(item);
  const photo = useStoryImage(item.photo);
  const showPhoto = Boolean(item.photo) && size !== "sm" && !photo.hidden;
  return (
    <article
      className={cn("tt-mo-story", size, showPhoto && "has-photo")}
      data-tt-keys={storyReadKeys({ id: item.id, headline: item.headline, wrapHref: item.url }).join("|")}
      data-tt-title={item.headline}
      {...(trim != null ? { "data-tt-trim": trim } : {})}
    >
      {showPhoto ? (
        <button type="button" className="tt-mo-photo" onClick={() => open({ card })} aria-label={item.headline}>
          <img src={photo.src} alt="" loading="lazy" onError={photo.onError} />
        </button>
      ) : null}
      <div className="tt-mo-copy">
        <MoSource item={item} />
        <h3 className={cn("wsj-hl", size === "xl" ? "xl" : size === "md" ? "md" : "sm")}>
          <HeadlineSave card={card}>
            <button type="button" className="wsj-a wsj-story-link" onClick={() => open({ card })}>
              {item.headline}
            </button>
          </HeadlineSave>
        </h3>
        {item.dek && size !== "sm" ? <p className="tt-mo-dek">{cleanDek(item.dek)}</p> : null}
        <p className="wsj-jump">
          <button type="button" className="wsj-jump-btn" onClick={() => open({ card })}>
            Click for full story <span aria-hidden="true">→</span>
          </button>
        </p>
      </div>
    </article>
  );
}

function MissouriDesk({ page, onTurn }: { page: MissouriEditionPage; onTurn: (folio: string) => void }) {
  const items = page.items;
  const outlets = new Set(items.flatMap((i) => [i.source, ...(i.also ?? [])])).size;
  const flag = (
    <header className="wsj-sport-hero tt-mo-hero">
      <div className="wsj-sport-hero-mark">
        <span className="wsj-sport-code">{page.section}</span>
        <div>
          <h3>Missouri</h3>
          <p>
            {page.sectionPage === 1 ? "Statehouse and the state" : "Around the state"} · {items.length} stories · {outlets} outlets
          </p>
        </div>
      </div>
    </header>
  );
  const more = page.sectionPage < page.sectionCount ? `${page.section}${page.sectionPage + 1}` : null;
  if (page.sectionPage > 1) {
    return (
      <div className="tt-mo">
        {flag}
        <div className="tt-mo-briefs">
          {items.map((item, i) => (
            <MoStory key={item.id} item={item} size={item.photo ? "md" : "sm"} trim={22 + i} />
          ))}
        </div>
        {more ? <TurnBar onTurn={onTurn} folio={more} label="More from around the state" /> : null}
      </div>
    );
  }
  const lead = items.find((i) => i.photo) ?? items[0]!;
  const seconds = items.filter((i) => i !== lead && i.photo).slice(0, 2);
  const list = items.filter((i) => i !== lead && !seconds.includes(i));
  return (
    <div className="tt-mo">
      {flag}
      <div className="tt-mo-grid">
        <div className="tt-mo-main">
          <MoStory item={lead} size="xl" />
          {seconds.length ? (
            <div className={cn("tt-mo-seconds", seconds.length === 1 && "one")}>
              {seconds.map((item, i) => (
                <MoStory key={item.id} item={item} size="md" trim={16 + i} />
              ))}
            </div>
          ) : null}
        </div>
        <aside className="tt-mo-rail">
          <section>
            <h4>The headlines</h4>
            <ol className="tt-mo-list">
              {list.map((item, i) => (
                <li key={item.id} data-tt-trim={24 + i}>
                  <MoStory item={item} size="sm" />
                </li>
              ))}
            </ol>
          </section>
          {page.listen.length ? (
            <section className="tt-mo-listen">
              <h4>Listen &amp; watch</h4>
              <ul>
                {page.listen.map((item) => (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noreferrer" className="wsj-a">
                      <b>{item.source}</b>
                      <span>{item.headline}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
      {more ? <TurnBar onTurn={onTurn} folio={more} label="More Missouri news" /> : null}
    </div>
  );
}

/** Section A's window on the statehouse: the Missouri Scout's latest. */
function ScoutBand({ item, onTurn, deskFolio }: { item: MoItem; onTurn: (folio: string) => void; deskFolio: string | null }) {
  const open = useReader();
  const card = moCard(item);
  const photo = useStoryImage(item.photo);
  const showPhoto = Boolean(item.photo) && !photo.hidden;
  const dek = item.dek ? cleanDek(item.dek.length > 420 ? item.dek.slice(0, 420) : item.dek) : null;
  return (
    <section
      className={cn("tt-scout", showPhoto && "has-photo")}
      data-tt-keys={storyReadKeys({ id: item.id, headline: item.headline, wrapHref: item.url }).join("|")}
      data-tt-title={item.headline}
    >
      <div className="tt-scout-flag">
        <span>From the</span>
        <strong>Missouri Scout</strong>
        <em>{moWhen(item.when) || "Latest"}</em>
      </div>
      {showPhoto ? <img className="tt-scout-photo" src={photo.src} alt="" loading="lazy" onError={photo.onError} /> : null}
      <div className="tt-scout-copy">
        <h3 className="wsj-hl md">
          <HeadlineSave card={card}>
            <button type="button" className="wsj-a wsj-story-link" onClick={() => open({ card })}>
              {item.headline}
            </button>
          </HeadlineSave>
        </h3>
        {dek ? <p>{dek}</p> : null}
        <p className="tt-scout-links">
          <button type="button" className="wsj-jump-btn" onClick={() => open({ card })}>
            Read the update <span aria-hidden="true">→</span>
          </button>
          {deskFolio ? (
            <button type="button" className="wsj-jump-btn" onClick={() => onTurn(deskFolio)}>
              Missouri news, page {deskFolio} <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────── pager ───────────────────────── */

/** Folios this close to the one in view are mounted, so a swipe always lands on a printed page. */
const NEAR_PAGES = 2;
const NO_STORIES: GameWrapCard[] = [];
const NO_NIGHTS: PlayerNight[] = [];

/** The folio in view. Only near-page consumers read it, so turning a page doesn't re-render the edition. */
const PagerIndexContext = createContext(0);

const MemoSportFront = memo(SportFront);

function NearSportFront({ index, ...props }: Omit<Parameters<typeof SportFront>[0], "active"> & { index: number }) {
  const current = useContext(PagerIndexContext);
  return <MemoSportFront {...props} active={Math.abs(index - current) <= 1} />;
}

const FolioBody = memo(function FolioBody({ render }: { render: () => ReactNode }) {
  return render();
});

/**
 * One screen of paper. It mounts when the reader comes within NEAR_PAGES of
 * it and then stays mounted, so turning back never re-sets a page.
 */
const FolioSlot = memo(function FolioSlot({
  index,
  folio,
  kind,
  render,
}: {
  index: number;
  folio: string;
  kind: string;
  render: () => ReactNode;
}) {
  const current = useContext(PagerIndexContext);
  const [shown, setShown] = useState(false);
  const near = Math.abs(index - current) <= NEAR_PAGES;
  if (near && !shown) setShown(true);
  const mounted = shown || near;
  const sheetRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!mounted || !sheet) return;
    return keepSheetPacked(sheet);
  }, [mounted]);
  return (
    <section className="wsj-page" aria-label={`Page ${folio}`} data-kind={kind} data-folio={folio}>
      <div className="wsj-fit">
        <div className="wsj-sheet" ref={sheetRef}>
          {mounted ? <FolioBody render={render} /> : null}
        </div>
      </div>
    </section>
  );
});

/**
 * Packs the sheet now, before it paints, and again only when its height, its
 * printed content, or the type it is set in changes. Every re-pack runs
 * inside the same frame as its cause, so a reader never sees one.
 */
function keepSheetPacked(sheet: HTMLElement): () => void {
  let height = sheet.clientHeight;
  let live = true;
  let queued = false;
  // Coalesced into one pass that still runs before the next paint.
  const repack = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (live) packSheet(sheet);
    });
  };
  packSheet(sheet);
  const ro = new ResizeObserver(() => {
    if (sheet.clientHeight === height) return;
    height = sheet.clientHeight;
    repack();
  });
  ro.observe(sheet);
  const mo = new MutationObserver(repack);
  mo.observe(sheet, { childList: true, subtree: true, characterData: true });
  // A face first used after fonts.ready reflows type without a mutation.
  document.fonts?.addEventListener("loadingdone", repack);
  if (document.fonts && document.fonts.status !== "loaded") void document.fonts.ready.then(repack);
  return () => {
    live = false;
    ro.disconnect();
    mo.disconnect();
    document.fonts?.removeEventListener("loadingdone", repack);
  };
}

/* ───────────────────────── page ───────────────────────── */

type Companions = {
  dayAhead: DaySchedule | null;
  national: NationalDesk | null;
  beez: BeezDesk | null;
  races: RaceBriefsDesk | null;
};

/** The edition on the stand: stories as filed, companions read with it. Never re-set after it opens. */
type OpenEdition = {
  id: string;
  stories: GameWrapCard[];
  companions: Companions;
  printedAt?: string;
};

function openingCandidateId(): string {
  if (typeof window === "undefined") return pressEdition().id;
  const asked = new URLSearchParams(window.location.search).get("edition");
  return asked && parsePressId(asked) ? asked : pressEdition().id;
}

const openingPressId = openingCandidateId();
const openingIssuePromise: Promise<PrintedIssue | null> =
  typeof indexedDB === "undefined" ? Promise.resolve(null) : readLocalIssue(openingPressId);

function asStoredSchedule(value: unknown): DaySchedule | null {
  if (!value || typeof value !== "object") return null;
  const row = value as DaySchedule;
  return typeof row.date === "string" && Array.isArray(row.events) ? row : null;
}

function asStoredNational(value: unknown): NationalDesk | null {
  if (!value || typeof value !== "object") return null;
  const row = value as NationalDesk;
  if (typeof row.issueId === "string" && Array.isArray(row.stories) && row.stories.length) return row;
  return asNationalDesk(value as Parameters<typeof asNationalDesk>[0]);
}

function asStoredRaces(value: unknown): RaceBriefsDesk | null {
  if (!value || typeof value !== "object") return null;
  const row = value as RaceBriefsDesk;
  return typeof row.editionDate === "string" && Array.isArray(row.races) && row.races.length ? row : null;
}

/** A cached copy is complete once it carries the boards; older caches held only the light desks. */
function hasAllDesks(issue: PrintedIssue): boolean {
  return issue.queries.some((q) => queryDeskName(q) === "tt-board");
}

function storedCompanions(issue: PrintedIssue | null): Companions | null {
  const c = issue?.companions as Partial<Record<keyof Companions, unknown>> | undefined;
  if (!c || !("races" in c)) return null;
  return {
    dayAhead: asStoredSchedule(c.dayAhead),
    national: asStoredNational(c.national),
    beez: asBeezDesk(c.beez),
    races: asStoredRaces(c.races),
  };
}

function openedFromCache(issue: PrintedIssue | null, id: string): OpenEdition | null {
  if (!issue || issue.id !== id || !hasAllDesks(issue)) return null;
  const companions = storedCompanions(issue);
  if (!companions) return null;
  return { id, stories: issue.stories as GameWrapCard[], companions, printedAt: issue.printedAt };
}

/**
 * Everything the edition prints, read at once: stories, desks and companions
 * in parallel. The browser never sets copy; a missing edition returns null and
 * the stand moves to the newest one filed.
 */
async function readEdition(
  id: string,
  userId: string | null,
  latest: boolean,
): Promise<{ issue: PrintedIssue; companions: Companions; fresh: boolean } | null> {
  const local = await readLocalIssue(id, userId).catch(() => null);
  const cached = local?.id === id ? local : null;
  const stored = storedCompanions(cached);
  if (cached && stored && hasAllDesks(cached)) return { issue: cached, companions: stored, fresh: false };
  const date = scheduleDateFor(id);
  const companion = <T,>(task: () => Promise<T | null>) =>
    withDeadline(task().catch(() => null), COMPANION_WAIT_MS, null);
  const [shell, queries, dayAhead, national, beez, races] = await Promise.all([
    cached ?? readRemoteIssueShell(id).catch(() => null),
    cached && hasAllDesks(cached) ? Promise.resolve(cached.queries) : readRemoteQueries(id).catch(() => null),
    date ? companion(() => fetchDaySchedule(date)) : Promise.resolve(null),
    asStoredNational(peekProofIssue(id)?.companions?.national)
      ? Promise.resolve(asStoredNational(peekProofIssue(id)?.companions?.national))
      : companion(() => readTimesNationalNews(id)),
    companion(() => readTimesBeez()),
    date ? companion(() => fetchRaceBriefs(date)) : Promise.resolve(null),
  ]);
  if (!shell || (!cached && !isIssueWithinLookback(shell))) return null;
  let desks = mergeQueries(shell.queries, queries ?? []);
  if (latest && queryNamed(desks, "tt-weather-marshfield") == null) {
    const wx = await companion(() => fetchMarshfieldWeather());
    if (wx) desks = [...desks, { key: [id, "tt-weather-marshfield"], data: wx }];
  }
  return {
    issue: { ...shell, queries: desks },
    companions: { dayAhead, national, beez, races },
    fresh: true,
  };
}

// The flat (page-image) paper is retired. Every /newspaper link opens the live reader.
export default function DailyNewspaperPage() {
  return (
    <Suspense fallback={<TimesHoldShell />}>
      <NewspaperDesk />
    </Suspense>
  );
}

function NewspaperDesk() {
  const opened = use(openingIssuePromise);
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const nationalSample = import.meta.env.DEV && params.get("national_sample") === "1";
  const racesSample = import.meta.env.DEV && params.get("races_sample") === "1";
  const askedEdition = parsePressId(params.get("edition") ?? "")?.id ?? null;
  const [doc, setDoc] = useState<OpenEdition | null>(() => openedFromCache(opened, openingPressId));
  const seeded = useRef<string | null>(null);
  if (opened && doc?.id === opened.id && seeded.current !== opened.id) {
    for (const q of opened.queries) queryClient.setQueryData(q.key, q.data);
    seeded.current = opened.id;
  }
  const { user } = useAuth();
  const [clockPress, setClockPress] = useState(() => pressEdition());
  const [recent, setRecent] = useState<FiledIssueMeta[] | null>(null);
  const [viewId, setViewId] = useState(() => askedEdition ?? pressEdition().id);
  const viewing = parsePressId(viewId) ?? clockPress;
  const day = viewing.day;
  const pressId = viewId;
  const press = viewing;
  const latestId = recent?.[0]?.id ?? clockPress.id;
  const [revealed, setRevealed] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  const revealFor = useRef<string | null>(null);
  const layout = useMemo(() => loadSportsLayout(), []);
  const teamFavs = useMemo(
    () => visibleFavorites(layout).filter((f) => f.kind === "team"),
    [layout],
  );
  const solo = params.get("solo") === "1" || prefersNewspaperHome();

  // Three presses a day. A slept iPad often drops the long timer and never
  // fires visibilitychange, so the stand also checks on focus, pageshow, and
  // once a minute. The clock only names the latest slot — it does not swap
  // the document under the reader.
  useEffect(() => {
    const sync = () => {
      setClockPress((prev) => {
        const next = pressEdition();
        return next.id === prev.id ? prev : next;
      });
    };
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        sync();
        schedule();
      }, msUntilNextPress() + 2_000);
    };
    schedule();
    const pulse = window.setInterval(sync, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(pulse);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    const fallback = window.setTimeout(() => {
      if (!cancel) setRecent((prev) => prev ?? []);
    }, 4_000);
    void (async () => {
      const [remote, local] = await Promise.all([
        listRecentIssues().catch(() => [] as FiledIssueMeta[]),
        listLocalIssues().catch(() => [] as PrintedIssue[]),
      ]);
      window.clearTimeout(fallback);
      if (cancel) return;
      setRecent(
        uniqueEditionStand([
          ...remote,
          ...local.map((issue) => ({ id: issue.id, printedAt: issue.printedAt ?? "" })),
        ]),
      );
    })();
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void listRecentIssues()
        .then((rows) => {
          if (rows.length) setRecent(uniqueEditionStand(rows));
        })
        .catch(() => {});
    };
    const pulse = window.setInterval(refresh, ISSUE_POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      cancel = true;
      window.clearTimeout(fallback);
      window.clearInterval(pulse);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Open the newest filed edition. If the clock's slot is still on the press,
  // the last one filed stays up; a newer one only ever shows as the pill.
  useEffect(() => {
    if (!recent) return;
    if (doc?.id === viewId) return;
    setViewId((current) => {
      if (recent.some((row) => row.id === current)) return current;
      return recent[0]?.id ?? current;
    });
    if (askedEdition && !recent.some((row) => row.id === askedEdition)) {
      const next = new URLSearchParams(params);
      if (next.has("edition")) {
        next.delete("edition");
        setParams(next, { replace: true });
      }
    }
  }, [recent, askedEdition, params, setParams, doc?.id, viewId]);

  const newerEdition = revealed && recent?.[0]?.id && recent[0].id !== viewId && !askedEdition ? recent[0].id : null;

  const selectEdition = useCallback(
    (id: string) => {
      if (id === viewId) return;
      setRevealed(false);
      revealFor.current = null;
      setViewId(id);
      const next = new URLSearchParams(params);
      if (id === latestId) next.delete("edition");
      else next.set("edition", id);
      setParams(next, { replace: true });
    },
    [viewId, params, setParams, latestId],
  );

  const cacheUser = user?.id ?? readCacheUserId();
  const cacheUserRef = useRef(cacheUser);
  cacheUserRef.current = cacheUser;
  const latestRef = useRef(latestId);
  latestRef.current = latestId;

  useEffect(() => {
    if (doc?.id === pressId) return;
    let stale = false;
    setMissing(false);
    void (async () => {
      const got = await readEdition(pressId, cacheUserRef.current, latestRef.current === pressId);
      if (stale) return;
      if (!got) {
        setMissing(true);
        return;
      }
      const { issue, companions, fresh } = got;
      for (const q of issue.queries) queryClient.setQueryData(q.key, q.data);
      setDoc({ id: issue.id, stories: issue.stories as GameWrapCard[], companions, printedAt: issue.printedAt });
      if (fresh) void writeLocalIssue({ ...issue, companions }, cacheUserRef.current);
    })();
    return () => {
      stale = true;
    };
  }, [pressId, doc?.id, queryClient]);

  useEffect(() => {
    void registerTimesWorker().then(async () => {
      const urls = timesShellUrlsFromPerformance();
      await cacheTimesShell(urls);
      await postTimesPrecache(urls);
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const onReady = (row: FiledIssueMeta) => {
      setRecent((prev) => filterRecentFiledIssues([row, ...(prev ?? [])]));
      void prefetchFiledEdition(row.id, user.id);
    };
    const stop = subscribeReadyIssues(onReady);
    return () => stop();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void writeDesk({ userId: user.id, order: layout.order, hidden: layout.hidden });
  }, [user?.id, layout]);

  useEffect(() => {
    document.documentElement.classList.add("tt-lock");
    return () => document.documentElement.classList.remove("tt-lock");
  }, []);

  const pagerRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const pageIndexRef = useRef(0);
  pageIndexRef.current = pageIndex;
  const restoringRef = useRef(false);

  const setFolio = useCallback((idx: number) => {
    pageIndexRef.current = idx;
    setPageIndex(idx);
  }, []);

  // The page is the window. Only a window change (rotation, Split View) resizes it.
  useLayoutEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    let lastW = 0;
    const apply = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 40 || h < 40) return;
      const g = pageGeometry(w, h);
      el.style.setProperty("--tt-s", String(g.scale));
      el.style.setProperty("--tt-page-h", `${g.height}px`);
      if (lastW && lastW !== w) el.scrollTo({ left: pageIndexRef.current * w, behavior: "instant" });
      lastW = w;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const docReady = doc?.id === pressId;
  const companions = docReady ? doc.companions : null;

  const favKeys = teamFavs.map((t) => t.key).join(",");
  const teamSnaps = useFiledQuery({
    queryKey: [pressId, "tt-team-snaps", day, favKeys],
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
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const teamDetailsQ = useFiledQuery({
    queryKey: [pressId, "tt-team-details", day, favKeys],
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
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const wireQ = useFiledQuery({
    queryKey: [pressId, "tt-wire", day, favKeys],
    queryFn: async () => {
      const wire = await fetchNewspaperWire({ favs: teamFavs, day, pressId });
      const games = await enrichWireStories(wire.games, DEEP_STORIES);
      return { ...wire, games };
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });


  const wrapFeedUrls = useMemo(() => wrapFeedsForFavorites(teamFavs), [teamFavs]);

  const wrapsQ = useFiledQuery({
    queryKey: [pressId, "tt-wraps", day, wrapFeedUrls.join("|")],
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
      return collectWrapFeeds(feeds, teamFavs);
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const teamsRaw = useMemo(
    () => buildTeamInfoboxes(teamFavs, teamSnaps.data ?? [], teamDetailsQ.data ?? []),
    [teamFavs, teamSnaps.data, teamDetailsQ.data],
  );

  const wrapPack = wrapsQ.data as { wraps?: MatchedWrap[]; athletic?: GameWrapCard[] } | MatchedWrap[] | undefined;
  const athleticCards = Array.isArray(wrapPack) ? undefined : wrapPack?.athletic;

  const clubsRaw = useMemo<ClubDesk[]>(
    () =>
      // teams already sorted by desk weight (Cardinals / Blues / Mizzou → Lions → Chiefs → soccer).
      teamsRaw.map((team) => {
        const path = leaguePathFromEspn(team.fav.espnPath);
        const upcoming = sortComingUp(
          (team.detail?.upcoming ?? []).slice(0, 5).map((game) => ({
            id: `${team.fav.key}-${game.id}`,
            label: game.label,
            when: game.when,
            startIso: game.startIso ?? null,
            detail: game.detail,
            favoriteKey: team.fav.key,
          })),
        );
        if (!upcoming.length && team.snap.nextGame && team.seasonState === "active") {
          upcoming.push({
            id: `${team.fav.key}-next`,
            label: team.snap.nextGame.label,
            when: team.snap.nextGame.when,
            startIso: null,
            detail: team.snap.nextGame.detail,
            favoriteKey: team.fav.key,
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
          odds: team.odds,
          division,
          stats: team.teamStats,
          leaders: namedLeaders,
          upcoming,
        };
      }),
    [teamsRaw],
  );

  const sportPaths = useMemo(() => sportPathsOf(teamFavs), [teamFavs]);


  const printedStories = useMemo(
    () => rewriteEspnThumbs(docReady ? doc.stories : NO_STORIES),
    [docReady, doc?.stories],
  );

  const leagueClubsQ = useFiledQuery({
    queryKey: [pressId, "tt-league-clubs", day, sportPaths.join("|")],
    queryFn: async () => {
      const entries = await Promise.all(
        sportPaths.map(async (path) => {
          const rows = await fetchLeagueClubs(path);
          return [path, markFavoriteClubs(rows, teamFavs, path)] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, LeagueClub[]>;
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const leagueSlateQ = useFiledQuery({
    queryKey: [pressId, "tt-league-slate", day, sportPaths.join("|")],
    queryFn: async () => {
      const entries = await Promise.all(
        sportPaths.map(async (path) => [path, await fetchLeagueSlate(path, day)] as const),
      );
      return Object.fromEntries(entries) as Record<string, LeagueSlateGame[]>;
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const mlbPlayoffsQ = useFiledQuery({
    queryKey: [pressId, "tt-mlb-playoffs", day],
    queryFn: () => fetchMlbPlayoffTree(),
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const leadBoardPaths = useMemo(
    () => sportPaths.filter((path) => path === "football/college-football" || path === "baseball/mlb" || path === "football/nfl"),
    [sportPaths],
  );
  const leadBoardQ = useFiledQuery({
    queryKey: [pressId, "tt-lead-board", day, leadBoardPaths.join("|")],
    queryFn: async () => {
      const entries = await Promise.all(
        leadBoardPaths.map(async (path) => {
          try {
            return [path, await fetchSectionBoard(path, day)] as const;
          } catch {
            return [path, { results: [], slate: [] }] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, SectionBoard>;
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const boardQ = useFiledQuery({
    queryKey: [pressId, "tt-board", day, sportPaths.join("|")],
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
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const standingsQ = useFiledQuery({
    queryKey: [pressId, "tt-standings", day, sportPaths.join("|")],
    queryFn: async () => {
      const entries = await Promise.all(
        sportPaths.map(async (path) => [path, await fetchSectionStandings(path)] as const),
      );
      return Object.fromEntries(entries) as Record<string, StandGroup[]>;
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const teams = useMemo(() => {
    if (!standingsQ.data) return teamsRaw;
    return buildTeamInfoboxes(
      teamFavs,
      applyTableStandings(teamSnaps.data ?? [], standingsQ.data, teamFavs),
      teamDetailsQ.data ?? [],
    );
  }, [teamsRaw, standingsQ.data, teamFavs, teamSnaps.data, teamDetailsQ.data]);

  const clubs = useMemo(() => {
    const byKey = new Map(teams.map((t) => [t.fav.key, t.snap.standing]));
    return clubsRaw.map((club) => ({ ...club, standing: byKey.get(club.key) ?? club.standing }));
  }, [clubsRaw, teams]);

  const leadersQ = useFiledQuery({
    queryKey: [pressId, "tt-leaders", day, sportPaths.join("|")],
    queryFn: async () => {
      const entries = await Promise.all(
        sportPaths.map(async (path) => [path, await fetchLeagueLeaders(path).catch(() => [])] as const),
      );
      return Object.fromEntries(entries) as Record<string, LeagueLeaderGroup[]>;
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const heismanQ = useFiledQuery({
    queryKey: [pressId, "tt-heisman", day],
    queryFn: fetchHeismanOdds,
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const leaderPaths = useMemo(
    () => Object.entries(leadersQ.data ?? {}).flatMap(([path, groups]) => (groups.length ? [path] : [])),
    [leadersQ.data],
  );
  const postseasonPaths = useMemo(() => {
    const paths = new Set<string>();
    if (mlbPlayoffsQ.data?.active) paths.add("baseball/mlb");
    for (const game of wireQ.data?.games ?? []) {
      if (game.postseason && game.path) paths.add(game.path);
    }
    for (const [path, groups] of Object.entries(leadersQ.data ?? {})) {
      if (groups.some((g) => g.seasonType === 3)) paths.add(path);
    }
    return [...paths];
  }, [mlbPlayoffsQ.data, wireQ.data, leadersQ.data]);

  /** Pairs a club story with the game it reports, so the reader can set the box. */
  const findGame = useCallback(
    (card: GameWrapCard): BoxGame | null => {
      // A week-wide roundup or club note must not inherit last night's box.
      if (!isSingleGameRecap(card)) return null;
      const board = card.leaguePath
        ? (leadBoardQ.data?.[card.leaguePath] ?? boardQ.data?.[card.leaguePath])
        : undefined;
      if (!board) return null;
      const games = [...board.results, ...board.slate, ...(board.prior ?? []), ...(board.week ?? [])];
      if (card.gameId) {
        const hit = games.find(
          (g) => g.espnEventId === card.gameId || (g.gamePk != null && String(g.gamePk) === card.gameId),
        );
        if (hit) return hit;
      }
      return games.find((g) => gameMatchesRecap(g, card)) ?? null;
    },
    [boardQ.data, leadBoardQ.data],
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
          editionCovers(g.startedAt, pressId),
      )
      .slice(0, 6);
  }, [wireQ.data, pressId]);

  const bracket = useMemo(
    () => postseasonRailGames(wireQ.data?.games ?? [], day),
    [wireQ.data, day],
  );

  const coachesQ = useFiledQuery({
    queryKey: [pressId, "tt-favorite-coaches", day],
    queryFn: () => fetchFavoriteCoachDesk({ day }),
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const coachDesk = asFavoriteCoachDesk(coachesQ.data);
  const coachesByPath = useMemo(() => {
    const out: Record<string, FavoriteCoachTile[]> = {};
    for (const tile of coachDesk?.tiles ?? []) (out[tile.leaguePath] ??= []).push(tile);
    return out;
  }, [coachDesk]);
  const coachPaths = useMemo(() => Object.keys(coachesByPath).sort(), [coachesByPath]);

  const sheetsQ = useFiledQuery({
    queryKey: [pressId, "tt-club-sheets", day, favKeys],
    queryFn: async () => {
      const rows = await Promise.all(
        teamFavs.map(async (fav) => [fav.key, await fetchClubSheet(fav.espnPath, day).catch(() => null)] as const),
      );
      return Object.fromEntries(rows.filter((r) => r[1])) as Record<string, ClubSheet>;
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const weatherQ = useFiledQuery({
    queryKey: [pressId, "tt-weather-marshfield"],
    queryFn: fetchMarshfieldWeather,
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const watchQ = useFiledQuery({
    queryKey: [pressId, "tt-watch", day],
    queryFn: () => fetchWatchList(day, { limit: WATCH_PAGE_GAMES, favorites: teamFavs }),
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const scheduleDate = scheduleDateFor(pressId);


  const scoutQ = useFiledQuery({
    queryKey: [pressId, "tt-mo-scout", day],
    queryFn: async () => {
      const item = await fetchMissouriScout(pressId);
      return item ? ((await enrichMissouriItems([item], 1))[0] ?? item) : null;
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });


  const missouriQ = useFiledQuery({
    queryKey: [pressId, "tt-missouri", day],
    queryFn: async () => {
      const desk = await fetchMissouriDesk(day, pressId);
      const enriched = await enrichMissouriItems(desk.items, 7);
      const prevId = previousPressId(pressId);
      const [reads, prev] = await Promise.all([
        user?.id ? fetchRssReads().catch(() => [] as string[]) : Promise.resolve([] as string[]),
        prevId ? readRemoteIssue(prevId).catch(() => null) : Promise.resolve(null),
      ]);
      const carried = (prev?.queries ?? []).flatMap((query) => {
        const key = query.key;
        const data = query.data as { items?: MoItem[] } | null;
        if (Array.isArray(key) && key[1] === "tt-missouri" && Array.isArray(data?.items)) return data.items;
        return [];
      });
      return {
        ...desk,
        items: fileMissouriItems({
          fresh: enriched.filter((item) => missouriItemInEdition(item.when, pressId)),
          carried,
          readKeys: new Set(reads),
        }),
      };
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const openersQ = useFiledQuery({
    queryKey: [pressId, "tt-openers", day, favKeys],
    queryFn: async () => {
      const rows = await Promise.all(teamFavs.map((fav) => fetchOpener(fav).catch(() => null)));
      return rows.filter((o): o is Opener => o != null);
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const openers = useMemo(() => new Map((openersQ.data ?? []).map((o) => [o.key, o])), [openersQ.data]);

  // The farm system makes the Cardinals copy as often as the big club does.
  const orgQ = useFiledQuery({
    queryKey: [pressId, "tt-org-rosters", day, favKeys],
    queryFn: async () => {
      const season = Number(day.slice(0, 4)) || new Date().getFullYear();
      const rows = await Promise.all(
        teamFavs
          .filter((fav) => fav.mlbTeamId)
          .map(async (fav) => {
            const res = await fetch(
              `https://statsapi.mlb.com/api/v1/teams/${fav.mlbTeamId}/roster?rosterType=fullRoster&season=${season}`,
            ).catch(() => null);
            const data = (res?.ok ? await res.json().catch(() => null) : null) as {
              roster?: { person?: { id?: number; fullName?: string } }[];
            } | null;
            return (data?.roster ?? []).flatMap((r) =>
              r.person?.id && r.person.fullName ? [{ id: String(r.person.id), name: r.person.fullName }] : [],
            );
          }),
      );
      return rows.flat();
    },
    staleTime: Infinity,
    gcTime: 20 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  /** A league is between seasons when every club you follow in it is still counting down and no finals have posted. */
  const offseason = useMemo(
    () =>
      sportPaths.filter((path) => {
        const mine = clubs.filter((c) => c.leaguePath === path);
        if (!mine.length || !mine.every((c) => (openers.get(c.key) ? daysUntil(openers.get(c.key)!.iso, Date.now(), openers.get(c.key)!.timeValid) > 2 : false))) {
          return false;
        }
        const board = boardQ.data?.[path];
        return !board?.results.length && !board?.prior?.length;
      }),
    [sportPaths, clubs, openers, boardQ.data],
  );

  /** Everyone the paper can name and link: box scores, club leaders, your players. */
  const people = useMemo<Person[]>(() => {
    const out: Person[] = [];
    const push = (path: string, id: string | null | undefined, name: string | null | undefined) => {
      const href = id ? playerPageHref(path, id) : null;
      if (href && name) out.push({ name, href });
    };
    for (const [path, board] of Object.entries(boardQ.data ?? {})) {
      for (const g of [...board.results, ...board.slate, ...(board.prior ?? [])]) {
        for (const d of g.decisions) push(path, d.person.id, d.person.name);
        for (const l of g.leaders) push(path, l.id, l.name);
        push(path, g.probables.away?.id, g.probables.away?.name);
        push(path, g.probables.home?.id, g.probables.home?.name);
      }
    }
    for (const club of clubs) {
      for (const l of club.leaders) if (l.href?.startsWith("/")) out.push({ name: l.name, href: l.href });
      const sheet = sheetsQ.data?.[club.key];
      if (sheet && club.leaguePath) for (const l of sheet.leaders) push(club.leaguePath, l.id, l.name);
    }
    for (const team of teams) {
      const path = /^(.+)\/teams\//.exec(team.fav.espnPath)?.[1];
      if (path) for (const r of team.detail?.roster ?? []) push(path, r.id, r.name);
    }
    for (const p of orgQ.data ?? []) push("baseball/mlb", p.id, p.name);
    return out;
  }, [boardQ.data, clubs, sheetsQ.data, teams, orgQ.data]);

  const boardRecaps = useMemo(() => {
    const boards = { ...(boardQ.data ?? {}), ...(leadBoardQ.data ?? {}) };
    const seen = new Set<string>();
    const out: GameWrapCard[] = [];
    for (const club of clubs) {
      if (!club.leaguePath) continue;
      const board = boards[club.leaguePath];
      if (!board) continue;
      for (const g of [...(board.results ?? []), ...(board.prior ?? [])]) {
        const card = stampBoardCard(g, [club]);
        if (!card?.favoriteKey || seen.has(card.id) || seen.has(card.wrapHref || "")) continue;
        seen.add(card.id);
        if (card.wrapHref) seen.add(card.wrapHref);
        out.push(card);
      }
    }
    return out;
  }, [boardQ.data, leadBoardQ.data, clubs]);
  const stories = useMemo(() => {
    const seen = new Set<string>();
    const merged: GameWrapCard[] = [];
    for (const card of [...boardRecaps, ...printedStories, ...(athleticCards ?? [])]) {
      const key = card.wrapHref || card.id;
      if (!key || seen.has(key) || seen.has(card.id)) continue;
      seen.add(key);
      seen.add(card.id);
      merged.push(card);
    }
    return merged;
  }, [boardRecaps, printedStories, athleticCards]);

  const nationalDesk = nationalSample ? sampleNationalDesk(pressId) : (companions?.national ?? null);
  const builtEdition = useMemo(() => {
    const extras = essentialsFromDesks(nationalDesk, missouriQ.data ?? null);
    const have = new Set(stories.map((card) => card.id));
    return buildEdition({
      stories: [...stories, ...extras.filter((card) => !have.has(card.id))],
      clubs,
      edition: pressId,
      playerPaths: [],
      missouri: missouriQ.data ?? null,
      national: nationalDesk,
      offseason,
      leaderPaths,
      postseasonPaths,
      coachPaths,
    });
  }, [stories, clubs, pressId, missouriQ.data, nationalDesk, offseason, leaderPaths, postseasonPaths, coachPaths]);
  // No schedule row for the date (or not read yet): no page, never an older day's.
  const daySchedule = companions?.dayAhead?.date === scheduleDate ? companions.dayAhead : null;
  const beezDesk = companions?.beez ?? null;
  const raceDesk: RaceBriefsDesk | null =
    racesSample && scheduleDate ? sampleRaceBriefs(scheduleDate) : (companions?.races ?? null);
  const edition = useMemo(() => {
    const raw = standingsQ.data ?? {};
    const counted: Record<string, { length: number }> = {};
    for (const [path, groups] of Object.entries(raw)) {
      const teams = builtEdition.pages.find(
        (p) => p.kind === "sport-front" && p.focus === "teams" && p.path === path,
      );
      counted[path] =
        teams?.kind === "sport-front" && teams.offseason
          ? offseasonTables(groups, teams, leagueClubsQ.data?.[path] ?? [])
          : groups;
    }
    return dropEmptyFolios(
      paginateEditionDesks(
        insertBeez(insertDayAhead(insertRaceBriefs(builtEdition, raceDesk), daySchedule), beezDesk),
        counted,
      ),
    );
  }, [builtEdition, raceDesk, daySchedule, beezDesk, standingsQ.data, leagueClubsQ.data]);
  const comingUp = useMemo<ComingUp[]>(
    () =>
      sortComingUp(
        clubs.flatMap((club) =>
          club.upcoming.slice(0, 1).map((game) => ({
            id: game.id,
            team: teams.find((t) => t.fav.key === club.key)?.fav.shortName || club.shortName,
            label: game.label,
            when: game.when,
            startIso: game.startIso ?? null,
            favoriteKey: club.key,
            logo: club.logo,
            color: club.color ?? null,
          })),
        ),
      ),
    [clubs, teams],
  );
  const pages = edition.pages;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const weatherFolio = useMemo(
    () => pages.find((p) => p.kind === "favorites-clubs" && (p.weatherPart ?? "today") === "today")?.folio ?? pages.find((p) => p.kind === "favorites-clubs")?.folio ?? null,
    [pages],
  );
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

  const markFolio = useCallback(
    (idx: number) => {
      const folio = pages[idx]?.folio;
      if (folio && typeof window !== "undefined" && window.location.hash !== `#${folio}`) {
        window.history.replaceState(null, "", `#${folio}`);
      }
    },
    [pages],
  );

  const goPage = useCallback(
    (idx: number) => {
      const el = pagerRef.current;
      if (!el) return;
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      const from = pageIndexRef.current;
      // Gliding across a whole section paints every folio in between; long jumps cut straight there.
      el.scrollTo({ left: next * el.clientWidth, behavior: Math.abs(next - from) > NEAR_PAGES ? "instant" : "smooth" });
      setFolio(next);
      markFolio(next);
    },
    [pages.length, markFolio, setFolio],
  );

  const goFolio = useCallback(
    (folio: string) => {
      const idx = pages.findIndex((p) => p.folio === folio);
      if (idx >= 0) goPage(idx);
    },
    [pages, goPage],
  );

  function goSection(code: string) {
    const section = edition.sections.find((s) => s.code === code);
    if (section) goPage(section.index);
  }

  useEffect(() => {
    const goHash = () => {
      const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
      if (!hash) return;
      const list = pagesRef.current;
      const idx = list.findIndex((p) => p.folio === hash);
      if (idx >= 0) {
        const el = pagerRef.current;
        if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: "instant" });
        setFolio(idx);
      }
    };
    goHash();
    window.addEventListener("hashchange", goHash);
    return () => window.removeEventListener("hashchange", goHash);
  }, [pages, setFolio]);

  // Settle the folio once the swipe or glide comes to rest — not on every scroll frame.
  useEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    let timer = 0;
    const settle = () => {
      window.clearTimeout(timer);
      if (restoringRef.current || document.documentElement.classList.contains("tt-reader-open")) return;
      const idx = Math.round(el.scrollLeft / (el.clientWidth || 1));
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      startTransition(() => setFolio(next));
      markFolio(next);
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 150);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", settle);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", settle);
    };
  }, [pages.length, markFolio, setFolio]);

  // Closing the full story reflows the pager to scrollLeft 0. Put the reader back.
  useEffect(() => {
    const root = document.documentElement;
    let open = root.classList.contains("tt-reader-open");
    const saved = { idx: pageIndexRef.current, folio: "" };
    const visibleFolio = () => {
      const el = pagerRef.current;
      if (!el) return pagesRef.current[pageIndexRef.current]?.folio ?? "";
      const hit = [...el.querySelectorAll(".wsj-page")].find((node) => {
        const r = node.getBoundingClientRect();
        return r.left > -40 && r.left < el.clientWidth * 0.55;
      });
      const label = hit?.getAttribute("aria-label")?.replace(/^Page\s+/, "") ?? "";
      return label || pagesRef.current[pageIndexRef.current]?.folio || "";
    };
    const obs = new MutationObserver(() => {
      const now = root.classList.contains("tt-reader-open");
      if (now && !open) {
        saved.folio = visibleFolio();
        saved.idx = pageIndexRef.current;
      }
      if (!now && open) {
        restoringRef.current = true;
        const restore = () => {
          const el = pagerRef.current;
          if (!el) return;
          const list = pagesRef.current;
          const byFolio = saved.folio ? list.findIndex((p) => p.folio === saved.folio) : -1;
          const idx = byFolio >= 0 ? byFolio : saved.idx;
          el.scrollTo({ left: idx * el.clientWidth, behavior: "instant" });
          setFolio(idx);
          markFolio(idx);
        };
        restore();
        requestAnimationFrame(() => requestAnimationFrame(restore));
        window.setTimeout(restore, 60);
        window.setTimeout(() => {
          restore();
          restoringRef.current = false;
        }, 320);
      }
      open = now;
    });
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [markFolio, setFolio]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (document.documentElement.classList.contains("tt-reader-open")) return;
      if (e.key === "ArrowRight") goPage(pageIndexRef.current + 1);
      if (e.key === "ArrowLeft") goPage(pageIndexRef.current - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const printedAt = docReady ? doc.printedAt : recent?.find((row) => row.id === pressId)?.printedAt;
  const readingNote =
    recent?.[0] && recent[0].id !== pressId
      ? backEditionNote(pressId, printedAt)
      : clockPress.id !== pressId && !askedEdition
        ? `The ${clockPress.label} is still on the press. ${backEditionNote(pressId, printedAt)}.`
        : null;

  const formInSectionA = useMemo(
    () =>
      new Set(
        pages
          .flatMap((p) =>
            p.kind === "favorites-form" ? p.clubs : p.kind === "favorites-clubs" ? (p.formClubs ?? []) : [],
          )
          .map((club) => club.key),
      ),
    [pages],
  );

  // Built once per edition/data change, never per page turn: re-rendering 60 folios on every
  // swipe was the slow part. Anything that must follow the folio in view reads PagerIndexContext.
  const sheets = useMemo(
    () =>
      pages.map((page, index) => (
          <FolioSlot
            key={page.folio}
            index={index}
            folio={page.folio}
            kind={page.kind}
            render={() => (
            <>
            {index === 0 ? (
              <Masthead
                day={day}
                page={page}
                clubs={teams.length}
                live={tonight.length}
                editionLabel={press.label}
                weather={weatherQ.data}
                weatherFolio={weatherFolio}
                onTurn={goFolio}
                editions={recent ?? []}
                selectedId={pressId}
                onSelectEdition={selectEdition}
                readingNote={readingNote}
              />
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
                  news={page.news}
                  teams={teams}
                  tonight={tonight}
                  bracket={bracket}
                  comingUp={a1ComingUp(comingUp)}
                  sections={edition.sections}
                  folios={edition.favoriteFolioByStory}
                  clubsFolio={pages.find((p) => p.kind === "favorites-form")?.folio ?? weatherFolio ?? "A2"}
                  editionDay={day}
                  onTurn={goFolio}
                  leadContinue={page.leadContinue}
                  secondContinue={page.secondContinue}
                  thirdContinue={page.thirdContinue}
                  leadTeaser={page.leadTeaser}
                  secondTeaser={page.secondTeaser}
                  thirdTeaser={page.thirdTeaser}
                  scout={scoutQ.data ?? missouriQ.data?.scout ?? null}
                />
              ) : page.kind === "favorites-clubs" ? (
                <>
                  <WeatherReport weather={weatherQ.data} part="all" />
                  <DeskBoard teams={teams} title="Your Clubs" onTurn={goFolio} />
                </>
              ) : page.kind === "favorites-form" ? (
                <div className="wsj-clubs-desk">
                  <header className="wsj-desk-head">
                    <h2>Club Form</h2>
                    <p>{page.clubs.length} clubs · standings, numbers, leaders and what’s next</p>
                  </header>
                  <ClubFormGrid clubs={page.clubs} sheets={sheetsQ.data ?? {}} columns={3} />
                  {pages.findLast((p) => p.kind === "favorites-form") === page ? (
                    <DeskBoard
                      teams={teams.filter((t) => !formInSectionA.has(t.fav.key))}
                      title="More clubs · full form in each section"
                      onTurn={goFolio}
                    />
                  ) : null}
                </div>
              ) : page.kind === "favorites-watch" ? (
                <WatchGuide games={watchQ.data ?? []} editionLabel={press.label} />
              ) : page.kind === "favorites-day" ? (
                <DayAhead date={page.date} events={page.events} upcoming={page.upcoming} editionLabel={press.label} />
              ) : page.kind === "favorites-beez" ? (
                <BeezPage desk={page.desk} editionLabel={press.label} />
              ) : page.kind === "favorites-races" ? (
                <RacesPage page={page} />
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
                <NearSportFront
                  index={index}
                  page={page}
                  leagueClubs={leagueClubsQ.data?.[page.path] ?? []}
                  board={boardQ.data?.[page.path] ?? null}
                  standings={standingsQ.data?.[page.path] ?? []}
                  slate={leagueSlateQ.data?.[page.path] ?? []}
                  playoffs={page.path === "baseball/mlb" ? mlbPlayoffsQ.data ?? null : null}
                  edition={day}
                  hasPlayers={false}
                  nights={NO_NIGHTS}
                  coaches={coachesByPath[page.path] ?? []}
                  sheets={sheetsQ.data ?? {}}
                  leaders={leadersQ.data?.[page.path] ?? []}
                  heisman={page.path.includes("college-football") ? heismanQ.data ?? null : null}
                  leftover={frontPageLeftover(
                    page.articles.map((a) => a.card),
                    pages.flatMap((p) =>
                      p.kind === "sport-front" && p.path === page.path && p.folio !== page.folio
                        ? p.articles.map((a) => a.card)
                        : p.kind === "sport-inside" && p.path === page.path
                          ? [p.primary, p.secondary].filter((c): c is GameWrapCard => Boolean(c))
                          : [],
                    ),
                    page.path.includes("college-football") || page.path === "baseball/mlb" ? 4 : 2,
                  )}
                  snaps={(teamSnaps.data ?? []).filter((s) => page.clubs.some((c) => c.key === s.key))}
                  alreadyOnA1={pages.flatMap((p) =>
                    p.kind === "favorites-front" ? [p.lead, p.second, p.third].filter((c): c is GameWrapCard => Boolean(c)) : [],
                  )}
                  onTurn={goFolio}
                />
              ) : page.kind === "national" ? (
                <NationalNewsDesk page={page} onTurn={goFolio} />
              ) : page.kind === "missouri" ? (
                <MissouriDesk page={page} onTurn={goFolio} />
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
            </>
            )}
          />
      )),
    [
      pages,
      day,
      teams,
      tonight,
      bracket,
      comingUp,
      edition.sections,
      edition.favoriteFolioByStory,
      goFolio,
      scoutQ.data,
      missouriQ.data?.scout,
      sheetsQ.data,
      leadersQ.data,
      heismanQ.data,
      watchQ.data,
      notebookByFolio,
      leagueClubsQ.data,
      boardQ.data,
      standingsQ.data,
      leagueSlateQ.data,
      mlbPlayoffsQ.data,
      coachesByPath,
      teamSnaps.data,
      weatherQ.data,
      weatherFolio,
      press.label,
      recent,
      pressId,
      selectEdition,
      readingNote,
      formInSectionA,
    ],
  );

  useLayoutEffect(() => {
    if (!docReady || revealFor.current === pressId) return;
    let cancel = false;
    void (async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await waitForPrintedReveal(pagerRef.current);
      if (cancel) return;
      revealFor.current = pressId;
      setRevealed(true);
    })();
    return () => {
      cancel = true;
    };
  }, [docReady, pressId]);

  // A story that sat on the sheet counts as read. The next press leaves it out.
  useEffect(() => {
    const root = pagerRef.current;
    if (!root || !user?.id) return;
    const sheet = root.children[pageIndex] as HTMLElement | undefined;
    if (!sheet) return;
    const pending = new Map<Element, number>();
    const marked = new Set<string>();
    const flush = (el: Element) => {
      const title = el.getAttribute("data-tt-title") ?? "";
      const keys = (el.getAttribute("data-tt-keys") ?? "")
        .split("|")
        .map((key) => key.trim())
        .filter((key) => key && !marked.has(key));
      if (!keys.length) return;
      for (const key of keys) marked.add(key);
      void markRssReadMany(
        keys.map((articleUrl) => ({ articleUrl, articleTitle: title, feedUrl: "thompson-times" })),
      ).catch(() => {});
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target;
        const onScreen =
          entry.isIntersecting &&
          (entry.intersectionRatio >= 0.6 ||
            entry.intersectionRect.height >= Math.min(window.innerHeight * 0.5, entry.boundingClientRect.height));
        const timer = pending.get(el);
        if (!onScreen) {
          if (timer) window.clearTimeout(timer);
          pending.delete(el);
          continue;
        }
        if (timer) continue;
        pending.set(
          el,
          window.setTimeout(() => {
            pending.delete(el);
            flush(el);
          }, 1000),
        );
      }
    }, { threshold: [0, 0.6, 1] });
    for (const node of sheet.querySelectorAll<HTMLElement>("[data-tt-keys]")) observer.observe(node);
    return () => {
      observer.disconnect();
      for (const timer of pending.values()) window.clearTimeout(timer);
    };
  }, [pageIndex, sheets, user?.id]);

  const current = pages[pageIndex];
  const sectionIdx = edition.sections.findIndex((s) => s.code === current?.section);
  const holdLine = missing && recent && !recent.length ? "No edition filed in the last day" : "Today's edition";

  return (
    <div
      className="newspaper-root wsj-shell"
      data-times-ready={revealed ? "1" : "0"}
      data-times-folios={revealed && pages.length > 0 ? "1" : "0"}
    >
      <GameLookup.Provider value={findGame}>
      <OpenerContext.Provider value={openers}>
      <PlayerPopProvider people={people}>
      <SavedProvider edition={pressId}>
      <ReaderProvider>
      <div className="wsj-chrome print:hidden">
        <div className="wsj-chrome-l">
          {solo ? null : (
            <Link to="/dashboard" className="wsj-chrome-back" title="Back to Command Center">
              <ChevronLeft size={14} />
              <span>Command Center</span>
            </Link>
          )}
          <strong>Thompson Times</strong>
          <span>
            {current ? `Section ${current.section} · ${current.sectionTitle}` : `Edition ${day}`}
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
            onClick={() => goPage(pageIndexRef.current - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="wsj-pager-label">
            {current?.folio ?? "A1"}
            <em>{current ? `${current.sectionPage} of ${current.sectionCount}` : ""}</em>
          </span>
          <button
            type="button"
            className="wsj-pager-btn"
            aria-label="Next page"
            disabled={pageIndex >= pages.length - 1}
            onClick={() => goPage(pageIndexRef.current + 1)}
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
          {solo ? null : (
            <a href="/times.html" className="wsj-chrome-btn" title="Add to Home Screen">
              <Share size={12} />
              Home Screen
            </a>
          )}
          <button
            type="button"
            className={cn("wsj-chrome-btn", savedOpen && "is-on")}
            title="Saved stories"
            aria-pressed={savedOpen}
            onClick={() => setSavedOpen((open) => !open)}
          >
            <Bookmark size={12} fill={savedOpen ? "currentColor" : "none"} />
            Saved
          </button>
          <span className="wsj-chrome-btn" title={`Next edition at ${press.next}. This one stays as printed.`}>
            {press.label}
          </span>
        </div>
      </div>

      <PagerIndexContext.Provider value={pageIndex}>
        <TimesCommitBoundary>
        <div className="tt-spread">
          <div
            className="newspaper-edition wsj-pager"
            ref={pagerRef}
            style={{ visibility: revealed ? "visible" : "hidden" }}
            aria-hidden={revealed ? undefined : true}
          >
            {docReady ? sheets : null}
          </div>
          {!revealed ? (
            <div className="tt-hold" aria-busy="true">
              <TimesHold line={holdLine} day={day} />
            </div>
          ) : null}
          {newerEdition ? (
            <button
              type="button"
              className="tt-new-edition"
              onClick={() => selectEdition(newerEdition)}
            >
              {`The ${parsePressId(newerEdition)?.label ?? "new edition"} is out — tap to read it`}
            </button>
          ) : null}
        </div>
        </TimesCommitBoundary>
      </PagerIndexContext.Provider>
      {savedOpen ? <SavedDrawer onClose={() => setSavedOpen(false)} /> : null}
      </ReaderProvider>
      </SavedProvider>
      </PlayerPopProvider>
      </OpenerContext.Provider>
      </GameLookup.Provider>
    </div>
  );
}
