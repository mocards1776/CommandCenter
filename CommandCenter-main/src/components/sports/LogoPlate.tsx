import { cn } from "@/lib/utils";

/**
 * Light circular plate behind a team mark so dark logos stay readable on
 * navy sports chrome. The size class is the existing slot; the image is
 * inset onto the disc so the layout rhythm does not grow.
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
    <span
      className={cn(
        "relative inline-block shrink-0 rounded-full bg-[#f4f6f8] shadow-[0_0_0_1.5px_rgba(255,255,255,0.82),0_1px_3px_rgba(0,0,0,0.28)] ring-1 ring-black/10",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn(
          "absolute left-[12%] top-[12%] h-[76%] w-[76%] object-contain",
          imgClassName,
        )}
      />
    </span>
  );
}
