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
