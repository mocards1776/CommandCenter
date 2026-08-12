import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Ban,
  CheckCheck,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  Folder,
  Highlighter,
  Inbox,
  RefreshCw,
  Share,
  Square,
  Layers,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PlayerPeek from "@/components/rss/PlayerPeek";
import DispatchEspnGameReader from "@/components/rss/DispatchEspnGameReader";
import {
  RSS_FEEDS,
  addDedupeKeepHost,
  addRssFilter,
  applyRssFilters,
  articleSourceHost,
  createRssHighlight,
  dedupeArticles,
  encodeFeedDomainFilter,
  loadDedupeKeepHosts,
  parseFeedScopedFilter,
  partitionDedupedArticles,
  deleteRssFilter,
  deleteRssHighlight,
  fetchRssArticle,
  fetchRssFeed,
  fetchRssFilters,
  fetchRssHighlights,
  fetchRssReads,
  formatFeedDate,
  markRssRead,
  markRssReadMany,
  markRssUnread,
  removeDedupeKeepHost,
  suggestUrlFilterValue,
  updateRssHighlightNote,
  type RssFeedId,
  type RssFeedItem,
  type RssFeedItemRef,
  type RssFilter,
  type RssFilterKind,
  type RssHighlight,
} from "@/lib/rss";
import {
  buildPlayerNameIndex,
  extractPlayerNameCandidates,
  fetchMlbTeamRoster,
  linkifyMlbPlayersInHtml,
  parseEspnGameIdFromUrl,
  searchMlbPlayersByNames,
} from "@/lib/mlb";
import { cn } from "@/lib/utils";

type NavView = "unread" | RssFeedId | "notes" | "filters" | "duplicates";

function readingMinutes(words: number): string {
  const m = Math.max(1, Math.round(words / 220));
  return `${m} min read`;
}

