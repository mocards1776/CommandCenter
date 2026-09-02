import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

/** Inline highlight player without native controls (avoids iOS overlay chrome). */
export default function HighlightVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(true);
    setProgress(0);
    void video.play().catch(() => setPlaying(false));
  }, [src]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  };

  return (
    <div className="relative aspect-video w-full bg-black">
      <button
        type="button"
        aria-label={playing ? "Pause highlight" : "Play highlight"}
        onClick={togglePlayback}
        className="absolute inset-0 z-0"
      />
      <video
        ref={videoRef}
        key={src}
        src={src}
        autoPlay
        playsInline
        preload="auto"
        className="pointer-events-none relative z-10 h-full w-full"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (!video.duration) return;
          setProgress(video.currentTime / video.duration);
        }}
      />
      {!playing ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/20">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-white/30 bg-black/50 text-[#e8ebf2] backdrop-blur-[1px]">
            <Play size={22} className="ml-0.5 fill-current" />
          </span>
        </div>
      ) : null}
      <div
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onClick={(event) => {
          event.stopPropagation();
          seek(event);
        }}
        className="absolute right-0 bottom-0 left-0 z-30 h-8 cursor-pointer px-3 pb-2.5"
      >
        <div className="mt-auto h-1 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white/80" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
