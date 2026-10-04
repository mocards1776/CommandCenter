import { cn } from "@/lib/utils";

/** One playoff series line. Renders nothing when the feed has no series facts. */
export default function PlayoffSeriesLine({
  line,
  className,
}: {
  line?: string | null;
  className?: string;
}) {
  if (!line) return null;
  return (
    <p title={line} className={cn("truncate text-[11px] font-semibold tracking-wide text-cream", className)}>
      {line}
    </p>
  );
}
