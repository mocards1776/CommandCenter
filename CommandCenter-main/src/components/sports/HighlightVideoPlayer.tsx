import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";

const SEEK_SECONDS = 5;
const DOUBLE_TAP_MS = 320;
const CHROME_HIDE_MS = 2800;

/** Inline highlight player without native controls (avoids iOS overlay chrome). */
export default function HighlightVideoPlayer({
  src,
  startMuted = true,
}: {
  src: string;
  /** Default true — autoplay policies + UX: start muted. */
  startMuted?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chromeTimerRef = useRef<number | null>(null);
  const singleTapTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ at: number; zone: "left" | "right" } | null>(null);

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(startMuted);
  const [progress, setProgress] = useState(0);
  const [showChrome, setShowChrome] = useState(false);
  const [seekHint, setSeekHint] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(true);
    setMuted(startMuted);
    video.muted = startMuted;
    setProgress(0);
    setShowChrome(false);
    void video.play().catch(() => setPlaying(false));
  }, [src, startMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    return () => {
      if (chromeTimerRef.current != null) window.clearTimeout(chromeTimerRef.current);
      if (singleTapTimerRef.current != null) window.clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  const revealChrome = () => {
    setShowChrome(true);
    if (chromeTimerRef.current != null) window.clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = window.setTimeout(() => setShowChrome(false), CHROME_HIDE_MS);
  };

  const flashSeekHint = (label: string) => {
    setSeekHint(label);
    window.setTimeout(() => setSeekHint(null), 700);
  };

  const seekBy = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(
      video.duration || Number.POSITIVE_INFINITY,
      Math.max(0, video.currentTime + delta),
    );
    video.currentTime = next;
    flashSeekHint(delta < 0 ? `-${SEEK_SECONDS}s` : `+${SEEK_SECONDS}s`);
    revealChrome();
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
    revealChrome();
  };

  const seekToRatio = (ratio: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    video.currentTime = ratio * video.duration;
    revealChrome();
  };

  const tapZone = (clientX: number): "left" | "center" | "right" => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect?.width) return "center";
    const ratio = (clientX - rect.left) / rect.width;
    if (ratio < 0.34) return "left";
    if (ratio > 0.66) return "right";
    return "center";
  };

  const handleSurfaceTap = (clientX: number) => {
    const zone = tapZone(clientX);
    const now = Date.now();
    const last = lastTapRef.current;

    if (
      (zone === "left" || zone === "right") &&
      last &&
      last.zone === zone &&
      now - last.at <= DOUBLE_TAP_MS
    ) {
      if (singleTapTimerRef.current != null) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = null;
      seekBy(zone === "left" ? -SEEK_SECONDS : SEEK_SECONDS);
      return;
    }

    if (zone === "left" || zone === "right") {
      lastTapRef.current = { at: now, zone };
      revealChrome();
      return;
    }

    lastTapRef.current = null;
    if (singleTapTimerRef.current != null) window.clearTimeout(singleTapTimerRef.current);
    singleTapTimerRef.current = window.setTimeout(() => {
      singleTapTimerRef.current = null;
      togglePlayback();
    }, DOUBLE_TAP_MS);
  };

  return (
    <div ref={rootRef} className="relative aspect-video w-full bg-black">
      <video
        ref={videoRef}
        key={src}
        src={src}
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        className="h-full w-full"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (!video.duration) return;
          setProgress(video.currentTime / video.duration);
        }}
      />
      <button
        type="button"
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute top-3 right-3 z-50 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/55 text-[#e8ebf2]"
        onClick={(event) => {
          event.stopPropagation();
          setMuted((m) => !m);
          revealChrome();
        }}
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <button
        type="button"
        aria-label="Video controls"
        className="absolute inset-0 z-20"
        onPointerUp={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          handleSurfaceTap(event.clientX);
        }}
      />
      {!playing ? (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/20">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-white/30 bg-black/50 text-[#e8ebf2] backdrop-blur-[1px]">
            <Play size={22} className="ml-0.5 fill-current" />
          </span>
        </div>
      ) : null}
      {seekHint ? (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <span className="rounded-md bg-black/55 px-3 py-1.5 text-[13px] font-medium text-white/90">
            {seekHint}
          </span>
        </div>
      ) : null}
      <div
        className={`absolute right-0 bottom-0 left-0 z-40 px-3 pb-2.5 transition-opacity duration-200 ${
          showChrome ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          role="slider"
          aria-label="Playback position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
            seekToRatio(ratio);
          }}
          className="h-5 cursor-pointer"
        >
          <div className="mt-auto h-0.5 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white/70" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
