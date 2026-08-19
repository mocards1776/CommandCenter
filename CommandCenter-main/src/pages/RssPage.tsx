import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type TouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Ban,
  Bookmark,
  BookmarkCheck,
  CheckCheck,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  Folder,
  Hash,
  Highlighter,
  Inbox,
  RefreshCw,
  Share,
  Square,
  Star,
  Layers,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import DispatchEspnGameReader from "@/components/rss/DispatchEspnGameReader";
import DispatchPlayerReader from "@/components/rss/DispatchPlayerReader";
import DispatchNotesAside from "@/components/rss/DispatchNotesAside";
import RssQuoteShareCard from "@/components/rss/RssQuoteShareCard";
import {
  addCustomFeed,
  loadCustomFeeds,
  removeCustomFeed,
  type CustomRssFeed,
} from "@/lib/custom-feeds";
import {
  loadFavoriteFeedIds,
  toggleFavoriteFeed,
} from "@/lib/favorite-feeds";
import {
  RSS_FEEDS,
  RSS_FEED_FOLDERS,
  RSS_SEPARATE_FEEDS,
  addDedupeKeepHost,
  addRssFilter,
  applyRssFilters,
  articlePublisherLabel,
  articleSourceHost,
  cleanArticleTitle,
  contentHidePhrases,
  createRssHighlight,
  feedSourceLabel,
  firstContentImageUrl,
  hidePhrasesInHtml,
  scrubReaderChrome,
  repairRssContentImages,
  stripDuplicateContentImages,
  dedupeArticles,
  encodeFeedDomainFilter,
  loadDedupeKeepHosts,
  markQuotesInHtml,
  parseFeedScopedFilter,
  parsePlayerArticleLink,
  parseMlbGameArticleLink,
  partitionDedupedArticles,
  deleteRssFilter,
  deleteRssHighlight,
  feedIdsForFolder,
  isFeedFolderId,
  isEspnWrapFeedUrl,
  articleNeedsEdgeExtract,
  clearExtractSession,
  fetchRssArticle,
  isThinRssExtract,
  fetchRssFeed,
  fetchRssFilters,
  fetchRssHighlights,
  fetchRssReads,
  fetchRssSaves,
  prefetchRssArticles,
  formatFeedDate,
  markRssRead,
  markRssReadMany,
  markRssUnread,
  removeDedupeKeepHost,
  saveRssArticle,
  splitTextByQuotes,
  suggestUrlFilterValue,
  unsaveRssArticle,
  updateRssHighlightNote,
  type RssFeedDef,
  type RssFeedFolder,
  type RssFeedId,
  type RssFeedItem,
  type RssFeedItemRef,
  type RssFilter,
  type RssFilterKind,
  type RssHighlight,
} from "@/lib/rss";
import {
  displayPlayerTag,
  fetchUserTagNames,
  tagFeedId,
  tagFeedUrl,
} from "@/lib/sports-player-tags";
import { setRssReaderBrand } from "@/lib/rss-brand";
import { useArticleNavKeys } from "@/hooks/useArticleNavKeys";
import { nflTeamLogo } from "@/lib/nfl";
import { soccerTeamLogo } from "@/lib/soccer";
import TeamMark from "@/components/sports/TeamMark";

const DISPATCH_OPEN_KEY = "dispatch-open-article-v1";

type DispatchOpenSnapshot = {
  item: RssFeedItemRef;
  queue: RssFeedItemRef[] | null;
};

function persistDispatchOpen(item: RssFeedItemRef | null, queue: RssFeedItemRef[] | null) {
  try {
    if (!item) {
      sessionStorage.removeItem(DISPATCH_OPEN_KEY);
      return;
    }
    const snap: DispatchOpenSnapshot = { item, queue };
    sessionStorage.setItem(DISPATCH_OPEN_KEY, JSON.stringify(snap));
  } catch {
    /* ignore quota / private mode */
  }
}

function loadDispatchOpen(): DispatchOpenSnapshot | null {
  try {
    const raw = sessionStorage.getItem(DISPATCH_OPEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DispatchOpenSnapshot;
    if (!parsed?.item?.link || !parsed.item.feedUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}
import {
  buildPlayerNameIndex,
  extractPlayerNameCandidates,
  fetchMlbTeamRoster,
  linkifyMlbPlayersInHtml,
  mlbTeamLogo,
  normalizePersonName,
  parseEspnGameIdFromUrl,
  playerWatchKind,
  searchMlbPlayersByNames,
  type PlayerWatchKind,
} from "@/lib/mlb";
import { MlbGameDetail } from "@/pages/MlbGamePage";
import { listFavoritePlayers } from "@/lib/favorite-players";
import { fetchTaggedPlayerIds } from "@/lib/sports-player-tags";
import { useAuth } from "@/lib/auth-context";
import { cn, isPublishedTodayCentral } from "@/lib/utils";

type NavView =
  | "unread"
  | "saved"
  | RssFeedId
  | "notes"
  | "filters"
  | "duplicates"
  | "folder:tags"
  | "folder:favorites";

function readingMinutes(words: number): string {
  const m = Math.max(1, Math.round(words / 220));
  return `${m} min read`;
}

function HighlightComposer({
  quote,
  onSave,
  onCancel,
  onHideText,
  onBlockArticle,
  saving,
  hiding,
  blocking,
}: {
  quote: string;
  onSave: (note: string) => void;
  onCancel: () => void;
  onHideText: () => void;
  onBlockArticle: () => void;
  saving: boolean;
  hiding: boolean;
  blocking: boolean;
}) {
  const [note, setNote] = useState("");
  const busy = saving || hiding || blocking;
  return (
    <div className="bg-panel border-accent/40 fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded border p-4 shadow-2xl md:inset-x-auto md:right-6 md:bottom-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="label-caps text-accent">Selection</div>
          <p className="text-chalk-dim mt-1 text-[11px] leading-snug">
            Save the quote, hide this text in articles, or block the whole story.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-chalk-dim hover:text-cream disabled:opacity-40"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      <blockquote className="font-rss text-cream/90 border-accent/40 mb-3 border-l-2 pl-3 text-[15px] leading-relaxed italic">
        {quote}
      </blockquote>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional — for Save quote)"
        rows={3}
        disabled={busy}
        className="font-rss bg-field placeholder:text-chalk-dim text-cream mb-3 w-full resize-none rounded-sm border border-white/10 px-3 py-2 text-[15px] outline-none focus:border-accent/50 disabled:opacity-50"
      />
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(note)}
          className="from-accent-deep to-accent-dark text-cream inline-flex w-full items-center justify-center gap-2 rounded-sm bg-gradient-to-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
        >
          <Highlighter size={13} />
          Save quote
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onHideText}
            title="Remove this text wherever it appears — keep the article"
            className="text-chalk hover:text-cream inline-flex items-center justify-center gap-1.5 rounded-sm border border-white/10 px-3 py-2.5 text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
          >
            <EyeOff size={13} />
            Hide text
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onBlockArticle}
            title="Block this article from feeds"
            className="text-alert hover:bg-alert/10 inline-flex items-center justify-center gap-1.5 rounded-sm border border-alert/40 px-3 py-2.5 text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
          >
            <Ban size={13} />
            Block article
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-chalk hover:text-cream px-3 py-2 text-center text-[11px] uppercase tracking-[0.16em] disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function HighlightCard({
  highlight,
  onDelete,
  onUpdateNote,
  onShare,
}: {
  highlight: RssHighlight;
  onDelete: () => void;
  onUpdateNote: (note: string) => void;
  onShare: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(highlight.note);

  function save(e: FormEvent) {
    e.preventDefault();
    onUpdateNote(draft);
    setEditing(false);
  }

  const source = articlePublisherLabel(highlight.articleUrl);

  return (
    <li className="border-white/[0.08] border-b pb-4 last:border-0">
      <button
        type="button"
        onClick={onShare}
        className="group relative w-full overflow-hidden rounded-sm border border-white/[0.08] bg-gradient-to-br from-[#0c1a36] via-[#081228] to-[#1a0e14] text-left transition-transform hover:scale-[1.01]"
      >
        {highlight.articleImage ? (
          <div className="relative aspect-[16/7] w-full overflow-hidden">
            <img
              src={highlight.articleImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#081228] via-[#081228]/55 to-transparent" />
          </div>
        ) : null}
        <div className="relative px-4 pt-4 pb-4">
          <span
            aria-hidden
            className="font-rss text-accent/50 pointer-events-none absolute top-1 left-2 text-[56px] leading-none"
          >
            “
          </span>
          <p className="text-accent mb-1 text-[9px] font-semibold uppercase tracking-[0.22em]">
            {source}
          </p>
          <blockquote className="font-rss text-cream relative z-[1] whitespace-pre-wrap pl-1 text-[18px] leading-relaxed italic sm:text-[20px]">
            {highlight.quoteText}
          </blockquote>
          {highlight.note ? (
            <p className="font-rss text-chalk mt-3 border-t border-white/10 pt-2 text-[13px] leading-relaxed">
              {highlight.note}
            </p>
          ) : null}
          <p className="text-chalk-dim mt-3 text-[10px] uppercase tracking-[0.16em] opacity-70 group-hover:opacity-100">
            Tap to share
          </p>
        </div>
      </button>
      {editing ? (
        <form onSubmit={save} className="mt-2 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="font-rss bg-field text-cream w-full resize-none rounded-sm border border-white/10 px-3 py-2 text-[14px] outline-none focus:border-accent/50"
          />
          <div className="flex gap-2">
            <button type="submit" className="text-accent text-[11px] uppercase tracking-[0.16em]">
              Save note
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(highlight.note);
                setEditing(false);
              }}
              className="text-chalk text-[11px] uppercase tracking-[0.16em]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-rss text-chalk hover:text-cream text-left text-[14px] leading-relaxed"
          >
            {highlight.note || <span className="italic opacity-70">Add a comment…</span>}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete highlight"
            className="text-chalk-dim hover:text-alert shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </li>
  );
}

function useSwipeNav(opts: {
  onBack: () => void;
  onNext: (() => void) | null;
  enabled: boolean;
}) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!node) return;

    const onTouchStart = (e: globalThis.TouchEvent) => {
      if (!optsRef.current.enabled) return;
      const t = e.changedTouches[0] ?? e.touches[0];
      if (!t) return;
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    };

    const onTouchEnd = (e: globalThis.TouchEvent) => {
      const o = optsRef.current;
      if (!o.enabled || !start.current) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      const startX = start.current.x;
      const held = Date.now() - start.current.t;
      start.current = null;

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && (sel.toString() || "").trim().length >= 2) return;
      if (held > 700) return;
      if (Math.abs(dx) < 48) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.05) return;

      // Swipe left → previous screen. Also honor iOS-style edge swipe right.
      if (dx < 0 || (startX < 36 && dx > 0)) {
        o.onBack();
        return;
      }
      if (o.onNext) o.onNext();
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchend", onTouchEnd);
    };
  }, [node]);

  return setNode;
}

/** Double-tap (not on controls) advances to the next article. */
function useDoubleTapNext(onNext: (() => void) | null, enabled: boolean) {
  const lastTap = useRef(0);
  return (e: { target: EventTarget | null }) => {
    if (!enabled || !onNext) return;
    const el = e.target as HTMLElement | null;
    if (!el) return;
    // Ignore interactive targets and in-article selection handles.
    if (
      el.closest(
        "a, button, input, textarea, select, [role='dialog'], video, label, summary, [data-no-double-tap]",
      )
    ) {
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      onNext();
    } else {
      lastTap.current = now;
    }
  };
}

