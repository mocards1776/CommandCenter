import { resolveNhlDarkRimHref } from "@/lib/nhl-dark-logos";
import { cn } from "@/lib/utils";

/**
 * Team mark at the call site's size. The size class is the image slot.
 * No backing disc — marks render on the surface behind them.
 * Navy-on-navy NHL marks (Lightning, Capitals) swap to a vendored rim PNG.
 */
export default function LogoPlate({
  src,
  alt = "",
  className,
  imgClassName,
  loading,
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  loading?: "eager" | "lazy";
}) {
  return (
    <img
      src={resolveNhlDarkRimHref({ url: src }) ?? src}
      alt={alt}
      loading={loading}
      className={cn("shrink-0 object-contain", className, imgClassName)}
    />
  );
}
