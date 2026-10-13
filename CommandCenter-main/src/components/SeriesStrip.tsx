import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BookOpen, Check, Layers, Pencil, X } from "lucide-react";
import toast from "react-hot-toast";
import { coverSrc, isMagazine } from "@/lib/books";
import {
  buildSeriesStrip,
  librarySeriesNames,
  normalizeSeriesName,
  parseSeriesPositionInput,
  seriesPositionLabel,
  seriesSummary,
  type SeriesStripItem,
} from "@/lib/book-series";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

type SeriesPatch = { series: string | null; series_position: number | null };

/**
 * Every volume of the open book's series, in order, with the open one marked.
 * Tap a cover to jump to that volume. The pencil edits the series name and
 * position; a book outside any series gets a quiet "Add to a series".
 */
export default function SeriesStrip({
  book,
  books,
  onOpenBook,
  onBrowse,
  onSave,
  saving = false,
}: {
  book: Book;
  books: Book[];
  onOpenBook: (b: Book) => void;
  /** Filter the library to this series. */
  onBrowse: (series: string) => void;
  onSave: (patch: SeriesPatch) => void;
  saving?: boolean;
}) {
  const strip = useMemo(() => buildSeriesStrip(book, books), [book, books]);
  const names = useMemo(() => librarySeriesNames(books), [books]);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [posDraft, setPosDraft] = useState("");
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEditing(false);
  }, [book.id]);

  // Centre the open volume without scrolling the sheet itself.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !strip) return;
    const card = el.querySelector<HTMLElement>("[data-current='true']");
    if (!card) return;
    const left = card.offsetLeft - (el.clientWidth - card.clientWidth) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, [strip, book.id]);

  if (isMagazine(book)) return null;

  const startEdit = () => {
    setNameDraft(book.series ?? "");
    setPosDraft(seriesPositionLabel(book.series_position).replace(/^#/, ""));
    setEditing(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const series = normalizeSeriesName(nameDraft);
    const pos = parseSeriesPositionInput(posDraft);
    if (pos === undefined) {
      toast.error("Position should be a number like 3 or 12.5");
      return;
    }
    if (!series && pos !== null) {
      toast.error("Add a series name first");
      return;
    }
    onSave({ series, series_position: series ? pos : null });
    setEditing(false);
  };

  const editForm = (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
      <input
        list="series-strip-names"
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        placeholder="Series name"
        autoFocus
        className="bg-field text-cream min-w-0 flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-[13px] outline-none focus:border-white/25"
      />
      <datalist id="series-strip-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <input
        value={posDraft}
        onChange={(e) => setPosDraft(e.target.value)}
        inputMode="decimal"
        placeholder="#"
        aria-label="Position in series"
        className="numeral bg-field text-cream w-16 rounded-xl border border-white/10 px-2.5 py-2.5 text-center text-[13px] outline-none focus:border-white/25"
      />
      <button
        type="submit"
        disabled={saving}
        className="from-accent-deep to-accent-dark text-cream rounded-xl bg-gradient-to-b px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.15em] disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Cancel"
        className="text-chalk-dim hover:text-cream rounded-xl border border-white/10 p-2.5 transition hover:border-white/20"
      >
        <X size={13} />
      </button>
      {book.series && (
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            onSave({ series: null, series_position: null });
            setEditing(false);
          }}
          className="text-chalk-dim hover:text-alert ml-auto text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
        >
          Remove from series
        </button>
      )}
    </form>
  );

  if (!strip) {
    return (
      <div className="mb-6">
        {editing ? (
          <>
            <span className="label-caps">Series</span>
            {editForm}
          </>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="text-chalk hover:text-cream flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2.5 text-[10.5px] uppercase tracking-[0.15em] transition hover:border-white/20"
          >
            <Layers size={13} className="opacity-70" />
            Add to a series
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-7" data-testid="series-strip">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="label-caps">Series</span>
          <p className="text-cream mt-1 flex min-w-0 items-baseline gap-2 text-[15px] tracking-[-0.01em]">
            <button
              type="button"
              onClick={() => onBrowse(strip.name)}
              title="Browse this series in the library"
              className="hover:text-accent inline-flex min-w-0 items-center gap-1.5 truncate text-left transition"
            >
              <Layers size={13} className="shrink-0 opacity-60" />
              <span className="truncate">{strip.name}</span>
            </button>
            <span className="numeral text-chalk-dim shrink-0 text-[12px]">{seriesSummary(strip)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={editing ? () => setEditing(false) : startEdit}
          aria-label={editing ? "Stop editing series" : "Edit series"}
          className="text-chalk-dim hover:text-cream mt-0.5 shrink-0 rounded-full p-1.5 transition hover:bg-white/10"
        >
          {editing ? <X size={13} /> : <Pencil size={13} />}
        </button>
      </div>

      {editing && editForm}

      <div
        ref={scroller}
        className="-mx-6 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {strip.items.map((item) => (
          <SeriesCard key={item.key} item={item} onOpen={onOpenBook} />
        ))}
      </div>
    </div>
  );
}

function SeriesCard({
  item,
  onOpen,
}: {
  item: SeriesStripItem<Book>;
  onOpen: (b: Book) => void;
}) {
  if (item.kind === "gap") {
    return (
      <div
        className="w-[68px] shrink-0 snap-start self-start sm:w-[76px]"
        title={`#${item.position} isn't in your library yet`}
      >
        <div className="text-chalk-dim grid aspect-[74/104] w-full place-items-center rounded-[3px] border border-dashed border-white/12">
          <span className="numeral text-[12px]">#{item.position}</span>
        </div>
        <p className="text-chalk-dim mt-1.5 text-[10px] leading-tight">Not in library</p>
      </div>
    );
  }

  const b = item.book;
  const cover = coverSrc(b);
  const pos = seriesPositionLabel(item.position);

  return (
    <button
      type="button"
      data-current={item.isCurrent ? "true" : undefined}
      aria-current={item.isCurrent ? "true" : undefined}
      onClick={() => {
        if (!item.isCurrent) onOpen(b);
      }}
      title={`${b.title}${pos ? ` · ${pos}` : ""}${item.editions.length > 1 ? ` · ${item.editions.length} editions` : ""}`}
      className={cn(
        "group w-[68px] shrink-0 snap-start self-start text-left sm:w-[76px]",
        item.isCurrent ? "cursor-default" : "",
      )}
    >
      <div
        className={cn(
          "relative aspect-[74/104] w-full overflow-hidden rounded-[3px] transition",
          !item.isCurrent && "group-hover:-translate-y-1",
          item.isCurrent
            ? "ring-2 ring-accent shadow-[0_0_0_4px_rgba(217,81,92,0.18),0_10px_24px_rgba(0,0,0,.5)]"
            : "ring-1 ring-white/10 shadow-lg",
          !item.isCurrent && !item.isRead && !item.isReading && "opacity-60 saturate-[.7]",
        )}
      >
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="bg-panel grid h-full w-full place-items-center">
            <BookOpen size={14} className="text-chalk-dim" />
          </div>
        )}
        {pos && (
          <span className="numeral text-cream absolute left-1 top-1 rounded-[3px] bg-black/55 px-1 py-px text-[9.5px] leading-[14px] tracking-[0.02em] backdrop-blur-sm">
            {pos}
          </span>
        )}
        {item.isRead && (
          <span
            aria-label="Read"
            className="text-field absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-cream/90"
          >
            <Check size={10} strokeWidth={3} />
          </span>
        )}
        {!item.isRead && item.isReading && (
          <span
            aria-label="Reading"
            className="bg-accent absolute bottom-1 right-1 h-2 w-2 rounded-full ring-2 ring-black/40"
          />
        )}
      </div>
      <p
        className={cn(
          "mt-1.5 line-clamp-2 text-[10px] leading-tight",
          item.isCurrent ? "text-cream" : "text-chalk",
        )}
      >
        {b.title}
      </p>
    </button>
  );
}
