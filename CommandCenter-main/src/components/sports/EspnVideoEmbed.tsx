import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";

export type EspnEmbedClip = {
  id: string;
  headline: string;
  description?: string | null;
  thumb: string | null;
  mp4: string | null;
  href: string | null;
  durationSec?: number | null;
};

function formatDuration(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Inline ESPN MP4 player (tap poster → play). Falls back to ESPN web link. */
export default function EspnVideoEmbed({
  clip,
  eyebrow = "ESPN video",
}: {
  clip: EspnEmbedClip;
  eyebrow?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const duration = formatDuration(clip.durationSec);
  const canEmbed = Boolean(clip.mp4);

  if (playing && clip.mp4) {
    return (
      <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0b1220]">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            {eyebrow}
          </p>
          <button
            type="button"
            onClick={() => setPlaying(false)}
            className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7] hover:text-cream"
          >
            Close
          </button>
        </div>
        <div className="relative aspect-video bg-black">
          <video
            key={clip.mp4}
            src={clip.mp4}
            controls
            autoPlay
            playsInline
            poster={clip.thumb ?? undefined}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[13px] font-semibold leading-snug text-cream">{clip.headline}</p>
          {clip.description ? (
            <p className="text-chalk mt-1 line-clamp-2 text-[11px] leading-relaxed">
              {clip.description}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  const body = (
    <>
      <div className="relative aspect-video bg-black/50">
        {clip.thumb ? (
          <img src={clip.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#132033] to-[#0a101c]" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover:bg-black/20">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/45 text-cream backdrop-blur-[1px]">
            <Play size={18} className="ml-0.5 fill-current" />
          </span>
        </span>
        {duration ? (
          <span className="absolute right-2 bottom-2 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] text-[#d5dae6]">
            {duration}
          </span>
        ) : null}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {eyebrow}
        </p>
        <p className="mt-1 text-[13px] font-semibold leading-snug text-cream">{clip.headline}</p>
        {clip.description ? (
          <p className="text-chalk mt-1 line-clamp-2 text-[11px] leading-relaxed">
            {clip.description}
          </p>
        ) : null}
        {!canEmbed && clip.href ? (
          <p className="text-chalk-dim mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]">
            Watch on ESPN <ExternalLink size={11} />
          </p>
        ) : null}
      </div>
    </>
  );

  if (canEmbed) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="group block w-full overflow-hidden rounded-xl border border-white/[0.1] bg-[#0b1220] text-left transition hover:border-white/20"
      >
        {body}
      </button>
    );
  }

  if (clip.href) {
    return (
      <a
        href={clip.href}
        target="_blank"
        rel="noreferrer"
        className="group block overflow-hidden rounded-xl border border-white/[0.1] bg-[#0b1220] transition hover:border-white/20"
      >
        {body}
      </a>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0b1220]">{body}</div>
  );
}
