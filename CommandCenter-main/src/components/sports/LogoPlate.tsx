import { cn } from "@/lib/utils";

/**
 * Opaque white disc behind a team mark so dark logos (Iowa hawk class)
 * stay readable on navy sports chrome. The size class is the existing
 * slot; the image is inset onto the disc so the layout does not grow.
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
        "relative inline-block shrink-0 rounded-full bg-white shadow-md ring-1 ring-black/10",
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
