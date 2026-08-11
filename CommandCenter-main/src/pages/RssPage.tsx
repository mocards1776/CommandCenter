import { useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent } from "react";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  Folder,
  Highlighter,
  Inbox,
  RefreshCw,
  Share,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PlayerPeek from "@/components/rss/PlayerPeek";
import {
  RSS_FEEDS,
  addRssFilter,
  applyRssFilters,
  createRssHighlight,
  dedupeArticles,
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
  searchMlbPlayersByNames,
} from "@/lib/mlb";
import { cn } from "@/lib/utils";

type NavView = "unread" | RssFeedId | "notes" | "filters";

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
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e: TouchEvent) => {
      if (!opts.enabled) return;
      const t = e.changedTouches[0] ?? e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: TouchEvent) => {
      if (!opts.enabled || !start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x;
      const dy = t.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (dx > 0) opts.onBack();
      else if (opts.onNext) opts.onNext();
    },
  };
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
  const qc = useQueryClient();
  const articleBodyRef = useRef<HTMLDivElement>(null);
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [linkedHtml, setLinkedHtml] = useState<string>("");
  const [peekPlayerId, setPeekPlayerId] = useState<number | null>(null);

  const article = useQuery({
    queryKey: ["rss-article", item.link],
    queryFn: () => fetchRssArticle(item.link),
    staleTime: 30 * 60_000,
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

  // iOS edge-swipe / browser back returns to the feed list.
  useEffect(() => {
    const st = (history.state as { dispatchArticle?: string } | null) ?? {};
    if (st.dispatchArticle !== item.link) {
      history.pushState({ ...st, dispatchArticle: item.link }, "", window.location.href);
    }
    const onPop = (e: PopStateEvent) => {
      const next = (e.state as { dispatchArticle?: string } | null) ?? {};
      if (!next.dispatchArticle) onBack();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [item.link, onBack]);

  useEffect(() => {
    void markRssRead({
      articleUrl: item.link,
      articleTitle: item.title,
      feedUrl,
    })
      .then(() => qc.invalidateQueries({ queryKey: ["rss-reads"] }))
      .catch(() => {});
  }, [item.link, item.title, feedUrl, qc]);

  // Arrow keys: previous / next article (desktop).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (peekPlayerId != null || pendingQuote) return;
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
  }, [hasPrev, hasNext, onPrev, onNext, peekPlayerId, pendingQuote]);

  // Link any MLB player names → in-app player peek.
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
      setLinkedHtml(linkifyMlbPlayersInHtml(html, index));
    })().catch(() => {
      if (!cancelled) setLinkedHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [article.data?.contentHtml, article.data?.contentText, roster.data]);

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
    if (!root) return;
    const anchor = sel.anchorNode;
    if (!anchor || !root.contains(anchor)) return;
    setPendingQuote(text.slice(0, 2000));
    sel.removeAllRanges();
  }

  const swipe = useSwipeNav({
    enabled: !pendingQuote && peekPlayerId == null,
    onBack: () => {
      const st = (history.state as { dispatchArticle?: string } | null) ?? {};
      if (st.dispatchArticle) history.back();
      else onBack();
    },
    onNext: hasNext ? onNext : null,
  });

  const title = article.data?.title || item.title;
  const byline = article.data?.byline || item.author;
  const image = article.data?.image || item.image;

  return (
    <div
      className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(15rem,1fr)]"
      {...swipe}
    >
      <article className="font-rss min-w-0">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const st = (history.state as { dispatchArticle?: string } | null) ?? {};
              if (st.dispatchArticle) history.back();
              else onBack();
            }}
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
            onClick={() => setShowNotes((v) => !v)}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] lg:hidden"
          >
            <Highlighter size={14} />
            Notes ({highlights.data?.length ?? 0})
          </button>
        </div>

        <header className="mb-8">
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

        {image ? (
          <button
            type="button"
            onClick={() => window.open(item.link, "_blank", "noopener,noreferrer")}
            className="mb-8 block w-full"
          >
            <img src={image} alt="" className="max-h-[320px] w-full object-cover" />
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
            onTouchEnd={(e) => {
              swipe.onTouchEnd(e);
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
            className="rss-reader max-w-none text-[20px] leading-[1.8] text-[#eceef4] [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a.rss-player-link]:text-accent [&_a.rss-player-link]:decoration-accent/40 [&_a.rss-player-link]:underline-offset-[3px] [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-chalk [&_em]:text-[#d9dce6] [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:text-cream [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-[22px] [&_h3]:font-semibold [&_h3]:text-cream [&_img]:my-6 [&_img]:max-h-[360px] [&_img]:w-full [&_img]:object-contain [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-4 [&_strong]:font-semibold [&_strong]:text-cream [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5"
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
    </div>
  );
}

function ArticleRow({
  item,
  read,
  onOpen,
  onBlockUrl,
}: {
  item: RssFeedItem;
  read: boolean;
  onOpen: () => void;
  onBlockUrl: () => void;
}) {
  return (
    <li>
      <div
        className={cn(
          "hover:bg-white/[0.03] flex w-full items-start gap-3 border-b border-white/[0.06] px-3 py-3.5 transition-colors",
          read && "opacity-50",
        )}
      >
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span
            className={cn(
              "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
              read ? "bg-white/15" : "bg-accent",
            )}
            aria-hidden
          />
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
            <div className="label-caps text-chalk-dim mb-1">
              {formatFeedDate(item.publishedAt)}
              {item.author ? ` · ${item.author}` : ""}
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
        <button
          type="button"
          onClick={onBlockUrl}
          title="Blacklist this URL section"
          className="text-chalk-dim hover:text-alert mt-1 shrink-0"
          aria-label="Blacklist URL"
        >
          <Ban size={15} />
        </button>
        <ChevronRight size={16} className="text-chalk-dim mt-1 shrink-0" />
      </div>
    </li>
  );
}

export default function RssPage() {
  const qc = useQueryClient();
  const [nav, setNav] = useState<NavView>("unread");
  const [selected, setSelected] = useState<RssFeedItemRef | null>(null);
  const [mobilePane, setMobilePane] = useState<"sidebar" | "list">("sidebar");

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
      queryKey: ["rss-feed", f.url],
      queryFn: () => fetchRssFeed(f.url),
      staleTime: 5 * 60_000,
    })),
  });

  const allNotes = useQuery({
    queryKey: ["rss-highlights-all"],
    queryFn: () => fetchRssHighlights(),
    enabled: nav === "notes",
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
    RSS_FEEDS.forEach((f, i) => {
      const data = feedQueries[i]?.data;
      const items = applyRssFilters(dedupeArticles(data?.items ?? []), filters);
      map.set(f.id, {
        items,
        title: data?.title || f.title,
        url: f.url,
      });
    });
    return map;
  }, [feedQueries, filters]);

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
      const deduped = dedupeArticles(merged);
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
  }, [nav, feedById, readUrls]);

  const totalUnread = useMemo(() => {
    // Deduped unread across feeds so the same story isn't double-counted.
    const merged: RssFeedItem[] = [];
    for (const f of RSS_FEEDS) {
      for (const it of feedById.get(f.id)?.items ?? []) {
        if (!readUrls.has(it.link)) merged.push(it);
      }
    }
    return dedupeArticles(merged).length;
  }, [feedById, readUrls]);

  const selectedIndex = selected
    ? listItems.findIndex((it) => it.link === selected.link)
    : -1;

  const listTitle =
    nav === "unread"
      ? "Unread"
      : nav === "notes"
        ? "Notes"
        : nav === "filters"
          ? "Filters"
          : RSS_FEEDS.find((f) => f.id === nav)?.title ?? "Feed";

  const feedsLoading = feedQueries.some((q) => q.isLoading);
  const feedsFetching = feedQueries.some((q) => q.isFetching);

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
    setMobilePane("list");
  }

  function openArticle(item: RssFeedItemRef) {
    setSelected(item);
  }

  function goRelative(delta: number) {
    if (selectedIndex < 0) return;
    const next = listItems[selectedIndex + delta];
    if (next) setSelected(next);
  }

  if (selected) {
    return (
      <div className="p-4 md:p-6">
        <ReaderView
          item={selected}
          feedUrl={selected.feedUrl}
          isRead={readUrls.has(selected.link)}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < listItems.length - 1}
          onBack={() => setSelected(null)}
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
        className={cn(
          "bg-field min-w-0 flex-1",
          mobilePane === "sidebar" ? "hidden md:block" : "block",
        )}
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
                  : `${listItems.length} articles`}
            </p>
          </div>
          {nav !== "notes" && nav !== "filters" && unreadInList.length > 0 ? (
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
        ) : listItems.length === 0 ? (
          <p className="text-chalk font-rss p-5 text-sm">
            {nav === "unread" ? "You're caught up." : "No articles in this feed."}
          </p>
        ) : (
          <ul>
            {listItems.map((item) => (
              <ArticleRow
                key={item.id + item.link}
                item={item}
                read={readUrls.has(item.link)}
                onOpen={() => openArticle(item)}
                onBlockUrl={() => {
                  addFilterMut.mutate({
                    kind: "url",
                    value: suggestUrlFilterValue(item.link),
                  });
                }}
              />
            ))}
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
  const [kind, setKind] = useState<RssFilterKind>("phrase");
  const [value, setValue] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onAdd(kind, v);
    setValue("");
  }

  const phrases = filters.filter((f) => f.kind === "phrase");
  const urls = filters.filter((f) => f.kind === "url");

  return (
    <div className="flex flex-col gap-5 p-4 md:p-5">
      <p className="text-chalk font-rss text-[14px] leading-relaxed">
        Hide stories that match a phrase (title/snippet) or a URL fragment (host or path).
        MLS / City SC pieces on the STL Today Cardinals feed are auto-hidden — use a phrase
        like <span className="text-cream">City SC</span> only if you want an explicit rule;
        bare “city” is too broad.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as RssFilterKind)}
          className="bg-panel text-cream rounded-sm border border-white/10 px-3 py-2.5 text-[13px] outline-none focus:border-accent/50"
        >
          <option value="phrase">Phrase</option>
          <option value="url">URL</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === "phrase" ? "e.g. City SC" : "e.g. mls/city-sc"}
          className="bg-panel placeholder:text-chalk-dim text-cream min-w-0 flex-1 rounded-sm border border-white/10 px-3 py-2.5 text-[13px] outline-none focus:border-accent/50"
        />
        <button
          type="submit"
          disabled={saving || !value.trim()}
          className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
        >
          Add
        </button>
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
          {urls.length > 0 && (
            <div>
              <div className="rule-head mb-3">Blocked URLs</div>
              <ul className="flex flex-col gap-2">
                {urls.map((f) => (
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
        </div>
      )}
    </div>
  );
}
