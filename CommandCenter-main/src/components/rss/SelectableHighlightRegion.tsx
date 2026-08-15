/** Shared text-selection → highlight / hide for wraps, previews, and player cards. */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  addRssFilter,
  contentHidePhrases,
  createRssHighlight,
  fetchRssFilters,
  fetchRssHighlights,
  hidePhrasesInHtml,
  markQuotesInHtml,
  scrubReaderChrome,
  type RssHighlight,
} from "@/lib/rss";

function NewHighlightSheet({
  quote,
  onCancel,
  onSave,
  onHide,
  saving,
  hiding,
}: {
  quote: string;
  onCancel: () => void;
  onSave: (note: string) => void;
  onHide: () => void;
  saving: boolean;
  hiding: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="bg-panel border-accent/40 fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg rounded border p-4 shadow-2xl md:inset-x-auto md:right-6 md:bottom-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onHide}
            disabled={hiding}
            title="Hide this text (keeps the story)"
            className="text-chalk-dim hover:text-alert inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
          >
            <EyeOff size={12} />
            Hide
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

export function SelectableHighlightRegion({
  articleUrl,
  articleTitle,
  feedUrl,
  articleImage,
  html,
  className,
  children,
}: {
  articleUrl: string;
  articleTitle: string;
  feedUrl?: string | null;
  articleImage?: string | null;
  /** When set, render as HTML with hide-phrases + quote marks applied. */
  html?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  const qc = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);

  const highlights = useQuery({
    queryKey: ["rss-highlights", articleUrl],
    queryFn: () => fetchRssHighlights(articleUrl),
    staleTime: 30_000,
  });
  const contentFilters = useQuery({
    queryKey: ["rss-filters"],
    queryFn: fetchRssFilters,
    staleTime: 60_000,
  });

  const quoteTexts = useMemo(
    () => (highlights.data ?? []).map((h: RssHighlight) => h.quoteText).filter(Boolean),
    [highlights.data],
  );
  const hidePhrases = useMemo(
    () => contentHidePhrases(contentFilters.data ?? []),
    [contentFilters.data],
  );

  const displayHtml = useMemo(() => {
    if (!html) return null;
    return markQuotesInHtml(
      hidePhrasesInHtml(scrubReaderChrome(html), hidePhrases),
      quoteTexts,
    );
  }, [html, hidePhrases, quoteTexts]);

  const createMut = useMutation({
    mutationFn: (note: string) =>
      createRssHighlight({
        articleUrl,
        articleTitle: articleTitle.trim() || "Untitled",
        feedUrl: feedUrl ?? null,
        articleImage: articleImage ?? null,
        quoteText: pendingQuote ?? "",
        note,
      }),
    onSuccess: () => {
      setPendingQuote(null);
      void qc.invalidateQueries({ queryKey: ["rss-highlights", articleUrl] });
      void qc.invalidateQueries({ queryKey: ["rss-highlights-all"] });
      toast.success("Highlight saved");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const hideMut = useMutation({
    mutationFn: (phrase: string) => addRssFilter("content", phrase),
    onSuccess: () => {
      setPendingQuote(null);
      void qc.invalidateQueries({ queryKey: ["rss-filters"] });
      toast.success("Hidden in articles");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not hide text"),
  });

  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (text.length < 2) return;
    const root = rootRef.current;
    const anchor = sel.anchorNode;
    if (!root || !anchor || !root.contains(anchor)) return;
    setPendingQuote(text.slice(0, 2000));
    sel.removeAllRanges();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pendingQuote) setPendingQuote(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingQuote]);

  return (
    <>
      <div
        ref={rootRef}
        className={className}
        data-no-double-tap
        onMouseUp={captureSelection}
        onTouchEnd={() => {
          // Wait for the browser to finalize the selection range on iOS.
          window.setTimeout(captureSelection, 30);
        }}
        {...(displayHtml
          ? { dangerouslySetInnerHTML: { __html: displayHtml } }
          : { children })}
      />
      {pendingQuote ? (
        <NewHighlightSheet
          quote={pendingQuote}
          onCancel={() => setPendingQuote(null)}
          onSave={(note) => createMut.mutate(note)}
          onHide={() => {
            const phrase = pendingQuote.trim().slice(0, 160);
            if (phrase) hideMut.mutate(phrase);
          }}
          saving={createMut.isPending}
          hiding={hideMut.isPending}
        />
      ) : null}
    </>
  );
}
