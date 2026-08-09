import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import toast from "react-hot-toast";
import type { BookFinishPayload } from "./celebration-context";
import { fmtLongDate } from "@/lib/utils";

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

async function loadCover(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const done = setTimeout(() => resolve(null), 5000);
    const finish = (v: HTMLImageElement | null) => {
      clearTimeout(done);
      resolve(v);
    };
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
  });
}

async function paint(canvas: HTMLCanvasElement, card: BookFinishPayload) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  await document.fonts?.ready;

  const cover = await loadCover(card.coverUrl);

  ctx.fillStyle = "#081228";
  ctx.fillRect(0, 0, W, H);

  if (cover) {
    const scale = Math.max(W / cover.width, H / cover.height) * 1.35;
    const w = cover.width * scale;
    const h = cover.height * scale;
    ctx.save();
    ctx.filter = "blur(48px)";
    ctx.globalAlpha = 0.88;
    ctx.drawImage(cover, (W - w) / 2, (H - h) / 2 - 40, w, h);
    ctx.restore();
  }

  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, "rgba(8,18,40,0.55)");
  veil.addColorStop(0.42, "rgba(8,18,40,0.42)");
  veil.addColorStop(1, "rgba(8,18,40,0.94)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#d9515c";
  ctx.fillRect(90, 88, 110, 6);

  ctx.font = `600 28px "Libre Franklin", system-ui, sans-serif`;
  ctx.fillStyle = "#d9515c";
  ctx.fillText("FINISHED", 90, 140);

  // Dominant jacket — share cards lead with the cover.
  if (cover) {
    const ch = 520;
    const cw = Math.min(360, (cover.width / cover.height) * ch);
    const cx = (W - cw) / 2;
    const cy = 180;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    ctx.drawImage(cover, cx, cy, cw, ch);
    ctx.restore();
  }

  const textTop = cover ? 740 : 220;
  const margin = 90;
  const maxWidth = W - margin * 2;

  ctx.font = `52px "Playfair Display", Georgia, serif`;
  ctx.fillStyle = "#f5f1e8";
  const titleLines = wrap(ctx, card.title, maxWidth).slice(0, 3);
  let y = textTop;
  for (const line of titleLines) {
    ctx.fillText(line, margin, y);
    y += 62;
  }

  if (card.authors) {
    ctx.font = `28px "Libre Franklin", system-ui, sans-serif`;
    ctx.fillStyle = "rgba(245,241,232,0.62)";
    const author = wrap(ctx, card.authors, maxWidth)[0] ?? card.authors;
    ctx.fillText(author, margin, y + 8);
    y += 52;
  }

  y += 28;
  ctx.fillStyle = "rgba(245,241,232,0.18)";
  ctx.fillRect(margin, y, maxWidth, 1);
  y += 40;

  const stats: string[] = [];
  if (card.pages != null) stats.push(`${card.pages} pages`);
  if (card.days != null) stats.push(card.days === 1 ? "1 day" : `${card.days} days`);
  if (card.rating != null) stats.push(`${card.rating}★`);
  stats.push(fmtLongDate(card.finishedAt));

  ctx.font = `26px "Libre Franklin", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(245,241,232,0.78)";
  ctx.fillText(stats.join("  ·  "), margin, y);
  y += 70;

  // Week / month / year book numbers — the share hook.
  const ordinals = [
    { n: card.weekNumber, label: "THIS WEEK" },
    { n: card.monthNumber, label: "THIS MONTH" },
    { n: card.yearNumber, label: "THIS YEAR" },
  ];
  const colW = maxWidth / 3;
  ordinals.forEach((o, i) => {
    const x = margin + colW * i;
    ctx.font = `600 22px "Libre Franklin", system-ui, sans-serif`;
    ctx.fillStyle = "rgba(217,81,92,0.95)";
    ctx.fillText(o.label, x, y);
    ctx.font = `64px "Playfair Display", Georgia, serif`;
    ctx.fillStyle = "#f5f1e8";
    ctx.fillText(`#${o.n}`, x, y + 66);
  });
}