/** Turn `.rss-tweet` blockquotes into a compact X/Twitter feed card. */
function stylizeTweetCardsInHtml(html: string): string {
  if (!html || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;
  root.querySelectorAll("blockquote.rss-tweet, blockquote").forEach((bq) => {
    const hay = `${bq.className} ${bq.textContent ?? ""}`;
    const isTweet =
      /rss-tweet|twitter-tweet/i.test(bq.className) ||
      /@\w+/.test(hay) ||
      /(?:twitter\.com|x\.com)\/\w+\/status/i.test(bq.innerHTML);
    if (!isTweet) return;
    if (bq.closest(".rss-tweet-card")) return;

    const meta =
      bq.querySelector("footer, cite, .rss-tweet-meta")?.textContent?.replace(/\s+/g, " ").trim() ||
      "";
    const handleMatch = meta.match(/@(\w+)/);
    const nameMatch = meta.match(/—\s*([^(@]+)/);
    const handle = handleMatch?.[1] ?? "user";
    const display = (nameMatch?.[1] ?? handle).trim();
    const link = bq.querySelector("footer a, cite a, .rss-tweet-meta a") as HTMLAnchorElement | null;
    const dateLabel = link?.textContent?.trim() || "";
    const href = link?.href || "";

    const bodyClone = bq.cloneNode(true) as HTMLElement;
    bodyClone.querySelectorAll("footer, cite, .rss-tweet-meta, script").forEach((n) => n.remove());
    const bodyHtml = bodyClone.innerHTML.trim();

    const card = doc.createElement("figure");
    card.className = "rss-tweet-card";
    card.innerHTML = `
      <div class="rss-tweet-card__head">
        <span class="rss-tweet-card__avatar" aria-hidden="true">${(display[0] || "X").toUpperCase()}</span>
        <div class="rss-tweet-card__who">
          <span class="rss-tweet-card__name">${display}</span>
          <span class="rss-tweet-card__handle">@${handle}</span>
        </div>
        <span class="rss-tweet-card__mark" aria-hidden="true">𝕏</span>
      </div>
      <div class="rss-tweet-card__body">${bodyHtml}</div>
      ${
        dateLabel
          ? `<div class="rss-tweet-card__foot">${
              href
                ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${dateLabel}</a>`
                : dateLabel
            }</div>`
          : ""
      }
    `;
    bq.replaceWith(card);
  });
  return root.innerHTML;
}

function ReaderView({
  item,
  feedUrl,
  isRead,
  isSaved,
  hasPrev,
  hasNext,
  onBack,
  onPrev,
  onNext,
  onToggleRead,
  onToggleSave,
  onArchive,
}: {
  item: RssFeedItem;
  feedUrl: string;
  isRead: boolean;
  isSaved: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleRead: () => void;
  onToggleSave: () => void;
  onArchive: () => void;
}) {
  const playerArticleId = parsePlayerArticleLink(item.link);
  if (playerArticleId != null) {
    return (
      <PlayerArticleShell
        item={item}
        playerId={playerArticleId}
        isSaved={isSaved}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onClose={onBack}
        onPrev={onPrev}
        onNext={onNext}
        onToggleSave={onToggleSave}
        onArchive={onArchive}
      />
    );
  }

  const mlbGamePk = parseMlbGameArticleLink(item.link);
  if (mlbGamePk != null) {
    return (
      <MlbGameArticleShell
        item={item}
        gamePk={mlbGamePk}
        feedUrl={feedUrl}
        isSaved={isSaved}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onClose={onBack}
        onPrev={onPrev}
        onNext={onNext}
        onToggleSave={onToggleSave}
        onArchive={onArchive}
      />
    );
  }

  // MLB/NFL/soccer wraps open the sports game reader.
  const isEspnGame =
    feedUrl === "synthetic:cardinals-wraps" ||
    feedUrl === "synthetic:mlb-wraps" ||
    feedUrl === "synthetic:nfl-wraps" ||
    /espn\.com\/(?:mlb|nfl)\/(?:recap|preview|game)/i.test(item.link) ||
    Boolean(parseEspnGameIdFromUrl(item.link));

  const isSoccerGame =
    feedUrl === "synthetic:soccer-clubs-wraps" ||
    feedUrl === "synthetic:epl-wraps" ||
    /espn\.com\/soccer\/(?:match|preview|report|recap)/i.test(item.link);

  // ESPN wraps/previews → sports game UI (matchup + wrap + stats).
  if (isEspnGame || isSoccerGame) {
    return (
      <EspnGameReaderShell
        item={item}
        feedUrl={feedUrl}
        isSaved={isSaved}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onClose={onBack}
        onPrev={onPrev}
        onNext={onNext}
        onToggleSave={onToggleSave}
        onArchive={onArchive}
      />
    );
  }

  // Synthetic digests (stats board) skip the ESPN path.

  return (
    <ArticleReaderShell
      item={item}
      feedUrl={feedUrl}
      isRead={isRead}
      isSaved={isSaved}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onClose={onBack}
      onPrev={onPrev}
      onNext={onNext}
      onToggleRead={onToggleRead}
      onToggleSave={onToggleSave}
      onArchive={onArchive}
    />
  );
}

function EspnGameReaderShell({
  item,
  feedUrl,
  isSaved,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  onToggleSave,
  onArchive,
}: {
  item: RssFeedItem;
  feedUrl: string;
  isSaved: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleSave: () => void;
  onArchive: () => void;
}) {
  const qc = useQueryClient();

  const leave = () => {
    onClose();
    const st = (history.state as { dispatchArticle?: string } | null) ?? {};
    if (st.dispatchArticle) history.back();
  };

  const onDoubleTap = useDoubleTapNext(hasNext ? onNext : null, true);

  useArticleNavKeys({ hasPrev, hasNext, onPrev, onNext });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [item.link]);

  useEffect(() => {
    const st = (history.state as { dispatchArticle?: string } | null) ?? {};
    if (!st.dispatchArticle) {
      history.pushState({ ...st, dispatchArticle: item.link }, "", window.location.href);
    } else if (st.dispatchArticle !== item.link) {
      history.replaceState({ ...st, dispatchArticle: item.link }, "", window.location.href);
    }
    const onPop = () => {
      onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [item.link, onClose]);

  useEffect(() => {
    void markRssRead({
      articleUrl: item.link,
      articleTitle: item.title,
      feedUrl,
    })
      .then(() => qc.invalidateQueries({ queryKey: ["rss-reads"] }))
      .catch(() => {});
  }, [item.link, item.title, feedUrl, qc]);

  return (
    <div
      className="grid w-full max-w-full min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:pr-0"
      onClick={onDoubleTap}
    >
      <div className="mx-auto w-full max-w-3xl min-w-0 justify-self-center overflow-x-hidden">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
          <button
            type="button"
            onClick={onToggleSave}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            {isSaved ? (
              <BookmarkCheck size={14} className="text-accent" />
            ) : (
              <Bookmark size={14} />
            )}
            {isSaved ? "Saved" : "Save for later"}
          </button>
          <button
            type="button"
            onClick={onArchive}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            <Archive size={14} />
            Archive
          </button>
        </div>
        <DispatchEspnGameReader
          url={item.link}
          title={item.title}
          heroImage={item.image}
          leagueHint={
            feedUrl === "synthetic:epl-wraps"
              ? "eng.1"
              : feedUrl === "synthetic:soccer-clubs-wraps"
                ? "eng.2"
                : null
          }
          onBack={leave}
          onPrev={hasPrev ? onPrev : undefined}
          onNext={hasNext ? onNext : undefined}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />
      </div>
      <aside className="bg-panel border-white/[0.06] hidden min-w-0 border-y border-l p-4 md:p-5 lg:block lg:rounded-none lg:border-r-0">
        <div className="rule-head mb-4">Notes</div>
        <p className="text-chalk font-rss text-[15px] leading-relaxed">
          Game wraps open here — highlights live on article readers.
        </p>
        <DispatchNotesAside />
      </aside>
    </div>
  );
}

function MlbGameArticleShell({
  item,
  gamePk,
  feedUrl,
  isSaved,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  onToggleSave,
  onArchive,
}: {
  item: RssFeedItem;
  gamePk: number;
  feedUrl: string;
  isSaved: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleSave: () => void;
  onArchive: () => void;
}) {
  const qc = useQueryClient();

  const leave = () => {
    onClose();
    const st = (history.state as { dispatchArticle?: string } | null) ?? {};
    if (st.dispatchArticle) history.back();
  };

  const onDoubleTap = useDoubleTapNext(hasNext ? onNext : null, true);

  useArticleNavKeys({ hasPrev, hasNext, onPrev, onNext });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [item.link]);

  useEffect(() => {
    const st = (history.state as { dispatchArticle?: string } | null) ?? {};
    if (!st.dispatchArticle) {
      history.pushState({ ...st, dispatchArticle: item.link }, "", window.location.href);
    } else if (st.dispatchArticle !== item.link) {
      history.replaceState({ ...st, dispatchArticle: item.link }, "", window.location.href);
    }
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [item.link, onClose]);

  useEffect(() => {
    void markRssRead({
      articleUrl: item.link,
      articleTitle: item.title,
      feedUrl,
    })
      .then(() => qc.invalidateQueries({ queryKey: ["rss-reads"] }))
      .catch(() => {});
  }, [item.link, item.title, feedUrl, qc]);

  return (
    <div
      className="grid w-full max-w-full min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:pr-0"
      onClick={onDoubleTap}
    >
      <div className="mx-auto w-full max-w-3xl min-w-0 justify-self-center overflow-x-hidden">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
          <button
            type="button"
            onClick={onToggleSave}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            {isSaved ? (
              <BookmarkCheck size={14} className="text-accent" />
            ) : (
              <Bookmark size={14} />
            )}
            {isSaved ? "Saved" : "Save for later"}
          </button>
          <button
            type="button"
            onClick={onArchive}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            <Archive size={14} />
            Archive
          </button>
        </div>
        <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 px-3 py-4 sm:p-4 md:p-7">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={leave}
              className="font-body text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            {(hasPrev || hasNext) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={onPrev}
                  className="font-body text-chalk hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={onNext}
                  className="font-body text-chalk hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] disabled:opacity-30"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
          <div>
            <p className="text-cream text-[10px] font-semibold uppercase tracking-[0.2em]">
              {item.author || "Farm wrap"}
            </p>
            <h2 className="font-rss text-cream mt-1 text-[22px] font-semibold leading-snug md:text-[26px]">
              {cleanArticleTitle(item.title)}
            </h2>
          </div>
          <MlbGameDetail gamePk={String(gamePk)} boxFirst />
        </div>
      </div>
      <aside className="bg-panel border-white/[0.06] hidden min-w-0 border-y border-l p-4 md:p-5 lg:block lg:rounded-none lg:border-r-0">
        <div className="rule-head mb-4">Notes</div>
        <p className="text-chalk font-rss text-[15px] leading-relaxed">
          Game wraps open here — highlights live on article readers.
        </p>
        <DispatchNotesAside />
      </aside>
    </div>
  );
}

function PlayerArticleShell({
  item,
  playerId,
  isSaved,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  onToggleSave,
  onArchive,
}: {
  item: RssFeedItem;
  playerId: number;
  isSaved: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleSave: () => void;
  onArchive: () => void;
}) {
  const qc = useQueryClient();
  const feedUrl = item.link.startsWith("app:") ? `synthetic:tag-player` : item.link;

  const leave = () => {
    onClose();
    const st = (history.state as { dispatchArticle?: string } | null) ?? {};
    if (st.dispatchArticle) history.back();
  };

  const onDoubleTap = useDoubleTapNext(hasNext ? onNext : null, true);

  useArticleNavKeys({ hasPrev, hasNext, onPrev, onNext });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [item.link]);

  useEffect(() => {
    const st = (history.state as { dispatchArticle?: string } | null) ?? {};
    if (!st.dispatchArticle) {
      history.pushState({ ...st, dispatchArticle: item.link }, "", window.location.href);
    } else if (st.dispatchArticle !== item.link) {
      history.replaceState({ ...st, dispatchArticle: item.link }, "", window.location.href);
    }
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [item.link, onClose]);

  useEffect(() => {
    void markRssRead({
      articleUrl: item.link,
      articleTitle: item.title,
      feedUrl,
    })
      .then(() => qc.invalidateQueries({ queryKey: ["rss-reads"] }))
      .catch(() => {});
  }, [item.link, item.title, feedUrl, qc]);

  return (
    <div style={{ touchAction: "pan-y" }} onClick={onDoubleTap}>
      <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
        <button
          type="button"
          onClick={onToggleSave}
          className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
        >
          {isSaved ? (
            <BookmarkCheck size={14} className="text-accent" />
          ) : (
            <Bookmark size={14} />
          )}
          {isSaved ? "Saved" : "Save for later"}
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
        >
          <Archive size={14} />
          Archive
        </button>
      </div>
      <DispatchPlayerReader
        playerId={playerId}
        title={item.title}
        onBack={leave}
        onPrev={hasPrev ? onPrev : undefined}
        onNext={hasNext ? onNext : undefined}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
    </div>
  );
}

function ArticleReaderShell({
  item,
  feedUrl,
  isRead,
  isSaved,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  onToggleRead,
  onToggleSave,
  onArchive,
}: {
  item: RssFeedItem;
  feedUrl: string;
  isRead: boolean;
  isSaved: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleRead: () => void;
  onToggleSave: () => void;
  onArchive: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const articleBodyRef = useRef<HTMLDivElement>(null);
  const titleSelectRef = useRef<HTMLElement>(null);
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [linkedHtml, setLinkedHtml] = useState<string>("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [shareHighlight, setShareHighlight] = useState<RssHighlight | null>(null);
  const refreshExtractRef = useRef(false);

  const article = useQuery({
    queryKey: ["rss-article-v2", item.link],
    queryFn: async () => {
      if (item.contentHtml) {
        return {
          url: item.link,
          title: item.title,
          byline: item.author,
          image: item.image,
          contentHtml: item.contentHtml,
          contentText: item.snippet,
          wordCount: item.snippet.split(/\s+/).filter(Boolean).length,
        };
      }
      const refresh = refreshExtractRef.current;
      refreshExtractRef.current = false;
      return fetchRssArticle(item.link, { refresh });
    },
    staleTime: 10 * 60_000,
  });
  const canReextract = articleNeedsEdgeExtract(item);
  const extractLooksThin = Boolean(article.data && isThinRssExtract(article.data));

  const highlights = useQuery({
    queryKey: ["rss-highlights", item.link],
    queryFn: () => fetchRssHighlights(item.link),
  });

  const { user } = useAuth();

  // Seed with Cardinals roster for fast local matches; search fills in any MLB player.
  const roster = useQuery({
    queryKey: ["mlb-roster-stl"],
    queryFn: () => fetchMlbTeamRoster(138),
    staleTime: 30 * 60_000,
  });

  const favPlayers = useQuery({
    queryKey: ["favorite-players", user?.id],
    queryFn: () => listFavoritePlayers(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const taggedPlayers = useQuery({
    queryKey: ["sports-player-tags-ids", user?.id],
    queryFn: fetchTaggedPlayerIds,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const favoritePlayerIds = useMemo(() => {
    const set = new Set<number>();
    for (const f of favPlayers.data ?? []) {
      if (f.position === "manager") continue;
      const id = Number(f.playerId);
      if (Number.isFinite(id)) set.add(id);
    }
    return set;
  }, [favPlayers.data]);

  const favoritePlayerNames = useMemo(() => {
    const set = new Set<string>();
    for (const f of favPlayers.data ?? []) {
      if (f.position === "manager") continue;
      const n = normalizePersonName(f.playerName);
      if (n) set.add(n);
    }
    return set;
  }, [favPlayers.data]);

  const taggedPlayerIds = useMemo(() => {
    const set = new Set<number>();
    for (const id of taggedPlayers.data ?? []) set.add(id);
    return set;
  }, [taggedPlayers.data]);

  const watchMarks = useMemo(() => {
    const map = new Map<number, PlayerWatchKind>();
    for (const id of taggedPlayerIds) {
      const kind = playerWatchKind(id, favoritePlayerIds, taggedPlayerIds);
      if (kind) map.set(id, kind);
    }
    for (const id of favoritePlayerIds) map.set(id, "favorite");
    return map;
  }, [favoritePlayerIds, taggedPlayerIds]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [item.link]);

  // Browser / iOS back from the article returns to the feed list.
  // Player names link to the real player page; session restore reopens this article.
  useEffect(() => {
    type Hist = { dispatchArticle?: string };
    const st = (history.state as Hist | null) ?? {};
    if (!st.dispatchArticle) {
      history.pushState({ dispatchArticle: item.link }, "", window.location.href);
    } else if (st.dispatchArticle !== item.link) {
      history.replaceState({ dispatchArticle: item.link }, "", window.location.href);
    }
    const onPop = () => {
      onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [item.link, onClose]);

  useEffect(() => {
    void markRssRead({
      articleUrl: item.link,
      articleTitle: item.title,
      feedUrl,
    })
      .then(() => qc.invalidateQueries({ queryKey: ["rss-reads"] }))
      .catch(() => {});
  }, [item.link, item.title, feedUrl, qc]);

  // Escape closes the lightbox.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && lightboxSrc) {
        e.preventDefault();
        setLightboxSrc(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  // Arrow keys: previous / next article (desktop). Blocked while the lightbox or
  // quote-note picker is open so ArrowLeft/Right don't fight text selection/inputs.
  useArticleNavKeys({
    hasPrev,
    hasNext,
    onPrev,
    onNext,
    blocked: Boolean(pendingQuote || lightboxSrc),
  });

  const title = cleanArticleTitle(article.data?.title || item.title);
  const byline = article.data?.byline || item.author;
  const publisher = articlePublisherLabel(item.link, byline);
  const rawImage = article.data?.image || item.image;
  const contentImage = useMemo(
    () => firstContentImageUrl(linkedHtml || article.data?.contentHtml),
    [linkedHtml, article.data?.contentHtml],
  );
  const image = rawImage || contentImage;
  const quoteTexts = useMemo(
    () => (highlights.data ?? []).map((h) => h.quoteText).filter(Boolean),
    [highlights.data],
  );
  const titleParts = useMemo(() => splitTextByQuotes(title, quoteTexts), [title, quoteTexts]);

  useEffect(() => {
    setRssReaderBrand(publisher);
    return () => setRssReaderBrand(null);
  }, [publisher]);

  const contentFilters = useQuery({
    queryKey: ["rss-filters"],
    queryFn: fetchRssFilters,
    staleTime: 60_000,
  });

  const hidePhrases = useMemo(
    () => contentHidePhrases(contentFilters.data ?? []),
    [contentFilters.data],
  );

  // Bake marks into the HTML string so React re-renders / scroll don't wipe them.
  // Content hides (MLB signup chrome + user “Hide” phrases) collapse clutter blocks.
  // Strip hero duplicates so the header photo isn't repeated in the body.
  const displayHtml = useMemo(() => {
    const base = linkedHtml || article.data?.contentHtml || "";
    const scrubbed = scrubReaderChrome(base);
    const cleaned = hidePhrasesInHtml(scrubbed, hidePhrases);
    const deduped = stripDuplicateContentImages(cleaned, image);
    return markQuotesInHtml(deduped, quoteTexts);
  }, [linkedHtml, article.data?.contentHtml, quoteTexts, hidePhrases, image]);

  // Click images in article body → fullscreen lightbox.
  useEffect(() => {
    const root = articleBodyRef.current;
    if (!root) return;
    const onImgClick = (e: MouseEvent) => {
      const img = (e.target as HTMLElement | null)?.closest("img");
      if (!img || !root.contains(img)) return;
      const src = img.getAttribute("src");
      if (!src) return;
      e.preventDefault();
      e.stopPropagation();
      setLightboxSrc(src);
    };
    root.addEventListener("click", onImgClick);
    return () => root.removeEventListener("click", onImgClick);
  }, [displayHtml]);

  // Link any MLB player names → player page; stylize tweet cards; repair imgs.
  useEffect(() => {
    const html = article.data?.contentHtml;
    if (!html) {
      setLinkedHtml("");
      return;
    }
    let cancelled = false;
    (async () => {
      const repaired = repairRssContentImages(html, item.link);
      const players = roster.data ?? [];
      const index = buildPlayerNameIndex(players, { bareLastNames: true });
      const candidates = extractPlayerNameCandidates(article.data?.contentText ?? "", 48);
      if (candidates.length) {
        const found = await searchMlbPlayersByNames(candidates, 48);
        for (const [k, id] of found) index.set(k, id);
      }
      if (cancelled) return;
      const linked = linkifyMlbPlayersInHtml(
        repaired,
        index,
        watchMarks,
        favoritePlayerNames,
      );
      setLinkedHtml(stylizeTweetCardsInHtml(linked));
    })().catch(() => {
      if (!cancelled) {
        setLinkedHtml(
          stylizeTweetCardsInHtml(repairRssContentImages(html, item.link)),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    article.data?.contentHtml,
    article.data?.contentText,
    roster.data,
    watchMarks,
    favoritePlayerNames,
    item.link,
  ]);

  // Film Room / highlight videos: force muted autoplay after mount.
  useEffect(() => {
    const root = articleBodyRef.current;
    if (!root) return;
    const videos = root.querySelectorAll<HTMLVideoElement>("video.rss-video");
    videos.forEach((v) => {
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("muted", "");
      v.setAttribute("autoplay", "");
      const play = () => {
        void v.play().catch(() => {});
      };
      if (v.readyState >= 2) play();
      else v.addEventListener("loadeddata", play, { once: true });
    });
  }, [displayHtml]);

  const createMut = useMutation({
    mutationFn: (note: string) =>
      createRssHighlight({
        articleUrl: item.link,
        articleTitle: (article.data?.title || item.title || "").trim() || "Untitled",
        feedUrl,
        articleImage: article.data?.image || item.image || null,
        quoteText: pendingQuote ?? "",
        note,
      }),
    onSuccess: () => {
      setPendingQuote(null);
      void qc.invalidateQueries({ queryKey: ["rss-highlights", item.link] });
      void qc.invalidateQueries({ queryKey: ["rss-highlights-all"] });
      const toastId = toast.success("Highlight saved", { duration: 2000 });
      // Belt-and-suspenders: force-clear even if the toaster pause timer stalls.
      window.setTimeout(() => toast.dismiss(toastId), 2400);
      setShowNotes(true);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const hideContentMut = useMutation({
    mutationFn: (phrase: string) => addRssFilter("content", phrase),
    onSuccess: () => {
      setPendingQuote(null);
      void qc.invalidateQueries({ queryKey: ["rss-filters"] });
      toast.success("Hidden in articles");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not hide text"),
  });

  const blockArticleMut = useMutation({
    mutationFn: () => addRssFilter("url", item.link),
    onSuccess: () => {
      setPendingQuote(null);
      void qc.invalidateQueries({ queryKey: ["rss-filters"] });
      toast.success("Article blocked");
      onClose();
      const st = (history.state as { dispatchArticle?: string } | null) ?? {};
      if (st.dispatchArticle) history.back();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not block article"),
  });

  const blockDomainMut = useMutation({
    mutationFn: (value: string) => addRssFilter("url", value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rss-filters"] });
      toast.success("Domain blocked");
      onClose();
      const st = (history.state as { dispatchArticle?: string } | null) ?? {};
      if (st.dispatchArticle) history.back();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not block domain"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteRssHighlight,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rss-highlights", item.link] });
      void qc.invalidateQueries({ queryKey: ["rss-highlights-all"] });
    },
  });

  const noteMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => updateRssHighlightNote(id, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rss-highlights", item.link] });
      void qc.invalidateQueries({ queryKey: ["rss-highlights-all"] });
    },
  });

  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (text.length < 2) return;
    const root = articleBodyRef.current;
    const header = titleSelectRef.current;
    const anchor = sel.anchorNode;
    if (!anchor) return;
    const inBody = Boolean(root && root.contains(anchor));
    const inTitle = Boolean(header && header.contains(anchor));
    if (!inBody && !inTitle) return;
    setPendingQuote(text.slice(0, 2000));
    sel.removeAllRanges();
  }

  const leave = () => {
    onClose();
    const st = (history.state as { dispatchArticle?: string } | null) ?? {};
    if (st.dispatchArticle) history.back();
  };

  const onDoubleTap = useDoubleTapNext(
    hasNext ? onNext : null,
    !pendingQuote && !lightboxSrc,
  );

  async function shareArticle() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: item.link, text: title });
      } else {
        await navigator.clipboard.writeText(item.link);
        toast.success("Link copied");
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(item.link);
        toast.success("Link copied");
      } catch {
        toast.error("Couldn't share");
      }
    }
  }

  return (
    <div
      className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:pr-0"
      style={{ touchAction: "pan-y" }}
      onClick={onDoubleTap}
    >
      <article className="font-rss mx-auto min-w-0 max-w-3xl justify-self-center">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={leave}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <button
            type="button"
            onClick={onToggleRead}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            {isRead ? <CheckCheck size={14} className="text-turf" /> : <Circle size={14} />}
            {isRead ? "Read" : "Mark read"}
          </button>
          <button
            type="button"
            onClick={onToggleSave}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            {isSaved ? (
              <BookmarkCheck size={14} className="text-accent" />
            ) : (
              <Bookmark size={14} />
            )}
            {isSaved ? "Saved" : "Save for later"}
          </button>
          <button
            type="button"
            onClick={onArchive}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            <Archive size={14} />
            Archive
          </button>
          <button
            type="button"
            onClick={() => void shareArticle()}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            <Share size={14} />
            Share
          </button>
          {canReextract ? (
            <button
              type="button"
              onClick={() => {
                clearExtractSession(item.link);
                refreshExtractRef.current = true;
                void article.refetch();
              }}
              disabled={article.isFetching}
              title="Clear the cached extract and pull the article again"
              className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] disabled:opacity-40"
            >
              <RefreshCw size={14} className={article.isFetching ? "animate-spin" : undefined} />
              Re-extract
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] lg:hidden"
          >
            <Highlighter size={14} />
            Notes ({highlights.data?.length ?? 0})
          </button>
        </div>

        <header
          ref={titleSelectRef}
          className="mb-8"
          onMouseUp={captureSelection}
          onTouchEnd={() => {
            window.setTimeout(captureSelection, 50);
          }}
        >
          <div className="label-caps font-body text-accent mb-3">
            {formatFeedDate(item.publishedAt)}
            {` · ${publisher}`}
            {article.data?.wordCount ? ` · ${readingMinutes(article.data.wordCount)}` : ""}
            {/rotowire|rotoworld/i.test(item.author ?? publisher) &&
            isPublishedTodayCentral(item.publishedAt) ? (
              <span className="ml-2 inline-flex rounded-sm bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-accent">
                New
              </span>
            ) : null}
          </div>
          <h2 className="text-cream text-[32px] leading-[1.15] font-semibold md:text-[40px]">
            {titleParts.map((part, i) =>
              part.highlighted ? (
                <mark key={i} className="rss-hl">
                  {part.text}
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              ),
            )}
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-chalk hover:text-accent inline-flex items-center gap-1.5 text-[12px] transition-colors"
            >
              {publisher}
              <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={() => {
                const host = articleSourceHost(item.link);
                const feedId =
                  RSS_FEEDS.find((f) => f.url === feedUrl)?.id ??
                  (feedUrl.startsWith("synthetic:")
                    ? feedUrl.replace(/^synthetic:/, "")
                    : null);
                if (feedId && host) {
                  blockDomainMut.mutate(encodeFeedDomainFilter(feedId, host));
                } else {
                  blockDomainMut.mutate(suggestUrlFilterValue(item.link));
                }
              }}
              disabled={blockDomainMut.isPending}
              title="Block this domain"
              className="font-body text-chalk-dim hover:text-alert inline-flex items-center gap-1 text-[12px] transition-colors disabled:opacity-40"
            >
              <Ban size={12} />
              Block domain
            </button>
          </div>
        </header>

        {!displayHtml.includes("<video") ? (
          image ? (
            <button
              type="button"
              onClick={() => setLightboxSrc(image)}
              className="mb-8 block w-full overflow-hidden rounded-sm"
            >
              <img
                src={image}
                alt=""
                referrerPolicy="no-referrer"
                className="max-h-[320px] w-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (item.logoTeamIds?.length) {
                    el.src = mlbTeamLogo(item.logoTeamIds[0]!);
                    el.className = "mx-auto h-40 w-40 object-contain bg-white p-4";
                  } else if (item.logoAbbrevs?.length) {
                    el.src = nflTeamLogo(item.logoAbbrevs[0]!);
                    el.className = "mx-auto h-40 w-40 object-contain";
                  } else if (item.logoSoccerIds?.length) {
                    el.src = soccerTeamLogo(item.logoSoccerIds[0]!);
                    el.className = "mx-auto h-40 w-40 object-contain";
                  }
                }}
              />
            </button>
          ) : item.logoTeamIds?.length ? (
            <div className="mb-8 flex items-center justify-center gap-6 rounded-sm bg-white/[0.04] py-8">
              {item.logoTeamIds.map((id) => (
                <TeamMark key={id} teamId={id} size="xl" />
              ))}
            </div>
          ) : item.logoAbbrevs?.length ? (
            <div className="mb-8 flex items-center justify-center gap-6 rounded-sm bg-white/[0.04] py-8">
              {item.logoAbbrevs.map((ab) => (
                <img
                  key={ab}
                  src={nflTeamLogo(ab)}
                  alt={ab}
                  className="h-20 w-20 object-contain"
                />
              ))}
            </div>
          ) : item.logoSoccerIds?.length ? (
            <div className="mb-8 flex items-center justify-center gap-6 rounded-sm bg-white/[0.04] py-8">
              {item.logoSoccerIds.map((id) => (
                <img
                  key={id}
                  src={soccerTeamLogo(id)}
                  alt=""
                  className="h-20 w-20 object-contain"
                />
              ))}
            </div>
          ) : (
            <div className="from-hero-lift to-hero mb-8 flex min-h-[160px] items-end rounded-sm bg-gradient-to-br px-5 py-6">
              <p className="font-rss text-cream/90 text-[18px] leading-snug">{publisher}</p>
            </div>
          )
        ) : null}

        {article.isLoading ? (
          <p className="label-caps font-body animate-pulse">Extracting text</p>
        ) : article.isError ? (
          <div className="bg-panel border-alert/40 font-body text-alert rounded border p-4 text-sm">
            Could not extract article text:{" "}
            {article.error instanceof Error ? article.error.message : String(article.error)}
            {canReextract ? (
              <button
                type="button"
                onClick={() => {
                  clearExtractSession(item.link);
                  refreshExtractRef.current = true;
                  void article.refetch();
                }}
                className="text-cream mt-3 block text-[11px] font-semibold uppercase tracking-[0.14em] underline"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : extractLooksThin ? (
          <div className="border-accent/40 bg-accent/10 font-body mb-5 rounded border px-3 py-2 text-[12px] text-[#f0d4d6]">
            This extract looks short — MLB.com often only sends a teaser. Use Re-extract, or open the original.
          </div>
        ) : null}
        {article.isLoading || article.isError ? null : (
          <div
            ref={articleBodyRef}
            onMouseUp={captureSelection}
            onTouchEnd={() => {
              window.setTimeout(captureSelection, 50);
            }}
            onClick={(e) => {
              const a = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
              if (!a || !articleBodyRef.current?.contains(a)) return;
              const href = a.getAttribute("href") ?? "";
              if (
                /\/sports\/mlb\/player\/\d+/.test(href) ||
                /\/sports\/mlb\/game\/\d+/.test(href) ||
                /^\/sports(\?|$)/.test(href)
              ) {
                e.preventDefault();
                navigate(href);
              }
            }}
            className="rss-reader max-w-none text-[20px] leading-[1.8] text-[#eceef4] [&_a]:text-cream [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2 [&_a.rss-player-link]:text-[#fffaf5] [&_a.rss-player-link]:decoration-cream/40 [&_a.rss-player-link]:underline-offset-[3px] [&_em]:text-[#d9dce6] [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:text-cream [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-[22px] [&_h3]:font-semibold [&_h3]:text-cream [&_img]:my-6 [&_img]:max-h-[360px] [&_img]:w-full [&_img]:object-contain [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-4 [&_strong]:font-semibold [&_strong]:text-cream [&_table]:my-4 [&_table]:w-full [&_table]:text-left [&_table]:text-[15px] [&_td]:border-b [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-white/20 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-chalk-dim [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_video.rss-video]:my-6 [&_video.rss-video]:aspect-video [&_video.rss-video]:w-full [&_video.rss-video]:rounded-lg [&_video.rss-video]:bg-black [&_figcaption]:hidden [&_figure]:my-6 [&_img.rss-savant-mug]:my-0 [&_img.rss-savant-mug]:mr-0 [&_img.rss-savant-mug]:inline-block [&_img.rss-savant-mug]:h-7 [&_img.rss-savant-mug]:w-7 [&_img.rss-savant-mug]:max-h-7 [&_img.rss-savant-mug]:rounded-full [&_img.rss-savant-mug]:object-cover [&_img.rss-savant-logo]:my-0 [&_img.rss-savant-logo]:h-12 [&_img.rss-savant-logo]:w-12 [&_img.rss-savant-logo]:max-h-12 [&_img.rss-savant-logo]:object-contain [&_td]:text-[13px] [&_td]:leading-snug"
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        )}

        <div className="border-white/[0.08] mt-10 flex items-center justify-between gap-3 border-t pt-5">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={onPrev}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] disabled:opacity-30"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={onNext}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] disabled:opacity-30"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </article>

      <aside
        className={cn(
          "bg-panel border-white/[0.06] min-w-0 border-y border-l p-4 md:p-5 lg:rounded-none lg:border-r-0",
          showNotes ? "block" : "hidden lg:block",
        )}
      >
        <div className="rule-head mb-4">Notes</div>
        {(highlights.data?.length ?? 0) === 0 ? (
          <p className="text-chalk font-rss text-[15px] leading-relaxed">
            Select text in the article to highlight and comment.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {highlights.data?.map((h) => (
              <HighlightCard
                key={h.id}
                highlight={h}
                onShare={() => setShareHighlight(h)}
                onDelete={() => deleteMut.mutate(h.id)}
                onUpdateNote={(note) => noteMut.mutate({ id: h.id, note })}
              />
            ))}
          </ul>
        )}
        <DispatchNotesAside />
      </aside>

      {shareHighlight ? (
        <RssQuoteShareCard highlight={shareHighlight} onClose={() => setShareHighlight(null)} />
      ) : null}

      {pendingQuote ? (
        <HighlightComposer
          quote={pendingQuote}
          saving={createMut.isPending}
          hiding={hideContentMut.isPending}
          blocking={blockArticleMut.isPending}
          onCancel={() => setPendingQuote(null)}
          onSave={(note) => createMut.mutate(note)}
          onHideText={() => {
            const phrase = pendingQuote.trim().slice(0, 160);
            if (phrase) hideContentMut.mutate(phrase);
          }}
          onBlockArticle={() => blockArticleMut.mutate()}
        />
      ) : null}

      {lightboxSrc ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="text-cream absolute top-4 right-4 rounded-sm p-2 hover:bg-white/10"
            aria-label="Close"
          >
            <X size={22} />
          </button>
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

function ArticleRow({
  item,
  read,
  highlighted,
  saved,
  onOpen,
  onBlockUrl,
  onKeepSource,
  keptSource,
  onArchive,
  onToggleSave,
  batchMode,
  batchSelected,
}: {
  item: RssFeedItem;
  read: boolean;
  highlighted?: boolean;
  saved?: boolean;
  onOpen: () => void;
  onBlockUrl: () => void;
  onKeepSource?: () => void;
  keptSource?: boolean;
  onArchive?: () => void;
  onToggleSave?: () => void;
  batchMode?: boolean;
  batchSelected?: boolean;
}) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          // Action icons stopPropagation; everything else opens the story.
          if ((e.target as HTMLElement).closest("[data-row-action]")) return;
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "hover:bg-white/[0.03] flex w-full cursor-pointer items-start gap-3 border-b border-white/[0.06] px-3 py-3.5 transition-colors",
          read && "opacity-50",
          highlighted && "border-l-accent border-l-2",
          batchSelected && "bg-accent/10",
        )}
      >
        {batchMode ? (
          <span
            data-row-action
            className="text-chalk mt-1.5 shrink-0"
            aria-hidden
          >
            {batchSelected ? (
              <CheckSquare size={18} className="text-accent" />
            ) : (
              <Square size={18} />
            )}
          </span>
        ) : (
          <span
            className={cn(
              "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
              read ? "bg-white/15" : "bg-accent",
            )}
            aria-hidden
          />
        )}
        {item.image ? (
          <img
            src={item.image}
            alt=""
            className="bg-hero pointer-events-none h-14 w-[4.5rem] shrink-0 object-cover"
            loading="lazy"
            onError={(e) => {
              const el = e.currentTarget;
              if (item.logoTeamIds?.[0]) {
                el.src = mlbTeamLogo(item.logoTeamIds[0]);
                el.className =
                  "bg-white pointer-events-none h-14 w-[4.5rem] shrink-0 object-contain p-1.5";
              } else if (item.logoAbbrevs?.[0]) {
                el.src = nflTeamLogo(item.logoAbbrevs[0]);
                el.className =
                  "bg-hero pointer-events-none h-14 w-[4.5rem] shrink-0 object-contain p-1";
              } else if (item.logoSoccerIds?.[0]) {
                el.src = soccerTeamLogo(item.logoSoccerIds[0]);
                el.className =
                  "bg-hero pointer-events-none h-14 w-[4.5rem] shrink-0 object-contain p-1";
              } else {
                el.style.display = "none";
              }
            }}
          />
        ) : item.logoTeamIds?.length ? (
          <div className="bg-white pointer-events-none flex h-14 w-[4.5rem] shrink-0 items-center justify-center gap-0.5 rounded-sm p-1">
            {item.logoTeamIds.slice(0, 2).map((id) => (
              <img
                key={id}
                src={mlbTeamLogo(id)}
                alt=""
                className="h-10 w-10 object-contain"
                loading="lazy"
              />
            ))}
          </div>
        ) : item.logoAbbrevs?.length ? (
          <div className="bg-hero pointer-events-none flex h-14 w-[4.5rem] shrink-0 items-center justify-center gap-0.5 rounded-sm p-1">
            {item.logoAbbrevs.slice(0, 2).map((ab) => (
              <img
                key={ab}
                src={nflTeamLogo(ab)}
                alt=""
                className="h-10 w-10 object-contain"
                loading="lazy"
              />
            ))}
          </div>
        ) : item.logoSoccerIds?.length ? (
          <div className="bg-hero pointer-events-none flex h-14 w-[4.5rem] shrink-0 items-center justify-center gap-0.5 rounded-sm p-1">
            {item.logoSoccerIds.slice(0, 2).map((id) => (
              <img
                key={id}
                src={soccerTeamLogo(id)}
                alt=""
                className="h-10 w-10 object-contain"
                loading="lazy"
              />
            ))}
          </div>
        ) : (
          <div className="bg-hero text-chalk-dim pointer-events-none grid h-14 w-[4.5rem] shrink-0 place-items-center text-[10px] uppercase tracking-wider">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="label-caps text-chalk-dim mb-1 flex flex-wrap items-center gap-1.5">
            {formatFeedDate(item.publishedAt)}
            {item.author ? ` · ${item.author}` : ""}
            {keptSource ? " · Kept source" : ""}
            {/rotowire|rotoworld/i.test(item.author ?? "") && isPublishedTodayCentral(item.publishedAt) ? (
              <span className="rounded-sm bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-accent">
                New
              </span>
            ) : null}
            {highlighted ? (
              <Highlighter size={12} className="text-accent shrink-0" aria-label="Has highlights" />
            ) : null}
            {saved ? (
              <BookmarkCheck size={12} className="text-accent shrink-0" aria-label="Saved" />
            ) : null}
          </div>
          <h3
            className={cn(
              "font-rss text-[17px] leading-snug font-medium md:text-[18px]",
              read ? "text-chalk" : "text-cream",
            )}
          >
            {cleanArticleTitle(item.title)}
          </h3>
          {item.snippet ? (
            <p className="font-rss text-chalk mt-1 line-clamp-2 text-[14px] leading-relaxed">
              {item.snippet}
            </p>
          ) : null}
        </div>
        {!batchMode && onToggleSave ? (
          <button
            type="button"
            data-row-action
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
            title={saved ? "Remove from saved" : "Save for later"}
            className="text-chalk-dim hover:text-cream mt-1 shrink-0 p-1"
            aria-label={saved ? "Unsave" : "Save for later"}
          >
            {saved ? (
              <BookmarkCheck size={15} className="text-accent" />
            ) : (
              <Bookmark size={15} />
            )}
          </button>
        ) : null}
        {!batchMode && onArchive && (!read || saved) ? (
          <button
            type="button"
            data-row-action
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            title={saved && read ? "Remove from saved" : "Archive (mark read)"}
            className="text-chalk-dim hover:text-cream mt-1 shrink-0 p-1"
            aria-label={saved && read ? "Remove from saved" : "Archive"}
          >
            <Archive size={15} />
          </button>
        ) : null}
        {!batchMode && onKeepSource ? (
          <button
            type="button"
            data-row-action
            onClick={(e) => {
              e.stopPropagation();
              onKeepSource();
            }}
            title={keptSource ? "Source already white-labeled" : "White-label this source (never soft-dedupe)"}
            className={cn(
              "mt-1 shrink-0 px-1 text-[10px] uppercase tracking-[0.12em]",
              keptSource ? "text-turf" : "text-chalk-dim hover:text-cream",
            )}
            aria-label="Keep source"
          >
            Keep
          </button>
        ) : null}
        {!batchMode ? (
          <button
            type="button"
            data-row-action
            onClick={(e) => {
              e.stopPropagation();
              onBlockUrl();
            }}
            title="Block domain / URL"
            className="text-chalk-dim hover:text-alert mt-1 shrink-0 p-1"
            aria-label="Block domain"
          >
            <Ban size={15} />
          </button>
        ) : null}
        {!batchMode ? (
          <ChevronRight size={16} className="text-chalk-dim pointer-events-none mt-1 shrink-0" />
        ) : null}
      </div>
    </li>
  );
}

export default function RssPage() {
  const qc = useQueryClient();
  const [nav, setNav] = useState<NavView>("unread");
  const restored = typeof window !== "undefined" ? loadDispatchOpen() : null;
  const [selected, setSelected] = useState<RssFeedItemRef | null>(() => restored?.item ?? null);
  const [readerQueue, setReaderQueue] = useState<RssFeedItemRef[] | null>(
    () => restored?.queue ?? null,
  );
  const [mobilePane, setMobilePane] = useState<"sidebar" | "list">("sidebar");
  const [keepHosts, setKeepHosts] = useState<string[]>(() =>
    typeof window !== "undefined" ? loadDedupeKeepHosts() : [],
  );
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(() => new Set());
  const [tagsOpen, setTagsOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("dispatch-tags-folder-open") !== "0";
  });
  const [folderOpen, setFolderOpen] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("dispatch-feed-folders-open");
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  const [favoriteFeedIds, setFavoriteFeedIds] = useState<string[]>(() =>
    typeof window !== "undefined" ? loadFavoriteFeedIds() : [],
  );
  const longPressTimer = useRef<number | null>(null);

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function toggleFeedFavorite(feedId: string, label: string) {
    const nowFav = toggleFavoriteFeed(feedId);
    setFavoriteFeedIds(loadFavoriteFeedIds());
    toast.success(nowFav ? `Favorited ${label}` : `Removed ${label} from favorites`);
  }

  function onFeedContextMenu(e: ReactMouseEvent | TouchEvent, feedId: string, label: string) {
    e.preventDefault();
    e.stopPropagation();
    toggleFeedFavorite(feedId, label);
  }

  function onFeedPointerDown(feedId: string, label: string) {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      toggleFeedFavorite(feedId, label);
    }, 520);
  }

  function toggleFolderOpen(folderId: string, defaultOpen = false) {
    setFolderOpen((prev) => {
      const next = { ...prev, [folderId]: !(prev[folderId] ?? defaultOpen) };
      window.localStorage.setItem("dispatch-feed-folders-open", JSON.stringify(next));
      return next;
    });
  }

  function folderUnread(folder: RssFeedFolder): number {
    return folder.feedIds.reduce((sum, id) => sum + (unreadByFeed[id] ?? 0), 0);
  }

  function favoriteUnread(): number {
    let sum = 0;
    for (const id of favoriteFeedIds) {
      const feed = allFeeds.find((f) => f.id === id);
      if (feed) {
        sum += unreadByFeed[feed.id] ?? 0;
        continue;
      }
      const folder = RSS_FEED_FOLDERS.find((f) => f.id === id);
      if (folder) sum += folderUnread(folder);
    }
    return sum;
  }
  const [hideRead, setHideRead] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("dispatch-hide-read") === "1";
  });

  // Keep the open article across navigations to the player page so back returns here.
  useEffect(() => {
    persistDispatchOpen(selected, readerQueue);
  }, [selected, readerQueue]);

  const reads = useQuery({
    queryKey: ["rss-reads"],
    queryFn: fetchRssReads,
    staleTime: 60_000,
  });
  const readUrls = reads.data ?? new Set<string>();

  const filtersQuery = useQuery({
    queryKey: ["rss-filters"],
    queryFn: fetchRssFilters,
    staleTime: 60_000,
  });
  const filters = filtersQuery.data ?? [];

  const { user } = useAuth();
  const userTags = useQuery({
    queryKey: ["sports-player-tags-names", user?.id],
    queryFn: fetchUserTagNames,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const tagFeeds: RssFeedDef[] = useMemo(
    () =>
      (userTags.data ?? []).map((tag) => ({
        id: tagFeedId(tag),
        title: `${displayPlayerTag(tag)} · Player news`,
        short: displayPlayerTag(tag).replace(/^#/, "") || tag,
        url: tagFeedUrl(tag),
      })),
    [userTags.data],
  );

  const [customFeeds, setCustomFeeds] = useState<CustomRssFeed[]>(() => loadCustomFeeds());
  const [addingFeed, setAddingFeed] = useState(false);
  const [newFeedTitle, setNewFeedTitle] = useState("");
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [savingFeed, setSavingFeed] = useState(false);

  const allFeeds: RssFeedDef[] = useMemo(
    () => [...RSS_FEEDS, ...customFeeds, ...tagFeeds],
    [customFeeds, tagFeeds],
  );

  const resolveFeed = (id: string) =>
    allFeeds.find((f) => f.id === id) ?? RSS_FEEDS.find((f) => f.id === id);

  const feedQueries = useQueries({
    queries: allFeeds.map((f) => {
      const wrapFeed = isEspnWrapFeedUrl(f.url);
      return {
        queryKey: ["rss-feed-v6", f.url],
        queryFn: () => fetchRssFeed(f.url),
        staleTime: wrapFeed ? 45_000 : 90_000,
        // Keep polling ESPN wrap feeds until recap/preview prose lands — never list score stubs.
        refetchInterval: wrapFeed ? 90_000 : false,
        refetchIntervalInBackground: false,
      };
    }),
  });

  const allNotes = useQuery({
    queryKey: ["rss-highlights-all"],
    queryFn: () => fetchRssHighlights(),
    enabled: true,
  });

  const savesQuery = useQuery({
    queryKey: ["rss-saves"],
    queryFn: fetchRssSaves,
    staleTime: 30_000,
  });
  const savedUrls = useMemo(
    () => new Set((savesQuery.data ?? []).map((s) => s.articleUrl)),
    [savesQuery.data],
  );

  const [shareHighlight, setShareHighlight] = useState<RssHighlight | null>(null);

  const highlightUrls = useMemo(
    () => new Set((allNotes.data ?? []).map((h) => h.articleUrl)),
    [allNotes.data],
  );

  const toggleSaveMut = useMutation({
    mutationFn: async (item: RssFeedItemRef) => {
      if (savedUrls.has(item.link)) {
        await unsaveRssArticle(item.link);
        return { saved: false as const };
      }
      await saveRssArticle({
        articleUrl: item.link,
        articleTitle: item.title,
        feedUrl: item.feedUrl,
        image: item.image,
        snippet: item.snippet,
        author: item.author,
        publishedAt: item.publishedAt,
      });
      return { saved: true as const };
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["rss-saves"] });
      toast.success(result.saved ? "Saved for later" : "Removed from saved");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not update saved articles"),
  });

  const addFilterMut = useMutation({
    mutationFn: ({ kind, value }: { kind: RssFilterKind; value: string }) =>
      addRssFilter(kind, value),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rss-filters"] });
      toast.success("Filter added");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add filter"),
  });

  const deleteFilterMut = useMutation({
    mutationFn: deleteRssFilter,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["rss-filters"] }),
  });

  const feedById = useMemo(() => {
    const map = new Map<string, { items: RssFeedItem[]; title: string; url: string }>();
    allFeeds.forEach((f, i) => {
      const data = feedQueries[i]?.data;
      const items = applyRssFilters(dedupeArticles(data?.items ?? [], keepHosts), filters, f.id);
      map.set(f.id, {
        items,
        title: data?.title || f.title,
        url: f.url,
      });
    });
    return map;
  }, [allFeeds, feedQueries, filters, keepHosts]);

  /** Cross-feed soft duplicates (e.g. FOX 2 vs MLB.com) — hidden from main/unread. */
  const duplicateItems = useMemo(() => {
    const merged: RssFeedItemRef[] = [];
    allFeeds.forEach((f, i) => {
      const data = feedQueries[i]?.data;
      const filtered = applyRssFilters(data?.items ?? [], filters, f.id);
      for (const it of filtered) {
        merged.push({ ...it, feedId: f.id, feedUrl: f.url });
      }
    });
    return partitionDedupedArticles(merged, keepHosts).duplicates;
  }, [allFeeds, feedQueries, filters, keepHosts]);

  const unreadByFeed = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of allFeeds) {
      const items = feedById.get(f.id)?.items ?? [];
      counts[f.id] = items.filter((it) => !readUrls.has(it.link)).length;
    }
    return counts;
  }, [allFeeds, feedById, readUrls]);

  const savedListItems = useMemo((): RssFeedItemRef[] => {
    return (savesQuery.data ?? []).map((s) => {
      const feed = allFeeds.find((f) => f.url === s.feedUrl) ?? RSS_FEEDS.find((f) => f.url === s.feedUrl);
      return {
        id: s.id,
        title: s.articleTitle || s.articleUrl,
        link: s.articleUrl,
        author: s.author,
        publishedAt: s.publishedAt,
        image: s.image,
        snippet: s.snippet || "",
        feedId: feed?.id ?? RSS_FEEDS[0].id,
        feedUrl: s.feedUrl || feed?.url || RSS_FEEDS[0].url,
      };
    });
  }, [savesQuery.data, allFeeds]);

  const listItems = useMemo(() => {
    if (nav === "notes" || nav === "filters") return [] as RssFeedItemRef[];
    if (nav === "saved") return savedListItems;
    if (nav === "duplicates") {
      let rows = [...duplicateItems];
      if (hideRead) rows = rows.filter((it) => !readUrls.has(it.link));
      rows.sort((a, b) => {
        const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return db - da;
      });
      return rows;
    }
    if (nav === "unread") {
      const merged: RssFeedItemRef[] = [];
      for (const f of allFeeds) {
        if (RSS_SEPARATE_FEEDS.has(f.id) || f.id.startsWith("tag:")) continue;
        const pack = feedById.get(f.id);
        for (const it of pack?.items ?? []) {
          if (!readUrls.has(it.link)) {
            merged.push({ ...it, feedId: f.id, feedUrl: f.url });
          }
        }
      }
      const deduped = dedupeArticles(merged, keepHosts);
      deduped.sort((a, b) => {
        const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return db - da;
      });
      return deduped;
    }

    // Folder combined feeds (Favorites / Cardinals / MLB / NFL / Scout / Tags).
    if (nav === "folder:favorites" || nav === "folder:tags" || isFeedFolderId(nav)) {
      const ids =
        nav === "folder:favorites"
          ? favoriteFeedIds.flatMap((id) => {
              const folder = RSS_FEED_FOLDERS.find((f) => f.id === id);
              if (folder) return folder.feedIds;
              return [id];
            })
          : nav === "folder:tags"
            ? tagFeeds.map((f) => f.id)
            : feedIdsForFolder(nav);
      const seen = new Set<string>();
      const merged: RssFeedItemRef[] = [];
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const pack = feedById.get(id);
        const def = allFeeds.find((f) => f.id === id);
        for (const it of pack?.items ?? []) {
          merged.push({ ...it, feedId: id, feedUrl: pack?.url ?? def?.url ?? "" });
        }
      }
      let rows = dedupeArticles(merged, keepHosts);
      if (hideRead) rows = rows.filter((it) => !readUrls.has(it.link));
      rows.sort((a, b) => {
        const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return db - da;
      });
      return rows;
    }

    const pack = feedById.get(nav);
    let rows = (pack?.items ?? []).map((it) => ({
      ...it,
      feedId: nav as RssFeedId,
      feedUrl: pack?.url ?? "",
    }));
    if (hideRead) rows = rows.filter((it) => !readUrls.has(it.link));
    return rows;
  }, [
    nav,
    allFeeds,
    feedById,
    readUrls,
    duplicateItems,
    keepHosts,
    savedListItems,
    hideRead,
    tagFeeds,
    favoriteFeedIds,
  ]);

  const totalUnread = useMemo(() => {
    const merged: RssFeedItem[] = [];
    for (const f of allFeeds) {
      if (RSS_SEPARATE_FEEDS.has(f.id) || f.id.startsWith("tag:")) continue;
      for (const it of feedById.get(f.id)?.items ?? []) {
        if (!readUrls.has(it.link)) merged.push(it);
      }
    }
    return dedupeArticles(merged, keepHosts).length;
  }, [allFeeds, feedById, readUrls, keepHosts]);

  const navItems = readerQueue ?? listItems;
  const selectedIndex = useMemo(() => {
    if (!selected) return -1;
    const byId = navItems.findIndex((it) => it.id === selected.id);
    if (byId >= 0) return byId;
    return navItems.findIndex((it) => it.link === selected.link);
  }, [selected, navItems]);

  const listTitle =
    nav === "unread"
      ? "Unread"
      : nav === "saved"
        ? "Saved for later"
        : nav === "notes"
          ? "Notes"
          : nav === "filters"
            ? "Filters"
            : nav === "duplicates"
              ? "Duplicates"
              : nav === "folder:tags"
                ? "Tags"
                : nav === "folder:favorites"
                  ? "Favorites"
                  : RSS_FEED_FOLDERS.find((f) => f.id === nav)?.title ??
                    allFeeds.find((f) => f.id === nav)?.title ??
                    "Feed";

  const feedsLoading = feedQueries.some((q) => q.isLoading);
  const feedsFetching = feedQueries.some((q) => q.isFetching);
  const feedsError = feedQueries.find((q) => q.isError)?.error;
  const feedsFailed = feedQueries.filter((q) => q.isError).length;

  const unreadInList = useMemo(
    () => listItems.filter((it) => !readUrls.has(it.link)),
    [listItems, readUrls],
  );

  // Pre-extract upcoming articles so opens / next-swipes don't wait on a cold scrape.
  useEffect(() => {
    const ac = new AbortController();
    const warm = (urls: string[]) =>
      prefetchRssArticles(urls, {
        concurrency: 3,
        signal: ac.signal,
        prefetch: (url) =>
          qc.prefetchQuery({
            queryKey: ["rss-article-v2", url],
            queryFn: () => fetchRssArticle(url),
            staleTime: 10 * 60_000,
          }),
      });

    const run = () => {
      if (selected && selectedIndex >= 0) {
        const neighbors = [1, 2, -1, 3, 4, -2]
          .map((d) => navItems[selectedIndex + d])
          .filter((it): it is RssFeedItemRef => Boolean(it))
          .filter(articleNeedsEdgeExtract)
          .map((it) => it.link);
        void warm(neighbors);
        return;
      }
      // Idle list: prefer unread rows, then the visible head of the feed.
      const pool = (unreadInList.length ? unreadInList : listItems)
        .filter(articleNeedsEdgeExtract)
        .slice(0, 18)
        .map((it) => it.link);
      void warm(pool);
    };

    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    const cic = (
      window as Window & { cancelIdleCallback?: (id: number) => void }
    ).cancelIdleCallback;
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    if (typeof ric === "function") {
      idleId = ric(run, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(run, 250);
    }
    return () => {
      ac.abort();
      if (idleId != null && typeof cic === "function") cic(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [selected, selectedIndex, navItems, listItems, unreadInList, qc]);

  // When feeds finish loading, warm the first extractable articles across them.
  useEffect(() => {
    const ready = feedQueries.every((q) => !q.isLoading);
    if (!ready) return;
    const urls: string[] = [];
    for (const q of feedQueries) {
      const items = q.data?.items ?? [];
      for (const it of items.slice(0, 4)) {
        if (articleNeedsEdgeExtract(it)) urls.push(it.link);
      }
    }
    if (!urls.length) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void prefetchRssArticles(urls.slice(0, 24), {
        concurrency: 3,
        signal: ac.signal,
        prefetch: (url) =>
          qc.prefetchQuery({
            queryKey: ["rss-article-v2", url],
            queryFn: () => fetchRssArticle(url),
            staleTime: 10 * 60_000,
          }),
      });
    }, 400);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
    // Intentionally depend on fetch status, not full query objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedQueries.map((q) => `${q.isLoading}:${q.dataUpdatedAt}`).join("|"), qc]);

  const markAllReadMut = useMutation({
    mutationFn: () =>
      markRssReadMany(
        unreadInList.map((it) => ({
          articleUrl: it.link,
          articleTitle: it.title,
          feedUrl: it.feedUrl,
        })),
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["rss-reads"] });
      toast.success(
        unreadInList.length === 1
          ? "Marked 1 article read"
          : `Marked ${unreadInList.length} articles read`,
      );
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not mark articles read"),
  });

  const archiveDupesMut = useMutation({
    mutationFn: () =>
      markRssReadMany(
        duplicateItems
          .filter((it) => !readUrls.has(it.link))
          .map((it) => ({
            articleUrl: it.link,
            articleTitle: it.title,
            feedUrl: it.feedUrl,
          })),
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["rss-reads"] });
      toast.success("Archived duplicate articles");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not archive duplicates"),
  });

  async function toggleRead(item: RssFeedItem) {
    try {
      if (readUrls.has(item.link)) await markRssUnread(item.link);
      else {
        await markRssRead({
          articleUrl: item.link,
          articleTitle: item.title,
          feedUrl: selected?.feedUrl ?? RSS_FEEDS[0].url,
        });
      }
      await qc.invalidateQueries({ queryKey: ["rss-reads"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update read state");
    }
  }

  function selectNav(next: NavView) {
    setNav(next);
    setSelected(null);
    setReaderQueue(null);
    setMobilePane("list");
    setBatchMode(false);
    setBatchSelected(new Set());
  }

  function openArticle(item: RssFeedItemRef) {
    if (batchMode) {
      setBatchSelected((prev) => {
        const next = new Set(prev);
        if (next.has(item.link)) next.delete(item.link);
        else next.add(item.link);
        return next;
      });
      return;
    }
    // Snapshot the list so unread mark-read doesn't kill swipe next/prev.
    setReaderQueue(listItems);
    setSelected(item);
    persistDispatchOpen(item, listItems);
  }

  function closeArticle() {
    setSelected(null);
    setReaderQueue(null);
    persistDispatchOpen(null, null);
  }

  function goRelative(delta: number) {
    if (selectedIndex < 0) return;
    const next = navItems[selectedIndex + delta];
    if (next) setSelected(next);
  }

  async function archiveSelected() {
    if (!selected) return;
    try {
      await markRssRead({
        articleUrl: selected.link,
        articleTitle: selected.title,
        feedUrl: selected.feedUrl,
      });
      await qc.invalidateQueries({ queryKey: ["rss-reads"] });
      toast.success("Archived");
      if (selectedIndex >= 0 && selectedIndex < navItems.length - 1) {
        goRelative(1);
      } else {
        closeArticle();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not archive");
    }
  }

  const batchArchiveMut = useMutation({
    mutationFn: async () => {
      if (nav === "saved") {
        const targets = listItems.filter((it) => batchSelected.has(it.link));
        await Promise.all(targets.map((it) => unsaveRssArticle(it.link)));
        return { mode: "saved" as const, n: targets.length };
      }
      const targets = listItems.filter((it) => batchSelected.has(it.link) && !readUrls.has(it.link));
      await markRssReadMany(
        targets.map((it) => ({
          articleUrl: it.link,
          articleTitle: it.title,
          feedUrl: it.feedUrl,
        })),
      );
      return { mode: "read" as const, n: targets.length };
    },
    onSuccess: async (result) => {
      if (result.mode === "saved") {
        await qc.invalidateQueries({ queryKey: ["rss-saves"] });
      } else {
        await qc.invalidateQueries({ queryKey: ["rss-reads"] });
      }
      setBatchSelected(new Set());
      setBatchMode(false);
      toast.success(
        result.mode === "saved"
          ? result.n === 1
            ? "Removed 1 saved article"
            : `Removed ${result.n} saved articles`
          : result.n === 1
            ? "Archived 1 article"
            : `Archived ${result.n} articles`,
      );
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not archive selection"),
  });

  const listSwipe = useSwipeNav({
    enabled: !selected && mobilePane === "list" && !batchMode,
    onBack: () => setMobilePane("sidebar"),
    onNext: null,
  });

  const canBatch =
    nav === "duplicates" ||
    nav === "unread" ||
    nav === "saved" ||
    nav === "folder:tags" ||
    nav === "folder:favorites" ||
    isFeedFolderId(nav) ||
    allFeeds.some((f) => f.id === nav);

  if (selected) {
    return (
      <div className="px-4 py-4 md:py-6 md:pl-6 lg:pr-0">
        <ReaderView
          item={selected}
          feedUrl={selected.feedUrl}
          isRead={readUrls.has(selected.link)}
          isSaved={savedUrls.has(selected.link)}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < navItems.length - 1}
          onBack={closeArticle}
          onPrev={() => goRelative(-1)}
          onNext={() => goRelative(1)}
          onToggleRead={() => void toggleRead(selected)}
          onToggleSave={() => toggleSaveMut.mutate(selected)}
          onArchive={() => void archiveSelected()}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col md:flex-row">
      <aside
        className={cn(
          "bg-ink border-white/[0.06] w-full shrink-0 border-b md:w-[260px] md:border-r md:border-b-0",
          mobilePane === "list" ? "hidden md:flex md:flex-col" : "flex flex-col",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <h2 className="font-rss text-cream text-[26px] font-semibold tracking-tight">News</h2>
          <button
            type="button"
            onClick={() => void Promise.all(feedQueries.map((q) => q.refetch()))}
            disabled={feedsFetching}
            className="text-chalk hover:text-cream p-1"
            aria-label="Refresh feeds"
          >
            <RefreshCw size={15} className={feedsFetching ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="px-2 pb-2">
          <p className="label-caps text-chalk-dim px-2 py-2">Inbox</p>
          <button
            type="button"
            onClick={() => selectNav("unread")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-left transition-colors",
              nav === "unread"
                ? "bg-accent/15 text-cream"
                : "text-chalk hover:bg-white/[0.04] hover:text-cream",
            )}
          >
            <Inbox size={16} className="text-accent shrink-0" />
            <span className="min-w-0 flex-1 text-[13.5px]">Unread Articles</span>
            <span className="text-chalk tabular-nums text-[12px]">{totalUnread}</span>
            <ChevronRight size={14} className="opacity-50" />
          </button>
          <button
            type="button"
            onClick={() => selectNav("saved")}
            className={cn(
              "mt-0.5 flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-left transition-colors",
              nav === "saved"
                ? "bg-accent/15 text-cream"
                : "text-chalk hover:bg-white/[0.04] hover:text-cream",
            )}
          >
            <Bookmark size={16} className="text-accent shrink-0" />
            <span className="min-w-0 flex-1 text-[13.5px]">Saved for later</span>
            <span className="text-chalk tabular-nums text-[12px]">
              {savesQuery.data?.length ?? 0}
            </span>
            <ChevronRight size={14} className="opacity-50" />
          </button>
        </div>

        <div className="flex-1 px-2 pb-4">
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <p className="label-caps text-chalk-dim">Feeds</p>
            <button
              type="button"
              onClick={() => setAddingFeed((v) => !v)}
              className="text-chalk hover:text-cream inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] uppercase tracking-[0.12em]"
            >
              <Plus size={12} />
              Add
            </button>
          </div>
          {addingFeed ? (
            <form
              className="mb-2 space-y-2 rounded-md border border-white/[0.08] bg-white/[0.03] p-2.5"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void (async () => {
                  setSavingFeed(true);
                  try {
                    const title = newFeedTitle.trim();
                    const url = newFeedUrl.trim();
                    if (title.length < 2) throw new Error("Give the feed a name");
                    if (!/^https?:\/\//i.test(url)) {
                      throw new Error("Feed URL must start with http(s)://");
                    }
                    if (RSS_FEEDS.some((f) => f.url === url)) {
                      throw new Error("That feed is already built in");
                    }
                    // Probe before persisting so broken URLs never land in the sidebar.
                    await fetchRssFeed(url);
                    const created = addCustomFeed({ title, url });
                    setCustomFeeds(loadCustomFeeds());
                    setNewFeedTitle("");
                    setNewFeedUrl("");
                    setAddingFeed(false);
                    selectNav(created.id);
                    toast.success("Feed added");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not add feed");
                  } finally {
                    setSavingFeed(false);
                  }
                })();
              }}
            >
              <input
                value={newFeedTitle}
                onChange={(e) => setNewFeedTitle(e.target.value)}
                placeholder="Feed name"
                className="bg-ink/40 text-cream placeholder:text-chalk-dim w-full rounded-md border border-white/10 px-2.5 py-1.5 text-[13px] outline-none focus:border-accent/50"
              />
              <input
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                placeholder="https://…/feed.xml"
                className="bg-ink/40 text-cream placeholder:text-chalk-dim w-full rounded-md border border-white/10 px-2.5 py-1.5 text-[13px] outline-none focus:border-accent/50"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={savingFeed}
                  className="bg-accent/90 text-ink hover:bg-accent rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                >
                  {savingFeed ? "Checking…" : "Save feed"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingFeed(false);
                    setNewFeedTitle("");
                    setNewFeedUrl("");
                  }}
                  className="text-chalk hover:text-cream text-[11px] uppercase tracking-[0.12em]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {customFeeds.length > 0 ? (
              <li className="mb-1">
                <p className="label-caps text-chalk-dim px-2 py-1.5">Your feeds</p>
                <ul className="flex flex-col gap-0.5">
                  {customFeeds.map((f) => (
                    <li key={f.id}>
                      <div
                        className={cn(
                          "flex w-full items-center gap-1 rounded-sm transition-colors",
                          nav === f.id
                            ? "bg-accent/15 text-cream"
                            : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => selectNav(f.id)}
                          onContextMenu={(e) => onFeedContextMenu(e, f.id, f.title)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
                        >
                          <Hash size={14} className="text-accent shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-[13px]">{f.title}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${f.title}`}
                          onClick={() => {
                            removeCustomFeed(f.id);
                            setCustomFeeds(loadCustomFeeds());
                            if (nav === f.id) selectNav("unread");
                            toast.success("Feed removed");
                          }}
                          className="text-chalk hover:text-alert shrink-0 px-2 py-2"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ) : null}
            {favoriteFeedIds.length > 0 ? (
              <li className="mb-1">
                <div
                  className={cn(
                    "flex w-full items-center gap-1 rounded-sm transition-colors",
                    nav === "folder:favorites"
                      ? "bg-accent/15 text-cream"
                      : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectNav("folder:favorites")}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm px-2.5 py-2 text-left"
                  >
                    <Star size={14} className="text-accent shrink-0 fill-current" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                      Favorites
                    </span>
                    <span className="text-chalk tabular-nums text-[12px]">{favoriteUnread()}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={
                      (folderOpen["__favorites__"] ?? true) ? "Collapse favorites" : "Expand favorites"
                    }
                    onClick={() => toggleFolderOpen("__favorites__", true)}
                    className="shrink-0 px-2 py-2 opacity-50 hover:opacity-100"
                  >
                    {(folderOpen["__favorites__"] ?? true) ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                </div>
                {(folderOpen["__favorites__"] ?? true) ? (
                  <ul className="mt-0.5 flex flex-col gap-0.5 border-l border-white/[0.06] ml-4 pl-1">
                    {favoriteFeedIds.map((id) => {
                      const feed = resolveFeed(id);
                      const folder = RSS_FEED_FOLDERS.find((f) => f.id === id);
                      const title = feed?.title ?? folder?.title ?? id;
                      return (
                        <li key={`fav-${id}`}>
                          <button
                            type="button"
                            onClick={() => selectNav(id)}
                            onContextMenu={(e) => onFeedContextMenu(e, id, title)}
                            onTouchStart={() => onFeedPointerDown(id, title)}
                            onTouchEnd={clearLongPress}
                            onTouchMove={clearLongPress}
                            onTouchCancel={clearLongPress}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
                              nav === id
                                ? "bg-accent/15 text-cream"
                                : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                            )}
                          >
                            <Star size={12} className="text-accent shrink-0 fill-current opacity-80" />
                            <span className="min-w-0 flex-1 truncate text-[13px]">{title}</span>
                            <span className="text-chalk tabular-nums text-[12px]">
                              {feed
                                ? (unreadByFeed[feed.id] ?? 0)
                                : folder
                                  ? folderUnread(folder)
                                  : 0}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            ) : null}
            {RSS_FEED_FOLDERS.map((folder) => {
              const open = folderOpen[folder.id] ?? false;
              const childFeeds = folder.feedIds
                .map((id) => RSS_FEEDS.find((f) => f.id === id))
                .filter(Boolean) as RssFeedDef[];
              const active =
                nav === folder.id || folder.feedIds.some((id) => id === nav);
              const folderFav = favoriteFeedIds.includes(folder.id);
              return (
                <li key={folder.id}>
                  <div
                    className={cn(
                      "flex w-full items-center gap-1 rounded-sm transition-colors",
                      active
                        ? "bg-accent/15 text-cream"
                        : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectNav(folder.id)}
                      onContextMenu={(e) => onFeedContextMenu(e, folder.id, folder.title)}
                      onTouchStart={() => onFeedPointerDown(folder.id, folder.title)}
                      onTouchEnd={clearLongPress}
                      onTouchMove={clearLongPress}
                      onTouchCancel={clearLongPress}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left"
                    >
                      <Folder size={16} className="text-accent shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">
                        {folder.title}
                      </span>
                      {folderFav ? (
                        <Star size={12} className="text-accent shrink-0 fill-current" />
                      ) : null}
                      <span className="text-chalk tabular-nums text-[12px]">
                        {folderUnread(folder)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={open ? "Collapse folder" : "Expand folder"}
                      onClick={() => toggleFolderOpen(folder.id)}
                      className="shrink-0 px-2 py-2.5 opacity-50 hover:opacity-100"
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </div>
                  {open ? (
                    <ul className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-white/[0.08] pl-2">
                      {childFeeds.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => selectNav(f.id)}
                            onContextMenu={(e) => onFeedContextMenu(e, f.id, f.title)}
                            onTouchStart={() => onFeedPointerDown(f.id, f.title)}
                            onTouchEnd={clearLongPress}
                            onTouchMove={clearLongPress}
                            onTouchCancel={clearLongPress}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
                              nav === f.id
                                ? "bg-accent/15 text-cream"
                                : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                            )}
                          >
                            <Hash size={14} className="text-accent shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-[13px]">{f.title}</span>
                            {favoriteFeedIds.includes(f.id) ? (
                              <Star size={11} className="text-accent shrink-0 fill-current" />
                            ) : null}
                            <span className="text-chalk tabular-nums text-[12px]">
                              {unreadByFeed[f.id] ?? 0}
                            </span>
                            <ChevronRight size={14} className="opacity-50" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
            {tagFeeds.length > 0 ? (
              <li>
                <div
                  className={cn(
                    "flex w-full items-center gap-1 rounded-sm transition-colors",
                    nav === "folder:tags" || tagFeeds.some((f) => f.id === nav)
                      ? "bg-accent/15 text-cream"
                      : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectNav("folder:tags")}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left"
                  >
                    <Folder size={16} className="text-accent shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">Tags</span>
                    <span className="text-chalk tabular-nums text-[12px]">
                      {tagFeeds.reduce((sum, f) => sum + (unreadByFeed[f.id] ?? 0), 0)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={tagsOpen ? "Collapse tags" : "Expand tags"}
                    onClick={() => {
                      setTagsOpen((v) => {
                        const next = !v;
                        window.localStorage.setItem(
                          "dispatch-tags-folder-open",
                          next ? "1" : "0",
                        );
                        return next;
                      });
                    }}
                    className="shrink-0 px-2 py-2.5 opacity-50 hover:opacity-100"
                  >
                    {tagsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
                {tagsOpen ? (
                  <ul className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l border-white/[0.08] pl-2">
                    {tagFeeds.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => selectNav(f.id)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
                            nav === f.id
                              ? "bg-accent/15 text-cream"
                              : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                          )}
                        >
                          <Hash size={14} className="text-accent shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-[13px]">{f.title}</span>
                          <span className="text-chalk tabular-nums text-[12px]">
                            {unreadByFeed[f.id] ?? 0}
                          </span>
                          <ChevronRight size={14} className="opacity-50" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ) : null}
            <li>
              <button
                type="button"
                onClick={() => selectNav("duplicates")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-left transition-colors",
                  nav === "duplicates"
                    ? "bg-accent/15 text-cream"
                    : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                )}
              >
                <Layers size={16} className="text-accent shrink-0" />
                <span className="min-w-0 flex-1 text-[13.5px]">Duplicates</span>
                <ChevronRight size={14} className="opacity-50" />
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => selectNav("notes")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-left transition-colors",
                  nav === "notes"
                    ? "bg-accent/15 text-cream"
                    : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                )}
              >
                <Highlighter size={16} className="text-accent shrink-0" />
                <span className="min-w-0 flex-1 text-[13.5px]">Notes</span>
                <ChevronRight size={14} className="opacity-50" />
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => selectNav("filters")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-left transition-colors",
                  nav === "filters"
                    ? "bg-accent/15 text-cream"
                    : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                )}
              >
                <Ban size={16} className="text-accent shrink-0" />
                <span className="min-w-0 flex-1 text-[13.5px]">Filters</span>
                <ChevronRight size={14} className="opacity-50" />
              </button>
            </li>
          </ul>
        </div>

        <div className="border-white/[0.06] border-t px-4 py-3">
          <a
            href="/rss.html"
            className="text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em]"
          >
            <Share size={11} />
            Home Screen
          </a>
        </div>
      </aside>

      <section
        ref={listSwipe}
        className={cn(
          "bg-field min-w-0 flex-1",
          mobilePane === "sidebar" ? "hidden md:block" : "block",
        )}
        style={{ touchAction: "pan-y" }}
      >
        <div className="border-white/[0.06] flex items-center gap-3 border-b px-4 py-3.5">
          <button
            type="button"
            onClick={() => setMobilePane("sidebar")}
            className="text-chalk hover:text-cream md:hidden"
            aria-label="Back to feeds"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="font-rss text-cream truncate text-[22px] font-semibold">{listTitle}</h3>
            <p className="text-chalk-dim text-[11px] uppercase tracking-[0.14em]">
              {nav === "notes"
                ? `${allNotes.data?.length ?? 0} highlights`
                : nav === "saved"
                  ? `${savedListItems.length} saved`
                  : nav === "filters"
                    ? `${filters.length} rules`
                    : nav === "duplicates"
                      ? `${duplicateItems.length} filtered · MLB preferred`
                      : `${listItems.length} articles${hideRead && (allFeeds.some((f) => f.id === nav) || nav === "folder:tags" || nav === "folder:favorites" || isFeedFolderId(nav)) ? " · unread only" : ""}`}
            </p>
          </div>
          {allFeeds.some((f) => f.id === nav) ||
          nav === "duplicates" ||
          nav === "folder:tags" ||
          nav === "folder:favorites" ||
          isFeedFolderId(nav) ? (
            <button
              type="button"
              onClick={() => {
                setHideRead((v) => {
                  const next = !v;
                  window.localStorage.setItem("dispatch-hide-read", next ? "1" : "0");
                  return next;
                });
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.14em]",
                hideRead ? "text-accent" : "text-chalk hover:text-cream",
              )}
              title={hideRead ? "Show read stories" : "Hide read stories"}
              aria-pressed={hideRead}
            >
              {hideRead ? (
                <span className="bg-accent inline-block h-2.5 w-2.5 rounded-full" />
              ) : (
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/25" />
              )}
              {hideRead ? <EyeOff size={14} /> : <Eye size={14} />}
              <span className="hidden sm:inline">{hideRead ? "Unread only" : "Hide read"}</span>
            </button>
          ) : null}
          {canBatch ? (
            <button
              type="button"
              onClick={() => {
                if (batchMode) {
                  setBatchMode(false);
                  setBatchSelected(new Set());
                } else {
                  setBatchMode(true);
                }
              }}
              className="text-chalk hover:text-cream inline-flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.14em]"
              title={batchMode ? "Cancel selection" : "Select articles"}
            >
              {batchMode ? <X size={14} /> : <CheckSquare size={14} />}
              <span className="hidden sm:inline">{batchMode ? "Cancel" : "Select"}</span>
            </button>
          ) : null}
          {batchMode && batchSelected.size > 0 ? (
            <button
              type="button"
              onClick={() => batchArchiveMut.mutate()}
              disabled={batchArchiveMut.isPending}
              className="text-accent hover:text-cream inline-flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
              title="Archive selected"
            >
              <Archive size={14} />
              <span className="hidden sm:inline">Archive {batchSelected.size}</span>
            </button>
          ) : null}
          {!batchMode &&
          nav === "duplicates" &&
          duplicateItems.some((it) => !readUrls.has(it.link)) ? (
            <button
              type="button"
              onClick={() => archiveDupesMut.mutate()}
              disabled={archiveDupesMut.isPending}
              className="text-chalk hover:text-cream inline-flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
              title="Mark all duplicates as read"
            >
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Archive all</span>
            </button>
          ) : null}
          {!batchMode &&
          nav !== "notes" &&
          nav !== "saved" &&
          nav !== "filters" &&
          nav !== "duplicates" &&
          unreadInList.length > 0 ? (
            <button
              type="button"
              onClick={() => markAllReadMut.mutate()}
              disabled={markAllReadMut.isPending}
              className="text-chalk hover:text-cream inline-flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] disabled:opacity-40"
              title="Mark all visible articles as read"
            >
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          ) : null}
        </div>

        {nav === "filters" ? (
          <FiltersPanel
            filters={filters}
            loading={filtersQuery.isLoading}
            onAdd={(kind, value) => addFilterMut.mutate({ kind, value })}
            onDelete={(id) => deleteFilterMut.mutate(id)}
            saving={addFilterMut.isPending}
          />
        ) : nav === "notes" ? (
          <div className="p-4 md:p-5">
            {allNotes.isLoading ? (
              <p className="label-caps animate-pulse">Loading notes</p>
            ) : (allNotes.data?.length ?? 0) === 0 ? (
              <p className="text-chalk font-rss text-sm">No highlights yet.</p>
            ) : (
              <ul className="flex flex-col gap-5">
                {allNotes.data?.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => setShareHighlight(h)}
                      className="group relative w-full overflow-hidden rounded-sm border border-white/[0.08] bg-gradient-to-br from-[#0c1a36] via-[#081228] to-[#1a0e14] text-left transition-transform hover:scale-[1.01]"
                    >
                      {h.articleImage ? (
                        <div className="relative aspect-[16/7] w-full overflow-hidden">
                          <img
                            src={h.articleImage}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#081228] via-[#081228]/50 to-transparent" />
                        </div>
                      ) : null}
                      <div className="relative px-5 pt-5 pb-4">
                        <span
                          aria-hidden
                          className="font-rss text-accent/45 pointer-events-none absolute top-0 left-3 text-[64px] leading-none"
                        >
                          “
                        </span>
                        <div className="label-caps text-accent mb-1 relative z-[1]">
                          {feedSourceLabel(h.feedUrl)}
                        </div>
                        <p className="text-chalk relative z-[1] mb-2 line-clamp-2 text-[13px]">
                          {h.articleTitle || h.articleUrl}
                        </p>
                        <blockquote className="font-rss text-cream relative z-[1] text-[17px] leading-relaxed italic md:text-[18px]">
                          {h.quoteText}
                        </blockquote>
                        {h.note ? (
                          <p className="font-rss text-chalk mt-3 border-t border-white/10 pt-2 text-[14px]">
                            {h.note}
                          </p>
                        ) : null}
                        <p className="text-chalk-dim mt-3 text-[10px] uppercase tracking-[0.16em] opacity-70 group-hover:opacity-100">
                          Tap to share
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {shareHighlight ? (
              <RssQuoteShareCard
                highlight={shareHighlight}
                onClose={() => setShareHighlight(null)}
              />
            ) : null}
          </div>
        ) : feedsLoading ? (
          <p className="label-caps animate-pulse p-5">Loading feeds</p>
        ) : feedsFailed > 0 && listItems.length === 0 ? (
          <div className="space-y-3 p-5">
            <p className="text-alert font-rss text-sm">
              Couldn&apos;t load feeds
              {feedsFailed === allFeeds.length ? "" : ` (${feedsFailed} of ${allFeeds.length} failed)`}
              .
            </p>
            <p className="text-chalk font-rss text-sm">
              {feedsError instanceof Error ? feedsError.message : "Check your connection and try refresh."}
            </p>
            <button
              type="button"
              onClick={() => void Promise.all(feedQueries.map((q) => q.refetch()))}
              className="text-accent text-[12px] font-semibold uppercase tracking-[0.14em] hover:underline"
            >
              Retry feeds
            </button>
          </div>
        ) : listItems.length === 0 ? (
          <p className="text-chalk font-rss p-5 text-sm">
            {nav === "unread"
              ? "You're caught up."
              : nav === "saved"
                ? "Nothing saved for later."
                : nav === "duplicates"
                  ? "No duplicate stories right now."
                  : "No articles in this feed."}
          </p>
        ) : (
          <ul>
            {listItems.map((item) => {
              const host = articleSourceHost(item.link);
              const kept = Boolean(host && keepHosts.includes(host));
              const canArchive =
                nav === "unread" ||
                nav === "duplicates" ||
                nav === "saved" ||
                nav === "folder:tags" ||
                nav === "folder:favorites" ||
                isFeedFolderId(nav) ||
                allFeeds.some((f) => f.id === nav);
              const feedScoped = allFeeds.some((f) => f.id === nav);
              return (
              <ArticleRow
                key={item.id + item.link}
                item={item}
                read={readUrls.has(item.link)}
                highlighted={highlightUrls.has(item.link)}
                saved={savedUrls.has(item.link)}
                batchMode={batchMode}
                batchSelected={batchSelected.has(item.link)}
                onOpen={() => openArticle(item)}
                onBlockUrl={() => {
                  if (feedScoped && host) {
                    addFilterMut.mutate({
                      kind: "url",
                      value: encodeFeedDomainFilter(nav as string, host),
                    });
                    return;
                  }
                  addFilterMut.mutate({
                    kind: "url",
                    value: suggestUrlFilterValue(item.link),
                  });
                }}
                onToggleSave={() => toggleSaveMut.mutate(item)}
                onArchive={
                  canArchive
                    ? () => {
                        if (nav === "saved") {
                          void unsaveRssArticle(item.link).then(() => {
                            void qc.invalidateQueries({ queryKey: ["rss-saves"] });
                            toast.success("Removed from saved");
                          });
                          return;
                        }
                        void markRssRead({
                          articleUrl: item.link,
                          articleTitle: item.title,
                          feedUrl: item.feedUrl,
                        }).then(() => {
                          void qc.invalidateQueries({ queryKey: ["rss-reads"] });
                          toast.success("Archived");
                        });
                      }
                    : undefined
                }
                onKeepSource={
                  nav === "duplicates"
                    ? () => {
                        const next = kept && host
                          ? removeDedupeKeepHost(host)
                          : addDedupeKeepHost(item.link);
                        setKeepHosts(next);
                        toast.success(
                          kept
                            ? "Removed white-label"
                            : `Keeping ${articleSourceHost(item.link) ?? "source"} in the main feed`,
                        );
                      }
                    : undefined
                }
                keptSource={kept}
              />
            );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function FiltersPanel({
  filters,
  loading,
  onAdd,
  onDelete,
  saving,
}: {
  filters: RssFilter[];
  loading: boolean;
  onAdd: (kind: RssFilterKind, value: string) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [kind, setKind] = useState<RssFilterKind | "feed-domain">("phrase");
  const [feedId, setFeedId] = useState<RssFeedId>(RSS_FEEDS[0].id);
  const [value, setValue] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    if (kind === "feed-domain") {
      onAdd("url", encodeFeedDomainFilter(feedId, v));
    } else {
      onAdd(kind, v);
    }
    setValue("");
  }

  const phrases = filters.filter((f) => f.kind === "phrase");
  const contentHides = filters.filter((f) => f.kind === "content");
  const globalUrls = filters.filter(
    (f) => f.kind === "url" && !parseFeedScopedFilter(f.value).feedId,
  );
  const feedDomains = filters.filter(
    (f) => f.kind === "url" && Boolean(parseFeedScopedFilter(f.value).feedId),
  );

  return (
    <div className="flex flex-col gap-5 p-4 md:p-5">
      <p className="text-chalk font-rss text-[14px] leading-relaxed">
        Hide whole stories by phrase/URL, or hide in-article clutter (keeps the story). MLB
        “Get the Latest… Sign up” / Morning Lineup blocks are auto-hidden. Select text in an
        article and tap Hide to scrub more noise.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as RssFilterKind | "feed-domain")}
            className="bg-panel text-cream rounded-sm border border-white/10 px-3 py-2.5 text-[13px] outline-none focus:border-accent/50"
          >
            <option value="content">Hide in article</option>
            <option value="phrase">Hide story (phrase)</option>
            <option value="url">URL (all feeds)</option>
            <option value="feed-domain">Domain in feed</option>
          </select>
          {kind === "feed-domain" ? (
            <select
              value={feedId}
              onChange={(e) => setFeedId(e.target.value as RssFeedId)}
              className="bg-panel text-cream rounded-sm border border-white/10 px-3 py-2.5 text-[13px] outline-none focus:border-accent/50"
            >
              {RSS_FEEDS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          ) : null}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              kind === "content"
                ? "e.g. Get the Latest From MLB"
                : kind === "phrase"
                  ? "e.g. City SC"
                  : kind === "feed-domain"
                    ? "e.g. fox2now.com"
                    : "e.g. mls/city-sc"
            }
            className="bg-panel placeholder:text-chalk-dim text-cream min-w-0 flex-1 rounded-sm border border-white/10 px-3 py-2.5 text-[13px] outline-none focus:border-accent/50"
          />
          <button
            type="submit"
            disabled={saving || !value.trim()}
            className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </form>

      {loading ? (
        <p className="label-caps animate-pulse">Loading filters</p>
      ) : filters.length === 0 ? (
        <p className="text-chalk font-rss text-sm">No filters yet.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {contentHides.length > 0 && (
            <div>
              <div className="rule-head mb-3">Hidden in articles</div>
              <ul className="flex flex-col gap-2">
                {contentHides.map((f) => (
                  <li
                    key={f.id}
                    className="border-white/[0.06] flex items-center justify-between gap-3 border-b pb-2"
                  >
                    <span className="font-rss text-cream text-[15px]">{f.value}</span>
                    <button
                      type="button"
                      onClick={() => onDelete(f.id)}
                      className="text-chalk-dim hover:text-alert"
                      aria-label="Remove content hide"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {phrases.length > 0 && (
            <div>
              <div className="rule-head mb-3">Hidden stories (phrase)</div>
              <ul className="flex flex-col gap-2">
                {phrases.map((f) => (
                  <li
                    key={f.id}
                    className="border-white/[0.06] flex items-center justify-between gap-3 border-b pb-2"
                  >
                    <span className="font-rss text-cream text-[15px]">{f.value}</span>
                    <button
                      type="button"
                      onClick={() => onDelete(f.id)}
                      className="text-chalk-dim hover:text-alert"
                      aria-label="Remove phrase"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {globalUrls.length > 0 && (
            <div>
              <div className="rule-head mb-3">Blocked URLs</div>
              <ul className="flex flex-col gap-2">
                {globalUrls.map((f) => (
                  <li
                    key={f.id}
                    className="border-white/[0.06] flex items-center justify-between gap-3 border-b pb-2"
                  >
                    <span className="font-rss text-cream break-all text-[15px]">{f.value}</span>
                    <button
                      type="button"
                      onClick={() => onDelete(f.id)}
                      className="text-chalk-dim hover:text-alert"
                      aria-label="Remove URL"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {feedDomains.length > 0 && (
            <div>
              <div className="rule-head mb-3">Blocked domains by feed</div>
              <ul className="flex flex-col gap-2">
                {feedDomains.map((f) => {
                  const scoped = parseFeedScopedFilter(f.value);
                  const feedTitle =
                    RSS_FEEDS.find((x) => x.id === scoped.feedId)?.title ?? scoped.feedId;
                  return (
                    <li
                      key={f.id}
                      className="border-white/[0.06] flex items-center justify-between gap-3 border-b pb-2"
                    >
                      <span className="font-rss text-cream break-all text-[15px]">
                        <span className="text-accent">{feedTitle}</span>
                        {" · "}
                        {scoped.pattern}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDelete(f.id)}
                        className="text-chalk-dim hover:text-alert"
                        aria-label="Remove feed domain block"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
