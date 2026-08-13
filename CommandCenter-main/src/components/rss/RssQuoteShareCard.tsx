import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import toast from "react-hot-toast";
import type { RssHighlight } from "@/lib/rss";

const W = 1080;
const H = 1350;

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

async function paint(canvas: HTMLCanvasElement, highlight: RssHighlight) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  await document.fonts?.ready;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0c1a36");
  bg.addColorStop(0.55, "#081228");
  bg.addColorStop(1, "#120a14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft accent wash
  const wash = ctx.createRadialGradient(W * 0.2, H * 0.15, 40, W * 0.2, H * 0.15, 520);
  wash.addColorStop(0, "rgba(217,81,92,0.28)");
  wash.addColorStop(1, "rgba(217,81,92,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  const margin = 96;
  const maxWidth = W - margin * 2;

  ctx.fillStyle = "#d9515c";
  ctx.fillRect(margin, 96, 120, 7);

  ctx.font = `700 26px "Libre Franklin", system-ui, sans-serif`;
  ctx.fillStyle = "#d9515c";
  ctx.letterSpacing = "4px";
  ctx.fillText("DISPATCH", margin, 150);
  ctx.letterSpacing = "0px";

  // Giant opening quote
  ctx.font = `120px "Playfair Display", Georgia, serif`;
  ctx.fillStyle = "rgba(217,81,92,0.55)";
  ctx.fillText("“", margin - 10, 280);

  ctx.font = `48px "Playfair Display", Georgia, serif`;
  ctx.fillStyle = "#f5f1e8";
  const quoteLines = wrap(ctx, highlight.quoteText, maxWidth).slice(0, 10);
  let y = 300;
  for (const line of quoteLines) {
    ctx.fillText(line, margin, y);
    y += 62;
  }

  if (highlight.note) {
    y += 28;
    ctx.fillStyle = "rgba(245,241,232,0.18)";
    ctx.fillRect(margin, y, 80, 3);
    y += 48;
    ctx.font = `28px "Libre Franklin", system-ui, sans-serif`;
    ctx.fillStyle = "rgba(245,241,232,0.78)";
    for (const line of wrap(ctx, highlight.note, maxWidth).slice(0, 4)) {
      ctx.fillText(line, margin, y);
      y += 40;
    }
  }

  // Footer
  const footerY = H - 140;
  ctx.fillStyle = "rgba(245,241,232,0.14)";
  ctx.fillRect(margin, footerY - 40, maxWidth, 1);

  ctx.font = `600 22px "Libre Franklin", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(217,81,92,0.95)";
  ctx.fillText("FROM", margin, footerY);

  ctx.font = `32px "Playfair Display", Georgia, serif`;
  ctx.fillStyle = "#f5f1e8";
  const title =
    wrap(ctx, highlight.articleTitle || "Article", maxWidth).slice(0, 2).join(" ") || "Article";
  ctx.fillText(title.slice(0, 72), margin, footerY + 44);
}

async function canvasBlob(highlight: RssHighlight): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await paint(canvas, highlight);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Could not render the image");
  return blob;
}

/** Stylized quote share sheet for Dispatch highlights. */
export default function RssQuoteShareCard({
  highlight,
  onClose,
}: {
  highlight: RssHighlight;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void paint(canvas, highlight);
  }, [highlight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await canvasBlob(highlight);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dispatch-quote-${highlight.id.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the image");
    } finally {
      setBusy(false);
    }
  }, [highlight]);

  const share = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await canvasBlob(highlight);
      const file = new File([blob], `dispatch-quote-${highlight.id.slice(0, 8)}.png`, {
        type: "image/png",
      });
      const data = {
        files: [file],
        title: highlight.articleTitle || "Dispatch note",
        text: highlight.quoteText.slice(0, 180),
      };
      if (canShare && navigator.canShare(data)) {
        await navigator.share(data);
      } else {
        await save();
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "Could not share");
    } finally {
      setBusy(false);
    }
  }, [highlight, canShare, save]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share highlight"
    >
      <div
        className="bg-panel relative m-3 w-full max-w-md overflow-hidden rounded-xl border border-white/10 shadow-2xl sm:m-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="text-chalk hover:text-cream absolute top-3 right-3 z-10 rounded-sm p-1.5 hover:bg-white/10"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="bg-[#081228] px-5 pt-6 pb-4">
          <p className="text-accent text-[10px] font-semibold uppercase tracking-[0.2em]">
            Dispatch quote
          </p>
          <canvas ref={canvasRef} className="mt-4 w-full rounded-lg shadow-lg" />
        </div>
        <div className="flex gap-2 p-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void share()}
            className="from-accent-deep to-accent-dark text-cream inline-flex flex-1 items-center justify-center gap-2 rounded-sm bg-gradient-to-b px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
          >
            <Share2 size={14} />
            Share
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="text-chalk hover:text-cream inline-flex items-center justify-center gap-2 rounded-sm border border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.16em] disabled:opacity-40"
          >
            <Download size={14} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
