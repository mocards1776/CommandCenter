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
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  loading?: "eager" | "lazy";
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={cn("shrink-0 object-contain", className, imgClassName)}
    />
  );
}
