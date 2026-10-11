import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Team mark at the call site's size. The size class is the image slot.
 * No backing disc — marks render on the surface behind them.
 */
export default function LogoPlate({
  src,
  alt = "",
  className,
  imgClassName,
  loading,
  washAnchor,
  fallbackSrc,
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  loading?: "eager" | "lazy";
  /** Marks this logo as the center of its side's TeamHalfWash. */
  washAnchor?: "away" | "home";
  /** Shown if `src` fails (e.g. a missing ESPN dark-background variant). */
  fallbackSrc?: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const shown = failed === src && fallbackSrc ? fallbackSrc : src;
  return (
    <img
      src={shown}
      onError={fallbackSrc && shown === src ? () => setFailed(src) : undefined}
      alt={alt}
      loading={loading}
      data-wash-anchor={washAnchor}
      className={cn("shrink-0 object-contain", className, imgClassName)}
    />
  );
}
