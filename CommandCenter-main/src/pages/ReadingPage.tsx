import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Search,
  Star,
  Link2,
  Plus,
  X,
  BookOpen,
  ImageDown,
  Bookmark,
  Sparkles,
  LayoutGrid,
  Rows3,
  Highlighter,
  RefreshCw,
  Wand2,
  Send,
  Layers,
  Maximize2,
  ChartColumn,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  fetchBooks,
  fetchSessions,
  importStoryGraphCsv,
  repairMisfiledReads,
  updateBook,
  createBook,
  deleteBook,
  addBookFromUrl,
  logPages,
  finishBook,
  coverSrc,
  backfillCoversBatch,
  fetchOnDeck,
  setOnDeck,
  fetchGoal,
  saveGoal,
  setProgress,
  percentToPage,
  pageToPercent,
  enrichRemaining,
  enrichBook,
  syncReadwise,
  askAI,
  browseNewPopular,
  type BrowseShelf,
  pagesContributions,
  finishedContributions,
  periodBounds,
  pullCover,
  classifyBatch,
  unclassifiedCount,
  titleKey,
  findDuplicateBooks,
  mergeBooks,
  type Suggestion,
  fetchHighlights,
  fetchHighlightCounts,
  readwiseSyncedAt,
  fetchBookSessions,
  fetchEditions,
  type Edition,
  applyEdition,
  addSession,
  updateSession,
  deleteSession,
  recalcProgress,
  addReadThrough,
  updateReadThrough,
  removeReadThrough,
  duplicateIndexes,
  sortReadLog,
  type ReadThrough,
  periodStats,
  fetchDailyGoal,
  saveDailyGoal,
  dailyProgress,
  topReadingDays,
  buildFinishCard,
  type ReadingSession,
} from "@/lib/books";
import StarField from "@/components/StarField";
import HighlightCard from "@/components/HighlightCard";
import { useCelebration } from "@/components/celebration-context";
import { cn, todayStr, fmtLongDate } from "@/lib/utils";
import type { Book, BookHighlight, ReadStatus } from "@/types";

const SHELVES: { key: ReadStatus; label: string }[] = [
  { key: "currently-reading", label: "Reading" },
  { key: "to-read", label: "To read" },
  { key: "read", label: "Read" },
  { key: "did-not-finish", label: "DNF" },
  { key: "paused", label: "Paused" },
];

/** One filter across the whole library, so any value on screen can link to it. */
type Filter = {
  type: "author" | "tag" | "year" | "series" | "fiction";
  value: string;
};

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
      // Local parts, not toISOString(): that converts to UTC and shifts the
      // day for anything after ~7pm Central.
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
                  title={`${fmtLongDate(d.date)}: ${d.pages} page${d.pages === 1 ? "" : "s"}`}
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
function MonthlyStats({
  books,
  sessions,
  onDrill,
}: {
  books: Book[];
  sessions: ReadingSession[];
  onDrill: (period: string) => void;
}) {
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
          <button
            key={i}
            onClick={() => onDrill(`${year}-${String(i + 1).padStart(2, "0")}`)}
            disabled={n === 0}
            className="flex flex-1 flex-col items-center gap-1 disabled:cursor-default"
          >
            <div
              className="from-accent-deep to-accent w-full rounded-sm bg-gradient-to-t"
              style={{ height: `${Math.max(2, (n / maxBooks) * 68)}px` }}
              title={`${MONTHS[i]} ${year}: ${n} books · ${(rows.loggedPages[i] + rows.estimatedPages[i]).toLocaleString()} pages`}
            />
            <span className="text-chalk-dim text-[8.5px]">{MONTHS[i][0]}</span>
          </button>
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


/* ── Inline edit ────────────────────────────────────────────────────── */
/**
 * Click (or tap) a value to edit it in place. Enter or blur commits, Escape
 * reverts — no separate edit mode for the whole record just to fix an author.
 */
/**
 * Fiction is auto-pulled — shown as a chip, not a form control. Single click
 * filters the library; double-click cycles Fiction → Non-fiction → unset.
 * A short delay keeps the first half of a double-click from closing the drawer.
 */
function FictionLabel({
  fiction,
  onFilter,
  onCorrect,
}: {
  fiction: boolean | null;
  onFilter: () => void;
  onCorrect: (next: boolean | null) => void;
}) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <button
      type="button"
      onClick={() => {
        if (fiction === null) return;
        if (clickTimer.current) clearTimeout(clickTimer.current);
        clickTimer.current = setTimeout(() => {
          clickTimer.current = null;
          onFilter();
        }, 280);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
        }
        // Cycle Fiction → Non-fiction → unset (enrich/classify can refill unset).
        const next = fiction === true ? false : fiction === false ? null : true;
        onCorrect(next);
      }}
      title={
        fiction === null
          ? "Double-click to set"
          : "Click to browse · double-click to correct"
      }
      className={cn(
        "-mx-1 rounded-sm px-1 transition-colors hover:bg-white/10",
        fiction === null ? "text-chalk-dim/60" : "text-chalk-dim hover:text-accent",
      )}
    >
      {fiction === null ? "—" : fiction ? "Fiction" : "Non-fiction"}
    </button>
  );
}

function Editable({
  value,
  onSave,
  placeholder = "—",
  numeric = false,
  className,
  inputClassName,
  doubleClick = false,
  onSingleClick,
}: {
  value: string | number | null;
  onSave: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  className?: string;
  inputClassName?: string;
  /** Require a double click to edit, leaving single click free for navigation. */
  doubleClick?: boolean;
  onSingleClick?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        inputMode={numeric ? "numeric" : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== String(value ?? "")) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(String(value ?? ""));
            setEditing(false);
          }
        }}
        className={cn(
          "bg-field text-cream rounded-sm border border-accent/50 px-2 py-1 text-[13px] outline-none",
          inputClassName,
        )}
      />
    );
  }

  return (
    <button
      onClick={() => {
        if (doubleClick) {
          onSingleClick?.();
          return;
        }
        setDraft(String(value ?? ""));
        setEditing(true);
      }}
      onDoubleClick={() => {
        setDraft(String(value ?? ""));
        setEditing(true);
      }}
      title={doubleClick ? "Click to browse · double-click to edit" : "Click to edit"}
      className={cn(
        "-mx-1 rounded-sm px-1 text-left transition-colors hover:bg-white/10",
        value === null || value === "" ? "text-chalk-dim" : "",
        className,
      )}
    >
      {value === null || value === "" ? placeholder : value}
    </button>
  );
}

