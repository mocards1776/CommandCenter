import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Search, Star, Link2, Plus, X, BookOpen, ImageDown, Bookmark } from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchBooks,
  fetchSessions,
  importStoryGraphCsv,
  updateBook,
  createBook,
  deleteBook,
  addBookFromUrl,
  logPages,
  coverSrc,
  backfillCoversBatch,
  coversRemaining,
  fetchOnDeck,
  setOnDeck,
  fetchGoal,
  saveGoal,
  setProgress,
  percentToPage,
  pageToPercent,
  type ReadingSession,
} from "@/lib/books";
import StarField from "@/components/StarField";
import { useCelebration } from "@/components/celebration-context";
import { cn, todayStr } from "@/lib/utils";
import type { Book, ReadStatus } from "@/types";

const SHELVES: { key: ReadStatus; label: string }[] = [
  { key: "currently-reading", label: "Reading" },
  { key: "to-read", label: "To read" },
  { key: "read", label: "Read" },
  { key: "did-not-finish", label: "DNF" },
  { key: "paused", label: "Paused" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ── Rating ─────────────────────────────────────────────────────────── */
/** Half-star picker. StoryGraph uses quarter stars; halves are the useful part. */
function RatingPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative h-5 w-5">
          {/* two half-width hit targets per star */}
          <button
            aria-label={`${i - 0.5} stars`}
            onMouseEnter={() => setHover(i - 0.5)}
            onClick={() => onChange(i - 0.5)}
            className="absolute left-0 top-0 z-10 h-full w-1/2"
          />
          <button
            aria-label={`${i} stars`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            className="absolute right-0 top-0 z-10 h-full w-1/2"
          />
          <Star
            size={19}
            className={cn(
              "absolute inset-0",
              shown >= i - 0.5 ? "text-accent" : "text-white/20",
            )}
            style={
              shown >= i
                ? { fill: "currentColor" }
                : shown >= i - 0.5
                  ? {
                      fill: "currentColor",
                      clipPath: "inset(0 50% 0 0)",
                    }
                  : undefined
            }
          />
        </span>
      ))}
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="text-chalk-dim hover:text-alert ml-1.5 text-[10px] uppercase tracking-[0.15em]"
        >
          clear
        </button>
      )}
    </div>
  );
}