function HighlightComposer({
  quote,
  onSave,
  onCancel,
  onBlock,
  saving,
  blocking,
}: {
  quote: string;
  onSave: (note: string) => void;
  onCancel: () => void;
  onBlock: () => void;
  saving: boolean;
  blocking: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="bg-panel border-accent/40 fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded border p-4 shadow-2xl md:inset-x-auto md:right-6 md:bottom-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBlock}
            disabled={blocking}
            title="Block this phrase"
            className="text-chalk-dim hover:text-alert inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
          >
            <Ban size={12} />
            Block
          </button>
          <div className="label-caps text-accent">New highlight</div>
        </div>
        <button type="button" onClick={onCancel} className="text-chalk-dim hover:text-cream">
          <X size={16} />
        </button>
      </div>
      <blockquote className="font-rss text-cream/90 border-accent/40 mb-3 border-l-2 pl-3 text-[15px] leading-relaxed italic">
        {quote}
      </blockquote>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        rows={3}
        className="font-rss bg-field placeholder:text-chalk-dim text-cream mb-3 w-full resize-none rounded-sm border border-white/10 px-3 py-2 text-[15px] outline-none focus:border-accent/50"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-chalk hover:text-cream px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(note)}
          className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function HighlightCard({
  highlight,
  onDelete,
  onUpdateNote,
}: {
  highlight: RssHighlight;
  onDelete: () => void;
  onUpdateNote: (note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(highlight.note);

  function save(e: FormEvent) {
    e.preventDefault();
    onUpdateNote(draft);
    setEditing(false);
  }

  return (
    <li className="border-white/[0.08] border-b pb-4 last:border-0">
      <blockquote className="font-rss text-cream border-accent/50 border-l-2 pl-3 text-[16px] leading-relaxed">
        {highlight.quoteText}
      </blockquote>
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

    node.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    return () => {
      node.removeEventListener("touchstart", onTouchStart, true);
      node.removeEventListener("touchend", onTouchEnd, true);
    };
  }, [node]);

  return setNode;
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
  hasPrev,
  hasNext,
  onBack,
  onPrev,
  onNext,
  onToggleRead,
}: {
  item: RssFeedItem;
  feedUrl: string;
  isRead: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleRead: () => void;
}) {
  const isEspnGame =
    Boolean(parseEspnGameIdFromUrl(item.link)) ||
    feedUrl === "synthetic:cardinals-wraps" ||
    /espn\.com\/mlb\/(?:recap|preview|game)/i.test(item.link);

  // Cardinals wraps/previews → exact sports game UI (matchup + wrap + stats).
  if (isEspnGame) {
    return (
      <EspnGameReaderShell
        item={item}
        feedUrl={feedUrl}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onClose={onBack}
        onPrev={onPrev}
        onNext={onNext}
      />
    );
  }

  return (
    <ArticleReaderShell
      item={item}
      feedUrl={feedUrl}
      isRead={isRead}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onClose={onBack}
      onPrev={onPrev}
      onNext={onNext}
      onToggleRead={onToggleRead}
    />
  );
}

function EspnGameReaderShell({
  item,
  feedUrl,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
}: {
  item: RssFeedItem;
  feedUrl: string;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const qc = useQueryClient();

  const leave = () => {
    onClose();
    const st = (history.state as { dispatchArticle?: string } | null) ?? {};
    if (st.dispatchArticle) history.back();
  };

  const swipeRef = useSwipeNav({
    enabled: true,
    onBack: leave,
    onNext: hasNext ? onNext : null,
  });

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
    <div ref={swipeRef} style={{ touchAction: "pan-y" }}>
      <DispatchEspnGameReader
        url={item.link}
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
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  onToggleRead,
}: {
  item: RssFeedItem;
  feedUrl: string;
  isRead: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleRead: () => void;
}) {
  const qc = useQueryClient();
  const articleBodyRef = useRef<HTMLDivElement>(null);
  const titleSelectRef = useRef<HTMLElement>(null);
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [linkedHtml, setLinkedHtml] = useState<string>("");
  const [peekPlayerId, setPeekPlayerId] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const article = useQuery({
    queryKey: ["rss-article-v2", item.link],
    queryFn: () => fetchRssArticle(item.link),
    staleTime: 10 * 60_000,
  });

  const highlights = useQuery({
    queryKey: ["rss-highlights", item.link],
    queryFn: () => fetchRssHighlights(item.link),
  });

  // Seed with Cardinals roster for fast local matches; search fills in any MLB player.
  const roster = useQuery({
    queryKey: ["mlb-roster-stl"],
    queryFn: () => fetchMlbTeamRoster(138),
    staleTime: 30 * 60_000,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [item.link]);

  // Browser / iOS back: one history entry for the reader; article changes replace it
  // so back always returns to the feed list (not the previous article).
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

  // Arrow keys: previous / next article (desktop). Escape closes lightbox.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && lightboxSrc) {
        e.preventDefault();
        setLightboxSrc(null);
        return;
      }
      if (peekPlayerId != null || pendingQuote || lightboxSrc) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext, peekPlayerId, pendingQuote, lightboxSrc]);

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
  }, [linkedHtml, article.data?.contentHtml]);

  // Link any MLB player names → in-app player peek; stylize tweet cards.
  useEffect(() => {
    const html = article.data?.contentHtml;
    if (!html) {
      setLinkedHtml("");
      return;
    }
    let cancelled = false;
    (async () => {
      const players = roster.data ?? [];
      const index = buildPlayerNameIndex(players, { bareLastNames: true });
      const candidates = extractPlayerNameCandidates(article.data?.contentText ?? "", 48);
      if (candidates.length) {
        const found = await searchMlbPlayersByNames(candidates, 48);
        for (const [k, id] of found) index.set(k, id);
      }
      if (cancelled) return;
      const linked = linkifyMlbPlayersInHtml(html, index);
      setLinkedHtml(stylizeTweetCardsInHtml(linked));
    })().catch(() => {
      if (!cancelled) setLinkedHtml(stylizeTweetCardsInHtml(html));
    });
    return () => {
      cancelled = true;
    };
  }, [article.data?.contentHtml, article.data?.contentText, roster.data]);

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
  }, [linkedHtml, article.data?.contentHtml]);

  const createMut = useMutation({
    mutationFn: (note: string) =>
      createRssHighlight({
        articleUrl: item.link,
        articleTitle: article.data?.title || item.title,
        feedUrl,
        quoteText: pendingQuote ?? "",
        note,
      }),
    onSuccess: () => {
      setPendingQuote(null);
      void qc.invalidateQueries({ queryKey: ["rss-highlights", item.link] });
      void qc.invalidateQueries({ queryKey: ["rss-highlights-all"] });
      toast.success("Highlight saved");
      setShowNotes(true);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const blockPhraseMut = useMutation({
    mutationFn: (phrase: string) => addRssFilter("phrase", phrase),
    onSuccess: () => {
      setPendingQuote(null);
      void qc.invalidateQueries({ queryKey: ["rss-filters"] });
      toast.success("Phrase blocked");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add filter"),
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

  const swipeRef = useSwipeNav({
    enabled: !pendingQuote && peekPlayerId == null && !lightboxSrc,
    onBack: leave,
    onNext: hasNext ? onNext : null,
  });

  const title = article.data?.title || item.title;
  const byline = article.data?.byline || item.author;
  const image = article.data?.image || item.image;

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
      ref={swipeRef}
      className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(15rem,1fr)]"
      style={{ touchAction: "pan-y" }}
    >
      <article className="font-rss min-w-0">
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
            onClick={() => void shareArticle()}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            <Share size={14} />
            Share
          </button>
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
            {byline ? ` · ${byline}` : ""}
            {article.data?.wordCount ? ` · ${readingMinutes(article.data.wordCount)}` : ""}
          </div>
          <h2 className="text-cream text-[32px] leading-[1.15] font-semibold md:text-[40px]">
            {title}
          </h2>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-chalk hover:text-accent mt-4 inline-flex items-center gap-1.5 text-[12px] transition-colors"
          >
            Original
            <ExternalLink size={12} />
          </a>
        </header>

        {image && !(linkedHtml || article.data?.contentHtml || "").includes("<video") ? (
          <button
            type="button"
            onClick={() => setLightboxSrc(image)}
            className="mb-8 block w-full"
          >
            <img
              src={image}
              alt=""
              referrerPolicy="no-referrer"
              className="max-h-[320px] w-full object-cover"
            />
          </button>
        ) : null}

        {article.isLoading ? (
          <p className="label-caps font-body animate-pulse">Extracting text</p>
        ) : article.isError ? (
          <div className="bg-panel border-alert/40 font-body text-alert rounded border p-4 text-sm">
            Could not extract article text:{" "}
            {article.error instanceof Error ? article.error.message : String(article.error)}
          </div>
        ) : (
          <div
            ref={articleBodyRef}
            onMouseUp={captureSelection}
            onTouchEnd={() => {
              window.setTimeout(captureSelection, 50);
            }}
            onClick={(e) => {
              const a = (e.target as HTMLElement).closest(
                "a.rss-player-link",
              ) as HTMLAnchorElement | null;
              if (!a) return;
              e.preventDefault();
              const href = a.getAttribute("href") ?? "";
              const m = href.match(/\/sports\/mlb\/player\/(\d+)/);
              if (m) setPeekPlayerId(Number(m[1]));
            }}
            className="rss-reader max-w-none text-[20px] leading-[1.8] text-[#eceef4] [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a.rss-player-link]:text-accent [&_a.rss-player-link]:decoration-accent/40 [&_a.rss-player-link]:underline-offset-[3px] [&_em]:text-[#d9dce6] [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:text-cream [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-[22px] [&_h3]:font-semibold [&_h3]:text-cream [&_img]:my-6 [&_img]:max-h-[360px] [&_img]:w-full [&_img]:object-contain [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-4 [&_strong]:font-semibold [&_strong]:text-cream [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_video.rss-video]:my-6 [&_video.rss-video]:aspect-video [&_video.rss-video]:w-full [&_video.rss-video]:rounded-lg [&_video.rss-video]:bg-black [&_figcaption]:hidden [&_figure]:my-6"
            dangerouslySetInnerHTML={{ __html: linkedHtml || article.data?.contentHtml || "" }}
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
          "bg-panel border-white/[0.06] min-w-0 rounded border p-4 md:p-5",
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
                onDelete={() => deleteMut.mutate(h.id)}
                onUpdateNote={(note) => noteMut.mutate({ id: h.id, note })}
              />
            ))}
          </ul>
        )}
      </aside>

      {pendingQuote ? (
        <HighlightComposer
          quote={pendingQuote}
          saving={createMut.isPending}
          blocking={blockPhraseMut.isPending}
          onCancel={() => setPendingQuote(null)}
          onSave={(note) => createMut.mutate(note)}
          onBlock={() => {
            const phrase = pendingQuote.trim().slice(0, 120);
            if (phrase) blockPhraseMut.mutate(phrase);
          }}
        />
      ) : null}

      {peekPlayerId != null ? (
        <PlayerPeek playerId={peekPlayerId} onClose={() => setPeekPlayerId(null)} />
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
  onOpen,
  onBlockUrl,
  onKeepSource,
  keptSource,
  onArchive,
  batchMode,
  batchSelected,
}: {
  item: RssFeedItem;
  read: boolean;
  highlighted?: boolean;
  onOpen: () => void;
  onBlockUrl: () => void;
  onKeepSource?: () => void;
  keptSource?: boolean;
  onArchive?: () => void;
  batchMode?: boolean;
  batchSelected?: boolean;
}) {
  return (
    <li>
      <div
        className={cn(
          "hover:bg-white/[0.03] flex w-full items-start gap-3 border-b border-white/[0.06] px-3 py-3.5 transition-colors",
          read && "opacity-50",
          highlighted && "border-l-accent border-l-2",
          batchSelected && "bg-accent/10",
        )}
      >
        {batchMode ? (
          <button
            type="button"
            onClick={onOpen}
            className="text-chalk hover:text-cream mt-1.5 shrink-0"
            aria-label={batchSelected ? "Deselect" : "Select"}
          >
            {batchSelected ? (
              <CheckSquare size={18} className="text-accent" />
            ) : (
              <Square size={18} />
            )}
          </button>
        ) : null}
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          {!batchMode ? (
            <span
              className={cn(
                "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                read ? "bg-white/15" : "bg-accent",
              )}
              aria-hidden
            />
          ) : null}
          {item.image ? (
            <img
              src={item.image}
              alt=""
              className="bg-hero h-14 w-[4.5rem] shrink-0 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="bg-hero text-chalk-dim grid h-14 w-[4.5rem] shrink-0 place-items-center text-[10px] uppercase tracking-wider">
              —
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="label-caps text-chalk-dim mb-1 flex items-center gap-1.5">
              {formatFeedDate(item.publishedAt)}
              {item.author ? ` · ${item.author}` : ""}
              {keptSource ? " · Kept source" : ""}
              {highlighted ? (
                <Highlighter size={12} className="text-accent shrink-0" aria-label="Has highlights" />
              ) : null}
            </div>
            <h3
              className={cn(
                "font-rss text-[17px] leading-snug font-medium md:text-[18px]",
                read ? "text-chalk" : "text-cream",
              )}
            >
              {item.title}
            </h3>
            {item.snippet ? (
              <p className="font-rss text-chalk mt-1 line-clamp-2 text-[14px] leading-relaxed">
                {item.snippet}
              </p>
            ) : null}
          </div>
        </button>
        {!batchMode && onArchive && !read ? (
          <button
            type="button"
            onClick={onArchive}
            title="Archive (mark read)"
            className="text-chalk-dim hover:text-cream mt-1 shrink-0"
            aria-label="Archive"
          >
            <Archive size={15} />
          </button>
        ) : null}
        {!batchMode && onKeepSource ? (
          <button
            type="button"
            onClick={onKeepSource}
            title={keptSource ? "Source already white-labeled" : "White-label this source (never soft-dedupe)"}
            className={cn(
              "mt-1 shrink-0 text-[10px] uppercase tracking-[0.12em]",
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
            onClick={onBlockUrl}
            title="Block domain / URL"
            className="text-chalk-dim hover:text-alert mt-1 shrink-0"
            aria-label="Block domain"
          >
            <Ban size={15} />
          </button>
        ) : null}
        {!batchMode ? <ChevronRight size={16} className="text-chalk-dim mt-1 shrink-0" /> : null}
      </div>
    </li>
  );
}

export default function RssPage() {
  const qc = useQueryClient();
  const [nav, setNav] = useState<NavView>("unread");
  const [selected, setSelected] = useState<RssFeedItemRef | null>(null);
  const [readerQueue, setReaderQueue] = useState<RssFeedItemRef[] | null>(null);
  const [mobilePane, setMobilePane] = useState<"sidebar" | "list">("sidebar");
  const [keepHosts, setKeepHosts] = useState<string[]>(() =>
    typeof window !== "undefined" ? loadDedupeKeepHosts() : [],
  );
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(() => new Set());

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

  const feedQueries = useQueries({
    queries: RSS_FEEDS.map((f) => ({
      queryKey: ["rss-feed-v2", f.url],
      queryFn: () => fetchRssFeed(f.url),
      staleTime: 90_000,
    })),
  });

  const allNotes = useQuery({
    queryKey: ["rss-highlights-all"],
    queryFn: () => fetchRssHighlights(),
    enabled: true,
  });

  const highlightUrls = useMemo(
    () => new Set((allNotes.data ?? []).map((h) => h.articleUrl)),
    [allNotes.data],
  );

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
    RSS_FEEDS.forEach((f, i) => {
      const data = feedQueries[i]?.data;
      const items = applyRssFilters(dedupeArticles(data?.items ?? [], keepHosts), filters, f.id);
      map.set(f.id, {
        items,
        title: data?.title || f.title,
        url: f.url,
      });
    });
    return map;
  }, [feedQueries, filters, keepHosts]);

  /** Cross-feed soft duplicates (e.g. FOX 2 vs MLB.com) — hidden from main/unread. */
  const duplicateItems = useMemo(() => {
    const merged: RssFeedItemRef[] = [];
    RSS_FEEDS.forEach((f, i) => {
      const data = feedQueries[i]?.data;
      const filtered = applyRssFilters(data?.items ?? [], filters, f.id);
      for (const it of filtered) {
        merged.push({ ...it, feedId: f.id, feedUrl: f.url });
      }
    });
    return partitionDedupedArticles(merged, keepHosts).duplicates;
  }, [feedQueries, filters, keepHosts]);

  const unreadByFeed = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of RSS_FEEDS) {
      const items = feedById.get(f.id)?.items ?? [];
      counts[f.id] = items.filter((it) => !readUrls.has(it.link)).length;
    }
    return counts;
  }, [feedById, readUrls]);

  const listItems = useMemo(() => {
    if (nav === "notes" || nav === "filters") return [] as RssFeedItemRef[];
    if (nav === "duplicates") {
      const rows = [...duplicateItems];
      rows.sort((a, b) => {
        const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return db - da;
      });
      return rows;
    }
    if (nav === "unread") {
      const merged: RssFeedItemRef[] = [];
      for (const f of RSS_FEEDS) {
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
    const pack = feedById.get(nav);
    return (pack?.items ?? []).map((it) => ({
      ...it,
      feedId: nav,
      feedUrl: pack?.url ?? "",
    }));
  }, [nav, feedById, readUrls, duplicateItems, keepHosts]);

  const totalUnread = useMemo(() => {
    const merged: RssFeedItem[] = [];
    for (const f of RSS_FEEDS) {
      for (const it of feedById.get(f.id)?.items ?? []) {
        if (!readUrls.has(it.link)) merged.push(it);
      }
    }
    return dedupeArticles(merged, keepHosts).length;
  }, [feedById, readUrls, keepHosts]);

  const navItems = readerQueue ?? listItems;
  const selectedIndex = selected
    ? navItems.findIndex((it) => it.link === selected.link)
    : -1;

  const listTitle =
    nav === "unread"
      ? "Unread"
      : nav === "notes"
        ? "Notes"
        : nav === "filters"
          ? "Filters"
          : nav === "duplicates"
            ? "Duplicates"
            : RSS_FEEDS.find((f) => f.id === nav)?.title ?? "Feed";

  const feedsLoading = feedQueries.some((q) => q.isLoading);
  const feedsFetching = feedQueries.some((q) => q.isFetching);
  const feedsError = feedQueries.find((q) => q.isError)?.error;
  const feedsFailed = feedQueries.filter((q) => q.isError).length;

  const unreadInList = useMemo(
    () => listItems.filter((it) => !readUrls.has(it.link)),
    [listItems, readUrls],
  );

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
  }

  function goRelative(delta: number) {
    if (selectedIndex < 0) return;
    const next = navItems[selectedIndex + delta];
    if (next) setSelected(next);
  }

  const batchArchiveMut = useMutation({
    mutationFn: () => {
      const targets = listItems.filter((it) => batchSelected.has(it.link) && !readUrls.has(it.link));
      return markRssReadMany(
        targets.map((it) => ({
          articleUrl: it.link,
          articleTitle: it.title,
          feedUrl: it.feedUrl,
        })),
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["rss-reads"] });
      const n = batchSelected.size;
      setBatchSelected(new Set());
      setBatchMode(false);
      toast.success(n === 1 ? "Archived 1 article" : `Archived ${n} articles`);
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
    nav === "duplicates" || nav === "unread" || RSS_FEEDS.some((f) => f.id === nav);

  if (selected) {
    return (
      <div className="p-4 md:p-6">
        <ReaderView
          item={selected}
          feedUrl={selected.feedUrl}
          isRead={readUrls.has(selected.link)}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < navItems.length - 1}
          onBack={() => {
            setSelected(null);
            setReaderQueue(null);
          }}
          onPrev={() => goRelative(-1)}
          onNext={() => goRelative(1)}
          onToggleRead={() => void toggleRead(selected)}
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
          <h2 className="font-rss text-cream text-[26px] font-semibold tracking-tight">Dispatch</h2>
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
        </div>

        <div className="flex-1 px-2 pb-4">
          <p className="label-caps text-chalk-dim px-2 py-2">Feeds</p>
          <ul className="flex flex-col gap-0.5">
            {RSS_FEEDS.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => selectNav(f.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-left transition-colors",
                    nav === f.id
                      ? "bg-accent/15 text-cream"
                      : "text-chalk hover:bg-white/[0.04] hover:text-cream",
                  )}
                >
                  <Folder size={16} className="text-accent shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{f.title}</span>
                  <span className="text-chalk tabular-nums text-[12px]">
                    {unreadByFeed[f.id] ?? 0}
                  </span>
                  <ChevronRight size={14} className="opacity-50" />
                </button>
              </li>
            ))}
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
                <span className="text-chalk tabular-nums text-[12px]">{duplicateItems.length}</span>
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
                <span className="text-chalk tabular-nums text-[12px]">{filters.length}</span>
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
                : nav === "filters"
                  ? `${filters.length} rules`
                  : nav === "duplicates"
                    ? `${duplicateItems.length} filtered · MLB preferred`
                    : `${listItems.length} articles`}
            </p>
          </div>
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
                  <li key={h.id} className="border-white/[0.06] border-b pb-4 last:border-0">
                    <div className="label-caps text-accent mb-1">
                      {h.articleTitle || h.articleUrl}
                    </div>
                    <blockquote className="font-rss text-cream border-accent/40 border-l-2 pl-3 text-[16px] leading-relaxed">
                      {h.quoteText}
                    </blockquote>
                    {h.note ? (
                      <p className="font-rss text-chalk mt-2 text-[14px]">{h.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : feedsLoading ? (
          <p className="label-caps animate-pulse p-5">Loading feeds</p>
        ) : feedsFailed > 0 && listItems.length === 0 ? (
          <div className="space-y-3 p-5">
            <p className="text-alert font-rss text-sm">
              Couldn&apos;t load feeds
              {feedsFailed === RSS_FEEDS.length ? "" : ` (${feedsFailed} of ${RSS_FEEDS.length} failed)`}
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
                nav === "unread" || nav === "duplicates" || RSS_FEEDS.some((f) => f.id === nav);
              const feedScoped = RSS_FEEDS.some((f) => f.id === nav);
              return (
              <ArticleRow
                key={item.id + item.link}
                item={item}
                read={readUrls.has(item.link)}
                highlighted={highlightUrls.has(item.link)}
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
                onArchive={
                  canArchive
                    ? () => {
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
  const globalUrls = filters.filter(
    (f) => f.kind === "url" && !parseFeedScopedFilter(f.value).feedId,
  );
  const feedDomains = filters.filter(
    (f) => f.kind === "url" && Boolean(parseFeedScopedFilter(f.value).feedId),
  );

  return (
    <div className="flex flex-col gap-5 p-4 md:p-5">
      <p className="text-chalk font-rss text-[14px] leading-relaxed">
        Hide stories that match a phrase (title/snippet), a URL fragment, or a domain inside one
        feed. MLS / City SC pieces on the STL Today Cardinals feed are auto-hidden.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as RssFilterKind | "feed-domain")}
            className="bg-panel text-cream rounded-sm border border-white/10 px-3 py-2.5 text-[13px] outline-none focus:border-accent/50"
          >
            <option value="phrase">Phrase</option>
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
              kind === "phrase"
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
          {phrases.length > 0 && (
            <div>
              <div className="rule-head mb-3">Blocked phrases</div>
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
