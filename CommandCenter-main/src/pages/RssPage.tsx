import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCheck,
  Circle,
  ExternalLink,
  Highlighter,
  Newspaper,
  RefreshCw,
  Share,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  RSS_FEEDS,
  createRssHighlight,
  deleteRssHighlight,
  fetchRssArticle,
  fetchRssFeed,
  fetchRssHighlights,
  fetchRssReads,
  formatFeedDate,
  markRssRead,
  markRssUnread,
  updateRssHighlightNote,
  type RssFeedId,
  type RssFeedItem,
  type RssHighlight,
} from "@/lib/rss";
import StarField from "@/components/StarField";
import { cn } from "@/lib/utils";

function readingMinutes(words: number): string {
  const m = Math.max(1, Math.round(words / 220));
  return `${m} min read`;
}

function FeedList({
  items,
  readUrls,
  onOpen,
}: {
  items: RssFeedItem[];
  readUrls: Set<string>;
  onOpen: (item: RssFeedItem) => void;
}) {
  return (
    <ul className="divide-y divide-white/[0.06]">
      {items.map((item) => {
        const read = readUrls.has(item.link);
        return (
          <li key={item.id}>
            <div
              className={cn(
                "group flex w-full gap-4 px-1 py-5 transition-colors md:gap-5",
                read && "opacity-55",
              )}
            >
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="shrink-0"
                aria-label={`Open ${item.title}`}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    className="bg-hero h-[72px] w-[96px] object-cover transition group-hover:brightness-110 md:h-[88px] md:w-[120px]"
                    loading="lazy"
                  />
                ) : (
                  <div className="bg-hero text-chalk-dim grid h-[72px] w-[96px] place-items-center md:h-[88px] md:w-[120px]">
                    <Newspaper size={22} />
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="label-caps text-accent mb-1.5">
                  {formatFeedDate(item.publishedAt)}
                  {item.author ? ` · ${item.author}` : ""}
                  {read ? " · Read" : ""}
                </div>
                <h3
                  className={cn(
                    "font-rss text-cream text-[22px] leading-snug font-medium transition-colors group-hover:text-white md:text-[26px]",
                    read && "text-chalk",
                  )}
                >
                  {item.title}
                </h3>
                {item.snippet ? (
                  <p className="font-rss text-chalk mt-2 line-clamp-2 text-[14.5px] leading-relaxed">
                    {item.snippet}
                  </p>
                ) : null}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HighlightComposer({
  quote,
  onSave,
  onCancel,
  saving,
}: {
  quote: string;
  onSave: (note: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="bg-panel border-accent/40 fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded border p-4 shadow-2xl md:inset-x-auto md:right-6 md:bottom-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="label-caps text-accent">New highlight</div>
        <button type="button" onClick={onCancel} className="text-chalk-dim hover:text-cream">
          <X size={16} />
        </button>
      </div>
      <blockquote className="font-rss text-cream/90 border-accent/40 mb-3 border-l-2 pl-3 text-[14px] leading-relaxed italic">
        {quote}
      </blockquote>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        rows={3}
        className="font-rss bg-field placeholder:text-chalk-dim text-cream mb-3 w-full resize-none rounded-sm border border-white/10 px-3 py-2 text-[14px] outline-none focus:border-accent/50"
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

function NotesPanel({
  highlights,
  onDelete,
  onUpdateNote,
}: {
  highlights: RssHighlight[];
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
}) {
  if (!highlights.length) {
    return (
      <p className="text-chalk font-rss text-[14px] leading-relaxed">
        Select text in the article, then tap Highlight to save a quote and optional comment.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {highlights.map((h) => (
        <HighlightCard
          key={h.id}
          highlight={h}
          onDelete={() => onDelete(h.id)}
          onUpdateNote={(note) => onUpdateNote(h.id, note)}
        />
      ))}
    </ul>
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
      <blockquote className="font-rss text-cream border-accent/50 border-l-2 pl-3 text-[15px] leading-relaxed">
        {highlight.quoteText}
      </blockquote>
      {editing ? (
        <form onSubmit={save} className="mt-2 flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="font-rss bg-field text-cream w-full resize-none rounded-sm border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-accent/50"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="text-accent text-[11px] uppercase tracking-[0.16em]"
            >
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
            className="font-rss text-chalk hover:text-cream text-left text-[13.5px] leading-relaxed"
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

function ReaderView({
  item,
  feedUrl,
  isRead,
  onBack,
  onToggleRead,
}: {
  item: RssFeedItem;
  feedUrl: string;
  isRead: boolean;
  onBack: () => void;
  onToggleRead: () => void;
}) {
  const qc = useQueryClient();
  const articleBodyRef = useRef<HTMLDivElement>(null);
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const article = useQuery({
    queryKey: ["rss-article", item.link],
    queryFn: () => fetchRssArticle(item.link),
    staleTime: 30 * 60_000,
  });

  const highlights = useQuery({
    queryKey: ["rss-highlights", item.link],
    queryFn: () => fetchRssHighlights(item.link),
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [item.link]);

  useEffect(() => {
    void markRssRead({
      articleUrl: item.link,
      articleTitle: item.title,
      feedUrl,
    })
      .then(() => qc.invalidateQueries({ queryKey: ["rss-reads"] }))
      .catch(() => {});
  }, [item.link, item.title, feedUrl, qc]);

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

  const title = article.data?.title || item.title;
  const byline = article.data?.byline || item.author;
  const image = article.data?.image || item.image;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(16rem,1fr)]">
      <article className="font-rss min-w-0">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to feed
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
          <a href={item.link} target="_blank" rel="noopener noreferrer">
            <img src={image} alt="" className="mb-8 max-h-[320px] w-full object-cover" />
          </a>
        ) : null}

        <p className="label-caps font-body text-chalk-dim mb-4">
          Select text to highlight · add a comment in Notes
        </p>

        {article.isLoading ? (
          <p className="label-caps font-body animate-pulse">Extracting text</p>
        ) : article.isError ? (
          <div className="bg-panel border-alert/40 font-body text-alert rounded border p-4 text-sm">
            Could not extract article text:{" "}
            {article.error instanceof Error ? article.error.message : String(article.error)}
            <div className="mt-3">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cream underline underline-offset-2"
              >
                Open original
              </a>
            </div>
          </div>
        ) : (
          <div
            ref={articleBodyRef}
            onMouseUp={captureSelection}
            onTouchEnd={() => window.setTimeout(captureSelection, 50)}
            className="rss-reader max-w-none text-[18px] leading-[1.75] text-[#e8eaf0] [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-chalk [&_em]:text-[#d9dce6] [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-[26px] [&_h2]:font-semibold [&_h2]:text-cream [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-[22px] [&_h3]:font-semibold [&_h3]:text-cream [&_img]:my-6 [&_img]:max-h-[360px] [&_img]:w-full [&_img]:object-contain [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-4 [&_strong]:font-semibold [&_strong]:text-cream [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: article.data?.contentHtml ?? "" }}
          />
        )}
      </article>

      <aside
        className={cn(
          "bg-panel border-white/[0.06] min-w-0 rounded border p-4 md:p-5",
          showNotes ? "block" : "hidden lg:block",
        )}
      >
        <div className="rule-head mb-4">Notes</div>
        <NotesPanel
          highlights={highlights.data ?? []}
          onDelete={(id) => deleteMut.mutate(id)}
          onUpdateNote={(id, note) => noteMut.mutate({ id, note })}
        />
      </aside>

      {pendingQuote ? (
        <HighlightComposer
          quote={pendingQuote}
          saving={createMut.isPending}
          onCancel={() => setPendingQuote(null)}
          onSave={(note) => createMut.mutate(note)}
        />
      ) : null}
    </div>
  );
}

export default function RssPage() {
  const qc = useQueryClient();
  const [feedId, setFeedId] = useState<RssFeedId>("moscout");
  const [selected, setSelected] = useState<RssFeedItem | null>(null);
  const [notesOnly, setNotesOnly] = useState(false);
  const feedMeta = RSS_FEEDS.find((f) => f.id === feedId) ?? RSS_FEEDS[0];

  const feed = useQuery({
    queryKey: ["rss-feed", feedMeta.url],
    queryFn: () => fetchRssFeed(feedMeta.url),
    staleTime: 5 * 60_000,
  });

  const reads = useQuery({
    queryKey: ["rss-reads"],
    queryFn: fetchRssReads,
    staleTime: 60_000,
  });

  const allNotes = useQuery({
    queryKey: ["rss-highlights-all"],
    queryFn: () => fetchRssHighlights(),
    enabled: notesOnly,
  });

  const readUrls = reads.data ?? new Set<string>();

  async function toggleRead(item: RssFeedItem) {
    try {
      if (readUrls.has(item.link)) {
        await markRssUnread(item.link);
      } else {
        await markRssRead({
          articleUrl: item.link,
          articleTitle: item.title,
          feedUrl: feedMeta.url,
        });
      }
      await qc.invalidateQueries({ queryKey: ["rss-reads"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update read state");
    }
  }

  return (
    <div className="flex flex-col gap-5 p-6 md:p-7">
      {!selected && (
        <div className="from-hero-lift to-hero relative overflow-hidden rounded border border-accent/30 bg-gradient-to-br px-7 py-6">
          <StarField count={28} seed={17} />
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="rule-head">Dispatch</div>
              <h2 className="font-rss text-cream mt-2 text-[34px] leading-tight font-semibold md:text-[40px]">
                {notesOnly ? "Notes" : feed.data?.title || feedMeta.title}
              </h2>
              <p className="font-rss text-chalk mt-2 max-w-xl text-[15px] leading-relaxed">
                Full article text extracted for reading — highlight passages and leave comments.
              </p>
              <a
                href="/rss.html"
                className="text-chalk hover:text-cream mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em]"
              >
                <Share size={12} />
                Dispatch Home Screen
              </a>
            </div>
            <div className="relative z-10 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setNotesOnly(false);
                  void feed.refetch();
                }}
                disabled={feed.isFetching}
                className={cn(
                  "text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] transition-colors",
                  feed.isFetching && "opacity-50",
                )}
              >
                <RefreshCw size={13} className={feed.isFetching ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {!selected && (
        <div className="flex flex-wrap gap-2">
          {RSS_FEEDS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFeedId(f.id);
                setNotesOnly(false);
                setSelected(null);
              }}
              className={cn(
                "rounded-sm border px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors",
                !notesOnly && feedId === f.id
                  ? "border-accent/50 bg-accent/15 text-cream"
                  : "border-white/10 text-chalk hover:text-cream",
              )}
            >
              {f.short}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setNotesOnly(true);
              setSelected(null);
            }}
            className={cn(
              "rounded-sm border px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors",
              notesOnly
                ? "border-accent/50 bg-accent/15 text-cream"
                : "border-white/10 text-chalk hover:text-cream",
            )}
          >
            Notes
          </button>
        </div>
      )}

      {notesOnly && !selected ? (
        <div className="bg-panel rounded border border-white/[0.06] p-5">
          <div className="rule-head mb-4">All highlights</div>
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
                  <blockquote className="font-rss text-cream border-accent/40 border-l-2 pl-3 text-[15px] leading-relaxed">
                    {h.quoteText}
                  </blockquote>
                  {h.note ? (
                    <p className="font-rss text-chalk mt-2 text-[13.5px]">{h.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : feed.isLoading && !selected ? (
        <p className="label-caps animate-pulse">Loading feed</p>
      ) : feed.isError && !selected ? (
        <div className="bg-panel border-alert/40 text-alert rounded border p-4 text-sm">
          Could not load feed:{" "}
          {feed.error instanceof Error ? feed.error.message : String(feed.error)}
        </div>
      ) : selected ? (
        <ReaderView
          item={selected}
          feedUrl={feedMeta.url}
          isRead={readUrls.has(selected.link)}
          onBack={() => setSelected(null)}
          onToggleRead={() => void toggleRead(selected)}
        />
      ) : (
        <div className="bg-panel rounded border border-white/[0.06] px-4 md:px-5">
          <FeedList
            items={feed.data?.items ?? []}
            readUrls={readUrls}
            onOpen={setSelected}
          />
        </div>
      )}
    </div>
  );
}