async function canvasBlob(card: BookFinishPayload): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await paint(canvas, card);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Could not render the image");
  return blob;
}

function ordinalWord(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][Math.min(n % 10, 9)]}`;
}

export default function FinishBookCard({
  card,
  onClose,
}: {
  card: BookFinishPayload;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

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
      const blob = await canvasBlob(card);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${card.title.replace(/[^\w ]+/g, "").slice(0, 40) || "finished-book"}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the image");
    } finally {
      setBusy(false);
    }
  }, [card]);

  const share = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await canvasBlob(card);
      const file = new File(
        [blob],
        `${card.title.replace(/[^\w ]+/g, "").slice(0, 40) || "finished-book"}.png`,
        { type: "image/png" },
      );
      const data = {
        files: [file],
        title: `Finished: ${card.title}`,
        text: `${card.title} — #${card.weekNumber} this week, #${card.monthNumber} this month, #${card.yearNumber} this year`,
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
  }, [card, canShare, save]);

  const stats: { label: string; value: string }[] = [];
  if (card.pages != null) stats.push({ label: "Pages", value: String(card.pages) });
  if (card.days != null) stats.push({ label: "Days", value: String(card.days) });
  if (card.rating != null) stats.push({ label: "Rated", value: `${card.rating}★` });

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-black/75 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Finished ${card.title}`}
    >
      {card.coverUrl && (
        <img
          src={card.coverUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-35 blur-3xl"
        />
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-chalk hover:text-cream absolute right-4 z-10 rounded-full bg-black/45 p-2 backdrop-blur"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <X size={20} />
      </button>

      <div
        className="cc-finish-card relative z-10 mx-4 mb-[max(1rem,env(safe-area-inset-bottom))] mt-16 w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/12 bg-[#0a1428]/95 shadow-2xl sm:mb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {card.coverUrl ? (
            <img
              src={card.coverUrl}
              alt=""
              className="mx-auto h-[280px] w-full object-cover object-top sm:h-[320px]"
            />
          ) : (
            <div className="flex h-[220px] items-end bg-gradient-to-br from-[#1a2744] to-[#0a1428] px-6 pb-6">
              <p className="font-display text-cream/40 text-[42px] leading-none">Aa</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0a1428] to-transparent" />
          <p className="text-accent absolute top-4 left-4 text-[10px] font-semibold uppercase tracking-[0.22em]">
            Finished
          </p>
        </div>

        <div className="space-y-4 px-5 pt-1 pb-5">
          <div>
            <h2 className="font-display text-cream text-[26px] leading-[1.15]">{card.title}</h2>
            {card.authors && (
              <p className="text-chalk-dim mt-1 text-[13px]">{card.authors}</p>
            )}
            <p className="text-chalk-dim mt-1.5 text-[11px] uppercase tracking-[0.14em]">
              {fmtLongDate(card.finishedAt)}
            </p>
          </div>

          {stats.length > 0 && (
            <dl
              className="grid gap-2 border-y border-white/10 py-3"
              style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
            >
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <dt className="text-chalk-dim text-[9px] font-semibold uppercase tracking-[0.16em]">
                    {s.label}
                  </dt>
                  <dd className="font-display text-cream mt-0.5 text-[22px] leading-none">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["Week", card.weekNumber],
                ["Month", card.monthNumber],
                ["Year", card.yearNumber],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2.5 text-center"
              >
                <p className="text-accent text-[9px] font-semibold uppercase tracking-[0.14em]">
                  {label}
                </p>
                <p className="font-display text-cream mt-1 text-[28px] leading-none">#{n}</p>
                <p className="text-chalk-dim mt-1 text-[10px]">{ordinalWord(n)} book</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void share()}
              className="bg-accent text-cream flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] disabled:opacity-50"
            >
              <Share2 size={14} /> Share
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="text-chalk hover:text-cream flex items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2.5 text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
            >
              <Download size={14} /> Save
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
