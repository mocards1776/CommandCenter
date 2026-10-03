import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  W: "bg-emerald-400/15 text-emerald-300 ring-emerald-300/30",
  L: "bg-red-400/15 text-red-300 ring-red-300/30",
  T: "bg-amber-300/15 text-amber-200 ring-amber-300/30",
  OTL: "bg-amber-300/15 text-amber-200 ring-amber-300/30",
};

/** Shared W/L (or OTL) pill used on team schedules. */
export default function TeamResultBadge({
  result,
  className,
}: {
  result: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-8 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-[0.08em] ring-1",
        TONE[result] ?? "bg-white/10 text-white/70 ring-white/15",
        className,
      )}
    >
      {result}
    </span>
  );
}
