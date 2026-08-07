import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Search, Star } from "lucide-react";
import toast from "react-hot-toast";
import { fetchBooks, importStoryGraphCsv, clearBooks } from "@/lib/books";
import StarField from "@/components/StarField";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

const SHELVES = [
  { key: "currently-reading", label: "Reading now" },
  { key: "read", label: "Read" },
  { key: "to-read", label: "To read" },
  { key: "did-not-finish", label: "Did not finish" },
] as const;

type Shelf = (typeof SHELVES)[number]["key"];

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-chalk-dim text-[11px]">—</span>;
  return (
    <span className="text-accent inline-flex items-center gap-1 text-[11px]" title={`${rating} / 5`}>
      <Star size={11} className="fill-current" />
      <span className="numeral">{rating.toFixed(2).replace(/\.?0+$/, "")}</span>
    </span>
  );
}

/** Books finished per year — the shape of a reading life. */
function YearChart({ books }: { books: Book[] }) {
  const byYear = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of books) {
      if (b.status !== "read" || !b.last_date_read) continue;
      const y = b.last_date_read.slice(0, 4);
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-10);
  }, [books]);

  if (byYear.length === 0) return null;
  const max = Math.max(...byYear.map(([, n]) => n));

  return (
    <div>
      <h2 className="rule-head mb-3">Books per year</h2>
      <div className="flex h-32 items-end gap-2">
        {byYear.map(([year, n]) => (
          <div key={year} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="numeral text-cream text-[11px]">{n}</span>
            <div
              className="from-accent-deep to-accent w-full rounded-sm bg-gradient-to-t"
              style={{ height: `${Math.max(4, (n / max) * 88)}px` }}
              title={`${year}: ${n} books`}
            />
            <span className="text-chalk-dim text-[10px]">{year.slice(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const importer = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      return importStoryGraphCsv(text, (done, total) =>
        setProgress(`${done.toLocaleString()} of ${total.toLocaleString()}`),
      );
    },
    onSuccess: (r) => {
      setProgress(null);
      toast.success(
        `Imported ${r.inserted.toLocaleString()} books` +
          (r.skipped ? ` (${r.skipped} rows skipped)` : ""),
      );
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
        <h2 className="font-display text-cream text-[30px] leading-tight">Import your library</h2>
        <p className="text-chalk mx-auto mt-2 max-w-md text-sm">
          Export from The StoryGraph (Manage Account → Export StoryGraph Library) and drop the CSV
          here. Ratings, tags, formats and read dates all come across.
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
          className="from-accent-deep to-accent-dark text-cream mt-5 inline-flex items-center gap-2.5 rounded-sm bg-gradient-to-b px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.20em] transition hover:brightness-110 disabled:opacity-50"
        >
          <Upload size={14} />
          {importer.isPending ? (progress ?? "Importing…") : "Choose CSV"}
        </button>
      </div>
    </div>
  );
}

export default function ReadingPage() {
  const qc = useQueryClient();
  const { data: books, isLoading, error } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });

  const [shelf, setShelf] = useState<Shelf>("read");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const b of books ?? []) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [books]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (books ?? [])
      .filter((b) => b.status === shelf)
      .filter(
        (b) =>
          !needle ||
          b.title.toLowerCase().includes(needle) ||
          (b.authors ?? "").toLowerCase().includes(needle) ||
          b.tags.some((t) => t.toLowerCase().includes(needle)),
      )
      .slice(0, 300); // the list is virtual-less; cap the DOM
  }, [books, shelf, q]);

  const rated = (books ?? []).filter((b) => b.star_rating !== null);
  const avg = rated.length
    ? rated.reduce((s, b) => s + (b.star_rating ?? 0), 0) / rated.length
    : 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ["books"] });

  if (error) {
    return (
      <div className="p-7">
        <div className="bg-panel border-alert/40 text-alert rounded border p-4 text-sm">
          Could not load books: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <p className="label-caps animate-pulse p-10 text-center">Loading library</p>;
  }

  if ((books ?? []).length === 0) {
    return (
      <div className="p-6 md:p-7">
        <ImportPanel onDone={refresh} />
      </div>
    );
  }

  return (
    <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[1fr_306px]">
      <div className="flex min-w-0 flex-col gap-4 p-6 md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="rule-head shrink-0 grow-0 after:hidden">Reading</h2>
          <div className="bg-panel flex flex-1 items-center gap-2.5 rounded-sm border border-white/10 px-4 focus-within:border-accent/50">
            <Search size={14} className="text-chalk-dim shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, author, or tag"
              className="placeholder:text-chalk-dim flex-1 bg-transparent py-2.5 text-[13px] outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {SHELVES.map((s) => (
            <button
              key={s.key}
              onClick={() => setShelf(s.key)}
              className={cn(
                "px-3 py-1.5 text-[10.5px] uppercase tracking-[0.19em] transition-colors",
                shelf === s.key
                  ? "text-accent border-accent border-b"
                  : "text-chalk hover:text-cream",
              )}
            >
              {s.label}
              <span className="text-chalk-dim ml-1.5">{counts[s.key] ?? 0}</span>
            </button>
          ))}
          <span className="label-caps ml-auto">
            {visible.length.toLocaleString()} shown
            {visible.length === 300 && " (capped)"}
          </span>
        </div>

        <div className="bg-panel rounded border border-white/[0.07]">
          {visible.length === 0 ? (
            <p className="text-chalk py-10 text-center text-sm">Nothing on this shelf.</p>
          ) : (
            <ul>
              {visible.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-4 border-b border-white/[0.055] px-5 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px]">{b.title}</p>
                    <p className="text-chalk-dim truncate text-[11px]">
                      {b.authors || "Unknown author"}
                      {b.read_count > 1 && ` · read ${b.read_count}×`}
                    </p>
                  </div>
                  {b.format && (
                    <span className="text-chalk-dim hidden shrink-0 text-[10px] uppercase tracking-[0.10em] sm:inline">
                      {b.format}
                    </span>
                  )}
                  <span className="w-14 shrink-0 text-right">
                    <Stars rating={b.star_rating} />
                  </span>
                  <span className="text-chalk w-[62px] shrink-0 text-right text-[10.5px] tracking-[0.10em]">
                    {b.last_date_read?.slice(0, 7).replace("-", "/") ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="bg-ink flex flex-col gap-5 border-l border-accent/15 p-6">
        <div className="bg-accent/15 grid grid-cols-2 gap-px">
          <div className="bg-panel px-4 py-3">
            <div className="label-caps text-[9.5px] tracking-[0.17em]">Books</div>
            <div className="numeral text-cream mt-1 text-[29px] leading-tight">
              {(books ?? []).length.toLocaleString()}
            </div>
          </div>
          <div className="bg-panel px-4 py-3">
            <div className="label-caps text-[9.5px] tracking-[0.17em]">Read</div>
            <div className="numeral text-accent mt-1 text-[29px] leading-tight">
              {(counts["read"] ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-panel px-4 py-3">
            <div className="label-caps text-[9.5px] tracking-[0.17em]">To read</div>
            <div className="numeral text-cream mt-1 text-[29px] leading-tight">
              {(counts["to-read"] ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-panel px-4 py-3">
            <div className="label-caps text-[9.5px] tracking-[0.17em]">Avg rating</div>
            <div className="numeral text-accent mt-1 text-[29px] leading-tight">
              {avg ? avg.toFixed(2) : "—"}
            </div>
          </div>
        </div>

        <YearChart books={books ?? []} />

        <button
          onClick={async () => {
            if (!confirm("Delete every book and re-import from scratch?")) return;
            try {
              await clearBooks();
              refresh();
              toast.success("Library cleared");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not clear");
            }
          }}
          className="text-chalk-dim hover:text-alert mt-auto text-[10.5px] uppercase tracking-[0.19em] transition-colors"
        >
          Clear and re-import
        </button>
      </aside>
    </div>
  );
}
