import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Download, ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import toast from "react-hot-toast";
import { saveHighlightNote } from "@/lib/books";
import type { Book, BookHighlight } from "@/types";

/** Portrait, the shape every phone wants to share. */
const W = 1080;
const H = 1350;

/** Greedy wrap against real measured widths — canvas has no text layout. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Paint the shareable card. The cover is drawn twice — once blurred and
 * over-scaled as a wash, once sharp and small at the foot — which is what
 * makes it read as *that book's* quote rather than generic text on a colour.
 */
async function paint(
  canvas: HTMLCanvasElement,
  highlight: BookHighlight,
  book: Book,
  coverSrc: string | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;

  // The quote is set in the app's display face; without this it silently
  // falls back to a default serif mid-draw.
  await document.fonts?.ready;

  let cover: HTMLImageElement | null = null;
  if (coverSrc) {
    cover = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      // Storage serves `access-control-allow-origin: *`, so the canvas stays
      // untainted and toBlob() works. Without this it throws on export.
      img.crossOrigin = "anonymous";
      // A cover that never loads must not hold the export hostage: onerror
      // does not always fire (a connection that stalls rather than refuses
      // just hangs), which left the card blank with no way to recover.
      const done = setTimeout(() => resolve(null), 5000);
      const finish = (v: HTMLImageElement | null) => {
        clearTimeout(done);
        resolve(v);
      };
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = coverSrc;
    });
  }

  ctx.fillStyle = "#081228";
  ctx.fillRect(0, 0, W, H);

  if (cover) {
    // Cover-fit the jacket across the whole card, blurred into a wash.
    const scale = Math.max(W / cover.width, H / cover.height) * 1.4;
    const w = cover.width * scale;
    const h = cover.height * scale;
    ctx.save();
    ctx.filter = "blur(55px)";
    ctx.globalAlpha = 0.9;
    ctx.drawImage(cover, (W - w) / 2, (H - h) / 2, w, h);
    ctx.restore();
  }

  // Darken so text stays legible over any jacket.
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, "rgba(8,18,40,0.74)");
  veil.addColorStop(0.5, "rgba(8,18,40,0.6)");
  veil.addColorStop(1, "rgba(8,18,40,0.92)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  // Accent rule at the top, the flag stripe motif.
  ctx.fillStyle = "#d9515c";
  ctx.fillRect(90, 96, 120, 6);

  const margin = 90;
  const maxWidth = W - margin * 2;

  // Shrink the quote until it fits rather than clipping a long one.
  let size = 54;
  let lines: string[] = [];
  for (; size >= 26; size -= 2) {
    ctx.font = `${size}px "Playfair Display", Georgia, serif`;
    lines = wrap(ctx, `“${highlight.text.trim()}”`, maxWidth);
    if (lines.length * size * 1.42 <= H - 470) break;
  }

  const noteLines = highlight.my_note?.trim()
    ? (() => {
        ctx.font = `italic 30px "Libre Franklin", system-ui, sans-serif`;
        return wrap(ctx, highlight.my_note.trim(), maxWidth).slice(0, 4);
      })()
    : [];

  // The band between the accent rule and the attribution block, so a short
  // quote sits centred rather than stranded at the top.
  const bandTop = 150;
  const bandBottom = H - 260;
  const blockHeight =
    lines.length * size * 1.42 + (noteLines.length ? 26 + noteLines.length * 42 : 0);
  let y = Math.max(bandTop, bandTop + (bandBottom - bandTop - blockHeight) / 2);

  ctx.font = `${size}px "Playfair Display", Georgia, serif`;
  ctx.fillStyle = "#f5f1e8";
  ctx.textBaseline = "top";
  for (const line of lines) {
    ctx.fillText(line, margin, y);
    y += size * 1.42;
  }

  if (noteLines.length) {
    ctx.font = `italic 30px "Libre Franklin", system-ui, sans-serif`;
    ctx.fillStyle = "rgba(217,81,92,0.95)";
    y += 26;
    for (const line of noteLines) {
      ctx.fillText(line, margin, y);
      y += 42;
    }
  }

  // Attribution block, anchored to the foot so cards line up when stacked.
  const footY = H - 210;
  if (cover) {
    const ch = 150;
    const cw = (cover.width / cover.height) * ch;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(cover, margin, footY, cw, ch);
    ctx.restore();
    ctx.translate(cw + 28, 0);
  }

  ctx.font = `34px "Playfair Display", Georgia, serif`;
  ctx.fillStyle = "#f5f1e8";
  const title = wrap(ctx, book.title, maxWidth - 220)[0] ?? book.title;
  ctx.fillText(title, margin, footY + 34);

  ctx.font = `26px "Libre Franklin", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(245,241,232,0.6)";
  ctx.fillText(book.authors ?? "", margin, footY + 84);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export default function HighlightCard({
  highlight,
  book,
  cover,
  onClose,
  onPrev,
  onNext,
}: {
  highlight: BookHighlight;
  book: Book;
  cover: string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(highlight.my_note ?? "");

  useEffect(() => {
    setNote(highlight.my_note ?? "");
    setEditing(false);
  }, [highlight.id, highlight.my_note]);

  const saveNote = useMutation({
    mutationFn: () => saveHighlightNote(highlight.id, note.trim() || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["highlights"] });
      setEditing(false);
      toast.success("Note saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const download = useCallback(async () => {
    const canvas = canvasRef.current ?? document.createElement("canvas");
    try {
      await paint(canvas, highlight, book, cover);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("Could not render the image");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${book.title.replace(/[^\w ]+/g, "").slice(0, 40) || "highlight"}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Saved");
    } catch (e) {
      // A tainted canvas throws only at export time, so this is where a CORS
      // problem would actually surface.
      toast.error(e instanceof Error ? e.message : "Could not save the image");
    }
  }, [highlight, book, cover]);

  // Arrows page through the book's highlights; Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* The jacket, oversized and blurred — the same wash the export uses. */}
      {cover && (
        <img
          src={cover}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-30 blur-3xl"
        />
      )}

      <button
        onClick={onClose}
        aria-label="Close"
        className="text-chalk hover:text-cream absolute right-4 z-10 rounded-full bg-black/40 p-2 backdrop-blur"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <X size={20} />
      </button>

      {onPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Previous highlight"
          className="text-chalk hover:text-cream absolute left-2 z-10 rounded-full bg-black/40 p-2 backdrop-blur md:left-6"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {onNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Next highlight"
          className="text-chalk hover:text-cream absolute right-2 z-10 rounded-full bg-black/40 p-2 backdrop-blur md:right-6"
        >
          <ChevronRight size={22} />
        </button>
      )}

      <div
        className="relative z-10 max-h-full w-full max-w-2xl overflow-y-auto px-8 py-16 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="bg-accent mx-auto mb-8 block h-[3px] w-14" />

        <blockquote className="font-display text-cream whitespace-pre-line text-[clamp(19px,4.2vw,32px)] leading-[1.42]">
          {highlight.text}
        </blockquote>

        {highlight.note && (
          <p className="text-chalk-dim mx-auto mt-6 max-w-md text-[12.5px] italic">
            {highlight.note}
          </p>
        )}

        {editing ? (
          <div className="mx-auto mt-7 max-w-md">
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What did this make you think?"
              className="bg-field/80 text-cream w-full resize-y rounded-sm border border-accent/40 px-3 py-2 text-left text-[13px] outline-none"
            />
            <div className="mt-2 flex justify-center gap-3">
              <button
                onClick={() => saveNote.mutate()}
                disabled={saveNote.isPending}
                className="text-accent text-[10.5px] uppercase tracking-[0.19em] disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setNote(highlight.my_note ?? "");
                  setEditing(false);
                }}
                className="text-chalk-dim hover:text-cream text-[10.5px] uppercase tracking-[0.19em]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="group mx-auto mt-7 block max-w-md"
          >
            {highlight.my_note ? (
              <p className="text-accent group-hover:text-cream border-accent/40 border-l-2 pl-3 text-left text-[13px] italic leading-relaxed">
                {highlight.my_note}
              </p>
            ) : (
              <span className="text-chalk-dim group-hover:text-accent flex items-center gap-2 text-[10.5px] uppercase tracking-[0.19em]">
                <PenLine size={12} /> Add a note
              </span>
            )}
          </button>
        )}

        <div className="mt-10">
          <p className="text-cream font-display text-[15px]">{book.title}</p>
          <p className="text-chalk-dim mt-0.5 text-[11.5px]">{book.authors}</p>
          {highlight.location !== null && (
            <p className="text-chalk-dim mt-1 text-[10px] uppercase tracking-[0.19em]">
              {highlight.location_type === "page" ? "Page" : "Location"} {highlight.location}
            </p>
          )}
        </div>

        <button
          onClick={download}
          className="text-chalk hover:text-cream mx-auto mt-8 flex items-center gap-2 rounded-sm border border-white/15 px-5 py-2.5 text-[10.5px] uppercase tracking-[0.19em] transition hover:border-accent"
        >
          <Download size={13} /> Save as image
        </button>
      </div>

      {/* Off-screen scratch surface for the export. */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