/* ── Tag input with suggestions ─────────────────────────────────────── */
function TagInput({
  existing,
  current,
  onAdd,
}: {
  existing: string[];
  current: string[];
  onAdd: (t: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return existing
      .filter((t) => !current.includes(t) && t.toLowerCase().includes(q))
      .slice(0, 8);
  }, [draft, existing, current]);

  const commit = (t: string) => {
    const v = t.trim();
    if (v && !current.includes(v)) onAdd(v);
    setDraft("");
  };

  return (
    <div className="relative mt-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Enter takes the top suggestion when there is one, so existing
            // tags win over accidentally creating a near-duplicate.
            commit(matches[0] ?? draft);
          }
        }}
        placeholder="Add a tag"
        className="bg-panel text-cream w-full rounded-sm border border-white/10 px-3 py-2 text-[12.5px] outline-none focus:border-accent/50"
      />
      {matches.length > 0 && (
        <div className="bg-panel absolute z-20 mt-1 w-full overflow-hidden rounded-sm border border-accent/30 shadow-xl">
          {matches.map((t) => (
            <button
              key={t}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(t);
              }}
              className="text-chalk hover:bg-accent/20 hover:text-cream block w-full px-3 py-1.5 text-left text-[12px]"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ── Search ─────────────────────────────────────────────────────────── */
/**
 * Library hits first, then a free Google Books / Open Library catalog search
 * so you can find books you don’t own yet without opening Ask AI.
 */
/** Score library rows for a search needle (shared by dropdown + full page). */
function searchLibrary(books: Book[], raw: string, limit = 40): Book[] {
  const needle = raw.trim().toLowerCase();
  if (needle.length < 2) return [];
  const scored: { b: Book; score: number }[] = [];
  for (const b of books) {
    const title = b.title.toLowerCase();
    const author = (b.authors ?? "").toLowerCase();
    let score = -1;
    if (title.startsWith(needle)) score = 0;
    else if (title.includes(needle)) score = 1;
    else if (author.includes(needle)) score = 2;
    else if (b.tags.some((t) => t.toLowerCase().includes(needle))) score = 3;
    if (score >= 0) scored.push({ b, score });
  }
  return scored.sort((x, y) => x.score - y.score).slice(0, limit).map((x) => x.b);
}

function LibrarySearch({
  books,
  onOpen,
  onFullSearch,
}: {
  books: Book[];
  onOpen: (b: Book) => void;
  onFullSearch: (q: string) => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const owned = useMemo(() => {
    const m = new Map<string, Book>();
    for (const b of books) {
      const k = titleKey(b.title);
      if (k && !m.has(k)) m.set(k, b);
    }
    return m;
  }, [books]);

  const library = useMemo(() => searchLibrary(books, q, 6), [q, books]);

  const catalog = useQuery({
    queryKey: ["catalog-search", debounced],
    queryFn: () => askAI("catalog", debounced),
    enabled: debounced.length >= 2 && focused,
    staleTime: 60_000,
  });

  const catalogHits = useMemo(() => {
    const rows = catalog.data ?? [];
    return rows.filter((s) => !owned.has(titleKey(s.title))).slice(0, 6);
  }, [catalog.data, owned]);

  const add = useMutation({
    mutationFn: async (s: Suggestion) => {
      const year = Number.parseInt(s.year, 10);
      const book = await createBook({
        title: s.title,
        authors: s.author || null,
        status: "to-read",
        published_year: Number.isFinite(year) ? year : null,
      });
      await enrichBook(book.id).catch(() => {});
      return book;
    },
    onSuccess: (book) => {
      qc.invalidateQueries({ queryKey: ["books"] });
      toast.success(`Added ${book.title}`);
      setQ("");
      onOpen(book);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  const show = focused && q.trim().length >= 2;
  const empty =
    library.length === 0 && !catalog.isFetching && catalogHits.length === 0 && !catalog.isError;

  return (
    <div className="relative flex-1">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const needle = q.trim();
          if (needle.length < 2) return;
          setFocused(false);
          onFullSearch(needle);
        }}
      >
        <div className="bg-panel flex items-center gap-2.5 rounded-sm border border-white/10 px-4 focus-within:border-accent/50">
          <Search size={14} className="text-chalk-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 180)}
            placeholder="Search library or find a book"
            className="placeholder:text-chalk-dim flex-1 bg-transparent py-2.5 text-[13px] outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="text-chalk-dim hover:text-cream"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </form>

      {show && (
        <div className="bg-panel absolute z-30 mt-1 max-h-[70vh] w-full overflow-y-auto rounded border border-accent/30 shadow-2xl">
          {library.length > 0 && (
            <div>
              <p className="text-chalk-dim px-3 pt-2.5 pb-1 text-[9.5px] uppercase tracking-[0.16em]">
                Your library
              </p>
              {library.map((b) => {
                const cover = coverSrc(b);
                return (
                  <button
                    key={b.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onOpen(b);
                      setQ("");
                    }}
                    className="hover:bg-accent/15 flex w-full items-center gap-3 border-b border-white/[0.05] px-3 py-2 text-left last:border-0"
                  >
                    {cover ? (
                      <img src={cover} alt="" className="h-10 w-7 shrink-0 rounded-[2px] object-cover" />
                    ) : (
                      <div className="bg-field grid h-10 w-7 shrink-0 place-items-center rounded-[2px]">
                        <BookOpen size={11} className="text-chalk-dim" />
                      </div>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="text-cream block truncate text-[12.5px]">{b.title}</span>
                      <span className="text-chalk-dim block truncate text-[10.5px]">
                        {b.authors || "Unknown author"}
                      </span>
                    </span>
                    <span className="text-chalk-dim shrink-0 text-[9.5px] uppercase tracking-[0.12em]">
                      {SHELVES.find((sh) => sh.key === b.status)?.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <p className="text-chalk-dim px-3 pt-2.5 pb-1 text-[9.5px] uppercase tracking-[0.16em]">
              Catalog · free
              {catalog.isFetching ? " · searching…" : ""}
            </p>
            {catalog.isError && (
              <p className="text-alert px-3 py-2 text-[12px]">
                {catalog.error instanceof Error ? catalog.error.message : "Catalog search failed"}
              </p>
            )}
            {catalogHits.map((s) => (
              <button
                key={`${s.title}-${s.author}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add.mutate(s)}
                disabled={add.isPending}
                className="hover:bg-accent/10 flex w-full items-center gap-3 border-b border-white/[0.05] px-3 py-2 text-left last:border-0 disabled:opacity-50"
              >
                {s.cover_url ? (
                  <img
                    src={s.cover_url}
                    alt=""
                    className="h-10 w-7 shrink-0 rounded-[2px] object-cover"
                  />
                ) : (
                  <div className="bg-field grid h-10 w-7 shrink-0 place-items-center rounded-[2px]">
                    <BookOpen size={11} className="text-chalk-dim" />
                  </div>
                )}
                <span className="min-w-0 flex-1">
                  <span className="text-cream block truncate text-[12.5px]">{s.title}</span>
                  <span className="text-chalk-dim block truncate text-[10.5px]">
                    {s.author || "Unknown author"}
                    {s.year ? ` · ${s.year}` : ""}
                  </span>
                </span>
                <span className="text-accent shrink-0 text-[10px] uppercase tracking-[0.14em]">
                  {add.isPending ? "…" : "Add"}
                </span>
              </button>
            ))}
            {!catalog.isFetching && catalogHits.length === 0 && library.length > 0 && (
              <p className="text-chalk-dim px-3 py-2 text-[11.5px]">No new catalog matches.</p>
            )}
          </div>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onFullSearch(q.trim());
              setQ("");
            }}
            className="text-accent hover:bg-accent/10 flex w-full items-center justify-center gap-2 px-3 py-2.5 text-[10.5px] uppercase tracking-[0.15em]"
          >
            <Search size={12} />
            See all results
          </button>

          {empty && <p className="text-chalk-dim px-4 py-3 text-[12px]">No matches.</p>}
        </div>
      )}
    </div>
  );
}

/* ── Full-page search ───────────────────────────────────────────────── */
function SearchResultsPage({
  query,
  books,
  onClose,
  onOpen,
}: {
  query: string;
  books: Book[];
  onClose: () => void;
  onOpen: (b: Book) => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState(query);

  const owned = useMemo(() => {
    const m = new Map<string, Book>();
    for (const b of books) {
      const k = titleKey(b.title);
      if (k && !m.has(k)) m.set(k, b);
    }
    return m;
  }, [books]);

  const library = useMemo(() => searchLibrary(books, q, 80), [q, books]);

  const catalog = useQuery({
    queryKey: ["catalog-search-full", q.trim()],
    queryFn: () => askAI("catalog", q.trim()),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });

  const catalogHits = useMemo(() => {
    return (catalog.data ?? []).filter((s) => !owned.has(titleKey(s.title)));
  }, [catalog.data, owned]);

  const add = useMutation({
    mutationFn: async (s: Suggestion) => {
      const year = Number.parseInt(s.year, 10);
      const book = await createBook({
        title: s.title,
        authors: s.author || null,
        status: "to-read",
        published_year: Number.isFinite(year) ? year : null,
      });
      await enrichBook(book.id).catch(() => {});
      return book;
    },
    onSuccess: (book) => {
      qc.invalidateQueries({ queryKey: ["books"] });
      toast.success(`Added ${book.title}`);
      onOpen(book);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="bg-field h-full w-full max-w-lg overflow-y-auto overscroll-contain border-l border-accent/25 p-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-cream text-[23px] leading-tight">
              Search <span className="text-accent">results</span>
            </h2>
            <p className="text-chalk-dim mt-1 text-[11.5px]">Your library, then free catalogs.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-chalk hover:text-cream shrink-0 rounded-full p-1.5"
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
          }}
          className="mb-5"
        >
          <div className="bg-panel flex items-center gap-2.5 rounded-sm border border-white/10 px-4 focus-within:border-accent/50">
            <Search size={14} className="text-chalk-dim shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              className="placeholder:text-chalk-dim flex-1 bg-transparent py-2.5 text-[13px] outline-none"
            />
          </div>
        </form>

        <section className="mb-6">
          <h3 className="rule-head mb-3">
            Your library <span className="text-chalk-dim normal-case tracking-normal">· {library.length}</span>
          </h3>
          {library.length === 0 ? (
            <p className="text-chalk-dim text-[12px]">No library matches.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {library.map((b) => {
                const cover = coverSrc(b);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onOpen(b);
                        onClose();
                      }}
                      className="hover:bg-accent/10 flex w-full items-center gap-3 rounded border border-white/[0.06] px-3 py-2.5 text-left"
                    >
                      {cover ? (
                        <img src={cover} alt="" className="h-14 w-9 shrink-0 rounded-[2px] object-cover" />
                      ) : (
                        <div className="bg-panel grid h-14 w-9 shrink-0 place-items-center rounded-[2px]">
                          <BookOpen size={13} className="text-chalk-dim" />
                        </div>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="text-cream block text-[13.5px] leading-snug">{b.title}</span>
                        <span className="text-chalk-dim mt-0.5 block text-[11px]">
                          {b.authors || "Unknown author"}
                          {" · "}
                          {SHELVES.find((sh) => sh.key === b.status)?.label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3 className="rule-head mb-3">
            Catalog · free
            {catalog.isFetching ? (
              <span className="text-chalk-dim normal-case tracking-normal"> · searching…</span>
            ) : (
              <span className="text-chalk-dim normal-case tracking-normal">
                {" "}
                · {catalogHits.length}
              </span>
            )}
          </h3>
          {catalog.isError && (
            <p className="text-alert text-[12px]">
              {catalog.error instanceof Error ? catalog.error.message : "Catalog search failed"}
            </p>
          )}
          {!catalog.isFetching && catalogHits.length === 0 && (
            <p className="text-chalk-dim text-[12px]">No catalog matches.</p>
          )}
          <ul className="flex flex-col gap-2">
            {catalogHits.map((s) => (
              <li key={`${s.title}-${s.author}`}>
                <button
                  type="button"
                  onClick={() => add.mutate(s)}
                  disabled={add.isPending}
                  className="bg-panel hover:bg-accent/10 hover:border-accent/40 flex w-full items-center gap-3 rounded border border-white/[0.06] px-3 py-2.5 text-left transition disabled:opacity-50"
                >
                  {s.cover_url ? (
                    <img
                      src={s.cover_url}
                      alt=""
                      className="h-14 w-9 shrink-0 rounded-[2px] object-cover"
                    />
                  ) : (
                    <div className="bg-field grid h-14 w-9 shrink-0 place-items-center rounded-[2px]">
                      <BookOpen size={13} className="text-chalk-dim" />
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="text-cream block text-[13.5px] leading-snug">{s.title}</span>
                    <span className="text-chalk-dim mt-0.5 block text-[11px]">
                      {s.author || "Unknown author"}
                      {s.year ? ` · ${s.year}` : ""}
                    </span>
                  </span>
                  <span className="text-accent shrink-0 text-[10.5px] uppercase tracking-[0.14em]">
                    {add.isPending ? "…" : "Add"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

/* ── Reading history ────────────────────────────────────────────────── */
function ReadingHistory({ book }: { book: Book }) {
  const qc = useQueryClient();
  const { data: sessions } = useQuery({
    queryKey: ["book-sessions", book.id],
    queryFn: () => fetchBookSessions(book.id),
  });

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: todayStr(), pages: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ date: "", pages: "" });
  const [addingRead, setAddingRead] = useState(false);
  const [readDraft, setReadDraft] = useState({ start: "", end: todayStr() });
  const [editingRead, setEditingRead] = useState<number | null>(null);
  const [readEdit, setReadEdit] = useState({ start: "", end: "" });

  const log = useMemo(() => sortReadLog(book.read_log ?? []), [book.read_log]);
  const dupes = useMemo(() => duplicateIndexes(log), [log]);

  const refreshBook = () => {
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["on-deck"] });
  };

  const addRead = useMutation({
    mutationFn: (entry: ReadThrough) => addReadThrough({ ...book, read_log: log }, entry),
    onSuccess: () => {
      setAddingRead(false);
      setReadDraft({ start: "", end: todayStr() });
      refreshBook();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  const saveRead = useMutation({
    mutationFn: ({ index, entry }: { index: number; entry: ReadThrough }) =>
      updateReadThrough({ ...book, read_log: log }, index, entry),
    onSuccess: () => {
      setEditingRead(null);
      refreshBook();
    },
  });

  const removeRead = useMutation({
    mutationFn: (index: number) => removeReadThrough({ ...book, read_log: log }, index),
    onSuccess: refreshBook,
  });

  const refresh = async () => {
    await recalcProgress(book.id);
    qc.invalidateQueries({ queryKey: ["book-sessions", book.id] });
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["reading-sessions"] });
  };

  const add = useMutation({
    mutationFn: () =>
      addSession({
        bookId: book.id,
        date: draft.date,
        pages: Number.parseInt(draft.pages, 10) || 0,
      }),
    onSuccess: async () => {
      setDraft({ date: todayStr(), pages: "" });
      setAdding(false);
      await refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  const save = useMutation({
    mutationFn: (id: string) =>
      updateSession(id, {
        session_date: edit.date,
        pages_read: Number.parseInt(edit.pages, 10) || 0,
      }),
    onSuccess: async () => {
      setEditingId(null);
      await refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: refresh,
  });

  const field =
    "bg-field text-cream rounded-sm border border-white/10 px-2 py-1 text-[12px] outline-none focus:border-accent/50";

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center">
        <span className="label-caps flex-1">Times read · {log.length}</span>
        <button
          onClick={() => setAddingRead(!addingRead)}
          className="text-accent text-[10.5px] uppercase tracking-[0.15em]"
        >
          {addingRead ? "cancel" : "+ add a read"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (Number.parseInt(draft.pages, 10) > 0) add.mutate();
          }}
          className="mb-3 flex gap-2"
        >
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className={cn(field, "flex-1")}
          />
          <input
            value={draft.pages}
            onChange={(e) => setDraft({ ...draft, pages: e.target.value })}
            inputMode="numeric"
            placeholder="Pages"
            className={cn(field, "w-20")}
          />
          <button className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
            Add
          </button>
        </form>
      )}

      {/* Times read — each deletable, which is how a duplicate goes away. */}
      <div className="mb-4">
        {addingRead && (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!readDraft.end) return;
              addRead.mutate({ start: readDraft.start || null, end: readDraft.end });
            }}
            className="mb-2 flex flex-wrap items-end gap-2"
          >
            <label className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
              Started
              <input
                type="date"
                value={readDraft.start}
                onChange={(e) => setReadDraft({ ...readDraft, start: e.target.value })}
                className={cn(field, "mt-0.5 block")}
              />
            </label>
            <label className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
              Finished
              <input
                type="date"
                required
                value={readDraft.end}
                onChange={(e) => setReadDraft({ ...readDraft, end: e.target.value })}
                className={cn(field, "mt-0.5 block")}
              />
            </label>
            <button className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
              Add
            </button>
          </form>
        )}

        {log.length === 0 ? (
          <p className="text-chalk-dim text-[12px]">Not recorded as read yet.</p>
        ) : (
          <ul>
            {log.map((entry, i) => (
              <li
                key={`${entry.start}-${entry.end}-${i}`}
                className={cn(
                  "group flex items-center gap-2 border-b border-white/[0.05] py-1.5 text-[12px] last:border-0",
                  dupes.has(i) && "bg-alert/10",
                )}
              >
                {editingRead === i ? (
                  <>
                    <input
                      type="date"
                      value={readEdit.start}
                      onChange={(e) => setReadEdit({ ...readEdit, start: e.target.value })}
                      className={cn(field, "flex-1")}
                    />
                    <input
                      type="date"
                      value={readEdit.end}
                      onChange={(e) => setReadEdit({ ...readEdit, end: e.target.value })}
                      className={cn(field, "flex-1")}
                    />
                    <button
                      onClick={() =>
                        saveRead.mutate({
                          index: i,
                          entry: { start: readEdit.start || null, end: readEdit.end || null },
                        })
                      }
                      className="text-accent text-[10px] uppercase"
                    >
                      save
                    </button>
                    <button
                      onClick={() => setEditingRead(null)}
                      className="text-chalk-dim text-[10px] uppercase"
                    >
                      cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingRead(i);
                        setReadEdit({ start: entry.start ?? "", end: entry.end ?? "" });
                      }}
                      className="text-chalk hover:text-cream flex-1 text-left"
                    >
                      {entry.start && entry.end && entry.start !== entry.end
                        ? `${fmtLongDate(entry.start)} – ${fmtLongDate(entry.end)}`
                        : fmtLongDate(entry.end ?? entry.start) || "Date unknown"}
                    </button>
                    {dupes.has(i) && (
                      <span className="text-alert text-[9.5px] uppercase tracking-[0.12em]">
                        duplicate
                      </span>
                    )}
                    <button
                      onClick={() => {
                        const when =
                          entry.start && entry.end && entry.start !== entry.end
                            ? `${fmtLongDate(entry.start)} – ${fmtLongDate(entry.end)}`
                            : fmtLongDate(entry.end ?? entry.start) || "this read";
                        // Deleting a read-through changes the count and the
                        // finish date, so it always asks first.
                        if (confirm(`Delete the read from ${when}?`)) removeRead.mutate(i);
                      }}
                      aria-label="Delete this read"
                      title="Delete this read"
                      className="text-chalk-dim hover:text-alert opacity-60 transition group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {sessions && sessions.length > 0 && book.status === "read" && (
        <details className="mt-1">
          <summary className="text-chalk-dim cursor-pointer text-[10.5px] uppercase tracking-[0.14em]">
            {sessions.length} day{sessions.length === 1 ? "" : "s"} of page logs
          </summary>
          <ul className="mt-1">
            {sessions.slice(0, 40).map((sess) => (
              <li
                key={sess.id}
                className="flex items-center justify-between border-b border-white/[0.05] py-1 text-[11.5px] last:border-0"
              >
                <span className="text-chalk-dim">{fmtLongDate(sess.session_date)}</span>
                <span className="numeral text-chalk">{sess.pages_read}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {sessions && sessions.length > 0 && book.status !== "read" && (
        <>
        <div className="mb-2 mt-4 flex items-center">
          <span className="label-caps flex-1">Page sessions</span>
          <button
            onClick={() => setAdding(!adding)}
            className="text-accent text-[10.5px] uppercase tracking-[0.15em]"
          >
            {adding ? "cancel" : "+ add"}
          </button>
        </div>
        <ul>
          {sessions.map((sess) => (
            <li key={sess.id} className="border-b border-white/[0.05] py-1.5 last:border-0">
              {editingId === sess.id ? (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={edit.date}
                    onChange={(e) => setEdit({ ...edit, date: e.target.value })}
                    className={cn(field, "flex-1")}
                  />
                  <input
                    value={edit.pages}
                    onChange={(e) => setEdit({ ...edit, pages: e.target.value })}
                    inputMode="numeric"
                    className={cn(field, "w-16")}
                  />
                  <button
                    onClick={() => save.mutate(sess.id)}
                    className="text-accent text-[10px] uppercase tracking-[0.12em]"
                  >
                    save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]"
                  >
                    cancel
                  </button>
                </div>
              ) : (
                <div className="group flex items-center gap-2 text-[12px]">
                  <button
                    onClick={() => {
                      setEditingId(sess.id);
                      setEdit({ date: sess.session_date, pages: String(sess.pages_read) });
                    }}
                    className="text-chalk hover:text-cream flex-1 text-left"
                  >
                    {fmtLongDate(sess.session_date)}
                  </button>
                  <span className="numeral text-accent">{sess.pages_read} pages</span>
                  <button
                    onClick={() => remove.mutate(sess.id)}
                    aria-label="Delete entry"
                    className="text-chalk-dim hover:text-alert opacity-0 transition group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        </>
      )}

      {(!sessions || sessions.length === 0) && !adding && (
        <p className="text-chalk-dim text-[12px]">No page sessions logged.</p>
      )}
    </div>
  );
}

/* ── Other editions ─────────────────────────────────────────────────── */
function Editions({ book, onApplied }: { book: Book; onApplied: () => void }) {
  const [open, setOpen] = useState(true);
  const { data, isLoading } = useQuery({
    queryKey: ["editions", book.isbn],
    queryFn: () => fetchEditions(book.isbn ?? ""),
    enabled: open && Boolean(book.isbn),
  });

  if (!book.isbn) return null;

  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)} className="label-caps hover:text-cream">
        {open ? "▾" : "▸"} Other editions
      </button>

      {open && (
        <div className="mt-2">
          {isLoading && <p className="text-chalk-dim text-[12px]">Looking…</p>}
          {data && data.length === 0 && (
            <p className="text-chalk-dim text-[12px]">No other editions found.</p>
          )}
          {data?.map((e: Edition) => (
            <div
              key={e.key}
              className="flex items-center gap-3 border-b border-white/[0.05] py-2 last:border-0"
            >
              {e.cover_id ? (
                <img
                  src={`https://covers.openlibrary.org/b/id/${e.cover_id}-S.jpg`}
                  alt=""
                  className="h-11 w-8 shrink-0 rounded-[2px] object-cover"
                />
              ) : (
                <div className="bg-panel h-11 w-8 shrink-0 rounded-[2px]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-cream truncate text-[12px]">{e.publishers[0] ?? "Unknown"}</p>
                <p className="text-chalk-dim text-[10.5px]">
                  {e.publish_date ?? "—"}
                  {e.number_of_pages ? ` · ${e.number_of_pages}p` : ""}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    const r = await applyEdition(book, e);
                    onApplied();
                    toast.success(
                      r.coverApplied ? "Edition and cover applied" : "Edition applied",
                    );
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not apply");
                  }
                }}
                className="bg-panel text-chalk hover:text-accent shrink-0 rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.1em]"
              >
                Use this
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Book detail ────────────────────────────────────────────────────── */
/* ── Highlights ─────────────────────────────────────────────────────── */
/** Readwise highlights for one book. Silent when there are none. */
function Highlights({ book }: { book: Book }) {
  const { data, isLoading } = useQuery({
    queryKey: ["highlights", book.id],
    queryFn: () => fetchHighlights(book.id),
  });
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  if (isLoading || !data || data.length === 0) return null;

  // Long lists are a wall of text in a drawer; the rest is one tap away.
  const shown: BookHighlight[] = showAll ? data : data.slice(0, 5);
  const cover = coverSrc(book);

  return (
    <div className="mb-5">
      <span className="label-caps flex items-center gap-2">
        <Highlighter size={12} className="text-accent" />
        Highlights · {data.length}
      </span>

      <div className="mt-2.5 flex flex-col gap-2.5">
        {shown.map((h) => (
          <button
            key={h.id}
            onClick={() => setOpen(data.indexOf(h))}
            className="bg-panel group rounded-sm border-l-2 border-accent/50 px-3.5 py-2.5 text-left transition hover:border-accent hover:bg-white/[0.03]"
          >
            <p className="text-cream whitespace-pre-line text-[12.5px] leading-relaxed">{h.text}</p>
            {h.my_note && (
              <p className="text-accent mt-2 text-[11.5px] italic">{h.my_note}</p>
            )}
            {h.note && (
              <p className="text-chalk-dim mt-2 border-t border-white/[0.07] pt-2 text-[11.5px] italic">
                {h.note}
              </p>
            )}
            <span className="mt-1.5 flex items-center justify-between">
              <span className="text-chalk-dim text-[10px] uppercase tracking-[0.14em]">
                {h.location !== null
                  ? `${h.location_type === "page" ? "Page" : "Location"} ${h.location}`
                  : ""}
              </span>
              <Maximize2
                size={11}
                className="text-chalk-dim group-hover:text-accent shrink-0"
              />
            </span>
          </button>
        ))}
      </div>

      {data.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-chalk-dim hover:text-accent mt-2.5 text-[10.5px] uppercase tracking-[0.15em]"
        >
          {showAll ? "Show fewer" : `Show all ${data.length}`}
        </button>
      )}

      {open !== null && data[open] && (
        <HighlightCard
          highlight={data[open]}
          book={book}
          cover={cover}
          onClose={() => setOpen(null)}
          onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
          onNext={open < data.length - 1 ? () => setOpen(open + 1) : undefined}
        />
      )}
    </div>
  );
}

function BookDetail({
  book,
  books,
  onClose,
  allTags,
  onFilter,
  onFindSimilar,
  onOpenBook,
}: {
  book: Book;
  books: Book[];
  onClose: () => void;
  allTags: string[];
  onFilter: (f: Filter) => void;
  onFindSimilar: (b: Book) => void;
  onOpenBook: (b: Book) => void;
}) {
  const qc = useQueryClient();
  const { burst, bookFinish } = useCelebration();
  const [pages, setPages] = useState("");
  const [date, setDate] = useState(todayStr());
  // Seeded from the book so the mode you last used for it comes back.
  const [mode, setMode] = useState<"pages" | "percent" | "page">(
    (book.progress_mode as "pages" | "percent" | "page") ?? "pages",
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["reading-sessions"] });
    qc.invalidateQueries({ queryKey: ["on-deck"] });
  };

  const celebrateFinish = (finishedAt = date || todayStr()) =>
    bookFinish(buildFinishCard(book, books, finishedAt));

  const patch = useMutation({
    mutationFn: (p: Partial<Book>) => updateBook(book.id, p),
    onSuccess: (_data, vars) => {
      refresh();
      if (vars.status === "read" && book.status !== "read") celebrateFinish();
      if (vars.status === "currently-reading" && book.on_deck) {
        toast.success("Moved to Reading — off the deck");
      }
    },
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
      if (r.finished) celebrateFinish();
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
      if (r.finished) celebrateFinish();
      else toast.success(r.delta > 0 ? `${r.delta} pages logged` : "Progress updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const finish = useMutation({
    mutationFn: () =>
      finishBook({
        bookId: book.id,
        date,
        pageCount: book.page_count,
        currentPage: book.current_page,
        status: book.status,
      }),
    onSuccess: () => {
      refresh();
      celebrateFinish();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not finish book"),
  });

  const deck = useMutation({
    mutationFn: (on: boolean) => setOnDeck(book.id, on),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["on-deck"] });
    },
  });

  const refetchInfo = useMutation({
    mutationFn: () => enrichBook(book.id),
    onSuccess: (r) => {
      refresh();
      const hit = Boolean(r.blurbs || r.found || r.pages);
      toast[hit ? "success" : "error"](hit ? "Found it" : "Nothing found for this one");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Lookup failed"),
  });

  const dupes = useMemo(() => findDuplicateBooks(books, book), [books, book]);

  const mergeDupe = useMutation({
    mutationFn: (absorbId: string) => mergeBooks(book.id, [absorbId]),
    onSuccess: (merged, absorbId) => {
      refresh();
      qc.invalidateQueries({ queryKey: ["highlight-counts"] });
      const gone = books.find((b) => b.id === absorbId);
      toast.success(
        `Merged ${gone?.format ?? "edition"} into this — ${merged.read_count} read-through${
          merged.read_count === 1 ? "" : "s"
        }`,
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not merge"),
  });

  const [coverLink, setCoverLink] = useState("");
  const [showCoverLink, setShowCoverLink] = useState(false);
  // Replace / paste cover UI — only after a double-tap on the jacket.
  const [coverToolsOpen, setCoverToolsOpen] = useState(false);
  const coverTapAt = useRef(0);
  // img onError — storage can hold a Google "no cover" stub that still 200s.
  const [coverBroken, setCoverBroken] = useState(false);

  useEffect(() => {
    setCoverToolsOpen(false);
    setShowCoverLink(false);
    setCoverLink("");
    setCoverBroken(false);
  }, [book.id]);

  const findCover = useMutation({
    mutationFn: (url?: string) => pullCover(book.id, url),
    onSuccess: (r) => {
      refresh();
      setCoverLink("");
      setShowCoverLink(false);
      setCoverToolsOpen(false);
      setCoverBroken(false);
      toast.success(
        r.source === "ai" ? "Cover found" : r.source === "link" ? "Cover saved" : "Cover found",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't find a cover"),
  });

  const openCoverTools = () => {
    setCoverToolsOpen(true);
    setShowCoverLink(false);
  };

  const onCoverActivate = () => {
    const now = Date.now();
    if (now - coverTapAt.current < 380) openCoverTools();
    coverTapAt.current = now;
  };

  const cover = coverBroken ? null : coverSrc(book);
  const subjects = book.subjects ?? [];
  const pct = book.page_count ? Math.min(100, (book.current_page / book.page_count) * 100) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        // Full-height sheet, so it needs the safe area itself — the app header
        // that normally handles it isn't in this stacking context.
        className="bg-field h-full w-full max-w-md overflow-y-auto overscroll-contain border-l border-accent/25 p-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover-led hero — jacket is the visual anchor, title sits under it. */}
        <div className="relative -mx-6 mb-6 overflow-hidden px-6 pb-6 pt-1">
          {cover && (
            <>
              <img
                src={cover}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full scale-[1.6] object-cover opacity-40 blur-3xl"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-[#0a1428]/55 to-[#0a1428]" />
            </>
          )}
          {!cover && <StarField count={18} seed={41} />}

          <button
            onClick={onClose}
            aria-label="Close"
            className="text-chalk hover:text-cream absolute top-1 right-4 z-20 rounded-full bg-black/35 p-1.5 backdrop-blur"
          >
            <X size={17} />
          </button>

          <div className="relative z-10 flex flex-col items-center pt-2 text-center">
            {cover ? (
              <button
                type="button"
                title="Double-tap to replace cover"
                onClick={onCoverActivate}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  openCoverTools();
                }}
                className="group relative shrink-0 rounded-md focus:outline-none"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-3 rounded-xl bg-accent/15 opacity-0 blur-xl transition group-hover:opacity-100"
                />
                <img
                  src={cover}
                  alt=""
                  onError={() => setCoverBroken(true)}
                  className="relative h-[268px] w-[180px] rounded-md object-cover shadow-[0_28px_64px_rgba(0,0,0,.8)] ring-1 ring-white/20 transition duration-300 group-hover:ring-accent/50 sm:h-[300px] sm:w-[200px]"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => findCover.mutate(undefined)}
                disabled={findCover.isPending}
                title="Find cover with AI"
                className="bg-panel hover:border-accent/40 grid h-[268px] w-[180px] shrink-0 place-items-center rounded-md border border-dashed border-white/15 transition disabled:opacity-50 sm:h-[300px] sm:w-[200px]"
              >
                <span className="flex flex-col items-center gap-2 px-2 text-center">
                  {findCover.isPending ? (
                    <Sparkles size={26} className="text-accent animate-pulse" />
                  ) : (
                    <ImageDown size={26} className="text-chalk-dim" />
                  )}
                  <span className="text-chalk-dim text-[10px] uppercase tracking-[0.14em]">
                    {findCover.isPending ? "Finding…" : "Find cover"}
                  </span>
                </span>
              </button>
            )}

            <div className="mt-5 w-full min-w-0">
              <h2 className="font-display text-cream text-[26px] leading-[1.12] sm:text-[28px]">
                <Editable
                  value={book.title}
                  doubleClick
                  onSave={(v) => v.trim() && patch.mutate({ title: v.trim() })}
                  inputClassName="w-full text-center text-[22px]"
                  className="text-center"
                />
              </h2>

              {book.subtitle && (
                <p className="text-chalk mt-1.5 text-[13px] italic">{book.subtitle}</p>
              )}

              <p className="mt-2 text-[14px]">
                <Editable
                  value={book.authors}
                  placeholder="Add author"
                  doubleClick
                  onSingleClick={() => {
                    if (!book.authors) return;
                    onFilter({ type: "author", value: book.authors.split(",")[0].trim() });
                    onClose();
                  }}
                  onSave={(v) => patch.mutate({ authors: v.trim() || null })}
                  className="text-chalk hover:text-accent text-center"
                  inputClassName="w-full text-center"
                />
              </p>

              {book.star_rating !== null && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-cream/20 bg-cream/10 px-2.5 py-1">
                  <Star size={15} className="text-cream fill-cream" />
                  <span className="numeral text-cream text-[18px] leading-none tracking-wide">
                    {book.star_rating}
                  </span>
                </div>
              )}

              <div className="text-chalk-dim mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11.5px]">
                <span>
                  <Editable
                    value={book.page_count}
                    placeholder="Add pages"
                    numeric
                    onSave={(v) => {
                      const n = Number.parseInt(v, 10);
                      patch.mutate({ page_count: Number.isFinite(n) && n > 0 ? n : null });
                    }}
                    inputClassName="w-20 text-center"
                  />
                  {book.page_count ? " pages" : ""}
                </span>
                {book.published_year && <span>{book.published_year}</span>}
                {book.format && <span className="capitalize">{book.format}</span>}
                <span>Read {book.read_count}×</span>
                <FictionLabel
                  fiction={book.fiction}
                  onFilter={() => {
                    if (book.fiction === null) return;
                    onFilter({ type: "fiction", value: book.fiction ? "fiction" : "nonfiction" });
                    onClose();
                  }}
                  onCorrect={(next) => patch.mutate({ fiction: next })}
                />
              </div>

              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onFindSimilar(book)}
                  className="text-accent hover:text-cream inline-flex items-center gap-1.5 rounded-full border border-accent/40 px-3 py-1.5 text-[10.5px] uppercase tracking-[0.12em] transition hover:bg-accent/10"
                >
                  <Sparkles size={11} />
                  Find similar
                </button>
                {book.series && (
                  <button
                    onClick={() => {
                      onFilter({ type: "series", value: book.series! });
                      onClose();
                    }}
                    className="text-accent hover:text-cream inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10.5px] transition hover:border-accent/40"
                  >
                    <Layers size={12} />
                    {book.series}
                    {book.series_position ? ` #${book.series_position}` : ""}
                  </button>
                )}
              </div>

              {(book.publisher || book.started_at || book.isbn) && (
                <div className="text-chalk-dim mt-3 space-y-0.5 text-[11px]">
                  {book.publisher && <p className="truncate">{book.publisher}</p>}
                  {book.started_at && <p>Started {fmtLongDate(book.started_at)}</p>}
                  {book.isbn && <p>ISBN {book.isbn}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* The blurb is the whole reason you open a book you haven't read yet,
            so it sits above the logging controls instead of under them. */}
        {(book.description || subjects.length > 0) && (
          <div className="mb-5">
            <span className="label-caps">About</span>
            {book.description && (
              <p className="text-chalk mt-2 whitespace-pre-line text-[12.5px] leading-relaxed">
                {book.description}
              </p>
            )}
            {subjects.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <span
                    key={s}
                    className="text-chalk-dim rounded-full border border-accent/25 px-2.5 py-[3px] text-[10.5px]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nothing to show means nothing was ever fetched for this one. */}
        {!book.description && (
          <button
            onClick={() => refetchInfo.mutate()}
            disabled={refetchInfo.isPending}
            className="text-chalk hover:text-cream mb-5 flex w-full items-center justify-center gap-2 rounded-sm border border-white/10 py-2 text-[10.5px] uppercase tracking-[0.15em] transition hover:border-accent/50 disabled:opacity-40"
          >
            <Sparkles size={13} />
            {refetchInfo.isPending ? "Looking it up…" : "Fetch book info"}
          </button>
        )}

        {dupes.length > 0 && (
          <div className="mb-5">
            <span className="label-caps">Same book, other editions</span>
            <p className="text-chalk-dim mt-1.5 text-[11px] leading-relaxed">
              StoryGraph often imports digital / hardcover / audio as separate rows. Merge folds
              their read-throughs, tags and cover into this one.
            </p>
            <ul className="mt-2.5 flex flex-col gap-2">
              {dupes.map((d) => {
                const dCover = coverSrc(d);
                return (
                  <li
                    key={d.id}
                    className="bg-panel flex items-center gap-3 rounded border border-white/[0.07] px-3 py-2.5"
                  >
                    {dCover ? (
                      <img
                        src={dCover}
                        alt=""
                        className="h-12 w-8 shrink-0 rounded-[2px] object-cover"
                      />
                    ) : (
                      <div className="bg-field grid h-12 w-8 shrink-0 place-items-center rounded-[2px]">
                        <BookOpen size={12} className="text-chalk-dim" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenBook(d)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-cream truncate text-[12.5px] capitalize">
                        {d.format || "unknown format"}
                      </p>
                      <p className="text-chalk-dim text-[10.5px]">
                        {SHELVES.find((s) => s.key === d.status)?.label ?? d.status}
                        {d.read_count > 0 ? ` · read ${d.read_count}×` : ""}
                        {d.isbn ? ` · ISBN` : ""}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={mergeDupe.isPending}
                      onClick={() => {
                        if (
                          !confirm(
                            `Merge the ${d.format || "other"} edition into this one? That edition’s row will be removed.`,
                          )
                        ) {
                          return;
                        }
                        mergeDupe.mutate(d.id);
                      }}
                      className="text-accent hover:text-cream shrink-0 text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
                    >
                      Merge in
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Cover replace — only after double-tapping the jacket. */}
        {coverToolsOpen && (
          <div className="mb-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="label-caps">Replace cover</span>
              <button
                type="button"
                onClick={() => {
                  setCoverToolsOpen(false);
                  setShowCoverLink(false);
                  setCoverLink("");
                }}
                className="text-chalk-dim hover:text-cream text-[10px] uppercase tracking-[0.14em]"
              >
                Cancel
              </button>
            </div>
            <button
              type="button"
              onClick={() => findCover.mutate(undefined)}
              disabled={findCover.isPending}
              className="text-chalk hover:text-cream flex w-full items-center justify-center gap-2 rounded-sm border border-accent/30 py-2 text-[10.5px] uppercase tracking-[0.15em] transition hover:border-accent disabled:opacity-40"
            >
              <Wand2 size={13} className="text-accent" />
              {findCover.isPending && !coverLink ? "Finding cover…" : "Find cover with AI"}
            </button>
            {showCoverLink ? (
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (coverLink.trim()) findCover.mutate(coverLink.trim());
                }}
                className="flex gap-2"
              >
                <input
                  value={coverLink}
                  onChange={(e) => setCoverLink(e.target.value)}
                  placeholder="https://… cover image or book page"
                  autoFocus
                  className="bg-panel text-cream min-w-0 flex-1 rounded-sm border border-white/10 px-3 py-2 text-[12px] outline-none focus:border-accent/50"
                />
                <button
                  type="submit"
                  disabled={findCover.isPending || !coverLink.trim()}
                  className="text-cream from-accent-deep to-accent-dark shrink-0 rounded-sm bg-gradient-to-b px-3 text-[10.5px] font-semibold uppercase tracking-[0.15em] disabled:opacity-40"
                >
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCoverLink(true)}
                className="text-chalk-dim hover:text-cream flex w-full items-center justify-center gap-2 py-1 text-[10.5px] uppercase tracking-[0.15em]"
              >
                <Link2 size={12} />
                Or paste a cover link
              </button>
            )}
          </div>
        )}

        {/* Status */}
        <label className="mb-4 block">
          <span className="label-caps">Status</span>
          <select
            value={book.status}
            onChange={(e) => {
              const status = e.target.value as ReadStatus;
              if (status === "read" && book.status !== "read") {
                finish.mutate();
                return;
              }
              const p: Partial<Book> = { status };
              if (status === "currently-reading" && book.status !== "currently-reading") {
                p.started_at = todayStr();
                if (!book.last_date_read) p.last_date_read = todayStr();
                // On deck is the queue — once you start, it leaves the queue.
                if (book.on_deck) p.on_deck = false;
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

        {/* On deck is about what's next, so it's meaningless mid-book. */}
        {book.status !== "currently-reading" && (
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
        )}

        {/* Rating waits until you've finished — rating mid-read is noise. */}
        {book.status !== "currently-reading" && (
          <div className="mb-4">
            <span className="label-caps">Rating</span>
            <div className="mt-1.5">
              <RatingPicker
                value={book.star_rating}
                onChange={(v) => patch.mutate({ star_rating: v })}
              />
            </div>
          </div>
        )}

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

          {(book.status === "currently-reading" || book.status === "paused") && (
            <button
              type="button"
              disabled={finish.isPending}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                burst(r.left + r.width / 2, r.top + r.height / 2);
                finish.mutate();
              }}
              className="bg-accent text-field hover:bg-accent/90 mt-3 flex w-full items-center justify-center gap-2 rounded-sm py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:opacity-40"
            >
              <BookOpen size={14} />
              {finish.isPending ? "Finishing…" : "Finish book"}
            </button>
          )}

          <div className="mt-3 flex gap-1">
            {(["pages", "percent", "page"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  // Remember it for next time, silently.
                  if (m !== book.progress_mode) patch.mutate({ progress_mode: m });
                }}
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

        {/* Highlights sit under the logging controls: updating progress is the
            thing you came to do, reading back quotes is the thing you linger on. */}
        <Highlights book={book} />

        {/* Tags */}
        <div className="mb-4">
          <span className="label-caps">Tags</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {book.tags.map((t) => (
              <span
                key={t}
                className="bg-panel text-chalk flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px]"
              >
                <button
                  onClick={() => {
                    onFilter({ type: "tag", value: t });
                    onClose();
                  }}
                  className="hover:text-accent"
                >
                  {t}
                </button>
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
          <TagInput
            existing={allTags}
            current={book.tags}
            onAdd={(t) => patch.mutate({ tags: [...book.tags, t] })}
          />
        </div>

        <ReadingHistory book={book} />
        <Editions book={book} onApplied={refresh} />

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

/* ── Ask AI ─────────────────────────────────────────────────────────── */
/**
 * Catalog (free Google Books + Open Library) is the default. Claude search /
 * shelf recommendations stay behind the AI tab — useful, but not free.
 * A suggestion you already own is marked rather than hidden.
 */
function AskAI({
  books,
  onClose,
  onOpen,
  seed,
}: {
  books: Book[];
  onClose: () => void;
  onOpen?: (b: Book) => void;
  seed?: { query: string; mode: "catalog" | "search" };
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"catalog" | "ai">(seed?.mode === "search" ? "ai" : "catalog");
  const [query, setQuery] = useState(seed?.query ?? "");
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const [added, setAdded] = useState<Record<string, string>>({});
  const seeded = useRef(false);

  // Indexed once so every result can say whether it's already on a shelf.
  const owned = useMemo(() => {
    const m = new Map<string, Book>();
    for (const b of books) {
      const k = titleKey(b.title);
      if (k && !m.has(k)) m.set(k, b);
    }
    return m;
  }, [books]);

  const ask = useMutation({
    mutationFn: (mode: "search" | "recommend" | "catalog") => askAI(mode, query),
    onSuccess: (r) => {
      setResults(r);
      if (r.length === 0) toast("Nothing came back — try rewording it.", { icon: "🤔" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ask failed"),
  });

  // Find similar / deep-link opens the panel already mid-search.
  useEffect(() => {
    if (!seed?.query || seeded.current) return;
    seeded.current = true;
    ask.mutate(seed.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for seed
  }, []);

  const add = useMutation({
    mutationFn: async (s: Suggestion) => {
      const year = Number.parseInt(s.year, 10);
      const book = await createBook({
        title: s.title,
        authors: s.author || null,
        status: "to-read",
        published_year: Number.isFinite(year) ? year : null,
      });
      // Go straight for the cover and blurb so it doesn't land on the shelf bare.
      await enrichBook(book.id).catch(() => {});
      return book;
    },
    onSuccess: (book, s) => {
      setAdded((a) => ({ ...a, [s.title]: book.id }));
      qc.invalidateQueries({ queryKey: ["books"] });
      toast.success(`Added ${book.title}`);
      onOpen?.(book);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="bg-field h-full w-full max-w-lg overflow-y-auto overscroll-contain border-l border-accent/25 p-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative -mx-6 mb-5 overflow-hidden px-6 pb-5">
          <StarField count={20} seed={17} />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-cream text-[23px] leading-tight">
                Find a <span className="text-accent">book</span>
              </h2>
              <p className="text-chalk-dim mt-1 text-[11.5px]">
                Free catalog search, or ask AI when you need a smarter pick.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-chalk hover:text-cream bg-field/60 shrink-0 rounded-full p-1.5 backdrop-blur"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="mb-3 flex gap-1">
          {(
            [
              ["catalog", "Catalog · free"],
              ["ai", "Ask AI"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-[10.5px] uppercase tracking-[0.15em] transition",
                tab === k
                  ? "border border-accent/50 bg-accent/15 text-accent"
                  : "text-chalk-dim hover:text-cream border border-transparent",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!query.trim()) return;
            ask.mutate(tab === "catalog" ? "catalog" : "search");
          }}
          className="flex gap-2"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "catalog"
                ? "title, author, or topic"
                : "college football books that have audiobooks"
            }
            className="bg-panel text-cream min-w-0 flex-1 rounded-sm border border-white/10 px-3 py-2.5 text-[13px] outline-none focus:border-accent/50"
          />
          <button
            type="submit"
            disabled={ask.isPending || !query.trim()}
            className="from-accent-deep to-accent-dark text-cream flex shrink-0 items-center gap-2 rounded-sm bg-gradient-to-b px-4 text-[10.5px] font-semibold uppercase tracking-[0.15em] disabled:opacity-40"
          >
            <Send size={13} />
            {tab === "catalog" ? "Search" : "Ask"}
          </button>
        </form>

        {tab === "ai" && (
          <button
            onClick={() => ask.mutate("recommend")}
            disabled={ask.isPending}
            className="text-chalk hover:text-cream mt-2.5 flex w-full items-center justify-center gap-2 rounded-sm border border-white/10 py-2.5 text-[10.5px] uppercase tracking-[0.15em] transition hover:border-accent/50 disabled:opacity-40"
          >
            <Wand2 size={13} className="text-accent" />
            What should I read next?
          </button>
        )}

        {tab === "catalog" && (
          <p className="text-chalk-dim mt-2 text-[10.5px]">
            Google Books + Open Library — no AI cost.
          </p>
        )}

        {ask.isPending && (
          <p className="label-caps mt-8 animate-pulse text-center">
            {ask.variables === "recommend"
              ? "Reading your shelves"
              : ask.variables === "catalog"
                ? "Searching catalogs"
                : "Searching"}
          </p>
        )}

        {results && !ask.isPending && (
          <ul className="mt-6 flex flex-col gap-2.5">
            {results.map((s) => {
              const have = owned.get(titleKey(s.title));
              const justAdded = added[s.title];
              const openOwned = have
                ? () => {
                    onOpen?.(have);
                    onClose();
                  }
                : null;
              const canAdd = !have && !justAdded;
              return (
                <li key={`${s.title}-${s.author}`}>
                  <button
                    type="button"
                    disabled={add.isPending || (!canAdd && !openOwned)}
                    onClick={() => {
                      if (openOwned) openOwned();
                      else if (canAdd) add.mutate(s);
                    }}
                    className={cn(
                      "bg-panel flex w-full gap-3.5 rounded border border-white/[0.07] px-4 py-3 text-left transition",
                      (canAdd || openOwned) && "hover:border-accent/40",
                      add.isPending && "opacity-50",
                    )}
                  >
                    {s.cover_url ? (
                      <img
                        src={s.cover_url}
                        alt=""
                        loading="lazy"
                        className="h-[74px] w-[50px] shrink-0 rounded-[2px] object-cover shadow-[0_4px_14px_rgba(0,0,0,.5)]"
                      />
                    ) : (
                      <div className="bg-field grid h-[74px] w-[50px] shrink-0 place-items-center rounded-[2px]">
                        <BookOpen size={15} className="text-chalk-dim" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-cream text-[14px] leading-snug">{s.title}</p>
                      <p className="text-chalk-dim mt-0.5 text-[11.5px]">
                        {s.author}
                        {s.year ? ` · ${s.year}` : ""}
                      </p>
                      {s.reason && (
                        <p className="text-chalk mt-2 text-[12px] leading-relaxed">{s.reason}</p>
                      )}

                      <div className="mt-2.5">
                        {have ? (
                          <span className="text-chalk-dim text-[10.5px] uppercase tracking-[0.15em]">
                            Already in your library · Open
                          </span>
                        ) : justAdded ? (
                          <span className="text-accent text-[10.5px] uppercase tracking-[0.15em]">
                            Added to To read
                          </span>
                        ) : (
                          <span className="text-chalk flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.15em]">
                            <Plus size={12} /> Add to library
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}

/* ── Stats breakdown (today / week / month / top days) ──────────────── */
export type BreakdownFocus =
  | { kind: "pages"; label: string; from: string; to: string }
  | { kind: "finished"; label: string; from: string; to: string }
  | { kind: "top-days"; label: string; limit?: number };

function StatsBreakdown({
  focus,
  books,
  sessions,
  onClose,
  onOpenBook,
  onDrill,
}: {
  focus: BreakdownFocus;
  books: Book[];
  sessions: ReadingSession[];
  onClose: () => void;
  onOpenBook: (b: Book) => void;
  onDrill?: (focus: BreakdownFocus) => void;
}) {
  const pageRows = useMemo(
    () =>
      focus.kind === "pages"
        ? pagesContributions(sessions, books, focus.from, focus.to)
        : [],
    [focus, sessions, books],
  );
  const finished = useMemo(
    () =>
      focus.kind === "finished"
        ? finishedContributions(books, focus.from, focus.to)
        : [],
    [focus, books],
  );
  const topDays = useMemo(
    () => (focus.kind === "top-days" ? topReadingDays(sessions, focus.limit ?? 10) : []),
    [focus, sessions],
  );
  const totalPages = pageRows.reduce((n, r) => n + r.pages, 0);

  const subtitle =
    focus.kind === "pages"
      ? `${totalPages.toLocaleString()} page${totalPages === 1 ? "" : "s"} across ${pageRows.length} book${pageRows.length === 1 ? "" : "s"}`
      : focus.kind === "finished"
        ? `${finished.length} finished`
        : `Top ${topDays.length} day${topDays.length === 1 ? "" : "s"} by pages`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="bg-field h-full w-full max-w-md overflow-y-auto overscroll-contain border-l border-accent/25 p-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-cream text-[22px] leading-tight">{focus.label}</h2>
            <p className="text-chalk-dim mt-1 text-[11.5px]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-chalk hover:text-cream bg-field/60 shrink-0 rounded-full p-1.5 backdrop-blur"
          >
            <X size={17} />
          </button>
        </div>

        {focus.kind === "pages" && pageRows.length === 0 && (
          <p className="text-chalk-dim text-[13px]">No pages logged in this window.</p>
        )}
        {focus.kind === "finished" && finished.length === 0 && (
          <p className="text-chalk-dim text-[13px]">Nothing finished in this window.</p>
        )}
        {focus.kind === "top-days" && topDays.length === 0 && (
          <p className="text-chalk-dim text-[13px]">No reading days logged yet.</p>
        )}

        {focus.kind === "pages" && pageRows.length > 0 && (
          <ul className="flex flex-col gap-2">
            {pageRows.map((r) => {
              const cover = r.book ? coverSrc(r.book) : null;
              return (
                <li key={r.bookId ?? r.title}>
                  <button
                    type="button"
                    disabled={!r.book}
                    onClick={() => r.book && onOpenBook(r.book)}
                    className={cn(
                      "bg-panel flex w-full items-center gap-3 rounded border border-white/[0.07] px-3 py-2.5 text-left",
                      r.book && "hover:border-accent/40 transition",
                    )}
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="h-12 w-8 shrink-0 rounded-[2px] object-cover"
                      />
                    ) : (
                      <div className="bg-field grid h-12 w-8 shrink-0 place-items-center rounded-[2px]">
                        <BookOpen size={12} className="text-chalk-dim" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-cream truncate text-[13px]">{r.title}</p>
                      {r.authors && (
                        <p className="text-chalk-dim truncate text-[11px]">{r.authors}</p>
                      )}
                    </div>
                    <span className="numeral text-accent shrink-0 text-[18px]">{r.pages}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {focus.kind === "finished" && finished.length > 0 && (
          <ul className="flex flex-col gap-2">
            {finished.map((r) => {
              const cover = coverSrc(r.book);
              return (
                <li key={`${r.book.id}-${r.ended}`}>
                  <button
                    type="button"
                    onClick={() => onOpenBook(r.book)}
                    className="bg-panel hover:border-accent/40 flex w-full items-center gap-3 rounded border border-white/[0.07] px-3 py-2.5 text-left transition"
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="h-12 w-8 shrink-0 rounded-[2px] object-cover"
                      />
                    ) : (
                      <div className="bg-field grid h-12 w-8 shrink-0 place-items-center rounded-[2px]">
                        <BookOpen size={12} className="text-chalk-dim" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-cream truncate text-[13px]">{r.book.title}</p>
                      <p className="text-chalk-dim text-[11px]">
                        {r.started && r.started !== r.ended
                          ? `${fmtLongDate(r.started)} – ${fmtLongDate(r.ended)}`
                          : fmtLongDate(r.ended)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {focus.kind === "top-days" && topDays.length > 0 && (
          <ul className="flex flex-col gap-2">
            {topDays.map((d) => (
              <li key={d.date}>
                <button
                  type="button"
                  onClick={() =>
                    onDrill?.({
                      kind: "pages",
                      label: fmtLongDate(d.date),
                      from: d.date,
                      to: d.date,
                    })
                  }
                  className={cn(
                    "bg-panel hover:border-accent/40 flex w-full items-center gap-3 rounded border px-3 py-2.5 text-left transition",
                    d.isToday ? "border-accent/45" : "border-white/[0.07]",
                  )}
                >
                  <span
                    className={cn(
                      "numeral w-8 shrink-0 text-center text-[18px]",
                      d.rank <= 3 ? "text-accent" : "text-chalk-dim",
                    )}
                  >
                    #{d.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-cream text-[13px]">{fmtLongDate(d.date)}</p>
                    {d.isToday && (
                      <p className="text-accent text-[10.5px] uppercase tracking-[0.14em]">
                        Today
                      </p>
                    )}
                  </div>
                  <span className="numeral text-accent shrink-0 text-[18px]">
                    {d.pages}
                    <span className="text-chalk-dim ml-1 text-[11px] font-sans tracking-normal">
                      p
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

/* ── New & popular (browse) ─────────────────────────────────────────── */
/** Walk the new-release table the way you’d wander Barnes & Noble. */
function NewPopularPanel({
  books,
  onClose,
}: {
  books: Book[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [added, setAdded] = useState<Record<string, string>>({});

  const owned = useMemo(() => {
    const m = new Map<string, Book>();
    for (const b of books) {
      const k = titleKey(b.title);
      if (k && !m.has(k)) m.set(k, b);
    }
    return m;
  }, [books]);

  const browse = useQuery({
    queryKey: ["browse-new-popular", "front-tables"],
    queryFn: browseNewPopular,
    staleTime: 1000 * 60 * 30,
  });

  const add = useMutation({
    mutationFn: async (s: Suggestion) => {
      const year = Number.parseInt(s.year, 10);
      const book = await createBook({
        title: s.title,
        authors: s.author || null,
        status: "to-read",
        published_year: Number.isFinite(year) ? year : null,
      });
      await enrichBook(book.id).catch(() => {});
      return book;
    },
    onSuccess: (book, s) => {
      setAdded((a) => ({ ...a, [s.title]: book.id }));
      qc.invalidateQueries({ queryKey: ["books"] });
      toast.success(`Added ${book.title}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="bg-field h-full w-full max-w-lg overflow-y-auto overscroll-contain border-l border-accent/25 p-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative -mx-6 mb-5 overflow-hidden px-6 pb-5">
          <StarField count={22} seed={41} />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-cream text-[23px] leading-tight">
                New & <span className="text-accent">popular</span>
              </h2>
              <p className="text-chalk-dim mt-1 text-[11.5px]">
                Front-of-store energy — new releases and bestsellers on the big tables.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-chalk hover:text-cream bg-field/60 shrink-0 rounded-full p-1.5 backdrop-blur"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {browse.isPending && (
          <p className="label-caps mt-10 animate-pulse text-center">Browsing the shelves</p>
        )}
        {browse.isError && (
          <p className="text-alert mt-6 text-center text-[13px]">
            {browse.error instanceof Error ? browse.error.message : "Could not load"}
          </p>
        )}

        {browse.data && (
          <div className="flex flex-col gap-8">
            {browse.data.map((shelf: BrowseShelf) => (
              <section key={shelf.id}>
                <div className="rule-head mb-1">{shelf.title}</div>
                <p className="text-chalk-dim mb-3 text-[11.5px]">{shelf.blurb}</p>
                <ul className="flex flex-col gap-2.5">
                  {shelf.books.map((s) => {
                    const have = owned.get(titleKey(s.title));
                    const justAdded = added[s.title];
                    return (
                      <li
                        key={`${shelf.id}-${s.title}-${s.author}`}
                        className="bg-panel flex gap-3.5 rounded border border-white/[0.07] px-4 py-3"
                      >
                        {s.cover_url ? (
                          <img
                            src={s.cover_url}
                            alt=""
                            loading="lazy"
                            className="h-[74px] w-[50px] shrink-0 rounded-[2px] object-cover shadow-[0_4px_14px_rgba(0,0,0,.5)]"
                          />
                        ) : (
                          <div className="bg-field grid h-[74px] w-[50px] shrink-0 place-items-center rounded-[2px]">
                            <BookOpen size={15} className="text-chalk-dim" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-cream text-[14px] leading-snug">{s.title}</p>
                          <p className="text-chalk-dim mt-0.5 text-[11.5px]">
                            {s.author}
                            {s.year ? ` · ${s.year}` : ""}
                          </p>
                          {s.reason && (
                            <p className="text-chalk mt-1.5 text-[11.5px] leading-relaxed">
                              {s.reason}
                            </p>
                          )}
                          <div className="mt-2.5">
                            {have ? (
                              <span className="text-chalk-dim text-[10.5px] uppercase tracking-[0.15em]">
                                Already in your library
                              </span>
                            ) : justAdded ? (
                              <span className="text-accent text-[10.5px] uppercase tracking-[0.15em]">
                                Added to To read
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => add.mutate(s)}
                                disabled={add.isPending}
                                className="text-chalk hover:text-accent flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.15em] disabled:opacity-40"
                              >
                                <Plus size={12} /> Add to library
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {browse.data.length === 0 && (
              <p className="text-chalk-dim text-center text-[13px]">Nothing on the table right now.</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/* ── Add ────────────────────────────────────────────────────────────── */
function AddPanel({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (b: Book) => void;
}) {
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

  const finish = (book: Book) => {
    qc.invalidateQueries({ queryKey: ["books"] });
    onClose();
    onAdded(book);
  };

  const fromUrl = useMutation({
    mutationFn: () => addBookFromUrl(url.trim()),
    onSuccess: (b) => {
      toast.success(`Added "${b.title}"`);
      finish(b);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Lookup failed"),
  });

  const fromForm = useMutation({
    mutationFn: async () => {
      const book = await createBook({
        title: manual.title.trim(),
        authors: manual.authors.trim() || null,
        page_count: manual.page_count ? Number.parseInt(manual.page_count, 10) : null,
        status: manual.status,
        finished_at: manual.finished_at || null,
        last_date_read: manual.finished_at || null,
        read_count: manual.status === "read" ? 1 : 0,
      });
      // Pull blurb/subjects/fiction so the shelf entry isn't bare.
      await enrichBook(book.id).catch(() => {});
      return book;
    },
    onSuccess: (b) => {
      toast.success("Book added");
      finish(b);
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
function NowReading({
  books,
  sessions,
  onOpen,
}: {
  books: Book[];
  sessions: ReadingSession[];
  onOpen: (b: Book) => void;
}) {
  const reading = useMemo(() => {
    const latest = new Map<string, string>();
    for (const s of sessions) {
      if (!s.book_id) continue;
      const prev = latest.get(s.book_id);
      if (!prev || s.session_date > prev) latest.set(s.book_id, s.session_date);
    }
    return books
      .filter((b) => b.status === "currently-reading")
      .sort((a, b) => {
        const aKey = latest.get(a.id) ?? a.last_date_read ?? a.started_at ?? "";
        const bKey = latest.get(b.id) ?? b.last_date_read ?? b.started_at ?? "";
        if (aKey !== bKey) return bKey.localeCompare(aKey);
        return (b.current_page ?? 0) - (a.current_page ?? 0);
      })
      .slice(0, 3);
  }, [books, sessions]);

  if (reading.length === 0) return null;

  return (
    // Extra bottom margin and a rule below: this is the headline of the page,
    // not the first item in a list.
    <section className="mb-2 border-b border-accent/15 pb-6">
      <div className="flex flex-col gap-4">
        {reading.map((b) => {
          const cover = coverSrc(b);
          const pct = b.page_count ? Math.min(100, (b.current_page / b.page_count) * 100) : null;
          return (
            <button
              key={b.id}
              onClick={() => onOpen(b)}
              className="from-hero-lift to-hero group relative flex items-start gap-5 overflow-hidden rounded-lg border border-accent/30 bg-gradient-to-br p-5 text-left transition hover:border-accent/70 sm:gap-7 sm:p-7"
            >
              <StarField count={26} seed={31} />

              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="relative z-10 h-[132px] w-[88px] shrink-0 rounded object-cover shadow-[0_12px_32px_rgba(0,0,0,.6)] transition group-hover:-translate-y-0.5 sm:h-[168px] sm:w-[112px]"
                />
              ) : (
                <div className="bg-panel relative z-10 grid h-[132px] w-[88px] shrink-0 place-items-center rounded sm:h-[168px] sm:w-[112px]">
                  <BookOpen size={24} className="text-chalk-dim" />
                </div>
              )}

              <div className="relative z-10 min-w-0 flex-1">
                <div className="rule-head mb-2">Now reading</div>

                {/* Wraps instead of truncating — long titles are the norm. */}
                <h2 className="font-display text-cream text-[21px] leading-[1.15] sm:text-[27px]">
                  {b.title}
                </h2>
                {b.authors && (
                  <p className="text-chalk mt-1.5 text-[12.5px] sm:text-[13.5px]">{b.authors}</p>
                )}
                {b.started_at && (
                  <p className="text-chalk-dim mt-1 text-[10.5px] uppercase tracking-[0.14em]">
                    started {fmtLongDate(b.started_at)}
                  </p>
                )}
                {b.read_count > 1 && (
                  <p className="text-accent mt-0.5 text-[10.5px] uppercase tracking-[0.14em]">
                    re-read · {b.read_count} times
                  </p>
                )}

                {pct !== null ? (
                  <div className="mt-4">
                    <div className="flex items-baseline gap-2">
                      <span className="numeral text-accent text-[26px] leading-none">
                        {Math.round(pct)}%
                      </span>
                      <span className="text-chalk-dim text-[11px]">
                        page {b.current_page} of {b.page_count}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-sm bg-black/30">
                      <div
                        className="from-accent-deep to-accent h-full bg-gradient-to-r transition-[width] duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-chalk-dim mt-1.5 text-[10.5px] uppercase tracking-[0.14em]">
                      {b.page_count! - b.current_page} pages to go
                    </p>
                  </div>
                ) : (
                  <p className="text-chalk-dim mt-4 text-[10.5px] uppercase tracking-[0.14em]">
                    add a page count to track progress
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
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
function GoalCard({ books, onDrill }: { books: Book[]; onDrill: (year: string) => void }) {
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
        <div className="w-full text-left">
          <div className="flex items-baseline gap-2">
            <button
              onClick={() => onDrill(String(year))}
              title="Show these books"
              className="numeral text-accent hover:text-cream text-[34px] leading-none transition-colors"
            >
              {done}
            </button>
            <button
              onClick={() => { setDraft(String(target)); setEditing(true); }}
              className="text-chalk hover:text-cream text-[13px]"
            >
              of {target} books
            </button>
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
        </div>
      )}
    </div>
  );
}




/* ── Pages today + daily goal ───────────────────────────────────────── */
function DailyPages({
  sessions,
  onBreakdown,
}: {
  sessions: ReadingSession[];
  onBreakdown: (focus: BreakdownFocus) => void;
}) {
  const qc = useQueryClient();
  const { data: goal } = useQuery({ queryKey: ["daily-goal"], queryFn: fetchDailyGoal });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const p = useMemo(() => dailyProgress(sessions, goal ?? null), [sessions, goal]);
  const today = periodBounds().today;

  const save = useMutation({
    mutationFn: (n: number | null) => saveDailyGoal(n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-goal"] });
      setEditing(false);
    },
  });

  const pct = p.goal ? Math.min(100, (p.today / p.goal) * 100) : null;

  const openToday = () =>
    onBreakdown({ kind: "pages", label: "Today", from: today, to: today });

  return (
    <div>
      <h2 className="rule-head mb-3">Today</h2>

      <button
        type="button"
        onClick={openToday}
        className="group flex items-baseline gap-2 text-left transition"
        aria-label={`${p.today} pages today — see which books`}
      >
        <span className="numeral text-accent group-hover:text-cream text-[38px] leading-none transition">
          {p.today}
        </span>
        <span className="text-chalk group-hover:text-cream text-[13px] transition">
          page{p.today === 1 ? "" : "s"}
          {p.goal ? ` of ${p.goal}` : ""}
        </span>
      </button>

      {pct !== null && (
        <button
          type="button"
          onClick={openToday}
          className="mt-2 block h-2 w-full overflow-hidden rounded-sm bg-white/10"
          aria-label="Today progress — see which books"
        >
          <div
            className={cn(
              "h-full transition-[width] duration-500",
              p.metToday ? "bg-turf" : "from-accent-deep to-accent bg-gradient-to-r",
            )}
            style={{ width: `${pct}%` }}
          />
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {p.allTimeRank != null && (
          <button
            type="button"
            onClick={() =>
              onBreakdown({
                kind: "top-days",
                label: "Best reading days",
                limit: 10,
              })
            }
            className="text-accent hover:text-cream text-[11px] transition"
            aria-label={`#${p.allTimeRank} all-time day of ${p.allTimeDays} — see top days`}
          >
            #{p.allTimeRank} all-time day
            <span className="text-chalk-dim"> of {p.allTimeDays}</span>
          </button>
        )}
        {p.goal !== null && (
          <span className={cn("text-[11px]", p.metToday ? "text-accent" : "text-chalk-dim")}>
            {p.metToday ? "✓ goal met" : `${p.goal - p.today} to go`}
          </span>
        )}
        {p.goal !== null && p.streak > 0 && (
          <span className="text-accent text-[11px]">
            🔥 {p.streak} day{p.streak === 1 ? "" : "s"}
          </span>
        )}
        {p.goal !== null && p.bestStreak > p.streak && (
          <span className="text-chalk-dim text-[10.5px]">best {p.bestStreak}</span>
        )}
      </div>

      {editing || p.goal === null ? (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const n = Number.parseInt(draft, 10);
            save.mutate(Number.isFinite(n) && n > 0 ? n : null);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="numeric"
            placeholder="Pages per day"
            className="bg-panel text-cream w-full rounded-sm border border-white/10 px-3 py-1.5 text-[13px] outline-none focus:border-accent/50"
          />
          <button className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
            Set
          </button>
        </form>
      ) : (
        <button
          onClick={() => {
            setDraft(String(p.goal));
            setEditing(true);
          }}
          className="text-chalk-dim hover:text-cream mt-1.5 text-[10px] uppercase tracking-[0.14em]"
        >
          change goal
        </button>
      )}
    </div>
  );
}

/* ── This week / this month ─────────────────────────────────────────── */
function PeriodTotals({
  books,
  sessions,
  onBreakdown,
}: {
  books: Book[];
  sessions: ReadingSession[];
  onBreakdown: (focus: BreakdownFocus) => void;
}) {
  const s = useMemo(() => periodStats(books, sessions), [books, sessions]);

  const Cell = ({
    label,
    value,
    sub,
    rank,
    onClick,
  }: {
    label: string;
    value: number;
    sub: string;
    rank?: string | null;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="bg-panel hover:bg-panel/80 px-4 py-3 text-left transition"
    >
      <div className="label-caps text-[9.5px] tracking-[0.17em]">{label}</div>
      <div className="numeral text-cream mt-1 text-[27px] leading-none">
        {value.toLocaleString()}
      </div>
      <div className="text-chalk-dim mt-1 text-[9.5px] uppercase tracking-[0.12em]">{sub}</div>
      {rank && <div className="text-accent mt-1 text-[10px]">{rank}</div>}
    </button>
  );

  const monthRankLabel =
    s.monthRank != null ? `#${s.monthRank} of ${s.monthTotal} months` : null;

  return (
    <div>
      <h2 className="rule-head mb-3">Recent</h2>
      <div className="bg-accent/15 grid grid-cols-2 gap-px">
        <Cell
          label="This week"
          value={s.pagesWeek}
          sub="pages"
          onClick={() =>
            onBreakdown({
              kind: "pages",
              label: "This week · pages",
              from: s.weekStart,
              to: s.today,
            })
          }
        />
        <Cell
          label="This week"
          value={s.booksWeek}
          sub={s.booksWeek === 1 ? "book" : "books"}
          onClick={() =>
            onBreakdown({
              kind: "finished",
              label: "This week · finished",
              from: s.weekStart,
              to: s.today,
            })
          }
        />
        <Cell
          label="This month"
          value={s.pagesMonth}
          sub="pages"
          rank={monthRankLabel}
          onClick={() =>
            onBreakdown({
              kind: "pages",
              label: "This month · pages",
              from: s.monthStart,
              to: s.today,
            })
          }
        />
        <Cell
          label="This month"
          value={s.booksMonth}
          sub={s.booksMonth === 1 ? "book" : "books"}
          onClick={() =>
            onBreakdown({
              kind: "finished",
              label: "This month · finished",
              from: s.monthStart,
              to: s.today,
            })
          }
        />
      </div>
      {s.pagesWeek === 0 && s.pagesMonth === 0 && (
        <p className="text-chalk-dim mt-2 text-[10.5px] leading-relaxed">
          Page counts come from logged sessions. Log some reading and this fills in.
        </p>
      )}
    </div>
  );
}

/* ── Stats by tag ───────────────────────────────────────────────────── */
function TagStats({
  books,
  active,
  onPick,
}: {
  books: Book[];
  active: string | null;
  onPick: (t: string) => void;
}) {
  const rows = useMemo(() => {
    const agg = new Map<string, { count: number; rated: number; sum: number; pages: number }>();
    for (const b of books) {
      for (const t of b.tags) {
        const r = agg.get(t) ?? { count: 0, rated: 0, sum: 0, pages: 0 };
        r.count++;
        if (b.star_rating !== null) {
          r.rated++;
          r.sum += b.star_rating;
        }
        if (b.page_count) r.pages += b.page_count;
        agg.set(t, r);
      }
    }
    return [...agg.entries()]
      .map(([tag, r]) => ({
        tag,
        count: r.count,
        avg: r.rated > 0 ? r.sum / r.rated : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 18);
  }, [books]);

  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count));

  return (
    <div>
      <h2 className="rule-head mb-3">By tag</h2>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <button
            key={r.tag}
            onClick={() => onPick(r.tag)}
            className={cn(
              "group text-left transition-colors",
              active === r.tag ? "text-accent" : "text-chalk hover:text-cream",
            )}
          >
            <div className="flex items-baseline gap-2 text-[12px]">
              <span className="min-w-0 flex-1 truncate">{r.tag}</span>
              {r.avg !== null && (
                <span className="text-chalk-dim shrink-0 text-[10.5px]">★ {r.avg.toFixed(2)}</span>
              )}
              <span className="numeral text-accent shrink-0 text-[13px]">{r.count}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-sm bg-white/10">
              <div
                className={cn(
                  "h-full transition-[width]",
                  active === r.tag ? "bg-accent" : "bg-accent/50 group-hover:bg-accent",
                )}
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Shelf ──────────────────────────────────────────────────────────── */
/**
 * The library itself. Covers is for browsing by jacket the way you'd browse a
 * shelf; Details is for scanning — same books, same click targets.
 */
function Shelf({
  books,
  view,
  highlights,
  onOpen,
  onFilter,
}: {
  books: Book[];
  view: "list" | "grid";
  highlights: Record<string, number>;
  onOpen: (b: Book) => void;
  onFilter: (f: Filter) => void;
}) {
  if (books.length === 0) {
    return (
      <div className="bg-panel rounded border border-white/[0.07] py-14 text-center">
        <BookOpen size={26} className="text-chalk-dim mx-auto" />
        <p className="text-chalk mt-3 text-sm">Nothing on this shelf yet.</p>
      </div>
    );
  }

  if (view === "grid") {
    return (
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {books.map((b) => {
          const cover = coverSrc(b);
          const pct = b.page_count
            ? Math.min(100, (b.current_page / b.page_count) * 100)
            : null;
          return (
            <li key={b.id}>
              <button onClick={() => onOpen(b)} className="group block w-full text-left">
                <div className="relative aspect-[2/3] overflow-hidden rounded shadow-[0_10px_26px_rgba(0,0,0,.5)] transition-transform duration-200 group-hover:-translate-y-1">
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="bg-panel flex h-full w-full flex-col items-center justify-center gap-2 px-2">
                      <BookOpen size={18} className="text-chalk-dim" />
                      <span className="text-chalk-dim line-clamp-3 text-center text-[9.5px] leading-tight">
                        {b.title}
                      </span>
                    </div>
                  )}
                  {/* A spine shadow and a hairline edge: flat art, book object. */}
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/45 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 rounded ring-1 ring-inset ring-white/10" />

                  {b.star_rating !== null && (
                    <span className="bg-ink/85 text-accent absolute right-1 top-1 flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] backdrop-blur">
                      <Star size={9} className="fill-current" />
                      <span className="numeral">{b.star_rating}</span>
                    </span>
                  )}
                  {highlights[b.id] && (
                    <span className="bg-ink/85 text-chalk absolute left-1 top-1 flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] backdrop-blur">
                      <Highlighter size={9} className="text-accent" />
                      <span className="numeral">{highlights[b.id]}</span>
                    </span>
                  )}
                  {pct !== null && b.status === "currently-reading" && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                      <div className="bg-accent h-full" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <p className="text-cream mt-1.5 line-clamp-2 text-[11.5px] leading-tight">
                  {b.title}
                </p>
                <p className="text-chalk-dim truncate text-[10px]">{b.authors || "Unknown"}</p>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {books.map((b) => {
        const cover = coverSrc(b);
        const pct = b.page_count ? Math.min(100, (b.current_page / b.page_count) * 100) : null;
        const facts = [
          b.published_year ? String(b.published_year) : null,
          b.page_count ? `${b.page_count} pages` : null,
          b.format ? b.format[0].toUpperCase() + b.format.slice(1) : null,
          b.read_count > 1 ? `read ${b.read_count}×` : null,
          highlights[b.id] ? `${highlights[b.id]} highlights` : null,
        ].filter(Boolean) as string[];

        return (
          <li key={b.id}>
            <button
              onClick={() => onOpen(b)}
              className="bg-panel group relative flex w-full items-start gap-4 overflow-hidden rounded border border-white/[0.07] py-3 pl-4 pr-4 text-left transition-colors hover:border-accent/35 hover:bg-white/[0.03]"
            >
              {/* Stripe wipes in on hover — the flag motif at row scale. */}
              <span className="bg-accent absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 transition-transform duration-200 group-hover:scale-y-100" />

              {cover ? (
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  className="h-[66px] w-[44px] shrink-0 rounded-[2px] object-cover shadow-[0_4px_14px_rgba(0,0,0,.5)]"
                />
              ) : (
                <div className="bg-field grid h-[66px] w-[44px] shrink-0 place-items-center rounded-[2px]">
                  <BookOpen size={15} className="text-chalk-dim" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-cream truncate text-[14px]">{b.title}</p>

                <p className="text-chalk-dim truncate text-[11.5px]">
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      if (!b.authors) return;
                      e.stopPropagation(); // don't also open the drawer
                      onFilter({ type: "author", value: b.authors.split(",")[0].trim() });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && b.authors) {
                        e.stopPropagation();
                        onFilter({ type: "author", value: b.authors.split(",")[0].trim() });
                      }
                    }}
                    className={b.authors ? "hover:text-accent cursor-pointer" : ""}
                  >
                    {b.authors || "Unknown author"}
                  </span>
                </p>

                {facts.length > 0 && (
                  <p className="text-chalk-dim mt-1 truncate text-[10.5px]">{facts.join(" · ")}</p>
                )}

                {b.description && (
                  <p className="text-chalk mt-1.5 line-clamp-2 text-[11.5px] leading-snug">
                    {b.description}
                  </p>
                )}

                {b.tags.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {b.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFilter({ type: "tag", value: t });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            onFilter({ type: "tag", value: t });
                          }
                        }}
                        className="text-chalk-dim hover:text-accent hover:border-accent/45 cursor-pointer rounded-full border border-white/10 px-2 py-[1px] text-[9.5px]"
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                )}

                {pct !== null && b.status === "currently-reading" && (
                  <span className="mt-2 flex items-center gap-2">
                    <span className="h-1 w-32 overflow-hidden rounded-sm bg-white/10">
                      <span
                        className="bg-accent block h-full"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="text-chalk-dim numeral text-[10px]">{Math.round(pct)}%</span>
                  </span>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {b.star_rating !== null && (
                  <span className="text-accent flex items-center gap-1 text-[11.5px]">
                    <Star size={11} className="fill-current" />
                    <span className="numeral">{b.star_rating}</span>
                  </span>
                )}
                {b.finished_at && (
                  <span className="text-chalk-dim hidden text-right text-[10.5px] sm:block">
                    {fmtLongDate(b.finished_at)}
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Classifier ─────────────────────────────────────────────────────── */
/**
 * Backfills fiction (when catalog subjects didn't settle it) and series
 * across the library. New books get this on enrich; this button is for the
 * backlog. Costs a little, so it stays behind an explicit click.
 */
function Classifier() {
  const qc = useQueryClient();
  const { data: left } = useQuery({ queryKey: ["unclassified"], queryFn: unclassifiedCount });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; series: number; left: number } | null>(
    null,
  );

  async function run() {
    setRunning(true);
    let done = 0;
    let series = 0;
    try {
      for (let i = 0; i < 100; i++) {
        const r = await classifyBatch(60);
        done += r.processed;
        series += r.series;
        setProgress({ done, series, left: r.remaining });
        if (r.remaining === 0 || r.processed === 0) break;
      }
      toast.success(`${done} classified · ${series} in a series`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Classification failed");
    } finally {
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["unclassified"] });
    }
  }

  if (!left) return null;

  return (
    <div>
      <h2 className="rule-head mb-2">Fiction &amp; series</h2>
      <p className="text-chalk-dim mb-2 text-[11px] leading-relaxed">
        {left.toLocaleString()} books still need sorting. Fiction usually comes from the catalog;
        this asks Claude to fill the gaps and assign series.
      </p>
      <button
        onClick={run}
        disabled={running}
        className="bg-panel text-cream flex w-full items-center justify-center gap-2 rounded-sm border border-accent/30 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.15em] transition hover:border-accent disabled:opacity-50"
      >
        <Layers size={13} />
        {running
          ? `${progress?.done ?? 0} done · ${progress?.left ?? left} left`
          : "Sort the library"}
      </button>
    </div>
  );
}

/* ── Readwise ───────────────────────────────────────────────────────── */
/** Pulls Kindle/Readwise highlights and attaches them to matching books. */
function ReadwiseSync() {
  const qc = useQueryClient();
  const { data: syncedAt } = useQuery({
    queryKey: ["readwise-synced"],
    queryFn: readwiseSyncedAt,
  });
  const { data: counts } = useQuery({
    queryKey: ["highlight-counts"],
    queryFn: fetchHighlightCounts,
  });

  const total = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);
  const books = Object.keys(counts ?? {}).length;

  const sync = useMutation({
    // A first run has nothing to be incremental against, so it reads it all.
    mutationFn: (full: boolean) => syncReadwise(full),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["highlight-counts"] });
      qc.invalidateQueries({ queryKey: ["readwise-synced"] });
      qc.invalidateQueries({ queryKey: ["highlights"] });
      toast.success(
        r.highlights
          ? `${r.highlights} highlights · ${r.matched} books matched`
          : "Already up to date",
      );
      // Titles Readwise has that the library doesn't — usually worth knowing.
      if (r.unmatched.length) {
        toast(`${r.unmatched.length} not in your library, e.g. ${r.unmatched[0]}`, {
          icon: "📕",
          duration: 6000,
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Readwise sync failed"),
  });

  return (
    <div>
      <h2 className="rule-head mb-2">Highlights</h2>
      <p className="text-chalk-dim mb-2 text-[11px] leading-relaxed">
        {total > 0
          ? `${total.toLocaleString()} highlights across ${books} book${books === 1 ? "" : "s"}.`
          : "Pull your Kindle highlights in from Readwise. They attach to the matching book."}
      </p>

      <button
        onClick={() => sync.mutate(total === 0)}
        disabled={sync.isPending}
        className="bg-panel text-cream flex w-full items-center justify-center gap-2 rounded-sm border border-accent/30 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.15em] transition hover:border-accent disabled:opacity-50"
      >
        <RefreshCw size={13} className={sync.isPending ? "animate-spin" : ""} />
        {sync.isPending ? "Syncing" : total > 0 ? "Sync highlights" : "Import highlights"}
      </button>

      {syncedAt && (
        <button
          onClick={() => sync.mutate(true)}
          disabled={sync.isPending}
          title="Re-read every highlight, not just what changed"
          className="text-chalk-dim hover:text-accent mt-1.5 w-full text-[10px] uppercase tracking-[0.14em]"
        >
          Last synced {fmtLongDate(syncedAt.slice(0, 10))} · full resync
        </button>
      )}
    </div>
  );
}

/* ── Cover backfill ─────────────────────────────────────────────────── */
function CoverBackfill() {
  const qc = useQueryClient();
  const { data: remaining } = useQuery({ queryKey: ["enrich-remaining"], queryFn: enrichRemaining });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ found: number; blurbs: number; left: number } | null>(
    null,
  );

  async function run() {
    setRunning(true);
    let found = 0;
    let blurbs = 0;
    try {
      // Loop batches until the server says nothing is left. Bounded so a
      // permanently-failing row can't spin forever.
      for (let i = 0; i < 300; i++) {
        const r = await backfillCoversBatch(12);
        found += r.found;
        blurbs += r.blurbs ?? 0;
        setProgress({ found, blurbs, left: r.remaining });
        if (r.remaining === 0 || r.processed === 0) break;
      }
      toast.success(`${found} covers, ${blurbs} descriptions`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["enrich-remaining"] });
      qc.invalidateQueries({ queryKey: ["on-deck"] });
    }
  }

  if (!remaining) return null;

  return (
    <div>
      <h2 className="rule-head mb-2">Book details</h2>
      <p className="text-chalk-dim mb-2 text-[11px] leading-relaxed">
        {remaining.toLocaleString()} books still need details. This fetches cover art, page
        counts, descriptions and publishers — none of which StoryGraph exports.
      </p>
      <button
        onClick={run}
        disabled={running}
        className="bg-panel text-cream flex w-full items-center justify-center gap-2 rounded-sm border border-accent/30 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.15em] transition hover:border-accent disabled:opacity-50"
      >
        <ImageDown size={14} />
        {running
          ? `${progress?.found ?? 0} covers · ${progress?.blurbs ?? 0} blurbs · ${progress?.left ?? remaining} left`
          : "Fetch details"}
      </button>
    </div>
  );
}

/* ── Stats popover ──────────────────────────────────────────────────── */
/** Months / tags / goal in a sheet next to the shelves — not buried above. */
function StatsPopover({
  books,
  sessions,
  filter,
  onClose,
  onDrill,
  onTag,
}: {
  books: Book[];
  sessions: ReadingSession[];
  filter: Filter | null;
  onClose: () => void;
  onDrill: (period: string) => void;
  onTag: (t: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Reading stats"
        className="bg-field max-h-[85vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-xl border border-accent/25 p-5 shadow-2xl sm:rounded-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-cream text-[20px]">
            Browse by <span className="text-accent">month</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-chalk hover:text-cream rounded-full p-1.5"
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex flex-col gap-6">
          <MonthlyStats
            books={books}
            sessions={sessions}
            onDrill={(y) => {
              onDrill(y);
              onClose();
            }}
          />
          <GoalCard
            books={books}
            onDrill={(y) => {
              onDrill(y);
              onClose();
            }}
          />
          <TagStats
            books={books}
            active={filter?.type === "tag" ? filter.value : null}
            onPick={(t) => {
              onTag(t);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function ReadingPage() {
  const qc = useQueryClient();
  const { data: books, isLoading, error } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const { data: sessions } = useQuery({ queryKey: ["reading-sessions"], queryFn: fetchSessions });
  const { data: highlightCounts } = useQuery({
    queryKey: ["highlight-counts"],
    queryFn: fetchHighlightCounts,
  });

  // One-shot: StoryGraph left some finished books on To Read with dates/ratings.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const n = await repairMisfiledReads();
        if (!cancelled && n > 0) {
          await qc.invalidateQueries({ queryKey: ["books"] });
          toast.success(
            n === 1
              ? "Moved 1 finished book off To read"
              : `Moved ${n} finished books off To read`,
          );
        }
      } catch {
        // Non-fatal — shelf still loads.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qc]);
  const [shelf, setShelf] = useState<ReadStatus>("currently-reading");
  // One filter across author / tag / year, so every number on the page can
  // be a link into the list that produced it.
  const [filter, setFilter] = useState<Filter | null>(null);
  const [open, setOpen] = useState<Book | null>(null);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownFocus | null>(null);
  const [askSeed, setAskSeed] = useState<{ query: string; mode: "catalog" | "search" } | undefined>();
  const [statsOpen, setStatsOpen] = useState(false);
  const [searchPage, setSearchPage] = useState<string | null>(null);
  // Jackets or details — remembered, because it's a taste thing, not a mode.
  const [view, setView] = useState<"list" | "grid">(
    () => (localStorage.getItem("reading-view") as "list" | "grid" | null) ?? "list",
  );

  type ReadingHistory = {
    readingBook?: string;
    readingBrowse?: boolean;
    readingAsk?: boolean;
    readingBreakdown?: BreakdownFocus;
  };

  const pickView = (v: "list" | "grid") => {
    setView(v);
    localStorage.setItem("reading-view", v);
  };

  // Swipe-back / browser back walks book detail, browse, ask, and breakdowns.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const st = (e.state as ReadingHistory | null) ?? {};
      if (st.readingBook) {
        setOpen((books ?? []).find((x) => x.id === st.readingBook) ?? null);
      } else {
        setOpen(null);
      }
      setBrowsing(Boolean(st.readingBrowse));
      setAsking(Boolean(st.readingAsk));
      setBreakdown(st.readingBreakdown ?? null);
      if (!st.readingAsk) setAskSeed(undefined);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [books]);

  const pushReading = (patch: ReadingHistory) => {
    const cur = (history.state as ReadingHistory | null) ?? {};
    history.pushState({ ...cur, ...patch }, "", window.location.href);
  };

  const backOr = (clear: () => void, isOurs: (st: ReadingHistory) => boolean) => {
    const st = (history.state as ReadingHistory | null) ?? {};
    if (isOurs(st)) history.back();
    else clear();
  };

  const openBookDrawer = (b: Book) => {
    // Opening a book from browse/breakdown stacks on top so back returns there.
    setOpen(b);
    const cur = (history.state as ReadingHistory | null) ?? {};
    if (cur.readingBook !== b.id) {
      pushReading({ readingBook: b.id });
    }
  };

  const closeBookDrawer = () =>
    backOr(
      () => setOpen(null),
      (st) => Boolean(st.readingBook),
    );

  const openBrowse = () => {
    setOpen(null);
    setBrowsing(true);
    const st = (history.state as ReadingHistory | null) ?? {};
    if (!st.readingBrowse) {
      pushReading({
        readingBrowse: true,
        readingBook: undefined,
        readingAsk: undefined,
        readingBreakdown: undefined,
      });
    }
  };

  const closeBrowse = () =>
    backOr(
      () => setBrowsing(false),
      (st) => Boolean(st.readingBrowse),
    );

  const openAsk = (seed?: { query: string; mode: "catalog" | "search" }) => {
    setOpen(null);
    setAskSeed(seed);
    setAsking(true);
    const st = (history.state as ReadingHistory | null) ?? {};
    if (!st.readingAsk) {
      pushReading({
        readingAsk: true,
        readingBook: undefined,
        readingBrowse: undefined,
        readingBreakdown: undefined,
      });
    }
  };

  const closeAsk = () =>
    backOr(
      () => {
        setAsking(false);
        setAskSeed(undefined);
      },
      (st) => Boolean(st.readingAsk),
    );

  const openBreakdown = (focus: BreakdownFocus) => {
    setOpen(null);
    setBreakdown(focus);
    pushReading({
      readingBreakdown: focus,
      readingBook: undefined,
    });
  };

  const closeBreakdown = () =>
    backOr(
      () => setBreakdown(null),
      (st) => Boolean(st.readingBreakdown),
    );

  const findSimilar = (b: Book) => {
    const author = (b.authors ?? "").split(",")[0]?.trim();
    const bits = [b.title, author, ...(b.subjects ?? []).slice(0, 2)].filter(Boolean);
    // Close the book entry, then open ask on a clean history step.
    if ((history.state as ReadingHistory | null)?.readingBook) {
      history.replaceState(
        { ...((history.state as ReadingHistory | null) ?? {}), readingBook: undefined },
        "",
        window.location.href,
      );
    }
    setOpen(null);
    openAsk({ query: bits.join(" "), mode: "catalog" });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of books ?? []) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [books]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const b of books ?? []) for (const t of b.tags) set.add(t);
    return [...set].sort();
  }, [books]);

  const visible = useMemo(() => {
    // A filter looks across the whole library; the shelf tabs only apply
    // when you haven't drilled in from a stat or a tag.
    return (books ?? [])
      .filter((b) => (filter ? true : b.status === shelf))
      .filter((b) => {
        if (!filter) return true;
        if (filter.type === "tag") return b.tags.includes(filter.value);
        if (filter.type === "series") return b.series === filter.value;
        if (filter.type === "fiction") return b.fiction === (filter.value === "fiction");
        if (filter.type === "author") {
          // Multi-author books list everyone, so match any one contributor.
          return (b.authors ?? "")
            .split(",")
            .some((a) => a.trim().toLowerCase() === filter.value.toLowerCase());
        }
        // A prefix, so "2026" is a year and "2026-08" is a month.
        return b.finished_at?.startsWith(filter.value) ?? false;
      })
      .slice(0, 300);
  }, [books, shelf, filter]);

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
    <div className="flex min-h-0 flex-col">
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[1fr_306px]">
        <div className="flex min-w-0 flex-col gap-5 p-4 md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <LibrarySearch
            books={books ?? []}
            onOpen={openBookDrawer}
            onFullSearch={(q) => setSearchPage(q)}
          />
          <button
            onClick={() => setAdding(true)}
            className="from-accent-deep to-accent-dark text-cream flex items-center gap-2 rounded-sm bg-gradient-to-b px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.19em]"
          >
            <Plus size={13} /> Add
          </button>
          <button
            onClick={() => openAsk()}
            className="text-chalk hover:text-cream flex items-center gap-2 rounded-sm border border-accent/30 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.19em] transition hover:border-accent"
          >
            <Wand2 size={13} className="text-accent" /> Find
          </button>
        </div>

          <NowReading
            books={books ?? []}
            sessions={sessions ?? []}
            onOpen={openBookDrawer}
          />
          <OnDeckStrip onOpen={openBookDrawer} />

          {/* Today / Recent / heatmap sit above the shelf tabs so the tabs
              open the library under the numbers that describe it. */}
          <div className="flex flex-col gap-6 border-t border-accent/15 pt-5">
            <DailyPages sessions={sessions ?? []} onBreakdown={openBreakdown} />
            <PeriodTotals
              books={books ?? []}
              sessions={sessions ?? []}
              onBreakdown={openBreakdown}
            />
            <PagesCalendar sessions={sessions ?? []} />
          </div>

          <button
            type="button"
            onClick={openBrowse}
            className="text-chalk hover:text-cream group flex w-full items-center justify-between gap-3 rounded-sm border border-accent/25 bg-gradient-to-r from-accent/[0.07] to-transparent px-4 py-3 text-left transition hover:border-accent/50"
          >
            <span>
              <span className="text-accent block text-[10px] font-semibold uppercase tracking-[0.2em]">
                Browse
              </span>
              <span className="font-display text-cream mt-0.5 block text-[18px] leading-tight">
                New & popular
              </span>
              <span className="text-chalk-dim mt-0.5 block text-[11.5px]">
                New releases and what’s moving — like walking the front tables.
              </span>
            </span>
            <Sparkles size={16} className="text-accent shrink-0 opacity-80 group-hover:opacity-100" />
          </button>

          <div className="relative flex flex-wrap items-center gap-1">
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

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStatsOpen(true)}
                aria-label="Months and tags"
                title="Months & tags"
                className="text-chalk-dim hover:text-cream flex items-center gap-1.5 rounded-sm border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition hover:border-accent/40"
              >
                <ChartColumn size={14} />
                <span className="hidden sm:inline">Months</span>
              </button>
              {([
                ["grid", LayoutGrid, "Covers"],
                ["list", Rows3, "Details"],
              ] as const).map(([v, Icon, label]) => (
                <button
                  key={v}
                  onClick={() => pickView(v)}
                  aria-label={label}
                  title={label}
                  className={cn(
                    "rounded-sm border p-1.5 transition-colors",
                    view === v
                      ? "border-accent/50 bg-accent/15 text-accent"
                      : "text-chalk-dim hover:text-cream border-white/10",
                  )}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>

          {filter && (
            <button
              onClick={() => setFilter(null)}
              className="bg-accent/15 text-accent border-accent/40 self-start rounded-sm border px-3 py-1.5 text-[11px] uppercase tracking-[0.15em]"
            >
              {filter.type === "fiction"
                ? filter.value === "fiction"
                  ? "Fiction"
                  : "Non-fiction"
                : filter.type === "series"
                  ? filter.value
                  : filter.type === "year"
                    ? filter.value.length === 7
                      ? new Date(`${filter.value}-02T12:00:00`).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })
                      : filter.value
                    : `${filter.type}: ${filter.value}`}{" "}
              · {visible.length} · clear ✕
            </button>
          )}

          <Shelf
            books={visible}
            view={view}
            highlights={highlightCounts ?? {}}
            onOpen={openBookDrawer}
            onFilter={setFilter}
          />
        </div>

        <aside className="bg-ink hidden flex-col gap-6 border-accent/15 p-4 md:p-6 lg:flex lg:border-l">
          <GoalCard books={books ?? []} onDrill={(y) => setFilter({ type: "year", value: y })} />
          <MonthlyStats
            books={books ?? []}
            sessions={sessions ?? []}
            onDrill={(y) => setFilter({ type: "year", value: y })}
          />
          <TagStats
            books={books ?? []}
            active={filter?.type === "tag" ? filter.value : null}
            onPick={(t) =>
              setFilter(
                filter?.type === "tag" && filter.value === t ? null : { type: "tag", value: t },
              )
            }
          />
        </aside>
      </div>

      {/* Always the last thing on the page — covers, highlights, fiction/series. */}
      <div className="bg-ink flex flex-col gap-6 border-t border-accent/15 p-4 md:p-6 lg:grid lg:grid-cols-3 lg:gap-6">
        <ReadwiseSync />
        <CoverBackfill />
        <Classifier />
      </div>

      {openBook && (
        <BookDetail
          book={openBook}
          books={books ?? []}
          onClose={closeBookDrawer}
          allTags={allTags}
          onFilter={setFilter}
          onFindSimilar={findSimilar}
          onOpenBook={openBookDrawer}
        />
      )}
      {adding && (
        <AddPanel
          onClose={() => setAdding(false)}
          onAdded={(b) => openBookDrawer(b)}
        />
      )}
      {searchPage !== null && (
        <SearchResultsPage
          query={searchPage}
          books={books ?? []}
          onClose={() => setSearchPage(null)}
          onOpen={openBookDrawer}
        />
      )}
      {asking && (
        <AskAI
          books={books ?? []}
          seed={askSeed}
          onClose={closeAsk}
          onOpen={openBookDrawer}
        />
      )}
      {browsing && <NewPopularPanel books={books ?? []} onClose={closeBrowse} />}
      {breakdown && (
        <StatsBreakdown
          focus={breakdown}
          books={books ?? []}
          sessions={sessions ?? []}
          onClose={closeBreakdown}
          onOpenBook={openBookDrawer}
          onDrill={openBreakdown}
        />
      )}
      {statsOpen && (
        <StatsPopover
          books={books ?? []}
          sessions={sessions ?? []}
          filter={filter}
          onClose={() => setStatsOpen(false)}
          onDrill={(y) => setFilter({ type: "year", value: y })}
          onTag={(t) =>
            setFilter(
              filter?.type === "tag" && filter.value === t ? null : { type: "tag", value: t },
            )
          }
        />
      )}
    </div>
  );
}