/* ── Calendar heatmap ───────────────────────────────────────────────── */
/** Pages read per day for the last ~26 weeks. */
function PagesCalendar({ sessions }: { sessions: ReadingSession[] }) {
  const { weeks, max, total } = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const s of sessions) {
      byDay.set(s.session_date, (byDay.get(s.session_date) ?? 0) + s.pages_read);
    }

    // Walk back to the Sunday 26 weeks ago so columns line up as weeks.
    const end = new Date(`${todayStr()}T12:00:00`);
    const start = new Date(end);
    start.setDate(start.getDate() - 26 * 7);
    start.setDate(start.getDate() - start.getDay());

    const cols: { date: string; pages: number }[][] = [];
    let col: { date: string; pages: number }[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      col.push({ date: iso, pages: byDay.get(iso) ?? 0 });
      if (col.length === 7) {
        cols.push(col);
        col = [];
      }
    }
    if (col.length) cols.push(col);

    return {
      weeks: cols,
      max: Math.max(1, ...byDay.values()),
      total: [...byDay.values()].reduce((a, b) => a + b, 0),
    };
  }, [sessions]);

  return (
    <div>
      <h2 className="rule-head mb-3">Pages by day</h2>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {w.map((d) => {
              // Four steps, so a light day still reads as different from none.
              const step = d.pages === 0 ? 0 : Math.ceil((d.pages / max) * 4);
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.pages} page${d.pages === 1 ? "" : "s"}`}
                  className="h-[9px] w-[9px] rounded-[2px]"
                  style={{
                    background:
                      step === 0
                        ? "rgba(237,239,245,0.06)"
                        : `color-mix(in srgb, var(--color-accent) ${step * 25}%, transparent)`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-chalk-dim mt-2 text-[10.5px] tracking-[0.10em]">
        {total.toLocaleString()} pages logged in the last 26 weeks
      </p>
    </div>
  );
}

/* ── Monthly stats ──────────────────────────────────────────────────── */
function MonthlyStats({ books, sessions }: { books: Book[]; sessions: ReadingSession[] }) {
  const [year, setYear] = useState(() => new Date().getFullYear());

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const b of books) if (b.finished_at) ys.add(Number(b.finished_at.slice(0, 4)));
    ys.add(new Date().getFullYear());
    return [...ys].sort((a, b) => b - a).slice(0, 12);
  }, [books]);

  const rows = useMemo(() => {
    const bookCount = Array(12).fill(0);
    const loggedPages = Array(12).fill(0);
    const estimatedPages = Array(12).fill(0);

    // Pages actually logged, by month.
    const bookHasSession = new Set<string>();
    for (const s of sessions) {
      if (!s.session_date.startsWith(String(year))) continue;
      loggedPages[Number(s.session_date.slice(5, 7)) - 1] += s.pages_read;
      if (s.book_id) bookHasSession.add(s.book_id);
    }

    for (const b of books) {
      if (!b.finished_at?.startsWith(String(year))) continue;
      const m = Number(b.finished_at.slice(5, 7)) - 1;
      bookCount[m]++;
      // Imported history has no sessions; use the page count as an estimate,
      // but never double-count a book that was actually logged.
      if (b.page_count && !bookHasSession.has(b.id)) estimatedPages[m] += b.page_count;
    }

    return { bookCount, loggedPages, estimatedPages };
  }, [books, sessions, year]);

  const maxBooks = Math.max(1, ...rows.bookCount);
  const totalBooks = rows.bookCount.reduce((a, b) => a + b, 0);
  const totalLogged = rows.loggedPages.reduce((a, b) => a + b, 0);
  const totalEstimated = rows.estimatedPages.reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="rule-head flex-1">By month</h2>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="bg-panel text-cream rounded-sm border border-white/10 px-2 py-1 text-[11px] outline-none"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="flex h-24 items-end gap-1">
        {rows.bookCount.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="from-accent-deep to-accent w-full rounded-sm bg-gradient-to-t"
              style={{ height: `${Math.max(2, (n / maxBooks) * 68)}px` }}
              title={`${MONTHS[i]} ${year}: ${n} books · ${(rows.loggedPages[i] + rows.estimatedPages[i]).toLocaleString()} pages`}
            />
            <span className="text-chalk-dim text-[8.5px]">{MONTHS[i][0]}</span>
          </div>
        ))}
      </div>
      <p className="text-chalk mt-2 text-[11px]">
        <span className="numeral text-accent">{totalBooks}</span> books ·{" "}
        <span className="numeral text-accent">
          {(totalLogged + totalEstimated).toLocaleString()}
        </span>{" "}
        pages in {year}
      </p>
      {totalEstimated > 0 && (
        <p className="text-chalk-dim mt-1 text-[10px]">
          {totalLogged.toLocaleString()} logged, {totalEstimated.toLocaleString()} estimated from
          page counts
        </p>
      )}
    </div>
  );
}

/* ── Book detail ────────────────────────────────────────────────────── */
function BookDetail({ book, onClose }: { book: Book; onClose: () => void }) {
  const qc = useQueryClient();
  const { burst, fanfare } = useCelebration();
  const [pages, setPages] = useState("");
  const [date, setDate] = useState(todayStr());
  const [tagDraft, setTagDraft] = useState("");
  const [mode, setMode] = useState<"pages" | "percent" | "page">("pages");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["reading-sessions"] });
  };

  const patch = useMutation({
    mutationFn: (p: Partial<Book>) => updateBook(book.id, p),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const log = useMutation({
    mutationFn: (n: number) =>
      logPages({
        bookId: book.id,
        pages: n,
        date,
        currentPage: book.current_page,
        pageCount: book.page_count,
        status: book.status,
      }),
    onSuccess: (r, n) => {
      setPages("");
      refresh();
      if (r.finished) fanfare(`Finished ${book.title}.`);
      else toast.success(`${n} pages logged`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not log pages"),
  });

  const jump = useMutation({
    mutationFn: (toPage: number) =>
      setProgress({
        bookId: book.id,
        toPage,
        date,
        currentPage: book.current_page,
        pageCount: book.page_count,
        status: book.status,
      }),
    onSuccess: (r) => {
      setPages("");
      refresh();
      if (r.finished) fanfare(`Finished ${book.title}.`);
      else toast.success(r.delta > 0 ? `${r.delta} pages logged` : "Progress updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const deck = useMutation({
    mutationFn: (on: boolean) => setOnDeck(book.id, on),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["on-deck"] });
    },
  });

  const cover = coverSrc(book);
  const pct = book.page_count ? Math.min(100, (book.current_page / book.page_count) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="bg-field h-full w-full max-w-md overflow-y-auto border-l border-accent/25 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-4">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="h-28 w-20 shrink-0 rounded-sm object-cover shadow-lg"
            />
          ) : (
            <div className="bg-panel grid h-28 w-20 shrink-0 place-items-center rounded-sm">
              <BookOpen size={22} className="text-chalk-dim" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-cream text-[21px] leading-tight">{book.title}</h2>
            <p className="text-chalk mt-1 text-[12.5px]">{book.authors || "Unknown author"}</p>
            {book.page_count && (
              <p className="text-chalk-dim mt-0.5 text-[11px]">{book.page_count} pages</p>
            )}
            {book.locked_at && (
              <p className="text-chalk-dim mt-1 text-[10px] uppercase tracking-[0.12em]">
                ✓ saved locally
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-chalk hover:text-cream shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Status */}
        <label className="mb-4 block">
          <span className="label-caps">Status</span>
          <select
            value={book.status}
            onChange={(e) => {
              const status = e.target.value as ReadStatus;
              const p: Partial<Book> = { status };
              if (status === "read" && !book.finished_at) {
                p.finished_at = todayStr();
                p.last_date_read = todayStr();
                if (book.read_count === 0) p.read_count = 1;
              }
              patch.mutate(p);
            }}
            className="bg-panel text-cream mt-1.5 w-full rounded-sm border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-accent/50"
          >
            {SHELVES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={() => deck.mutate(!book.on_deck)}
          className={cn(
            "mb-4 flex w-full items-center justify-center gap-2 rounded-sm border py-2 text-[10.5px] font-semibold uppercase tracking-[0.15em] transition",
            book.on_deck
              ? "border-accent bg-accent/15 text-accent"
              : "text-chalk hover:text-cream border-white/10 hover:border-accent/50",
          )}
        >
          <Bookmark size={13} className={book.on_deck ? "fill-current" : ""} />
          {book.on_deck ? "On deck" : "Add to on deck"}
        </button>

        {/* Rating */}
        <div className="mb-4">
          <span className="label-caps">Rating</span>
          <div className="mt-1.5">
            <RatingPicker
              value={book.star_rating}
              onChange={(v) => patch.mutate({ star_rating: v })}
            />
          </div>
        </div>

        {/* Progress + logging */}
        <div className="bg-panel mb-4 rounded border border-white/[0.07] p-4">
          <span className="label-caps">Log reading</span>

          {pct !== null && (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-white/10">
                <div className="bg-accent h-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-chalk-dim mt-1 text-[10.5px]">
                page {book.current_page} of {book.page_count} · {Math.round(pct)}%
              </p>
            </>
          )}

          <div className="mt-3 flex gap-1">
            {(["pages", "percent", "page"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-2.5 py-1 text-[9.5px] uppercase tracking-[0.14em] transition-colors",
                  mode === m ? "text-accent border-accent border-b" : "text-chalk-dim hover:text-chalk",
                )}
              >
                {m === "pages" ? "+ pages" : m === "percent" ? "% done" : "on page"}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const n = Number.parseFloat(pages);
              if (!Number.isFinite(n)) return;
              const r = (e.currentTarget as HTMLFormElement).getBoundingClientRect();
              burst(r.left + r.width / 2, r.top + r.height / 2);

              if (mode === "pages") {
                if (n > 0) log.mutate(Math.round(n));
                return;
              }
              // Percent and absolute page both resolve to "move to page X".
              const target =
                mode === "percent" ? percentToPage(n, book.page_count) : Math.round(n);
              if (target === null) {
                toast.error("Add a page count first");
                return;
              }
              jump.mutate(target);
            }}
            className="mt-2 flex gap-2"
          >
            <input
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              inputMode="decimal"
              placeholder={mode === "percent" ? "%" : mode === "page" ? "Page" : "Pages"}
              className="bg-field text-cream w-20 rounded-sm border border-white/10 px-2.5 py-2 text-[13px] outline-none focus:border-accent/50"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-field text-cream flex-1 rounded-sm border border-white/10 px-2.5 py-2 text-[13px] outline-none focus:border-accent/50"
            />
            <button
              type="submit"
              disabled={log.isPending || jump.isPending || !pages}
              className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-4 text-[10.5px] font-semibold uppercase tracking-[0.15em] disabled:opacity-40"
            >
              Log
            </button>
          </form>

          {/* Live conversion, so the number you type is never ambiguous. */}
          {book.page_count && pages && Number.isFinite(Number.parseFloat(pages)) && (
            <p className="text-chalk-dim mt-1.5 text-[10.5px]">
              {mode === "percent"
                ? `${Math.round(Number.parseFloat(pages))}% = page ${percentToPage(Number.parseFloat(pages), book.page_count)} of ${book.page_count}`
                : mode === "page"
                  ? `page ${Math.round(Number.parseFloat(pages))} = ${Math.round(pageToPercent(Number.parseFloat(pages), book.page_count) ?? 0)}%`
                  : `+${Math.round(Number.parseFloat(pages))} pages → page ${Math.min(book.page_count, book.current_page + Math.round(Number.parseFloat(pages)))}`}
            </p>
          )}

          {/* Quick taps: the common case shouldn't need the keyboard. */}
          {mode === "pages" && (
            <div className="mt-2 flex gap-1.5">
              {[10, 20, 25, 50].map((n) => (
                <button
                  key={n}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    burst(r.left + r.width / 2, r.top + r.height / 2);
                    log.mutate(n);
                  }}
                  className="bg-field text-chalk hover:text-cream flex-1 rounded-sm border border-white/10 py-1.5 text-[11px] transition hover:border-accent/50"
                >
                  +{n}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="mb-4">
          <span className="label-caps">Tags</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {book.tags.map((t) => (
              <span
                key={t}
                className="bg-panel text-chalk flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px]"
              >
                {t}
                <button
                  onClick={() => patch.mutate({ tags: book.tags.filter((x) => x !== t) })}
                  className="hover:text-alert"
                  aria-label={`Remove ${t}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const t = tagDraft.trim();
              if (!t || book.tags.includes(t)) return;
              patch.mutate({ tags: [...book.tags, t] });
              setTagDraft("");
            }}
            className="mt-2"
          >
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder="Add a tag and press Enter"
              className="bg-panel text-cream w-full rounded-sm border border-white/10 px-3 py-2 text-[12.5px] outline-none focus:border-accent/50"
            />
          </form>
        </div>

        {/* Review */}
        <label className="mb-4 block">
          <span className="label-caps">Notes</span>
          <textarea
            defaultValue={book.review ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (book.review ?? "")) patch.mutate({ review: e.target.value });
            }}
            rows={4}
            placeholder="What did you think?"
            className="bg-panel text-cream mt-1.5 w-full resize-y rounded-sm border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-accent/50"
          />
        </label>

        {book.description && (
          <details className="mb-4">
            <summary className="label-caps cursor-pointer">Description</summary>
            <p className="text-chalk mt-2 text-[12.5px] leading-relaxed">{book.description}</p>
          </details>
        )}

        <button
          onClick={async () => {
            if (!confirm(`Delete "${book.title}"?`)) return;
            await deleteBook(book.id);
            refresh();
            onClose();
          }}
          className="text-chalk-dim hover:text-alert text-[10.5px] uppercase tracking-[0.19em]"
        >
          Delete book
        </button>
      </aside>
    </div>
  );
}

