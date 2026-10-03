import { cn } from "@/lib/utils";

/** Top-25 poll ranks are large/bold; otherwise show smaller ESPN FPI ordinal. */
export default function CfbRankLabel({
  pollRank,
  fpiRank,
  className,
  pollClassName,
  fpiClassName,
}: {
  pollRank: number | null | undefined;
  fpiRank?: number | null | undefined;
  className?: string;
  pollClassName?: string;
  fpiClassName?: string;
}) {
  if (pollRank != null && pollRank >= 1 && pollRank <= 25) {
    return (
      <span className={cn("font-bold tabular-nums", pollClassName ?? className)}>
        #{pollRank}{" "}
      </span>
    );
  }
  if (fpiRank != null && fpiRank > 0) {
    return (
      <span
        className={cn(
          "text-[0.72em] font-medium tabular-nums text-[#8b93a7]",
          fpiClassName ?? className,
        )}
        title="ESPN Football Power Index rank"
      >
        FPI #{fpiRank}{" "}
      </span>
    );
  }
  return null;
}

/** FPI under the record. Hidden when a top-25 poll rank is already on the name. */
export function CfbFpiCaption({
  pollRank,
  fpiRank,
  className,
}: {
  pollRank: number | null | undefined;
  fpiRank?: number | null | undefined;
  className?: string;
}) {
  if (pollRank != null && pollRank >= 1 && pollRank <= 25) return null;
  if (fpiRank == null || fpiRank <= 0) return null;
  return (
    <p
      className={cn("text-[10px] font-medium tabular-nums tracking-wide text-white/40", className)}
      title="ESPN Football Power Index rank"
    >
      FPI #{fpiRank}
    </p>
  );
}
