import { useState } from "react";
import { mlbHeadshotFallbacks } from "@/lib/mlb";
import { cn } from "@/lib/utils";

/** Headshot with real-photo-first fallbacks (avoids permanent generic silhouette). */
export default function PlayerHeadshot({
  playerId,
  size = 213,
  className,
  alt = "",
}: {
  playerId: number | string;
  size?: 213 | 426;
  className?: string;
  alt?: string;
}) {
  const chain = mlbHeadshotFallbacks(playerId, size);
  const [idx, setIdx] = useState(0);
  const src = chain[Math.min(idx, chain.length - 1)] ?? chain[0]!;

  return (
    <img
      src={src}
      alt={alt}
      className={cn("bg-black/30 object-cover", className)}
      loading="lazy"
      onError={() => {
        setIdx((i) => (i + 1 < chain.length ? i + 1 : i));
      }}
    />
  );
}