/* ── Add ────────────────────────────────────────────────────────────── */
function AddPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [manual, setManual] = useState({
    title: "",
    authors: "",
    page_count: "",
    finished_at: "",
    status: "read" as ReadStatus,
  });

  const done = () => {
    qc.invalidateQueries({ queryKey: ["books"] });
    onClose();
  };

  const fromUrl = useMutation({
    mutationFn: () => addBookFromUrl(url.trim()),
    onSuccess: (b) => {
      toast.success(`Added "${b.title}"`);
      done();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Lookup failed"),
  });

  const fromForm = useMutation({
    mutationFn: () =>
      createBook({
        title: manual.title.trim(),
        authors: manual.authors.trim() || null,
        page_count: manual.page_count ? Number.parseInt(manual.page_count, 10) : null,
        status: manual.status,
        finished_at: manual.finished_at || null,
        last_date_read: manual.finished_at || null,
        read_count: manual.status === "read" ? 1 : 0,
      }),
    onSuccess: () => {
      toast.success("Book added");
      done();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  const field =
    "bg-panel text-cream w-full rounded-sm border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-accent/50";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-field w-full max-w-lg rounded border border-accent/30 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center">
          <h2 className="font-display text-cream flex-1 text-[22px]">Add a book</h2>
          <button onClick={onClose} className="text-chalk hover:text-cream">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex gap-1">
          {(["url", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1.5 text-[10.5px] uppercase tracking-[0.19em]",
                mode === m ? "text-accent border-accent border-b" : "text-chalk hover:text-cream",
              )}
            >
              {m === "url" ? "From a link" : "By hand"}
            </button>
          ))}
        </div>

        {mode === "url" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) fromUrl.mutate();
            }}
          >
            <div className="bg-panel flex items-center gap-2.5 rounded-sm border border-white/10 px-3">
              <Link2 size={15} className="text-chalk-dim shrink-0" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a Barnes & Noble, Amazon or Open Library link"
                className="placeholder:text-chalk-dim flex-1 bg-transparent py-2.5 text-[13px] outline-none"
              />
            </div>
            <p className="text-chalk-dim mt-2 text-[11px] leading-relaxed">
              The cover and details are copied into your own library, so the entry keeps working
              even if the link dies.
            </p>
            <button
              type="submit"
              disabled={fromUrl.isPending || !url.trim()}
              className="from-accent-deep to-accent-dark text-cream mt-4 w-full rounded-sm bg-gradient-to-b py-2.5 text-[11px] font-semibold uppercase tracking-[0.20em] disabled:opacity-40"
            >
              {fromUrl.isPending ? "Looking it up…" : "Add book"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.title.trim()) fromForm.mutate();
            }}
            className="flex flex-col gap-3"
          >
            <input
              value={manual.title}
              onChange={(e) => setManual({ ...manual, title: e.target.value })}
              placeholder="Title"
              className={field}
            />
            <input
              value={manual.authors}
              onChange={(e) => setManual({ ...manual, authors: e.target.value })}
              placeholder="Author"
              className={field}
            />
            <div className="flex gap-3">
              <input
                value={manual.page_count}
                onChange={(e) => setManual({ ...manual, page_count: e.target.value })}
                inputMode="numeric"
                placeholder="Pages"
                className={cn(field, "w-24")}
              />
              <select
                value={manual.status}
                onChange={(e) => setManual({ ...manual, status: e.target.value as ReadStatus })}
                className={field}
              >
                {SHELVES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="block">
              <span className="label-caps">Finished on (for books you missed)</span>
              <input
                type="date"
                value={manual.finished_at}
                onChange={(e) => setManual({ ...manual, finished_at: e.target.value })}
                className={cn(field, "mt-1.5")}
              />
            </label>
            <button
              type="submit"
              disabled={fromForm.isPending || !manual.title.trim()}
              className="from-accent-deep to-accent-dark text-cream mt-1 rounded-sm bg-gradient-to-b py-2.5 text-[11px] font-semibold uppercase tracking-[0.20em] disabled:opacity-40"
            >
              Add book
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Import (first run) ─────────────────────────────────────────────── */
function ImportPanel({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const importer = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      return importStoryGraphCsv(text, (d, t) =>
        setProgress(`${d.toLocaleString()} of ${t.toLocaleString()}`),
      );
    },
    onSuccess: (r) => {
      setProgress(null);
      toast.success(`Imported ${r.inserted.toLocaleString()} books`);
      onDone();
    },
    onError: (e) => {
      setProgress(null);
      toast.error(e instanceof Error ? e.message : "Import failed");
    },
  });

  return (
    <div className="from-hero-lift to-hero relative overflow-hidden rounded border border-accent/30 bg-gradient-to-br px-8 py-8 text-center">
      <StarField count={30} seed={23} />
      <div className="relative z-10">
        <h2 className="font-display text-cream text-[30px]">Import your library</h2>
        <p className="text-chalk mx-auto mt-2 max-w-md text-sm">
          Export from The StoryGraph (Manage Account → Export StoryGraph Library) and drop the CSV
          here.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importer.mutate(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importer.isPending}
          className="from-accent-deep to-accent-dark text-cream mt-5 inline-flex items-center gap-2.5 rounded-sm bg-gradient-to-b px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.20em] disabled:opacity-50"
        >
          <Upload size={14} />
          {importer.isPending ? (progress ?? "Importing…") : "Choose CSV"}
        </button>
      </div>
    </div>
  );
}


/* ── Now reading hero ───────────────────────────────────────────────── */
function NowReading({ books, onOpen }: { books: Book[]; onOpen: (b: Book) => void }) {
  const reading = books.filter((b) => b.status === "currently-reading");
  if (reading.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {reading.slice(0, 2).map((b) => {
        const cover = coverSrc(b);
        const pct = b.page_count ? Math.min(100, (b.current_page / b.page_count) * 100) : null;
        return (
          <button
            key={b.id}
            onClick={() => onOpen(b)}
            className="from-hero-lift to-hero relative flex items-center gap-5 overflow-hidden rounded border border-accent/30 bg-gradient-to-br p-5 text-left transition hover:border-accent/60 sm:gap-6 sm:p-6"
          >
            <StarField count={22} seed={31} />
            {cover ? (
              <img
                src={cover}
                alt=""
                className="relative z-10 h-28 w-[76px] shrink-0 rounded-sm object-cover shadow-[0_10px_28px_rgba(0,0,0,.55)] sm:h-36 sm:w-24"
              />
            ) : (
              <div className="bg-panel relative z-10 grid h-28 w-[76px] shrink-0 place-items-center rounded-sm sm:h-36 sm:w-24">
                <BookOpen size={22} className="text-chalk-dim" />
              </div>
            )}

            <div className="relative z-10 min-w-0 flex-1">
              <div className="rule-head mb-1.5">Now reading</div>
              <h2 className="font-display text-cream truncate text-[22px] leading-tight sm:text-[28px]">
                {b.title}
              </h2>
              <p className="text-chalk mt-1 truncate text-[12.5px]">{b.authors}</p>

              {pct !== null ? (
                <>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-white/10">
                    <div
                      className="from-accent-deep to-accent h-full bg-gradient-to-r transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-chalk-dim mt-1.5 text-[10.5px] uppercase tracking-[0.14em]">
                    page {b.current_page} of {b.page_count} · {Math.round(pct)}% ·{" "}
                    {b.page_count! - b.current_page} to go
                  </p>
                </>
              ) : (
                <p className="text-chalk-dim mt-3 text-[10.5px] uppercase tracking-[0.14em]">
                  add a page count to track progress
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── On Deck ────────────────────────────────────────────────────────── */
function OnDeckStrip({ onOpen }: { onOpen: (b: Book) => void }) {
  const { data } = useQuery({ queryKey: ["on-deck"], queryFn: fetchOnDeck });
  if (!data || data.length === 0) return null;

  return (
    <div>
      <h2 className="rule-head mb-3">On deck</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {data.map((b) => {
          const cover = coverSrc(b);
          return (
            <button
              key={b.id}
              onClick={() => onOpen(b)}
              className="group w-[74px] shrink-0 text-left"
              title={b.title}
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="h-[104px] w-[74px] rounded-sm object-cover shadow-lg transition group-hover:-translate-y-1"
                />
              ) : (
                <div className="bg-panel grid h-[104px] w-[74px] place-items-center rounded-sm transition group-hover:-translate-y-1">
                  <BookOpen size={16} className="text-chalk-dim" />
                </div>
              )}
              <p className="text-chalk mt-1.5 line-clamp-2 text-[10.5px] leading-tight">{b.title}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Goals ──────────────────────────────────────────────────────────── */
function GoalCard({ books }: { books: Book[] }) {
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const { data: goal } = useQuery({ queryKey: ["goal", year], queryFn: () => fetchGoal(year) });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const done = books.filter((b) => b.finished_at?.startsWith(String(year))).length;
  const target = goal?.target_books ?? null;
  const pct = target ? Math.min(100, (done / target) * 100) : null;

  // Where you should be by today if the year were evenly paced.
  const dayOfYear = Math.floor((Date.now() - new Date(year, 0, 1).getTime()) / 86_400_000) + 1;
  const expected = target ? (target * dayOfYear) / 365 : null;
  const ahead = expected !== null ? done - expected : null;

  const save = useMutation({
    mutationFn: (n: number | null) => saveGoal(year, { target_books: n }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goal", year] });
      setEditing(false);
    },
  });

  return (
    <div>
      <h2 className="rule-head mb-3">{year} goal</h2>

      {target === null || editing ? (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const n = Number.parseInt(draft, 10);
            save.mutate(Number.isFinite(n) && n > 0 ? n : null);
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="numeric"
            placeholder="Books"
            className="bg-panel text-cream w-full rounded-sm border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-accent/50"
          />
          <button className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-4 text-[10.5px] font-semibold uppercase tracking-[0.15em]">
            Set
          </button>
        </form>
      ) : (
        <button onClick={() => { setDraft(String(target)); setEditing(true); }} className="w-full text-left">
          <div className="flex items-baseline gap-2">
            <span className="numeral text-accent text-[34px] leading-none">{done}</span>
            <span className="text-chalk text-[13px]">of {target} books</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-sm bg-white/10">
            <div
              className="from-accent-deep to-accent h-full bg-gradient-to-r transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          {ahead !== null && (
            <p className="text-chalk-dim mt-1.5 text-[10.5px]">
              {ahead >= 0
                ? `${Math.round(ahead)} ahead of pace`
                : `${Math.abs(Math.round(ahead))} behind pace`}
            </p>
          )}
        </button>
      )}
    </div>
  );
}

/* ── Cover backfill ─────────────────────────────────────────────────── */
function CoverBackfill() {
  const qc = useQueryClient();
  const { data: remaining } = useQuery({ queryKey: ["covers-remaining"], queryFn: coversRemaining });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ found: number; left: number } | null>(null);

  async function run() {
    setRunning(true);
    let found = 0;
    try {
      // Loop batches until the server says nothing is left. Bounded so a
      // permanently-failing row can't spin forever.
      for (let i = 0; i < 200; i++) {
        const r = await backfillCoversBatch(25);
        found += r.found;
        setProgress({ found, left: r.remaining });
        if (r.remaining === 0 || r.processed === 0) break;
      }
      toast.success(`Found ${found} covers`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["covers-remaining"] });
      qc.invalidateQueries({ queryKey: ["on-deck"] });
    }
  }

  if (!remaining) return null;

  return (
    <div>
      <h2 className="rule-head mb-2">Covers</h2>
      <p className="text-chalk-dim mb-2 text-[11px] leading-relaxed">
        {remaining.toLocaleString()} books have an ISBN but no cover yet. Roughly 6 in 10 will be
        found.
      </p>
      <button
        onClick={run}
        disabled={running}
        className="bg-panel text-cream flex w-full items-center justify-center gap-2 rounded-sm border border-accent/30 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.15em] transition hover:border-accent disabled:opacity-50"
      >
        <ImageDown size={14} />
        {running
          ? `${progress?.found ?? 0} found · ${progress?.left ?? remaining} left`
          : "Fetch covers"}
      </button>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function ReadingPage() {
  const qc = useQueryClient();
  const { data: books, isLoading, error } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const { data: sessions } = useQuery({ queryKey: ["reading-sessions"], queryFn: fetchSessions });

  const [shelf, setShelf] = useState<ReadStatus>("currently-reading");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [open, setOpen] = useState<Book | null>(null);
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of books ?? []) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [books]);

  const topTags = useMemo(() => {
    const c = new Map<string, number>();
    for (const b of books ?? []) for (const t of b.tags) c.set(t, (c.get(t) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [books]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (books ?? [])
      .filter((b) => b.status === shelf)
      .filter((b) => !tag || b.tags.includes(tag))
      .filter(
        (b) =>
          !needle ||
          b.title.toLowerCase().includes(needle) ||
          (b.authors ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 300);
  }, [books, shelf, q, tag]);

  // Keep the open drawer in sync with refetched data.
  const openBook = open ? ((books ?? []).find((b) => b.id === open.id) ?? open) : null;

  if (error) {
    return (
      <div className="p-7">
        <div className="bg-panel border-alert/40 text-alert rounded border p-4 text-sm">
          Could not load books: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }
  if (isLoading) return <p className="label-caps animate-pulse p-10 text-center">Loading library</p>;
  if ((books ?? []).length === 0) {
    return (
      <div className="p-6 md:p-7">
        <ImportPanel onDone={() => qc.invalidateQueries({ queryKey: ["books"] })} />
      </div>
    );
  }

  return (
    <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[1fr_306px]">
      <div className="flex min-w-0 flex-col gap-5 p-4 md:p-7">
        <NowReading books={books ?? []} onOpen={setOpen} />
        <OnDeckStrip onOpen={setOpen} />

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-panel flex flex-1 items-center gap-2.5 rounded-sm border border-white/10 px-4 focus-within:border-accent/50">
            <Search size={14} className="text-chalk-dim shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title or author"
              className="placeholder:text-chalk-dim flex-1 bg-transparent py-2.5 text-[13px] outline-none"
            />
          </div>
          <button
            onClick={() => setAdding(true)}
            className="from-accent-deep to-accent-dark text-cream flex items-center gap-2 rounded-sm bg-gradient-to-b px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.19em]"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {SHELVES.map((s) => (
            <button
              key={s.key}
              onClick={() => setShelf(s.key)}
              className={cn(
                "px-3 py-1.5 text-[10.5px] uppercase tracking-[0.19em] transition-colors",
                shelf === s.key ? "text-accent border-accent border-b" : "text-chalk hover:text-cream",
              )}
            >
              {s.label} <span className="text-chalk-dim ml-1">{counts[s.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {tag && (
          <button
            onClick={() => setTag(null)}
            className="text-accent self-start text-[11px] uppercase tracking-[0.15em]"
          >
            tag: {tag} ✕
          </button>
        )}

        <div className="bg-panel rounded border border-white/[0.07]">
          {visible.length === 0 ? (
            <p className="text-chalk py-10 text-center text-sm">Nothing on this shelf.</p>
          ) : (
            <ul>
              {visible.map((b) => {
                const cover = coverSrc(b);
                const pct = b.page_count ? (b.current_page / b.page_count) * 100 : null;
                return (
                  <li key={b.id}>
                    <button
                      onClick={() => setOpen(b)}
                      className="flex w-full items-center gap-3.5 border-b border-white/[0.055] px-4 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      {cover ? (
                        <img src={cover} alt="" className="h-11 w-8 shrink-0 rounded-[2px] object-cover" />
                      ) : (
                        <div className="bg-field grid h-11 w-8 shrink-0 place-items-center rounded-[2px]">
                          <BookOpen size={13} className="text-chalk-dim" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px]">{b.title}</p>
                        <p className="text-chalk-dim truncate text-[11px]">
                          {b.authors || "Unknown author"}
                        </p>
                        {pct !== null && b.status === "currently-reading" && (
                          <div className="mt-1 h-1 w-32 overflow-hidden rounded-sm bg-white/10">
                            <div className="bg-accent h-full" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                      {b.star_rating !== null && (
                        <span className="text-accent flex shrink-0 items-center gap-1 text-[11px]">
                          <Star size={11} className="fill-current" />
                          <span className="numeral">{b.star_rating}</span>
                        </span>
                      )}
                      <span className="text-chalk w-[58px] shrink-0 text-right text-[10.5px]">
                        {b.finished_at?.slice(0, 7).replace("-", "/") ?? ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <aside className="bg-ink flex flex-col gap-6 border-accent/15 p-4 md:p-6 lg:border-l">
        <GoalCard books={books ?? []} />
        <CoverBackfill />
        <PagesCalendar sessions={sessions ?? []} />
        <MonthlyStats books={books ?? []} sessions={sessions ?? []} />

        <div>
          <h2 className="rule-head mb-3">Tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {topTags.map(([t, n]) => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? null : t)}
                className={cn(
                  "rounded-sm px-2 py-1 text-[10.5px] transition-colors",
                  tag === t ? "bg-accent text-field" : "bg-panel text-chalk hover:text-cream",
                )}
              >
                {t} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {openBook && <BookDetail book={openBook} onClose={() => setOpen(null)} />}
      {adding && <AddPanel onClose={() => setAdding(false)} />}
    </div>
  );
}
